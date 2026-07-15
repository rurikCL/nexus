<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class TradeRequest extends Model
{
    protected $fillable = [
        'initiator_id', 'target_id', 'status',
        'offer_items', 'offer_credits', 'request_credits',
    ];

    protected $casts = [
        'initiator_id'    => 'integer',
        'target_id'       => 'integer',
        'offer_items'     => 'array',
        'offer_credits'   => 'integer',
        'request_credits' => 'integer',
    ];

    public function initiator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'initiator_id');
    }

    public function target(): BelongsTo
    {
        return $this->belongsTo(User::class, 'target_id');
    }

    public function involvedUser(int $userId): bool
    {
        return $this->initiator_id === $userId || $this->target_id === $userId;
    }
}
