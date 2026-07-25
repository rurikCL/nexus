<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Sala desde la que el jugador llegó a su sala actual — permite "huir" de una sala con
 * enemigo sin combatir (ver DungeonController::huir), volviendo un paso atrás sin tirada.
 * Se actualiza en cada mover() exitoso; huir() la intercambia con la actual (un solo nivel
 * de historial, no una pila completa).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('dungeon_run_players', function (Blueprint $table) {
            $table->foreignId('sala_anterior_id')->nullable()->after('sala_actual_id')
                ->constrained('dungeon_salas')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('dungeon_run_players', function (Blueprint $table) {
            $table->dropForeign(['sala_anterior_id']);
            $table->dropColumn('sala_anterior_id');
        });
    }
};
