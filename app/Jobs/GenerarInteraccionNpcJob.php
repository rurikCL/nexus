<?php

declare(strict_types=1);

namespace App\Jobs;

use App\Models\MapNpc;
use App\Services\NpcInteraccionService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;

/**
 * Regenera la `interaccion` de un NPC vía IA en segundo plano. Se dispara desde
 * NpcInteraccionService::ensureFresh() para que las peticiones HTTP que abren el
 * mapa o el diálogo de un NPC no esperen la respuesta de Mistral.
 */
class GenerarInteraccionNpcJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable;

    public int $tries = 1;

    public int $timeout = 30;

    public function __construct(public readonly int $npcId) {}

    public function handle(NpcInteraccionService $service): void
    {
        $npc = MapNpc::find($this->npcId);

        if (! $npc) {
            return;
        }

        $service->regenerar($npc);
    }
}
