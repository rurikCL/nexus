<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('jefe_rankings', function (Blueprint $table) {
            $table->unsignedSmallInteger('enemigos_eliminados')->default(0)->after('rondas');
            $table->unsignedSmallInteger('cofres_abiertos')->default(0)->after('enemigos_eliminados');
        });
    }

    public function down(): void
    {
        Schema::table('jefe_rankings', function (Blueprint $table) {
            $table->dropColumn(['enemigos_eliminados', 'cofres_abiertos']);
        });
    }
};
