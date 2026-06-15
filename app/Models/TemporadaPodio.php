<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class TemporadaPodio extends Model
{
    protected $fillable = [
        'temporada_id', 'rango',
        'primer_lugar_id', 'segundo_lugar_id', 'tercer_lugar_id',
    ];

    public function temporada(): BelongsTo
    {
        return $this->belongsTo(Temporada::class);
    }

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
}
