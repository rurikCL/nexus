<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('pvp_combats', function (Blueprint $table) {
            $table->tinyInteger('attacker_current_forma')->nullable()->after('attacker_last_forma');
            $table->tinyInteger('defender_current_forma')->nullable()->after('attacker_current_forma');
        });
    }

    public function down(): void
    {
        Schema::table('pvp_combats', function (Blueprint $table) {
            $table->dropColumn(['attacker_current_forma', 'defender_current_forma']);
        });
    }
};
