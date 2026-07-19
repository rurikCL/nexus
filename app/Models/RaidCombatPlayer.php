<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class RaidCombatPlayer extends Model
{
    protected $table = 'raid_combat_players';

    protected $fillable = [
        'raid_combat_id', 'user_id', 'slot',
        'hp', 'escudo', 'fuerza', 'current_forma', 'last_forma',
        'cooldowns', 'buffs', 'debuffs', 'estados', 'dano_al_jefe', 'status', 'listo',
    ];

    protected $casts = [
        'slot' => 'integer',
        'hp' => 'integer',
        'escudo' => 'integer',
        'fuerza' => 'integer',
        'current_forma' => 'integer',
        'last_forma' => 'integer',
        'cooldowns' => 'array',
        'buffs' => 'array',
        'debuffs' => 'array',
        'estados' => 'array',
        'dano_al_jefe' => 'integer',
        'listo' => 'boolean',
    ];

    public function raidCombat(): BelongsTo
    {
        return $this->belongsTo(RaidCombat::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function isActive(): bool
    {
        return $this->status === 'activo';
    }
}
