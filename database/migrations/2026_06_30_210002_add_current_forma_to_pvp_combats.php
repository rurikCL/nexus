<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasColumn('pvp_combats', 'attacker_current_forma')) {
            Schema::table('pvp_combats', function (Blueprint $table) {
                $table->tinyInteger('attacker_current_forma')->nullable()->after('attacker_last_forma');
            });
        }

        if (! Schema::hasColumn('pvp_combats', 'defender_current_forma')) {
            Schema::table('pvp_combats', function (Blueprint $table) {
                $table->tinyInteger('defender_current_forma')->nullable()->after('attacker_current_forma');
            });
        }
    }

    public function down(): void
    {
        $columnsToDrop = [];

        if (Schema::hasColumn('pvp_combats', 'attacker_current_forma')) {
            $columnsToDrop[] = 'attacker_current_forma';
        }

        if (Schema::hasColumn('pvp_combats', 'defender_current_forma')) {
            $columnsToDrop[] = 'defender_current_forma';
        }

        if ($columnsToDrop === []) {
            return;
        }

        Schema::table('pvp_combats', function (Blueprint $table) use ($columnsToDrop) {
            $table->dropColumn($columnsToDrop);
        });
    }
};
