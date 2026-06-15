<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('mision_user', function (Blueprint $table) {
            $table->id();
            $table->foreignId('mision_id')->constrained('misiones')->cascadeOnDelete();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->string('status')->default('pendiente'); // pendiente | en-curso | completada
            $table->unsignedTinyInteger('progreso')->default(0);
            $table->timestamps();
            $table->unique(['mision_id', 'user_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('mision_user');
    }
};
