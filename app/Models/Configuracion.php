<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Configuracion extends Model
{
    protected $table = 'configuraciones';

    protected $fillable = [
        'nombre',
        'tipo_valor',
        'valor_numerico',
        'valor_texto',
        'activo',
    ];

    protected $casts = [
        'valor_numerico' => 'float',
        'activo'         => 'boolean',
    ];

    public static function valor(string $nombre, mixed $default = null): mixed
    {
        $c = static::where('nombre', $nombre)->where('activo', true)->first();
        if (! $c) {
            return $default;
        }

        return $c->tipo_valor === 'texto' ? $c->valor_texto : $c->valor_numerico;
    }
}
