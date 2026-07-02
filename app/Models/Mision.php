<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Mision extends Model
{
    protected $table = 'misiones';

    protected $fillable = [
        'nombre',
        'mision',
        'descripcion',
        'foto_mision',
        'tipo_mision',
        'temporada_id',
        'npc_id',
        'puntos_requeridos',
        'activa',
        'orden',
        'fecha_inicio',
        'fecha_termino',
        'hito_requerimiento',
        'entregar_hito',
        // Legacy single FK columns (kept for backwards compat)
        'recompensa_id',
        'objetivo_id',
    ];

    protected $casts = [
        'fecha_inicio'      => 'date',
        'fecha_termino'     => 'date',
        'activa'            => 'boolean',
        'puntos_requeridos' => 'integer',
        'orden'             => 'integer',
    ];

    // ── Relations ─────────────────────────────────────────────────────────────

    public function users(): BelongsToMany
    {
        return $this->belongsToMany(User::class, 'mision_user')
            ->withPivot(['status', 'progreso', 'progreso_json'])
            ->withTimestamps();
    }

    public function objetivos(): HasMany
    {
        return $this->hasMany(Objetivo::class, 'mision_id');
    }

    public function recompensas(): HasMany
    {
        return $this->hasMany(Recompensa::class, 'mision_id');
    }

    public function temporada(): BelongsTo
    {
        return $this->belongsTo(Temporada::class, 'temporada_id');
    }

    public function npc(): BelongsTo
    {
        return $this->belongsTo(MapNpc::class, 'npc_id');
    }

    // Legacy single-FK relations kept for backwards compat
    public function recompensa(): BelongsTo
    {
        return $this->belongsTo(Recompensa::class, 'recompensa_id');
    }

    public function objetivo(): BelongsTo
    {
        return $this->belongsTo(Objetivo::class, 'objetivo_id');
    }
}
