<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class TaskUpdateFile extends Model
{
    protected $fillable = ['task_update_id', 'path', 'original_name', 'type'];

    public function taskUpdate(): BelongsTo
    {
        return $this->belongsTo(TaskUpdate::class);
    }
}
