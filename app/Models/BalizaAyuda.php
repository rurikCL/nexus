<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** Baliza de ayuda activa, desplegada por un jugador desde el Mapa (ver BalizaController). */
class BalizaAyuda extends Model
{
    protected $table = 'balizas_ayuda';

    protected $fillable = [
        'user_id',
        'character_id',
        'rol_objeto_id',
        'nombre',
        'map_sistema_id',
        'map_planeta_id',
        'map_zona_id',
        'map_lugar_id',
        'expires_at',
    ];

    protected $casts = [
        'expires_at' => 'datetime',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function character(): BelongsTo
    {
        return $this->belongsTo(Character::class);
    }

    public function rolObjeto(): BelongsTo
    {
        return $this->belongsTo(RolObjeto::class);
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

    public function scopeActivas(Builder $query): Builder
    {
        return $query->where('expires_at', '>', now());
    }

    /** Shape compartido entre el widget global de Comando y la card desplegada en el Mapa. */
    public function toAlertArray(?int $viewerUserId = null): array
    {
        return [
            'id' => $this->id,
            'nombre' => $this->nombre,
            'imagen' => $this->rolObjeto?->imagen,
            'creador' => $this->character?->handle ?? $this->character?->name ?? $this->user?->name,
            'is_mine' => $viewerUserId !== null && $this->user_id === $viewerUserId,
            'sistema_id' => $this->map_sistema_id,
            'sistema_nombre' => $this->mapSistema?->nombre,
            'planeta_nombre' => $this->mapPlaneta?->nombre,
            'zona_nombre' => $this->mapZona?->nombre,
            'lugar_nombre' => $this->mapLugar?->nombre,
            'ubicacion' => collect([$this->mapSistema?->nombre, $this->mapPlaneta?->nombre, $this->mapZona?->nombre, $this->mapLugar?->nombre])
                ->filter()->implode(' › '),
            'expires_at' => $this->expires_at->toISOString(),
            'segundos_restantes' => max(0, (int) now()->diffInSeconds($this->expires_at, false)),
        ];
    }
}
