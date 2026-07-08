<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('rol_objetos', function (Blueprint $table) {
            $table->integer('consumo_energia')->nullable()->after('bono_generacion_fuerza');
            $table->integer('energia_maxima')->nullable()->after('consumo_energia');
        });
    }

    public function down(): void
    {
        Schema::table('rol_objetos', function (Blueprint $table) {
            $table->dropColumn(['consumo_energia', 'energia_maxima']);
        });
    }
};
