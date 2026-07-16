<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('raid_combat_players', function (Blueprint $table) {
            $table->id();
            $table->foreignId('raid_combat_id')->constrained('raid_combats')->cascadeOnDelete();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->unsignedTinyInteger('slot');
            $table->integer('hp')->default(0);
            $table->integer('escudo')->default(0);
            $table->integer('fuerza')->default(0);
            $table->unsignedTinyInteger('current_forma')->default(1);
            $table->unsignedTinyInteger('last_forma')->default(0);
            $table->json('cooldowns')->nullable();
            $table->json('buffs')->nullable();
            $table->json('debuffs')->nullable();
            /* Daño acumulado infligido al jefe — define a quién prioriza atacar. */
            $table->integer('dano_al_jefe')->default(0);
            $table->enum('status', ['activo', 'huido', 'derrotado'])->default('activo');
            $table->timestamps();

            $table->unique(['raid_combat_id', 'user_id']);
            $table->unique(['raid_combat_id', 'slot']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('raid_combat_players');
    }
};
