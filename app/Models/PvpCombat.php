<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PvpCombat extends Model
{
    protected $fillable = [
        'attacker_id', 'defender_id', 'lugar_id',
        'attacker_hp', 'defender_hp', 'attacker_escudo', 'defender_escudo',
        'attacker_def_bonus', 'defender_def_bonus',
        'current_turn', 'status', 'log',
    ];

    protected $casts = [
        'log'                => 'array',
        'attacker_id'        => 'integer',
        'defender_id'        => 'integer',
        'lugar_id'           => 'integer',
        'attacker_hp'        => 'integer',
        'defender_hp'        => 'integer',
        'attacker_escudo'    => 'integer',
        'defender_escudo'    => 'integer',
        'attacker_def_bonus' => 'integer',
        'defender_def_bonus' => 'integer',
        'current_turn'       => 'integer',
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
