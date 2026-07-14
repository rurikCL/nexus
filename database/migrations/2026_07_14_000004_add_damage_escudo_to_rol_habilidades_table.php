<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('rol_habilidades', function (Blueprint $table) {
            $table->smallInteger('damage_escudo')->default(0)->after('damage')
                ->comment('Daño extra que esta habilidad hace SOLO al escudo (se suma a damage mientras el objetivo tenga escudo). Negativo = restaura escudo.');
        });
    }

    public function down(): void
    {
        Schema::table('rol_habilidades', function (Blueprint $table) {
            $table->dropColumn('damage_escudo');
        });
    }
};
