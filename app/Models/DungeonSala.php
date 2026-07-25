<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class DungeonSala extends Model
{
    protected $table = 'dungeon_salas';

    protected $fillable = [
        'dungeon_run_id',
        'tipo',
        'norte_id',
        'sur_id',
        'este_id',
        'oeste_id',
        'enemigo_id',
        'nivel_enemigo',
        'pos_x',
        'pos_y',
        'tiene_cofre',
    ];

    protected $casts = [
        'nivel_enemigo' => 'integer',
        'pos_x' => 'integer',
        'pos_y' => 'integer',
        'tiene_cofre' => 'boolean',
    ];

    public function run(): BelongsTo
    {
        return $this->belongsTo(DungeonRun::class, 'dungeon_run_id');
    }

    public function norte(): BelongsTo
    {
        return $this->belongsTo(DungeonSala::class, 'norte_id');
    }

    public function sur(): BelongsTo
    {
        return $this->belongsTo(DungeonSala::class, 'sur_id');
    }

    public function este(): BelongsTo
    {
        return $this->belongsTo(DungeonSala::class, 'este_id');
    }

    public function oeste(): BelongsTo
    {
        return $this->belongsTo(DungeonSala::class, 'oeste_id');
    }

    public function enemigo(): BelongsTo
    {
        return $this->belongsTo(MapEnemigo::class, 'enemigo_id');
    }

    public function progresos(): HasMany
    {
        return $this->hasMany(DungeonSalaProgreso::class);
    }

    public function esJefe(): bool
    {
        return $this->tipo === 'jefe';
    }
}
