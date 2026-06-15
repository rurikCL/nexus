<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;

class MapNpcEspacio extends Model
{
    use SoftDeletes;

    protected $table = 'map_npcs_espacio';

    protected $fillable = [
        'SistemaID',
        'nombre',
        'tipo',
        'NaveID',
        'NpcID',
        'cargamento',
        'hostilidad',
        'saludo',
        'interaccion',
        'MisionID',
        'urlInteraccion',
        'visible',
    ];

    protected $casts = [
        'visible' => 'boolean',
    ];

    public function sistema(): BelongsTo
    {
        return $this->belongsTo(MapSistema::class, 'SistemaID');
    }

    public function nave(): BelongsTo
    {
        return $this->belongsTo(MapNave::class, 'NaveID');
    }

    public function npc(): BelongsTo
    {
        return $this->belongsTo(MapNpc::class, 'NpcID');
    }
}
