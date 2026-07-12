<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class MapNave extends Model
{
    use SoftDeletes;

    protected $table = 'map_naves';

    protected $fillable = [
        'nombre',
        'tipo',
        'capacidad_carga',
        'vida',
        'escudo',
        'velocidad',
        'ataque',
        'maniobrabilidad',
        'capacidad_salto',
        'costo',
        'costo_reparacion',
        'costo_combustible',
        'rareza',
        'imagen',
        'descripcion',
    ];

    protected $casts = [
        'capacidad_carga' => 'integer',
        'vida' => 'integer',
        'escudo' => 'integer',
        'velocidad' => 'integer',
        'ataque' => 'integer',
        'maniobrabilidad' => 'integer',
        'capacidad_salto' => 'integer',
        'costo' => 'integer',
        'costo_reparacion' => 'integer',
        'costo_combustible' => 'integer',
    ];
}
