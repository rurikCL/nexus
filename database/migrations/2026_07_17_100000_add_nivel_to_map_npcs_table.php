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
            $table->unsignedTinyInteger('nivel')->default(1)->after('forma');
        });
    }

    public function down(): void
    {
        Schema::table('map_npcs', function (Blueprint $table) {
            $table->dropColumn('nivel');
        });
    }
};
