<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class MapLugar extends Model
{
    use SoftDeletes;

    protected $table = 'map_lugares';

    protected $fillable = [
        'ZonaID',
        'nombre',
        'rareza',
        'tipo',
        'pase',
        'lugarNorteID',
        'lugarSurID',
        'lugarEsteID',
        'lugarOesteID',
        'imagen',
        'historia',
        'visible',
    ];

    protected $casts = [
        'visible' => 'boolean',
        'pase' => 'integer',
    ];

    public function zona(): BelongsTo
    {
        return $this->belongsTo(MapZona::class, 'ZonaID');
    }

    public function norte(): BelongsTo
    {
        return $this->belongsTo(MapLugar::class, 'lugarNorteID');
    }

    public function sur(): BelongsTo
    {
        return $this->belongsTo(MapLugar::class, 'lugarSurID');
    }

    public function este(): BelongsTo
    {
        return $this->belongsTo(MapLugar::class, 'lugarEsteID');
    }

    public function oeste(): BelongsTo
    {
        return $this->belongsTo(MapLugar::class, 'lugarOesteID');
    }

    public function npcs(): HasMany
    {
        return $this->hasMany(MapNpc::class, 'LugarID');
    }
}
