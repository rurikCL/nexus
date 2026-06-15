<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Character extends Model
{
    protected $fillable = [
        'user_id', 'name', 'handle', 'bio', 'photo', 'cls', 'saber_color', 'side',
        'sector', 'sponsor', 'joined_year', 'credits', 'stats', 'gold',
    ];

    protected $casts = [
        'stats' => 'array',
        'gold'  => 'boolean',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function statsTemporadas(): \Illuminate\Database\Eloquent\Relations\HasManyThrough
    {
        return $this->hasManyThrough(StatsTemporada::class, User::class, 'id', 'user_id', 'user_id', 'id');
    }
}
