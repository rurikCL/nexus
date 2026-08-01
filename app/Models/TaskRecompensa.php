<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** Recompensa estructurada de una Tarea — solo creditos/objeto/habilidad (ver migración). */
class TaskRecompensa extends Model
{
    protected $table = 'task_recompensas';

    protected $fillable = [
        'task_id',
        'nombre',
        'descripcion',
        'tipo',
        'valor',
        'imagen',
        'habilidad_id',
        'objeto_id',
    ];

    protected $casts = [
        'valor' => 'integer',
    ];

    public function task(): BelongsTo
    {
        return $this->belongsTo(Task::class);
    }

    public function habilidad(): BelongsTo
    {
        return $this->belongsTo(RolHabilidad::class, 'habilidad_id');
    }

    public function objeto(): BelongsTo
    {
        return $this->belongsTo(RolObjeto::class, 'objeto_id');
    }
}
