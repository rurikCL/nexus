<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Marca si el jugador cuyo turno está en curso ya tiró el cambio de estancia (INI + 2d6 >= 10,
 * ver App\Support\Combat\TiradaEstancia). Solo se permite UNA tirada por turno: una tirada
 * exitosa deja al jugador actuando de nuevo, y sin esta marca podría volver a cambiar de
 * estancia para re-tirar indefinidamente.
 *
 * Se resetea al pasar el turno (PvpCombatController::action / RaidCombatController::advanceIndex).
 * Es una sola columna por combate -no una por bando- porque solo puede actuar el jugador del turno.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('pvp_combats', function (Blueprint $table) {
            $table->boolean('estancia_tirada')->default(false)->after('ronda_turno');
        });
        Schema::table('raid_combats', function (Blueprint $table) {
            $table->boolean('estancia_tirada')->default(false)->after('turn_index');
        });
    }

    public function down(): void
    {
        Schema::table('pvp_combats', function (Blueprint $table) {
            $table->dropColumn('estancia_tirada');
        });
        Schema::table('raid_combats', function (Blueprint $table) {
            $table->dropColumn('estancia_tirada');
        });
    }
};
