<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Sede placeholder para que el registro de usuarios no quede bloqueado (requiere
 * elegir sede) apenas se despliega la feature — el admin la edita/renombra o crea
 * más sedes reales desde el panel de Configuración.
 */
return new class extends Migration
{
    public function up(): void
    {
        DB::table('sedes')->insert([
            'nombre' => 'Sede Principal',
            'ubicacion' => null,
            'pais' => null,
            'region' => null,
            'costo_membresia' => null,
            'costo_mensualidad' => null,
            'imagen' => null,
            'activa' => true,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    public function down(): void
    {
        DB::table('sedes')->where('nombre', 'Sede Principal')->delete();
    }
};
