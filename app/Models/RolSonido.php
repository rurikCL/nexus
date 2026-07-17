<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class RolSonido extends Model
{
    use SoftDeletes;

    protected $table = 'rol_sonidos';

    protected $fillable = [
        'nombre',
        'descripcion',
        'archivo',
    ];
}
