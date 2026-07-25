<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class DungeonRun extends Model
{
    protected $table = 'dungeon_runs';

    protected $fillable = [
        'dungeon_template_id',
        'creado_por_id',
        'seed',
        'estado',
        'iniciado_at',
        'completado_at',
    ];

    protected $casts = [
        'seed' => 'integer',
        'iniciado_at' => 'datetime',
        'completado_at' => 'datetime',
    ];

    public function creadoPor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'creado_por_id');
    }

    public function template(): BelongsTo
    {
        return $this->belongsTo(DungeonTemplate::class, 'dungeon_template_id');
    }

    public function salas(): HasMany
    {
        return $this->hasMany(DungeonSala::class);
    }

    public function jugadores(): HasMany
    {
        return $this->hasMany(DungeonRunPlayer::class);
    }

    public function enEspera(): bool
    {
        return $this->estado === 'esperando';
    }

    public function enCurso(): bool
    {
        return $this->estado === 'en_curso';
    }
}
