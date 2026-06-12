<?php

namespace App\Notifications;

use App\Models\Task;
use App\Models\User;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\BroadcastMessage;
use Illuminate\Notifications\Notification;

class TareaAsignada extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(
        public readonly Task $task,
        public readonly User $tutor,
    ) {}

    public function via(object $notifiable): array
    {
        return ['database', 'broadcast'];
    }

    public function toArray(object $notifiable): array
    {
        return [
            'type'         => 'tarea_asignada',
            'icon'         => 'tasks',
            'tone'         => 'holo',
            'title'        => "Nueva tarea: {$this->task->title}",
            'body'         => "Asignada por {$this->tutor->name} · Recompensa: {$this->task->reward} créditos",
            'action_url'   => '/tareas',
            'action_label' => 'Ver tarea',
            'task_id'      => $this->task->id,
        ];
    }

    public function toBroadcast(object $notifiable): BroadcastMessage
    {
        return new BroadcastMessage($this->toArray($notifiable));
    }
}
