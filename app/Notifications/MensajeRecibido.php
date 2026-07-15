<?php

namespace App\Notifications;

use App\Models\Message;
use App\Models\User;
use App\Notifications\Concerns\BuildsWebPushMessage;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Notification;
use Illuminate\Support\Str;
use NotificationChannels\WebPush\WebPushChannel;

class MensajeRecibido extends Notification implements ShouldQueue
{
    use BuildsWebPushMessage, Queueable;

    public function __construct(
        public readonly User $sender,
        public readonly Message $message,
    ) {}

    public function via(object $notifiable): array
    {
        return [WebPushChannel::class];
    }

    public function toArray(object $notifiable): array
    {
        return [
            'type' => 'mensaje',
            'icon' => 'message',
            'tone' => 'holo',
            'title' => 'Nuevo mensaje de '.($this->sender->character?->handle ?? $this->sender->name),
            'body' => Str::limit($this->message->body, 90),
            'action_url' => '/mapa',
            'action_label' => 'Ver mensaje',
        ];
    }
}
