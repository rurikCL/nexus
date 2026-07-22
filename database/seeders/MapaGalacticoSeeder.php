<?php

namespace Database\Seeders;

use App\Models\MapLugar;
use App\Models\MapNpc;
use App\Models\MapPlaneta;
use App\Models\MapSistema;
use App\Models\MapZona;
use Illuminate\Database\Seeder;

class MapaGalacticoSeeder extends Seeder
{
    public function run(): void
    {
        foreach ([$this->sistemaSith(), $this->sistemaRepublica()] as $sistemaData) {
            $sistema = MapSistema::firstOrCreate(
                ['nombre' => $sistemaData['sistema']['nombre']],
                $sistemaData['sistema']
            );

            foreach ($sistemaData['planetas'] as $planetaData) {
                $planeta = MapPlaneta::firstOrCreate(
                    ['nombre' => $planetaData['planeta']['nombre'], 'SistemaID' => $sistema->id],
                    array_merge($planetaData['planeta'], ['SistemaID' => $sistema->id])
                );

                foreach ($planetaData['zonas'] as $zonaData) {
                    $zona = MapZona::firstOrCreate(
                        ['nombre' => $zonaData['zona']['nombre'], 'PlanetaID' => $planeta->id],
                        array_merge($zonaData['zona'], ['PlanetaID' => $planeta->id])
                    );

                    foreach ($zonaData['lugares'] as $lugarData) {
                        $lugar = MapLugar::firstOrCreate(
                            ['nombre' => $lugarData['lugar']['nombre'], 'ZonaID' => $zona->id],
                            array_merge($lugarData['lugar'], ['ZonaID' => $zona->id])
                        );

                        foreach ($lugarData['npcs'] as $npcData) {
                            MapNpc::firstOrCreate(
                                ['nombre' => $npcData['nombre'], 'LugarID' => $lugar->id],
                                array_merge($npcData, ['LugarID' => $lugar->id])
                            );
                        }
                    }
                }
            }
        }
    }

    /** Arma un NPC con stats base razonables según su tipo; $overrides sobreescribe cualquier campo. */
    private function npc(string $nombre, string $tipo, array $overrides = []): array
    {
        $base = match ($tipo) {
            'jefe' => [
                'vida' => 260, 'escudo' => 70, 'defensa' => 24, 'ataque' => 30,
                'movimiento' => 16, 'iniciativa' => 16, 'punteria' => 16,
                'dano' => 15, 'dano_escudo' => 6, 'dano_perforante' => 4,
                'forma' => 0, 'nivel' => 5, 'raid_slots' => 4,
            ],
            'hostil' => [
                'vida' => 65, 'escudo' => 10, 'defensa' => 11, 'ataque' => 13,
                'movimiento' => 9, 'iniciativa' => 9, 'punteria' => 9,
                'dano' => 7, 'dano_escudo' => 1, 'dano_perforante' => 1,
                'forma' => 0, 'nivel' => 2, 'raid_slots' => 4,
            ],
            'entrenador' => [
                'vida' => 90, 'escudo' => 15, 'defensa' => 15, 'ataque' => 15,
                'movimiento' => 10, 'iniciativa' => 10, 'punteria' => 10,
                'dano' => 8, 'dano_escudo' => 2, 'dano_perforante' => 1,
                'forma' => 0, 'nivel' => 2, 'raid_slots' => 4,
            ],
            default => [
                'vida' => 25, 'escudo' => 0, 'defensa' => 6, 'ataque' => 4,
                'movimiento' => 5, 'iniciativa' => 5, 'punteria' => 5,
                'dano' => 2, 'dano_escudo' => 0, 'dano_perforante' => 0,
                'forma' => 0, 'nivel' => 1, 'raid_slots' => 4,
            ],
        };

        return array_merge([
            'nombre' => $nombre, 'tipo' => $tipo,
            'profesion' => null, 'faccion' => null,
            'imagen_mini' => null, 'imagen' => null,
            'saludo' => null, 'interaccion' => null, 'prompt' => null,
            'MisionID' => null, 'urlInteraccion' => null, 'visible' => true,
            'hito_requerimiento' => null, 'fecha_inicio' => null, 'fecha_fin' => null,
            'habilidad_1' => null, 'habilidad_2' => null, 'habilidad_3' => null, 'habilidad_4' => null,
        ], $base, $overrides);
    }

    /* ─────────────────────────────────────────────────────────────
       SISTEMA SITH — Kressh: hostil, facción Sith, templos y contrabando
    ───────────────────────────────────────────────────────────── */
    private function sistemaSith(): array
    {
        return [
            'sistema' => [
                'nombre' => 'Sistema Kressh',
                'rareza' => 'legendario',
                'hostilidad' => 'extremo',
                'faccion' => 'Sith',
                'color' => '#7a1128',
                'costo_viaje' => 800,
                'visible' => true,
                'historia' => 'Un sistema binario devorado por la sombra, cuna ancestral de los Señores Sith. Sus mundos vibran con energía oscura y sus rutas de comercio ilegal alimentan el mercado negro de media galaxia.',
            ],
            'planetas' => [
                // ── Kressh Prime ──
                [
                    'planeta' => [
                        'nombre' => 'Kressh Prime',
                        'rareza' => 'legendario', 'clima' => 'Árido volcánico', 'hostilidad' => 'extremo', 'faccion' => 'Sith',
                        'visible' => true,
                        'historia' => 'El mundo capital del sistema, donde los primeros Señores Sith erigieron sus templos sobre ríos de lava y energía oscura.',
                    ],
                    'zonas' => [
                        [
                            'zona' => [
                                'nombre' => 'Meseta de los Templos',
                                'rareza' => 'legendario', 'hostilidad' => 'alto', 'faccion' => 'Sith',
                                'estrato_social' => 'alto', 'impuestos' => 0, 'visible' => true,
                                'historia' => 'La meseta sagrada donde se alzan los templos más antiguos, construidos sobre las venas de energía oscura del planeta.',
                            ],
                            'lugares' => [
                                [
                                    'lugar' => ['nombre' => 'Gran Templo de Kressh', 'tipo' => 'interior', 'rareza' => 'legendario', 'visible' => true, 'historia' => 'El templo más antiguo del sistema, sede del Consejo de Señores Sith.'],
                                    'npcs' => [
                                        $this->npc('Lord Maliceth Vraan', 'jefe', ['profesion' => 'Señor Sith', 'faccion' => 'Sith', 'forma' => 6, 'nivel' => 6, 'vida' => 320, 'ataque' => 34, 'saludo' => 'Arrodíllate ante el verdadero poder de la Fuerza.']),
                                        $this->npc('Sacerdotisa Nyra Kel', 'entrenador', ['profesion' => 'Guardiana de Rituales', 'faccion' => 'Sith', 'forma' => 3, 'saludo' => 'Los rituales antiguos exigen disciplina. ¿La tienes?']),
                                    ],
                                ],
                                [
                                    'lugar' => ['nombre' => 'Cámara de los Ancestros', 'tipo' => 'interior', 'rareza' => 'epico', 'visible' => true, 'historia' => 'Criptas donde descansan los primeros Señores Sith, custodiadas por ecos de su poder.'],
                                    'npcs' => [
                                        $this->npc('Espectro de Darth Kressh', 'hostil', ['profesion' => 'Aparición Ancestral', 'faccion' => 'Sith', 'forma' => 7, 'nivel' => 3, 'saludo' => 'Mi ira aún no se ha extinguido...']),
                                        $this->npc('Acólito Berrun', 'neutral', ['profesion' => 'Guía de Tumbas', 'faccion' => 'Sith', 'saludo' => 'No despiertes a los que duermen aquí.']),
                                    ],
                                ],
                                [
                                    'lugar' => ['nombre' => 'Patio de Duelos Sangrientos', 'tipo' => 'exterior', 'rareza' => 'raro', 'visible' => true, 'historia' => 'Arena donde los aprendices Sith resuelven sus disputas a filo de sable.'],
                                    'npcs' => [
                                        $this->npc('Maestro de Duelos Thex', 'entrenador', ['profesion' => 'Instructor de Combate', 'faccion' => 'Sith', 'forma' => 2, 'saludo' => 'Demuéstrame tu forma o retírate.']),
                                        $this->npc('Aprendiz Sith Ilyra', 'hostil', ['profesion' => 'Aprendiz', 'faccion' => 'Sith', 'forma' => 4, 'saludo' => 'Otro rival que aplastar en mi ascenso.']),
                                    ],
                                ],
                            ],
                        ],
                        [
                            'zona' => [
                                'nombre' => 'Distrito de las Sombras',
                                'rareza' => 'raro', 'hostilidad' => 'medio', 'faccion' => 'Sith',
                                'estrato_social' => 'bajo', 'impuestos' => 15.5, 'visible' => true,
                                'historia' => 'Callejones y bodegas donde el contrabando prospera bajo la mirada indiferente de los Señores Sith.',
                            ],
                            'lugares' => [
                                [
                                    'lugar' => ['nombre' => 'Mercado Negro de Kressh', 'tipo' => 'interior', 'rareza' => 'raro', 'visible' => true, 'historia' => 'Aquí se comercia lo que en cualquier otro sistema estaría prohibido.'],
                                    'npcs' => [
                                        $this->npc('Traficante Voss Kade', 'mercader', ['profesion' => 'Traficante', 'faccion' => 'Sith', 'saludo' => 'Tengo justo lo que buscas... por un precio.']),
                                        $this->npc('Bhurn el Silencioso', 'vendedor', ['profesion' => 'Vendedor de Reliquias', 'faccion' => 'Sith', 'saludo' => 'Reliquias sith auténticas. No pregunto de dónde vienen.']),
                                    ],
                                ],
                                [
                                    'lugar' => ['nombre' => 'Guarida de Contrabandistas', 'tipo' => 'interior', 'rareza' => 'poco_comun', 'visible' => true, 'historia' => 'Escondite de bandas que operan rutas ilegales entre Kressh y Vhess.'],
                                    'npcs' => [
                                        $this->npc('Capitana Rell Dax', 'neutral', ['profesion' => 'Jefa de Contrabandistas', 'saludo' => 'Aquí nadie hace preguntas, y a mí me gusta así.']),
                                        $this->npc('Matón Grix', 'hostil', ['profesion' => 'Matón', 'saludo' => 'Este no es lugar para curiosos.']),
                                    ],
                                ],
                                [
                                    'lugar' => ['nombre' => 'Muelle de Carga Clandestino', 'tipo' => 'exterior', 'rareza' => 'comun', 'visible' => true, 'historia' => 'Punto de carga y descarga fuera del alcance de cualquier autoridad.'],
                                    'npcs' => [
                                        $this->npc('Estibador Ozz', 'neutral', ['profesion' => 'Estibador', 'saludo' => 'Muévete, tengo cargamento que no puede esperar.']),
                                    ],
                                ],
                            ],
                        ],
                        [
                            'zona' => [
                                'nombre' => 'Fortaleza de Guarnición Umbra',
                                'rareza' => 'epico', 'hostilidad' => 'alto', 'faccion' => 'Sith',
                                'estrato_social' => 'medio', 'impuestos' => 0, 'visible' => true,
                                'historia' => 'Bastión militar que protege el acceso a la Meseta de los Templos.',
                            ],
                            'lugares' => [
                                [
                                    'lugar' => ['nombre' => 'Cuartel de la Guardia Sith', 'tipo' => 'interior', 'rareza' => 'raro', 'visible' => true, 'historia' => 'Cuartel donde se forman los soldados de élite al servicio de los Señores Sith.'],
                                    'npcs' => [
                                        $this->npc('Comandante Draes Kir', 'hostil', ['profesion' => 'Comandante', 'faccion' => 'Sith', 'forma' => 5, 'nivel' => 3, 'vida' => 100, 'saludo' => 'Ningún intruso sale vivo de esta fortaleza.']),
                                        $this->npc('Recluta Sith Meva', 'hostil', ['profesion' => 'Recluta', 'faccion' => 'Sith', 'saludo' => 'Aún entreno, pero ya sé cortar.']),
                                    ],
                                ],
                                [
                                    'lugar' => ['nombre' => 'Arsenal Oscuro', 'tipo' => 'interior', 'rareza' => 'raro', 'visible' => true, 'historia' => 'Depósito de armas y sables sith forjados en las fraguas volcánicas de Kressh.'],
                                    'npcs' => [
                                        $this->npc('Armero Sith Trask', 'vendedor', ['profesion' => 'Armero', 'faccion' => 'Sith', 'saludo' => 'Cada hoja que forjo ha probado sangre antes de salir de aquí.']),
                                    ],
                                ],
                            ],
                        ],
                    ],
                ],
                // ── Malakar ──
                [
                    'planeta' => [
                        'nombre' => 'Malakar',
                        'rareza' => 'raro', 'clima' => 'Subterráneo helado', 'hostilidad' => 'alto', 'faccion' => 'Sith',
                        'visible' => true,
                        'historia' => 'Luna minera convertida en prisión para los enemigos de los Señores Sith; sus túneles ocultan vetas de cristal oscuro.',
                    ],
                    'zonas' => [
                        [
                            'zona' => [
                                'nombre' => 'Minas de Cristal Oscuro',
                                'rareza' => 'raro', 'hostilidad' => 'alto', 'faccion' => 'Sith',
                                'estrato_social' => 'bajo', 'impuestos' => 0, 'visible' => true,
                                'historia' => 'Vetas de cristal oscuro extraídas a costa de mano de obra forzada.',
                            ],
                            'lugares' => [
                                [
                                    'lugar' => ['nombre' => 'Pozo de Trabajos Forzados', 'tipo' => 'exterior', 'rareza' => 'comun', 'visible' => true, 'historia' => 'Prisioneros extraen cristal oscuro bajo vigilancia constante.'],
                                    'npcs' => [
                                        $this->npc('Capataz Rhun', 'hostil', ['profesion' => 'Capataz', 'faccion' => 'Sith', 'saludo' => '¡De vuelta al trabajo, o pruebas el látigo!']),
                                        $this->npc('Prisionero Yeza', 'neutral', ['profesion' => 'Prisionero', 'saludo' => 'Llevo años aquí... ya perdí la cuenta.']),
                                    ],
                                ],
                                [
                                    'lugar' => ['nombre' => 'Túneles de Cristal Oscuro', 'tipo' => 'interior', 'rareza' => 'poco_comun', 'visible' => true, 'historia' => 'Galerías profundas donde el cristal pulsa con energía oscura.'],
                                    'npcs' => [
                                        $this->npc('Minero Sith Dobbs', 'neutral', ['profesion' => 'Minero', 'faccion' => 'Sith', 'saludo' => 'Cuidado por dónde pisas, estos túneles colapsan fácil.']),
                                        $this->npc('Guardián de Túnel', 'hostil', ['profesion' => 'Guardián', 'faccion' => 'Sith', 'saludo' => 'Nadie roba cristal oscuro bajo mi guardia.']),
                                    ],
                                ],
                            ],
                        ],
                        [
                            'zona' => [
                                'nombre' => 'Prisión Umbra',
                                'rareza' => 'raro', 'hostilidad' => 'extremo', 'faccion' => 'Sith',
                                'estrato_social' => 'bajo', 'impuestos' => 0, 'visible' => true,
                                'historia' => 'La prisión más temida del sistema, reservada para los enemigos más peligrosos de los Sith.',
                            ],
                            'lugares' => [
                                [
                                    'lugar' => ['nombre' => 'Bloque de Celdas Alfa', 'tipo' => 'interior', 'rareza' => 'epico', 'visible' => true, 'historia' => 'Celdas de máxima seguridad selladas con cerraduras de energía oscura.'],
                                    'npcs' => [
                                        $this->npc('Alcaide Vex Moro', 'entrenador', ['profesion' => 'Alcaide', 'faccion' => 'Sith', 'forma' => 5, 'nivel' => 3, 'vida' => 110, 'saludo' => 'Nadie escapa de mi prisión. Nadie.']),
                                        $this->npc('Prisionero Rebelde Kass', 'hostil', ['profesion' => 'Prisionero Rebelde', 'saludo' => 'Ayúdame a salir de aquí... o quítate de mi camino.']),
                                    ],
                                ],
                                [
                                    'lugar' => ['nombre' => 'Patio de Ejecuciones', 'tipo' => 'exterior', 'rareza' => 'raro', 'visible' => true, 'historia' => 'Donde se imparte la justicia sith: rápida, pública y sin apelación.'],
                                    'npcs' => [
                                        $this->npc('Verdugo Silencioso', 'hostil', ['profesion' => 'Verdugo', 'faccion' => 'Sith', 'forma' => 1, 'saludo' => 'No hay palabras para los condenados.']),
                                    ],
                                ],
                            ],
                        ],
                    ],
                ],
                // ── Vhess ──
                [
                    'planeta' => [
                        'nombre' => 'Vhess',
                        'rareza' => 'raro', 'clima' => 'Pantanoso tóxico', 'hostilidad' => 'medio', 'faccion' => null,
                        'visible' => true,
                        'historia' => 'Mundo pantanoso al margen de toda ley, refugio predilecto de piratas y contrabandistas que comercian con los Sith.',
                    ],
                    'zonas' => [
                        [
                            'zona' => [
                                'nombre' => 'Puerto Libre de Vhess',
                                'rareza' => 'raro', 'hostilidad' => 'medio', 'faccion' => null,
                                'estrato_social' => 'medio', 'impuestos' => 8, 'visible' => true,
                                'historia' => 'El único puerto donde una nave puede atracar sin hacer preguntas ni responderlas.',
                            ],
                            'lugares' => [
                                [
                                    'lugar' => ['nombre' => 'Cantina del Vacío', 'tipo' => 'interior', 'rareza' => 'poco_comun', 'visible' => true, 'historia' => 'Punto de encuentro para todo tipo de fauna espacial, de contrabandistas a cazarrecompensas.'],
                                    'npcs' => [
                                        $this->npc('Tabernera Sula Renn', 'aliado', ['profesion' => 'Tabernera', 'saludo' => 'Siéntate, forastero. Aquí las historias se pagan con tragos.']),
                                        $this->npc('Cazarrecompensas Dorn', 'neutral', ['profesion' => 'Cazarrecompensas', 'saludo' => 'No busco problemas... a menos que tengan precio.']),
                                    ],
                                ],
                                [
                                    'lugar' => ['nombre' => 'Muelles de Atraque', 'tipo' => 'exterior', 'rareza' => 'comun', 'visible' => true, 'historia' => 'Decenas de naves de dudosa procedencia atracan aquí cada día.'],
                                    'npcs' => [
                                        $this->npc('Jefe de Muelle Fenn', 'mercader', ['profesion' => 'Jefe de Muelle', 'saludo' => 'Paga el atraque o busca otro planeta.']),
                                    ],
                                ],
                                [
                                    'lugar' => ['nombre' => 'Casa de Cambio de Vhess', 'tipo' => 'interior', 'rareza' => 'poco_comun', 'visible' => true, 'historia' => 'Aquí se lava más crédito del que cualquier auditor republicano querría admitir.'],
                                    'npcs' => [
                                        $this->npc('Cambista Miro Quell', 'vendedor', ['profesion' => 'Cambista', 'saludo' => 'Tu crédito, sin preguntas ni comisiones... bueno, pocas preguntas.']),
                                    ],
                                ],
                            ],
                        ],
                        [
                            'zona' => [
                                'nombre' => 'Bajos Fondos de Vhess',
                                'rareza' => 'raro', 'hostilidad' => 'alto', 'faccion' => null,
                                'estrato_social' => 'bajo', 'impuestos' => 0, 'visible' => true,
                                'historia' => 'Laberinto de callejones donde operan las bandas piratas más peligrosas del sistema.',
                            ],
                            'lugares' => [
                                [
                                    'lugar' => ['nombre' => 'Refugio de Piratas', 'tipo' => 'interior', 'rareza' => 'epico', 'visible' => true, 'historia' => 'Cuartel general de la flota pirata que controla las rutas de contrabando de Vhess.'],
                                    'npcs' => [
                                        $this->npc('Capitán Pirata Rask Dune', 'jefe', ['profesion' => 'Capitán Pirata', 'forma' => 4, 'nivel' => 5, 'saludo' => 'Esta es mi ruta, mi puerto y mi ley.']),
                                        $this->npc('Timonel Yko', 'hostil', ['profesion' => 'Timonel', 'saludo' => 'El capitán no recibe visitas sin invitación.']),
                                    ],
                                ],
                                [
                                    'lugar' => ['nombre' => 'Callejón del Trueque', 'tipo' => 'exterior', 'rareza' => 'comun', 'visible' => true, 'historia' => 'Mercado informal donde todo tiene un precio, incluso el silencio.'],
                                    'npcs' => [
                                        $this->npc('Buhonero Ness', 'mercader', ['profesion' => 'Buhonero', 'saludo' => 'Mercancía de todo tipo, todo el tiempo.']),
                                    ],
                                ],
                            ],
                        ],
                        [
                            'zona' => [
                                'nombre' => 'Astillero Pirata Kaas',
                                'rareza' => 'poco_comun', 'hostilidad' => 'medio', 'faccion' => null,
                                'estrato_social' => 'bajo', 'impuestos' => 0, 'visible' => true,
                                'historia' => 'Astillero clandestino donde se repintan y desmontan naves robadas.',
                            ],
                            'lugares' => [
                                [
                                    'lugar' => ['nombre' => 'Hangar de Naves Robadas', 'tipo' => 'interior', 'rareza' => 'raro', 'visible' => true, 'historia' => 'Docenas de naves con identificadores borrados esperan nuevo dueño.'],
                                    'npcs' => [
                                        $this->npc('Mecánico Vhess Dray', 'vendedor_naves', ['profesion' => 'Mecánico', 'saludo' => 'Esta nave "cambió de dueño" hace poco. Precio negociable.']),
                                        $this->npc('Vigía Armado', 'hostil', ['profesion' => 'Vigía', 'saludo' => 'Nadie mira la mercancía sin pagar primero.']),
                                    ],
                                ],
                            ],
                        ],
                    ],
                ],
                // ── Nihil Menor ──
                [
                    'planeta' => [
                        'nombre' => 'Nihil Menor',
                        'rareza' => 'epico', 'clima' => 'Vacío asteroidal', 'hostilidad' => 'extremo', 'faccion' => 'Sith',
                        'visible' => true,
                        'historia' => 'Asteroide fortificado que sirve de avanzada militar sith y guarda una cripta sellada de eras pasadas.',
                    ],
                    'zonas' => [
                        [
                            'zona' => [
                                'nombre' => 'Avanzada de Guerra Nihil',
                                'rareza' => 'epico', 'hostilidad' => 'extremo', 'faccion' => 'Sith',
                                'estrato_social' => 'alto', 'impuestos' => 0, 'visible' => true,
                                'historia' => 'Base militar que vigila las rutas de acceso al corazón del sistema Kressh.',
                            ],
                            'lugares' => [
                                [
                                    'lugar' => ['nombre' => 'Sala de Mando Oscura', 'tipo' => 'interior', 'rareza' => 'epico', 'visible' => true, 'historia' => 'Desde aquí se coordinan las flotas sith que patrullan el sistema.'],
                                    'npcs' => [
                                        $this->npc('General Sith Korbrin', 'jefe', ['profesion' => 'General', 'faccion' => 'Sith', 'forma' => 5, 'nivel' => 6, 'vida' => 300, 'saludo' => 'Ningún ejército republicano ha cruzado esta línea. El tuyo tampoco lo hará.']),
                                        $this->npc('Oficial de Enlace Vey', 'hostil', ['profesion' => 'Oficial de Enlace', 'faccion' => 'Sith', 'saludo' => 'Identifícate o serás abatido.']),
                                    ],
                                ],
                                [
                                    'lugar' => ['nombre' => 'Plataforma de Lanzamiento', 'tipo' => 'exterior', 'rareza' => 'raro', 'visible' => true, 'historia' => 'Cazas sith despegan constantemente desde esta plataforma expuesta al vacío.'],
                                    'npcs' => [
                                        $this->npc('Piloto de Caza Ren', 'hostil', ['profesion' => 'Piloto', 'faccion' => 'Sith', 'saludo' => 'Mi escuadrón no deja pasar intrusos.']),
                                    ],
                                ],
                            ],
                        ],
                        [
                            'zona' => [
                                'nombre' => 'Cripta Olvidada',
                                'rareza' => 'legendario', 'hostilidad' => 'alto', 'faccion' => 'Sith',
                                'estrato_social' => 'alto', 'impuestos' => 0, 'visible' => true,
                                'historia' => 'Restos de una civilización sith anterior incluso a Kressh Prime, sellados por miedo a lo que guardan.',
                            ],
                            'lugares' => [
                                [
                                    'lugar' => ['nombre' => 'Cámara Sellada de Nihil', 'tipo' => 'interior', 'rareza' => 'legendario', 'visible' => true, 'historia' => 'Una puerta que nadie ha logrado abrir en mil años... hasta ahora.'],
                                    'npcs' => [
                                        $this->npc('Guardián Espectral', 'jefe', ['profesion' => 'Guardián Ancestral', 'forma' => 7, 'nivel' => 6, 'vida' => 280, 'saludo' => 'Solo quien domine la oscuridad puede cruzar este umbral.']),
                                        $this->npc('Erudito Exiliado Baast', 'mision', ['profesion' => 'Erudito Exiliado', 'saludo' => 'He pasado años descifrando estos muros. Puedo contarte lo que sé.']),
                                    ],
                                ],
                                [
                                    'lugar' => ['nombre' => 'Ruinas Exteriores', 'tipo' => 'exterior', 'rareza' => 'raro', 'visible' => true, 'historia' => 'Restos de estructuras colapsadas que rodean la cripta sellada.'],
                                    'npcs' => [
                                        $this->npc('Saqueador de Tumbas Coz', 'hostil', ['profesion' => 'Saqueador', 'saludo' => 'Estas ruinas son mías. Búscate otras.']),
                                    ],
                                ],
                            ],
                        ],
                    ],
                ],
            ],
        ];
    }

    /* ─────────────────────────────────────────────────────────────
       SISTEMA REPÚBLICA — Coraxis: seguro, comercio, saber
    ───────────────────────────────────────────────────────────── */
    private function sistemaRepublica(): array
    {
        return [
            'sistema' => [
                'nombre' => 'Sistema Coraxis',
                'rareza' => 'legendario',
                'hostilidad' => 'seguro',
                'faccion' => 'República',
                'color' => '#2e6fb3',
                'costo_viaje' => 300,
                'visible' => true,
                'historia' => 'Corazón político y comercial de la República, hogar de sus mayores urbes, archivos de sabiduría milenaria y rutas comerciales que conectan un millar de mundos.',
            ],
            'planetas' => [
                // ── Coraxis Prime ──
                [
                    'planeta' => [
                        'nombre' => 'Coraxis Prime',
                        'rareza' => 'legendario', 'clima' => 'Templado urbano', 'hostilidad' => 'seguro', 'faccion' => 'República',
                        'visible' => true,
                        'historia' => 'Capital del sistema y sede del Senado de la República, cubierta de cúpulas de cristal y torres de comercio.',
                    ],
                    'zonas' => [
                        [
                            'zona' => [
                                'nombre' => 'Distrito de las Cúpulas de Cristal',
                                'rareza' => 'legendario', 'hostilidad' => 'seguro', 'faccion' => 'República',
                                'estrato_social' => 'alto', 'impuestos' => 12, 'visible' => true,
                                'historia' => 'El corazón financiero de la República, donde se cierran los tratos que mueven la galaxia.',
                            ],
                            'lugares' => [
                                [
                                    'lugar' => ['nombre' => 'Gran Bazar de Coraxis', 'tipo' => 'exterior', 'rareza' => 'epico', 'visible' => true, 'historia' => 'El mercado techado más grande de la República, con mercancías de un millar de mundos.'],
                                    'npcs' => [
                                        $this->npc('Mercader Jefe Talos Renn', 'mercader', ['profesion' => 'Mercader Jefe', 'faccion' => 'República', 'saludo' => 'Bienvenido al Gran Bazar. Aquí encuentras lo que sea, de donde sea.']),
                                        $this->npc('Cambista Real Doro', 'vendedor', ['profesion' => 'Cambista', 'faccion' => 'República', 'saludo' => 'Créditos republicanos al mejor tipo de cambio de la galaxia.']),
                                    ],
                                ],
                                [
                                    'lugar' => ['nombre' => 'Torre de Comercio Estelar', 'tipo' => 'interior', 'rareza' => 'epico', 'visible' => true, 'historia' => 'Sede de los mayores consorcios comerciales de la República.'],
                                    'npcs' => [
                                        $this->npc('Magnate Corvin Aldis', 'aliado', ['profesion' => 'Magnate Comercial', 'faccion' => 'República', 'saludo' => 'Cada acuerdo bien negociado fortalece a la República.']),
                                        $this->npc('Secretaria Nuvi', 'neutral', ['profesion' => 'Secretaria Ejecutiva', 'saludo' => 'El magnate está ocupado, pero puedo agendarte una cita.']),
                                    ],
                                ],
                            ],
                        ],
                        [
                            'zona' => [
                                'nombre' => 'Distrito de los Archivos',
                                'rareza' => 'legendario', 'hostilidad' => 'seguro', 'faccion' => 'República',
                                'estrato_social' => 'alto', 'impuestos' => 0, 'visible' => true,
                                'historia' => 'Hogar de la mayor colección de conocimiento de la galaxia conocida.',
                            ],
                            'lugares' => [
                                [
                                    'lugar' => ['nombre' => 'Gran Biblioteca de Coraxis', 'tipo' => 'interior', 'rareza' => 'legendario', 'visible' => true, 'historia' => 'Millones de textos, holocrones y registros históricos catalogados a lo largo de siglos.'],
                                    'npcs' => [
                                        $this->npc('Archivista Mayor Sella Home', 'mision', ['profesion' => 'Archivista Mayor', 'faccion' => 'República', 'saludo' => 'Cada pregunta que traes puede tener respuesta entre estos estantes.']),
                                        $this->npc('Escriba Novato Pell', 'neutral', ['profesion' => 'Escriba', 'saludo' => 'Aún estoy aprendiendo el sistema de catalogación. Ten paciencia.']),
                                    ],
                                ],
                                [
                                    'lugar' => ['nombre' => 'Archivo de Datos Restringidos', 'tipo' => 'interior', 'rareza' => 'epico', 'visible' => true, 'historia' => 'Sección de la biblioteca reservada para información sensible del Senado.'],
                                    'npcs' => [
                                        $this->npc('Guardián de Archivos Renn Koa', 'entrenador', ['profesion' => 'Guardián de Archivos', 'faccion' => 'República', 'forma' => 3, 'saludo' => 'El acceso restringido se gana, no se pide.']),
                                    ],
                                ],
                            ],
                        ],
                        [
                            'zona' => [
                                'nombre' => 'Plaza de la Convergencia',
                                'rareza' => 'raro', 'hostilidad' => 'seguro', 'faccion' => 'República',
                                'estrato_social' => 'medio', 'impuestos' => 0, 'visible' => true,
                                'historia' => 'Plaza pública que conmemora la fundación de la República y sus fundadores.',
                            ],
                            'lugares' => [
                                [
                                    'lugar' => ['nombre' => 'Monumento a los Fundadores', 'tipo' => 'exterior', 'rareza' => 'raro', 'visible' => true, 'historia' => 'Estatuas de los senadores que firmaron la Carta Fundacional de la República.'],
                                    'npcs' => [
                                        $this->npc('Guía Turístico Essa', 'aliado', ['profesion' => 'Guía Turístico', 'saludo' => '¿Quieres conocer la historia de nuestra fundación? Sígueme.']),
                                    ],
                                ],
                                [
                                    'lugar' => ['nombre' => 'Jardines Suspendidos', 'tipo' => 'exterior', 'rareza' => 'poco_comun', 'visible' => true, 'historia' => 'Jardines flotantes que embellecen el distrito administrativo de Coraxis Prime.'],
                                    'npcs' => [
                                        $this->npc('Jardinero Real Tob', 'neutral', ['profesion' => 'Jardinero Real', 'saludo' => 'Cada flor de este jardín representa un mundo miembro.']),
                                    ],
                                ],
                            ],
                        ],
                        [
                            'zona' => [
                                'nombre' => 'Cuartel de la Guardia de la República',
                                'rareza' => 'raro', 'hostilidad' => 'bajo', 'faccion' => 'República',
                                'estrato_social' => 'medio', 'impuestos' => 0, 'visible' => true,
                                'historia' => 'Base de operaciones de la Guardia de la República y sede de entrenamiento Jedi en Coraxis.',
                            ],
                            'lugares' => [
                                [
                                    'lugar' => ['nombre' => 'Cuartel General de la Guardia', 'tipo' => 'interior', 'rareza' => 'raro', 'visible' => true, 'historia' => 'Centro de operaciones de la fuerza de seguridad que protege la capital.'],
                                    'npcs' => [
                                        $this->npc('Capitana Vell Marn', 'entrenador', ['profesion' => 'Capitana de la Guardia', 'faccion' => 'República', 'forma' => 1, 'saludo' => 'La disciplina es la primera línea de defensa de la República.']),
                                        $this->npc('Cadete Roh', 'aliado', ['profesion' => 'Cadete', 'faccion' => 'República', 'saludo' => 'Algún día seré capitán, como Vell Marn.']),
                                    ],
                                ],
                                [
                                    'lugar' => ['nombre' => 'Sala de Entrenamiento Jedi', 'tipo' => 'interior', 'rareza' => 'epico', 'visible' => true, 'historia' => 'Dojo donde los Jedi visitantes entrenan a la próxima generación de guardianes.'],
                                    'npcs' => [
                                        $this->npc('Maestro Jedi Aro Ventis', 'jefe', ['profesion' => 'Maestro Jedi', 'faccion' => 'República', 'forma' => 3, 'nivel' => 5, 'vida' => 240, 'ataque' => 26, 'saludo' => 'Solo quien supera mi prueba de sable demuestra estar listo.']),
                                        $this->npc('Padawan Dessa', 'aliado', ['profesion' => 'Padawan', 'faccion' => 'República', 'saludo' => 'Mi maestro dice que aún me falta paciencia.']),
                                    ],
                                ],
                            ],
                        ],
                    ],
                ],
                // ── Havren ──
                [
                    'planeta' => [
                        'nombre' => 'Havren',
                        'rareza' => 'raro', 'clima' => 'Templado fértil', 'hostilidad' => 'seguro', 'faccion' => 'República',
                        'visible' => true,
                        'historia' => 'El granero del sistema, cuyos mercados agrícolas abastecen a media República.',
                    ],
                    'zonas' => [
                        [
                            'zona' => [
                                'nombre' => 'Mercado de Havren',
                                'rareza' => 'raro', 'hostilidad' => 'seguro', 'faccion' => 'República',
                                'estrato_social' => 'medio', 'impuestos' => 6, 'visible' => true,
                                'historia' => 'El mercado agrícola más grande del sistema, donde se subastan cosechas de un centenar de granjas.',
                            ],
                            'lugares' => [
                                [
                                    'lugar' => ['nombre' => 'Feria de Especias de Havren', 'tipo' => 'exterior', 'rareza' => 'poco_comun', 'visible' => true, 'historia' => 'Puestos coloridos donde se venden especias y productos de todo el sistema.'],
                                    'npcs' => [
                                        $this->npc('Especiero Yuun', 'mercader', ['profesion' => 'Especiero', 'saludo' => 'Prueba esta especia de Solenne, cambiará tu forma de cocinar.']),
                                        $this->npc('Catador Real', 'neutral', ['profesion' => 'Catador', 'saludo' => 'Trabajo para el Senado, catando cada lote antes de su venta.']),
                                    ],
                                ],
                                [
                                    'lugar' => ['nombre' => 'Casa de Subastas Havren', 'tipo' => 'interior', 'rareza' => 'raro', 'visible' => true, 'historia' => 'Donde se rematan las cosechas más exclusivas del sistema.'],
                                    'npcs' => [
                                        $this->npc('Subastador Romm', 'vendedor', ['profesion' => 'Subastador', 'saludo' => '¡Vendido! Al mejor postor, como siempre.']),
                                    ],
                                ],
                            ],
                        ],
                        [
                            'zona' => [
                                'nombre' => 'Campos de la Cosecha Dorada',
                                'rareza' => 'poco_comun', 'hostilidad' => 'seguro', 'faccion' => 'República',
                                'estrato_social' => 'bajo', 'impuestos' => 3, 'visible' => true,
                                'historia' => 'Extensos campos de cultivo que se pierden en el horizonte.',
                            ],
                            'lugares' => [
                                [
                                    'lugar' => ['nombre' => 'Granja Comunal', 'tipo' => 'exterior', 'rareza' => 'comun', 'visible' => true, 'historia' => 'Una de las cientos de granjas comunales que sostienen la economía de Havren.'],
                                    'npcs' => [
                                        $this->npc('Granjera Mira Toss', 'aliado', ['profesion' => 'Granjera', 'saludo' => 'Esta cosecha es la mejor en años. La Fuerza sonríe a Havren.']),
                                        $this->npc('Capataz de Cosecha', 'neutral', ['profesion' => 'Capataz', 'saludo' => 'Necesitamos manos extra antes de la próxima helada.']),
                                    ],
                                ],
                            ],
                        ],
                    ],
                ],
                // ── Solenne ──
                [
                    'planeta' => [
                        'nombre' => 'Solenne',
                        'rareza' => 'epico', 'clima' => 'Templado oceánico', 'hostilidad' => 'seguro', 'faccion' => 'República',
                        'visible' => true,
                        'historia' => 'Mundo académico cuyas ciudadelas de saber forman a los eruditos y diplomáticos de la República.',
                    ],
                    'zonas' => [
                        [
                            'zona' => [
                                'nombre' => 'Ciudadela del Saber',
                                'rareza' => 'epico', 'hostilidad' => 'seguro', 'faccion' => 'República',
                                'estrato_social' => 'alto', 'impuestos' => 0, 'visible' => true,
                                'historia' => 'Complejo de bibliotecas y observatorios dedicado a preservar el conocimiento de la galaxia.',
                            ],
                            'lugares' => [
                                [
                                    'lugar' => ['nombre' => 'Biblioteca Central de Solenne', 'tipo' => 'interior', 'rareza' => 'epico', 'visible' => true, 'historia' => 'Segunda biblioteca más grande de la República, especializada en historia natural y astrografía.'],
                                    'npcs' => [
                                        $this->npc('Bibliotecaria Suprema Yen Kalis', 'mision', ['profesion' => 'Bibliotecaria Suprema', 'faccion' => 'República', 'saludo' => 'Quien busca conocimiento siempre es bienvenido aquí.']),
                                        $this->npc('Investigador Dux', 'neutral', ['profesion' => 'Investigador', 'saludo' => 'Llevo tres años estudiando las rutas comerciales sith. Fascinante y aterrador.']),
                                    ],
                                ],
                                [
                                    'lugar' => ['nombre' => 'Observatorio de Solenne', 'tipo' => 'interior', 'rareza' => 'raro', 'visible' => true, 'historia' => 'Telescopios de precisión que cartografían las rutas hiperespaciales conocidas.'],
                                    'npcs' => [
                                        $this->npc('Astrónoma Vey Lira', 'aliado', ['profesion' => 'Astrónoma', 'saludo' => 'Cada estrella nueva es una ruta comercial en potencia.']),
                                    ],
                                ],
                            ],
                        ],
                        [
                            'zona' => [
                                'nombre' => 'Academia de la República',
                                'rareza' => 'epico', 'hostilidad' => 'seguro', 'faccion' => 'República',
                                'estrato_social' => 'alto', 'impuestos' => 0, 'visible' => true,
                                'historia' => 'Institución donde se forman los futuros oficiales, diplomáticos y caballeros de la República.',
                            ],
                            'lugares' => [
                                [
                                    'lugar' => ['nombre' => 'Salón de Instrucción', 'tipo' => 'interior', 'rareza' => 'raro', 'visible' => true, 'historia' => 'Aulas donde se imparten las doctrinas históricas y estratégicas de la República.'],
                                    'npcs' => [
                                        $this->npc('Instructor Boren Kade', 'entrenador', ['profesion' => 'Instructor', 'faccion' => 'República', 'forma' => 2, 'saludo' => 'La historia se repite para quien no la estudia.']),
                                        $this->npc('Estudiante Aplicado Finn', 'aliado', ['profesion' => 'Estudiante', 'saludo' => 'Estudio duro. Algún día representaré a mi mundo en el Senado.']),
                                    ],
                                ],
                                [
                                    'lugar' => ['nombre' => 'Patio de Prácticas', 'tipo' => 'exterior', 'rareza' => 'poco_comun', 'visible' => true, 'historia' => 'Espacio abierto donde los cadetes practican esgrima y formas de sable bajo supervisión.'],
                                    'npcs' => [
                                        $this->npc('Duelista Jedi Sana Vel', 'entrenador', ['profesion' => 'Duelista Jedi', 'faccion' => 'República', 'forma' => 4, 'saludo' => 'Ven, practiquemos una forma juntos.']),
                                    ],
                                ],
                            ],
                        ],
                        [
                            'zona' => [
                                'nombre' => 'Puerto de Solenne',
                                'rareza' => 'poco_comun', 'hostilidad' => 'seguro', 'faccion' => 'República',
                                'estrato_social' => 'medio', 'impuestos' => 4, 'visible' => true,
                                'historia' => 'Puerto diplomático donde embajadores de todo el sistema llegan a Solenne.',
                            ],
                            'lugares' => [
                                [
                                    'lugar' => ['nombre' => 'Muelle Diplomático', 'tipo' => 'exterior', 'rareza' => 'poco_comun', 'visible' => true, 'historia' => 'Reservado para naves de embajadores y delegaciones oficiales.'],
                                    'npcs' => [
                                        $this->npc('Embajador Corin Vass', 'aliado', ['profesion' => 'Embajador', 'faccion' => 'República', 'saludo' => 'La diplomacia gana más guerras de las que la espada jamás ganará.']),
                                    ],
                                ],
                            ],
                        ],
                    ],
                ],
                // ── Ilyra Menor ──
                [
                    'planeta' => [
                        'nombre' => 'Ilyra Menor',
                        'rareza' => 'raro', 'clima' => 'Selvático luminoso', 'hostilidad' => 'bajo', 'faccion' => 'República',
                        'visible' => true,
                        'historia' => 'Santuario natural protegido por la República, conocido por sus corrientes de la Fuerza inusualmente fuertes.',
                    ],
                    'zonas' => [
                        [
                            'zona' => [
                                'nombre' => 'Santuario de la Luz',
                                'rareza' => 'epico', 'hostilidad' => 'bajo', 'faccion' => 'República',
                                'estrato_social' => 'alto', 'impuestos' => 0, 'visible' => true,
                                'historia' => 'Templo de meditación construido sobre una de las corrientes de la Fuerza más puras conocidas.',
                            ],
                            'lugares' => [
                                [
                                    'lugar' => ['nombre' => 'Templo de Meditación', 'tipo' => 'interior', 'rareza' => 'epico', 'visible' => true, 'historia' => 'Los Jedi visitan este templo para profundizar su conexión con la Fuerza luminosa.'],
                                    'npcs' => [
                                        $this->npc('Maestra Vidente OrenTal', 'jefe', ['profesion' => 'Maestra Vidente', 'faccion' => 'República', 'forma' => 3, 'nivel' => 5, 'vida' => 220, 'ataque' => 22, 'saludo' => 'Solo quien encuentra la calma puede superar mi prueba.']),
                                        $this->npc('Monje Silente Ka', 'neutral', ['profesion' => 'Monje', 'saludo' => '...']),
                                    ],
                                ],
                                [
                                    'lugar' => ['nombre' => 'Jardín de Cristales Vivos', 'tipo' => 'exterior', 'rareza' => 'raro', 'visible' => true, 'historia' => 'Cristales kyber en bruto crecen naturalmente en este jardín protegido.'],
                                    'npcs' => [
                                        $this->npc('Guardabosques Nel', 'aliado', ['profesion' => 'Guardabosques', 'saludo' => 'Estos cristales eligen a quien los porta. Trátalos con respeto.']),
                                    ],
                                ],
                            ],
                        ],
                        [
                            'zona' => [
                                'nombre' => 'Mirador de las Cascadas',
                                'rareza' => 'poco_comun', 'hostilidad' => 'bajo', 'faccion' => 'República',
                                'estrato_social' => 'medio', 'impuestos' => 0, 'visible' => true,
                                'historia' => 'Cascadas eternas alimentadas por manantiales que nunca se secan.',
                            ],
                            'lugares' => [
                                [
                                    'lugar' => ['nombre' => 'Cascada Eterna', 'tipo' => 'exterior', 'rareza' => 'raro', 'visible' => true, 'historia' => 'Un punto de interés natural venerado por generaciones de viajeros y peregrinos.'],
                                    'npcs' => [
                                        $this->npc('Guía Espiritual Yara', 'aliado', ['profesion' => 'Guía Espiritual', 'saludo' => 'El agua que cae aquí ha visto mil generaciones pasar.']),
                                        $this->npc('Viajero Perdido', 'mision', ['profesion' => 'Viajero', 'saludo' => 'Llevo días buscando el camino de regreso... ¿puedes ayudarme?']),
                                    ],
                                ],
                            ],
                        ],
                    ],
                ],
            ],
        ];
    }
}
