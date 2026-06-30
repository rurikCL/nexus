<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api;

use App\Models\Character;
use App\Models\MapLugar;
use App\Models\MapNpc;
use App\Models\NpcChatLog;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class NpcChatController extends Controller
{
    private const MAX_RESPONSES  = 5;
    private const WINDOW_MINUTES = 30;
    private const HISTORY_LIMIT  = 8;
    private const MAX_TOKENS     = 220;
    private const MODEL          = 'open-mistral-nemo';

    // ──────────────────────────────────────────────────────────────────────
    //  Endpoints
    // ──────────────────────────────────────────────────────────────────────

    public function status(Request $request, int $id): JsonResponse
    {
        $user = $request->user();
        MapNpc::where('visible', true)->findOrFail($id);

        return response()->json(['remaining' => $this->remainingResponses($user->id, $id)]);
    }

    public function chat(Request $request, int $id): JsonResponse
    {
        $user = $request->user();
        $npc  = MapNpc::where('visible', true)->findOrFail($id);

        if (! $npc->prompt) {
            return response()->json(['error' => 'Este NPC no tiene modo conversación.'], 400);
        }

        $remaining = $this->remainingResponses($user->id, $id);
        if ($remaining <= 0) {
            return response()->json([
                'error'     => 'rate_limit',
                'message'   => 'Límite de conversación alcanzado.',
                'reset_in'  => $this->secondsUntilReset($user->id, $id),
                'remaining' => 0,
            ], 429);
        }

        $request->validate(['message' => 'required|string|max:500']);

        // Historial de conversación
        $history = NpcChatLog::where('user_id', $user->id)
            ->where('npc_id', $id)
            ->latest()
            ->limit(self::HISTORY_LIMIT)
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
                'max_tokens'  => self::MAX_TOKENS,
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
        $choice = $response->json('choices.0');
        if (($choice['finish_reason'] ?? '') === 'tool_calls') {
            $messages[] = $choice['message'];  // turno del asistente con tool_calls

            foreach ($choice['message']['tool_calls'] as $call) {
                $args   = json_decode($call['function']['arguments'], true) ?? [];
                $result = $this->executeTool($call['function']['name'], $args);

                $messages[] = [
                    'role'         => 'tool',
                    'tool_call_id' => $call['id'],
                    'name'         => $call['function']['name'],
                    'content'      => json_encode($result, JSON_UNESCAPED_UNICODE),
                ];
            }

            $response = Http::withToken(config('services.mistral.api_key'))
                ->timeout(30)
                ->post('https://api.mistral.ai/v1/chat/completions', [
                    'model'       => self::MODEL,
                    'messages'    => $messages,
                    'max_tokens'  => self::MAX_TOKENS,
                    'temperature' => 0.82,
                ]);

            if ($response->failed()) {
                $status = $response->status();
                Log::error('Mistral tool-response error', ['status' => $status]);
                return response()->json(['error' => 'api_error', 'message' => "Error al procesar respuesta. (HTTP {$status})"], 502);
            }
        }

        $reply = $response->json('choices.0.message.content', '...');

        NpcChatLog::create(['user_id' => $user->id, 'npc_id' => $id, 'role' => 'user',      'content' => $request->message]);
        NpcChatLog::create(['user_id' => $user->id, 'npc_id' => $id, 'role' => 'assistant', 'content' => $reply]);

        return response()->json([
            'reply'     => $reply,
            'remaining' => max(0, $remaining - 1),
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
        ];
    }

    // ──────────────────────────────────────────────────────────────────────
    //  Ejecución de tools
    // ──────────────────────────────────────────────────────────────────────

    private function executeTool(string $name, array $args): array
    {
        return match ($name) {
            'buscar_personaje'    => $this->buscarPersonaje($args['nombre'] ?? ''),
            'personajes_en_lugar' => $this->personajesEnLugar($args['lugar'] ?? ''),
            'info_ubicacion'      => $this->infoUbicacion($args['lugar'] ?? ''),
            default               => ['error' => "Herramienta '{$name}' no disponible."],
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
            'stats'           => $character->stats,
        ], fn($v) => $v !== null && $v !== '');
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

    // ──────────────────────────────────────────────────────────────────────
    //  Helpers de rate limit
    // ──────────────────────────────────────────────────────────────────────

    private function remainingResponses(int $userId, int $npcId): int
    {
        $count = NpcChatLog::where('user_id', $userId)
            ->where('npc_id', $npcId)
            ->where('role', 'assistant')
            ->where('created_at', '>=', now()->subMinutes(self::WINDOW_MINUTES))
            ->count();

        return max(0, self::MAX_RESPONSES - $count);
    }

    private function secondsUntilReset(int $userId, int $npcId): int
    {
        $oldest = NpcChatLog::where('user_id', $userId)
            ->where('npc_id', $npcId)
            ->where('role', 'assistant')
            ->where('created_at', '>=', now()->subMinutes(self::WINDOW_MINUTES))
            ->oldest()
            ->first();

        return $oldest
            ? (int) $oldest->created_at->addMinutes(self::WINDOW_MINUTES)->diffInSeconds(now())
            : self::WINDOW_MINUTES * 60;
    }
}
