<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Combate RAID: 4 jugadores vs 1 NPC tipo "jefe". Esta tabla lleva el estado
 * del jefe y del combate en general; el estado por jugador vive en
 * raid_combat_players. "esperando" = cola de emparejamiento (aún no hay 4
 * jugadores); "activo" = combate en curso; "ganado"/"perdido" = terminado.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('raid_combats', function (Blueprint $table) {
            $table->id();
            $table->foreignId('npc_id')->constrained('map_npcs')->cascadeOnDelete();
            $table->enum('status', ['esperando', 'activo', 'ganado', 'perdido'])->default('esperando');
            $table->integer('npc_hp')->default(0);
            $table->integer('npc_escudo')->default(0);
            $table->integer('npc_forma')->default(0);
            $table->json('npc_buffs')->nullable();
            $table->json('npc_debuffs')->nullable();
            $table->json('npc_cooldowns')->nullable();
            /* [{type:'player'|'npc', user_id: int|null}, ...] — orden de turnos de la ronda actual */
            $table->json('turn_order')->nullable();
            $table->unsignedTinyInteger('turn_index')->default(0);
            $table->unsignedSmallInteger('ronda')->default(1);
            $table->json('log')->nullable();
            $table->unsignedBigInteger('lugar_id')->nullable();
            $table->unsignedBigInteger('zona_id')->nullable();
            $table->unsignedBigInteger('planeta_id')->nullable();
            $table->unsignedBigInteger('sistema_id')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('raid_combats');
    }
};
