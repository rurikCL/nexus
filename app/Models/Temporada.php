<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Temporada extends Model
{
    protected $fillable = [
        'nombre', 'descripcion', 'foto_emblema',
        'divide_por_rango', 'asignacion_automatica',
        'periodo_inicio', 'periodo_fin',
        'primer_lugar_id', 'segundo_lugar_id', 'tercer_lugar_id',
    ];

    protected $casts = [
        'periodo_inicio'        => 'date',
        'periodo_fin'           => 'date',
        'divide_por_rango'      => 'boolean',
        'asignacion_automatica' => 'boolean',
    ];

    public function primerLugar(): BelongsTo
    {
        return $this->belongsTo(User::class, 'primer_lugar_id');
    }

    public function segundoLugar(): BelongsTo
    {
        return $this->belongsTo(User::class, 'segundo_lugar_id');
    }

    public function tercerLugar(): BelongsTo
    {
        return $this->belongsTo(User::class, 'tercer_lugar_id');
    }

    public function recompensas(): HasMany
    {
        return $this->hasMany(TemporadaRecompensa::class);
    }

    public function podios(): HasMany
    {
        return $this->hasMany(TemporadaPodio::class);
    }
}
