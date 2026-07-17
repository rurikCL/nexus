<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('map_lugar_enemigos', function (Blueprint $table) {
            $table->id();
            $table->foreignId('lugar_id')->constrained('map_lugares')->cascadeOnDelete();
            $table->foreignId('enemigo_id')->constrained('map_enemigos')->cascadeOnDelete();
            $table->unsignedSmallInteger('tasa_aparicion')->default(1)
                ->comment('Peso relativo frente a los demás enemigos asignados al mismo lugar');
            $table->unsignedTinyInteger('nivel')->default(1)
                ->comment('Nivel de dificultad de este enemigo en este lugar específico (sobrescribe el nivel base del catálogo)');
            $table->timestamps();
            $table->unique(['lugar_id', 'enemigo_id']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('map_lugar_enemigos');
    }
};
