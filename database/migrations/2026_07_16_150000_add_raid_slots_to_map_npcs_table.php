<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('map_npcs', function (Blueprint $table) {
            $table->unsignedTinyInteger('raid_slots')->default(4)->after('habilidad_4');
        });
    }

    public function down(): void
    {
        Schema::table('map_npcs', function (Blueprint $table) {
            $table->dropColumn('raid_slots');
        });
    }
};
