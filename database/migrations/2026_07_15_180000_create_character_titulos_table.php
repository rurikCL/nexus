<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('character_titulos', function (Blueprint $table) {
            $table->id();
            $table->foreignId('character_id')->constrained()->cascadeOnDelete();
            $table->string('nombre');
            $table->string('tipo')->default('titulo'); // titulo | insignia
            $table->foreignId('mision_id')->nullable()->constrained('misiones')->nullOnDelete();
            $table->boolean('activo')->default(false);
            $table->timestamps();

            $table->unique(['character_id', 'nombre']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('character_titulos');
    }
};
