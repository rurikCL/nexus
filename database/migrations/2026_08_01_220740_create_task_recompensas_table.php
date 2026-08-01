<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Recompensas estructuradas para Tareas — mismo shape que recompensas/evento_recompensas,
 * pero solo soporta tipo creditos/objeto/habilidad (título/insignia/punto_habilidad no
 * aplican aquí por ahora). A diferencia de Misiones/Eventos, estas se descuentan del
 * tutor al momento de asignar la tarea (ver TaskController::store) y se otorgan al
 * pupilo recién al aprobarse la tarea.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('task_recompensas', function (Blueprint $table) {
            $table->id();
            $table->foreignId('task_id')->constrained('tasks')->cascadeOnDelete();
            $table->string('nombre');
            $table->text('descripcion')->nullable();
            $table->string('tipo')->default('creditos'); // creditos | objeto | habilidad
            $table->unsignedInteger('valor')->default(0); // créditos por pupilo si tipo=creditos
            $table->string('imagen')->nullable();
            $table->foreignId('habilidad_id')->nullable()->constrained('rol_habilidades')->nullOnDelete();
            $table->foreignId('objeto_id')->nullable()->constrained('rol_objetos')->nullOnDelete();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('task_recompensas');
    }
};
