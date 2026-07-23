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
        Schema::table('misiones', function (Blueprint $table) {
            $table->unsignedBigInteger('npc_termina_id')->nullable()->after('npc_id');
            $table->foreign('npc_termina_id')->references('id')->on('map_npcs')->nullOnDelete();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('misiones', function (Blueprint $table) {
            $table->dropForeign(['npc_termina_id']);
            $table->dropColumn('npc_termina_id');
        });
    }
};
