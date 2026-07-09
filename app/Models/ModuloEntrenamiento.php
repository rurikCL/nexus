<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ModuloEntrenamiento extends Model
{
    protected $table = 'modulos_entrenamiento';

    protected $fillable = [
        'nombre',
        'descripcion',
        'objetivos',
        'foco',
        'esfuerzo',
        'forma',
        'fotos',
        'video',
        'nivel_dificultad',
        'estado',
        'rango',
        'creado_por',
        'revisado_por',
    ];

    protected $casts = [
        'objetivos' => 'array',
        'fotos'     => 'array',
        'esfuerzo'  => 'integer',
    ];

    public function creadoPor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'creado_por');
    }

    public function revisadoPor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'revisado_por');
    }
}
