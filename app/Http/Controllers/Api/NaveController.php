<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\CharacterNave;
use App\Models\MapNave;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class NaveController extends Controller
{
    /** GET /naves — catálogo de naves disponibles para comprar */
    public function catalogo(): JsonResponse
    {
        return response()->json(['naves' => MapNave::orderBy('costo')->get()]);
    }

    /** GET /naves/mias — naves propiedad del personaje */
    public function mias(Request $request): JsonResponse
    {
        $character = $request->user()->character;
        if (! $character) {
            return response()->json(['error' => 'Sin personaje'], 404);
        }

        $naves = $character->naves()->with('nave')->get();

        return response()->json([
            'naves'            => $naves,
            'nave_equipada_id' => $character->nave_equipada_id,
            'capacidad_carga'  => $character->capacidadCarga(),
            'credits'          => $character->credits,
        ]);
    }

    /** POST /naves/{id}/comprar */
    public function comprar(Request $request, int $id): JsonResponse
    {
        $character = $request->user()->character;
        if (! $character) {
            return response()->json(['error' => 'Sin personaje'], 404);
        }

        $nave = MapNave::findOrFail($id);

        if ($character->credits < $nave->costo) {
            return response()->json(['error' => 'No tienes suficientes créditos para comprar esta nave.'], 422);
        }

        $character->decrement('credits', $nave->costo);

        $owned = CharacterNave::create([
            'character_id'       => $character->id,
            'nave_id'            => $nave->id,
            'combustible_actual' => $nave->capacidad_salto,
            'vida_actual'        => $nave->vida,
            'escudo_actual'      => $nave->escudo,
        ]);

        return response()->json([
            'nave'             => $owned->load('nave'),
            'credits_remaining' => $character->fresh()->credits,
        ], 201);
    }

    /** POST /naves/{ownedId}/equipar */
    public function equipar(Request $request, int $ownedId): JsonResponse
    {
        $character = $request->user()->character;
        if (! $character) {
            return response()->json(['error' => 'Sin personaje'], 404);
        }

        $owned = CharacterNave::where('character_id', $character->id)->findOrFail($ownedId);

        $character->update(['nave_equipada_id' => $owned->id]);

        return response()->json(['nave_equipada_id' => $owned->id]);
    }

    /** POST /naves/desequipar */
    public function desequipar(Request $request): JsonResponse
    {
        $character = $request->user()->character;
        if (! $character) {
            return response()->json(['error' => 'Sin personaje'], 404);
        }

        $character->update(['nave_equipada_id' => null]);

        return response()->json(['ok' => true]);
    }

    /** POST /naves/{ownedId}/reabastecer — recarga combustible al máximo */
    public function reabastecer(Request $request, int $ownedId): JsonResponse
    {
        $character = $request->user()->character;
        if (! $character) {
            return response()->json(['error' => 'Sin personaje'], 404);
        }

        $owned = CharacterNave::where('character_id', $character->id)->with('nave')->findOrFail($ownedId);
        $costo = $owned->nave->costo_combustible;

        if ($character->credits < $costo) {
            return response()->json(['error' => 'No tienes suficientes créditos para reabastecer la nave.'], 422);
        }

        $character->decrement('credits', $costo);
        $owned->update(['combustible_actual' => $owned->nave->capacidad_salto]);

        return response()->json([
            'nave'              => $owned->fresh('nave'),
            'credits_remaining' => $character->fresh()->credits,
        ]);
    }

    /** POST /naves/{ownedId}/reparar — restaura vida y escudo al máximo */
    public function reparar(Request $request, int $ownedId): JsonResponse
    {
        $character = $request->user()->character;
        if (! $character) {
            return response()->json(['error' => 'Sin personaje'], 404);
        }

        $owned = CharacterNave::where('character_id', $character->id)->with('nave')->findOrFail($ownedId);
        $costo = $owned->nave->costo_reparacion;

        if ($character->credits < $costo) {
            return response()->json(['error' => 'No tienes suficientes créditos para reparar la nave.'], 422);
        }

        $character->decrement('credits', $costo);
        $owned->update([
            'vida_actual'   => $owned->nave->vida,
            'escudo_actual' => $owned->nave->escudo,
        ]);

        return response()->json([
            'nave'              => $owned->fresh('nave'),
            'credits_remaining' => $character->fresh()->credits,
        ]);
    }
}
