<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Progreso individual de un jugador del equipo en una sala del dungeon:
 * el enemigo de la sala es compartido (dungeon_salas.enemigo_id), pero cada
 * jugador lo pelea 1v1 por su cuenta, así que "resuelta" vive por-jugador,
 * no en la sala. Se crea perezosamente (firstOrCreate) la primera vez que
 * un jugador entra a esa sala, no de antemano para todo el grafo.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('dungeon_sala_progresos', function (Blueprint $table) {
            $table->id();
            $table->foreignId('dungeon_run_player_id')->constrained('dungeon_run_players')->cascadeOnDelete();
            $table->foreignId('dungeon_sala_id')->constrained('dungeon_salas')->cascadeOnDelete();
            $table->boolean('visitada')->default(true);
            $table->boolean('resuelta')->default(false);
            $table->timestamps();
            // Nombre explícito y corto: el autogenerado por Laravel supera el límite de 64
            // caracteres de MySQL para identificadores.
            $table->unique(['dungeon_run_player_id', 'dungeon_sala_id'], 'dungeon_sala_progresos_jugador_sala_unique');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('dungeon_sala_progresos');
    }
};
