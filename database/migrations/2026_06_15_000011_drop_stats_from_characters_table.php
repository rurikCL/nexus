<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('characters', function (Blueprint $table) {
            $table->dropColumn(['wins', 'losses', 'streak']);
        });
    }

    public function down(): void
    {
        Schema::table('characters', function (Blueprint $table) {
            $table->integer('wins')->default(0)->after('credits');
            $table->integer('losses')->default(0)->after('wins');
            $table->integer('streak')->default(0)->after('losses');
        });
    }
};
