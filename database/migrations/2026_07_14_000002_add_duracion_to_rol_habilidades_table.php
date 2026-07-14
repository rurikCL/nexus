<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('rol_habilidades', function (Blueprint $table) {
            $table->unsignedTinyInteger('duracion')->default(2)->after('debuff')
                ->comment('Rondas completas que dura el buff/debuff de esta habilidad al aplicarse');
        });
    }

    public function down(): void
    {
        Schema::table('rol_habilidades', function (Blueprint $table) {
            $table->dropColumn('duracion');
        });
    }
};
