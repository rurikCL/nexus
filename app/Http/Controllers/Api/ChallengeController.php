<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Challenge;
use App\Models\Combat;
use App\Models\User;
use App\Notifications\DesafioRecibido;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ChallengeController extends Controller
{
    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'target_id'     => 'required|integer|exists:users,id|different:' . $request->user()->id,
            'stake'         => 'nullable|integer|min:0',
            'fecha_desafio' => 'nullable|date',
        ]);

        $user = $request->user();
        $target = User::findOrFail($data['target_id']);

        /* Las sedes clasifican a los miembros por ubicación física real — no se puede
         * desafiar a alguien de otra sede. Si alguno de los dos aún no tiene sede
         * asignada (cuentas previas a esta funcionalidad), no se bloquea el desafío. */
        if ($user->sede_id && $target->sede_id && $user->sede_id !== $target->sede_id) {
            return response()->json(['message' => 'No puedes desafiar a alguien de otra sede — no están físicamente en el mismo lugar.'], 422);
        }

        $challenge = Challenge::create([
            'challenger_id' => $user->id,
            'target_id'     => $data['target_id'],
            'stake'         => $data['stake'] ?? 0,
            'fecha_desafio' => $data['fecha_desafio'] ?? null,
            'status'        => 'pendiente',
        ]);

        $target->notify(new DesafioRecibido($user, $data['stake'] ?? 0));

        return response()->json([
            'challenge' => $challenge->load(['challenger.character', 'target.character']),
        ], 201);
    }

    public function accept(Request $request, Challenge $challenge): JsonResponse
    {
        if ($challenge->target_id !== $request->user()->id) {
            return response()->json(['message' => 'No autorizado.'], 403);
        }
        if ($challenge->status !== 'pendiente') {
            return response()->json(['message' => 'El desafío ya fue procesado.'], 422);
        }

        $data = $request->validate([
            'fecha_desafio' => 'nullable|date',
        ]);

        $fecha = $data['fecha_desafio'] ?? $challenge->fecha_desafio;

        $challenge->update([
            'status'        => 'aceptado',
            'fecha_desafio' => $fecha,
        ]);

        $combat = Combat::create([
            'combatant_a_id' => $challenge->challenger_id,
            'combatant_b_id' => $challenge->target_id,
            'odds_a'         => 1.90,
            'odds_b'         => 1.90,
            'fecha_desafio'  => $fecha,
            'event_name'     => 'Duelo Oficial',
            'live'           => false,
            'resolved'       => false,
        ]);

        return response()->json([
            'challenge' => $challenge->load(['challenger.character', 'target.character']),
            'combat'    => $combat->load(['combatantA.character', 'combatantB.character']),
        ]);
    }

    public function reject(Request $request, Challenge $challenge): JsonResponse
    {
        if ($challenge->target_id !== $request->user()->id) {
            return response()->json(['message' => 'No autorizado.'], 403);
        }
        if ($challenge->status !== 'pendiente') {
            return response()->json(['message' => 'El desafío ya fue procesado.'], 422);
        }

        $challenge->update(['status' => 'rechazado']);

        return response()->json(['challenge' => $challenge]);
    }

    public function index(Request $request): JsonResponse
    {
        $user = $request->user();

        $challenges = Challenge::with(['challenger.character', 'target.character'])
            ->where(function ($q) use ($user) {
                $q->where('challenger_id', $user->id)
                  ->orWhere('target_id', $user->id);
            })
            ->where('status', 'pendiente')
            ->latest()
            ->get();

        return response()->json(['challenges' => $challenges]);
    }
}
