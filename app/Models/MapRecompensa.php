<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\MorphTo;

/** Recompensa de combate configurable en un NPC (tipo jefe) o Enemigo: ver RecompensaRollService. */
class MapRecompensa extends Model
{
    protected $table = 'map_recompensas';

    protected $fillable = [
        'dropable_type',
        'dropable_id',
        'tipo',
        'porcentaje',
        'valor',
        'nombre',
        'habilidad_id',
        'objeto_id',
        'medalla_id',
    ];

    protected $casts = [
        'porcentaje' => 'integer',
        'valor' => 'integer',
    ];

    public function dropable(): MorphTo
    {
        return $this->morphTo();
    }

    public function habilidad(): BelongsTo
    {
        return $this->belongsTo(RolHabilidad::class, 'habilidad_id');
    }

    public function objeto(): BelongsTo
    {
        return $this->belongsTo(RolObjeto::class, 'objeto_id');
    }

    public function medalla(): BelongsTo
    {
        return $this->belongsTo(Medalla::class, 'medalla_id');
    }
}
