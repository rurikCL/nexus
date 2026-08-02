<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/** Daño base del ataque cuerpo a cuerpo con un sable de luz armado — ver CharacterSable::getDanoAttribute. */
return new class extends Migration
{
    public function up(): void
    {
        DB::table('configuraciones')->insertOrIgnore([
            'nombre' => 'dano_base_sable',
            'tipo_valor' => 'numerico',
            'valor_numerico' => 1,
            'valor_texto' => null,
            'activo' => true,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    public function down(): void
    {
        DB::table('configuraciones')->where('nombre', 'dano_base_sable')->delete();
    }
};
