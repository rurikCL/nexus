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
        Schema::create('characters', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->unique()->constrained()->cascadeOnDelete();
            $table->string('name');
            $table->string('handle', 20)->unique();
            $table->text('bio')->nullable();
            $table->enum('cls', ['vanguardia', 'espectro', 'titan', 'oraculo']);
            $table->string('saber_color')->default('azul');
            $table->string('sector')->nullable();
            $table->string('sponsor')->nullable();
            $table->year('joined_year')->nullable();
            $table->integer('credits')->default(0);
            $table->integer('wins')->default(0);
            $table->integer('losses')->default(0);
            $table->integer('streak')->default(0);
            $table->json('stats')->nullable();
            $table->boolean('gold')->default(false);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('characters');
    }
};
