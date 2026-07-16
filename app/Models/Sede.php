<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Sede extends Model
{
    protected $table = 'sedes';

    protected $fillable = [
        'nombre',
        'ubicacion',
        'pais',
        'region',
        'costo_membresia',
        'costo_mensualidad',
        'imagen',
        'activa',
    ];

    protected $casts = [
        'costo_membresia' => 'integer',
        'costo_mensualidad' => 'integer',
        'activa' => 'boolean',
    ];

    public function usuarios(): HasMany
    {
        return $this->hasMany(User::class);
    }
}
