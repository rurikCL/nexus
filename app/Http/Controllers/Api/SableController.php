<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Character;
use App\Models\CharacterSable;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class SableController extends Controller
{
    private function character(Request $request): Character
    {
        $character = $request->user()->character;
        abort_if(! $character, 404, 'Sin personaje');

        return $character;
    }

    private function slotRules(): array
    {
        $rules = ['nombre' => 'nullable|string|max:100'];
        foreach (array_keys(CharacterSable::SLOTS) as $slot) {
            $rules["{$slot}_id"] = 'nullable|integer|exists:rol_objetos,id';
        }

        return $rules;
    }

    /**
     * Verifica que cada slot enviado sea un objeto que el personaje posee
     * y que su `tipo` corresponda al slot indicado. También valida que el
     * consumo de energía total no supere la energía máxima del núcleo.
     */
    private function validarSlots(Character $character, array $data): array
    {
        $slots         = [];
        $consumoTotal  = 0;
        $energiaMaxima = 0;

        foreach (CharacterSable::SLOTS as $slot => $tipoEsperado) {
            $objetoId = $data["{$slot}_id"] ?? null;
            if (! $objetoId) {
                $slots["{$slot}_id"] = null;
                continue;
            }

            $objeto = $character->rolObjetos()->where('rol_objetos.id', $objetoId)->first();
            abort_if(! $objeto, 403, 'No posees ese componente.');
            abort_if($objeto->tipo !== $tipoEsperado, 422, "El objeto '{$objeto->nombre}' no es un componente de tipo {$tipoEsperado}.");

            $slots["{$slot}_id"] = $objetoId;
            $consumoTotal += $objeto->consumo_energia ?? 0;
            if ($slot === 'nucleo') {
                $energiaMaxima = $objeto->energia_maxima ?? 0;
            }
        }

        abort_if(
            $consumoTotal > $energiaMaxima,
            422,
            "El consumo de energía ({$consumoTotal}) supera la energía máxima del núcleo ({$energiaMaxima})."
        );

        return $slots;
    }

    private function autorizar(Character $character, CharacterSable $sable): void
    {
        abort_if($sable->character_id !== $character->id, 403, 'No autorizado.');
    }

    public function index(Request $request): JsonResponse
    {
        $character = $this->character($request);

        $sables = $character->sables()
            ->with(array_keys(CharacterSable::SLOTS))
            ->latest()
            ->get();

        return response()->json(['sables' => $sables]);
    }

    /**
     * Al ensamblar un sable, los componentes utilizados se consumen del
     * inventario del personaje (se eliminan de rol_character_objeto).
     */
    public function store(Request $request): JsonResponse
    {
        $character = $this->character($request);
        $data      = $request->validate($this->slotRules());
        $slots     = $this->validarSlots($character, $data);

        $sable = DB::transaction(function () use ($character, $slots, $data) {
            $sable = $character->sables()->create(array_merge($slots, [
                'nombre' => $data['nombre'] ?? 'Sable',
                'activo' => false,
            ]));

            $usados = array_values(array_filter($slots));
            if ($usados) {
                $character->rolObjetos()->detach($usados);
            }

            return $sable;
        });

        $sable->load(array_keys(CharacterSable::SLOTS));

        return response()->json([
            'sable'       => $sable,
            'rol_objetos' => $character->rolObjetos()->get(),
        ], 201);
    }

    public function update(Request $request, CharacterSable $sable): JsonResponse
    {
        $character = $this->character($request);
        $this->autorizar($character, $sable);

        $data  = $request->validate($this->slotRules());
        $slots = $this->validarSlots($character, $data);

        $sable->update(array_merge($slots, [
            'nombre' => $data['nombre'] ?? $sable->nombre,
        ]));

        $sable->load(array_keys(CharacterSable::SLOTS));

        return response()->json(['sable' => $sable]);
    }

    /**
     * Desarmar un sable: el cristal siempre vuelve al inventario del
     * personaje; además puede recuperarse un único componente a elección
     * (`recuperar_id`). El resto de las piezas se pierde.
     */
    public function destroy(Request $request, CharacterSable $sable): JsonResponse
    {
        $character = $this->character($request);
        $this->autorizar($character, $sable);

        $data = $request->validate([
            'recuperar_id' => 'nullable|integer',
        ]);

        DB::transaction(function () use ($character, $sable, $data) {
            $recuperar = [];
            if ($sable->cristal_id) {
                $recuperar[] = $sable->cristal_id;
            }

            $otrosSlots = collect(CharacterSable::SLOTS)
                ->keys()
                ->reject(fn ($slot) => $slot === 'cristal')
                ->map(fn ($slot) => $sable->{"{$slot}_id"})
                ->filter()
                ->values();

            $recuperarId = $data['recuperar_id'] ?? null;
            if ($recuperarId && $otrosSlots->contains($recuperarId)) {
                $recuperar[] = $recuperarId;
            }

            if ($recuperar) {
                $character->rolObjetos()->syncWithoutDetaching($recuperar);
            }

            $sable->delete();
        });

        return response()->json([
            'ok'          => true,
            'rol_objetos' => $character->rolObjetos()->get(),
        ]);
    }

    public function activar(Request $request, CharacterSable $sable): JsonResponse
    {
        $character = $this->character($request);
        $this->autorizar($character, $sable);

        DB::transaction(function () use ($character, $sable) {
            $character->sables()->update(['activo' => false]);
            $sable->update(['activo' => true]);

            $sable->load('cristal');
            if ($sable->cristal && $sable->cristal->color_hoja) {
                $character->update(['saber_color' => $sable->cristal->color_hoja]);
            }
        });

        $sable->load(array_keys(CharacterSable::SLOTS));

        return response()->json([
            'sable'       => $sable,
            'saber_color' => $character->fresh()->saber_color,
        ]);
    }
}
