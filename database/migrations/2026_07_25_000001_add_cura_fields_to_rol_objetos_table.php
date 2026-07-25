<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Campos del nuevo tipo de objeto 'utilizable' (Kits Médicos, Generadores de Escudo):
 * cuánta vida/escudo restauran al consumirse. A diferencia de bono_vida/bono_escudo
 * (bonos pasivos mientras el objeto está equipado), estos son un efecto instantáneo de
 * un solo uso — ver DungeonController::usarObjeto.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('rol_objetos', function (Blueprint $table) {
            $table->unsignedSmallInteger('cura_vida')->nullable()->after('bono_generacion_fuerza');
            $table->unsignedSmallInteger('cura_escudo')->nullable()->after('cura_vida');
        });
    }

    public function down(): void
    {
        Schema::table('rol_objetos', function (Blueprint $table) {
            $table->dropColumn(['cura_vida', 'cura_escudo']);
        });
    }
};
