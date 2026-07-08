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
            $table->integer('bono_ataque')->nullable()->after('dano');
            $table->integer('bono_defensa')->nullable()->after('bono_ataque');
            $table->integer('bono_punteria')->nullable()->after('bono_defensa');
            $table->integer('bono_movimiento')->nullable()->after('bono_punteria');
            $table->string('color_hoja')->nullable()->after('bono_movimiento');
        });
    }

    public function down(): void
    {
        Schema::table('rol_objetos', function (Blueprint $table) {
            $table->dropColumn(['bono_ataque', 'bono_defensa', 'bono_punteria', 'bono_movimiento', 'color_hoja']);
        });
    }
};
