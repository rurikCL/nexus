<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('npc_chat_logs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->unsignedBigInteger('npc_id');
            $table->foreign('npc_id')->references('id')->on('map_npcs')->cascadeOnDelete();
            $table->enum('role', ['user', 'assistant']);
            $table->text('content');
            $table->timestamps();
            $table->index(['user_id', 'npc_id', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('npc_chat_logs');
    }
};
