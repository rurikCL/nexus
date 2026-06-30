<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class RolHabilidadAprendida extends Model
{
    protected $table = 'rol_habilidades_aprendidas';

    protected $fillable = ['user_id', 'habilidad_id'];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function habilidad(): BelongsTo
    {
        return $this->belongsTo(RolHabilidad::class, 'habilidad_id');
    }
}
