<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('objetivos', function (Blueprint $table) {
            $table->id();
            $table->string('nombre');
            $table->text('descripcion')->nullable();
            $table->string('tipo')->default('general'); // general | entrenamiento | combate | tarea
            $table->unsignedInteger('meta')->default(1); // cantidad a alcanzar
            $table->string('unidad')->nullable();        // 'sesiones', 'victorias', 'tareas', etc.
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('objetivos');
    }
};
