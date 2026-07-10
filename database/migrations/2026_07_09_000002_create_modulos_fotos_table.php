<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('modulos_fotos', function (Blueprint $table) {
            $table->id();
            $table->foreignId('modulo_entrenamiento_id')->nullable()->constrained('modulos_entrenamiento')->cascadeOnDelete();
            $table->string('path');
            $table->text('prompt')->nullable();
            $table->foreignId('creado_por')->constrained('users')->cascadeOnDelete();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('modulos_fotos');
    }
};
