<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

class RolObjeto extends Model
{
    protected $table = 'rol_objetos';

    protected $fillable = [
        'nombre',
        'tipo',
        'tipo_ataque',
        'dano',
        'dano_perforante',
        'rareza',
        'descripcion',
        'efecto',
        'imagen',
        'costo',
        'activo',
        'bono_ataque',
        'bono_defensa',
        'bono_punteria',
        'bono_movimiento',
        'bono_iniciativa',
        'bono_vida',
        'bono_escudo',
        'bono_dano',
        'bono_dano_perforante',
        'bono_critico',
        'bono_fuerza',
        'bono_generacion_fuerza',
        'consumo_energia',
        'energia_maxima',
        'color_hoja',
    ];

    protected $casts = [
        'activo' => 'boolean',
        'dano'   => 'integer',
        'dano_perforante' => 'integer',
        'bono_ataque'     => 'integer',
        'bono_defensa'    => 'integer',
        'bono_punteria'   => 'integer',
        'bono_movimiento' => 'integer',
        'bono_iniciativa' => 'integer',
        'bono_vida'       => 'integer',
        'bono_escudo'     => 'integer',
        'bono_dano'       => 'integer',
        'bono_dano_perforante' => 'integer',
        'bono_critico'    => 'integer',
        'bono_fuerza'     => 'integer',
        'bono_generacion_fuerza' => 'integer',
        'consumo_energia' => 'integer',
        'energia_maxima'  => 'integer',
    ];

    public function characters(): BelongsToMany
    {
        return $this->belongsToMany(Character::class, 'rol_character_objeto')
            ->withTimestamps();
    }
}

