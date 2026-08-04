<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\CharacterArmadura;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ArmaduraController extends Controller
{
    /** Relaciones necesarias para calcular los bonos y pintar los slots en el frontend. */
    private const WITH = ['objeto', 'mejora1', 'mejora2', 'mejora3', 'mejora4'];

    /** GET /armaduras/mias — armaduras poseídas (con sus slots) y las del inventario sin instancia aún */
    public function mias(Request $request): JsonResponse
    {
        $character = $request->user()->character;
        if (! $character) {
            return response()->json(['error' => 'Sin personaje'], 404);
        }

        $armaduras = $character->armaduras()->with(self::WITH)->get();

        return response()->json([
            'armaduras' => $armaduras,
            'armadura_activa_id' => $armaduras->firstWhere('activo', true)?->id,
            // Objetos tipo "armadura" del inventario: incluye las que aún no tienen
            // instancia creada (nunca se equiparon), para poder ofrecerlas.
            'disponibles' => $character->rolObjetos()->where('tipo', 'armadura')->get(),
        ]);
    }

    /** POST /armaduras/equipar — equipa la armadura del inventario indicada (crea la instancia si no existe) */
    public function equipar(Request $request): JsonResponse
    {
        $data = $request->validate([
            'objeto_id' => 'required|integer|exists:rol_objetos,id',
        ]);

        $character = $request->user()->character;
        if (! $character) {
            return response()->json(['error' => 'Sin personaje'], 404);
        }

        $objeto = $character->rolObjetos()->where('rol_objetos.id', $data['objeto_id'])->first();
        if (! $objeto) {
            return response()->json(['error' => 'No posees ese objeto'], 403);
        }
        if ($objeto->tipo !== 'armadura') {
            return response()->json(['error' => 'Ese objeto no es una armadura'], 422);
        }

        $owned = CharacterArmadura::firstOrCreate([
            'character_id' => $character->id,
            'objeto_id' => $objeto->id,
        ]);

        // Solo una armadura activa a la vez (mismo criterio que el sable armado).
        $character->armaduras()->where('id', '!=', $owned->id)->update(['activo' => false]);
        $owned->update(['activo' => true]);

        return response()->json([
            'armadura' => $owned->fresh(self::WITH),
            'armadura_activa_id' => $owned->id,
        ]);
    }

    /** POST /armaduras/desequipar */
    public function desequipar(Request $request): JsonResponse
    {
        $character = $request->user()->character;
        if (! $character) {
            return response()->json(['error' => 'Sin personaje'], 404);
        }

        $character->armaduras()->update(['activo' => false]);

        return response()->json(['ok' => true]);
    }

    /** GET /armaduras/{ownedId}/mejoras-options — mejoras de armadura que el personaje posee */
    public function mejorasOptions(Request $request, int $ownedId): JsonResponse
    {
        $character = $request->user()->character;
        if (! $character) {
            return response()->json(['error' => 'Sin personaje'], 404);
        }

        $character->armaduras()->findOrFail($ownedId);

        return response()->json([
            'mejoras' => $character->rolObjetos()->where('tipo', 'mejora_armadura')->get(),
        ]);
    }

    /** POST /armaduras/{ownedId}/mejoras/{slot} — instala (objeto_id) o quita (null) una mejora en el slot 1-4 */
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

        $owned = $character->armaduras()->findOrFail($ownedId);

        $objetoId = $data['objeto_id'] ?? null;
        if ($objetoId !== null) {
            $poseido = $character->rolObjetos()
                ->where('rol_objetos.id', $objetoId)
                ->where('tipo', 'mejora_armadura')
                ->exists();
            if (! $poseido) {
                return response()->json(['error' => 'No posees esa mejora'], 422);
            }

            // La misma mejora no puede ocupar dos slots de la misma armadura.
            $yaInstalada = collect([1, 2, 3, 4])
                ->reject(fn ($i) => $i === $slot)
                ->contains(fn ($i) => (int) $owned->{"mejora_{$i}_id"} === (int) $objetoId);
            if ($yaInstalada) {
                return response()->json(['error' => 'Esa mejora ya está instalada en otro slot'], 422);
            }
        }

        $owned->update(["mejora_{$slot}_id" => $objetoId]);

        return response()->json(['armadura' => $owned->fresh(self::WITH)]);
    }
}
