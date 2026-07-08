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
            $table->integer('bono_dano')->nullable()->after('bono_escudo');
            $table->integer('bono_critico')->nullable()->after('bono_dano');
            $table->integer('bono_fuerza')->nullable()->after('bono_critico');
            $table->integer('bono_generacion_fuerza')->nullable()->after('bono_fuerza');
        });
    }

    public function down(): void
    {
        Schema::table('rol_objetos', function (Blueprint $table) {
            $table->dropColumn(['bono_dano', 'bono_critico', 'bono_fuerza', 'bono_generacion_fuerza']);
        });
    }
};
