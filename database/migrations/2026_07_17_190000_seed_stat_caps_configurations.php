<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::table('configuraciones')->insertOrIgnore([
            [
                'nombre' => 'cap_stats_asignacion',
                'tipo_valor' => 'numerico',
                'valor_numerico' => 10,
                'valor_texto' => null,
                'activo' => true,
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'nombre' => 'cap_stats_items',
                'tipo_valor' => 'numerico',
                'valor_numerico' => 15,
                'valor_texto' => null,
                'activo' => true,
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'nombre' => 'cap_stats_buff',
                'tipo_valor' => 'numerico',
                'valor_numerico' => 18,
                'valor_texto' => null,
                'activo' => true,
                'created_at' => now(),
                'updated_at' => now(),
            ],
        ]);
    }

    public function down(): void
    {
        DB::table('configuraciones')->whereIn('nombre', [
            'cap_stats_asignacion',
            'cap_stats_items',
            'cap_stats_buff',
        ])->delete();
    }
};
