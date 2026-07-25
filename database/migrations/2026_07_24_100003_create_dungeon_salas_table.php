<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Nodo de un DungeonRun concreto: mismo patrón de grafo de 4 direcciones que
 * map_lugares (auto-FK norte/sur/este/oeste), pero generado por
 * DungeonGeneratorService y borrado junto con el run, no contenido de admin.
 * El enemigo se pre-rola una sola vez por sala (compartido por todo el
 * equipo); si un encuentro fue resuelto o no es por-jugador, ver
 * dungeon_sala_progresos.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('dungeon_salas', function (Blueprint $table) {
            $table->id();
            $table->foreignId('dungeon_run_id')->constrained('dungeon_runs')->cascadeOnDelete();
            $table->enum('tipo', ['entrada', 'normal', 'jefe'])->default('normal');
            $table->foreignId('norte_id')->nullable()->constrained('dungeon_salas')->nullOnDelete();
            $table->foreignId('sur_id')->nullable()->constrained('dungeon_salas')->nullOnDelete();
            $table->foreignId('este_id')->nullable()->constrained('dungeon_salas')->nullOnDelete();
            $table->foreignId('oeste_id')->nullable()->constrained('dungeon_salas')->nullOnDelete();
            /* Encuentro pre-rolado en generación (determinístico por seed), no al visitar. */
            $table->foreignId('enemigo_id')->nullable()->constrained('map_enemigos')->nullOnDelete();
            $table->unsignedTinyInteger('nivel_enemigo')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('dungeon_salas');
    }
};
