<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\MorphMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class MapEnemigo extends Model
{
    use SoftDeletes;

    protected $table = 'map_enemigos';

    protected $fillable = [
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
        'dano',
        'dano_escudo',
        'dano_perforante',
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
        'dano' => 'integer',
        'dano_escudo' => 'integer',
        'dano_perforante' => 'integer',
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

    /**
     * IDs de las hasta 2 habilidades asignadas, sin nulos — los enemigos comunes solo tienen
     * 2 slots (habilidad_3/habilidad_4 existen en la tabla por historia compartida con
     * map_npcs, pero no se exponen ni se usan para este modelo).
     */
    public function habilidadIds(): array
    {
        return array_values(array_filter([$this->habilidad_1, $this->habilidad_2]));
    }

    /**
     * Nivel de dificultad base del catálogo (representado con estrellas en la UI): otorga
     * +1 a todos los atributos por nivel y redefine el umbral de crítico (dado ≥ 21-nivel).
     * A diferencia de los Jefes, un enemigo común NO recibe el bono plano de +nivel en daño
     * ni el +floor(nivel/2) extra en críticos (ver NpcCombatScreen.jsx, prop `esEnemigo`).
     * Al aparecer en un lugar concreto, este valor puede quedar sobrescrito por el nivel de
     * la asignación (pivot `map_lugar_enemigos.nivel`) — ver LugarEncuentroController.
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

    /** Lugares donde este enemigo puede aparecer, con su tasa de aparición y nivel propios de cada lugar. */
    public function lugares(): BelongsToMany
    {
        return $this->belongsToMany(MapLugar::class, 'map_lugar_enemigos', 'enemigo_id', 'lugar_id')
            ->withPivot('tasa_aparicion', 'nivel')
            ->withTimestamps();
    }

    /** Recompensas configuradas para el sorteo de botín al ser derrotado. */
    public function recompensas(): MorphMany
    {
        return $this->morphMany(MapRecompensa::class, 'dropable');
    }
}
