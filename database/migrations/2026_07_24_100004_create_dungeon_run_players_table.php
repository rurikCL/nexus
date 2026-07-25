<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Miembro del equipo de un DungeonRun. 'listo' solo importa mientras el run
 * está en 'esperando' (lobby, igual que raid_combat_players.listo); una vez
 * en_curso, 'sala_actual_id' es la posición individual de este jugador
 * dentro del grafo compartido -cada uno avanza a su propio ritmo por los
 * encuentros normales, y solo converge con el resto del equipo al llegar a
 * la sala jefe-.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('dungeon_run_players', function (Blueprint $table) {
            $table->id();
            $table->foreignId('dungeon_run_id')->constrained('dungeon_runs')->cascadeOnDelete();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->boolean('listo')->default(false);
            $table->foreignId('sala_actual_id')->nullable()->constrained('dungeon_salas')->nullOnDelete();
            $table->enum('estado', ['activo', 'abandonado'])->default('activo');
            $table->timestamps();
            $table->unique(['dungeon_run_id', 'user_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('dungeon_run_players');
    }
};
