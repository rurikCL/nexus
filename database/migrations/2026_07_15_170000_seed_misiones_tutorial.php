<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Cadena de misiones tutorial — 12 misiones encadenadas por hito
 * (hito_requerimiento / entregar_hito), una por sistema de juego.
 *
 * npc_id queda en null a propósito: qué NPC entrega cada misión varía por
 * entorno (dev/producción no comparten el mismo roster de map_npcs), así que
 * se asigna después desde el panel de Misiones editando cada fila.
 */
return new class extends Migration
{
    private function misiones(): array
    {
        return [
            [
                'nombre' => 'Primeros pasos',
                'mision' => 'Aprende a moverte por la galaxia. Viaja hasta la Zona de Entrenamiento.',
                'descripcion' => 'Introduce la navegación del Mapa Galáctico: sistema → planeta → zona → lugar.',
                'hito_requerimiento' => null,
                'entregar_hito' => 'tuto_01_mapa',
                'objetivos' => [
                    ['nombre' => 'Llegar a la Zona de Entrenamiento', 'tipo' => 'general', 'meta' => 1, 'unidad' => 'lugar'],
                ],
                'recompensas' => [
                    ['nombre' => '50 créditos', 'tipo' => 'creditos', 'valor' => 50],
                ],
            ],
            [
                'nombre' => 'Conócete a ti mismo',
                'mision' => 'Revisa tu ficha de personaje y equipa un arma desde el cajón de Equipo.',
                'descripcion' => 'Introduce la ficha de personaje, stats, e inventario/equipo.',
                'hito_requerimiento' => 'tuto_01_mapa',
                'entregar_hito' => 'tuto_02_personaje',
                'objetivos' => [
                    ['nombre' => 'Equipar un arma', 'tipo' => 'general', 'meta' => 1, 'unidad' => 'equipo'],
                ],
                'recompensas' => [
                    ['nombre' => '50 créditos', 'tipo' => 'creditos', 'valor' => 50],
                ],
            ],
            [
                'nombre' => 'El sable de un Jedi',
                'mision' => 'Ensambla y activa tu primer sable de luz.',
                'descripcion' => 'Introduce el Armado de Sable: núcleo, cristal, lente, emisor, estabilizador, empuñadura.',
                'hito_requerimiento' => 'tuto_02_personaje',
                'entregar_hito' => 'tuto_03_sable',
                'objetivos' => [
                    ['nombre' => 'Ensamblar y activar un sable', 'tipo' => 'general', 'meta' => 1, 'unidad' => 'sable'],
                ],
                'recompensas' => [
                    ['nombre' => '75 créditos', 'tipo' => 'creditos', 'valor' => 75],
                ],
            ],
            [
                'nombre' => 'Tu primera forma',
                'mision' => 'Completa una sesión de entrenamiento para aprender tu primera forma de combate.',
                'descripcion' => 'Introduce el sistema de Entrenamiento (sesiones/módulos) y las 7 formas de combate.',
                'hito_requerimiento' => 'tuto_03_sable',
                'entregar_hito' => 'tuto_04_entreno',
                'objetivos' => [
                    ['nombre' => 'Completar una sesión de entrenamiento', 'tipo' => 'entrenamiento', 'meta' => 1, 'unidad' => 'sesión'],
                ],
                'recompensas' => [
                    ['nombre' => 'Habilidad desbloqueada', 'tipo' => 'habilidad', 'valor' => 0],
                ],
            ],
            [
                'nombre' => 'El primer encargo',
                'mision' => 'Completa la tarea que te asignó tu tutor.',
                'descripcion' => 'Introduce el sistema de Tareas (asignadas por tutor, con recompensa en créditos).',
                'hito_requerimiento' => 'tuto_04_entreno',
                'entregar_hito' => 'tuto_05_tareas',
                'objetivos' => [
                    ['nombre' => 'Completar una tarea asignada', 'tipo' => 'tarea', 'meta' => 1, 'unidad' => 'tarea'],
                ],
                'recompensas' => [
                    ['nombre' => '75 créditos', 'tipo' => 'creditos', 'valor' => 75],
                ],
            ],
            [
                'nombre' => 'Suministros',
                'mision' => 'Compra un objeto en la tienda de un NPC vendedor.',
                'descripcion' => 'Introduce la tienda de NPCs (comprar objetos, gestionar inventario).',
                'hito_requerimiento' => 'tuto_05_tareas',
                'entregar_hito' => 'tuto_06_tienda',
                'objetivos' => [
                    ['nombre' => 'Comprar un objeto', 'tipo' => 'general', 'meta' => 1, 'unidad' => 'compra'],
                ],
                'recompensas' => [
                    ['nombre' => '50 créditos', 'tipo' => 'creditos', 'valor' => 50],
                ],
            ],
            [
                'nombre' => 'Duelo de práctica',
                'mision' => 'Vence a un NPC en combate por turnos.',
                'descripcion' => 'Introduce el combate por turnos: iniciativa, formas, habilidades, efectividad entre formas.',
                'hito_requerimiento' => 'tuto_06_tienda',
                'entregar_hito' => 'tuto_07_combate_npc',
                'objetivos' => [
                    ['nombre' => 'Vencer a un NPC en combate', 'tipo' => 'combate', 'meta' => 1, 'unidad' => 'victoria'],
                ],
                'recompensas' => [
                    ['nombre' => '75 créditos', 'tipo' => 'creditos', 'valor' => 75],
                    ['nombre' => 'Insignia: Primer Duelo', 'tipo' => 'insignia', 'valor' => 0],
                ],
            ],
            [
                'nombre' => 'Reto entre padawans',
                'mision' => 'Reta a otro jugador a un combate PvP y resuélvelo.',
                'descripcion' => 'Introduce Combates PvP: retar, aceptar/rechazar, apuestas de créditos.',
                'hito_requerimiento' => 'tuto_07_combate_npc',
                'entregar_hito' => 'tuto_08_pvp',
                'objetivos' => [
                    ['nombre' => 'Resolver un combate PvP', 'tipo' => 'combate', 'meta' => 1, 'unidad' => 'combate pvp'],
                ],
                'recompensas' => [
                    ['nombre' => 'Título: Retador', 'tipo' => 'titulo', 'valor' => 0],
                ],
            ],
            [
                'nombre' => 'Mensajero de la Orden',
                'mision' => 'Envía un mensaje directo y propón un intercambio a otro jugador.',
                'descripcion' => 'Introduce Mensajes directos e Intercambios (Trade) entre jugadores.',
                'hito_requerimiento' => 'tuto_08_pvp',
                'entregar_hito' => 'tuto_09_social',
                'objetivos' => [
                    ['nombre' => 'Enviar un mensaje directo', 'tipo' => 'general', 'meta' => 1, 'unidad' => 'mensaje'],
                    ['nombre' => 'Proponer un intercambio', 'tipo' => 'general', 'meta' => 1, 'unidad' => 'intercambio'],
                ],
                'recompensas' => [
                    ['nombre' => '50 créditos', 'tipo' => 'creditos', 'valor' => 50],
                ],
            ],
            [
                'nombre' => 'Alas entre las estrellas',
                'mision' => 'Equipa una nave y viaja a otro sistema.',
                'descripcion' => 'Introduce naves: equipar, combustible, viaje espacial.',
                'hito_requerimiento' => 'tuto_09_social',
                'entregar_hito' => 'tuto_10_naves',
                'objetivos' => [
                    ['nombre' => 'Equipar una nave y saltar de sistema', 'tipo' => 'general', 'meta' => 1, 'unidad' => 'viaje'],
                ],
                'recompensas' => [
                    ['nombre' => '75 créditos', 'tipo' => 'creditos', 'valor' => 75],
                ],
            ],
            [
                'nombre' => 'Tu lugar en la Orden',
                'mision' => 'Revisa el Ranking y la Temporada activa para ver dónde estás parado.',
                'descripcion' => 'Introduce Ranking, Competitivo, Temporadas y los tiers de la Orden.',
                'hito_requerimiento' => 'tuto_10_naves',
                'entregar_hito' => 'tuto_11_ranking',
                'objetivos' => [
                    ['nombre' => 'Revisar tu posición en el ranking', 'tipo' => 'general', 'meta' => 1, 'unidad' => 'consulta'],
                ],
                'recompensas' => [
                    ['nombre' => 'Medalla: Iniciado', 'tipo' => 'insignia', 'valor' => 0],
                ],
            ],
            [
                'nombre' => 'Graduación',
                'mision' => 'Preséntate ante el Gran Maestro para completar tu instrucción inicial.',
                'descripcion' => 'Cierre de la cadena tutorial — desbloquea el acceso pleno a la Orden.',
                'hito_requerimiento' => 'tuto_11_ranking',
                'entregar_hito' => 'tuto_completa',
                'objetivos' => [
                    ['nombre' => 'Hablar con el Gran Maestro', 'tipo' => 'general', 'meta' => 1, 'unidad' => 'conversación'],
                ],
                'recompensas' => [
                    ['nombre' => '150 créditos', 'tipo' => 'creditos', 'valor' => 150],
                    ['nombre' => 'Título: Graduado de la Orden', 'tipo' => 'titulo', 'valor' => 0],
                ],
            ],
        ];
    }

    public function up(): void
    {
        foreach ($this->misiones() as $orden => $m) {
            // Idempotente: si ya se sembró (mismo nombre), no duplica.
            if (DB::table('misiones')->where('nombre', $m['nombre'])->exists()) {
                continue;
            }

            $misionId = DB::table('misiones')->insertGetId([
                'nombre' => $m['nombre'],
                'mision' => $m['mision'],
                'descripcion' => $m['descripcion'],
                'tipo_mision' => 'individual',
                'npc_id' => null,
                'puntos_requeridos' => 0,
                'activa' => true,
                'orden' => $orden + 1,
                'hito_requerimiento' => $m['hito_requerimiento'],
                'entregar_hito' => $m['entregar_hito'],
                'created_at' => now(),
                'updated_at' => now(),
            ]);

            foreach ($m['objetivos'] as $obj) {
                DB::table('objetivos')->insert([
                    'mision_id' => $misionId,
                    'nombre' => $obj['nombre'],
                    'tipo' => $obj['tipo'],
                    'meta' => $obj['meta'],
                    'unidad' => $obj['unidad'],
                    'progreso_tipo' => 'conteo',
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
            }

            foreach ($m['recompensas'] as $rec) {
                DB::table('recompensas')->insert([
                    'mision_id' => $misionId,
                    'nombre' => $rec['nombre'],
                    'tipo' => $rec['tipo'],
                    'valor' => $rec['valor'],
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
            }
        }
    }

    public function down(): void
    {
        $nombres = array_column($this->misiones(), 'nombre');
        $ids = DB::table('misiones')->whereIn('nombre', $nombres)->pluck('id');

        DB::table('objetivos')->whereIn('mision_id', $ids)->delete();
        DB::table('recompensas')->whereIn('mision_id', $ids)->delete();
        DB::table('misiones')->whereIn('id', $ids)->delete();
    }
};
