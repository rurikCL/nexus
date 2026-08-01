<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\JefeRanking;
use App\Models\MapNpc;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Storage;

/**
 * Ranking de jefes: lectura de las filas que RaidCombatController::grantVictoryRewards
 * registra al vencer a un jefe (una fila por jugador participante, por combate ganado).
 */
class JefeRankingController extends Controller
{
    /** GET /api/catalogo/jefes/{npc}/ranking — top jugadores contra ese jefe, ordenado por daño. */
    public function index(MapNpc $npc): JsonResponse
    {
        $ranking = JefeRanking::where('npc_id', $npc->id)
            ->with('user.character')
            ->orderByDesc('dano_total')
            ->limit(50)
            ->get()
            ->map(function ($r) {
                $ch = $r->user?->character;

                return [
                    'id' => $r->id,
                    'user_id' => $r->user_id,
                    'name' => $ch->name ?? $r->user?->name,
                    'handle' => $ch->handle ?? $r->user?->name,
                    'photo_url' => $ch?->photo ? Storage::disk('public')->url($ch->photo) : null,
                    'dano_total' => $r->dano_total,
                    'curacion_total' => $r->curacion_total,
                    'debuffs_aplicados' => $r->debuffs_aplicados,
                    'rondas' => $r->rondas,
                    'fecha' => $r->created_at?->format('Y-m-d H:i'),
                ];
            });

        return response()->json(['ranking' => $ranking]);
    }
}
