<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class TrainingDay extends Model
{
    protected $fillable = ['user_id', 'training_id', 'type', 'date', 'focus', 'effort', 'note', 'tags'];

    protected $casts = [
        'tags' => 'array',
        'date' => 'date:Y-m-d',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function media(): HasMany
    {
        return $this->hasMany(TrainingMedia::class);
    }
}
