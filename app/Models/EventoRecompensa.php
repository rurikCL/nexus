<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** Recompensa estructurada de un Evento — mismo shape y mecanismo de otorgamiento que Recompensa (misiones). */
class EventoRecompensa extends Model
{
    protected $table = 'evento_recompensas';

    protected $fillable = [
        'event_id',
        'nombre',
        'descripcion',
        'tipo',
        'valor',
        'imagen',
        'habilidad_id',
        'objeto_id',
        'medalla_id',
    ];

    protected $casts = [
        'valor' => 'integer',
    ];

    public function event(): BelongsTo
    {
        return $this->belongsTo(Event::class);
    }

    public function habilidad(): BelongsTo
    {
        return $this->belongsTo(RolHabilidad::class, 'habilidad_id');
    }

    public function objeto(): BelongsTo
    {
        return $this->belongsTo(RolObjeto::class, 'objeto_id');
    }

    public function medalla(): BelongsTo
    {
        return $this->belongsTo(Medalla::class);
    }
}
