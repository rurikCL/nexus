<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Character;
use App\Models\CharacterSable;
use App\Models\RolHabilidad;
use App\Models\StatsTemporada;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

class MeController extends Controller
{
    private function habilidadResource(?RolHabilidad $h): ?array
    {
        if (! $h) {
            return null;
        }

        return array_merge($h->toArray(), [
            'icono_url' => $h->icono ? Storage::disk('public')->url($h->icono) : null,
        ]);
    }

    public function tutors(): JsonResponse
    {
        $tutors = User::whereIn('tier', ['caballero', 'maestro', 'granmaestro'])
            ->with('character')
            ->get()
            ->filter(fn ($u) => $u->character !== null)
            ->map(fn ($u) => [
                'id' => $u->id,
                'name' => $u->name,
                'handle' => $u->character->handle,
                'tier' => $u->tier,
            ])
            ->values();

        return response()->json(['tutors' => $tutors]);
    }

    private function resolveAllHabilidades(?Character $character): array
    {
        if (! $character) {
            return [];
        }
        $porForma = is_array($character->habilidades_por_forma) ? $character->habilidades_por_forma : [];
        $allIds = collect($porForma)->flatten()->filter()->unique()->values()->toArray();
        if (empty($allIds)) {
            return [];
        }

        return RolHabilidad::whereIn('id', $allIds)->get()
            ->mapWithKeys(fn ($h) => [(string) $h->id => array_merge($h->toArray(), [
                'icono_url' => $h->icono ? Storage::disk('public')->url($h->icono) : null,
            ])])
            ->toArray();
    }

    public function show(Request $request): JsonResponse
    {
        $user = $request->user()->load('character', 'roles', 'sede');
        $character = $user->character;

        if ($character) {
            $character->load([
                'mapLugar', 'mapZona', 'mapPlaneta', 'mapSistema', 'rolObjetos', 'armaEquipada',
                'sableActivo' => fn ($q) => $q->with(array_keys(CharacterSable::SLOTS)),
                'titulos', 'tituloActivo',
                'hitos' => fn ($q) => $q->latest(),
            ]);
        }

        $stats = $character ? StatsTemporada::totalsForUser($user->id) : [];

        return response()->json([
            'id' => $user->id,
            'name' => $user->name,
            'email' => $user->email,
            'tier' => $user->tier,
            'grado' => $user->grado,
            'clase' => $user->clase,
            'is_tutor' => $user->isTutor(),
            'roles' => $user->roles->pluck('name'),
            'sede' => $user->sede ? [
                'id' => $user->sede->id,
                'nombre' => $user->sede->nombre,
                'ubicacion' => $user->sede->ubicacion,
                'pais' => $user->sede->pais,
                'region' => $user->sede->region,
                'imagen_url' => $user->sede->imagen ? Storage::disk('public')->url($user->sede->imagen) : null,
            ] : null,
            'character' => $character ? [
                'id' => $character->id,
                'handle' => $character->handle,
                'name' => $character->name,
                'bio' => $character->bio,
                'lore' => $character->lore,
                'cls' => $character->cls,
                'saber_color' => $character->saber_color,
                'side' => $character->side,
                'sector' => $character->sector,
                'sponsor' => $character->sponsor,
                'joined_year' => $character->joined_year,
                'credits' => $character->credits,
                'reputation' => $character->reputation ?? 0,
                'wins' => $stats['wins'],
                'losses' => $stats['losses'],
                'streak' => $stats['streak'],
                'winrate' => $stats['winrate'],
                'stats' => $character->stats,
                'vida' => $character->vida,
                'escudo' => $character->escudo,
                'defensa' => $character->defensa,
                'ataque' => $character->ataque,
                'movimiento' => $character->movimiento,
                'iniciativa' => $character->iniciativa,
                'punteria' => $character->punteria,
                'sable_bonos' => $character->sableBonos(),
                'puntos_libres' => $character->puntos_libres ?? 5,
                'habilidades_por_forma' => $character->habilidades_por_forma ?? (object) [],
                'current_forma' => $character->current_forma ?? 1,
                'all_habilidades_data' => $this->resolveAllHabilidades($character),
                'rol_objetos' => $character->rolObjetos->values(),
                'arma_equipada' => $character->armaEquipada,
                'sable_activo' => $character->sableActivo,
                'arma_efectiva' => $character->armaEfectiva(),
                'titulos' => $character->titulos,
                'titulo_activo' => $character->tituloActivo,
                'hitos' => $character->hitos,
                'gold' => $character->gold,
                'photo_url' => $character->photo
                    ? Storage::disk('public')->url($character->photo).'?v='.$character->updated_at->timestamp
                    : null,
                'map_location' => [
                    'sistema_id' => $character->map_sistema_id,
                    'sistema_nombre' => $character->mapSistema?->nombre,
                    'planeta_id' => $character->map_planeta_id,
                    'planeta_nombre' => $character->mapPlaneta?->nombre,
                    'zona_id' => $character->map_zona_id,
                    'zona_nombre' => $character->mapZona?->nombre,
                    'lugar_id' => $character->map_lugar_id,
                    'lugar_nombre' => $character->mapLugar?->nombre,
                    'nombre' => $character->mapLugar?->nombre
                                     ?? $character->mapZona?->nombre
                                     ?? $character->mapPlaneta?->nombre
                                     ?? $character->mapSistema?->nombre,
                    'nivel' => $character->map_lugar_id ? 'lugar'
                                      : ($character->map_zona_id ? 'zona'
                                      : ($character->map_planeta_id ? 'planeta'
                                      : ($character->map_sistema_id ? 'sistema' : null))),
                ],
            ] : null,
        ]);
    }
}
