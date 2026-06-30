<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

class RolObjeto extends Model
{
    protected $table = 'rol_objetos';

    protected $fillable = [
        'nombre',
        'tipo',
        'rareza',
        'descripcion',
        'efecto',
        'imagen',
        'costo',
        'activo',
    ];

    protected $casts = [
        'activo' => 'boolean',
    ];

    public function characters(): BelongsToMany
    {
        return $this->belongsToMany(Character::class, 'rol_character_objeto')
            ->withTimestamps();
    }
}

