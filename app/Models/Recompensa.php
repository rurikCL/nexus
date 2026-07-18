<?php

namespace App\Models;

use App\Models\RolHabilidad;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Recompensa extends Model
{
    protected $table = 'recompensas';

    protected $fillable = [
        'mision_id',
        'nombre',
        'descripcion',
        'tipo',
        'valor',
        'imagen',
        'habilidad_id',
        'objeto_id',
        'hito',
    ];

    public function mision(): BelongsTo
    {
        return $this->belongsTo(Mision::class, 'mision_id');
    }

    public function habilidad(): BelongsTo
    {
        return $this->belongsTo(RolHabilidad::class, 'habilidad_id');
    }

    public function objeto(): BelongsTo
    {
        return $this->belongsTo(RolObjeto::class, 'objeto_id');
    }

    public function misiones(): HasMany
    {
        return $this->hasMany(Mision::class, 'recompensa_id');
    }
}
