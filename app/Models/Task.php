<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Task extends Model
{
    protected $fillable = [
        'tutor_id', 'pupil_id', 'title', 'detail',
        'due_date', 'progress', 'status', 'reward',
    ];

    protected $casts = [
        'due_date' => 'date:Y-m-d',
    ];

    public function tutor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'tutor_id');
    }

    public function pupil(): BelongsTo
    {
        return $this->belongsTo(User::class, 'pupil_id');
    }
}
