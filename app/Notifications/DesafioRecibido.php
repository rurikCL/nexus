<?php

namespace App\Notifications;

use App\Models\User;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\BroadcastMessage;
use Illuminate\Notifications\Notification;

class DesafioRecibido extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(
        public readonly User $challenger,
        public readonly int  $stake,
    ) {}

    public function via(object $notifiable): array
    {
        return ['database', 'broadcast'];
    }

    public function toArray(object $notifiable): array
    {
        return [
            'type'        => 'desafio_recibido',
            'icon'        => 'swords',
            'tone'        => 'orange',
            'title'       => "{$this->challenger->name} te retó a combate",
            'body'        => 'Apuesta: ' . number_format($this->stake) . ' créditos',
            'action_url'  => '/combates',
            'action_label'=> 'Ver desafío',
            'challenger_id' => $this->challenger->id,
            'stake'       => $this->stake,
        ];
    }

    public function toBroadcast(object $notifiable): BroadcastMessage
    {
        return new BroadcastMessage($this->toArray($notifiable));
    }
}
