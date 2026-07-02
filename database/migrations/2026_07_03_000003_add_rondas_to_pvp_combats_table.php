<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('pvp_combats', function (Blueprint $table) {
            $table->unsignedInteger('ronda')->default(1)->after('current_turn');
            $table->unsignedTinyInteger('ronda_turno')->default(0)->after('ronda');
        });
    }

    public function down(): void
    {
        Schema::table('pvp_combats', function (Blueprint $table) {
            $table->dropColumn(['ronda', 'ronda_turno']);
        });
    }
};
