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
        Schema::create('map_npcs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('LugarID')->constrained('map_lugares')->onDelete('cascade');
            $table->string('nombre');
            $table->string('tipo')->nullable();
            $table->string('profesion')->nullable();
            $table->string('faccion')->nullable();
            $table->string('imagen_mini')->nullable();
            $table->string('imagen')->nullable();
            $table->string('saludo')->nullable();
            $table->text('interaccion')->nullable();
            $table->unsignedBigInteger('MisionID')->nullable();
            $table->string('urlInteraccion')->nullable();
            $table->boolean('visible')->default(true);
            $table->integer('vida')->default(0);
            $table->integer('escudo')->default(0);
            $table->integer('defensa')->default(0);
            $table->integer('ataque')->default(0);
            $table->integer('movimiento')->default(0);
            $table->integer('iniciativa')->default(0);
            $table->integer('punteria')->default(0);
            $table->timestamps();
            $table->softDeletes();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('map_npcs');
    }
};
