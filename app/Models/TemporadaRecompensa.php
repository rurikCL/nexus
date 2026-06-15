<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class TemporadaRecompensa extends Model
{
    protected $fillable = [
        'temporada_id', 'nombre', 'descripcion',
        'creditos', 'experiencia', 'medalla_id',
    ];

    public function temporada(): BelongsTo
    {
        return $this->belongsTo(Temporada::class);
    }
}
