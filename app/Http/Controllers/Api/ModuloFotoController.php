<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ModuloFoto;
use App\Traits\ConvertsToWebp;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;

class ModuloFotoController extends Controller
{
    use ConvertsToWebp;

    private const ADMIN_TIERS = ['caballero', 'maestro', 'granmaestro'];
    private const MODEL       = 'mistral-medium-latest';

    public function store(Request $request): JsonResponse
    {
        $user = $request->user();
        if (! in_array($user->tier, self::ADMIN_TIERS)) {
            return response()->json(['message' => 'No autorizado.'], 403);
        }

        $data = $request->validate([
            'descripcion'              => 'required|string|max:1000',
            'modulo_entrenamiento_id'  => 'nullable|integer|exists:modulos_entrenamiento,id',
        ]);

        $conversation = Http::withToken(config('services.mistral.api_key'))
            ->timeout(90)
            ->post('https://api.mistral.ai/v1/conversations', [
                'model'        => self::MODEL,
                'instructions' => 'Genera una única imagen de referencia fotográfica para un módulo de entrenamiento de combate con sable de luz, acorde a la descripción entregada. No incluyas texto en la imagen.',
                'tools'        => [['type' => 'image_generation']],
                'inputs'       => $data['descripcion'],
            ]);

        if ($conversation->failed()) {
            Log::error('Mistral image generation error', ['status' => $conversation->status(), 'body' => $conversation->body()]);
            return response()->json(['message' => 'Error al generar la imagen.'], 502);
        }

        $fileChunk = collect($conversation->json('outputs', []))
            ->last()['content'] ?? [];

        $fileId = collect($fileChunk)->firstWhere('type', 'tool_file')['file_id'] ?? null;

        if (! $fileId) {
            Log::error('Mistral image generation: sin file_id', ['response' => $conversation->json()]);
            return response()->json(['message' => 'La IA no devolvió una imagen.'], 502);
        }

        $download = Http::withToken(config('services.mistral.api_key'))
            ->withHeaders(['Accept' => 'application/octet-stream'])
            ->timeout(60)
            ->get("https://api.mistral.ai/v1/files/{$fileId}/content");

        if ($download->failed()) {
            Log::error('Mistral image download error', ['status' => $download->status(), 'file_id' => $fileId]);
            return response()->json(['message' => 'Error al descargar la imagen generada.'], 502);
        }

        $path = $this->saveContentsAsWebp($download->body(), 'modulos_fotos');

        $foto = ModuloFoto::create([
            'modulo_entrenamiento_id' => $data['modulo_entrenamiento_id'] ?? null,
            'path'                    => $path,
            'prompt'                  => $data['descripcion'],
            'creado_por'              => $user->id,
        ]);

        return response()->json([
            'foto' => [
                'id'   => $foto->id,
                'url'  => Storage::disk('public')->url($path),
                'path' => $path,
            ],
        ], 201);
    }
}
