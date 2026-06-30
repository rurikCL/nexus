<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::table('configuraciones')->insertOrIgnore([
            [
                'nombre'          => 'retraso_texto_npc',
                'tipo_valor'      => 'numerico',
                'valor_numerico'  => 30,
                'valor_texto'     => null,
                'activo'          => true,
                'created_at'      => now(),
                'updated_at'      => now(),
            ],
        ]);
    }

    public function down(): void
    {
        DB::table('configuraciones')->where('nombre', 'retraso_texto_npc')->delete();
    }
};
