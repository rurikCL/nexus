<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('recompensas', function (Blueprint $table) {
            $table->foreignId('medalla_id')->nullable()->after('objeto_id')
                  ->constrained('medallas')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('recompensas', function (Blueprint $table) {
            $table->dropForeign(['medalla_id']);
            $table->dropColumn('medalla_id');
        });
    }
};
