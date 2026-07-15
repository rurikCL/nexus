<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CharacterTitulo extends Model
{
    protected $table = 'character_titulos';

    protected $fillable = [
        'character_id',
        'nombre',
        'tipo',
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

    public function mision(): BelongsTo
    {
        return $this->belongsTo(Mision::class);
    }
}
