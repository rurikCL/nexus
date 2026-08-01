<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Mismo tracking de origen que ya existe con `mision_id`, pero para recompensas
 * otorgadas por un Evento — así un título/medalla puede rastrear si vino de una
 * misión o de un evento (o de ninguno, si se otorga manualmente desde el admin).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('character_titulos', function (Blueprint $table) {
            $table->foreignId('event_id')->nullable()->after('mision_id')
                  ->constrained('events')->nullOnDelete();
        });

        Schema::table('character_medallas', function (Blueprint $table) {
            $table->foreignId('event_id')->nullable()->after('mision_id')
                  ->constrained('events')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('character_titulos', function (Blueprint $table) {
            $table->dropForeign(['event_id']);
            $table->dropColumn('event_id');
        });

        Schema::table('character_medallas', function (Blueprint $table) {
            $table->dropForeign(['event_id']);
            $table->dropColumn('event_id');
        });
    }
};
