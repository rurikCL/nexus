<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class DungeonSalaProgreso extends Model
{
    protected $table = 'dungeon_sala_progresos';

    protected $fillable = [
        'dungeon_run_player_id',
        'dungeon_sala_id',
        'visitada',
        'resuelta',
        'cofre_abierto',
    ];

    protected $casts = [
        'visitada' => 'boolean',
        'resuelta' => 'boolean',
        'cofre_abierto' => 'boolean',
    ];

    public function jugador(): BelongsTo
    {
        return $this->belongsTo(DungeonRunPlayer::class, 'dungeon_run_player_id');
    }

    public function sala(): BelongsTo
    {
        return $this->belongsTo(DungeonSala::class, 'dungeon_sala_id');
    }
}
