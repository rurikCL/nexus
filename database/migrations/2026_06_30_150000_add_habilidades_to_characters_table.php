<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('characters', function (Blueprint $table) {
            $table->foreignId('habilidad_1')->nullable()->constrained('rol_habilidades')->nullOnDelete()->after('puntos_libres');
            $table->foreignId('habilidad_2')->nullable()->constrained('rol_habilidades')->nullOnDelete()->after('habilidad_1');
            $table->foreignId('habilidad_3')->nullable()->constrained('rol_habilidades')->nullOnDelete()->after('habilidad_2');
            $table->foreignId('habilidad_4')->nullable()->constrained('rol_habilidades')->nullOnDelete()->after('habilidad_3');
        });
    }

    public function down(): void
    {
        Schema::table('characters', function (Blueprint $table) {
            $table->dropForeign(['habilidad_1']);
            $table->dropForeign(['habilidad_2']);
            $table->dropForeign(['habilidad_3']);
            $table->dropForeign(['habilidad_4']);
            $table->dropColumn(['habilidad_1', 'habilidad_2', 'habilidad_3', 'habilidad_4']);
        });
    }
};
