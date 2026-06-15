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
        Schema::create('map_naves', function (Blueprint $table) {
            $table->id();
            $table->string('nombre');
            $table->string('tipo')->nullable();
            $table->integer('capacidad_carga')->default(0);
            $table->integer('vida')->default(0);
            $table->integer('escudo')->default(0);
            $table->integer('velocidad')->default(0);
            $table->integer('ataque')->default(0);
            $table->integer('maniobrabilidad')->default(0);
            $table->integer('capacidad_salto')->default(0);
            $table->integer('costo')->default(0);
            $table->integer('costo_reparacion')->default(0);
            $table->string('rareza')->nullable();
            $table->string('imagen')->nullable();
            $table->text('descripcion')->nullable();
            $table->timestamps();
            $table->softDeletes();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('map_naves');
    }
};
