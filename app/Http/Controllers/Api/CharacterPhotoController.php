<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Traits\ConvertsToWebp;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

class CharacterPhotoController extends Controller
{
    use ConvertsToWebp;

    public function store(Request $request): JsonResponse
    {
        $request->validate([
            'photo' => 'required|image|max:2048',
        ]);

        $user      = $request->user();
        $character = $user->character;

        if (! $character) {
            return response()->json(['message' => 'Personaje no encontrado.'], 404);
        }

        // Borrar foto anterior si existe
        if ($character->photo) {
            Storage::disk('public')->delete($character->photo);
        }

        $path = $this->saveAsWebp($request->file('photo'), 'portraits');

        $character->update(['photo' => $path]);

        return response()->json([
            'photo_url' => Storage::disk('public')->url($path) . '?v=' . $character->updated_at->timestamp,
        ]);
    }

    /**
     * Retrato RPG del personaje — la imagen que se muestra en el Mapa Galáctico, sus combates y
     * la Carta de personaje impresa (ver Character::imagenMapa, que prioriza este campo por
     * sobre `photo`, la foto de perfil genérica).
     */
    public function storeImagenRpg(Request $request): JsonResponse
    {
        $request->validate([
            'imagen_rpg' => 'required|image|max:2048',
        ]);

        $user      = $request->user();
        $character = $user->character;

        if (! $character) {
            return response()->json(['message' => 'Personaje no encontrado.'], 404);
        }

        if ($character->imagen_rpg) {
            Storage::disk('public')->delete($character->imagen_rpg);
        }

        $path = $this->saveAsWebp($request->file('imagen_rpg'), 'rpg-portraits');

        $character->update(['imagen_rpg' => $path]);

        return response()->json([
            'imagen_rpg_url' => Storage::disk('public')->url($path) . '?v=' . $character->updated_at->timestamp,
        ]);
    }
}
