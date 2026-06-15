<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Bet;
use App\Models\Combat;
use App\Models\StatsTemporada;
use App\Notifications\CombateResuelto;
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

        if (!$user->isTutor()) {
            return response()->json(['message' => 'No autorizado.'], 403);
        }

        if ($combat->resolved) {
            return response()->json(['message' => 'Este combate ya fue resuelto.'], 409);
        }

        $data = $request->validate([
            'winner'     => 'required|in:a,b',
            'score_data' => 'nullable|array',
        ]);

        $winner = $data['winner'];
        $combat->update([
            'resolved'   => true,
            'live'       => false,
            'winner'     => $winner,
            'score_data' => $data['score_data'] ?? null,
        ]);

        $winnerUser = $winner === 'a' ? $combat->combatantA : $combat->combatantB;
        $loserUser  = $winner === 'a' ? $combat->combatantB : $combat->combatantA;

        $temporadaId = $combat->temporada_id;
        if ($winnerUser) StatsTemporada::recordResult($winnerUser->id, true,  $temporadaId);
        if ($loserUser)  StatsTemporada::recordResult($loserUser->id,  false, $temporadaId);

        // Settle bets
        $bets = $combat->bets()->get();
        foreach ($bets as $bet) {
            if ($bet->pick === $winner) {
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

        if ($winnerUser) $winnerUser->notify(new CombateResuelto($combat, true));
        if ($loserUser)  $loserUser->notify(new CombateResuelto($combat, false));

        return response()->json([
            'message' => 'Combate resuelto.',
            'combat'  => $this->formatCombat($combat->fresh(['combatantA.character', 'combatantB.character', 'bets'])),
        ]);
    }

    private function formatCombat(Combat $combat): array
    {
        $charA = $combat->combatantA?->character;
        $charB = $combat->combatantB?->character;

        $fmtChar = function ($userId, $char) {
            if (!$char) return null;
            $stats = StatsTemporada::totalsForUser($userId);
            return [
                'user_id'     => $userId,
                'handle'      => $char->handle,
                'name'        => $char->name,
                'cls'         => $char->cls,
                'side'        => $char->side,
                'saber_color' => $char->saber_color ?? 'azul',
                'tier'        => $char->tier,
                'wins'        => $stats['wins'],
                'losses'      => $stats['losses'],
                'winrate'     => $stats['winrate'],
                'streak'      => $stats['streak'],
                'credits'     => $char->credits,
            ];
        };

        return [
            'id'           => $combat->id,
            'temporada_id' => $combat->temporada_id,
            'event_name'   => $combat->event_name,
            'round'        => $combat->round,
            'scheduled_at' => $combat->fecha_desafio?->toIso8601String(),
            'live'         => $combat->live,
            'resolved'     => $combat->resolved,
            'winner'       => $combat->winner,
            'odds_a'       => (float) $combat->odds_a,
            'odds_b'       => (float) $combat->odds_b,
            'score_data'   => $combat->score_data,
            'combatant_a'  => $fmtChar($combat->combatant_a_id, $charA),
            'combatant_b'  => $fmtChar($combat->combatant_b_id, $charB),
        ];
    }
}
