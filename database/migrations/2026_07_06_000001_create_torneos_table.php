<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('torneos', function (Blueprint $table) {
            $table->id();
            $table->string('nombre');
            $table->text('descripcion')->nullable();
            $table->string('imagen')->nullable();
            $table->text('premios')->nullable();
            $table->text('requisitos')->nullable();
            $table->unsignedInteger('cupos');
            $table->string('estado')->default('inscripcion'); // inscripcion | en_curso | finalizado
            $table->date('fecha_inicio')->nullable();
            $table->foreignId('ganador_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
        });

        Schema::create('torneo_inscripciones', function (Blueprint $table) {
            $table->id();
            $table->foreignId('torneo_id')->constrained('torneos')->cascadeOnDelete();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->string('estado')->default('inscrito'); // inscrito | eliminado | campeon
            $table->unsignedInteger('seed')->nullable();
            $table->timestamps();

            $table->unique(['torneo_id', 'user_id']);
        });

        Schema::create('torneo_combates', function (Blueprint $table) {
            $table->id();
            $table->foreignId('torneo_id')->constrained('torneos')->cascadeOnDelete();
            $table->unsignedInteger('ronda');
            $table->unsignedInteger('posicion');
            $table->foreignId('user_a_id')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('user_b_id')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('ganador_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('estado')->default('pendiente'); // pendiente | bye | resuelto
            $table->unsignedInteger('puntos_a')->default(0);
            $table->unsignedInteger('puntos_b')->default(0);
            $table->unsignedInteger('faltas_a')->default(0);
            $table->unsignedInteger('faltas_b')->default(0);
            $table->boolean('falta_grave_a')->default(false);
            $table->boolean('falta_grave_b')->default(false);
            $table->unsignedBigInteger('next_combate_id')->nullable();
            $table->string('next_slot')->nullable(); // a | b
            $table->foreignId('resuelto_por')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
        });

        Schema::table('torneo_combates', function (Blueprint $table) {
            $table->foreign('next_combate_id')->references('id')->on('torneo_combates')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('torneo_combates');
        Schema::dropIfExists('torneo_inscripciones');
        Schema::dropIfExists('torneos');
    }
};
