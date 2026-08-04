<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Catálogo inicial de armaduras (rol_objetos tipo "armadura") y de las mejoras que
 * se instalan en sus 4 slots (tipo "mejora_armadura"). La armadura se equipa desde
 * Mi Personaje → Equipo → Armadura; sus bonos se suman a los del sable activo.
 */
return new class extends Migration
{
    private const ARMADURAS = [
        'Coraza de Beskar',
        'Túnica de Combate Jedi',
        'Armadura Pesada Mandaloriana',
    ];

    private const MEJORAS = [
        'Placa Reforzada',
        'Generador de Escudo Personal',
        'Servomotores de Asistencia',
        'Amplificador de Fuerza',
    ];

    public function up(): void
    {
        $now = now();

        // Todas las filas deben compartir exactamente las mismas columnas para el insert
        // masivo — los campos de bono no usados por un ítem quedan en null.
        $base = [
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
            'bono_fuerza' => null,
            'bono_generacion_fuerza' => null,
        ];

        DB::table('rol_objetos')->insert([
            array_merge($base, [
                'nombre' => 'Coraza de Beskar',
                'tipo' => 'armadura',
                'rareza' => 'raro',
                'descripcion' => 'Placas de acero mandaloriano capaces de resistir un impacto directo de sable.',
                'efecto' => '+3 defensa, +2 vida',
                'costo' => 1200,
                'bono_defensa' => 3,
                'bono_vida' => 2,
            ]),
            array_merge($base, [
                'nombre' => 'Túnica de Combate Jedi',
                'tipo' => 'armadura',
                'rareza' => 'poco_comun',
                'descripcion' => 'Tejido reforzado y ligero, pensado para no estorbar en las formas acrobáticas.',
                'efecto' => '+2 agilidad, +1 iniciativa',
                'costo' => 500,
                'bono_movimiento' => 2,
                'bono_iniciativa' => 1,
            ]),
            array_merge($base, [
                'nombre' => 'Armadura Pesada Mandaloriana',
                'tipo' => 'armadura',
                'rareza' => 'epico',
                'descripcion' => 'Blindaje completo con generador de escudo integrado, a costa de movilidad.',
                'efecto' => '+4 defensa, +3 escudo, −1 agilidad',
                'costo' => 2000,
                'bono_defensa' => 4,
                'bono_escudo' => 3,
                'bono_movimiento' => -1,
            ]),

            array_merge($base, [
                'nombre' => 'Placa Reforzada',
                'tipo' => 'mejora_armadura',
                'rareza' => 'poco_comun',
                'descripcion' => 'Plancha extra soldada sobre las zonas vitales de la armadura.',
                'efecto' => '+2 defensa',
                'costo' => 350,
                'bono_defensa' => 2,
            ]),
            array_merge($base, [
                'nombre' => 'Generador de Escudo Personal',
                'tipo' => 'mejora_armadura',
                'rareza' => 'raro',
                'descripcion' => 'Emisor de campo deflector acoplado al peto de la armadura.',
                'efecto' => '+3 escudo',
                'costo' => 600,
                'bono_escudo' => 3,
            ]),
            array_merge($base, [
                'nombre' => 'Servomotores de Asistencia',
                'tipo' => 'mejora_armadura',
                'rareza' => 'raro',
                'descripcion' => 'Actuadores en las articulaciones que compensan el peso del blindaje.',
                'efecto' => '+2 agilidad',
                'costo' => 550,
                'bono_movimiento' => 2,
            ]),
            array_merge($base, [
                'nombre' => 'Amplificador de Fuerza',
                'tipo' => 'mejora_armadura',
                'rareza' => 'epico',
                'descripcion' => 'Cristales resonantes engastados en el forro que amplifican la conexión con la Fuerza.',
                'efecto' => '+2 Fuerza máxima, +1 generación de Fuerza por turno',
                'costo' => 900,
                'bono_fuerza' => 2,
                'bono_generacion_fuerza' => 1,
            ]),
        ]);
    }

    public function down(): void
    {
        DB::table('rol_objetos')->whereIn('nombre', self::ARMADURAS)->where('tipo', 'armadura')->delete();
        DB::table('rol_objetos')->whereIn('nombre', self::MEJORAS)->where('tipo', 'mejora_armadura')->delete();
    }
};
