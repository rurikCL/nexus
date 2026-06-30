<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('pvp_combats', function (Blueprint $table) {
            $table->tinyInteger('attacker_fuerza')->default(0)->after('attacker_def_bonus');
            $table->tinyInteger('defender_fuerza')->default(0)->after('attacker_fuerza');
            $table->json('attacker_cooldowns')->nullable()->after('defender_fuerza');
            $table->json('defender_cooldowns')->nullable()->after('attacker_cooldowns');
            $table->json('attacker_buffs')->nullable()->after('defender_cooldowns');
            $table->json('defender_buffs')->nullable()->after('attacker_buffs');
            $table->json('attacker_debuffs')->nullable()->after('defender_buffs');
            $table->json('defender_debuffs')->nullable()->after('attacker_debuffs');
            $table->tinyInteger('attacker_last_forma')->nullable()->after('defender_debuffs');
            $table->tinyInteger('defender_last_forma')->nullable()->after('attacker_last_forma');
        });
    }

    public function down(): void
    {
        Schema::table('pvp_combats', function (Blueprint $table) {
            $table->dropColumn([
                'attacker_fuerza', 'defender_fuerza',
                'attacker_cooldowns', 'defender_cooldowns',
                'attacker_buffs', 'defender_buffs',
                'attacker_debuffs', 'defender_debuffs',
                'attacker_last_forma', 'defender_last_forma',
            ]);
        });
    }
};
