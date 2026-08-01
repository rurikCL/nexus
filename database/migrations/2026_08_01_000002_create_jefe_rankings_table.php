<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('jefe_rankings', function (Blueprint $table) {
            $table->id();
            $table->foreignId('npc_id')->nullable()->constrained('map_npcs')->nullOnDelete();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('raid_combat_id')->nullable()->constrained('raid_combats')->nullOnDelete();
            $table->foreignId('dungeon_run_id')->nullable()->constrained('dungeon_runs')->nullOnDelete();
            $table->unsignedInteger('dano_total')->default(0);
            $table->unsignedInteger('curacion_total')->default(0);
            $table->unsignedInteger('debuffs_aplicados')->default(0);
            $table->unsignedSmallInteger('rondas')->default(1);
            $table->timestamps();

            $table->index(['npc_id', 'dano_total']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('jefe_rankings');
    }
};
