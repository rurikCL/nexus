<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Composición de un enemigo tipo 'horda': hasta 4 slots, cada uno apuntando a OTRO enemigo
 * del mismo catálogo (map_enemigos) con su propio nivel para ese encuentro puntual. Un
 * registro 'horda' no pelea con sus propios stats (vida/ataque/etc. quedan sin uso) — es una
 * receta que agrupa enemigos ya existentes, cada uno con sus propias recompensas ya
 * configuradas (MapEnemigo::recompensas). A diferencia de dungeon_template_enemigos /
 * map_lugar_enemigos, NO tiene unique(horda_id, enemigo_id): una horda puede repetir el mismo
 * enemigo en más de un slot (ej. 2 "Bandido" + 1 "Francotirador"), así que cada fila es
 * independiente en vez de sincronizarse como un set con clave por enemigo_id.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('map_enemigo_horda_slots', function (Blueprint $table) {
            $table->id();
            $table->foreignId('horda_id')->constrained('map_enemigos')->cascadeOnDelete();
            $table->foreignId('enemigo_id')->constrained('map_enemigos')->cascadeOnDelete();
            $table->unsignedTinyInteger('nivel')->default(1)
                ->comment('Nivel de este enemigo dentro de la horda (sobrescribe el nivel base del catálogo)');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('map_enemigo_horda_slots');
    }
};
