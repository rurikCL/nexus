<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('medallas', function (Blueprint $table) {
            $table->id();
            $table->string('nombre');
            $table->string('imagen')->nullable();
            $table->string('rareza')->default('basica'); // basica | rara | epica | legendaria
            $table->boolean('visible')->default(true);
            $table->timestamps();
            $table->softDeletes();
        });

        Schema::create('character_medallas', function (Blueprint $table) {
            $table->id();
            $table->foreignId('character_id')->constrained()->cascadeOnDelete();
            $table->foreignId('medalla_id')->constrained('medallas')->cascadeOnDelete();
            $table->foreignId('mision_id')->nullable()->constrained('misiones')->nullOnDelete();
            $table->boolean('activo')->default(false);
            $table->timestamps();

            $table->unique(['character_id', 'medalla_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('character_medallas');
        Schema::dropIfExists('medallas');
    }
};
