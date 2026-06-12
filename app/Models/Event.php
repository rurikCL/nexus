<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

class Event extends Model
{
    protected $fillable = [
        'name', 'type', 'status', 'event_date', 'location',
        'reward', 'reward_badge', 'capacity', 'banner', 'description',
    ];

    protected $casts = [
        'event_date' => 'datetime',
    ];

    public function registrations(): BelongsToMany
    {
        return $this->belongsToMany(User::class, 'event_registrations')
            ->withPivot('claimed')
            ->withTimestamps();
    }
}
