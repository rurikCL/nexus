<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Torneo extends Model
{
    protected $fillable = [
        'nombre',
        'descripcion',
        'imagen',
        'premios',
        'requisitos',
        'cupos',
        'estado',
        'fecha_inicio',
        'ganador_user_id',
    ];

    protected $casts = [
        'fecha_inicio' => 'date',
        'cupos'        => 'integer',
    ];

    public function inscripciones(): HasMany
    {
        return $this->hasMany(TorneoInscripcion::class);
    }

    public function combates(): HasMany
    {
        return $this->hasMany(TorneoCombate::class);
    }

    public function ganador(): BelongsTo
    {
        return $this->belongsTo(User::class, 'ganador_user_id');
    }
}
