<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Objetivo extends Model
{
    protected $table = 'objetivos';

    protected $fillable = [
        'nombre',
        'descripcion',
        'tipo',
        'meta',
        'unidad',
    ];

    public function misiones(): HasMany
    {
        return $this->hasMany(Mision::class, 'objetivo_id');
    }
}
