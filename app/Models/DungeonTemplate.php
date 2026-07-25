<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\MorphMany;

class DungeonTemplate extends Model
{
    protected $table = 'dungeon_templates';

    protected $fillable = [
        'nombre',
        'map_zona_id',
        'jefe_npc_id',
        'rareza',
        'salas_min',
        'salas_max',
        'visible',
    ];

    protected $casts = [
        'salas_min' => 'integer',
        'salas_max' => 'integer',
        'visible' => 'boolean',
    ];

    public function zona(): BelongsTo
    {
        return $this->belongsTo(MapZona::class, 'map_zona_id');
    }

    public function jefe(): BelongsTo
    {
        return $this->belongsTo(MapNpc::class, 'jefe_npc_id');
    }

    /** Pool de enemigos comunes que pueden aparecer en las salas normales generadas de este template. */
    public function enemigos(): BelongsToMany
    {
        return $this->belongsToMany(MapEnemigo::class, 'dungeon_template_enemigos', 'dungeon_template_id', 'enemigo_id')
            ->withPivot('tasa_aparicion', 'nivel')
            ->withTimestamps();
    }

    public function runs(): HasMany
    {
        return $this->hasMany(DungeonRun::class);
    }

    /** Recompensas del pool de cofres de este template (ver DungeonController::abrirCofre) — mismo modelo polimórfico que usan MapNpc/MapEnemigo. */
    public function recompensas(): MorphMany
    {
        return $this->morphMany(MapRecompensa::class, 'dropable');
    }

    /** Número de salas a generar para un run de este template (entre salas_min y salas_max, inclusive). */
    public function numSalasValido(int $numSalas): int
    {
        return max((int) $this->salas_min, min((int) $this->salas_max, $numSalas));
    }

    /**
     * Cupos del equipo que se arma en el lobby (unirse/listo) y que luego pelea junto
     * contra el jefe: reutiliza raidCupos() del propio MapNpc jefe en vez de duplicar la
     * configuración, ya que es el mismo equipo el que hace todo el recorrido.
     */
    public function cuposEquipo(): int
    {
        return $this->jefe->raidCupos();
    }

    /**
     * Cantidad fija de cofres a repartir al azar entre las salas normales de un run,
     * según la rareza del dungeon — ver DungeonGeneratorService.
     */
    public function cofresTotal(): int
    {
        return match ($this->rareza) {
            'raro', 'epico' => 2,
            'legendario' => 3,
            default => 1, // comun, poco_comun, o sin rareza configurada
        };
    }
}
