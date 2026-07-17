<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::table('configuraciones')->insertOrIgnore([
            [
                'nombre' => 'sonido_click_habilidad',
                'tipo_valor' => 'texto',
                'valor_numerico' => null,
                'valor_texto' => 'click_minimo',
                'activo' => true,
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'nombre' => 'sonido_click_opcion',
                'tipo_valor' => 'texto',
                'valor_numerico' => null,
                'valor_texto' => 'menu_click',
                'activo' => true,
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'nombre' => 'sonido_mensaje',
                'tipo_valor' => 'texto',
                'valor_numerico' => null,
                'valor_texto' => 'mensaje_usuario',
                'activo' => true,
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'nombre' => 'sonido_notificacion_duelo',
                'tipo_valor' => 'texto',
                'valor_numerico' => null,
                'valor_texto' => 'notificacion',
                'activo' => true,
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'nombre' => 'sonido_atras',
                'tipo_valor' => 'texto',
                'valor_numerico' => null,
                'valor_texto' => 'atras_click',
                'activo' => true,
                'created_at' => now(),
                'updated_at' => now(),
            ],
        ]);
    }

    public function down(): void
    {
        DB::table('configuraciones')->whereIn('nombre', [
            'sonido_click_habilidad',
            'sonido_click_opcion',
            'sonido_mensaje',
            'sonido_notificacion_duelo',
            'sonido_atras',
        ])->delete();
    }
};
