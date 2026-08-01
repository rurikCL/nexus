<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Event;
use App\Models\EventRegistration;
use App\Services\RecompensaGrantService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Arr;

class EventController extends Controller
{
    private const RECOMPENSAS_WITH = ['recompensas.habilidad', 'recompensas.objeto', 'recompensas.medalla'];

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name'         => 'required|string|max:255',
            'type'         => 'required|in:EXHIBICIÓN,CEREMONIA,DEMOSTRACIÓN,TALLER,GALA,CHARLA',
            'event_date'   => 'nullable|date',
            'location'     => 'nullable|string|max:255',
            'sede_id'      => 'nullable|integer|exists:sedes,id',
            'capacity'     => 'nullable|integer|min:1',
            'reward'       => 'nullable|integer|min:0',
            'reward_badge' => 'nullable|string|max:100',
            'description'  => 'nullable|string',
            'banner'       => 'nullable|string|max:50',
            'recompensas'                 => 'sometimes|array',
            'recompensas.*.nombre'        => 'required|string|max:255',
            'recompensas.*.descripcion'   => 'nullable|string',
            'recompensas.*.tipo'          => 'sometimes|in:habilidad,objeto,creditos,titulo,insignia,punto_habilidad',
            'recompensas.*.valor'         => 'sometimes|numeric',
            'recompensas.*.imagen'        => 'nullable|string|max:500',
            'recompensas.*.habilidad_id'  => 'nullable|integer|exists:rol_habilidades,id',
            'recompensas.*.objeto_id'     => 'nullable|integer|exists:rol_objetos,id',
            'recompensas.*.medalla_id'    => 'nullable|integer|exists:medallas,id',
        ]);

        $event = Event::create(array_merge(['status' => 'ABIERTO'], Arr::except($data, ['recompensas'])));

        foreach ($data['recompensas'] ?? [] as $rec) {
            $event->recompensas()->create(Arr::except($rec, ['id']));
        }

        $event->load(array_merge(['sede'], self::RECOMPENSAS_WITH));

        return response()->json(['event' => $this->formatEvent($event, false, false)], 201);
    }

    public function index(Request $request): JsonResponse
    {
        $user = $request->user();
        $events = Event::with(array_merge(['sede'], self::RECOMPENSAS_WITH))->orderBy('event_date')->get();

        $myEventIds = $user->events()->pluck('events.id')->toArray();
        $myRegistrations = EventRegistration::where('user_id', $user->id)
            ->pluck('claimed', 'event_id')
            ->toArray();

        $formatted = $events->map(fn (Event $event) => $this->formatEvent(
            $event,
            in_array($event->id, $myEventIds),
            $myRegistrations[$event->id] ?? false
        ));

        return response()->json(['events' => $formatted]);
    }

    private function formatEvent(Event $event, bool $mine, bool $claimed): array
    {
        return [
            'id'           => $event->id,
            'name'         => $event->name,
            'type'         => $event->type,
            'status'       => $event->status,
            'event_date'   => $event->event_date,
            'location'     => $event->location,
            'sede_id'      => $event->sede_id,
            'sede_nombre'  => $event->sede?->nombre,
            'reward'       => $event->reward,
            'reward_badge' => $event->reward_badge,
            'capacity'     => $event->capacity,
            'banner'       => $event->banner,
            'description'  => $event->description,
            'recompensas'  => $event->recompensas,
            'registered_count' => $event->registrations()->count(),
            'mine'         => $mine,
            'claimed'      => $claimed,
        ];
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

        // Créditos simples (legado, compatible con eventos ya existentes)
        $character = $user->character;
        if ($character && $event->reward > 0) {
            $character->increment('credits', $event->reward);
        }

        // Recompensas estructuradas (nuevas: habilidad/objeto/titulo/insignia/punto_habilidad/creditos)
        $otorgado = app(RecompensaGrantService::class)->otorgar(
            $event->recompensas()->get(),
            $user,
            ['event_id' => $event->id]
        );

        return response()->json(array_merge([
            'message'         => 'Recompensa reclamada correctamente.',
            'credits_awarded' => $event->reward,
        ], $otorgado));
    }
}
