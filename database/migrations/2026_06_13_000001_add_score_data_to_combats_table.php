<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('combats', function (Blueprint $table) {
            $table->json('score_data')->nullable()->after('winner');
        });
    }

    public function down(): void
    {
        Schema::table('combats', function (Blueprint $table) {
            $table->dropColumn('score_data');
        });
    }
};
