<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Extend misiones table
        Schema::table('misiones', function (Blueprint $table) {
            $table->string('tipo_mision')->default('individual')->after('descripcion');
            $table->unsignedBigInteger('temporada_id')->nullable()->after('tipo_mision');
            $table->unsignedBigInteger('npc_id')->nullable()->after('temporada_id');
            $table->unsignedInteger('puntos_requeridos')->default(100)->after('npc_id');
            $table->boolean('activa')->default(true)->after('puntos_requeridos');
            $table->unsignedSmallInteger('orden')->default(0)->after('activa');

            $table->foreign('temporada_id')->references('id')->on('temporadas')->nullOnDelete();
            $table->foreign('npc_id')->references('id')->on('map_npcs')->nullOnDelete();
        });

        // Extend objetivos table
        Schema::table('objetivos', function (Blueprint $table) {
            $table->unsignedBigInteger('mision_id')->nullable()->after('id');
            $table->string('progreso_tipo')->default('conteo')->after('unidad');

            $table->foreign('mision_id')->references('id')->on('misiones')->cascadeOnDelete();
        });

        // Extend recompensas table
        Schema::table('recompensas', function (Blueprint $table) {
            $table->unsignedBigInteger('mision_id')->nullable()->after('id');

            $table->foreign('mision_id')->references('id')->on('misiones')->cascadeOnDelete();
        });

        // Extend mision_user table
        Schema::table('mision_user', function (Blueprint $table) {
            $table->text('progreso_json')->nullable()->after('progreso');
        });
    }

    public function down(): void
    {
        Schema::table('mision_user', function (Blueprint $table) {
            $table->dropColumn('progreso_json');
        });

        Schema::table('recompensas', function (Blueprint $table) {
            $table->dropForeign(['mision_id']);
            $table->dropColumn('mision_id');
        });

        Schema::table('objetivos', function (Blueprint $table) {
            $table->dropForeign(['mision_id']);
            $table->dropColumn(['mision_id', 'progreso_tipo']);
        });

        Schema::table('misiones', function (Blueprint $table) {
            $table->dropForeign(['npc_id']);
            $table->dropForeign(['temporada_id']);
            $table->dropColumn(['tipo_mision', 'temporada_id', 'npc_id', 'puntos_requeridos', 'activa', 'orden']);
        });
    }
};
