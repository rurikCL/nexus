<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Vincula un RaidCombat con el DungeonRun que lo originó (jefe final de un
 * dungeon). Nullable porque la mayoría de los RaidCombat son jefes de mapa
 * normales, sin dungeon detrás. Necesario para que RaidCombatController::join
 * agrupe la cola por (npc_id, dungeon_run_id) en vez de solo npc_id -de lo
 * contrario dos equipos distintos peleando contra el mismo jefe de catálogo
 * en dos dungeons distintos compartirían cola-, y para que
 * grantVictoryRewards() sepa cerrar el DungeonRun al vencerlo.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('raid_combats', function (Blueprint $table) {
            $table->foreignId('dungeon_run_id')->nullable()->after('npc_id')
                ->constrained('dungeon_runs')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('raid_combats', function (Blueprint $table) {
            $table->dropForeign(['dungeon_run_id']);
            $table->dropColumn('dungeon_run_id');
        });
    }
};
