<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * 6 objetos de mejora de nave (rol_objetos tipo mejora_nave) — se instalan en
 * los 4 slots de una nave poseída (character_naves) para diferenciar naves
 * del mismo modelo entre sí. Cubren las 4 categorías pedidas: combate,
 * carga/salto, costo de reparación y cooldown de habilidad.
 */
return new class extends Migration
{
    private const NOMBRES = [
        'Motor Superlumínico',
        'Bodega de Carga Ampliada',
        'Reactor Avanzado de Escudo',
        'Cañones de Precisión Mk-II',
        'Casco de Aleación Ligera',
        'Módulo de Sobrecarga Táctica',
    ];

    public function up(): void
    {
        $now = now();

        // Cooldown de una habilidad de nave (tipo=nave) al azar, si existe alguna cargada —
        // sin esto, el objeto queda creado igual pero sin efecto hasta que un admin le
        // asigne la habilidad objetivo en el panel (campo "Habilidad afectada").
        $habilidadNaveId = DB::table('rol_habilidades')->where('tipo', 'nave')->inRandomOrder()->value('id');

        // Todas las filas deben compartir exactamente las mismas columnas para el insert
        // masivo — los campos de bono no usados por un ítem quedan en null.
        $base = [
            'rareza' => 'raro',
            'activo' => true,
            'created_at' => $now,
            'updated_at' => $now,
            'bono_ataque' => null,
            'bono_defensa' => null,
            'bono_punteria' => null,
            'bono_movimiento' => null,
            'bono_iniciativa' => null,
            'bono_vida' => null,
            'bono_escudo' => null,
            'bono_capacidad_carga' => null,
            'bono_capacidad_salto' => null,
            'bono_costo_reparacion' => null,
            'mejora_habilidad_id' => null,
            'bono_cooldown' => null,
        ];

        DB::table('rol_objetos')->insert([
            array_merge($base, [
                'nombre' => 'Motor Superlumínico',
                'tipo' => 'mejora_nave',
                'descripcion' => 'Propulsores de salto recalibrados para mayor autonomía hiperespacial.',
                'efecto' => '+3 capacidad de salto (combustible máximo)',
                'costo' => 800,
                'bono_capacidad_salto' => 3,
            ]),
            array_merge($base, [
                'nombre' => 'Bodega de Carga Ampliada',
                'tipo' => 'mejora_nave',
                'descripcion' => 'Compartimentos adicionales soldados al casco de carga.',
                'efecto' => '+10 capacidad de carga',
                'costo' => 650,
                'bono_capacidad_carga' => 10,
            ]),
            array_merge($base, [
                'nombre' => 'Reactor Avanzado de Escudo',
                'tipo' => 'mejora_nave',
                'descripcion' => 'Reactor secundario dedicado a sostener el generador de escudos.',
                'efecto' => '+6 escudo máximo',
                'costo' => 900,
                'bono_escudo' => 6,
            ]),
            array_merge($base, [
                'nombre' => 'Cañones de Precisión Mk-II',
                'tipo' => 'mejora_nave',
                'descripcion' => 'Servomecanismos de puntería acoplados a la batería principal.',
                'efecto' => '+4 ataque, +3 puntería',
                'costo' => 950,
                'bono_ataque' => 4,
                'bono_punteria' => 3,
            ]),
            array_merge($base, [
                'nombre' => 'Casco de Aleación Ligera',
                'tipo' => 'mejora_nave',
                'descripcion' => 'Aleación de bajo mantenimiento que reduce el trabajo de casco tras cada combate.',
                'efecto' => '−50 créditos en el costo de reparación (mínimo 0)',
                'costo' => 700,
                'bono_costo_reparacion' => -50,
            ]),
            array_merge($base, [
                'nombre' => 'Módulo de Sobrecarga Táctica',
                'tipo' => 'mejora_nave',
                'descripcion' => 'Banco de condensadores que permite reutilizar antes una habilidad de combate.',
                'efecto' => '−1 ronda de cooldown a una habilidad de nave específica',
                'costo' => 1000,
                'mejora_habilidad_id' => $habilidadNaveId,
                'bono_cooldown' => -1,
            ]),
        ]);
    }

    public function down(): void
    {
        DB::table('rol_objetos')->whereIn('nombre', self::NOMBRES)->where('tipo', 'mejora_nave')->delete();
    }
};
