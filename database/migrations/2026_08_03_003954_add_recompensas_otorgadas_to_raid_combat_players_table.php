<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Recompensas efectivamente otorgadas a este jugador al ganar el raid (ver
 * RaidCombatController::grantVictoryRewards / RecompensaRollService::resolverYOtorgar) —
 * persistidas para poder mostrarlas (imagen + nombre) en la pantalla de resumen de victoria,
 * incluso si el cliente vuelve a consultar el estado del raid después de ganar.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('raid_combat_players', function (Blueprint $table) {
            $table->json('recompensas_otorgadas')->nullable()->after('debuffs_aplicados');
        });
    }

    public function down(): void
    {
        Schema::table('raid_combat_players', function (Blueprint $table) {
            $table->dropColumn('recompensas_otorgadas');
        });
    }
};
