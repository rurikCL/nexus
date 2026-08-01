<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Event;
use App\Models\EventRegistration;
use App\Models\User;
use App\Services\RecompensaGrantService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Arr;

class EventController extends Controller
{
    private const RECOMPENSAS_WITH = ['recompensas.habilidad', 'recompensas.objeto', 'recompensas.medalla'];
    private const MANAGE_TIERS = ['maestro', 'granmaestro'];

    private function puedeGestionar(?User $user): bool
    {
        return $user && in_array($user->tier, self::MANAGE_TIERS, true);
    }

    private function recompensasRules(): array
    {
        return [
            'recompensas'                 => 'sometimes|array',
            'recompensas.*.id'            => 'sometimes|integer',
            'recompensas.*.nombre'        => 'required|string|max:255',
            'recompensas.*.descripcion'   => 'nullable|string',
            'recompensas.*.tipo'          => 'sometimes|in:habilidad,objeto,creditos,titulo,insignia,punto_habilidad',
            'recompensas.*.valor'         => 'sometimes|numeric',
            'recompensas.*.imagen'        => 'nullable|string|max:500',
            'recompensas.*.habilidad_id'  => 'nullable|integer|exists:rol_habilidades,id',
            'recompensas.*.objeto_id'     => 'nullable|integer|exists:rol_objetos,id',
            'recompensas.*.medalla_id'    => 'nullable|integer|exists:medallas,id',
        ];
    }

    private function syncRecompensas(Event $event, array $recompensas): void
    {
        $incomingIds = collect($recompensas)->pluck('id')->filter()->all();
        $event->recompensas()->whereNotIn('id', $incomingIds)->delete();

        foreach ($recompensas as $rec) {
            if (!empty($rec['id'])) {
                $event->recompensas()->where('id', $rec['id'])->update(Arr::except($rec, ['id']));
            } else {
                $event->recompensas()->create(Arr::except($rec, ['id']));
            }
        }
    }

    public function store(Request $request): JsonResponse
    {
        if (!$this->puedeGestionar($request->user())) {
            return response()->json(['message' => 'No tienes permiso para crear eventos.'], 403);
        }

        $data = $request->validate(array_merge([
            'name'         => 'required|string|max:255',
            'type'         => 'required|in:EXHIBICIÓN,CEREMONIA,DEMOSTRACIÓN,TALLER,GALA,CHARLA',
            'event_date'   => 'nullable|date',
            'location'     => 'nullable|string|max:255',
            'sede_id'      => 'nullable|integer|exists:sedes,id',
            'capacity'     => 'nullable|integer|min:1',
            'description'  => 'nullable|string',
            'banner'       => 'nullable|string|max:50',
        ], $this->recompensasRules()));

        $event = Event::create(array_merge(['status' => 'ABIERTO'], Arr::except($data, ['recompensas'])));

        foreach ($data['recompensas'] ?? [] as $rec) {
            $event->recompensas()->create(Arr::except($rec, ['id']));
        }

        $event->load(array_merge(['sede'], self::RECOMPENSAS_WITH));

        return response()->json(['event' => $this->formatEvent($event, false, false)], 201);
    }

    public function update(Request $request, Event $event): JsonResponse
    {
        if (!$this->puedeGestionar($request->user())) {
            return response()->json(['message' => 'No tienes permiso para editar este evento.'], 403);
        }

        if ($event->status === 'REALIZADO') {
            return response()->json(['message' => 'No se puede editar un evento ya cerrado.'], 403);
        }

        $data = $request->validate(array_merge([
            'name'         => 'sometimes|required|string|max:255',
            'type'         => 'sometimes|required|in:EXHIBICIÓN,CEREMONIA,DEMOSTRACIÓN,TALLER,GALA,CHARLA',
            'event_date'   => 'nullable|date',
            'location'     => 'nullable|string|max:255',
            'sede_id'      => 'nullable|integer|exists:sedes,id',
            'capacity'     => 'nullable|integer|min:1',
            'description'  => 'nullable|string',
            'banner'       => 'nullable|string|max:50',
        ], $this->recompensasRules()));

        $event->update(Arr::except($data, ['recompensas']));

        if (array_key_exists('recompensas', $data)) {
            $this->syncRecompensas($event, $data['recompensas']);
        }

        $event->load(array_merge(['sede'], self::RECOMPENSAS_WITH));

        return response()->json(['event' => $this->formatEvent($event, false, false)]);
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

    /** Detalle de un evento — incluye la lista de inscritos, solo para quien puede gestionar eventos. */
    public function show(Request $request, Event $event): JsonResponse
    {
        if (!$this->puedeGestionar($request->user())) {
            return response()->json(['message' => 'No tienes permiso para ver este detalle.'], 403);
        }

        $event->load(array_merge(['sede'], self::RECOMPENSAS_WITH));

        $registrations = EventRegistration::where('event_id', $event->id)
            ->with('user.character')
            ->get()
            ->map(fn (EventRegistration $r) => [
                'user_id' => $r->user_id,
                'name'    => $r->user?->character?->name ?? $r->user?->name,
                'handle'  => $r->user?->character?->handle,
                'claimed' => $r->claimed,
            ]);

        return response()->json([
            'event' => $this->formatEvent($event, false, false),
            'registrations' => $registrations,
        ]);
    }

    private function formatEvent(Event $event, bool $mine, bool $claimed): array
    {
        return [
            'id'           => $event->id,
            'name'         => $event->name,
            'type'         => $event->type,
            'status'       => $event->status,
            'event_date'   => $event->event_date?->format('Y-m-d'),
            'location'     => $event->location,
            'sede_id'      => $event->sede_id,
            'sede_nombre'  => $event->sede?->nombre,
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

        if ($event->status === 'REALIZADO') {
            return response()->json(['message' => 'Este evento ya fue cerrado.'], 409);
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

    /**
     * Cierra el evento y, en el mismo paso, otorga las recompensas a todos los inscritos
     * aún no premiados — es el único punto donde se disparan las recompensas (no hay
     * reclamo individual: quedarse inscrito y que el maestro cierre el evento basta).
     */
    public function close(Request $request, Event $event): JsonResponse
    {
        if (!$this->puedeGestionar($request->user())) {
            return response()->json(['message' => 'No tienes permiso para cerrar este evento.'], 403);
        }

        if ($event->status === 'REALIZADO') {
            return response()->json(['message' => 'El evento ya fue cerrado.'], 409);
        }

        $event->update(['status' => 'REALIZADO']);

        $recompensas = $event->recompensas()->get();
        $pendientes = EventRegistration::where('event_id', $event->id)
            ->where('claimed', false)
            ->with('user')
            ->get();

        $grantService = app(RecompensaGrantService::class);
        $recompensados = 0;
        foreach ($pendientes as $registration) {
            if (!$registration->user) {
                continue;
            }
            $grantService->otorgar($recompensas, $registration->user, ['event_id' => $event->id]);
            $registration->update(['claimed' => true]);
            $recompensados++;
        }

        $event->load(array_merge(['sede'], self::RECOMPENSAS_WITH));

        return response()->json([
            'message' => "Evento cerrado — {$recompensados} inscrito(s) recompensado(s).",
            'recompensados' => $recompensados,
            'event' => $this->formatEvent($event, false, false),
        ]);
    }
}
