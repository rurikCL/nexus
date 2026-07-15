<?php

namespace App\Notifications;

use App\Notifications\Concerns\BuildsWebPushMessage;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Notification;
use NotificationChannels\WebPush\WebPushChannel;

class TestTransmision extends Notification implements ShouldQueue
{
    use BuildsWebPushMessage, Queueable;

    public function __construct(
        public readonly array $payload,
    ) {}

    public function via(object $notifiable): array
    {
        return [WebPushChannel::class];
    }

    public function toArray(object $notifiable): array
    {
        return $this->payload;
    }
}
