<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class RaidCombat extends Model
{
    protected $table = 'raid_combats';

    protected $fillable = [
        'npc_id', 'status',
        'npc_hp', 'npc_escudo', 'npc_forma', 'npc_buffs', 'npc_debuffs', 'npc_cooldowns', 'npc_estados',
        'turn_order', 'turn_index', 'turn_started_at', 'ronda', 'log',
        'lugar_id', 'zona_id', 'planeta_id', 'sistema_id',
    ];

    protected $casts = [
        'npc_hp' => 'integer',
        'npc_escudo' => 'integer',
        'npc_forma' => 'integer',
        'npc_buffs' => 'array',
        'npc_debuffs' => 'array',
        'npc_cooldowns' => 'array',
        'npc_estados' => 'array',
        'turn_order' => 'array',
        'turn_index' => 'integer',
        'turn_started_at' => 'datetime',
        'ronda' => 'integer',
        'log' => 'array',
        'lugar_id' => 'integer',
        'zona_id' => 'integer',
        'planeta_id' => 'integer',
        'sistema_id' => 'integer',
    ];

    public function npc(): BelongsTo
    {
        return $this->belongsTo(MapNpc::class, 'npc_id');
    }

    public function jugadores(): HasMany
    {
        return $this->hasMany(RaidCombatPlayer::class);
    }

    public function isWaiting(): bool
    {
        return $this->status === 'esperando';
    }

    public function isActive(): bool
    {
        return $this->status === 'activo';
    }

    public function isFinished(): bool
    {
        return in_array($this->status, ['ganado', 'perdido'], true);
    }
}
