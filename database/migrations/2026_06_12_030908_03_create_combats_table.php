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
        Schema::create('combats', function (Blueprint $table) {
            $table->id();
            $table->foreignId('combatant_a_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('combatant_b_id')->constrained('users')->cascadeOnDelete();
            $table->decimal('odds_a', 5, 2)->default(2.00);
            $table->decimal('odds_b', 5, 2)->default(2.00);
            $table->dateTime('scheduled_at')->nullable();
            $table->string('event_name')->nullable();
            $table->string('round')->nullable();
            $table->boolean('live')->default(false);
            $table->boolean('resolved')->default(false);
            $table->enum('winner', ['a', 'b'])->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('combats');
    }
};
