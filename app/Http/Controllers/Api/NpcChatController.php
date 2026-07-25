<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api;

use App\Models\Configuracion;
use App\Models\MapNpc;
use App\Models\NpcChatLog;
use App\Models\RolObjeto;
use App\Services\MisionProgresoService;
use App\Services\NpcAiTools;
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
        'limite_respuestas' => 15,
        'ventana_tiempo' => 5,
        'historial_max' => 8,
        'tokens_max' => 220,
        'umbral_conversacion' => 15,
    ];

    private function loadConfig(): array
    {
        $rows = Configuracion::whereIn('nombre', array_keys(self::DEFAULTS))
            ->where('activo', true)
            ->get()
            ->keyBy('nombre')
            ->map(fn ($c) => $c->tipo_valor === 'texto' ? $c->valor_texto : (int) $c->valor_numerico)
            ->toArray();

        return array_merge(self::DEFAULTS, $rows);
    }

    // ──────────────────────────────────────────────────────────────────────
    //  Endpoints
    // ──────────────────────────────────────────────────────────────────────

    public function status(Request $request, int $id): JsonResponse
    {
        $user = $request->user();
        $conf = $this->loadConfig();
        MapNpc::where('visible', true)->findOrFail($id);

        $history = NpcChatLog::where('user_id', $user->id)
            ->where('npc_id', $id)
            ->oldest()
            ->get(['role', 'content', 'created_at']);

        $lastLog = $history->last();
        $umbral = $conf['umbral_conversacion'];
        $showGreeting = ! $lastLog || $lastLog->created_at->lt(now()->subMinutes($umbral));

        return response()->json([
            'remaining' => $this->remainingResponses($user->id, $id, $conf),
            'history' => $history,
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
        $npc = MapNpc::where('visible', true)->findOrFail($id);

        if (! $npc->prompt) {
            return response()->json(['error' => 'Este NPC no tiene modo conversación.'], 400);
        }

        $remaining = $this->remainingResponses($user->id, $id, $conf);
        if ($remaining <= 0) {
            return response()->json([
                'error' => 'rate_limit',
                'message' => 'Límite de conversación alcanzado.',
                'reset_in' => $this->secondsUntilReset($user->id, $id, $conf),
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
                'model' => self::MODEL,
                'messages' => $messages,
                'tools' => NpcAiTools::definitions(),
                'tool_choice' => 'auto',
                'max_tokens' => $conf['tokens_max'],
                'temperature' => 0.82,
            ]);

        if ($response->failed()) {
            $status = $response->status();
            $body = $response->json('message') ?? $response->body();
            Log::error('Mistral API error', ['status' => $status, 'body' => $body]);

            return response()->json([
                'error' => 'api_error',
                'message' => "Error al contactar al NPC. (HTTP {$status})",
                'detail' => app()->isLocal() ? $body : null,
            ], 502);
        }

        // Si Mistral quiere ejecutar tools: ejecutar y segunda llamada
        $choice = $response->json('choices.0');
        $toolsCalled = [];

        if (($choice['finish_reason'] ?? '') === 'tool_calls') {
            $toolCalls = $choice['message']['tool_calls'] ?? [];
            $messages[] = $choice['message'];

            Log::info('NPC tools invoked', [
                'npc_id' => $id,
                'user_id' => $user->id,
                'tools' => array_column(array_column($toolCalls, 'function'), 'name'),
            ]);

            foreach ($toolCalls as $call) {
                $toolName = $call['function']['name'];
                $args = json_decode($call['function']['arguments'], true) ?? [];
                $result = NpcAiTools::execute($toolName, $args);
                $toolsCalled[] = ['tool' => $toolName, 'args' => $args, 'result' => $result];

                Log::info("Tool result: {$toolName}", ['args' => $args, 'result' => $result]);

                $messages[] = [
                    'role' => 'tool',
                    'tool_call_id' => $call['id'],
                    'name' => $toolName,
                    'content' => json_encode($result, JSON_UNESCAPED_UNICODE),
                ];
            }

            $response = Http::withToken(config('services.mistral.api_key'))
                ->timeout(30)
                ->post('https://api.mistral.ai/v1/chat/completions', [
                    'model' => self::MODEL,
                    'messages' => $messages,
                    'max_tokens' => $conf['tokens_max'],
                    'temperature' => 0.82,
                ]);

            if ($response->failed()) {
                $status = $response->status();
                Log::error('Mistral tool-response error', ['status' => $status]);

                return response()->json(['error' => 'api_error', 'message' => "Error al procesar respuesta. (HTTP {$status})"], 502);
            }
        } else {
            Log::info('NPC no tools used', [
                'npc_id' => $id,
                'finish_reason' => $choice['finish_reason'] ?? 'unknown',
            ]);
        }

        $reply = $response->json('choices.0.message.content', '...');

        NpcChatLog::create(['user_id' => $user->id, 'npc_id' => $id, 'role' => 'user',      'content' => $request->message]);
        NpcChatLog::create(['user_id' => $user->id, 'npc_id' => $id, 'role' => 'assistant', 'content' => $reply]);

        MisionProgresoService::registrarNpc($user, $npc->id);

        return response()->json([
            'reply' => $reply,
            'remaining' => max(0, $remaining - 1),
            'tools_called' => $toolsCalled,
        ]);
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
