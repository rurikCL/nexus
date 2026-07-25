<?php

declare(strict_types=1);

namespace App\Services;

use App\Models\Character;
use App\Models\Combat;
use App\Models\MapLugar;
use App\Models\MapPlaneta;

/**
 * Definiciones y ejecución de las "tools" (function calling) que la IA puede invocar
 * para consultar datos reales del juego. Compartidas entre el chat en vivo de NPC
 * (NpcChatController) y la generación batch de interacciones (NpcInteraccionService).
 */
class NpcAiTools
{
    public static function definitions(): array
    {
        return [
            [
                'type' => 'function',
                'function' => [
                    'name' => 'buscar_personaje',
                    'description' => 'Busca información de un personaje o combatiente registrado en la Orden: clase, color de sable, victorias, derrotas, sector de origen y ubicación actual en el mapa galáctico.',
                    'parameters' => [
                        'type' => 'object',
                        'properties' => [
                            'nombre' => [
                                'type' => 'string',
                                'description' => 'Nombre completo o tag/identificador del personaje (ej: "Valentina Soto", "V-SOTO").',
                            ],
                        ],
                        'required' => ['nombre'],
                    ],
                ],
            ],
            [
                'type' => 'function',
                'function' => [
                    'name' => 'personajes_en_lugar',
                    'description' => 'Lista los personajes presentes actualmente en un lugar, zona, planeta o sistema del mapa galáctico.',
                    'parameters' => [
                        'type' => 'object',
                        'properties' => [
                            'lugar' => [
                                'type' => 'string',
                                'description' => 'Nombre del lugar, zona, planeta o sistema a consultar.',
                            ],
                        ],
                        'required' => ['lugar'],
                    ],
                ],
            ],
            [
                'type' => 'function',
                'function' => [
                    'name' => 'info_ubicacion',
                    'description' => 'Devuelve información sobre un lugar del mapa galáctico: descripción, zona, planeta, sistema y personajes presentes.',
                    'parameters' => [
                        'type' => 'object',
                        'properties' => [
                            'lugar' => [
                                'type' => 'string',
                                'description' => 'Nombre del lugar a consultar.',
                            ],
                        ],
                        'required' => ['lugar'],
                    ],
                ],
            ],
            [
                'type' => 'function',
                'function' => [
                    'name' => 'ficha_completa_personaje',
                    'description' => 'Devuelve la ficha completa de un personaje: identidad, historia, lore, rango, sable, estadísticas de combate detalladas, estilo de pelea, últimos combates disputados, créditos, sector de origen y ubicación actual.',
                    'parameters' => [
                        'type' => 'object',
                        'properties' => [
                            'nombre' => [
                                'type' => 'string',
                                'description' => 'Nombre completo o tag del personaje (ej: "Valentina Soto", "V-SOTO").',
                            ],
                        ],
                        'required' => ['nombre'],
                    ],
                ],
            ],
            [
                'type' => 'function',
                'function' => [
                    'name' => 'consultar_eventos_planeta',
                    'description' => 'Consulta los eventos importantes registrados en un planeta. Úsalo cuando alguien pregunte qué ha pasado en un planeta o quiera saber su historia reciente.',
                    'parameters' => [
                        'type' => 'object',
                        'properties' => [
                            'planeta' => [
                                'type' => 'string',
                                'description' => 'Nombre del planeta a consultar.',
                            ],
                        ],
                        'required' => ['planeta'],
                    ],
                ],
            ],
            [
                'type' => 'function',
                'function' => [
                    'name' => 'registrar_evento_planeta',
                    'description' => 'SIEMPRE que el jugador mencione algo que pasó, vio, escuchó o sospecha en relación a un planeta específico (avistamientos, conflictos, movimientos de naves, rumores), llama esta función para registrarlo. No esperes confirmación del usuario.',
                    'parameters' => [
                        'type' => 'object',
                        'properties' => [
                            'planeta' => [
                                'type' => 'string',
                                'description' => 'Nombre del planeta donde ocurrió el evento.',
                            ],
                            'descripcion' => [
                                'type' => 'string',
                                'description' => 'Descripción breve del evento a registrar (máx. 200 caracteres).',
                            ],
                        ],
                        'required' => ['planeta', 'descripcion'],
                    ],
                ],
            ],
        ];
    }

    public static function execute(string $name, array $args): array
    {
        return match ($name) {
            'buscar_personaje' => self::buscarPersonaje($args['nombre'] ?? ''),
            'ficha_completa_personaje' => self::fichaCompletaPersonaje($args['nombre'] ?? ''),
            'personajes_en_lugar' => self::personajesEnLugar($args['lugar'] ?? ''),
            'info_ubicacion' => self::infoUbicacion($args['lugar'] ?? ''),
            'consultar_eventos_planeta' => self::consultarEventosPlaneta($args['planeta'] ?? ''),
            'registrar_evento_planeta' => self::registrarEventoPlaneta($args['planeta'] ?? '', $args['descripcion'] ?? ''),
            default => ['error' => "Herramienta '{$name}' no disponible."],
        };
    }

    private static function buscarPersonaje(string $nombre): array
    {
        if (! $nombre) {
            return ['error' => 'Se requiere un nombre o tag.'];
        }

        $character = Character::with(['mapLugar', 'mapPlaneta', 'mapSistema'])
            ->where('name', 'like', "%{$nombre}%")
            ->orWhere('handle', 'like', "%{$nombre}%")
            ->first();

        if (! $character) {
            return ['error' => "No se encontró ningún personaje con el nombre o tag '{$nombre}'."];
        }

        return array_filter([
            'nombre' => $character->name,
            'handle' => $character->handle,
            'clase' => $character->cls,
            'color_sable' => $character->saber_color,
            'victorias' => $character->wins,
            'derrotas' => $character->losses,
            'racha_actual' => $character->streak,
            'sector_origen' => $character->sector,
            'bio' => $character->bio,
            'ubicacion_lugar' => $character->mapLugar?->nombre,
            'ubicacion_planeta' => $character->mapPlaneta?->nombre,
            'ubicacion_sistema' => $character->mapSistema?->nombre,
        ], fn ($v) => $v !== null && $v !== '');
    }

    private static function fichaCompletaPersonaje(string $nombre): array
    {
        if (! $nombre) {
            return ['error' => 'Se requiere un nombre o tag.'];
        }

        $character = Character::with(['user', 'mapLugar', 'mapPlaneta', 'mapZona', 'mapSistema'])
            ->where('name', 'like', "%{$nombre}%")
            ->orWhere('handle', 'like', "%{$nombre}%")
            ->first();

        if (! $character) {
            return ['error' => "No se encontró ningún personaje con el nombre o tag '{$nombre}'."];
        }

        $userId = $character->user_id;
        $combats = Combat::where(function ($q) use ($userId) {
            $q->where('combatant_a_id', $userId)->orWhere('combatant_b_id', $userId);
        })
            ->where('resolved', true)
            ->with(['combatantA:id,name', 'combatantB:id,name'])
            ->latest('fecha_desafio')
            ->limit(5)
            ->get();

        $historialCombates = $combats->map(function ($c) use ($userId) {
            $rival = $c->combatant_a_id === $userId ? $c->combatantB?->name : $c->combatantA?->name;
            $gano = $c->winner === $userId;
            $resultado = $gano ? 'VICTORIA' : 'DERROTA';

            return "{$resultado} vs {$rival} — {$c->event_name}".($c->round ? " ({$c->round})" : '');
        })->toArray();

        $total = ($character->wins ?? 0) + ($character->losses ?? 0);
        $winrate = $total > 0 ? round(($character->wins / $total) * 100).'%' : 'sin combates';

        return array_filter([
            'nombre' => $character->name,
            'handle' => $character->handle,
            'clase' => $character->cls,
            'lado' => $character->side,
            'sector_origen' => $character->sector,
            'sponsor' => $character->sponsor,
            'año_ingreso' => $character->joined_year,
            'estado_oro' => $character->gold ? 'Combatiente Gold' : null,
            'tier' => $character->user?->tier,
            'grado' => $character->user?->grado,
            'color_sable' => $character->saber_color,
            'bio' => $character->bio,
            'lore' => $character->lore,
            'record' => ($character->wins ?? 0).'V - '.($character->losses ?? 0).'D',
            'winrate' => $winrate,
            'racha_actual' => $character->streak ?? 0,
            'creditos' => $character->credits,
            'ultimos_combates' => $historialCombates ?: ['Sin combates registrados'],
            'ubicacion_lugar' => $character->mapLugar?->nombre,
            'ubicacion_zona' => $character->mapZona?->nombre,
            'ubicacion_planeta' => $character->mapPlaneta?->nombre,
            'ubicacion_sistema' => $character->mapSistema?->nombre,
        ], fn ($v) => $v !== null && $v !== '' && $v !== []);
    }

    private static function personajesEnLugar(string $lugar): array
    {
        if (! $lugar) {
            return ['error' => 'Se requiere un nombre de lugar.'];
        }

        $lugarRecord = MapLugar::where('nombre', 'like', "%{$lugar}%")->first();

        $query = Character::with(['mapLugar', 'mapPlaneta', 'mapSistema'])
            ->whereNotNull('map_lugar_id');

        if ($lugarRecord) {
            $query->where('map_lugar_id', $lugarRecord->id);
        } else {
            $query->whereHas('mapLugar', fn ($q) => $q->where('nombre', 'like', "%{$lugar}%"))
                ->orWhereHas('mapPlaneta', fn ($q) => $q->where('nombre', 'like', "%{$lugar}%"))
                ->orWhereHas('mapSistema', fn ($q) => $q->where('nombre', 'like', "%{$lugar}%"));
        }

        $personajes = $query->get();

        if ($personajes->isEmpty()) {
            return ['resultado' => "No hay personajes registrados actualmente en '{$lugar}'."];
        }

        return [
            'ubicacion_buscada' => $lugar,
            'total' => $personajes->count(),
            'personajes' => $personajes->map(fn ($c) => [
                'nombre' => $c->name,
                'handle' => $c->handle,
                'clase' => $c->cls,
                'color_sable' => $c->saber_color,
                'lugar_exacto' => $c->mapLugar?->nombre,
                'planeta' => $c->mapPlaneta?->nombre,
            ])->toArray(),
        ];
    }

    private static function infoUbicacion(string $lugar): array
    {
        if (! $lugar) {
            return ['error' => 'Se requiere un nombre de lugar.'];
        }

        $lugarRecord = MapLugar::with(['zona.planeta.sistema', 'npcs' => fn ($q) => $q->where('visible', true)])
            ->where('nombre', 'like', "%{$lugar}%")
            ->first();

        if (! $lugarRecord) {
            return ['error' => "No se encontró el lugar '{$lugar}' en el mapa galáctico."];
        }

        $presentes = Character::where('map_lugar_id', $lugarRecord->id)->get();

        return array_filter([
            'nombre' => $lugarRecord->nombre,
            'descripcion' => $lugarRecord->descripcion ?? null,
            'tipo' => $lugarRecord->tipo ?? null,
            'zona' => $lugarRecord->zona?->nombre,
            'planeta' => $lugarRecord->zona?->planeta?->nombre,
            'sistema' => $lugarRecord->zona?->planeta?->sistema?->nombre,
            'npcs_presentes' => $lugarRecord->npcs->pluck('nombre')->toArray(),
            'personajes_presentes' => $presentes->map(fn ($c) => "{$c->name} ({$c->cls})")->toArray(),
        ], fn ($v) => $v !== null && $v !== '' && $v !== []);
    }

    private static function consultarEventosPlaneta(string $planeta): array
    {
        if (! $planeta) {
            return ['error' => 'Se requiere un nombre de planeta.'];
        }

        $record = MapPlaneta::where('nombre', 'like', "%{$planeta}%")->first();

        if (! $record) {
            return ['error' => "No se encontró el planeta '{$planeta}' en el mapa galáctico."];
        }

        $eventos = trim($record->eventos_importantes ?? '');

        return [
            'planeta' => $record->nombre,
            'eventos' => $eventos ?: 'No hay eventos registrados para este planeta.',
        ];
    }

    private static function registrarEventoPlaneta(string $planeta, string $descripcion): array
    {
        if (! $planeta) {
            return ['error' => 'Se requiere un nombre de planeta.'];
        }
        if (! $descripcion) {
            return ['error' => 'Se requiere una descripción del evento.'];
        }

        $record = MapPlaneta::where('nombre', 'like', "%{$planeta}%")->first();

        if (! $record) {
            return ['error' => "No se encontró el planeta '{$planeta}' en el mapa galáctico."];
        }

        $descripcion = mb_substr(trim($descripcion), 0, 200);
        $fecha = now()->format('Y-m-d');
        $linea = "[{$fecha}] {$descripcion}";

        $actual = trim($record->eventos_importantes ?? '');
        $nuevo = $actual ? "{$actual}\n{$linea}" : $linea;

        $record->update(['eventos_importantes' => $nuevo]);

        return [
            'ok' => true,
            'planeta' => $record->nombre,
            'evento_registrado' => $linea,
        ];
    }
}
