<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class WidgetLayout extends Model
{
    protected $fillable = ['user_id', 'section', 'widgets'];

    protected $casts = ['widgets' => 'array'];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
