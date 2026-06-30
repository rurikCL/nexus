<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('map_planetas', function (Blueprint $table) {
            $table->text('eventos_importantes')->nullable()->after('historia');
        });
    }

    public function down(): void
    {
        Schema::table('map_planetas', function (Blueprint $table) {
            $table->dropColumn('eventos_importantes');
        });
    }
};
