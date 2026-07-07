<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
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
        'hito_requerimiento',
        'fecha_inicio',
        'fecha_fin',
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
        'fecha_inicio' => 'date',
        'fecha_fin' => 'date',
    ];

    public function lugar(): BelongsTo
    {
        return $this->belongsTo(MapLugar::class, 'LugarID');
    }

    public function mision(): BelongsTo
    {
        return $this->belongsTo(Mision::class, 'MisionID');
    }
}
