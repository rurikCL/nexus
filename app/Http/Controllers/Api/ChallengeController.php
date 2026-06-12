<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Challenge;
use App\Models\Combat;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ChallengeController extends Controller
{
    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'target_id' => 'required|integer|exists:users,id|different:' . $request->user()->id,
            'stake'     => 'nullable|integer|min:0',
        ]);

        $user = $request->user();

        $challenge = Challenge::create([
            'challenger_id' => $user->id,
            'target_id'     => $data['target_id'],
            'stake'         => $data['stake'] ?? 0,
            'status'        => 'pendiente',
        ]);

        // Create associated combat
        $combat = Combat::create([
            'combatant_a_id' => $user->id,
            'combatant_b_id' => $data['target_id'],
            'odds_a'         => 1.90,
            'odds_b'         => 1.90,
            'scheduled_at'   => null,
            'event_name'     => 'Duelo Oficial',
            'live'           => false,
            'resolved'       => false,
        ]);

        return response()->json([
            'challenge' => $challenge->load(['challenger.character', 'target.character']),
            'combat'    => $combat->load(['combatantA.character', 'combatantB.character']),
        ], 201);
    }
}
