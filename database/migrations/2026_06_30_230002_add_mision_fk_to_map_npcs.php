<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Null out any MisionID values that don't point to a valid misiones row
        // (prevents FK constraint violation on orphaned references)
        DB::statement('
            UPDATE map_npcs
            SET MisionID = NULL
            WHERE MisionID IS NOT NULL
              AND MisionID NOT IN (SELECT id FROM misiones)
        ');

        Schema::table('map_npcs', function (Blueprint $table) {
            $table->foreign('MisionID')->references('id')->on('misiones')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('map_npcs', function (Blueprint $table) {
            $table->dropForeign(['MisionID']);
        });
    }
};
