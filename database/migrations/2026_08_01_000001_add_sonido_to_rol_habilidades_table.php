<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('rol_habilidades', function (Blueprint $table) {
            $table->string('sonido')->nullable()->after('duracion')
                ->comment('Slug del sonido (catálogo rol_sonidos) que se reproduce al usar la habilidad. Vacío = sin sonido.');
        });
    }

    public function down(): void
    {
        Schema::table('rol_habilidades', function (Blueprint $table) {
            $table->dropColumn('sonido');
        });
    }
};
