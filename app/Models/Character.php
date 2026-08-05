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
    /* Topes FIJOS de Iniciativa para la tirada de cambio de estancia (INI + 2d6 >= 10). A
       propósito no salen de Configuracion como los de combatStats(): esta mecánica se balancea
       aparte. Ver iniciativaEstancia() y App\Support\Combat\TiradaEstancia. */
    public const INI_ESTANCIA_CAP_ASIGNACION = 4;
    public const INI_ESTANCIA_CAP_EQUIPO = 5;
    public const INI_ESTANCIA_CAP_BUFF = 7;
    /** Total (INI + 2d6) a alcanzar para que el cambio de estancia no consuma el turno. */
    public const INI_ESTANCIA_OBJETIVO = 10;

    protected $fillable = [
        'user_id', 'name', 'handle', 'bio', 'lore', 'photo', 'imagen_rpg', 'cls', 'saber_color', 'side',
        'sector', 'sponsor', 'joined_year', 'credits', 'reputation', 'gold',
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

    /** Imagen a mostrar en Mapa Galáctico, combates y la Carta de personaje — prioriza el
     * retrato RPG (`imagen_rpg`) por sobre la foto de perfil genérica (`photo`). */
    public function imagenMapa(): ?string
    {
        return $this->imagen_rpg ?: $this->photo;
    }

    /** Forma numérica (1-7) de la Especialización ("Forma de Combate") elegida en Mi Personaje. */
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

    /** Ubicación actual del personaje en el mapa galáctico, siempre leída en vivo desde la BD. */
    public function mapLocationArray(): array
    {
        return [
            'sistema_id' => $this->map_sistema_id,
            'sistema_nombre' => $this->mapSistema?->nombre,
            'planeta_id' => $this->map_planeta_id,
            'planeta_nombre' => $this->mapPlaneta?->nombre,
            'zona_id' => $this->map_zona_id,
            'zona_nombre' => $this->mapZona?->nombre,
            'lugar_id' => $this->map_lugar_id,
            'lugar_nombre' => $this->mapLugar?->nombre,
            'nombre' => $this->mapLugar?->nombre
                             ?? $this->mapZona?->nombre
                             ?? $this->mapPlaneta?->nombre
                             ?? $this->mapSistema?->nombre,
            'nivel' => $this->map_lugar_id ? 'lugar'
                              : ($this->map_zona_id ? 'zona'
                              : ($this->map_planeta_id ? 'planeta'
                              : ($this->map_sistema_id ? 'sistema' : null))),
        ];
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

    /** Capacidad de carga total: base + la que aporte la nave equipada con sus mejoras instaladas. */
    public function capacidadCarga(): int
    {
        $nave = $this->relationLoaded('naveEquipada')
            ? $this->naveEquipada
            : $this->naveEquipada()->with(array_merge(['nave'], CharacterNave::MEJORA_SLOTS))->first();

        return self::CAPACIDAD_CARGA_BASE + ($nave?->capacidadCargaConMejoras() ?? 0);
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

    public function armaduras(): HasMany
    {
        return $this->hasMany(CharacterArmadura::class);
    }

    public function armaduraActiva(): HasOne
    {
        return $this->hasOne(CharacterArmadura::class)->where('activo', true);
    }

    public function titulos(): HasMany
    {
        return $this->hasMany(CharacterTitulo::class);
    }

    public function tituloActivo(): HasOne
    {
        return $this->hasOne(CharacterTitulo::class)->where('activo', true);
    }

    public function medallas(): HasMany
    {
        return $this->hasMany(CharacterMedalla::class);
    }

    public function medallaActiva(): HasOne
    {
        return $this->hasOne(CharacterMedalla::class)->where('activo', true);
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
                'dano_perforante' => $sable->dano_perforante,
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
                'dano_perforante' => $arma->dano_perforante ?? 0,
                'critico' => 0,
                'es_sable' => false,
                'color_hoja' => null,
                'imagen' => $arma->imagen,
            ];
        }

        return null;
    }

    /** Bonos activos del sable ensamblado/equipado sobre las 7 stats de combate y Fuerza. */
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

    /** Bonos de la armadura equipada: los de la armadura misma más los de sus 4 mejoras. */
    public function armaduraBonos(): array
    {
        $vacio = array_fill_keys(CharacterArmadura::BONO_STATS, 0);

        $armadura = $this->relationLoaded('armaduraActiva')
            ? $this->armaduraActiva
            : $this->armaduraActiva()->with(array_merge(['objeto'], CharacterArmadura::MEJORA_SLOTS))->first();

        return $armadura ? $armadura->bonos : $vacio;
    }

    /**
     * Bonos totales del equipo del personaje (sable armado + armadura equipada).
     * Punto único de suma: cualquier equipable que bonifique stats se agrega aquí.
     */
    public function equipoBonos(): array
    {
        $sable = $this->sableBonos();
        $armadura = $this->armaduraBonos();

        return collect($sable)
            ->map(fn ($valor, $stat) => (int) $valor + (int) ($armadura[$stat] ?? 0))
            ->all();
    }

    /**
     * Estadísticas efectivas de combate del personaje.
     * Toma las 7 columnas persistidas en `characters` y les suma los bonos del equipo
     * (sable activo + armadura equipada con sus mejoras).
     */
    public function combatStats(): array
    {
        $cap = max(1, (int) Configuracion::valor('cap_stats_items', 15));
        $bonos = $this->equipoBonos();

        $stats = [
            'vida' => (int) ($this->vida ?? 8) + (int) ($bonos['vida'] ?? 0),
            'escudo' => (int) ($this->escudo ?? 4) + (int) ($bonos['escudo'] ?? 0),
            'ataque' => (int) ($this->ataque ?? 2) + (int) ($bonos['ataque'] ?? 0),
            'defensa' => (int) ($this->defensa ?? 2) + (int) ($bonos['defensa'] ?? 0),
            'movimiento' => (int) ($this->movimiento ?? 2) + (int) ($bonos['movimiento'] ?? 0),
            'iniciativa' => (int) ($this->iniciativa ?? 2) + (int) ($bonos['iniciativa'] ?? 0),
            'punteria' => (int) ($this->punteria ?? 2) + (int) ($bonos['punteria'] ?? 0),
        ];

        // Vida y escudo no comparten el tope de las 5 stats tácticas: la vida tiene 2 más
        // (más aguante), y el escudo tiene 2 menos y puede llegar a 0 (personajes sin escudo).
        foreach ($stats as $key => $value) {
            $stats[$key] = match ($key) {
                'vida' => max(1, min($cap + 2, $value)),
                'escudo' => max(0, min(max(0, $cap - 2), $value)),
                default => max(1, min($cap, $value)),
            };
        }

        return $stats;
    }

    /**
     * Formas con al menos un slot de habilidad asignado, o sea las que el personaje tiene
     * "aprendidas". Son las únicas a las que puede cambiar de estancia: una forma sin slots no
     * aporta habilidades, así que se trata como no aprendida y no es seleccionable.
     *
     * @return list<int> números de forma (1-7), ordenados
     */
    public function formasAprendidas(): array
    {
        $porForma = is_array($this->habilidades_por_forma) ? $this->habilidades_por_forma : [];

        return collect($porForma)
            ->filter(fn ($slots) => is_array($slots) && count(array_filter($slots)) > 0)
            ->keys()
            ->map(fn ($forma) => (int) $forma)
            ->filter(fn (int $forma) => $forma >= 1 && $forma <= 7)
            ->sort()
            ->values()
            ->all();
    }

    /**
     * Iniciativa que entra en la tirada de cambio de estancia (ver App\Support\Combat\TiradaEstancia),
     * con los topes FIJOS de esa mecánica -deliberadamente NO usan Configuracion, a diferencia de
     * combatStats()-: 4 por asignación, 5 sumando equipo. El tope de 7 con buffs se aplica en cada
     * sistema de combate, que es donde viven los buffs (por eso este valor es "pre-buff").
     */
    public function iniciativaEstancia(): int
    {
        $base = min(self::INI_ESTANCIA_CAP_ASIGNACION, (int) ($this->iniciativa ?? 2));

        return min(
            self::INI_ESTANCIA_CAP_EQUIPO,
            $base + (int) ($this->equipoBonos()['iniciativa'] ?? 0)
        );
    }

    public function statsTemporadas(): HasManyThrough
    {
        return $this->hasManyThrough(StatsTemporada::class, User::class, 'id', 'user_id', 'user_id', 'id');
    }
}
