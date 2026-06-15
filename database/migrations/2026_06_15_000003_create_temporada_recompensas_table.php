<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('temporada_recompensas', function (Blueprint $table) {
            $table->id();
            $table->foreignId('temporada_id')->constrained()->cascadeOnDelete();
            $table->string('nombre', 100);
            $table->text('descripcion')->nullable();
            $table->integer('creditos')->default(0);
            $table->integer('experiencia')->default(0);
            $table->string('medalla_id', 60)->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('temporada_recompensas');
    }
};
