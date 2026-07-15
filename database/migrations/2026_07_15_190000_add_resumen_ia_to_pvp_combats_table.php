<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('pvp_combats', function (Blueprint $table) {
            $table->text('resumen_ia')->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('pvp_combats', function (Blueprint $table) {
            $table->dropColumn('resumen_ia');
        });
    }
};
