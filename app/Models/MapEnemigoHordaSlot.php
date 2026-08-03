<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Un slot de la composición de un enemigo tipo 'horda' — ver migración
 * create_map_enemigo_horda_slots_table y MapEnemigo::hordaSlots().
 */
class MapEnemigoHordaSlot extends Model
{
    protected $table = 'map_enemigo_horda_slots';

    protected $fillable = [
        'horda_id',
        'enemigo_id',
        'nivel',
    ];

    protected $casts = [
        'nivel' => 'integer',
    ];

    public function horda(): BelongsTo
    {
        return $this->belongsTo(MapEnemigo::class, 'horda_id');
    }

    public function enemigo(): BelongsTo
    {
        return $this->belongsTo(MapEnemigo::class, 'enemigo_id');
    }
}
