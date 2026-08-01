<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Fila de ranking registrada al vencer a un jefe (ver RaidCombatController::grantVictoryRewards).
 * Snapshot inmutable de las métricas del combate para un jugador — no se actualiza después.
 */
class JefeRanking extends Model
{
    protected $table = 'jefe_rankings';

    protected $fillable = [
        'npc_id', 'user_id', 'raid_combat_id', 'dungeon_run_id',
        'dano_total', 'curacion_total', 'debuffs_aplicados', 'rondas',
    ];

    protected $casts = [
        'dano_total' => 'integer',
        'curacion_total' => 'integer',
        'debuffs_aplicados' => 'integer',
        'rondas' => 'integer',
    ];

    public function npc(): BelongsTo
    {
        return $this->belongsTo(MapNpc::class, 'npc_id');
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
