<?php

namespace App\Notifications\Concerns;

use NotificationChannels\WebPush\WebPushMessage;

/**
 * Deriva el mensaje de Web Push a partir del mismo payload que ya arma toArray(),
 * para que las notificaciones push del navegador coincidan con las de la campanita.
 */
trait BuildsWebPushMessage
{
    public function toWebPush(object $notifiable, self $notification): WebPushMessage
    {
        $data = $this->toArray($notifiable);
        $url = '/'.ltrim($data['action_url'] ?? '/', '#/');

        return (new WebPushMessage)
            ->title($data['title'])
            ->body($data['body'])
            ->icon('/assets/isotipo.png')
            ->tag('nexus-'.$data['type'])
            ->data(['url' => $url]);
    }
}
