<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Character;
use App\Models\StatsTemporada;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

class CombatantController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $characters = Character::with('user.tutor.character', 'user.sede', 'tituloActivo')
            ->get()
            ->map(fn ($c) => $this->formatCombatant($c))
            ->sortByDesc('wins')
            ->values();

        return response()->json(['combatants' => $characters]);
    }

    public function show(Request $request, string $handle): JsonResponse
    {
        $character = Character::with('user.tutor.character', 'user.sede', 'tituloActivo')
            ->where('handle', $handle)
            ->firstOrFail();

        return response()->json(['combatant' => $this->formatCombatant($character)]);
    }

    public function showPublic(Request $request, string $handle): JsonResponse
    {
        $character = Character::with('user.tutor.character', 'user.sede', 'tituloActivo')
            ->where('handle', $handle)
            ->firstOrFail();

        $combatant = $this->formatCombatant($character);
        unset($combatant['credits']);

        return response()->json(['combatant' => $combatant]);
    }

    private function formatCombatant(Character $character): array
    {
        $stats = StatsTemporada::totalsForUser($character->user_id);

        return [
            'id' => $character->user_id,
            'handle' => $character->handle,
            'name' => $character->name,
            'bio' => $character->bio,
            'cls' => $character->cls,
            'saber_color' => $character->saber_color,
            'sector' => $character->sector,
            'sponsor' => $character->sponsor,
            'joined_year' => $character->joined_year,
            'credits' => $character->credits,
            'wins' => $stats['wins'],
            'losses' => $stats['losses'],
            'streak' => $stats['streak'],
            'winrate' => $stats['winrate'],
            'stats' => $character->stats,
            'combat_stats' => [
                'vida' => (int) ($character->vida ?? 0),
                'escudo' => (int) ($character->escudo ?? 0),
                'defensa' => (int) ($character->defensa ?? 0),
                'ataque' => (int) ($character->ataque ?? 0),
                'movimiento' => (int) ($character->movimiento ?? 0),
                'iniciativa' => (int) ($character->iniciativa ?? 0),
                'punteria' => (int) ($character->punteria ?? 0),
            ],
            'gold' => $character->gold,
            'side' => $character->side ?? 'luminoso',
            'tier' => $character->user->tier ?? 'iniciado',
            'sede_id' => $character->user->sede_id,
            'sede_nombre' => $character->user->sede?->nombre,
            'titulo_activo' => $character->tituloActivo?->only(['id', 'nombre', 'tipo']),
            'photo_url' => $character->photo
                ? Storage::disk('public')->url($character->photo).'?v='.$character->updated_at->timestamp
                : null,
            'tutor' => $character->user->tutor
                ? [
                    'id' => $character->user->tutor->id,
                    'name' => $character->user->tutor->character?->name ?? $character->user->tutor->name,
                    'handle' => $character->user->tutor->character?->handle,
                    'tier' => $character->user->tutor->tier,
                ]
                : null,
        ];
    }
}
