<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('characters', function (Blueprint $table) {
            $table->json('habilidades_por_forma')->nullable()->after('habilidad_4');
            $table->tinyInteger('current_forma')->default(1)->after('habilidades_por_forma');
        });
    }

    public function down(): void
    {
        Schema::table('characters', function (Blueprint $table) {
            $table->dropColumn(['habilidades_por_forma', 'current_forma']);
        });
    }
};
