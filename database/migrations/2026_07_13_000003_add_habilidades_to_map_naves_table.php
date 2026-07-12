<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * 4 slots de habilidad que la nave usa en combate espacial (tabla
     * rol_habilidades, tipo "nave"). Análogo a los habilidad_1..4 del
     * Character, pero fijos para la nave (sin variación por forma).
     */
    public function up(): void
    {
        Schema::table('map_naves', function (Blueprint $table) {
            $table->foreignId('habilidad_1')->nullable()->after('capacidad_salto')->constrained('rol_habilidades')->nullOnDelete();
            $table->foreignId('habilidad_2')->nullable()->after('habilidad_1')->constrained('rol_habilidades')->nullOnDelete();
            $table->foreignId('habilidad_3')->nullable()->after('habilidad_2')->constrained('rol_habilidades')->nullOnDelete();
            $table->foreignId('habilidad_4')->nullable()->after('habilidad_3')->constrained('rol_habilidades')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('map_naves', function (Blueprint $table) {
            $table->dropConstrainedForeignId('habilidad_1');
            $table->dropConstrainedForeignId('habilidad_2');
            $table->dropConstrainedForeignId('habilidad_3');
            $table->dropConstrainedForeignId('habilidad_4');
        });
    }
};
