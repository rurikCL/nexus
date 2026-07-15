<?php

namespace App\Notifications;

use App\Models\Combat;
use App\Notifications\Concerns\BuildsWebPushMessage;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\BroadcastMessage;
use Illuminate\Notifications\Notification;
use NotificationChannels\WebPush\WebPushChannel;

class CombateResuelto extends Notification implements ShouldQueue
{
    use BuildsWebPushMessage, Queueable;

    public function __construct(
        public readonly Combat $combat,
        public readonly bool $userWon,
    ) {}

    public function via(object $notifiable): array
    {
        return ['database', 'broadcast', WebPushChannel::class];
    }

    public function toArray(object $notifiable): array
    {
        return [
            'type' => 'combate_resuelto',
            'icon' => 'trophy',
            'tone' => $this->userWon ? 'green' : 'red',
            'title' => $this->userWon ? '¡Ganaste el combate!' : 'Combate perdido',
            'body' => $this->combat->event_name ?? 'Duelo oficial',
            'action_url' => '/combates',
            'action_label' => 'Ver resultado',
            'combat_id' => $this->combat->id,
            'won' => $this->userWon,
        ];
    }

    public function toBroadcast(object $notifiable): BroadcastMessage
    {
        return new BroadcastMessage($this->toArray($notifiable));
    }
}
