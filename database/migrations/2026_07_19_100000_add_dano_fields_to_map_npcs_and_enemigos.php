<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Daño base de ataques normales (sin habilidad) para Jefes y Enemigos — mismo criterio que
     * `dano`/`dano_perforante` en sables/armas de personaje: el stat de Ataque/Puntería solo
     * decide si el golpe conecta, el daño real ahora viene de aquí (los Jefes siguen sumando
     * +nivel de dificultad encima de esta base).
     */
    public function up(): void
    {
        Schema::table('map_npcs', function (Blueprint $table) {
            $table->integer('dano')->default(0)->after('punteria');
            $table->integer('dano_escudo')->default(0)->after('dano');
            $table->integer('dano_perforante')->default(0)->after('dano_escudo');
        });

        Schema::table('map_enemigos', function (Blueprint $table) {
            $table->integer('dano')->default(0)->after('punteria');
            $table->integer('dano_escudo')->default(0)->after('dano');
            $table->integer('dano_perforante')->default(0)->after('dano_escudo');
        });
    }

    public function down(): void
    {
        Schema::table('map_npcs', function (Blueprint $table) {
            $table->dropColumn(['dano', 'dano_escudo', 'dano_perforante']);
        });

        Schema::table('map_enemigos', function (Blueprint $table) {
            $table->dropColumn(['dano', 'dano_escudo', 'dano_perforante']);
        });
    }
};
