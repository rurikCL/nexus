<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
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
}
