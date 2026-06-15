<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('combats', function (Blueprint $table) {
            $table->foreignId('temporada_id')
                ->nullable()
                ->after('id')
                ->constrained('temporadas')
                ->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('combats', function (Blueprint $table) {
            $table->dropForeignIdFor(\App\Models\Temporada::class);
            $table->dropColumn('temporada_id');
        });
    }
};
