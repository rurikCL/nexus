<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('raid_combat_players', function (Blueprint $table) {
            $table->unsignedInteger('curacion_total')->default(0)->after('dano_al_jefe');
            $table->unsignedInteger('debuffs_aplicados')->default(0)->after('curacion_total');
        });
    }

    public function down(): void
    {
        Schema::table('raid_combat_players', function (Blueprint $table) {
            $table->dropColumn(['curacion_total', 'debuffs_aplicados']);
        });
    }
};
