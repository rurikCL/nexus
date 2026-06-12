<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class TrainingMedia extends Model
{
    protected $fillable = ['training_day_id', 'path', 'type'];

    public function trainingDay(): BelongsTo
    {
        return $this->belongsTo(TrainingDay::class);
    }
}
