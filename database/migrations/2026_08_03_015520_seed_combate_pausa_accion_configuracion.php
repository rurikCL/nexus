<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/** Pausa (ms) entre acciones/banners de los 3 sistemas de combate (Pvp/Raid/NPC) — antes hardcodeada a 2000ms. */
return new class extends Migration
{
    public function up(): void
    {
        DB::table('configuraciones')->insertOrIgnore([
            'nombre' => 'combate_pausa_accion_ms',
            'tipo_valor' => 'numerico',
            'valor_numerico' => 2000,
            'valor_texto' => null,
            'activo' => true,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    public function down(): void
    {
        DB::table('configuraciones')->where('nombre', 'combate_pausa_accion_ms')->delete();
    }
};
