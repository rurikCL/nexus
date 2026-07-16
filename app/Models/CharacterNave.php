<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CharacterNave extends Model
{
    protected $table = 'character_naves';

    protected $fillable = [
        'character_id',
        'nave_id',
        'combustible_actual',
        'vida_actual',
        'escudo_actual',
        'mejora_1_id',
        'mejora_2_id',
        'mejora_3_id',
        'mejora_4_id',
    ];

    protected $casts = [
        'combustible_actual' => 'integer',
        'vida_actual' => 'integer',
        'escudo_actual' => 'integer',
    ];

    /* Máximos ya incluyendo las mejoras instaladas — se calculan al vuelo (ver
     * accessors abajo) para que el frontend (hangar, HUD de combate) no tenga
     * que reimplementar la suma de bonos. */
    protected $appends = [
        'vida_max', 'escudo_max', 'capacidad_carga_max', 'capacidad_salto_max', 'costo_reparacion_final',
        'ataque_efectivo', 'velocidad_efectiva', 'maniobrabilidad_efectiva',
    ];

    /** Los 4 slots de mejora — cualquier slot acepta cualquier rol_objeto tipo "mejora_nave". */
    const MEJORA_SLOTS = ['mejora_1', 'mejora_2', 'mejora_3', 'mejora_4'];

    public function character(): BelongsTo
    {
        return $this->belongsTo(Character::class);
    }

    public function nave(): BelongsTo
    {
        return $this->belongsTo(MapNave::class, 'nave_id');
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

    /** Suma un campo de bono (bono_ataque, bono_capacidad_salto, etc.) entre las 4 mejoras instaladas. */
    public function sumaBono(string $campo): int
    {
        return collect(self::MEJORA_SLOTS)->sum(fn ($slot) => $this->{$slot}?->{$campo} ?? 0);
    }

    /** Reducción de cooldown (valor negativo o 0) que aportan las mejoras instaladas a una habilidad específica. */
    public function bonoCooldownParaHabilidad(int $habilidadId): int
    {
        return collect(self::MEJORA_SLOTS)
            ->map(fn ($slot) => $this->{$slot})
            ->filter(fn ($obj) => $obj && (int) $obj->mejora_habilidad_id === $habilidadId)
            ->sum(fn ($obj) => $obj->bono_cooldown ?? 0);
    }

    /** Vida máxima de la nave, incluyendo el bono de las mejoras instaladas. */
    public function maxVidaConMejoras(): int
    {
        return ($this->nave?->vida ?? 0) + $this->sumaBono('bono_vida');
    }

    /** Escudo máximo de la nave, incluyendo el bono de las mejoras instaladas. */
    public function maxEscudoConMejoras(): int
    {
        return ($this->nave?->escudo ?? 0) + $this->sumaBono('bono_escudo');
    }

    /** Capacidad de carga de la nave, incluyendo el bono de las mejoras instaladas. */
    public function capacidadCargaConMejoras(): int
    {
        return ($this->nave?->capacidad_carga ?? 0) + $this->sumaBono('bono_capacidad_carga');
    }

    /** Capacidad de salto de la nave, incluyendo el bono de las mejoras instaladas. */
    public function capacidadSaltoConMejoras(): int
    {
        return ($this->nave?->capacidad_salto ?? 0) + $this->sumaBono('bono_capacidad_salto');
    }

    /** Costo de reparación de la nave, reducido por el bono de las mejoras instaladas (mínimo 0). */
    public function costoReparacionConMejoras(): int
    {
        return max(0, ($this->nave?->costo_reparacion ?? 0) + $this->sumaBono('bono_costo_reparacion'));
    }

    /** Ataque de la nave, incluyendo el bono de las mejoras instaladas (reutiliza bono_ataque del sable). */
    public function ataqueConMejoras(): int
    {
        return ($this->nave?->ataque ?? 0) + $this->sumaBono('bono_ataque');
    }

    /** Velocidad de la nave (alimenta la iniciativa en combate), incluyendo el bono de las mejoras instaladas. */
    public function velocidadConMejoras(): int
    {
        return ($this->nave?->velocidad ?? 0) + $this->sumaBono('bono_iniciativa');
    }

    /** Maniobrabilidad de la nave (alimenta defensa y movimiento en combate), incluyendo el bono de
     *  las mejoras instaladas — un único stat de nave, así que suma tanto bono_defensa como
     *  bono_movimiento de las mejoras (igual que la maniobrabilidad base alimenta ambos roles). */
    public function maniobrabilidadConMejoras(): int
    {
        return ($this->nave?->maniobrabilidad ?? 0) + $this->sumaBono('bono_defensa') + $this->sumaBono('bono_movimiento');
    }

    public function getVidaMaxAttribute(): int
    {
        return $this->maxVidaConMejoras();
    }

    public function getEscudoMaxAttribute(): int
    {
        return $this->maxEscudoConMejoras();
    }

    public function getCapacidadCargaMaxAttribute(): int
    {
        return $this->capacidadCargaConMejoras();
    }

    public function getCapacidadSaltoMaxAttribute(): int
    {
        return $this->capacidadSaltoConMejoras();
    }

    public function getCostoReparacionFinalAttribute(): int
    {
        return $this->costoReparacionConMejoras();
    }

    public function getAtaqueEfectivoAttribute(): int
    {
        return $this->ataqueConMejoras();
    }

    public function getVelocidadEfectivaAttribute(): int
    {
        return $this->velocidadConMejoras();
    }

    public function getManiobrabilidadEfectivaAttribute(): int
    {
        return $this->maniobrabilidadConMejoras();
    }
}
