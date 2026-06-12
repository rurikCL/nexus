<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Bet;
use App\Models\Combat;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class CombatController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $combats = Combat::with([
            'combatantA.character',
            'combatantB.character',
            'bets',
        ])->orderByDesc('created_at')->get();

        $formatted = $combats->map(fn($c) => $this->formatCombat($c));

        return response()->json(['combats' => $formatted]);
    }

    public function resolve(Request $request, Combat $combat): JsonResponse
    {
        $user = $request->user();

        // Only admin or tutor can resolve
        if (!$user->isTutor()) {
            return response()->json(['message' => 'No autorizado.'], 403);
        }

        if ($combat->resolved) {
            return response()->json(['message' => 'Este combate ya fue resuelto.'], 409);
        }

        $data = $request->validate([
            'winner' => 'required|in:a,b',
        ]);

        $winner = $data['winner'];
        $combat->update([
            'resolved' => true,
            'live'     => false,
            'winner'   => $winner,
        ]);

        // Update winner/loser stats
        $winnerUser = $winner === 'a' ? $combat->combatantA : $combat->combatantB;
        $loserUser  = $winner === 'a' ? $combat->combatantB : $combat->combatantA;

        $winnerChar = $winnerUser->character;
        $loserChar  = $loserUser->character;

        if ($winnerChar) {
            $winnerChar->increment('wins');
            $winnerChar->increment('streak');
        }

        if ($loserChar) {
            $loserChar->increment('losses');
            $loserChar->update(['streak' => 0]);
        }

        // Settle bets
        $bets = $combat->bets()->get();
        foreach ($bets as $bet) {
            if ($bet->pick === $winner) {
                // Won: payout = amount * odds (rounded)
                $payout = (int) round($bet->amount * $bet->odds);
                $bet->update(['status' => 'ganada']);
                $betUser = $bet->user()->with('character')->first();
                if ($betUser && $betUser->character) {
                    $betUser->character->increment('credits', $payout);
                }
            } else {
                $bet->update(['status' => 'perdida']);
            }
        }

        return response()->json([
            'message' => 'Combate resuelto.',
            'combat'  => $this->formatCombat($combat->fresh(['combatantA.character', 'combatantB.character', 'bets'])),
        ]);
    }

    private function formatCombat(Combat $combat): array
    {
        $charA = $combat->combatantA?->character;
        $charB = $combat->combatantB?->character;

        return [
            'id'           => $combat->id,
            'event_name'   => $combat->event_name,
            'round'        => $combat->round,
            'scheduled_at' => $combat->scheduled_at,
            'live'         => $combat->live,
            'resolved'     => $combat->resolved,
            'winner'       => $combat->winner,
            'odds_a'       => $combat->odds_a,
            'odds_b'       => $combat->odds_b,
            'combatant_a'  => $charA ? [
                'user_id' => $combat->combatant_a_id,
                'handle'  => $charA->handle,
                'name'    => $charA->name,
                'cls'     => $charA->cls,
                'tier'    => $charA->tier,
                'wins'    => $charA->wins,
                'losses'  => $charA->losses,
            ] : null,
            'combatant_b' => $charB ? [
                'user_id' => $combat->combatant_b_id,
                'handle'  => $charB->handle,
                'name'    => $charB->name,
                'cls'     => $charB->cls,
                'tier'    => $charB->tier,
                'wins'    => $charB->wins,
                'losses'  => $charB->losses,
            ] : null,
        ];
    }
}
