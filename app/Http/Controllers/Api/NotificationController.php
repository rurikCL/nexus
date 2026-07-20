<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Notifications\MisionListaParaCompletar;
use App\Notifications\TestTransmision;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Pusher\Pusher;

class NotificationController extends Controller
{
    /**
     * Tipos de notificación que tienen su propia sección dedicada en la UI y
     * por eso se excluyen del feed/campana general (siguen llegando por
     * broadcast/WebPush para disparar su propia UI, sólo no se listan aquí).
     */
    private const EXCLUIDAS_DEL_FEED_GENERAL = [
        MisionListaParaCompletar::class,
    ];

    // GET /notifications
    public function index(Request $request): JsonResponse
    {
        $notifications = $request->user()
            ->notifications()
            ->whereNotIn('type', self::EXCLUIDAS_DEL_FEED_GENERAL)
            ->latest()
            ->limit(50)
            ->get()
            ->map(fn ($n) => [
                'id' => $n->id,
                'type' => $n->type,
                'data' => $n->data,
                'read' => ! is_null($n->read_at),
                'created_at' => $n->created_at->toISOString(),
            ]);

        return response()->json([
            'data' => $notifications,
            'unread_count' => $request->user()->unreadNotifications()
                ->whereNotIn('type', self::EXCLUIDAS_DEL_FEED_GENERAL)
                ->count(),
        ]);
    }

    // POST /notifications/{id}/read
    public function markRead(Request $request, string $id): JsonResponse
    {
        $notification = $request->user()
            ->notifications()
            ->findOrFail($id);

        $notification->markAsRead();

        return response()->json(['ok' => true]);
    }

    // POST /notifications/read-all
    public function markAllRead(Request $request): JsonResponse
    {
        $request->user()->unreadNotifications()->update(['read_at' => now()]);

        return response()->json(['ok' => true]);
    }

    // DELETE /notifications/{id}
    public function destroy(Request $request, string $id): JsonResponse
    {
        $request->user()
            ->notifications()
            ->findOrFail($id)
            ->delete();

        return response()->json(['ok' => true]);
    }

    // POST /notifications/test — dispara una transmisión de prueba vía Pusher
    public function test(Request $request): JsonResponse
    {
        $data = $request->validate([
            'type' => 'required|in:desafio,victoria,derrota,tarea,sistema',
        ]);

        $templates = [
            'desafio' => [
                'icon' => 'swords',
                'tone' => 'orange',
                'title' => 'Diego Fuentes te retó a combate',
                'body' => 'Apuesta: 750 créditos · Duelo Oficial',
                'action_label' => 'VER DESAFÍO',
                'action_url' => '/combates',
            ],
            'victoria' => [
                'icon' => 'trophy',
                'tone' => 'green',
                'title' => '¡Ganaste el combate!',
                'body' => 'Carlos Méndez fue derrotado — Ronda clasificatoria',
                'action_label' => 'VER RESULTADO',
                'action_url' => '/combates',
            ],
            'derrota' => [
                'icon' => 'x',
                'tone' => 'red',
                'title' => 'Combate perdido',
                'body' => 'Carlos Méndez ganó el duelo · Sigue entrenando',
                'action_label' => 'VER RESULTADO',
                'action_url' => '/combates',
            ],
            'tarea' => [
                'icon' => 'tasks',
                'tone' => 'holo',
                'title' => 'Nueva tarea asignada',
                'body' => '3 sesiones de footwork · Recompensa: 120 créditos',
                'action_label' => 'VER TAREA',
                'action_url' => '/tareas',
            ],
            'sistema' => [
                'icon' => 'bell',
                'tone' => 'blue',
                'title' => 'Mensaje del Sistema NÉXUS',
                'body' => 'Mantenimiento programado en 10 minutos.',
                'action_label' => null,
                'action_url' => null,
            ],
        ];

        $payload = ['type' => 'test_'.$data['type'], ...$templates[$data['type']]];
        $user = $request->user();

        $pusher = new Pusher(
            config('broadcasting.connections.pusher.key'),
            config('broadcasting.connections.pusher.secret'),
            config('broadcasting.connections.pusher.app_id'),
            [
                'cluster' => config('broadcasting.connections.pusher.options.cluster'),
                'useTLS' => true,
            ]
        );

        $pusher->trigger(
            'private-App.Models.User.'.$user->id,
            'Illuminate\\Notifications\\Events\\BroadcastNotificationCreated',
            $payload
        );

        $user->notify(new TestTransmision($payload));

        return response()->json(['ok' => true]);
    }
}
