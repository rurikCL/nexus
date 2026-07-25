<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        $now = now();

        DB::table('configuraciones')->insertOrIgnore([[
            'nombre' => 'tiempo_npc_interaccion',
            'tipo_valor' => 'numerico',
            'valor_numerico' => 120,
            'valor_texto' => null,
            'activo' => true,
            'created_at' => $now,
            'updated_at' => $now,
        ]]);
    }

    public function down(): void
    {
        DB::table('configuraciones')->where('nombre', 'tiempo_npc_interaccion')->delete();
    }
};
