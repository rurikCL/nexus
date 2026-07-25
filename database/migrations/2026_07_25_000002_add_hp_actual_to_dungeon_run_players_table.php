<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Vida/escudo ACTUALES del jugador dentro del run, separados de los máximos del
 * personaje (Character::combatStats()): a diferencia del resto del combate del juego
 * (que siempre arranca a full), un dungeon es deliberadamente exigente -el daño
 * persiste entre salas, mismo criterio que characters_naves.vida_actual/escudo_actual-
 * y solo se recupera con objetos tipo 'utilizable' (ver DungeonController::usarObjeto)
 * o venciendo al jefe. Se inicializan al generar el run (DungeonGeneratorService).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('dungeon_run_players', function (Blueprint $table) {
            $table->unsignedSmallInteger('hp_actual')->nullable()->after('sala_actual_id');
            $table->unsignedSmallInteger('escudo_actual')->nullable()->after('hp_actual');
        });
    }

    public function down(): void
    {
        Schema::table('dungeon_run_players', function (Blueprint $table) {
            $table->dropColumn(['hp_actual', 'escudo_actual']);
        });
    }
};
