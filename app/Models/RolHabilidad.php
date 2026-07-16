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
        'icono',
        'tipo',
        'forma',
        'costo_fuerza',
        'efecto',
        'damage',
        'damage_escudo',
        'damage_perforante',
        'cooldown',
        'objetivo',
        'buff',
        'debuff',
        'duracion',
    ];

    protected $casts = [
        'forma'         => 'integer',
        'costo_fuerza'  => 'integer',
        'damage'        => 'integer',
        'damage_escudo' => 'integer',
        'damage_perforante' => 'integer',
        'cooldown'      => 'integer',
        'duracion'      => 'integer',
    ];

    /* buff y debuff se reciben como array o como JSON string (desde FormData).
       El mutador normaliza ambos casos antes de persistir. */

    public function getBuffAttribute(?string $value): ?array
    {
        return $value !== null ? json_decode($value, true) : null;
    }

    public function setBuffAttribute(mixed $value): void
    {
        if (is_string($value)) {
            $value = json_decode($value, true) ?? [];
        }
        $this->attributes['buff'] = ($value && count($value) > 0) ? json_encode($value) : null;
    }

    public function getDebuffAttribute(?string $value): ?array
    {
        return $value !== null ? json_decode($value, true) : null;
    }

    public function setDebuffAttribute(mixed $value): void
    {
        if (is_string($value)) {
            $value = json_decode($value, true) ?? [];
        }
        $this->attributes['debuff'] = ($value && count($value) > 0) ? json_encode($value) : null;
    }
}
