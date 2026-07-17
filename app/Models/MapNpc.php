<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class MapNpc extends Model
{
    use SoftDeletes;

    protected $table = 'map_npcs';

    protected $fillable = [
        'LugarID',
        'nombre',
        'tipo',
        'profesion',
        'faccion',
        'imagen_mini',
        'imagen',
        'saludo',
        'interaccion',
        'prompt',
        'MisionID',
        'urlInteraccion',
        'visible',
        'vida',
        'escudo',
        'defensa',
        'ataque',
        'movimiento',
        'iniciativa',
        'punteria',
        'forma',
        'nivel',
        'hito_requerimiento',
        'fecha_inicio',
        'fecha_fin',
        'habilidad_1',
        'habilidad_2',
        'habilidad_3',
        'habilidad_4',
        'raid_slots',
    ];

    protected $casts = [
        'visible' => 'boolean',
        'vida' => 'integer',
        'escudo' => 'integer',
        'defensa' => 'integer',
        'ataque' => 'integer',
        'movimiento' => 'integer',
        'iniciativa' => 'integer',
        'punteria' => 'integer',
        'forma' => 'integer',
        'nivel' => 'integer',
        'fecha_inicio' => 'date',
        'fecha_fin' => 'date',
        'habilidad_1' => 'integer',
        'habilidad_2' => 'integer',
        'habilidad_3' => 'integer',
        'habilidad_4' => 'integer',
        'raid_slots' => 'integer',
    ];

    public function lugar(): BelongsTo
    {
        return $this->belongsTo(MapLugar::class, 'LugarID');
    }

    public function mision(): BelongsTo
    {
        return $this->belongsTo(Mision::class, 'MisionID');
    }

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

    /** IDs de las hasta 4 habilidades asignadas (tipo jefe), sin nulos. */
    public function habilidadIds(): array
    {
        return array_values(array_filter([
            $this->habilidad_1, $this->habilidad_2, $this->habilidad_3, $this->habilidad_4,
        ]));
    }

    /** Cupos configurados para el Combate RAID de este jefe (mínimo 2, por defecto 4). */
    public function raidCupos(): int
    {
        return max(2, $this->raid_slots ?: 4);
    }

    /**
     * Nivel de dificultad (representado con estrellas en la UI): otorga a este NPC
     * +1 a todos sus atributos por nivel, un bono plano adicional de +nivel en
     * daño/curación, +floor(nivel/2) extra en críticos, y redefine el umbral de
     * crítico (dado ≥ 21-nivel, ej. nivel 4 → crítico con 17-20).
     */
    public function nivelDificultad(): int
    {
        return max(0, $this->nivel ?? 1);
    }

    public function critThreshold(): int
    {
        return 21 - $this->nivelDificultad();
    }

    public function nivelBonoCritico(): int
    {
        return (int) floor($this->nivelDificultad() / 2);
    }

    /** Naves que este NPC (tipo "vendedor_naves") tiene a la venta. */
    public function naves(): BelongsToMany
    {
        return $this->belongsToMany(MapNave::class, 'map_npc_naves', 'npc_id', 'nave_id')
            ->withPivot('interes')
            ->withTimestamps();
    }

    /** Objetos que este NPC (tipo "vendedor") tiene a la venta. */
    public function objetos(): BelongsToMany
    {
        return $this->belongsToMany(RolObjeto::class, 'map_npc_objetos', 'npc_id', 'rol_objeto_id')
            ->withPivot('interes')
            ->withTimestamps();
    }
}
