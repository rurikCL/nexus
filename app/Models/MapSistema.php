<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class MapSistema extends Model
{
    use SoftDeletes;

    protected $table = 'map_sistemas';

    protected $fillable = [
        'nombre',
        'rareza',
        'hostilidad',
        'faccion',
        'color',
        'imagen',
        'historia',
        'costo_viaje',
        'visible',
    ];

    protected $casts = [
        'visible' => 'boolean',
        'costo_viaje' => 'integer',
    ];

    public function planetas(): HasMany
    {
        return $this->hasMany(MapPlaneta::class, 'SistemaID');
    }

    public function npcsEspacio(): HasMany
    {
        return $this->hasMany(MapNpcEspacio::class, 'SistemaID');
    }

    public function presentesPersonajes(): HasMany
    {
        return $this->hasMany(Character::class, 'map_sistema_id');
    }
}
