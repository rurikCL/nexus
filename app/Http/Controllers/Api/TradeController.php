<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\RolObjeto;
use App\Models\TradeRequest;
use App\Models\User;
use App\Notifications\TradeNotification;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;

class TradeController extends Controller
{
    /** POST /trades/propose */
    public function propose(Request $request): JsonResponse
    {
        $data = $request->validate([
            'target_id'                  => 'required|integer|exists:users,id',
            'offer_credits'               => 'nullable|integer|min:0',
            'request_credits'             => 'nullable|integer|min:0',
            'items'                       => 'nullable|array',
            'items.*.rol_objeto_id'       => 'required_with:items|integer|exists:rol_objetos,id',
            'items.*.cantidad'            => 'required_with:items|integer|min:1',
        ]);

        $initiator = $request->user();
        $target    = User::with('character')->findOrFail($data['target_id']);

        if ($initiator->id === $target->id) {
            return response()->json(['error' => 'No puedes comerciar contigo mismo'], 422);
        }
        if (!$initiator->character || !$target->character) {
            return response()->json(['error' => 'Ambos jugadores necesitan un personaje'], 422);
        }

        $offerCredits   = $data['offer_credits'] ?? 0;
        $requestCredits = $data['request_credits'] ?? 0;
        $items          = $data['items'] ?? [];

        if ($offerCredits <= 0 && $requestCredits <= 0 && count($items) === 0) {
            return response()->json(['error' => 'La oferta está vacía'], 422);
        }

        $busy = TradeRequest::where('status', 'pending')
            ->where(fn($q) => $q->where('initiator_id', $initiator->id)->orWhere('target_id', $initiator->id))
            ->exists();
        if ($busy) {
            return response()->json(['error' => 'Ya tienes una propuesta de comercio pendiente. Resuélvela primero.'], 422);
        }

        $character = $initiator->character;
        if ($offerCredits > $character->credits) {
            return response()->json(['error' => 'No tienes créditos suficientes para ofrecer'], 422);
        }
        foreach ($items as $item) {
            $owned = $character->rolObjetos()->where('rol_objetos.id', $item['rol_objeto_id'])->first();
            if (!$owned || $owned->pivot->cantidad < $item['cantidad']) {
                return response()->json(['error' => 'No tienes suficientes unidades de uno de los objetos ofrecidos'], 422);
            }
        }

        $trade = TradeRequest::create([
            'initiator_id'    => $initiator->id,
            'target_id'       => $target->id,
            'status'          => 'pending',
            'offer_items'     => $items,
            'offer_credits'   => $offerCredits,
            'request_credits' => $requestCredits,
        ]);

        $target->notify(new TradeNotification(
            "Propuesta de comercio de {$initiator->character->name}",
            'Te han propuesto un intercambio — Revísalo en el mapa galáctico',
            $trade->id
        ));

        return response()->json(['trade' => $this->formatTrade($trade, $initiator->id)], 201);
    }

    /** GET /trades/active */
    public function active(Request $request): JsonResponse
    {
        $user = $request->user();

        $trade = TradeRequest::where('status', 'pending')
            ->where(fn($q) => $q->where('initiator_id', $user->id)->orWhere('target_id', $user->id))
            ->latest()
            ->first();

        return response()->json(['trade' => $trade ? $this->formatTrade($trade, $user->id) : null]);
    }

    /** GET /trades/{id} */
    public function show(Request $request, int $id): JsonResponse
    {
        $user  = $request->user();
        $trade = TradeRequest::findOrFail($id);

        if (!$trade->involvedUser($user->id)) {
            return response()->json(['error' => 'No autorizado'], 403);
        }

        return response()->json(['trade' => $this->formatTrade($trade, $user->id)]);
    }

    /** POST /trades/{id}/accept */
    public function accept(Request $request, int $id): JsonResponse
    {
        $user  = $request->user();
        $trade = TradeRequest::findOrFail($id);

        if ($trade->target_id !== $user->id) {
            return response()->json(['error' => 'Solo el destinatario puede aceptar'], 403);
        }
        if ($trade->status !== 'pending') {
            return response()->json(['error' => 'Esta propuesta ya no está pendiente'], 422);
        }

        $initiator = User::with('character')->findOrFail($trade->initiator_id);
        $target    = $user->loadMissing('character');
        $initiatorChar = $initiator->character;
        $targetChar    = $target->character;

        if (!$initiatorChar || !$targetChar) {
            return response()->json(['error' => 'Ambos jugadores necesitan un personaje'], 422);
        }

        $items = $trade->offer_items ?? [];

        if ($trade->offer_credits > $initiatorChar->credits) {
            return response()->json(['error' => 'El otro jugador ya no tiene los créditos ofrecidos'], 422);
        }
        if ($trade->request_credits > $targetChar->credits) {
            return response()->json(['error' => 'No tienes los créditos que se solicitan'], 422);
        }
        foreach ($items as $item) {
            $owned = $initiatorChar->rolObjetos()->where('rol_objetos.id', $item['rol_objeto_id'])->first();
            if (!$owned || $owned->pivot->cantidad < $item['cantidad']) {
                return response()->json(['error' => 'El otro jugador ya no tiene uno de los objetos ofrecidos'], 422);
            }
        }

        $espacioNecesario = array_sum(array_column($items, 'cantidad'));
        $espacioDisponible = $targetChar->capacidadCarga() - $targetChar->inventarioOcupado();
        if ($espacioNecesario > $espacioDisponible) {
            return response()->json(['error' => 'No tienes espacio suficiente en tu inventario para recibir la oferta'], 422);
        }

        DB::transaction(function () use ($trade, $initiatorChar, $targetChar, $items) {
            if ($trade->offer_credits > 0) {
                $initiatorChar->decrement('credits', $trade->offer_credits);
                $targetChar->increment('credits', $trade->offer_credits);
            }
            if ($trade->request_credits > 0) {
                $targetChar->decrement('credits', $trade->request_credits);
                $initiatorChar->increment('credits', $trade->request_credits);
            }

            foreach ($items as $item) {
                $objetoId = $item['rol_objeto_id'];
                $cantidad = $item['cantidad'];

                $ownedByInitiator = $initiatorChar->rolObjetos()->where('rol_objetos.id', $objetoId)->first();
                $restante = $ownedByInitiator->pivot->cantidad - $cantidad;
                if ($restante > 0) {
                    $initiatorChar->rolObjetos()->updateExistingPivot($objetoId, ['cantidad' => $restante]);
                } else {
                    $initiatorChar->rolObjetos()->detach($objetoId);
                }

                $ownedByTarget = $targetChar->rolObjetos()->where('rol_objetos.id', $objetoId)->first();
                if ($ownedByTarget) {
                    $targetChar->rolObjetos()->updateExistingPivot($objetoId, [
                        'cantidad' => $ownedByTarget->pivot->cantidad + $cantidad,
                    ]);
                } else {
                    $targetChar->rolObjetos()->attach($objetoId, ['cantidad' => $cantidad]);
                }
            }

            $trade->status = 'completed';
            $trade->save();
        });

        $initiator->notify(new TradeNotification(
            '¡Comercio completado!',
            "{$targetChar->name} aceptó tu propuesta de intercambio",
            $trade->id
        ));

        return response()->json([
            'trade'      => $this->formatTrade($trade->fresh(), $user->id),
            'my_credits' => $targetChar->fresh()->credits,
        ]);
    }

    /** POST /trades/{id}/decline */
    public function decline(Request $request, int $id): JsonResponse
    {
        $user  = $request->user();
        $trade = TradeRequest::findOrFail($id);

        if ($trade->target_id !== $user->id) {
            return response()->json(['error' => 'Solo el destinatario puede rechazar'], 403);
        }
        if ($trade->status !== 'pending') {
            return response()->json(['error' => 'Esta propuesta ya no está pendiente'], 422);
        }

        $trade->status = 'declined';
        $trade->save();

        User::find($trade->initiator_id)?->notify(new TradeNotification(
            'Propuesta de comercio rechazada',
            "{$user->character->name} rechazó tu propuesta de intercambio",
            $trade->id
        ));

        return response()->json(['ok' => true]);
    }

    /** POST /trades/{id}/cancel */
    public function cancel(Request $request, int $id): JsonResponse
    {
        $user  = $request->user();
        $trade = TradeRequest::findOrFail($id);

        if ($trade->initiator_id !== $user->id) {
            return response()->json(['error' => 'Solo quien propuso el comercio puede cancelarlo'], 403);
        }
        if ($trade->status !== 'pending') {
            return response()->json(['error' => 'Esta propuesta ya no está pendiente'], 422);
        }

        $trade->status = 'cancelled';
        $trade->save();

        return response()->json(['ok' => true]);
    }

    // ─────────────────────────── helpers ──────────────────────────────────────

    private function formatTrade(TradeRequest $trade, int $myId): array
    {
        $initiator = User::with('character')->find($trade->initiator_id);
        $target    = User::with('character')->find($trade->target_id);

        $objetoIds = array_column($trade->offer_items ?? [], 'rol_objeto_id');
        $objetos   = $objetoIds ? RolObjeto::whereIn('id', $objetoIds)->get()->keyBy('id') : collect();

        $items = collect($trade->offer_items ?? [])->map(function ($item) use ($objetos) {
            $objeto = $objetos->get($item['rol_objeto_id']);
            return [
                'rol_objeto_id' => $item['rol_objeto_id'],
                'cantidad'      => $item['cantidad'],
                'nombre'        => $objeto?->nombre ?? '???',
                'imagen'        => $objeto?->imagen ? Storage::disk('public')->url($objeto->imagen) : null,
                'rareza'        => $objeto?->rareza,
            ];
        })->values();

        return [
            'id'              => $trade->id,
            'status'          => $trade->status,
            'i_am_initiator'  => $trade->initiator_id === $myId,
            'offer_items'     => $items,
            'offer_credits'   => $trade->offer_credits,
            'request_credits' => $trade->request_credits,
            'initiator'       => [
                'id'     => $initiator?->id,
                'name'   => $initiator?->character?->name,
                'handle' => $initiator?->character?->handle,
                'photo_url' => $initiator?->character?->photo ? Storage::disk('public')->url($initiator->character->photo) : null,
                'saber_color' => $initiator?->character?->saber_color,
            ],
            'target' => [
                'id'     => $target?->id,
                'name'   => $target?->character?->name,
                'handle' => $target?->character?->handle,
                'photo_url' => $target?->character?->photo ? Storage::disk('public')->url($target->character->photo) : null,
                'saber_color' => $target?->character?->saber_color,
            ],
        ];
    }
}
