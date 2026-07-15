<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Message;
use App\Models\User;
use App\Notifications\MensajeRecibido;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

class MessageController extends Controller
{
    public function unread(Request $request): JsonResponse
    {
        $me = $request->user()->id;

        $senders = Message::where('receiver_id', $me)
            ->whereNull('read_at')
            ->with('sender.character')
            ->latest()
            ->get()
            ->groupBy('sender_id')
            ->map(function ($msgs, $senderId) {
                $sender = $msgs->first()->sender;

                return [
                    'user_id' => (int) $senderId,
                    'handle' => $sender->character?->handle ?? $sender->name,
                    'photo' => $sender->character?->photo
                        ? Storage::disk('public')->url($sender->character->photo)
                        : null,
                    'saber_color' => $sender->character?->saber_color ?? 'azul',
                    'count' => $msgs->count(),
                ];
            })
            ->values();

        return response()->json(['senders' => $senders]);
    }

    public function conversation(Request $request, int $userId): JsonResponse
    {
        $me = $request->user()->id;

        $messages = Message::where(function ($q) use ($me, $userId) {
            $q->where('sender_id', $me)->where('receiver_id', $userId);
        })->orWhere(function ($q) use ($me, $userId) {
            $q->where('sender_id', $userId)->where('receiver_id', $me);
        })
            ->orderBy('created_at')
            ->get();

        // Mark unread messages from the other user as read
        Message::where('sender_id', $userId)
            ->where('receiver_id', $me)
            ->whereNull('read_at')
            ->update(['read_at' => now()]);

        $other = User::with('character')->find($userId);

        return response()->json([
            'messages' => $messages->map(fn ($m) => [
                'id' => $m->id,
                'sender_id' => $m->sender_id,
                'receiver_id' => $m->receiver_id,
                'body' => $m->body,
                'read_at' => $m->read_at?->toISOString(),
                'created_at' => $m->created_at->toISOString(),
            ]),
            'other' => $other ? [
                'id' => $other->id,
                'handle' => $other->character?->handle,
                'name' => $other->character?->name ?? $other->name,
                'photo' => $other->character?->photo
                    ? Storage::disk('public')->url($other->character->photo)
                    : null,
                'saber_color' => $other->character?->saber_color,
            ] : null,
        ]);
    }

    public function send(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'receiver_id' => ['required', 'integer', 'exists:users,id'],
            'body' => ['required', 'string', 'max:2000'],
        ]);

        $message = Message::create([
            'sender_id' => $request->user()->id,
            'receiver_id' => $validated['receiver_id'],
            'body' => $validated['body'],
        ]);

        $receiver = User::find($validated['receiver_id']);
        $receiver?->notify(new MensajeRecibido($request->user(), $message));

        return response()->json([
            'message' => [
                'id' => $message->id,
                'sender_id' => $message->sender_id,
                'receiver_id' => $message->receiver_id,
                'body' => $message->body,
                'read_at' => null,
                'created_at' => $message->created_at->toISOString(),
            ],
        ], 201);
    }
}
