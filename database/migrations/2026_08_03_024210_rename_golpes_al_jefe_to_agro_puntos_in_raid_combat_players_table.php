<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * `golpes_al_jefe` pasa a llamarse `agro_puntos`: ya no cuenta solo golpes conectados, sino
 * puntos de agro por varios eventos (golpe fallido/exitoso +1, crítico +2, debuff al jefe +1,
 * curar a un compañero +1) — ver RaidCombatController::elegirObjetivoPorAgro. Usa SQL crudo
 * (CHANGE COLUMN) en vez de Schema::renameColumn porque doctrine/dbal no está instalado.
 */
return new class extends Migration
{
    public function up(): void
    {
        DB::statement('ALTER TABLE raid_combat_players CHANGE golpes_al_jefe agro_puntos INT UNSIGNED NOT NULL DEFAULT 0');
    }

    public function down(): void
    {
        DB::statement('ALTER TABLE raid_combat_players CHANGE agro_puntos golpes_al_jefe INT UNSIGNED NOT NULL DEFAULT 0');
    }
};
