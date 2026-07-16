<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Campos que permiten a un rol_objeto de tipo "mejora_nave" modificar la nave
 * en la que se instala: carga/salto, costo de reparación, y reducción del
 * cooldown de una habilidad específica de nave. Los bonos de combate
 * (ataque/defensa/punteria/movimiento/iniciativa/vida/escudo) ya existen en
 * esta tabla (se reutilizan, igual que hacen los componentes de sable).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('rol_objetos', function (Blueprint $table) {
            $table->integer('bono_capacidad_carga')->nullable()->after('energia_maxima');
            $table->integer('bono_capacidad_salto')->nullable()->after('bono_capacidad_carga');
            $table->integer('bono_costo_reparacion')->nullable()->after('bono_capacidad_salto');
            $table->foreignId('mejora_habilidad_id')->nullable()->after('bono_costo_reparacion')
                ->constrained('rol_habilidades')->nullOnDelete();
            $table->integer('bono_cooldown')->nullable()->after('mejora_habilidad_id');
        });
    }

    public function down(): void
    {
        Schema::table('rol_objetos', function (Blueprint $table) {
            $table->dropConstrainedForeignId('mejora_habilidad_id');
            $table->dropColumn(['bono_capacidad_carga', 'bono_capacidad_salto', 'bono_costo_reparacion', 'bono_cooldown']);
        });
    }
};
