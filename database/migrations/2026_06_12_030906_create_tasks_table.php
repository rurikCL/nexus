<?php

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
        Schema::create('tasks', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tutor_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('pupil_id')->constrained('users')->cascadeOnDelete();
            $table->string('title');
            $table->text('detail')->nullable();
            $table->date('due_date')->nullable();
            $table->tinyInteger('progress')->default(0);
            $table->enum('status', ['pendiente', 'en-curso', 'revision', 'completada'])->default('pendiente');
            $table->integer('reward')->default(0);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('tasks');
    }
};
