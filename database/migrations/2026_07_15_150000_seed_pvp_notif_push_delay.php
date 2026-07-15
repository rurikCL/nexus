<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::table('configuraciones')->insertOrIgnore([
            [
                'nombre' => 'pvp_notif_push_delay_seg',
                'tipo_valor' => 'numerico',
                'valor_numerico' => 30,
                'valor_texto' => null,
                'activo' => true,
                'created_at' => now(),
                'updated_at' => now(),
            ],
        ]);
    }

    public function down(): void
    {
        DB::table('configuraciones')->where('nombre', 'pvp_notif_push_delay_seg')->delete();
    }
};
