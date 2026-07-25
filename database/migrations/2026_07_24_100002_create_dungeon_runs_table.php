<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Instancia de dungeon para un equipo. 'esperando' = lobby armándose (ver
 * dungeon_run_players.listo); 'en_curso' arranca recién cuando el equipo
 * confirma listo, momento en el que DungeonGeneratorService genera el grafo
 * de dungeon_salas. Efímero a propósito: a diferencia de map_lugares
 * (contenido curado, soft-delete), un run se borra de verdad -junto con sus
 * dungeon_salas- al completarse o abandonarse.
 *
 * La posición de cada jugador dentro del grafo vive en
 * dungeon_run_players.sala_actual_id, no aquí: los encuentros normales son
 * 1v1 independientes por jugador y solo convergen de nuevo en la sala jefe.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('dungeon_runs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('dungeon_template_id')->constrained('dungeon_templates')->cascadeOnDelete();
            $table->foreignId('creado_por_id')->constrained('users')->cascadeOnDelete();
            $table->unsignedBigInteger('seed')->nullable();
            $table->enum('estado', ['esperando', 'en_curso', 'completado', 'abandonado'])->default('esperando');
            $table->timestamp('iniciado_at')->nullable();
            $table->timestamp('completado_at')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('dungeon_runs');
    }
};
