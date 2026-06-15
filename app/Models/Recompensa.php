<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Recompensa extends Model
{
    protected $table = 'recompensas';

    protected $fillable = [
        'nombre',
        'descripcion',
        'tipo',
        'valor',
        'imagen',
    ];

    public function misiones(): HasMany
    {
        return $this->hasMany(Mision::class, 'recompensa_id');
    }
}
