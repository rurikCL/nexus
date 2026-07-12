<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PirataEncuentro extends Model
{
    protected $table = 'pirata_encuentros';

    protected $fillable = ['character_id', 'nave_id', 'resuelto', 'credits_awarded'];

    protected $casts = [
        'resuelto'        => 'boolean',
        'credits_awarded' => 'integer',
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
