<?php
namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Training extends Model
{
    protected $fillable = ['titulo', 'fecha', 'created_by', 'closed_at', 'closed_by'];

    protected $casts = [
        'fecha'     => 'date:Y-m-d',
        'closed_at' => 'datetime',
    ];

    public function createdBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function closedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'closed_by');
    }

    public function encargados(): BelongsToMany
    {
        return $this->belongsToMany(User::class, 'training_encargados');
    }

    public function planNodes(): HasMany
    {
        return $this->hasMany(TrainingPlanNode::class)->orderBy('orden');
    }

    public function attendance(): HasMany
    {
        return $this->hasMany(TrainingDay::class)->where('type', 'personal');
    }

    public function isClosed(): bool
    {
        return $this->closed_at !== null;
    }
}
