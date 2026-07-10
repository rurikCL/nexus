<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ModuloFoto extends Model
{
    protected $table = 'modulos_fotos';

    protected $fillable = [
        'modulo_entrenamiento_id',
        'path',
        'prompt',
        'creado_por',
    ];

    public function moduloEntrenamiento(): BelongsTo
    {
        return $this->belongsTo(ModuloEntrenamiento::class);
    }

    public function creadoPor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'creado_por');
    }
}
