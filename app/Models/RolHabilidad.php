<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class RolHabilidad extends Model
{
    use SoftDeletes;

    protected $table = 'rol_habilidades';

    protected $fillable = [
        'nombre',
        'tipo',
        'forma',
        'costo_fuerza',
        'efecto',
        'damage',
    ];

    protected $casts = [
        'forma'        => 'integer',
        'costo_fuerza' => 'integer',
        'damage'       => 'integer',
    ];
}
