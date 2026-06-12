<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Bet extends Model
{
    protected $fillable = ['user_id', 'combat_id', 'pick', 'amount', 'odds', 'status'];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function combat(): BelongsTo
    {
        return $this->belongsTo(Combat::class);
    }
}
