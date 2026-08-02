<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\MorphMany;
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
        'prompt_respuestas',
        'tipo_interaccion',
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
        'interaccion_generada_at' => 'datetime',
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

    /** Bono de "dobles" máximo que el nivel puede otorgar — de ahí en más ya cubre todos los dobles no-1 (doble 2 en adelante), subir más el nivel no lo mejora. */
    private const BONO_DOBLES_MAX = 4;

    /**
     * Nivel de dificultad (representado con estrellas en la UI): otorga a este NPC
     * +1 a todos sus atributos por nivel (topeado en los Jefes al mismo tope que un
     * jugador con ítems, cap_stats_items — ver RaidCombatController::getNpcStats;
     * vida/escudo quedan fuera de ese tope y siguen escalando libres con el nivel),
     * un bono plano adicional de +nivel en daño/curación, +floor(nivel/2) extra en
     * críticos, y agranda la ventana de "dobles" que cuentan como crítico sobre 2d6
     * (ver esCriticoDobles) — ej. nivel 1 → solo doble 6, nivel 7+ → doble 6 a doble 2
     * (el máximo, ~14% de probabilidad). Doble 1 ("ojos de serpiente") NUNCA es
     * crítico — al contrario, es un fallo crítico: la tirada de ataque del Jefe
     * falla siempre que salga, sin importar el resultado — ver
     * RaidCombatController::resolveNpcTurn.
     */
    public function nivelDificultad(): int
    {
        return max(0, $this->nivel ?? 1);
    }

    public function bonoCriticoDobles(): int
    {
        return min(self::BONO_DOBLES_MAX, intdiv($this->nivelDificultad() + 1, 2));
    }

    /** ¿Es un crítico bajo el sistema de "dobles"? Doble ≥ (6-bono) cuenta; doble 1 nunca es crítico. */
    public function esCriticoDobles(int $dado1, int $dado2): bool
    {
        if ($dado1 !== $dado2 || $dado1 === 1) {
            return false;
        }

        return $dado1 >= (6 - $this->bonoCriticoDobles());
    }

    public function nivelBonoCritico(): int
    {
        return (int) floor($this->nivelDificultad() / 2);
    }

    /**
     * Bono plano a atributos (ataque/defensa/movimiento/iniciativa/punteria/vida/escudo) por
     * nivel de dificultad — a diferencia de `nivelDificultad()` (que arranca en 1 y se usa para
     * el sistema de dobles/daño de habilidad), este bono es 0 en nivel 1 y recién crece desde
     * nivel 2 (nivel 5 → +4). Usado en RaidCombatController::getNpcStats y en el bono plano de
     * daño de un ataque normal — NO afecta el sistema de dobles/crítico (ver esCritico).
     */
    public function bonoAtributoPorNivel(): int
    {
        return max(0, $this->nivelDificultad() - 1);
    }

    /**
     * ¿Es un golpe crítico? Nivel 1-3: sistema de "dobles" de siempre (esCriticoDobles). Nivel 4:
     * un dado en 6 y el otro en 5 o más (incluye doble 6). Nivel 5: un dado en 6 y el otro en 4 o
     * más. Doble 1 ("ojos de serpiente") nunca es crítico bajo ningún nivel — ver además
     * RaidCombatController::resolveNpcTurn para el fallo crítico que eso dispara.
     */
    public function esCritico(int $dado1, int $dado2): bool
    {
        $nivel = $this->nivelDificultad();
        if ($nivel < 4) {
            return $this->esCriticoDobles($dado1, $dado2);
        }

        $companero = $nivel >= 5 ? 4 : 5;

        return ($dado1 === 6 && $dado2 >= $companero) || ($dado2 === 6 && $dado1 >= $companero);
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

    /** Recompensas configuradas para el sorteo de botín al ser derrotado (tipo jefe, vía Combate RAID). */
    public function recompensas(): MorphMany
    {
        return $this->morphMany(MapRecompensa::class, 'dropable');
    }
}
