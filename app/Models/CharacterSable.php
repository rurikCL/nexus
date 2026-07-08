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
}
