<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        if (DB::table('configuraciones')->where('nombre', 'raid_max_wait')->exists()) {
            return;
        }

        DB::table('configuraciones')->insert([
            'nombre' => 'raid_max_wait',
            'tipo_valor' => 'numerico',
            'valor_numerico' => 30,
            'valor_texto' => null,
            'activo' => true,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    public function down(): void
    {
        DB::table('configuraciones')->where('nombre', 'raid_max_wait')->delete();
    }
};
