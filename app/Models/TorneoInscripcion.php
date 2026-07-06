<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class TorneoInscripcion extends Model
{
    protected $table = 'torneo_inscripciones';

    protected $fillable = [
        'torneo_id',
        'user_id',
        'estado',
        'seed',
    ];

    public function torneo(): BelongsTo
    {
        return $this->belongsTo(Torneo::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
