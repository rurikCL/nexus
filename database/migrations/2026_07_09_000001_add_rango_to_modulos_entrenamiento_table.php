<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('modulos_entrenamiento', function (Blueprint $table) {
            $table->string('rango')->nullable()->after('estado'); // iniciado | padawan | caballero | maestro
        });
    }

    public function down(): void
    {
        Schema::table('modulos_entrenamiento', function (Blueprint $table) {
            $table->dropColumn('rango');
        });
    }
};
