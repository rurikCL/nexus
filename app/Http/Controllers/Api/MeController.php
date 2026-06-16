<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\StatsTemporada;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

class MeController extends Controller
{
    public function show(Request $request): JsonResponse
    {
        $user = $request->user()->load('character');
        $character = $user->character;

        if ($character) {
            $character->load(['mapLugar', 'mapZona', 'mapPlaneta', 'mapSistema']);
        }

        $stats = $character ? StatsTemporada::totalsForUser($user->id) : [];

        return response()->json([
            'id'        => $user->id,
            'name'      => $user->name,
            'email'     => $user->email,
            'tier'      => $user->tier,
            'is_tutor'  => $user->isTutor(),
            'character' => $character ? [
                'id'          => $character->id,
                'handle'      => $character->handle,
                'name'        => $character->name,
                'bio'         => $character->bio,
                'lore'        => $character->lore,
                'cls'         => $character->cls,
                'saber_color' => $character->saber_color,
                'side'        => $character->side,
                'sector'      => $character->sector,
                'sponsor'     => $character->sponsor,
                'joined_year' => $character->joined_year,
                'credits'     => $character->credits,
                'wins'        => $stats['wins'],
                'losses'      => $stats['losses'],
                'streak'      => $stats['streak'],
                'winrate'     => $stats['winrate'],
                'stats'       => $character->stats,
                'gold'        => $character->gold,
                'photo_url'    => $character->photo
                    ? Storage::disk('public')->url($character->photo) . '?v=' . $character->updated_at->timestamp
                    : null,
                'map_location' => [
                    'sistema_id' => $character->map_sistema_id,
                    'planeta_id' => $character->map_planeta_id,
                    'zona_id'    => $character->map_zona_id,
                    'lugar_id'   => $character->map_lugar_id,
                    'nombre'     => $character->mapLugar?->nombre
                                 ?? $character->mapZona?->nombre
                                 ?? $character->mapPlaneta?->nombre
                                 ?? $character->mapSistema?->nombre,
                    'nivel'      => $character->map_lugar_id  ? 'lugar'
                                  : ($character->map_zona_id  ? 'zona'
                                  : ($character->map_planeta_id ? 'planeta'
                                  : ($character->map_sistema_id ? 'sistema' : null))),
                ],
            ] : null,
        ]);
    }
}
