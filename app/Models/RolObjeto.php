<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
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
        'bono_capacidad_carga',
        'bono_capacidad_salto',
        'bono_costo_reparacion',
        'mejora_habilidad_id',
        'bono_cooldown',
        'cura_vida',
        'cura_escudo',
        'buff',
        'debuff',
    ];

    protected $casts = [
        'activo' => 'boolean',
        'dano' => 'integer',
        'dano_perforante' => 'integer',
        'bono_ataque' => 'integer',
        'bono_defensa' => 'integer',
        'bono_punteria' => 'integer',
        'bono_movimiento' => 'integer',
        'bono_iniciativa' => 'integer',
        'bono_vida' => 'integer',
        'bono_escudo' => 'integer',
        'bono_dano' => 'integer',
        'bono_dano_perforante' => 'integer',
        'bono_critico' => 'integer',
        'bono_fuerza' => 'integer',
        'bono_generacion_fuerza' => 'integer',
        'consumo_energia' => 'integer',
        'energia_maxima' => 'integer',
        'bono_capacidad_carga' => 'integer',
        'bono_capacidad_salto' => 'integer',
        'bono_costo_reparacion' => 'integer',
        'bono_cooldown' => 'integer',
        'cura_vida' => 'integer',
        'cura_escudo' => 'integer',
    ];

    /* buff y debuff se reciben como array o como JSON string (desde FormData) — mismo mutador
     * que RolHabilidad, para reutilizar el mismo registro de estados reservados (ver
     * app/Support/Combat/AplicaEstadosCombate.php) en objetos 'utilizable'. */

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

    public function characters(): BelongsToMany
    {
        return $this->belongsToMany(Character::class, 'rol_character_objeto')
            ->withTimestamps();
    }

    /** Habilidad de nave cuyo cooldown reduce esta mejora (solo aplica si tipo = mejora_nave). */
    public function mejoraHabilidad(): BelongsTo
    {
        return $this->belongsTo(RolHabilidad::class, 'mejora_habilidad_id');
    }
}
