<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('misiones', function (Blueprint $table) {
            $table->id();
            $table->string('nombre');
            $table->text('mision');
            $table->text('descripcion')->nullable();
            $table->string('foto_mision')->nullable();
            $table->unsignedBigInteger('recompensa_id')->nullable();
            $table->date('fecha_inicio')->nullable();
            $table->date('fecha_termino')->nullable();
            $table->unsignedBigInteger('objetivo_id')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('misiones');
    }
};
