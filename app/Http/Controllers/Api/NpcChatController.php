<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api;

use App\Models\Character;
use App\Models\Combat;
use App\Models\Configuracion;
use App\Models\MapLugar;
use App\Models\MapNpc;
use App\Models\MapPlaneta;
use App\Models\NpcChatLog;
use App\Models\RolObjeto;
use App\Services\MisionProgresoService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class NpcChatController extends Controller
{
    private const MODEL = 'open-mistral-nemo';

    private const DEFAULTS = [
        'limite_respuestas'   => 15,
        'ventana_tiempo'      => 5,
        'historial_max'       => 8,
        'tokens_max'          => 220,
        'umbral_conversacion' => 15,
    ];

    private function loadConfig(): array
    {
        $rows = Configuracion::whereIn('nombre', array_keys(self::DEFAULTS))
            ->where('activo', true)
            ->get()
            ->keyBy('nombre')
            ->map(fn($c) => $c->tipo_valor === 'texto' ? $c->valor_texto : (int) $c->valor_numerico)
            ->toArray();

        return array_merge(self::DEFAULTS, $rows);
    }

    // ──────────────────────────────────────────────────────────────────────
    //  Endpoints
    // ──────────────────────────────────────────────────────────────────────

    public function status(Request $request, int $id): JsonResponse
    {
        $user   = $request->user();
        $conf   = $this->loadConfig();
        MapNpc::where('visible', true)->findOrFail($id);

        $history = NpcChatLog::where('user_id', $user->id)
            ->where('npc_id', $id)
            ->oldest()
            ->get(['role', 'content', 'created_at']);

        $lastLog      = $history->last();
        $umbral       = $conf['umbral_conversacion'];
        $showGreeting = ! $lastLog || $lastLog->created_at->lt(now()->subMinutes($umbral));

        return response()->json([
            'remaining'     => $this->remainingResponses($user->id, $id, $conf),
            'history'       => $history,
            'show_greeting' => $showGreeting,
        ]);
    }

    /**
     * Resuelve por nombre las referencias inline usadas en los textos de NPC:
     * [Nombre Objeto] -> rol_objetos, @[Nombre NPC] -> map_npcs.
     */
    public function refs(Request $request): JsonResponse
    {
        $objetoNombres = array_slice(array_values(array_filter(array_map('trim',
            explode(',', (string) $request->query('objetos', ''))
        ))), 0, 40);

        $npcNombres = array_slice(array_values(array_filter(array_map('trim',
            explode(',', (string) $request->query('npcs', ''))
        ))), 0, 40);

        $objetos = $objetoNombres
            ? RolObjeto::whereIn(DB::raw('LOWER(nombre)'), array_map('mb_strtolower', $objetoNombres))
                ->get(['id', 'nombre', 'tipo', 'rareza', 'imagen', 'descripcion', 'efecto'])
            : collect();

        $npcs = $npcNombres
            ? MapNpc::where('visible', true)
                ->whereIn(DB::raw('LOWER(nombre)'), array_map('mb_strtolower', $npcNombres))
                ->get(['id', 'nombre', 'tipo', 'profesion', 'faccion', 'imagen_mini', 'imagen'])
            : collect();

        return response()->json(['objetos' => $objetos, 'npcs' => $npcs]);
    }

    public function chat(Request $request, int $id): JsonResponse
    {
        $user = $request->user();
        $conf = $this->loadConfig();
        $npc  = MapNpc::where('visible', true)->findOrFail($id);

        if (! $npc->prompt) {
            return response()->json(['error' => 'Este NPC no tiene modo conversación.'], 400);
        }

        $remaining = $this->remainingResponses($user->id, $id, $conf);
        if ($remaining <= 0) {
            return response()->json([
                'error'     => 'rate_limit',
                'message'   => 'Límite de conversación alcanzado.',
                'reset_in'  => $this->secondsUntilReset($user->id, $id, $conf),
                'remaining' => 0,
            ], 429);
        }

        $request->validate(['message' => 'required|string|max:500']);

        // Historial de conversación
        $history = NpcChatLog::where('user_id', $user->id)
            ->where('npc_id', $id)
            ->latest()
            ->limit($conf['historial_max'])
            ->get()
            ->reverse()
            ->values();

        $messages = [['role' => 'system', 'content' => $npc->prompt]];
        foreach ($history as $log) {
            $messages[] = ['role' => $log->role, 'content' => $log->content];
        }
        $messages[] = ['role' => 'user', 'content' => $request->message];

        // Primera llamada a Mistral (con tools disponibles)
        $response = Http::withToken(config('services.mistral.api_key'))
            ->timeout(30)
            ->post('https://api.mistral.ai/v1/chat/completions', [
                'model'       => self::MODEL,
                'messages'    => $messages,
                'tools'       => $this->tools(),
                'tool_choice' => 'auto',
                'max_tokens'  => $conf['tokens_max'],
                'temperature' => 0.82,
            ]);

        if ($response->failed()) {
            $status = $response->status();
            $body   = $response->json('message') ?? $response->body();
            Log::error('Mistral API error', ['status' => $status, 'body' => $body]);
            return response()->json([
                'error'   => 'api_error',
                'message' => "Error al contactar al NPC. (HTTP {$status})",
                'detail'  => app()->isLocal() ? $body : null,
            ], 502);
        }

        // Si Mistral quiere ejecutar tools: ejecutar y segunda llamada
        $choice      = $response->json('choices.0');
        $toolsCalled = [];

        if (($choice['finish_reason'] ?? '') === 'tool_calls') {
            $toolCalls  = $choice['message']['tool_calls'] ?? [];
            $messages[] = $choice['message'];

            Log::info('NPC tools invoked', [
                'npc_id'  => $id,
                'user_id' => $user->id,
                'tools'   => array_column(array_column($toolCalls, 'function'), 'name'),
            ]);

            foreach ($toolCalls as $call) {
                $toolName   = $call['function']['name'];
                $args       = json_decode($call['function']['arguments'], true) ?? [];
                $result     = $this->executeTool($toolName, $args);
                $toolsCalled[] = ['tool' => $toolName, 'args' => $args, 'result' => $result];

                Log::info("Tool result: {$toolName}", ['args' => $args, 'result' => $result]);

                $messages[] = [
                    'role'         => 'tool',
                    'tool_call_id' => $call['id'],
                    'name'         => $toolName,
                    'content'      => json_encode($result, JSON_UNESCAPED_UNICODE),
                ];
            }

            $response = Http::withToken(config('services.mistral.api_key'))
                ->timeout(30)
                ->post('https://api.mistral.ai/v1/chat/completions', [
                    'model'       => self::MODEL,
                    'messages'    => $messages,
                    'max_tokens'  => $conf['tokens_max'],
                    'temperature' => 0.82,
                ]);

            if ($response->failed()) {
                $status = $response->status();
                Log::error('Mistral tool-response error', ['status' => $status]);
                return response()->json(['error' => 'api_error', 'message' => "Error al procesar respuesta. (HTTP {$status})"], 502);
            }
        } else {
            Log::info('NPC no tools used', [
                'npc_id'        => $id,
                'finish_reason' => $choice['finish_reason'] ?? 'unknown',
            ]);
        }

        $reply = $response->json('choices.0.message.content', '...');

        NpcChatLog::create(['user_id' => $user->id, 'npc_id' => $id, 'role' => 'user',      'content' => $request->message]);
        NpcChatLog::create(['user_id' => $user->id, 'npc_id' => $id, 'role' => 'assistant', 'content' => $reply]);

        MisionProgresoService::registrarNpc($user, $npc->id);

        return response()->json([
            'reply'        => $reply,
            'remaining'    => max(0, $remaining - 1),
            'tools_called' => $toolsCalled,
        ]);
    }

    // ──────────────────────────────────────────────────────────────────────
    //  Definición de tools para Mistral
    // ──────────────────────────────────────────────────────────────────────

    private function tools(): array
    {
        return [
            [
                'type' => 'function',
                'function' => [
                    'name'        => 'buscar_personaje',
                    'description' => 'Busca información de un personaje o combatiente registrado en la Orden: clase, color de sable, victorias, derrotas, sector de origen y ubicación actual en el mapa galáctico.',
                    'parameters'  => [
                        'type'       => 'object',
                        'properties' => [
                            'nombre' => [
                                'type'        => 'string',
                                'description' => 'Nombre completo o handle/identificador del personaje (ej: "Valentina Soto", "V-SOTO").',
                            ],
                        ],
                        'required' => ['nombre'],
                    ],
                ],
            ],
            [
                'type' => 'function',
                'function' => [
                    'name'        => 'personajes_en_lugar',
                    'description' => 'Lista los personajes presentes actualmente en un lugar, zona, planeta o sistema del mapa galáctico.',
                    'parameters'  => [
                        'type'       => 'object',
                        'properties' => [
                            'lugar' => [
                                'type'        => 'string',
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
                    'name'        => 'info_ubicacion',
                    'description' => 'Devuelve información sobre un lugar del mapa galáctico: descripción, zona, planeta, sistema y personajes presentes.',
                    'parameters'  => [
                        'type'       => 'object',
                        'properties' => [
                            'lugar' => [
                                'type'        => 'string',
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
                    'name'        => 'ficha_completa_personaje',
                    'description' => 'Devuelve la ficha completa de un personaje: identidad, historia, lore, rango, sable, estadísticas de combate detalladas, estilo de pelea, últimos combates disputados, créditos, sector de origen y ubicación actual.',
                    'parameters'  => [
                        'type'       => 'object',
                        'properties' => [
                            'nombre' => [
                                'type'        => 'string',
                                'description' => 'Nombre completo o handle del personaje (ej: "Valentina Soto", "V-SOTO").',
                            ],
                        ],
                        'required' => ['nombre'],
                    ],
                ],
            ],
            [
                'type' => 'function',
                'function' => [
                    'name'        => 'consultar_eventos_planeta',
                    'description' => 'Consulta los eventos importantes registrados en un planeta. Úsalo cuando alguien pregunte qué ha pasado en un planeta o quiera saber su historia reciente.',
                    'parameters'  => [
                        'type'       => 'object',
                        'properties' => [
                            'planeta' => [
                                'type'        => 'string',
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
                    'name'        => 'registrar_evento_planeta',
                    'description' => 'SIEMPRE que el jugador mencione algo que pasó, vio, escuchó o sospecha en relación a un planeta específico (avistamientos, conflictos, movimientos de naves, rumores), llama esta función para registrarlo. No esperes confirmación del usuario.',
                    'parameters'  => [
                        'type'       => 'object',
                        'properties' => [
                            'planeta' => [
                                'type'        => 'string',
                                'description' => 'Nombre del planeta donde ocurrió el evento.',
                            ],
                            'descripcion' => [
                                'type'        => 'string',
                                'description' => 'Descripción breve del evento a registrar (máx. 200 caracteres).',
                            ],
                        ],
                        'required' => ['planeta', 'descripcion'],
                    ],
                ],
            ],
        ];
    }

    // ──────────────────────────────────────────────────────────────────────
    //  Ejecución de tools
    // ──────────────────────────────────────────────────────────────────────

    private function executeTool(string $name, array $args): array
    {
        return match ($name) {
            'buscar_personaje'         => $this->buscarPersonaje($args['nombre'] ?? ''),
            'ficha_completa_personaje' => $this->fichaCompletaPersonaje($args['nombre'] ?? ''),
            'personajes_en_lugar'      => $this->personajesEnLugar($args['lugar'] ?? ''),
            'info_ubicacion'           => $this->infoUbicacion($args['lugar'] ?? ''),
            'consultar_eventos_planeta'=> $this->consultarEventosPlaneta($args['planeta'] ?? ''),
            'registrar_evento_planeta' => $this->registrarEventoPlaneta($args['planeta'] ?? '', $args['descripcion'] ?? ''),
            default                    => ['error' => "Herramienta '{$name}' no disponible."],
        };
    }

    private function buscarPersonaje(string $nombre): array
    {
        if (! $nombre) return ['error' => 'Se requiere un nombre o handle.'];

        $character = Character::with(['mapLugar', 'mapPlaneta', 'mapSistema'])
            ->where('name', 'like', "%{$nombre}%")
            ->orWhere('handle', 'like', "%{$nombre}%")
            ->first();

        if (! $character) {
            return ['error' => "No se encontró ningún personaje con el nombre o handle '{$nombre}'."];
        }

        return array_filter([
            'nombre'          => $character->name,
            'handle'          => $character->handle,
            'clase'           => $character->cls,
            'color_sable'     => $character->saber_color,
            'victorias'       => $character->wins,
            'derrotas'        => $character->losses,
            'racha_actual'    => $character->streak,
            'sector_origen'   => $character->sector,
            'bio'             => $character->bio,
            'ubicacion_lugar' => $character->mapLugar?->nombre,
            'ubicacion_planeta' => $character->mapPlaneta?->nombre,
            'ubicacion_sistema' => $character->mapSistema?->nombre,
        ], fn($v) => $v !== null && $v !== '');
    }

    private function fichaCompletaPersonaje(string $nombre): array
    {
        if (! $nombre) return ['error' => 'Se requiere un nombre o handle.'];

        $character = Character::with(['user', 'mapLugar', 'mapPlaneta', 'mapZona', 'mapSistema'])
            ->where('name', 'like', "%{$nombre}%")
            ->orWhere('handle', 'like', "%{$nombre}%")
            ->first();

        if (! $character) {
            return ['error' => "No se encontró ningún personaje con el nombre o handle '{$nombre}'."];
        }

        // Últimos 5 combates resueltos
        $userId  = $character->user_id;
        $combats = Combat::where(function ($q) use ($userId) {
                $q->where('combatant_a_id', $userId)->orWhere('combatant_b_id', $userId);
            })
            ->where('resolved', true)
            ->with(['combatantA:id,name', 'combatantB:id,name'])
            ->latest('fecha_desafio')
            ->limit(5)
            ->get();

        $historialCombates = $combats->map(function ($c) use ($userId) {
            $rival    = $c->combatant_a_id === $userId ? $c->combatantB?->name : $c->combatantA?->name;
            $gano     = $c->winner === $userId;
            $resultado = $gano ? 'VICTORIA' : 'DERROTA';
            return "{$resultado} vs {$rival} — {$c->event_name}" . ($c->round ? " ({$c->round})" : '');
        })->toArray();

        $total    = ($character->wins ?? 0) + ($character->losses ?? 0);
        $winrate  = $total > 0 ? round(($character->wins / $total) * 100) . '%' : 'sin combates';

        return array_filter([
            // Identidad
            'nombre'         => $character->name,
            'handle'         => $character->handle,
            'clase'          => $character->cls,
            'lado'           => $character->side,
            'sector_origen'  => $character->sector,
            'sponsor'        => $character->sponsor,
            'año_ingreso'    => $character->joined_year,
            'estado_oro'     => $character->gold ? 'Combatiente Gold' : null,

            // Rango
            'tier'           => $character->user?->tier,
            'grado'          => $character->user?->grado,

            // Sable
            'color_sable'    => $character->saber_color,

            // Historia y lore
            'bio'            => $character->bio,
            'lore'           => $character->lore,

            // Estadísticas de combate
            'record'         => ($character->wins ?? 0) . 'V - ' . ($character->losses ?? 0) . 'D',
            'winrate'        => $winrate,
            'racha_actual'   => $character->streak ?? 0,
            'creditos'       => $character->credits,

            // Historial reciente
            'ultimos_combates' => $historialCombates ?: ['Sin combates registrados'],

            // Ubicación actual
            'ubicacion_lugar'   => $character->mapLugar?->nombre,
            'ubicacion_zona'    => $character->mapZona?->nombre,
            'ubicacion_planeta' => $character->mapPlaneta?->nombre,
            'ubicacion_sistema' => $character->mapSistema?->nombre,
        ], fn($v) => $v !== null && $v !== '' && $v !== []);
    }

    private function personajesEnLugar(string $lugar): array
    {
        if (! $lugar) return ['error' => 'Se requiere un nombre de lugar.'];

        // Buscar por lugar exacto o aproximado
        $lugarRecord = MapLugar::where('nombre', 'like', "%{$lugar}%")->first();

        $query = Character::with(['mapLugar', 'mapPlaneta', 'mapSistema'])
            ->whereNotNull('map_lugar_id');

        if ($lugarRecord) {
            $query->where('map_lugar_id', $lugarRecord->id);
        } else {
            // Intentar por planeta o sistema si no hay lugar exacto
            $query->whereHas('mapLugar', fn($q) => $q->where('nombre', 'like', "%{$lugar}%"))
                ->orWhereHas('mapPlaneta', fn($q) => $q->where('nombre', 'like', "%{$lugar}%"))
                ->orWhereHas('mapSistema', fn($q) => $q->where('nombre', 'like', "%{$lugar}%"));
        }

        $personajes = $query->get();

        if ($personajes->isEmpty()) {
            return ['resultado' => "No hay personajes registrados actualmente en '{$lugar}'."];
        }

        return [
            'ubicacion_buscada' => $lugar,
            'total'             => $personajes->count(),
            'personajes'        => $personajes->map(fn($c) => [
                'nombre'      => $c->name,
                'handle'      => $c->handle,
                'clase'       => $c->cls,
                'color_sable' => $c->saber_color,
                'lugar_exacto'=> $c->mapLugar?->nombre,
                'planeta'     => $c->mapPlaneta?->nombre,
            ])->toArray(),
        ];
    }

    private function infoUbicacion(string $lugar): array
    {
        if (! $lugar) return ['error' => 'Se requiere un nombre de lugar.'];

        $lugarRecord = MapLugar::with(['zona.planeta.sistema', 'npcs' => fn($q) => $q->where('visible', true)])
            ->where('nombre', 'like', "%{$lugar}%")
            ->first();

        if (! $lugarRecord) {
            return ['error' => "No se encontró el lugar '{$lugar}' en el mapa galáctico."];
        }

        $presentes = Character::where('map_lugar_id', $lugarRecord->id)->get();

        return array_filter([
            'nombre'          => $lugarRecord->nombre,
            'descripcion'     => $lugarRecord->descripcion ?? null,
            'tipo'            => $lugarRecord->tipo ?? null,
            'zona'            => $lugarRecord->zona?->nombre,
            'planeta'         => $lugarRecord->zona?->planeta?->nombre,
            'sistema'         => $lugarRecord->zona?->planeta?->sistema?->nombre,
            'npcs_presentes'  => $lugarRecord->npcs->pluck('nombre')->toArray(),
            'personajes_presentes' => $presentes->map(fn($c) => "{$c->name} ({$c->cls})")->toArray(),
        ], fn($v) => $v !== null && $v !== '' && $v !== []);
    }

    private function consultarEventosPlaneta(string $planeta): array
    {
        if (! $planeta) return ['error' => 'Se requiere un nombre de planeta.'];

        $record = MapPlaneta::where('nombre', 'like', "%{$planeta}%")->first();

        if (! $record) {
            return ['error' => "No se encontró el planeta '{$planeta}' en el mapa galáctico."];
        }

        $eventos = trim($record->eventos_importantes ?? '');

        return [
            'planeta'  => $record->nombre,
            'eventos'  => $eventos ?: 'No hay eventos registrados para este planeta.',
        ];
    }

    private function registrarEventoPlaneta(string $planeta, string $descripcion): array
    {
        if (! $planeta)     return ['error' => 'Se requiere un nombre de planeta.'];
        if (! $descripcion) return ['error' => 'Se requiere una descripción del evento.'];

        $record = MapPlaneta::where('nombre', 'like', "%{$planeta}%")->first();

        if (! $record) {
            return ['error' => "No se encontró el planeta '{$planeta}' en el mapa galáctico."];
        }

        $descripcion = mb_substr(trim($descripcion), 0, 200);
        $fecha       = now()->format('Y-m-d');
        $linea       = "[{$fecha}] {$descripcion}";

        $actual   = trim($record->eventos_importantes ?? '');
        $nuevo    = $actual ? "{$actual}\n{$linea}" : $linea;

        $record->update(['eventos_importantes' => $nuevo]);

        return [
            'ok'      => true,
            'planeta' => $record->nombre,
            'evento_registrado' => $linea,
        ];
    }

    // ──────────────────────────────────────────────────────────────────────
    //  Helpers de rate limit
    // ──────────────────────────────────────────────────────────────────────

    private function remainingResponses(int $userId, int $npcId, array $conf = []): int
    {
        if (empty($conf)) {
            $conf = $this->loadConfig();
        }

        $count = NpcChatLog::where('user_id', $userId)
            ->where('npc_id', $npcId)
            ->where('role', 'assistant')
            ->where('created_at', '>=', now()->subMinutes($conf['ventana_tiempo']))
            ->count();

        return max(0, $conf['limite_respuestas'] - $count);
    }

    private function secondsUntilReset(int $userId, int $npcId, array $conf = []): int
    {
        if (empty($conf)) {
            $conf = $this->loadConfig();
        }

        $ventana = $conf['ventana_tiempo'];

        $oldest = NpcChatLog::where('user_id', $userId)
            ->where('npc_id', $npcId)
            ->where('role', 'assistant')
            ->where('created_at', '>=', now()->subMinutes($ventana))
            ->oldest()
            ->first();

        return $oldest
            ? (int) $oldest->created_at->addMinutes($ventana)->diffInSeconds(now())
            : $ventana * 60;
    }
}
