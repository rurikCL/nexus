<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\MapLugar;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class LugarEncuentroController extends Controller
{
    /** Nivel numérico de hostilidad (0-4) a partir del texto configurado en la zona del lugar. */
    private function hostilidadNivel(?string $hostilidad): int
    {
        return match ($hostilidad) {
            'bajo'    => 1,
            'medio'   => 2,
            'alto'    => 3,
            'extremo' => 4,
            default   => 0, // 'seguro' o sin dato
        };
    }

    /** Probabilidad (%) de que un enemigo ataque al llegar al lugar: 20% por nivel de hostilidad de su zona. */
    private function ataqueChance(?string $hostilidad): int
    {
        return min(100, $this->hostilidadNivel($hostilidad) * 20);
    }

    /**
     * POST /map/lugares/{lugar}/enemigo-encuentro
     * Se resuelve enteramente en el servidor (probabilidad y enemigo elegido) para que no
     * pueda manipularse desde el cliente — mismo criterio que PirataEncuentroController.
     */
    public function check(Request $request, int $lugarId): JsonResponse
    {
        $lugar = MapLugar::with(['zona', 'enemigos.habilidad1', 'enemigos.habilidad2'])->findOrFail($lugarId);

        $character = $request->user()->character;
        if (!$character) {
            return response()->json(['ataque' => false]);
        }

        $chance = $this->ataqueChance($lugar->zona->hostilidad ?? null);
        if ($chance <= 0 || random_int(1, 100) > $chance) {
            return response()->json(['ataque' => false]);
        }

        $candidatos = $lugar->enemigos->where('visible', true)->values();
        if ($candidatos->isEmpty()) {
            return response()->json(['ataque' => false]);
        }

        // Selección ponderada por la tasa de aparición de cada enemigo en este lugar.
        $pesoTotal = $candidatos->sum(fn ($e) => max(1, (int) $e->pivot->tasa_aparicion));
        $tirada    = random_int(1, $pesoTotal);
        $acumulado = 0;
        $elegido   = null;
        foreach ($candidatos as $enemigo) {
            $acumulado += max(1, (int) $enemigo->pivot->tasa_aparicion);
            if ($tirada <= $acumulado) {
                $elegido = $enemigo;
                break;
            }
        }
        $elegido ??= $candidatos->first();

        // El nivel de la asignación lugar-enemigo sobrescribe el nivel base del catálogo.
        $elegido->nivel = (int) $elegido->pivot->nivel;

        return response()->json(['ataque' => true, 'enemigo' => $elegido]);
    }
}
