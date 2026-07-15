<?php

namespace App\Notifications;

use App\Notifications\Concerns\BuildsWebPushMessage;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\BroadcastMessage;
use Illuminate\Notifications\Notification;
use NotificationChannels\WebPush\WebPushChannel;

class TradeNotification extends Notification implements ShouldQueue
{
    use BuildsWebPushMessage, Queueable;

    public function __construct(
        public readonly string $title,
        public readonly string $body,
        public readonly int $tradeId,
    ) {}

    public function via(object $notifiable): array
    {
        return ['database', 'broadcast', WebPushChannel::class];
    }

    public function toArray(object $notifiable): array
    {
        return [
            'type' => 'trade',
            'icon' => 'coin',
            'tone' => 'holo',
            'title' => $this->title,
            'body' => $this->body,
            'action_url' => '#mapa',
            'action_label' => 'Ir al mapa',
            'trade_id' => $this->tradeId,
        ];
    }

    public function toBroadcast(object $notifiable): BroadcastMessage
    {
        return new BroadcastMessage($this->toArray($notifiable));
    }
}
