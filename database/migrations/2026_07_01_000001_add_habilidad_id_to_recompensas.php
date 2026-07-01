<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('recompensas', function (Blueprint $table) {
            $table->foreignId('habilidad_id')->nullable()->after('imagen')
                  ->constrained('rol_habilidades')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('recompensas', function (Blueprint $table) {
            $table->dropForeign(['habilidad_id']);
            $table->dropColumn('habilidad_id');
        });
    }
};
