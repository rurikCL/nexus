<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** Medalla que un personaje ganó (recompensa de misión tipo "insignia"). Como máximo una activa a la vez. */
class CharacterMedalla extends Model
{
    protected $table = 'character_medallas';

    protected $fillable = [
        'character_id',
        'medalla_id',
        'mision_id',
        'activo',
    ];

    protected $casts = [
        'activo' => 'boolean',
    ];

    public function character(): BelongsTo
    {
        return $this->belongsTo(Character::class);
    }

    public function medalla(): BelongsTo
    {
        return $this->belongsTo(Medalla::class);
    }

    public function mision(): BelongsTo
    {
        return $this->belongsTo(Mision::class);
    }
}
