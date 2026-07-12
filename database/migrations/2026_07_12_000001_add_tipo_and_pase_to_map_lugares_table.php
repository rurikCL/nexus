<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Repara el desajuste de esquema en map_lugares: la migración original
 * (2026_06_15_165048_04) declara 'tipo' y 'pase', pero en esta base de datos
 * la tabla ya existía sin esas columnas cuando esa migración corrió, así que
 * nunca se crearon.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('map_lugares', function (Blueprint $table) {
            if (! Schema::hasColumn('map_lugares', 'tipo')) {
                $table->string('tipo')->default('exterior')->after('rareza');
            }
            if (! Schema::hasColumn('map_lugares', 'pase')) {
                $table->foreignId('pase')->nullable()->after('tipo')
                      ->constrained('rol_objetos')->nullOnDelete();
            }
        });
    }

    public function down(): void
    {
        Schema::table('map_lugares', function (Blueprint $table) {
            if (Schema::hasColumn('map_lugares', 'pase')) {
                $table->dropForeign(['pase']);
                $table->dropColumn('pase');
            }
            if (Schema::hasColumn('map_lugares', 'tipo')) {
                $table->dropColumn('tipo');
            }
        });
    }
};
