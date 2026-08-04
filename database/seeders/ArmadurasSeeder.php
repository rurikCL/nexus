<?php

declare(strict_types=1);

namespace Database\Seeders;

use App\Models\CharacterArmadura;
use App\Models\RolObjeto;
use Illuminate\Database\Seeder;

/**
 * Catálogo base de armaduras (rol_objetos tipo "armadura") y de las mejoras que se
 * instalan en sus 4 slots (tipo "mejora_armadura").
 *
 * La armadura se equipa desde Mi Personaje → Equipo → Armadura y sus bonos se suman a
 * los del sable armado (ver Character::equipoBonos y CharacterArmadura::getBonosAttribute).
 * De todos los campos `bono_*` de rol_objetos, una armadura o mejora solo aplica los 9 de
 * CharacterArmadura::BONO_STATS — ataque, defensa, punteria, movimiento, iniciativa, vida,
 * escudo, fuerza y generacion_fuerza. Cualquier otro (bono_dano, bono_critico, …) es
 * exclusivo de los componentes de sable y aquí se ignoraría, así que no se usa.
 *
 * `movimiento` es lo que la interfaz llama **Agilidad**: el texto de `efecto` usa ese
 * nombre para que coincida con lo que ve el jugador en el catálogo y en su ficha.
 *
 * Idempotente: identifica cada ítem por (nombre, tipo) y reescribe el resto de los campos,
 * así que puede correrse tantas veces como haga falta para devolver el catálogo a su línea
 * base sin duplicar filas:
 *
 *     php artisan db:seed --class=ArmadurasSeeder
 */
class ArmadurasSeeder extends Seeder
{
    /**
     * Las 5 armaduras base. Cada una define un perfil distinto para que la elección
     * importe: la Túnica no da defensa pero mueve; la Mandaloriana aguanta pero pesa.
     */
    private const ARMADURAS = [
        [
            'nombre'      => 'Túnica Jedi',
            'rareza'      => 'comun',
            'costo'       => 400,
            'descripcion' => 'Tejido de fibra ligera de la Orden. No detiene un blaster, pero no estorba ninguna forma de sable.',
            'efecto'      => '+2 agilidad, +1 iniciativa, +1 Fuerza máxima',
            'bonos'       => ['movimiento' => 2, 'iniciativa' => 1, 'fuerza' => 1],
        ],
        [
            'nombre'      => 'Armadura de Huesos',
            'rareza'      => 'comun',
            'costo'       => 300,
            'descripcion' => 'Placas talladas de las criaturas que su portador cazó. Aterra más de lo que protege.',
            'efecto'      => '+2 ataque, +1 vida, −1 puntería',
            'bonos'       => ['ataque' => 2, 'vida' => 1, 'punteria' => -1],
        ],
        [
            'nombre'      => 'Armadura de Storm Trooper',
            'rareza'      => 'poco_comun',
            'costo'       => 650,
            'descripcion' => 'Blindaje de producción imperial: cobertura completa y visibilidad discutible.',
            'efecto'      => '+2 defensa, +2 escudo, −1 agilidad',
            'bonos'       => ['defensa' => 2, 'escudo' => 2, 'movimiento' => -1],
        ],
        [
            'nombre'      => 'Armadura de Clone Trooper',
            'rareza'      => 'raro',
            'costo'       => 1000,
            'descripcion' => 'Equipo de la Gran Ejército de la República, ajustado a medida y con servoasistencia básica.',
            'efecto'      => '+2 defensa, +1 puntería, +1 vida, +1 iniciativa',
            'bonos'       => ['defensa' => 2, 'punteria' => 1, 'vida' => 1, 'iniciativa' => 1],
        ],
        [
            'nombre'      => 'Armadura Mandaloriana',
            'rareza'      => 'epico',
            'costo'       => 2200,
            'descripcion' => 'Beskar forjado a mano, heredado y reparado durante generaciones. Resiste un impacto directo de sable.',
            'efecto'      => '+4 defensa, +3 vida, +2 escudo, −2 agilidad',
            'bonos'       => ['defensa' => 4, 'vida' => 3, 'escudo' => 2, 'movimiento' => -2],
        ],
    ];

    /**
     * Las 10 mejoras de armadura. Cubren los 9 stats bonificables, con un rango de
     * costo/rareza que va de parche barato a módulo de élite; las de mayor bono cargan
     * una contrapartida para que llenar los 4 slots sea una decisión y no un trámite.
     */
    private const MEJORAS = [
        [
            'nombre'      => 'Placas de Duracero',
            'rareza'      => 'comun',
            'costo'       => 250,
            'descripcion' => 'Planchas soldadas sobre las zonas vitales. La solución más barata que existe.',
            'efecto'      => '+2 defensa',
            'bonos'       => ['defensa' => 2],
        ],
        [
            'nombre'      => 'Malla Antiblaster',
            'rareza'      => 'comun',
            'costo'       => 300,
            'descripcion' => 'Capa interior de fibra dispersante que reparte el calor del impacto.',
            'efecto'      => '+1 defensa, +1 escudo',
            'bonos'       => ['defensa' => 1, 'escudo' => 1],
        ],
        [
            'nombre'      => 'Botas Antigravedad',
            'rareza'      => 'poco_comun',
            'costo'       => 420,
            'descripcion' => 'Repulsores de baja potencia en las suelas que alivian el peso del blindaje.',
            'efecto'      => '+2 agilidad',
            'bonos'       => ['movimiento' => 2],
        ],
        [
            'nombre'      => 'Visor Táctico',
            'rareza'      => 'poco_comun',
            'costo'       => 450,
            'descripcion' => 'Retícula proyectada en el casco que corrige la deriva del disparo a distancia.',
            'efecto'      => '+2 puntería',
            'bonos'       => ['punteria' => 2],
        ],
        [
            'nombre'      => 'Placa Vital Reforzada',
            'rareza'      => 'poco_comun',
            'costo'       => 500,
            'descripcion' => 'Peto de doble capa con gel de contención sobre los órganos.',
            'efecto'      => '+3 vida',
            'bonos'       => ['vida' => 3],
        ],
        [
            'nombre'      => 'Deflector de Bolsillo',
            'rareza'      => 'raro',
            'costo'       => 700,
            'descripcion' => 'Emisor de campo deflector acoplado al cinturón. Ruidoso, pero aguanta.',
            'efecto'      => '+3 escudo',
            'bonos'       => ['escudo' => 3],
        ],
        [
            'nombre'      => 'Exoesqueleto Servoasistido',
            'rareza'      => 'raro',
            'costo'       => 750,
            'descripcion' => 'Actuadores en brazos y hombros que multiplican la fuerza del golpe, a costa de reflejos.',
            'efecto'      => '+3 ataque, −1 iniciativa',
            'bonos'       => ['ataque' => 3, 'iniciativa' => -1],
        ],
        [
            'nombre'      => 'Reactor de Respaldo',
            'rareza'      => 'raro',
            'costo'       => 800,
            'descripcion' => 'Celda de energía secundaria que alimenta el equipo cuando la principal cae.',
            'efecto'      => '+2 Fuerza máxima, +1 generación de Fuerza por turno',
            'bonos'       => ['fuerza' => 2, 'generacion_fuerza' => 1],
        ],
        [
            'nombre'      => 'Módulo de Reflejos Neuronales',
            'rareza'      => 'epico',
            'costo'       => 1000,
            'descripcion' => 'Interfaz nuca-armadura que adelanta la respuesta motriz una fracción de segundo.',
            'efecto'      => '+2 iniciativa, +1 agilidad',
            'bonos'       => ['iniciativa' => 2, 'movimiento' => 1],
        ],
        [
            'nombre'      => 'Cristales de Resonancia Kyber',
            'rareza'      => 'legendario',
            'costo'       => 1500,
            'descripcion' => 'Esquirlas de kyber engastadas en el forro. Amplifican la conexión con la Fuerza de quien las lleva.',
            'efecto'      => '+2 Fuerza máxima, +2 generación de Fuerza por turno, +1 iniciativa',
            'bonos'       => ['fuerza' => 2, 'generacion_fuerza' => 2, 'iniciativa' => 1],
        ],
    ];

    public function run(): void
    {
        foreach (self::ARMADURAS as $item) {
            $this->upsert($item, 'armadura');
        }

        foreach (self::MEJORAS as $item) {
            $this->upsert($item, 'mejora_armadura');
        }
    }

    /**
     * Crea o reescribe un ítem del catálogo. Los 9 bonos se envían siempre — los que el
     * ítem no usa van en null — para que volver a correr el seeder deje la fila exactamente
     * en su valor base, incluso si alguien la editó a mano desde el panel de administración.
     */
    private function upsert(array $item, string $tipo): void
    {
        $bonos = collect(CharacterArmadura::BONO_STATS)
            ->mapWithKeys(fn ($stat) => ["bono_{$stat}" => $item['bonos'][$stat] ?? null])
            ->all();

        RolObjeto::updateOrCreate(
            ['nombre' => $item['nombre'], 'tipo' => $tipo],
            array_merge($bonos, [
                'rareza' => $item['rareza'],
                'descripcion' => $item['descripcion'],
                'efecto' => $item['efecto'],
                'costo' => $item['costo'],
                'activo' => true,
            ])
        );
    }
}
