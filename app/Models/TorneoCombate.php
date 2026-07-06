<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class TorneoCombate extends Model
{
    protected $table = 'torneo_combates';

    protected $fillable = [
        'torneo_id',
        'ronda',
        'posicion',
        'user_a_id',
        'user_b_id',
        'ganador_id',
        'estado',
        'puntos_a',
        'puntos_b',
        'faltas_a',
        'faltas_b',
        'falta_grave_a',
        'falta_grave_b',
        'next_combate_id',
        'next_slot',
        'resuelto_por',
    ];

    protected $casts = [
        'ronda'         => 'integer',
        'posicion'      => 'integer',
        'puntos_a'      => 'integer',
        'puntos_b'      => 'integer',
        'faltas_a'      => 'integer',
        'faltas_b'      => 'integer',
        'falta_grave_a' => 'boolean',
        'falta_grave_b' => 'boolean',
    ];

    public function torneo(): BelongsTo
    {
        return $this->belongsTo(Torneo::class);
    }

    public function userA(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_a_id');
    }

    public function userB(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_b_id');
    }

    public function ganador(): BelongsTo
    {
        return $this->belongsTo(User::class, 'ganador_id');
    }

    public function nextCombate(): BelongsTo
    {
        return $this->belongsTo(TorneoCombate::class, 'next_combate_id');
    }
}
