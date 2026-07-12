<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
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
        'habilidad_1',
        'habilidad_2',
        'habilidad_3',
        'habilidad_4',
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
        'habilidad_1' => 'integer',
        'habilidad_2' => 'integer',
        'habilidad_3' => 'integer',
        'habilidad_4' => 'integer',
        'costo' => 'integer',
        'costo_reparacion' => 'integer',
        'costo_combustible' => 'integer',
    ];

    public function habilidad1(): BelongsTo
    {
        return $this->belongsTo(RolHabilidad::class, 'habilidad_1');
    }

    public function habilidad2(): BelongsTo
    {
        return $this->belongsTo(RolHabilidad::class, 'habilidad_2');
    }

    public function habilidad3(): BelongsTo
    {
        return $this->belongsTo(RolHabilidad::class, 'habilidad_3');
    }

    public function habilidad4(): BelongsTo
    {
        return $this->belongsTo(RolHabilidad::class, 'habilidad_4');
    }
}
