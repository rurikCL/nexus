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
}
