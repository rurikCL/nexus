<?php

declare(strict_types=1);

namespace App\Services;

use Random\Engine\Mt19937;
use Random\Randomizer;

/**
 * Algoritmo puro de generación del grafo de un dungeon (sin tocar la BD),
 * separado de DungeonGeneratorService para poder testearlo de forma
 * determinística: misma seed + mismo numSalas -> siempre el mismo grafo.
 *
 * Random-walk sobre una grilla virtual: en cada paso elige un nodo activo al
 * azar y lo extiende en una dirección libre, hasta alcanzar numSalas o hasta
 * que ningún nodo activo tenga direcciones libres. Genera un grafo
 * mayormente lineal con ramales cortos ocasionales (cuando el random-walk
 * "retrocede" a un nodo con más de una salida libre).
 */
class DungeonGraphBuilder
{
    private const DIRECCIONES = [
        'norte' => [0, 1],
        'sur' => [0, -1],
        'este' => [1, 0],
        'oeste' => [-1, 0],
    ];

    private const OPUESTO = [
        'norte' => 'sur',
        'sur' => 'norte',
        'este' => 'oeste',
        'oeste' => 'este',
    ];

    /**
     * @return array{nodos: list<array{x: int, y: int, vecinos: array<string, int>}>, jefeIndex: int}
     */
    public function construir(int $numSalas, int $seed): array
    {
        $numSalas = max(2, $numSalas);
        $rng = new Randomizer(new Mt19937($seed));

        $nodos = [['x' => 0, 'y' => 0, 'vecinos' => []]];
        $ocupadas = ['0,0' => 0];
        $activos = [0];

        while (count($nodos) < $numSalas && ! empty($activos)) {
            $posActivo = $rng->getInt(0, count($activos) - 1);
            $origen = $activos[$posActivo];

            $dirLibres = array_values(array_filter(
                array_keys(self::DIRECCIONES),
                function (string $dir) use ($nodos, $origen, $ocupadas): bool {
                    [$dx, $dy] = self::DIRECCIONES[$dir];
                    $clave = ($nodos[$origen]['x'] + $dx).','.($nodos[$origen]['y'] + $dy);

                    return ! isset($ocupadas[$clave]);
                }
            ));

            if (empty($dirLibres)) {
                array_splice($activos, $posActivo, 1);

                continue;
            }

            $dir = $dirLibres[$rng->getInt(0, count($dirLibres) - 1)];
            [$dx, $dy] = self::DIRECCIONES[$dir];
            $x = $nodos[$origen]['x'] + $dx;
            $y = $nodos[$origen]['y'] + $dy;

            $nuevoIndex = count($nodos);
            $nodos[] = ['x' => $x, 'y' => $y, 'vecinos' => []];
            $ocupadas["$x,$y"] = $nuevoIndex;

            $nodos[$origen]['vecinos'][$dir] = $nuevoIndex;
            $nodos[$nuevoIndex]['vecinos'][self::OPUESTO[$dir]] = $origen;

            $activos[] = $nuevoIndex;
        }

        return [
            'nodos' => $nodos,
            'jefeIndex' => $this->nodoMasLejano($nodos, $rng),
        ];
    }

    /** BFS desde la entrada (índice 0); si hay empate en distancia máxima, el rng decide entre los candidatos. */
    private function nodoMasLejano(array $nodos, Randomizer $rng): int
    {
        $distancias = array_fill(0, count($nodos), null);
        $distancias[0] = 0;
        $cola = [0];

        while (! empty($cola)) {
            $actual = array_shift($cola);
            foreach ($nodos[$actual]['vecinos'] as $vecino) {
                if ($distancias[$vecino] === null) {
                    $distancias[$vecino] = $distancias[$actual] + 1;
                    $cola[] = $vecino;
                }
            }
        }

        $maxDist = max($distancias);
        $candidatos = array_values(array_keys(array_filter($distancias, fn ($d) => $d === $maxDist)));

        return $candidatos[$rng->getInt(0, count($candidatos) - 1)];
    }
}
