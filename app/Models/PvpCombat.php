<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PvpCombat extends Model
{
    protected $fillable = [
        'attacker_id', 'defender_id', 'lugar_id', 'zona_id', 'planeta_id', 'sistema_id',
        'attacker_hp', 'defender_hp', 'attacker_escudo', 'defender_escudo',
        'attacker_def_bonus', 'defender_def_bonus',
        'attacker_fuerza', 'defender_fuerza',
        'attacker_cooldowns', 'defender_cooldowns',
        'attacker_buffs', 'defender_buffs',
        'attacker_debuffs', 'defender_debuffs',
        'attacker_estados', 'defender_estados',
        'attacker_last_forma', 'defender_last_forma',
        'attacker_current_forma', 'defender_current_forma',
        'current_turn', 'status', 'modo', 'log',
        'ronda', 'ronda_turno', 'resumen_ia',
    ];

    protected $casts = [
        'log' => 'array',
        'ronda' => 'integer',
        'ronda_turno' => 'integer',
        'attacker_cooldowns' => 'array',
        'defender_cooldowns' => 'array',
        'attacker_buffs' => 'array',
        'defender_buffs' => 'array',
        'attacker_debuffs' => 'array',
        'defender_debuffs' => 'array',
        'attacker_estados' => 'array',
        'defender_estados' => 'array',
        'attacker_id' => 'integer',
        'defender_id' => 'integer',
        'lugar_id' => 'integer',
        'zona_id' => 'integer',
        'planeta_id' => 'integer',
        'sistema_id' => 'integer',
        'attacker_hp' => 'integer',
        'defender_hp' => 'integer',
        'attacker_escudo' => 'integer',
        'defender_escudo' => 'integer',
        'attacker_def_bonus' => 'integer',
        'defender_def_bonus' => 'integer',
        'attacker_fuerza' => 'integer',
        'defender_fuerza' => 'integer',
        'attacker_last_forma' => 'integer',
        'defender_last_forma' => 'integer',
        'attacker_current_forma' => 'integer',
        'defender_current_forma' => 'integer',
        'current_turn' => 'integer',
    ];

    public function attacker(): BelongsTo
    {
        return $this->belongsTo(User::class, 'attacker_id');
    }

    public function defender(): BelongsTo
    {
        return $this->belongsTo(User::class, 'defender_id');
    }

    public function isActive(): bool
    {
        return $this->status === 'active';
    }

    public function involvedUser(int $userId): bool
    {
        return $this->attacker_id === $userId || $this->defender_id === $userId;
    }
}
