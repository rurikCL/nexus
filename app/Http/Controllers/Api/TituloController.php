<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Character;
use App\Models\CharacterTitulo;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class TituloController extends Controller
{
    private function character(Request $request): Character
    {
        $character = $request->user()->character;
        abort_if(! $character, 404, 'Sin personaje');

        return $character;
    }

    // GET /titulos — títulos e insignias que el personaje ha ganado
    public function index(Request $request): JsonResponse
    {
        return response()->json([
            'titulos' => $this->character($request)->titulos()->latest()->get(),
        ]);
    }

    // POST /titulos/{titulo}/activar — elegir cuál se muestra bajo el nombre
    public function activar(Request $request, CharacterTitulo $titulo): JsonResponse
    {
        $character = $this->character($request);
        abort_if($titulo->character_id !== $character->id, 403, 'No autorizado.');

        $character->titulos()->update(['activo' => false]);
        $titulo->update(['activo' => true]);

        return response()->json(['titulo_activo' => $titulo]);
    }

    // POST /titulos/desactivar — no mostrar ningún título
    public function desactivar(Request $request): JsonResponse
    {
        $this->character($request)->titulos()->update(['activo' => false]);

        return response()->json(['ok' => true]);
    }
}
