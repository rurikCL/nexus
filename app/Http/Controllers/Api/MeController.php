<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\StatsTemporada;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

class MeController extends Controller
{
    private function habilidadResource(?\App\Models\RolHabilidad $h): ?array
    {
        if (!$h) return null;
        return array_merge($h->toArray(), [
            'icono_url' => $h->icono ? Storage::disk('public')->url($h->icono) : null,
        ]);
    }

    public function tutors(): JsonResponse
    {
        $tutors = User::whereIn('tier', ['caballero', 'maestro', 'granmaestro'])
            ->with('character')
            ->get()
            ->filter(fn($u) => $u->character !== null)
            ->map(fn($u) => [
                'id'     => $u->id,
                'name'   => $u->name,
                'handle' => $u->character->handle,
                'tier'   => $u->tier,
            ])
            ->values();

        return response()->json(['tutors' => $tutors]);
    }

    public function show(Request $request): JsonResponse
    {
        $user = $request->user()->load('character', 'roles');
        $character = $user->character;

        if ($character) {
            $character->load(['mapLugar', 'mapZona', 'mapPlaneta', 'mapSistema', 'habilidad1', 'habilidad2', 'habilidad3', 'habilidad4']);
        }

        $stats = $character ? StatsTemporada::totalsForUser($user->id) : [];

        return response()->json([
            'id'        => $user->id,
            'name'      => $user->name,
            'email'     => $user->email,
            'tier'      => $user->tier,
            'grado'     => $user->grado,
            'clase'     => $user->clase,
            'is_tutor'  => $user->isTutor(),
            'roles'     => $user->roles->pluck('name'),
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
                'reputation'  => $character->reputation ?? 0,
                'wins'        => $stats['wins'],
                'losses'      => $stats['losses'],
                'streak'      => $stats['streak'],
                'winrate'     => $stats['winrate'],
                'stats'       => $character->stats,
                'vida'        => $character->vida,
                'escudo'      => $character->escudo,
                'defensa'     => $character->defensa,
                'ataque'      => $character->ataque,
                'movimiento'  => $character->movimiento,
                'iniciativa'  => $character->iniciativa,
                'punteria'      => $character->punteria,
                'puntos_libres' => $character->puntos_libres ?? 5,
                'habilidad_1'   => $character->habilidad_1,
                'habilidad_2'   => $character->habilidad_2,
                'habilidad_3'   => $character->habilidad_3,
                'habilidad_4'   => $character->habilidad_4,
                'habilidad_1_data' => $this->habilidadResource($character->habilidad1),
                'habilidad_2_data' => $this->habilidadResource($character->habilidad2),
                'habilidad_3_data' => $this->habilidadResource($character->habilidad3),
                'habilidad_4_data' => $this->habilidadResource($character->habilidad4),
                'gold'          => $character->gold,
                'photo_url'    => $character->photo
                    ? Storage::disk('public')->url($character->photo) . '?v=' . $character->updated_at->timestamp
                    : null,
                'map_location' => [
                    'sistema_id'     => $character->map_sistema_id,
                    'sistema_nombre' => $character->mapSistema?->nombre,
                    'planeta_id'     => $character->map_planeta_id,
                    'planeta_nombre' => $character->mapPlaneta?->nombre,
                    'zona_id'        => $character->map_zona_id,
                    'zona_nombre'    => $character->mapZona?->nombre,
                    'lugar_id'       => $character->map_lugar_id,
                    'lugar_nombre'   => $character->mapLugar?->nombre,
                    'nombre'         => $character->mapLugar?->nombre
                                     ?? $character->mapZona?->nombre
                                     ?? $character->mapPlaneta?->nombre
                                     ?? $character->mapSistema?->nombre,
                    'nivel'          => $character->map_lugar_id  ? 'lugar'
                                      : ($character->map_zona_id  ? 'zona'
                                      : ($character->map_planeta_id ? 'planeta'
                                      : ($character->map_sistema_id ? 'sistema' : null))),
                ],
            ] : null,
        ]);
    }
}
