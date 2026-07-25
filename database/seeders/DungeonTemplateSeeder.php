<?php

namespace Database\Seeders;

use App\Models\DungeonTemplate;
use App\Models\MapEnemigo;
use App\Models\MapLugar;
use App\Models\MapNpc;
use App\Models\MapPlaneta;
use App\Models\MapSistema;
use App\Models\MapZona;
use Illuminate\Database\Seeder;

/**
 * Dungeon de ejemplo para el sistema de mazmorras rogue-like en equipo (ver
 * DungeonController/DungeonGeneratorService): un portal, un pool de enemigos
 * comunes y un jefe, listos para probar el flujo completo lobby → recorrido
 * 1v1 independiente → sala jefe → Combate RAID → recompensas.
 *
 * Totalmente idempotente e independiente de MapaGalacticoSeeder (usa
 * firstOrCreate en cada nivel, igual que aquel), así que puede correr solo
 * o después sin duplicar nada.
 */
class DungeonTemplateSeeder extends Seeder
{
    public function run(): void
    {
        $sistema = MapSistema::firstOrCreate(
            ['nombre' => 'Sistema Kaal'],
            [
                'rareza' => 'epico', 'hostilidad' => 'alto', 'faccion' => null,
                'color' => '#6b2fb3', 'costo_viaje' => 500, 'visible' => true,
                'historia' => 'Un sistema binario abandonado tras el colapso de una antigua civilización minera. De sus lunas huecas aún surgen señales que nadie ha vuelto a investigar... y regresado para contarlo.',
            ]
        );

        $planeta = MapPlaneta::firstOrCreate(
            ['nombre' => 'Kaal Umbra', 'SistemaID' => $sistema->id],
            [
                'SistemaID' => $sistema->id,
                'rareza' => 'epico', 'clima' => 'Subterráneo en ruinas', 'hostilidad' => 'alto', 'faccion' => null,
                'visible' => true,
                'historia' => 'Luna hueca perforada por kilómetros de fosas artificiales, excavadas por una civilización que desapareció sin dejar registro de qué buscaba... o de qué encontró.',
            ]
        );

        $zona = MapZona::firstOrCreate(
            ['nombre' => 'Fosas Selladas de Kaal', 'PlanetaID' => $planeta->id],
            [
                'PlanetaID' => $planeta->id,
                'rareza' => 'epico', 'hostilidad' => 'alto', 'faccion' => null,
                'estrato_social' => 'bajo', 'impuestos' => 0, 'visible' => true,
                'historia' => 'La entrada sellada a las fosas más profundas de Kaal Umbra. Los pocos equipos que han vuelto hablan de un guardián al fondo del laberinto.',
            ]
        );

        $portal = MapLugar::firstOrCreate(
            ['nombre' => 'Entrada a las Fosas Selladas', 'ZonaID' => $zona->id],
            [
                'ZonaID' => $zona->id,
                'tipo' => 'portal_dungeon', 'rareza' => 'epico', 'visible' => true,
                'historia' => 'Un sello de energía oscura recubre esta puerta. Solo un equipo completo puede activar el mecanismo de entrada.',
            ]
        );

        // Pool de encuentros normales (1v1 independiente por jugador en cada sala, ver DungeonController::enemigoVictory).
        $enemigosData = [
            ['nombre' => 'Excavador Enjambrado', 'tasa_aparicion' => 4, 'nivel' => 1, 'stats' => [
                'vida' => 50, 'escudo' => 0, 'defensa' => 9, 'ataque' => 11,
                'movimiento' => 13, 'iniciativa' => 13, 'punteria' => 9,
                'dano' => 6, 'dano_escudo' => 0, 'dano_perforante' => 0, 'forma' => 0,
            ]],
            ['nombre' => 'Espectro de las Fosas', 'tasa_aparicion' => 3, 'nivel' => 2, 'stats' => [
                'vida' => 70, 'escudo' => 10, 'defensa' => 12, 'ataque' => 14,
                'movimiento' => 10, 'iniciativa' => 11, 'punteria' => 10,
                'dano' => 8, 'dano_escudo' => 1, 'dano_perforante' => 1, 'forma' => 0,
            ]],
            ['nombre' => 'Centinela Óxido', 'tasa_aparicion' => 2, 'nivel' => 3, 'stats' => [
                'vida' => 95, 'escudo' => 25, 'defensa' => 16, 'ataque' => 17,
                'movimiento' => 7, 'iniciativa' => 8, 'punteria' => 12,
                'dano' => 10, 'dano_escudo' => 4, 'dano_perforante' => 2, 'forma' => 0,
            ]],
        ];

        $enemigos = [];
        foreach ($enemigosData as $e) {
            $enemigos[] = MapEnemigo::firstOrCreate(
                ['nombre' => $e['nombre']],
                array_merge($e['stats'], [
                    'nombre' => $e['nombre'], 'tipo' => 'ruina', 'visible' => true, 'nivel' => $e['nivel'],
                ])
            );
        }

        // No se lista en el portal como NPC normal (visible=false): solo se pelea vía Combate RAID del dungeon.
        $jefe = MapNpc::firstOrCreate(
            ['nombre' => 'Guardián de las Fosas', 'LugarID' => $portal->id],
            [
                'LugarID' => $portal->id, 'tipo' => 'jefe', 'profesion' => 'Guardián Ancestral',
                'visible' => false,
                'saludo' => 'Ningún equipo ha cruzado más allá de mí.',
                'vida' => 340, 'escudo' => 90, 'defensa' => 22, 'ataque' => 28,
                'movimiento' => 10, 'iniciativa' => 14, 'punteria' => 14,
                'dano' => 16, 'dano_escudo' => 6, 'dano_perforante' => 4,
                'forma' => 0, 'nivel' => 6, 'raid_slots' => 4,
            ]
        );

        $template = DungeonTemplate::firstOrCreate(
            ['nombre' => 'Fosas Selladas de Kaal'],
            [
                'map_zona_id' => $zona->id, 'jefe_npc_id' => $jefe->id,
                'salas_min' => 5, 'salas_max' => 8, 'visible' => true,
            ]
        );

        $template->enemigos()->syncWithoutDetaching(
            collect($enemigos)->mapWithKeys(fn ($enemigo, $i) => [
                $enemigo->id => [
                    'tasa_aparicion' => $enemigosData[$i]['tasa_aparicion'],
                    'nivel' => $enemigosData[$i]['nivel'],
                ],
            ])->all()
        );

        $portal->update(['dungeon_template_id' => $template->id]);
    }
}
