<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\MapNave;
use App\Models\MapPlaneta;
use App\Models\PirataEncuentro;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Emboscadas de naves piratas al viajar entre planetas de un sistema hostil.
 * El chequeo y la recompensa se resuelven en el servidor (no se confía en el
 * cliente) para que el jugador no pueda inventar un encuentro o su recompensa.
 */
class PirataEncuentroController extends Controller
{
    /** Probabilidad (%) de emboscada según el nivel de hostilidad del sistema. */
    private function ambushChance(?string $hostilidad): int
    {
        return match ($hostilidad) {
            'bajo'    => 8,
            'medio'   => 15,
            'alto'    => 25,
            'extremo' => 35,
            default   => 0, // 'seguro' o sin dato
        };
    }

    /** POST /map/planetas/{planeta}/pirata-encuentro */
    public function check(Request $request, int $planetaId): JsonResponse
    {
        $planeta   = MapPlaneta::with('sistema')->findOrFail($planetaId);
        $character = $request->user()->character;

        // Sin nave equipada no hay a quién atacar.
        if (!$character || !$character->nave_equipada_id) {
            return response()->json(['ambush' => false]);
        }

        $chance = $this->ambushChance($planeta->sistema->hostilidad ?? null);
        if ($chance <= 0 || random_int(1, 100) > $chance) {
            return response()->json(['ambush' => false]);
        }

        $pirata = MapNave::where('tipo', 'pirata')->inRandomOrder()->first();
        if (!$pirata) {
            // No hay naves configuradas como "pirata" en el catálogo.
            return response()->json(['ambush' => false]);
        }

        $encuentro = PirataEncuentro::create([
            'character_id' => $character->id,
            'nave_id'      => $pirata->id,
        ]);

        return response()->json([
            'ambush'       => true,
            'encuentro_id' => $encuentro->id,
            'pirata'       => $pirata,
        ]);
    }

    /** POST /pirata-encuentros/{encuentro}/victoria */
    public function victoria(Request $request, int $encuentroId): JsonResponse
    {
        $character = $request->user()->character;
        if (!$character) {
            return response()->json(['message' => 'No tienes un personaje.'], 422);
        }

        $encuentro = PirataEncuentro::where('character_id', $character->id)
            ->where('resuelto', false)
            ->findOrFail($encuentroId);

        $nave = MapNave::findOrFail($encuentro->nave_id);

        $creditos = (int) ($nave->vida + $nave->escudo + $nave->ataque + $nave->velocidad + $nave->maniobrabilidad);

        $character->increment('credits', $creditos);
        $encuentro->update(['resuelto' => true, 'credits_awarded' => $creditos]);

        return response()->json([
            'credits_awarded' => $creditos,
            'credits'         => $character->credits,
        ]);
    }
}
