<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('raid_combats', function (Blueprint $table) {
            $table->timestamp('turn_started_at')->nullable()->after('turn_index');
        });
    }

    public function down(): void
    {
        Schema::table('raid_combats', function (Blueprint $table) {
            $table->dropColumn('turn_started_at');
        });
    }
};
