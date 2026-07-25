<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class DungeonRunPlayer extends Model
{
    protected $table = 'dungeon_run_players';

    protected $fillable = [
        'dungeon_run_id',
        'user_id',
        'listo',
        'sala_actual_id',
        'estado',
    ];

    protected $casts = [
        'listo' => 'boolean',
    ];

    public function run(): BelongsTo
    {
        return $this->belongsTo(DungeonRun::class, 'dungeon_run_id');
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function salaActual(): BelongsTo
    {
        return $this->belongsTo(DungeonSala::class, 'sala_actual_id');
    }

    public function progresos(): HasMany
    {
        return $this->hasMany(DungeonSalaProgreso::class);
    }

    public function activo(): bool
    {
        return $this->estado === 'activo';
    }
}
