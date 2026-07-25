<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * pos_x/pos_y: coordenadas de la sala en la cuadrícula del grafo generado (ya calculadas por
 * DungeonGraphBuilder, solo faltaba persistirlas) — permiten dibujar el minimapa en el frontend
 * sin tener que reconstruir el layout desde las conexiones norte/sur/este/oeste.
 * tiene_cofre: si esta sala (normal, nunca entrada/jefe) tiene un cofre con recompensa del
 * template — ver DungeonTemplate::recompensas() y DungeonController::abrirCofre.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('dungeon_salas', function (Blueprint $table) {
            $table->integer('pos_x')->nullable()->after('nivel_enemigo');
            $table->integer('pos_y')->nullable()->after('pos_x');
            $table->boolean('tiene_cofre')->default(false)->after('pos_y');
        });
    }

    public function down(): void
    {
        Schema::table('dungeon_salas', function (Blueprint $table) {
            $table->dropColumn(['pos_x', 'pos_y', 'tiene_cofre']);
        });
    }
};
