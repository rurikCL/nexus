<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Objetivo extends Model
{
    protected $table = 'objetivos';

    protected $fillable = [
        'mision_id',
        'nombre',
        'descripcion',
        'tipo',
        'meta',
        'unidad',
        'progreso_tipo',
    ];

    public function mision(): BelongsTo
    {
        return $this->belongsTo(Mision::class, 'mision_id');
    }

    public function misiones(): HasMany
    {
        return $this->hasMany(Mision::class, 'objetivo_id');
    }
}
