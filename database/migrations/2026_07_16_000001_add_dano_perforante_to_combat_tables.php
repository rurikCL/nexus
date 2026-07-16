<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('rol_habilidades', function (Blueprint $table) {
            $table->unsignedSmallInteger('damage_perforante')->default(0)->after('damage_escudo')
                ->comment('Daño que ignora el escudo y pasa directo a la vida, independiente de si el objetivo tiene escudo.');
        });

        Schema::table('rol_objetos', function (Blueprint $table) {
            $table->unsignedSmallInteger('dano_perforante')->nullable()->after('dano')
                ->comment('Daño perforante fijo del arma (solo si tipo = arma).');
            $table->integer('bono_dano_perforante')->nullable()->after('bono_critico')
                ->comment('Bono de daño perforante que aporta este componente de sable.');
        });
    }

    public function down(): void
    {
        Schema::table('rol_habilidades', function (Blueprint $table) {
            $table->dropColumn('damage_perforante');
        });

        Schema::table('rol_objetos', function (Blueprint $table) {
            $table->dropColumn(['dano_perforante', 'bono_dano_perforante']);
        });
    }
};
