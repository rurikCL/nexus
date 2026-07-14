<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('map_npcs', function (Blueprint $table) {
            $table->unsignedTinyInteger('forma')->default(0)->after('punteria')
                ->comment('Forma de combate del NPC (0 = universal, sin bono/penalización de efectividad)');
        });
    }

    public function down(): void
    {
        Schema::table('map_npcs', function (Blueprint $table) {
            $table->dropColumn('forma');
        });
    }
};
