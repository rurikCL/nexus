<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('temporadas', function (Blueprint $table) {
            $table->boolean('asignacion_automatica')->default(true)->after('divide_por_rango');
        });
    }

    public function down(): void
    {
        Schema::table('temporadas', function (Blueprint $table) {
            $table->dropColumn('asignacion_automatica');
        });
    }
};
