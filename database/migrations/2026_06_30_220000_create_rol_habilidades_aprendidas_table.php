<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('rol_habilidades_aprendidas', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('habilidad_id')->constrained('rol_habilidades')->cascadeOnDelete();
            $table->timestamps();
            $table->unique(['user_id', 'habilidad_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('rol_habilidades_aprendidas');
    }
};
