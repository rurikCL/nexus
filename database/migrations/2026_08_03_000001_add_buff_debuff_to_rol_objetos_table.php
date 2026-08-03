<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Permite que un objeto 'utilizable' aplique estados de combate (mismo registro reservado que
 * app/Support/Combat/AplicaEstadosCombate.php: paralizado, protegido, deflectar, revivir, etc.)
 * al usarse — igual que ya podía hacer una RolHabilidad. 'revivir' es el único que además puede
 * targetear a un compañero caído (hp<=0) — ver DungeonController::usarObjeto.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('rol_objetos', function (Blueprint $table) {
            $table->json('buff')->nullable()->after('cura_escudo');
            $table->json('debuff')->nullable()->after('buff');
        });
    }

    public function down(): void
    {
        Schema::table('rol_objetos', function (Blueprint $table) {
            $table->dropColumn(['buff', 'debuff']);
        });
    }
};
