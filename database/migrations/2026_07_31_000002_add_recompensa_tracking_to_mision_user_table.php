<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('mision_user', function (Blueprint $table) {
            $table->timestamp('participacion_otorgada_at')->nullable()->after('progreso_json');
            $table->timestamp('final_reclamada_at')->nullable()->after('participacion_otorgada_at');
        });
    }

    public function down(): void
    {
        Schema::table('mision_user', function (Blueprint $table) {
            $table->dropColumn(['participacion_otorgada_at', 'final_reclamada_at']);
        });
    }
};
