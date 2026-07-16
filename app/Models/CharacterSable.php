<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CharacterSable extends Model
{
    protected $table = 'character_sables';

    protected $fillable = [
        'character_id',
        'nombre',
        'activo',
        'nucleo_id',
        'cristal_id',
        'lente_id',
        'emisor_id',
        'estabilizador_id',
        'empunadura_id',
        'modulo_id',
        'accesorio_id',
    ];

    protected $casts = [
        'activo' => 'boolean',
    ];

    protected $appends = ['dano', 'dano_perforante', 'critico', 'tipo_ataque', 'color_hoja', 'consumo_energia', 'energia_maxima'];

    /** Daño base del ataque cuerpo a cuerpo con un sable de luz armado. */
    const DANO_BASE = 6;

    /**
     * Mapa slot => tipo de rol_objeto esperado en ese slot.
     */
    const SLOTS = [
        'nucleo'        => 'nucleo_energia',
        'cristal'       => 'cristal',
        'lente'         => 'lente_enfoque',
        'emisor'        => 'emisor',
        'estabilizador' => 'estabilizador',
        'empunadura'    => 'empunadura',
        'modulo'        => 'modulo_activacion',
        'accesorio'     => 'accesorio',
    ];

    public function character(): BelongsTo
    {
        return $this->belongsTo(Character::class);
    }

    public function nucleo(): BelongsTo
    {
        return $this->belongsTo(RolObjeto::class, 'nucleo_id');
    }

    public function cristal(): BelongsTo
    {
        return $this->belongsTo(RolObjeto::class, 'cristal_id');
    }

    public function lente(): BelongsTo
    {
        return $this->belongsTo(RolObjeto::class, 'lente_id');
    }

    public function emisor(): BelongsTo
    {
        return $this->belongsTo(RolObjeto::class, 'emisor_id');
    }

    public function estabilizador(): BelongsTo
    {
        return $this->belongsTo(RolObjeto::class, 'estabilizador_id');
    }

    public function empunadura(): BelongsTo
    {
        return $this->belongsTo(RolObjeto::class, 'empunadura_id');
    }

    public function modulo(): BelongsTo
    {
        return $this->belongsTo(RolObjeto::class, 'modulo_id');
    }

    public function accesorio(): BelongsTo
    {
        return $this->belongsTo(RolObjeto::class, 'accesorio_id');
    }

    public function sumaBono(string $campo): int
    {
        return collect(array_keys(self::SLOTS))->sum(fn ($slot) => $this->{$slot}?->{$campo} ?? 0);
    }

    /** Daño base más el bono de daño de los componentes instalados. */
    public function getDanoAttribute(): int
    {
        return self::DANO_BASE + $this->sumaBono('bono_dano');
    }

    /** Daño perforante: solo lo que aportan los componentes instalados (sin base). */
    public function getDanoPerforanteAttribute(): int
    {
        return $this->sumaBono('bono_dano_perforante');
    }

    /**
     * Crítico (CRT): cuánto se resta a 20 para el umbral de golpe crítico.
     * CRT 2 = crítico con 20, 19 o 18 natural en el dado de ataque.
     */
    public function getCriticoAttribute(): int
    {
        return $this->sumaBono('bono_critico');
    }

    public function getTipoAtaqueAttribute(): string
    {
        return 'melee';
    }

    /** Color de la hoja, heredado del cristal Kyber instalado. */
    public function getColorHojaAttribute(): ?string
    {
        return $this->cristal?->color_hoja;
    }

    /** Energía total que consumen los componentes instalados. */
    public function getConsumoEnergiaAttribute(): int
    {
        return $this->sumaBono('consumo_energia');
    }

    /** Energía máxima que el sable puede soportar, definida por el Núcleo de Energía instalado. */
    public function getEnergiaMaximaAttribute(): int
    {
        return $this->nucleo?->energia_maxima ?? 0;
    }
}
