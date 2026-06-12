<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Combat extends Model
{
    protected $fillable = [
        'combatant_a_id', 'combatant_b_id', 'odds_a', 'odds_b',
        'scheduled_at', 'event_name', 'round', 'live', 'resolved', 'winner',
    ];

    protected $casts = [
        'scheduled_at' => 'datetime',
        'live'         => 'boolean',
        'resolved'     => 'boolean',
    ];

    public function combatantA(): BelongsTo
    {
        return $this->belongsTo(User::class, 'combatant_a_id');
    }

    public function combatantB(): BelongsTo
    {
        return $this->belongsTo(User::class, 'combatant_b_id');
    }

    public function bets(): HasMany
    {
        return $this->hasMany(Bet::class);
    }
}
