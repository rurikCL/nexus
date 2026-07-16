<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\CharacterNave;
use App\Models\MapNave;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class NaveController extends Controller
{
    /** GET /naves — catálogo de naves disponibles para comprar */
    public function catalogo(): JsonResponse
    {
        return response()->json(['naves' => MapNave::orderBy('costo')->get()]);
    }

    /** GET /naves/mias — naves propiedad del personaje */
    public function mias(Request $request): JsonResponse
    {
        $character = $request->user()->character;
        if (! $character) {
            return response()->json(['error' => 'Sin personaje'], 404);
        }

        $naves = $character->naves()
            ->with([
                'nave.habilidad1', 'nave.habilidad2', 'nave.habilidad3', 'nave.habilidad4',
                'mejora1', 'mejora2', 'mejora3', 'mejora4',
            ])
            ->get();

        return response()->json([
            'naves' => $naves,
            'nave_equipada_id' => $character->nave_equipada_id,
            'capacidad_carga' => $character->capacidadCarga(),
            'credits' => $character->credits,
        ]);
    }

    /** POST /naves/{ownedId}/equipar */
    public function equipar(Request $request, int $ownedId): JsonResponse
    {
        $character = $request->user()->character;
        if (! $character) {
            return response()->json(['error' => 'Sin personaje'], 404);
        }

        $owned = CharacterNave::where('character_id', $character->id)->findOrFail($ownedId);

        $character->update(['nave_equipada_id' => $owned->id]);

        return response()->json(['nave_equipada_id' => $owned->id]);
    }

    /** POST /naves/desequipar */
    public function desequipar(Request $request): JsonResponse
    {
        $character = $request->user()->character;
        if (! $character) {
            return response()->json(['error' => 'Sin personaje'], 404);
        }

        $character->update(['nave_equipada_id' => null]);

        return response()->json(['ok' => true]);
    }

    /** POST /naves/{ownedId}/reabastecer — recarga combustible al máximo */
    public function reabastecer(Request $request, int $ownedId): JsonResponse
    {
        $character = $request->user()->character;
        if (! $character) {
            return response()->json(['error' => 'Sin personaje'], 404);
        }

        $owned = CharacterNave::where('character_id', $character->id)->with('nave')->findOrFail($ownedId);
        $costo = $owned->nave->costo_combustible;

        if ($character->credits < $costo) {
            return response()->json(['error' => 'No tienes suficientes créditos para reabastecer la nave.'], 422);
        }

        $character->decrement('credits', $costo);
        $owned->update(['combustible_actual' => $owned->capacidadSaltoConMejoras()]);

        return response()->json([
            'nave' => $owned->fresh('nave'),
            'credits_remaining' => $character->fresh()->credits,
        ]);
    }

    /** POST /naves/{ownedId}/reparar — restaura vida y escudo al máximo */
    public function reparar(Request $request, int $ownedId): JsonResponse
    {
        $character = $request->user()->character;
        if (! $character) {
            return response()->json(['error' => 'Sin personaje'], 404);
        }

        $owned = CharacterNave::where('character_id', $character->id)->with('nave')->findOrFail($ownedId);
        $costo = $owned->costoReparacionConMejoras();

        if ($character->credits < $costo) {
            return response()->json(['error' => 'No tienes suficientes créditos para reparar la nave.'], 422);
        }

        $character->decrement('credits', $costo);
        $owned->update([
            'vida_actual' => $owned->maxVidaConMejoras(),
            'escudo_actual' => $owned->maxEscudoConMejoras(),
        ]);

        return response()->json([
            'nave' => $owned->fresh('nave'),
            'credits_remaining' => $character->fresh()->credits,
        ]);
    }

    /**
     * POST /naves/{ownedId}/registrar-dano — persiste el HP/escudo restante de la nave
     * tras un encuentro naval contra NPC (emboscada pirata o encuentro espacial). El
     * combate en sí se resuelve en el cliente (igual que el resto de esos encuentros:
     * ver PirataEncuentroController), así que aquí solo se confía en el resultado final
     * reportado — se clampea a los máximos reales de la nave por seguridad.
     */
    public function registrarDano(Request $request, int $ownedId): JsonResponse
    {
        $character = $request->user()->character;
        if (! $character) {
            return response()->json(['error' => 'Sin personaje'], 404);
        }

        $data = $request->validate([
            'vida' => 'required|integer|min:0',
            'escudo' => 'required|integer|min:0',
        ]);

        $owned = CharacterNave::where('character_id', $character->id)->with('nave')->findOrFail($ownedId);

        $owned->update([
            'vida_actual' => min($data['vida'], $owned->maxVidaConMejoras()),
            'escudo_actual' => min($data['escudo'], $owned->maxEscudoConMejoras()),
        ]);

        return response()->json(['nave' => $owned->fresh('nave')]);
    }

    /** GET /naves/{ownedId}/mejoras-options — objetos tipo mejora_nave disponibles en el inventario del personaje */
    public function mejorasOptions(Request $request, int $ownedId): JsonResponse
    {
        $character = $request->user()->character;
        if (! $character) {
            return response()->json(['error' => 'Sin personaje'], 404);
        }

        CharacterNave::where('character_id', $character->id)->findOrFail($ownedId);

        $mejoras = $character->rolObjetos()
            ->where('tipo', 'mejora_nave')
            ->get();

        return response()->json(['mejoras' => $mejoras]);
    }

    /** POST /naves/{ownedId}/mejoras/{slot} — equipa (objeto_id) o desequipa (null) una mejora en el slot 1-4 */
    public function equiparMejora(Request $request, int $ownedId, int $slot): JsonResponse
    {
        if ($slot < 1 || $slot > 4) {
            return response()->json(['error' => 'Slot inválido'], 422);
        }

        $character = $request->user()->character;
        if (! $character) {
            return response()->json(['error' => 'Sin personaje'], 404);
        }

        $data = $request->validate(['objeto_id' => 'nullable|integer|exists:rol_objetos,id']);

        $owned = CharacterNave::where('character_id', $character->id)->with('nave')->findOrFail($ownedId);

        $objetoId = $data['objeto_id'] ?? null;
        if ($objetoId !== null) {
            $poseido = $character->rolObjetos()->where('rol_objetos.id', $objetoId)->where('tipo', 'mejora_nave')->exists();
            if (! $poseido) {
                return response()->json(['error' => 'No posees esa mejora'], 422);
            }
        }

        $owned->update(["mejora_{$slot}_id" => $objetoId]);

        return response()->json(['nave' => $owned->fresh(['nave', 'mejora1', 'mejora2', 'mejora3', 'mejora4'])]);
    }
}
