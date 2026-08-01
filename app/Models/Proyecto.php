<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * Petición de proyecto a los Sentinelas. Flujo: pendiente -> (aprobar: fija
 * responsable_id + eta) en_curso -> completado | cancelado, o pendiente ->
 * rechazada. Ver ProyectoController para las reglas de quién puede ver/gestionar.
 */
class Proyecto extends Model
{
    protected $table = 'proyectos';

    protected $fillable = [
        'solicitante_id', 'titulo', 'descripcion', 'imagen', 'status',
        'responsable_id', 'eta', 'aprobado_por_id',
    ];

    protected $casts = [
        'eta' => 'date',
    ];

    public function solicitante(): BelongsTo
    {
        return $this->belongsTo(User::class, 'solicitante_id');
    }

    public function responsable(): BelongsTo
    {
        return $this->belongsTo(User::class, 'responsable_id');
    }

    public function aprobadoPor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'aprobado_por_id');
    }

    public function mensajes(): HasMany
    {
        return $this->hasMany(ProyectoMensaje::class)->orderBy('created_at');
    }
}
