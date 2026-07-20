<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

/** Catálogo de medallas: imagen + rareza (define el color del borde con el que se enmarca). */
class Medalla extends Model
{
    use SoftDeletes;

    protected $table = 'medallas';

    protected $fillable = [
        'nombre',
        'imagen',
        'rareza',
        'visible',
    ];

    protected $casts = [
        'visible' => 'boolean',
    ];

    public function characterMedallas(): HasMany
    {
        return $this->hasMany(CharacterMedalla::class);
    }
}
