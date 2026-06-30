<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('characters', function (Blueprint $table) {
            $table->unsignedSmallInteger('vida')->nullable()->after('reputation');
            $table->unsignedSmallInteger('escudo')->nullable()->after('vida');
            $table->unsignedSmallInteger('defensa')->nullable()->after('escudo');
            $table->unsignedSmallInteger('ataque')->nullable()->after('defensa');
            $table->unsignedSmallInteger('movimiento')->nullable()->after('ataque');
            $table->unsignedSmallInteger('iniciativa')->nullable()->after('movimiento');
            $table->unsignedSmallInteger('punteria')->nullable()->after('iniciativa');
        });
    }

    public function down(): void
    {
        Schema::table('characters', function (Blueprint $table) {
            $table->dropColumn(['vida', 'escudo', 'defensa', 'ataque', 'movimiento', 'iniciativa', 'punteria']);
        });
    }
};
