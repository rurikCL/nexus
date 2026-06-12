<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Character;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class CombatantController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $characters = Character::with('user')
            ->orderByDesc('wins')
            ->get()
            ->map(fn($c) => $this->formatCombatant($c));

        return response()->json(['combatants' => $characters]);
    }

    public function show(Request $request, string $handle): JsonResponse
    {
        $character = Character::with('user')
            ->where('handle', $handle)
            ->firstOrFail();

        return response()->json(['combatant' => $this->formatCombatant($character)]);
    }

    private function formatCombatant(Character $character): array
    {
        return [
            'id'          => $character->user_id,
            'handle'      => $character->handle,
            'name'        => $character->name,
            'bio'         => $character->bio,
            'cls'         => $character->cls,
            'saber_color' => $character->saber_color,
            'sector'      => $character->sector,
            'sponsor'     => $character->sponsor,
            'joined_year' => $character->joined_year,
            'credits'     => $character->credits,
            'wins'        => $character->wins,
            'losses'      => $character->losses,
            'streak'      => $character->streak,
            'stats'       => $character->stats,
            'gold'        => $character->gold,
            'tier'        => $character->user->tier ?? 'iniciado',
            'winrate'     => $character->winrate,
        ];
    }
}
