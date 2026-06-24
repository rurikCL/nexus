<?php

namespace App\Http\Controllers\Api;

use App\Models\InstagramAccount;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Illuminate\Support\Facades\Http;

class InstagramController extends Controller
{
    private string $appId;
    private string $appSecret;
    private string $redirectUri;
    private string $graphBase = 'https://graph.instagram.com/v21.0';

    public function __construct()
    {
        $this->appId       = config('services.instagram.app_id');
        $this->appSecret   = config('services.instagram.app_secret');
        $this->redirectUri = config('services.instagram.redirect_uri');
    }

    // Redirect al diálogo OAuth de Instagram (nuevo API — no requiere Facebook Pages)
    public function redirect(Request $request): JsonResponse
    {
        $state = base64_encode(json_encode([
            'uid' => $request->user()->id,
        ]));

        $url = 'https://www.instagram.com/oauth/authorize?' . http_build_query([
            'enable_fb_login'     => 0,
            'force_authentication' => 1,
            'client_id'           => $this->appId,
            'redirect_uri'        => $this->redirectUri,
            'response_type'       => 'code',
            'scope'               => 'instagram_business_basic,instagram_business_content_publish',
            'state'               => $state,
        ]);

        return response()->json(['url' => $url]);
    }

    // Callback OAuth — intercambia code por token y obtiene datos del IG account
    public function callback(Request $request): RedirectResponse
    {
        if ($request->has('error')) {
            return redirect('/instagram?error=' . urlencode($request->error_description ?? 'access_denied'));
        }

        $state  = json_decode(base64_decode($request->state ?? ''), true);
        $userId = $state['uid'] ?? null;

        if (! $userId) {
            return redirect('/instagram?error=invalid_state');
        }

        // 1. Intercambiar code por short-lived token
        $tokenRes = Http::asForm()->post('https://api.instagram.com/oauth/access_token', [
            'client_id'     => $this->appId,
            'client_secret' => $this->appSecret,
            'grant_type'    => 'authorization_code',
            'redirect_uri'  => $this->redirectUri,
            'code'          => $request->code,
        ]);

        if (! $tokenRes->ok()) {
            return redirect('/instagram?error=token_exchange_failed');
        }

        $shortToken = $tokenRes->json('access_token');
        $igUserId   = (string) $tokenRes->json('user_id');

        // 2. Intercambiar por long-lived token (60 días)
        $longRes = Http::get('https://graph.instagram.com/access_token', [
            'grant_type'    => 'ig_exchange_token',
            'client_id'     => $this->appId,
            'client_secret' => $this->appSecret,
            'access_token'  => $shortToken,
        ]);

        $accessToken = $longRes->ok() ? $longRes->json('access_token') : $shortToken;
        $expiresIn   = $longRes->json('expires_in', 3600);

        // 3. Obtener username
        $profileRes = Http::get("{$this->graphBase}/{$igUserId}", [
            'fields'       => 'id,username',
            'access_token' => $accessToken,
        ]);

        $igUsername = $profileRes->json('username');

        // 4. Guardar o actualizar en DB
        InstagramAccount::updateOrCreate(
            ['user_id' => $userId],
            [
                'instagram_user_id'  => $igUserId,
                'instagram_username' => $igUsername,
                'page_id'            => null,
                'access_token'       => $accessToken,
                'token_expires_at'   => now()->addSeconds($expiresIn),
            ]
        );

        return redirect('/instagram?connected=1');
    }

    // Estado de la conexión del usuario autenticado
    public function status(Request $request): JsonResponse
    {
        $account = InstagramAccount::where('user_id', $request->user()->id)->first();

        if (! $account) {
            return response()->json(['connected' => false]);
        }

        return response()->json([
            'connected'  => true,
            'username'   => $account->instagram_username,
            'ig_user_id' => $account->instagram_user_id,
            'expires_at' => $account->token_expires_at?->toISOString(),
            'expired'    => $account->isExpired(),
        ]);
    }

    // Listar posts del feed
    public function posts(Request $request): JsonResponse
    {
        $account = $this->getAccount($request);
        if (! $account) {
            return response()->json(['error' => 'not_connected'], 401);
        }

        $fields = 'id,caption,media_type,media_url,thumbnail_url,timestamp,permalink';

        $res = Http::get("{$this->graphBase}/{$account->instagram_user_id}/media", [
            'fields'       => $fields,
            'access_token' => $account->access_token,
            'limit'        => $request->integer('limit', 12),
        ]);

        if (! $res->ok()) {
            return response()->json(['error' => 'api_error', 'detail' => $res->json()], 502);
        }

        return response()->json(['posts' => $res->json('data', [])]);
    }

    // Publicar un post (imagen via URL pública)
    public function publish(Request $request): JsonResponse
    {
        $data = $request->validate([
            'image_url' => 'required|url',
            'caption'   => 'nullable|string|max:2200',
        ]);

        $account = $this->getAccount($request);
        if (! $account) {
            return response()->json(['error' => 'not_connected'], 401);
        }

        // Paso 1: crear contenedor de media
        $containerRes = Http::post("{$this->graphBase}/{$account->instagram_user_id}/media", [
            'image_url'    => $data['image_url'],
            'caption'      => $data['caption'] ?? '',
            'access_token' => $account->access_token,
        ]);

        if (! $containerRes->ok()) {
            return response()->json(['error' => 'container_failed', 'detail' => $containerRes->json()], 502);
        }

        $containerId = $containerRes->json('id');

        // Paso 2: publicar el contenedor
        $publishRes = Http::post("{$this->graphBase}/{$account->instagram_user_id}/media_publish", [
            'creation_id'  => $containerId,
            'access_token' => $account->access_token,
        ]);

        if (! $publishRes->ok()) {
            return response()->json(['error' => 'publish_failed', 'detail' => $publishRes->json()], 502);
        }

        return response()->json(['id' => $publishRes->json('id')], 201);
    }

    // Desconectar cuenta
    public function disconnect(Request $request): JsonResponse
    {
        InstagramAccount::where('user_id', $request->user()->id)->delete();
        return response()->json(['disconnected' => true]);
    }

    private function getAccount(Request $request): ?InstagramAccount
    {
        return InstagramAccount::where('user_id', $request->user()->id)->first();
    }
}
