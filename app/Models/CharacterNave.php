<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CharacterNave extends Model
{
    protected $table = 'character_naves';

    protected $fillable = [
        'character_id',
        'nave_id',
        'combustible_actual',
        'vida_actual',
        'escudo_actual',
    ];

    protected $casts = [
        'combustible_actual' => 'integer',
        'vida_actual'        => 'integer',
        'escudo_actual'      => 'integer',
    ];

    public function character(): BelongsTo
    {
        return $this->belongsTo(Character::class);
    }

    public function nave(): BelongsTo
    {
        return $this->belongsTo(MapNave::class, 'nave_id');
    }
}
