<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class PushSubscriptionController extends Controller
{
    // GET /push/vapid-public-key
    public function vapidPublicKey(): JsonResponse
    {
        return response()->json(['key' => config('webpush.vapid.public_key')]);
    }

    // POST /push/subscribe
    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'endpoint' => 'required|string',
            'keys.p256dh' => 'required|string',
            'keys.auth' => 'required|string',
        ]);

        $request->user()->updatePushSubscription(
            endpoint: $data['endpoint'],
            key: $data['keys']['p256dh'],
            token: $data['keys']['auth'],
        );

        return response()->json(['ok' => true]);
    }

    // POST /push/unsubscribe
    public function destroy(Request $request): JsonResponse
    {
        $data = $request->validate(['endpoint' => 'required|string']);

        $request->user()->deletePushSubscription($data['endpoint']);

        return response()->json(['ok' => true]);
    }
}
