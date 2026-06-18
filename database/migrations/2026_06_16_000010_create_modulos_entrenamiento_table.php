<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('modulos_entrenamiento', function (Blueprint $table) {
            $table->id();
            $table->string('nombre');
            $table->text('descripcion')->nullable();
            $table->json('objetivos')->nullable();      // array de strings
            $table->string('foco')->nullable();         // Técnica, Cardio, Sparring, etc.
            $table->unsignedTinyInteger('esfuerzo')->default(5); // 1-10
            $table->string('forma')->nullable();        // forma1-forma7
            $table->json('fotos')->nullable();          // array de URLs
            $table->string('video')->nullable();        // URL
            $table->string('nivel_dificultad')->default('basico'); // basico|intermedio|avanzado|experto
            $table->foreignId('creado_por')->constrained('users')->cascadeOnDelete();
            $table->foreignId('revisado_por')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('modulos_entrenamiento');
    }
};
