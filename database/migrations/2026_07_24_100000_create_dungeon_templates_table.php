<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Plantilla de dungeon: define el rango de salas y el pool de contenido
 * (enemigos comunes + jefe final) con el que DungeonGeneratorService arma
 * un DungeonRun concreto para un jugador. El jefe reutiliza el catálogo
 * existente de map_npcs (tipo "jefe"), peleado vía RaidCombatController.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('dungeon_templates', function (Blueprint $table) {
            $table->id();
            $table->string('nombre');
            $table->foreignId('map_zona_id')->nullable()->constrained('map_zonas')->nullOnDelete();
            $table->foreignId('jefe_npc_id')->constrained('map_npcs')->cascadeOnDelete();
            $table->unsignedTinyInteger('salas_min')->default(5);
            $table->unsignedTinyInteger('salas_max')->default(8);
            $table->boolean('visible')->default(true);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('dungeon_templates');
    }
};
