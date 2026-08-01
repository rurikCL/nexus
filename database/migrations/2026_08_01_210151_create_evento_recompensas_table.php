<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Recompensas estructuradas para Eventos — mismo shape que `recompensas` (misiones),
 * reutilizando el mismo mecanismo de otorgamiento (RecompensaGrantService) en vez de
 * los campos simples `reward` (créditos) / `reward_badge` (texto libre, sin efecto real)
 * que ya tiene la tabla `events`. Esos campos se mantienen por compatibilidad con
 * eventos existentes; los nuevos eventos pueden usar recompensas reales además.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('evento_recompensas', function (Blueprint $table) {
            $table->id();
            $table->foreignId('event_id')->constrained('events')->cascadeOnDelete();
            $table->string('nombre');
            $table->text('descripcion')->nullable();
            $table->string('tipo')->default('creditos'); // creditos | insignia | objeto | titulo | punto_habilidad | habilidad
            $table->unsignedInteger('valor')->default(0); // monto en créditos / puntos si aplica
            $table->string('imagen')->nullable();
            $table->foreignId('habilidad_id')->nullable()->constrained('rol_habilidades')->nullOnDelete();
            $table->foreignId('objeto_id')->nullable()->constrained('rol_objetos')->nullOnDelete();
            $table->foreignId('medalla_id')->nullable()->constrained('medallas')->nullOnDelete();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('evento_recompensas');
    }
};
