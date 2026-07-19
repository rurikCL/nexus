<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Estados de combate (paralizado, aturdido, marcado, protegido, sangrado,
 * envenenado, debilitado, confundido, regeneracion) — array separado de
 * attacker_buffs/debuffs porque estos son modificadores planos de stat,
 * mientras que los estados afectan el flujo de turno, tiradas o HP directo.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('pvp_combats', function (Blueprint $table) {
            $table->json('attacker_estados')->nullable()->after('defender_debuffs');
            $table->json('defender_estados')->nullable()->after('attacker_estados');
        });
    }

    public function down(): void
    {
        Schema::table('pvp_combats', function (Blueprint $table) {
            $table->dropColumn(['attacker_estados', 'defender_estados']);
        });
    }
};
