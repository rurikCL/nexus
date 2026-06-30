<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class MapPlaneta extends Model
{
    use SoftDeletes;

    protected $table = 'map_planetas';

    protected $fillable = [
        'SistemaID',
        'nombre',
        'rareza',
        'clima',
        'hostilidad',
        'faccion',
        'imagen',
        'historia',
        'eventos_importantes',
        'visible',
    ];

    protected $casts = [
        'visible' => 'boolean',
    ];

    public function sistema(): BelongsTo
    {
        return $this->belongsTo(MapSistema::class, 'SistemaID');
    }

    public function zonas(): HasMany
    {
        return $this->hasMany(MapZona::class, 'PlanetaID');
    }

    public function presentesPersonajes(): HasMany
    {
        return $this->hasMany(Character::class, 'map_planeta_id');
    }
}
