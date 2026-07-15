<?php

namespace App\Notifications;

use App\Notifications\Concerns\BuildsWebPushMessage;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\BroadcastMessage;
use Illuminate\Notifications\Notification;
use NotificationChannels\WebPush\WebPushChannel;

class PvpCombatNotification extends Notification implements ShouldQueue
{
    use BuildsWebPushMessage, Queueable;

    public function __construct(
        public readonly string $title,
        public readonly string $body,
        public readonly int $combatId,
        public readonly bool $push = true,
    ) {}

    public function via(object $notifiable): array
    {
        return $this->push
            ? ['database', 'broadcast', WebPushChannel::class]
            : ['database', 'broadcast'];
    }

    public function toArray(object $notifiable): array
    {
        return [
            'type' => 'pvp_combat',
            'icon' => 'swords',
            'tone' => 'red',
            'title' => $this->title,
            'body' => $this->body,
            'action_url' => '#mapa',
            'action_label' => 'Ir al combate',
            'combat_id' => $this->combatId,
        ];
    }

    public function toBroadcast(object $notifiable): BroadcastMessage
    {
        return new BroadcastMessage($this->toArray($notifiable));
    }
}
