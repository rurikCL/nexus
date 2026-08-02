<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Contador de golpes conectados contra el jefe, base del sistema de agro ponderado
 * (20% de probabilidad de ser el objetivo por golpe, hasta 80%) que reemplaza el
 * targeting determinista por `dano_al_jefe` — ver RaidCombatController::resolveNpcTurn.
 * `dano_al_jefe` se mantiene sin cambios (solo estadístico).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('raid_combat_players', function (Blueprint $table) {
            $table->unsignedInteger('golpes_al_jefe')->default(0)->after('dano_al_jefe');
        });
    }

    public function down(): void
    {
        Schema::table('raid_combat_players', function (Blueprint $table) {
            $table->dropColumn('golpes_al_jefe');
        });
    }
};
