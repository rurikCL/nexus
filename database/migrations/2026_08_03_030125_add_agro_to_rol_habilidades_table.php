<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Agro que genera usar esta habilidad en Combate RAID (ver RaidCombatController::action /
 * elegirObjetivoPorAgro) — reemplaza las reglas fijas por tipo de efecto (debuff/curación).
 * Puede ser negativo para reducir el agro propio. Un golpe básico sin habilidad sigue sumando
 * +1 fijo (+1 extra si es crítico) — eso no depende de este campo.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('rol_habilidades', function (Blueprint $table) {
            $table->integer('agro')->default(1)->after('duracion');
        });
    }

    public function down(): void
    {
        Schema::table('rol_habilidades', function (Blueprint $table) {
            $table->dropColumn('agro');
        });
    }
};
