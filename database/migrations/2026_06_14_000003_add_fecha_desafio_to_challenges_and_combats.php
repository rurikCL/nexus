<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('challenges', function (Blueprint $table) {
            $table->dateTime('fecha_desafio')->nullable()->after('stake');
        });

        // combats ya tiene scheduled_at — lo renombramos a fecha_desafio para consistencia
        Schema::table('combats', function (Blueprint $table) {
            $table->renameColumn('scheduled_at', 'fecha_desafio');
        });
    }

    public function down(): void
    {
        Schema::table('challenges', function (Blueprint $table) {
            $table->dropColumn('fecha_desafio');
        });
        Schema::table('combats', function (Blueprint $table) {
            $table->renameColumn('fecha_desafio', 'scheduled_at');
        });
    }
};
