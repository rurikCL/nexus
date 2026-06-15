<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Character extends Model
{
    protected $fillable = [
        'user_id', 'name', 'handle', 'bio', 'photo', 'cls', 'saber_color', 'side',
        'sector', 'sponsor', 'joined_year', 'credits', 'wins', 'losses',
        'streak', 'stats', 'gold',
    ];

    protected $casts = [
        'stats' => 'array',
        'gold'  => 'boolean',
    ];

    protected $appends = ['winrate'];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    protected function winrate(): Attribute
    {
        return Attribute::make(
            get: function () {
                $total = ($this->wins ?? 0) + ($this->losses ?? 0);
                if ($total === 0) return 0;
                return round($this->wins / $total * 100);
            }
        );
    }
}
