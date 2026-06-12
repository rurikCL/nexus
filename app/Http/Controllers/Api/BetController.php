<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Bet;
use App\Models\Combat;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class BetController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $bets = $request->user()->bets()
            ->with(['combat.combatantA.character', 'combat.combatantB.character'])
            ->orderByDesc('created_at')
            ->get();

        return response()->json(['bets' => $bets]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'combat_id' => 'required|integer|exists:combats,id',
            'pick'      => 'required|in:a,b',
            'amount'    => 'required|integer|min:1',
        ]);

        $user = $request->user();
        $character = $user->character;

        if (!$character) {
            return response()->json(['message' => 'Necesitas un perfil de combatiente para apostar.'], 403);
        }

        $combat = Combat::findOrFail($data['combat_id']);

        if ($combat->resolved) {
            return response()->json(['message' => 'Este combate ya fue resuelto.'], 409);
        }

        if ($character->credits < $data['amount']) {
            return response()->json(['message' => 'No tienes suficientes créditos.'], 422);
        }

        // Deduct credits
        $character->decrement('credits', $data['amount']);

        $odds = $data['pick'] === 'a' ? $combat->odds_a : $combat->odds_b;

        $bet = Bet::create([
            'user_id'   => $user->id,
            'combat_id' => $data['combat_id'],
            'pick'      => $data['pick'],
            'amount'    => $data['amount'],
            'odds'      => $odds,
            'status'    => 'abierta',
        ]);

        return response()->json([
            'bet'              => $bet->load(['combat']),
            'credits_remaining'=> $character->fresh()->credits,
        ], 201);
    }
}
