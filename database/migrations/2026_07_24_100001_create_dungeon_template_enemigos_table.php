<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('dungeon_template_enemigos', function (Blueprint $table) {
            $table->id();
            $table->foreignId('dungeon_template_id')->constrained('dungeon_templates')->cascadeOnDelete();
            $table->foreignId('enemigo_id')->constrained('map_enemigos')->cascadeOnDelete();
            $table->unsignedSmallInteger('tasa_aparicion')->default(1)
                ->comment('Peso relativo frente a los demás enemigos del mismo template');
            $table->unsignedTinyInteger('nivel')->default(1)
                ->comment('Nivel de dificultad de este enemigo en este template (sobrescribe el nivel base del catálogo)');
            $table->timestamps();
            $table->unique(['dungeon_template_id', 'enemigo_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('dungeon_template_enemigos');
    }
};
