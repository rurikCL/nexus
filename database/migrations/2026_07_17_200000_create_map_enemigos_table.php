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
        Schema::create('map_enemigos', function (Blueprint $table) {
            $table->id();
            $table->string('nombre');
            $table->string('tipo')->nullable();
            $table->string('profesion')->nullable();
            $table->string('faccion')->nullable();
            $table->string('imagen_mini')->nullable();
            $table->string('imagen')->nullable();
            $table->string('saludo')->nullable();
            $table->text('interaccion')->nullable();
            $table->text('prompt')->nullable();
            $table->foreignId('MisionID')->nullable()->constrained('misiones')->nullOnDelete();
            $table->string('urlInteraccion')->nullable();
            $table->boolean('visible')->default(true);
            $table->integer('vida')->default(0);
            $table->integer('escudo')->default(0);
            $table->integer('defensa')->default(0);
            $table->integer('ataque')->default(0);
            $table->integer('movimiento')->default(0);
            $table->integer('iniciativa')->default(0);
            $table->integer('punteria')->default(0);
            $table->unsignedTinyInteger('forma')->default(0)
                ->comment('Forma de combate del enemigo (0 = universal, sin bono/penalización de efectividad)');
            $table->unsignedTinyInteger('nivel')->default(1);
            $table->text('hito_requerimiento')->nullable();
            $table->date('fecha_inicio')->nullable();
            $table->date('fecha_fin')->nullable();
            $table->foreignId('habilidad_1')->nullable()->constrained('rol_habilidades')->nullOnDelete();
            $table->foreignId('habilidad_2')->nullable()->constrained('rol_habilidades')->nullOnDelete();
            $table->foreignId('habilidad_3')->nullable()->constrained('rol_habilidades')->nullOnDelete();
            $table->foreignId('habilidad_4')->nullable()->constrained('rol_habilidades')->nullOnDelete();
            $table->unsignedTinyInteger('raid_slots')->default(4);
            $table->timestamps();
            $table->softDeletes();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('map_enemigos');
    }
};
