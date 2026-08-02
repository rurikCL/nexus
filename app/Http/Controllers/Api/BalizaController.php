<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\BalizaAyuda;
use App\Models\PvpCombat;
use App\Services\MapTravelService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class BalizaController extends Controller
{
    /** GET /balizas/usables — objetos tipo `utilizable_mundo` en el inventario del personaje. */
    public function usables(Request $request): JsonResponse
    {
        $character = $request->user()->character;
        if (! $character) {
            return response()->json(['objetos' => []]);
        }

        $objetos = $character->rolObjetos()
            ->where('rol_objetos.tipo', 'utilizable_mundo')
            ->get()
            ->map(fn ($o) => [
                'id' => $o->id,
                'nombre' => $o->nombre,
                'imagen' => $o->imagen,
                'descripcion' => $o->descripcion,
                'cantidad' => $o->pivot->cantidad,
            ]);

        return response()->json(['objetos' => $objetos->values()]);
    }

    /** GET /balizas/activas — todas las balizas activas, visibles globalmente en el widget de Comando. */
    public function activas(Request $request): JsonResponse
    {
        $userId = $request->user()->id;

        $balizas = BalizaAyuda::activas()
            ->with(['user:id,name', 'character:id,handle,name', 'mapSistema:id,nombre', 'mapPlaneta:id,nombre', 'mapZona:id,nombre', 'mapLugar:id,nombre'])
            ->latest()
            ->get()
            ->map(fn (BalizaAyuda $b) => $b->toAlertArray($userId))
            ->values();

        return response()->json(['balizas' => $balizas]);
    }

    /** POST /balizas {rol_objeto_id} — usa un objeto `utilizable_mundo` del inventario y despliega una baliza en la ubicación actual del personaje. */
    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'rol_objeto_id' => 'required|integer|exists:rol_objetos,id',
        ]);

        $user = $request->user();
        $character = $user->character;
        if (! $character) {
            return response()->json(['message' => 'No tienes personaje.'], 404);
        }
        if (! $character->map_lugar_id) {
            return response()->json(['message' => 'Debes estar en una ubicación del mapa para usar este objeto.'], 422);
        }

        $owned = $character->rolObjetos()->where('rol_objetos.id', $data['rol_objeto_id'])->first();
        if (! $owned || (int) $owned->pivot->cantidad < 1) {
            return response()->json(['message' => 'No tienes ese objeto en tu inventario.'], 422);
        }
        if ($owned->tipo !== 'utilizable_mundo') {
            return response()->json(['message' => 'Este objeto no se puede usar de esta forma.'], 422);
        }

        if ((int) $owned->pivot->cantidad <= 1) {
            $character->rolObjetos()->detach($owned->id);
        } else {
            $character->rolObjetos()->updateExistingPivot($owned->id, ['cantidad' => $owned->pivot->cantidad - 1]);
        }

        $baliza = BalizaAyuda::create([
            'user_id' => $user->id,
            'character_id' => $character->id,
            'rol_objeto_id' => $owned->id,
            'nombre' => $owned->nombre,
            'map_sistema_id' => $character->map_sistema_id,
            'map_planeta_id' => $character->map_planeta_id,
            'map_zona_id' => $character->map_zona_id,
            'map_lugar_id' => $character->map_lugar_id,
            'expires_at' => now()->addHours(12),
        ]);

        $baliza->load(['user:id,name', 'character:id,handle,name', 'mapSistema:id,nombre', 'mapPlaneta:id,nombre', 'mapZona:id,nombre', 'mapLugar:id,nombre']);

        return response()->json(['baliza' => $baliza->toAlertArray($user->id)], 201);
    }

    /** DELETE /balizas/{baliza} — solo quien la creó puede eliminarla antes de que expire. */
    public function destroy(Request $request, BalizaAyuda $baliza): JsonResponse
    {
        if ($baliza->user_id !== $request->user()->id) {
            return response()->json(['message' => 'Solo quien creó la baliza puede eliminarla.'], 403);
        }

        $baliza->delete();

        return response()->json(['ok' => true]);
    }

    /** POST /balizas/{baliza}/viajar — viaja directamente a la ubicación de la baliza (cobra combustible/créditos como un salto normal). */
    public function viajar(Request $request, BalizaAyuda $baliza, MapTravelService $travelService): JsonResponse
    {
        $user = $request->user();
        $character = $user->character;
        if (! $character) {
            return response()->json(['ok' => false], 404);
        }

        if ($baliza->expires_at->isPast()) {
            return response()->json(['ok' => false, 'message' => 'Esta baliza ya expiró.'], 404);
        }

        $activeCombat = PvpCombat::where('status', 'active')
            ->where(fn ($q) => $q->where('attacker_id', $user->id)->orWhere('defender_id', $user->id))
            ->exists();

        if ($activeCombat) {
            return response()->json([
                'ok' => false,
                'blocked' => true,
                'message' => 'No puedes moverte mientras tienes un combate activo.',
            ], 422);
        }

        $forzarTransbordador = $request->boolean('forzar_transbordador');
        $error = $travelService->cobrarSalto($character, $baliza->map_sistema_id, $forzarTransbordador);
        if ($error) {
            return response()->json(['ok' => false, 'blocked' => true, 'message' => $error], 422);
        }

        $character->update([
            'map_sistema_id' => $baliza->map_sistema_id,
            'map_planeta_id' => $baliza->map_planeta_id,
            'map_zona_id' => $baliza->map_zona_id,
            'map_lugar_id' => $baliza->map_lugar_id,
        ]);

        return response()->json(['ok' => true, 'credits' => $character->fresh()->credits]);
    }
}
