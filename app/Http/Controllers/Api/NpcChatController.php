<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api;

use App\Models\MapNpc;
use App\Models\NpcChatLog;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Illuminate\Support\Facades\Http;

class NpcChatController extends Controller
{
    private const MAX_RESPONSES   = 5;
    private const WINDOW_MINUTES  = 30;
    private const HISTORY_LIMIT   = 8;  // last 4 exchanges
    private const MAX_TOKENS      = 220;
    private const MODEL           = 'open-mistral-nemo';

    public function status(Request $request, int $id): JsonResponse
    {
        $user = $request->user();
        MapNpc::where('visible', true)->findOrFail($id);

        $remaining = $this->remainingResponses($user->id, $id);

        return response()->json(['remaining' => $remaining]);
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
            $resetIn = $this->secondsUntilReset($user->id, $id);
            return response()->json([
                'error'    => 'rate_limit',
                'message'  => 'Límite de conversación alcanzado.',
                'reset_in' => $resetIn,
                'remaining'=> 0,
            ], 429);
        }

        $request->validate(['message' => 'required|string|max:500']);

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

        $response = Http::withToken(config('services.mistral.api_key'))
            ->timeout(30)
            ->post('https://api.mistral.ai/v1/chat/completions', [
                'model'       => self::MODEL,
                'messages'    => $messages,
                'max_tokens'  => self::MAX_TOKENS,
                'temperature' => 0.82,
            ]);

        if ($response->failed()) {
            $status  = $response->status();
            $body    = $response->json('message') ?? $response->body();
            \Illuminate\Support\Facades\Log::error('Mistral API error', ['status' => $status, 'body' => $body]);
            return response()->json([
                'error'   => 'api_error',
                'message' => "Error al contactar al NPC. (HTTP {$status})",
                'detail'  => app()->isLocal() ? $body : null,
            ], 502);
        }

        $reply = $response->json('choices.0.message.content', '...');

        NpcChatLog::create(['user_id' => $user->id, 'npc_id' => $id, 'role' => 'user',      'content' => $request->message]);
        NpcChatLog::create(['user_id' => $user->id, 'npc_id' => $id, 'role' => 'assistant', 'content' => $reply]);

        return response()->json([
            'reply'     => $reply,
            'remaining' => max(0, $remaining - 1),
        ]);
    }

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
