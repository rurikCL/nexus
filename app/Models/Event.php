<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Event extends Model
{
    protected $fillable = [
        'name', 'type', 'status', 'event_date', 'location', 'sede_id',
        'capacity', 'banner', 'description',
    ];

    protected $casts = [
        // Solo se captura la fecha (sin hora) desde el formulario — 'datetime' serializaba
        // con hora/zona (ej. "2026-08-01T00:00:00.000000Z"), lo que rompía el parseo en el
        // frontend (que concatena "T00:00:00" asumiendo un string plano "Y-m-d").
        'event_date' => 'date:Y-m-d',
    ];

    public function registrations(): BelongsToMany
    {
        return $this->belongsToMany(User::class, 'event_registrations')
            ->withPivot('claimed')
            ->withTimestamps();
    }

    public function sede(): BelongsTo
    {
        return $this->belongsTo(Sede::class);
    }

    public function recompensas(): HasMany
    {
        return $this->hasMany(EventoRecompensa::class);
    }
}
