<?php

namespace App\Notifications;

use App\Models\PvpCombat;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Notification;
use NotificationChannels\WebPush\WebPushChannel;
use NotificationChannels\WebPush\WebPushMessage;

/**
 * Recordatorio push de "es tu turno" — se programa con un delay configurable
 * (config `pvp_notif_push_delay_min`) y solo se envía si, al cumplirse el
 * plazo, el jugador todavía no respondió (el combate sigue activo y no se
 * registró ninguna acción nueva desde que se programó este recordatorio).
 * Así evitamos el spam de un push por cada acción cuando el jugador está
 * atento y respondiendo rápido.
 */
class PvpTurnoPushRecordatorio extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(
        public readonly int $combatId,
        public readonly string $opponentName,
        public readonly int $logCountAtSchedule,
    ) {}

    public function via(object $notifiable): array
    {
        return [WebPushChannel::class];
    }

    public function shouldSend(object $notifiable, string $channel): bool
    {
        $combat = PvpCombat::find($this->combatId);

        if (! $combat || $combat->status !== 'active') {
            return false;
        }

        return count($combat->log ?? []) === $this->logCountAtSchedule;
    }

    public function toWebPush(object $notifiable, self $notification): WebPushMessage
    {
        return (new WebPushMessage)
            ->title('Sigue esperando tu jugada')
            ->body("vs {$this->opponentName} — Tu combate PvP sigue activo")
            ->icon('/assets/isotipo.png')
            ->data(['url' => '/mapa'])
            ->tag('nexus-pvp-combat-'.$this->combatId);
    }
}
