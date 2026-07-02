<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CharacterHito extends Model
{
    protected $table = 'character_hitos';

    protected $fillable = ['character_id', 'hito'];

    public function character(): BelongsTo
    {
        return $this->belongsTo(Character::class);
    }
}
