<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Sedes físicas de la academia. Cada usuario pertenece a una (elegida al
 * registrarse) — se usa para clasificar miembros por ubicación real y
 * restringir el PvP a rivales de la misma sede (no se puede retar a
 * distancia a alguien con quien no se comparte el mismo lugar físico).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('sedes', function (Blueprint $table) {
            $table->id();
            $table->string('nombre');
            $table->string('ubicacion')->nullable();
            $table->string('pais')->nullable();
            $table->string('region')->nullable();
            $table->integer('costo_membresia')->nullable();
            $table->integer('costo_mensualidad')->nullable();
            $table->string('imagen')->nullable();
            $table->boolean('activa')->default(true);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('sedes');
    }
};
