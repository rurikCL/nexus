<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

class Mision extends Model
{
    protected $table = 'misiones';

    protected $fillable = [
        'nombre',
        'mision',
        'descripcion',
        'foto_mision',
        'recompensa_id',
        'fecha_inicio',
        'fecha_termino',
        'objetivo_id',
    ];

    protected $casts = [
        'fecha_inicio'  => 'date',
        'fecha_termino' => 'date',
    ];

    public function users(): BelongsToMany
    {
        return $this->belongsToMany(User::class, 'mision_user')
            ->withPivot(['status', 'progreso'])
            ->withTimestamps();
    }

    public function recompensa(): BelongsTo
    {
        return $this->belongsTo(Recompensa::class, 'recompensa_id');
    }

    public function objetivo(): BelongsTo
    {
        return $this->belongsTo(Objetivo::class, 'objetivo_id');
    }
}
