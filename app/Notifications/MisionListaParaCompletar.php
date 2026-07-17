<?php

namespace App\Notifications;

use App\Notifications\Concerns\BuildsWebPushMessage;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\BroadcastMessage;
use Illuminate\Notifications\Notification;
use NotificationChannels\WebPush\WebPushChannel;

class MisionListaParaCompletar extends Notification implements ShouldQueue
{
    use BuildsWebPushMessage, Queueable;

    public function __construct(
        public readonly array $mision,
    ) {}

    public function via(object $notifiable): array
    {
        return ['database', 'broadcast', WebPushChannel::class];
    }

    public function toArray(object $notifiable): array
    {
        $objetivos = array_values(array_filter(array_map(
            fn ($o) => $o['nombre'] ?? null,
            $this->mision['objetivos'] ?? []
        )));
        $recompensas = array_values(array_filter(array_map(
            function ($r) {
                if (($r['tipo'] ?? null) === 'habilidad' && ! empty($r['habilidad']['nombre'])) {
                    return $r['habilidad']['nombre'];
                }
                return $r['nombre'] ?? null;
            },
            $this->mision['recompensas'] ?? []
        )));

        $bodyParts = [];
        if (! empty($objetivos)) {
            $bodyParts[] = 'Objetivos: '.implode(' · ', array_slice($objetivos, 0, 2)).(count($objetivos) > 2 ? ' +' . (count($objetivos) - 2) : '');
        }
        if (! empty($recompensas)) {
            $bodyParts[] = 'Recompensa: '.implode(' · ', array_slice($recompensas, 0, 2)).(count($recompensas) > 2 ? ' +' . (count($recompensas) - 2) : '');
        }

        return [
            'type' => 'mision_lista_para_completar',
            'icon' => 'check',
            'tone' => 'orange',
            'title' => 'Misión lista para completar',
            'body' => $this->mision['nombre'] ?? 'Misión',
            'action_url' => '/misiones',
            'action_label' => 'Completar',
            'mision' => $this->mision,
            'mission_id' => $this->mision['id'] ?? null,
            'summary' => $bodyParts,
        ];
    }

    public function toBroadcast(object $notifiable): BroadcastMessage
    {
        return new BroadcastMessage($this->toArray($notifiable));
    }
}
