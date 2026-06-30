<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('pvp_combats', function (Blueprint $table) {
            $table->id();
            $table->foreignId('attacker_id')->constrained('users')->onDelete('cascade');
            $table->foreignId('defender_id')->constrained('users')->onDelete('cascade');
            $table->unsignedBigInteger('lugar_id')->nullable();
            $table->smallInteger('attacker_hp');
            $table->smallInteger('defender_hp');
            $table->smallInteger('attacker_escudo')->default(0);
            $table->smallInteger('defender_escudo')->default(0);
            $table->tinyInteger('attacker_def_bonus')->default(0);
            $table->tinyInteger('defender_def_bonus')->default(0);
            $table->unsignedBigInteger('current_turn');
            $table->enum('status', ['active', 'attacker_won', 'defender_won', 'fled_attacker', 'fled_defender'])->default('active');
            $table->tinyInteger('attacker_current_forma')->default(1)->after('attacker_last_forma');
            $table->tinyInteger('defender_current_forma')->default(1)->after('defender_last_forma');
            $table->json('log')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('pvp_combats');
    }
};
