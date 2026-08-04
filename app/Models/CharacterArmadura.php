<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CharacterArmadura extends Model
{
    protected $table = 'character_armaduras';

    protected $fillable = [
        'character_id',
        'objeto_id',
        'activo',
        'mejora_1_id',
        'mejora_2_id',
        'mejora_3_id',
        'mejora_4_id',
    ];

    protected $casts = [
        'activo' => 'boolean',
    ];

    /* Bonos ya sumados (armadura + sus mejoras) para que el frontend no tenga que
     * reimplementar la suma al pintar los badges del panel de equipo. */
    protected $appends = ['bonos'];

    /**
     * Los 4 slots — cualquiera acepta cualquier rol_objeto tipo "mejora_armadura".
     * Son nombres de RELACIÓN (mejora1…mejora4), no de columna: `$this->{'mejora_1'}`
     * no resuelve nada en Eloquent (ni columna, que es `mejora_1_id`, ni relación).
     */
    const MEJORA_SLOTS = ['mejora1', 'mejora2', 'mejora3', 'mejora4'];

    /** Atributos que puede bonificar una armadura, sin el prefijo `bono_`. */
    const BONO_STATS = [
        'ataque', 'defensa', 'punteria', 'movimiento', 'iniciativa',
        'vida', 'escudo', 'fuerza', 'generacion_fuerza',
    ];

    public function character(): BelongsTo
    {
        return $this->belongsTo(Character::class);
    }

    /** El rol_objeto tipo "armadura" del que esta instancia es una copia poseída. */
    public function objeto(): BelongsTo
    {
        return $this->belongsTo(RolObjeto::class, 'objeto_id');
    }

    public function mejora1(): BelongsTo
    {
        return $this->belongsTo(RolObjeto::class, 'mejora_1_id');
    }

    public function mejora2(): BelongsTo
    {
        return $this->belongsTo(RolObjeto::class, 'mejora_2_id');
    }

    public function mejora3(): BelongsTo
    {
        return $this->belongsTo(RolObjeto::class, 'mejora_3_id');
    }

    public function mejora4(): BelongsTo
    {
        return $this->belongsTo(RolObjeto::class, 'mejora_4_id');
    }

    /** Suma un campo de bono (bono_defensa, bono_vida, etc.) entre las 4 mejoras instaladas. */
    public function sumaBonoMejoras(string $campo): int
    {
        return collect(self::MEJORA_SLOTS)->sum(fn ($slot) => $this->{$slot}?->{$campo} ?? 0);
    }

    /** Bono total del conjunto: el que trae la armadura misma más el de sus mejoras. */
    public function bonoTotal(string $campo): int
    {
        return ($this->objeto?->{$campo} ?? 0) + $this->sumaBonoMejoras($campo);
    }

    /** Mapa stat => bono total, con las mismas claves que Character::sableBonos(). */
    public function getBonosAttribute(): array
    {
        return collect(self::BONO_STATS)
            ->mapWithKeys(fn ($stat) => [$stat => $this->bonoTotal("bono_{$stat}")])
            ->all();
    }
}
