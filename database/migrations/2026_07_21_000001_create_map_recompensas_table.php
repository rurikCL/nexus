<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('map_recompensas', function (Blueprint $table) {
            $table->id();
            $table->morphs('dropable'); // MapNpc (tipo jefe) o MapEnemigo
            $table->string('tipo')->default('creditos'); // creditos | objeto | habilidad | punto_habilidad | titulo | insignia
            $table->unsignedTinyInteger('porcentaje')->default(100); // peso relativo dentro del pool no-crédito
            $table->unsignedInteger('valor')->default(0); // monto de créditos o de puntos de habilidad
            $table->string('nombre')->nullable(); // texto del título, si tipo=titulo
            $table->foreignId('habilidad_id')->nullable()->constrained('rol_habilidades')->nullOnDelete();
            $table->foreignId('objeto_id')->nullable()->constrained('rol_objetos')->nullOnDelete();
            $table->foreignId('medalla_id')->nullable()->constrained('medallas')->nullOnDelete();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('map_recompensas');
    }
};
