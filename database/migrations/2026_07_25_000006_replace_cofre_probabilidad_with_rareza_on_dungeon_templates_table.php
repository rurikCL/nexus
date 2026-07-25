<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Reemplaza el % de chance de cofre por sala (cofre_probabilidad) por una cantidad FIJA de
 * cofres por run, determinada por la rareza del dungeon (ver DungeonTemplate::cofresTotal):
 * comun/poco_comun = 1, raro/epico = 2, legendario = 3. Se reparten al azar entre las salas
 * normales al generar el run (ver DungeonGeneratorService).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('dungeon_templates', function (Blueprint $table) {
            $table->string('rareza')->default('comun')->after('jefe_npc_id');
            $table->dropColumn('cofre_probabilidad');
        });
    }

    public function down(): void
    {
        Schema::table('dungeon_templates', function (Blueprint $table) {
            $table->dropColumn('rareza');
            $table->unsignedTinyInteger('cofre_probabilidad')->default(30)->after('salas_max');
        });
    }
};
