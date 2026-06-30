<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasManyThrough;

class Character extends Model
{
    protected $fillable = [
        'user_id', 'name', 'handle', 'bio', 'lore', 'photo', 'cls', 'saber_color', 'side',
        'sector', 'sponsor', 'joined_year', 'credits', 'reputation', 'stats', 'gold',
        'map_sistema_id', 'map_planeta_id', 'map_zona_id', 'map_lugar_id',
        'vida', 'escudo', 'defensa', 'ataque', 'movimiento', 'iniciativa', 'punteria', 'puntos_libres',
        'habilidad_1', 'habilidad_2', 'habilidad_3', 'habilidad_4',
    ];

    protected $casts = [
        'stats'          => 'array',
        'gold'           => 'boolean',
        'reputation'     => 'integer',
        'map_sistema_id' => 'integer',
        'map_planeta_id' => 'integer',
        'map_zona_id'    => 'integer',
        'map_lugar_id'   => 'integer',
        'vida'           => 'integer',
        'escudo'         => 'integer',
        'defensa'        => 'integer',
        'ataque'         => 'integer',
        'movimiento'     => 'integer',
        'iniciativa'     => 'integer',
        'punteria'       => 'integer',
        'puntos_libres'  => 'integer',
        'habilidad_1'    => 'integer',
        'habilidad_2'    => 'integer',
        'habilidad_3'    => 'integer',
        'habilidad_4'    => 'integer',
    ];

    public function getWinrateAttribute(): int
    {
        $total = ($this->wins ?? 0) + ($this->losses ?? 0);
        return $total > 0 ? (int) round($this->wins / $total * 100) : 0;
    }

    public function getTotalAttribute(): int
    {
        return ($this->wins ?? 0) + ($this->losses ?? 0);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function mapSistema(): BelongsTo
    {
        return $this->belongsTo(MapSistema::class, 'map_sistema_id');
    }

    public function mapPlaneta(): BelongsTo
    {
        return $this->belongsTo(MapPlaneta::class, 'map_planeta_id');
    }

    public function mapZona(): BelongsTo
    {
        return $this->belongsTo(MapZona::class, 'map_zona_id');
    }

    public function mapLugar(): BelongsTo
    {
        return $this->belongsTo(MapLugar::class, 'map_lugar_id');
    }

    public function habilidad1(): BelongsTo
    {
        return $this->belongsTo(RolHabilidad::class, 'habilidad_1');
    }

    public function habilidad2(): BelongsTo
    {
        return $this->belongsTo(RolHabilidad::class, 'habilidad_2');
    }

    public function habilidad3(): BelongsTo
    {
        return $this->belongsTo(RolHabilidad::class, 'habilidad_3');
    }

    public function habilidad4(): BelongsTo
    {
        return $this->belongsTo(RolHabilidad::class, 'habilidad_4');
    }

    public function rolObjetos(): BelongsToMany
    {
        return $this->belongsToMany(RolObjeto::class, 'rol_character_objeto')
            ->withTimestamps();
    }

    public function statsTemporadas(): \Illuminate\Database\Eloquent\Relations\HasManyThrough
    {
        return $this->hasManyThrough(StatsTemporada::class, User::class, 'id', 'user_id', 'user_id', 'id');
    }
}
