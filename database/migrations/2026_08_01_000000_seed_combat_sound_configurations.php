<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::table('configuraciones')->insertOrIgnore([
            [
                'nombre' => 'sonido_combate_npc',
                'tipo_valor' => 'texto',
                'valor_numerico' => null,
                'valor_texto' => 'notificacion',
                'activo' => true,
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'nombre' => 'sonido_combate_jefe',
                'tipo_valor' => 'texto',
                'valor_numerico' => null,
                'valor_texto' => 'notificacion',
                'activo' => true,
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'nombre' => 'sonido_combate_pvp',
                'tipo_valor' => 'texto',
                'valor_numerico' => null,
                'valor_texto' => 'notificacion',
                'activo' => true,
                'created_at' => now(),
                'updated_at' => now(),
            ],
        ]);
    }

    public function down(): void
    {
        DB::table('configuraciones')->whereIn('nombre', [
            'sonido_combate_npc',
            'sonido_combate_jefe',
            'sonido_combate_pvp',
        ])->delete();
    }
};
