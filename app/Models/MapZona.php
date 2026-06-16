<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class MapZona extends Model
{
    use SoftDeletes;

    protected $table = 'map_zonas';

    protected $fillable = [
        'PlanetaID',
        'nombre',
        'rareza',
        'faccion',
        'hostilidad',
        'estrato_social',
        'impuestos',
        'imagen',
        'historia',
        'visible',
    ];

    protected $casts = [
        'visible' => 'boolean',
        'impuestos' => 'decimal:2',
    ];

    public function planeta(): BelongsTo
    {
        return $this->belongsTo(MapPlaneta::class, 'PlanetaID');
    }

    public function lugares(): HasMany
    {
        return $this->hasMany(MapLugar::class, 'ZonaID');
    }

    public function presentesPersonajes(): HasMany
    {
        return $this->hasMany(Character::class, 'map_zona_id');
    }
}
