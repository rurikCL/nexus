<?php

namespace Tests\Unit;

use App\Services\DungeonGraphBuilder;
use PHPUnit\Framework\TestCase;

class DungeonGraphBuilderTest extends TestCase
{
    public function test_misma_seed_y_num_salas_produce_siempre_el_mismo_grafo(): void
    {
        $builder = new DungeonGraphBuilder;

        $a = $builder->construir(7, 12345);
        $b = $builder->construir(7, 12345);

        $this->assertSame($a, $b);
    }

    public function test_no_genera_mas_salas_que_las_pedidas(): void
    {
        $builder = new DungeonGraphBuilder;

        foreach ([2, 5, 6, 8, 12] as $numSalas) {
            $grafo = $builder->construir($numSalas, 999 + $numSalas);
            $this->assertLessThanOrEqual($numSalas, count($grafo['nodos']));
        }
    }

    public function test_el_grafo_es_conexo_desde_la_entrada(): void
    {
        $builder = new DungeonGraphBuilder;
        $grafo = $builder->construir(8, 42);
        $nodos = $grafo['nodos'];

        $visitados = [0 => true];
        $cola = [0];
        while (! empty($cola)) {
            $actual = array_shift($cola);
            foreach ($nodos[$actual]['vecinos'] as $vecino) {
                if (! isset($visitados[$vecino])) {
                    $visitados[$vecino] = true;
                    $cola[] = $vecino;
                }
            }
        }

        $this->assertCount(count($nodos), $visitados);
    }

    public function test_cada_nodo_ocupa_una_coordenada_unica(): void
    {
        $builder = new DungeonGraphBuilder;
        $grafo = $builder->construir(10, 7);

        $coords = array_map(fn ($n) => $n['x'].','.$n['y'], $grafo['nodos']);

        $this->assertCount(count($coords), array_unique($coords));
    }

    public function test_direcciones_entre_vecinos_son_reciprocas(): void
    {
        $builder = new DungeonGraphBuilder;
        $grafo = $builder->construir(8, 2026);
        $opuesto = ['norte' => 'sur', 'sur' => 'norte', 'este' => 'oeste', 'oeste' => 'este'];

        foreach ($grafo['nodos'] as $index => $nodo) {
            foreach ($nodo['vecinos'] as $dir => $vecinoIndex) {
                $this->assertSame($index, $grafo['nodos'][$vecinoIndex]['vecinos'][$opuesto[$dir]]);
            }
        }
    }

    public function test_la_sala_jefe_es_la_mas_lejana_de_la_entrada(): void
    {
        $builder = new DungeonGraphBuilder;
        $grafo = $builder->construir(8, 555);
        $nodos = $grafo['nodos'];

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
        $this->assertSame($maxDist, $distancias[$grafo['jefeIndex']]);
        $this->assertGreaterThan(0, $maxDist);
    }
}
