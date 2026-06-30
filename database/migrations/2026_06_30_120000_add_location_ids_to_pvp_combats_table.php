<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('pvp_combats', function (Blueprint $table) {
            $table->unsignedBigInteger('zona_id')->nullable()->after('lugar_id');
            $table->unsignedBigInteger('planeta_id')->nullable()->after('zona_id');
            $table->unsignedBigInteger('sistema_id')->nullable()->after('planeta_id');
        });
    }

    public function down(): void
    {
        Schema::table('pvp_combats', function (Blueprint $table) {
            $table->dropColumn(['zona_id', 'planeta_id', 'sistema_id']);
        });
    }
};
