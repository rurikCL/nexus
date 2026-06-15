<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Combat extends Model
{
    protected $fillable = [
        'temporada_id', 'combatant_a_id', 'combatant_b_id', 'odds_a', 'odds_b',
        'fecha_desafio', 'event_name', 'round', 'live', 'resolved', 'winner', 'score_data',
    ];

    protected $casts = [
        'fecha_desafio' => 'datetime',
        'live'         => 'boolean',
        'resolved'     => 'boolean',
        'score_data'   => 'array',
    ];

    public function temporada(): BelongsTo
    {
        return $this->belongsTo(Temporada::class);
    }

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
