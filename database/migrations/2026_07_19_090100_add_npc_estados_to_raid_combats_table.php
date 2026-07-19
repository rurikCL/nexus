<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('raid_combats', function (Blueprint $table) {
            $table->json('npc_estados')->nullable()->after('npc_debuffs');
        });
    }

    public function down(): void
    {
        Schema::table('raid_combats', function (Blueprint $table) {
            $table->dropColumn('npc_estados');
        });
    }
};
