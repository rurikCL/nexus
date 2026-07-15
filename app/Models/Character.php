<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasManyThrough;
use Illuminate\Database\Eloquent\Relations\HasOne;

class Character extends Model
{
    protected $fillable = [
        'user_id', 'name', 'handle', 'bio', 'lore', 'photo', 'cls', 'saber_color', 'side',
        'sector', 'sponsor', 'joined_year', 'credits', 'reputation', 'stats', 'gold',
        'map_sistema_id', 'map_planeta_id', 'map_zona_id', 'map_lugar_id',
        'vida', 'escudo', 'defensa', 'ataque', 'movimiento', 'iniciativa', 'punteria', 'puntos_libres',
        'habilidad_1', 'habilidad_2', 'habilidad_3', 'habilidad_4',
        'habilidades_por_forma', 'current_forma',
        'arma_equipada_id',
        'nave_equipada_id',
    ];

    /** Capacidad de carga base para un personaje sin nave equipada. */
    public const CAPACIDAD_CARGA_BASE = 10;

    protected $casts = [
        'stats' => 'array',
        'gold' => 'boolean',
        'reputation' => 'integer',
        'map_sistema_id' => 'integer',
        'map_planeta_id' => 'integer',
        'map_zona_id' => 'integer',
        'map_lugar_id' => 'integer',
        'vida' => 'integer',
        'escudo' => 'integer',
        'defensa' => 'integer',
        'ataque' => 'integer',
        'movimiento' => 'integer',
        'iniciativa' => 'integer',
        'punteria' => 'integer',
        'puntos_libres' => 'integer',
        'habilidad_1' => 'integer',
        'habilidad_2' => 'integer',
        'habilidad_3' => 'integer',
        'habilidad_4' => 'integer',
        'habilidades_por_forma' => 'array',
        'current_forma' => 'integer',
    ];

    /** Forma numérica (1-7) de la Especialización ("Forma de Combate") elegida en Mi Personaje */
    public function formaEspecializacion(): int
    {
        $n = (int) str_replace('forma', '', $this->cls ?? 'forma1');

        return $n >= 1 && $n <= 7 ? $n : 1;
    }

    public function getWinrateAttribute(): int
    {
        $total = ($this->wins ?? 0) + ($this->losses ?? 0);

        return $total > 0 ? (int) round($this->wins / $total * 100) : 0;
    }

    public function getTotalAttribute(): int
    {
        return ($this->wins ?? 0) + ($this->losses ?? 0);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function mapSistema(): BelongsTo
    {
        return $this->belongsTo(MapSistema::class, 'map_sistema_id');
    }

    public function mapPlaneta(): BelongsTo
    {
        return $this->belongsTo(MapPlaneta::class, 'map_planeta_id');
    }

    public function mapZona(): BelongsTo
    {
        return $this->belongsTo(MapZona::class, 'map_zona_id');
    }

    public function mapLugar(): BelongsTo
    {
        return $this->belongsTo(MapLugar::class, 'map_lugar_id');
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

    public function rolObjetos(): BelongsToMany
    {
        return $this->belongsToMany(RolObjeto::class, 'rol_character_objeto')
            ->withPivot('cantidad')
            ->withTimestamps();
    }

    public function armaEquipada(): BelongsTo
    {
        return $this->belongsTo(RolObjeto::class, 'arma_equipada_id');
    }

    public function naves(): HasMany
    {
        return $this->hasMany(CharacterNave::class);
    }

    public function naveEquipada(): BelongsTo
    {
        return $this->belongsTo(CharacterNave::class, 'nave_equipada_id');
    }

    /** Capacidad de carga total: base + la que aporte la nave equipada. */
    public function capacidadCarga(): int
    {
        $nave = $this->relationLoaded('naveEquipada') ? $this->naveEquipada : $this->naveEquipada()->with('nave')->first();

        return self::CAPACIDAD_CARGA_BASE + ($nave?->nave?->capacidad_carga ?? 0);
    }

    /** Suma de unidades de todos los objetos poseídos (un objeto comprado 3 veces ocupa 3 espacios). */
    public function inventarioOcupado(): int
    {
        return (int) $this->rolObjetos()->sum('rol_character_objeto.cantidad');
    }

    public function inventarioLleno(): bool
    {
        return $this->inventarioOcupado() >= $this->capacidadCarga();
    }

    public function hitos(): HasMany
    {
        return $this->hasMany(CharacterHito::class);
    }

    public function sables(): HasMany
    {
        return $this->hasMany(CharacterSable::class);
    }

    public function sableActivo(): HasOne
    {
        return $this->hasOne(CharacterSable::class)->where('activo', true);
    }

    public function titulos(): HasMany
    {
        return $this->hasMany(CharacterTitulo::class);
    }

    public function tituloActivo(): HasOne
    {
        return $this->hasOne(CharacterTitulo::class)->where('activo', true);
    }

    /**
     * Arma que se usa realmente en el ataque básico de combate: el sable
     * armado tiene prioridad sobre el arma clásica equipada.
     */
    public function armaEfectiva(): ?array
    {
        $sable = $this->relationLoaded('sableActivo')
            ? $this->sableActivo
            : $this->sableActivo()->with('cristal')->first();
        if ($sable) {
            return [
                'id' => null,
                'nombre' => $sable->nombre,
                'tipo_ataque' => $sable->tipo_ataque,
                'dano' => $sable->dano,
                'critico' => $sable->critico,
                'es_sable' => true,
                'color_hoja' => $sable->color_hoja,
            ];
        }

        $arma = $this->armaEquipada;
        if ($arma) {
            return [
                'id' => $arma->id,
                'nombre' => $arma->nombre,
                'tipo_ataque' => $arma->tipo_ataque,
                'dano' => $arma->dano,
                'critico' => 0,
                'es_sable' => false,
                'color_hoja' => null,
            ];
        }

        return null;
    }

    public function sableBonos(): array
    {
        $vacio = [
            'ataque' => 0, 'defensa' => 0, 'punteria' => 0, 'movimiento' => 0,
            'iniciativa' => 0, 'vida' => 0, 'escudo' => 0,
            'fuerza' => 0, 'generacion_fuerza' => 0,
        ];

        $sable = $this->sableActivo()->with(array_keys(CharacterSable::SLOTS))->first();
        if (! $sable) {
            return $vacio;
        }

        return [
            'ataque' => $sable->sumaBono('bono_ataque'),
            'defensa' => $sable->sumaBono('bono_defensa'),
            'punteria' => $sable->sumaBono('bono_punteria'),
            'movimiento' => $sable->sumaBono('bono_movimiento'),
            'iniciativa' => $sable->sumaBono('bono_iniciativa'),
            'vida' => $sable->sumaBono('bono_vida'),
            'escudo' => $sable->sumaBono('bono_escudo'),
            'fuerza' => $sable->sumaBono('bono_fuerza'),
            'generacion_fuerza' => $sable->sumaBono('bono_generacion_fuerza'),
        ];
    }

    public function statsTemporadas(): HasManyThrough
    {
        return $this->hasManyThrough(StatsTemporada::class, User::class, 'id', 'user_id', 'user_id', 'id');
    }
}
