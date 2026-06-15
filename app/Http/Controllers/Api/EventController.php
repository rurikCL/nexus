<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Event;
use App\Models\EventRegistration;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class EventController extends Controller
{
    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name'         => 'required|string|max:255',
            'type'         => 'required|in:EXHIBICIÓN,CEREMONIA,DEMOSTRACIÓN,TALLER,GALA,CHARLA',
            'event_date'   => 'nullable|date',
            'location'     => 'nullable|string|max:255',
            'capacity'     => 'nullable|integer|min:1',
            'reward'       => 'nullable|integer|min:0',
            'reward_badge' => 'nullable|string|max:100',
            'description'  => 'nullable|string',
            'banner'       => 'nullable|string|max:50',
        ]);

        $event = Event::create(array_merge(['status' => 'ABIERTO'], $data));

        return response()->json(['event' => $event], 201);
    }

    public function index(Request $request): JsonResponse
    {
        $user = $request->user();
        $events = Event::orderBy('event_date')->get();

        $myEventIds = $user->events()->pluck('events.id')->toArray();
        $myRegistrations = EventRegistration::where('user_id', $user->id)
            ->pluck('claimed', 'event_id')
            ->toArray();

        $formatted = $events->map(function (Event $event) use ($myEventIds, $myRegistrations) {
            return [
                'id'           => $event->id,
                'name'         => $event->name,
                'type'         => $event->type,
                'status'       => $event->status,
                'event_date'   => $event->event_date,
                'location'     => $event->location,
                'reward'       => $event->reward,
                'reward_badge' => $event->reward_badge,
                'capacity'     => $event->capacity,
                'banner'       => $event->banner,
                'description'  => $event->description,
                'registered_count' => $event->registrations()->count(),
                'mine'         => in_array($event->id, $myEventIds),
                'claimed'      => $myRegistrations[$event->id] ?? false,
            ];
        });

        return response()->json(['events' => $formatted]);
    }

    public function register(Request $request, Event $event): JsonResponse
    {
        $user = $request->user();

        $already = $user->events()->where('events.id', $event->id)->exists();
        if ($already) {
            return response()->json(['message' => 'Ya estás registrado en este evento.'], 409);
        }

        if ($event->capacity !== null) {
            $count = $event->registrations()->count();
            if ($count >= $event->capacity) {
                return response()->json(['message' => 'El evento está lleno.'], 409);
            }
        }

        $user->events()->attach($event->id, ['claimed' => false]);

        return response()->json(['message' => 'Registrado correctamente.'], 201);
    }

    public function unregister(Request $request, Event $event): JsonResponse
    {
        $user = $request->user();

        $registration = EventRegistration::where('event_id', $event->id)
            ->where('user_id', $user->id)
            ->first();

        if (!$registration) {
            return response()->json(['message' => 'No estás registrado en este evento.'], 404);
        }

        $user->events()->detach($event->id);

        return response()->json(['message' => 'Registro cancelado.']);
    }

    public function claim(Request $request, Event $event): JsonResponse
    {
        $user = $request->user();

        $registration = EventRegistration::where('event_id', $event->id)
            ->where('user_id', $user->id)
            ->first();

        if (!$registration) {
            return response()->json(['message' => 'No estás registrado en este evento.'], 403);
        }

        if ($registration->claimed) {
            return response()->json(['message' => 'Ya reclamaste la recompensa.'], 409);
        }

        if ($event->status !== 'REALIZADO') {
            return response()->json(['message' => 'El evento aún no ha sido realizado.'], 403);
        }

        $registration->update(['claimed' => true]);

        // Award reward credits
        $character = $user->character;
        if ($character && $event->reward > 0) {
            $character->increment('credits', $event->reward);
        }

        return response()->json([
            'message'         => 'Recompensa reclamada correctamente.',
            'credits_awarded' => $event->reward,
        ]);
    }
}
