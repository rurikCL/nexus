<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Character;
use App\Models\CharacterMedalla;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class CharacterMedallaController extends Controller
{
    private function character(Request $request): Character
    {
        $character = $request->user()->character;
        abort_if(! $character, 404, 'Sin personaje');

        return $character;
    }

    // GET /medallas — medallas que el personaje ha ganado
    public function index(Request $request): JsonResponse
    {
        return response()->json([
            'medallas' => $this->character($request)->medallas()->with('medalla')->latest()->get(),
        ]);
    }

    // POST /medallas/{medalla}/activar — elegir cuál se muestra (Comando + carta imprimible)
    public function activar(Request $request, CharacterMedalla $medalla): JsonResponse
    {
        $character = $this->character($request);
        abort_if($medalla->character_id !== $character->id, 403, 'No autorizado.');

        $character->medallas()->update(['activo' => false]);
        $medalla->update(['activo' => true]);
        $medalla->load('medalla');

        return response()->json(['medalla_activa' => $medalla]);
    }

    // POST /medallas/desactivar — no mostrar ninguna
    public function desactivar(Request $request): JsonResponse
    {
        $this->character($request)->medallas()->update(['activo' => false]);

        return response()->json(['ok' => true]);
    }
}
