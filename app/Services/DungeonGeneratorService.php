<?php

declare(strict_types=1);

namespace App\Services;

use App\Models\DungeonRun;
use App\Models\DungeonSala;
use App\Models\DungeonSalaProgreso;
use App\Models\MapEnemigo;
use Illuminate\Support\Collection;
use Random\Engine\Mt19937;
use Random\Randomizer;

/**
 * Arranca un DungeonRun cuyo equipo ya confirmó "listo" en el lobby (ver
 * DungeonController::listo): construye el grafo con DungeonGraphBuilder,
 * pre-rola el enemigo de cada sala normal contra el pool del template (misma
 * selección ponderada por tasa_aparicion que LugarEncuentroController::check),
 * persiste run + salas conectadas, y ubica a todo el equipo en la entrada.
 */
class DungeonGeneratorService
{
    public static function generar(DungeonRun $run): DungeonRun
    {
        $template = $run->template;
        $numSalas = $template->numSalasValido(random_int((int) $template->salas_min, (int) $template->salas_max));
        $seed = random_int(0, PHP_INT_MAX);

        $grafo = (new DungeonGraphBuilder)->construir($numSalas, $seed);
        $rng = new Randomizer(new Mt19937($seed));
        $pool = $template->enemigos()->wherePivot('tasa_aparicion', '>', 0)->get();

        $salas = [];
        foreach ($grafo['nodos'] as $index => $nodo) {
            $tipo = $index === 0 ? 'entrada' : ($index === $grafo['jefeIndex'] ? 'jefe' : 'normal');
            $encuentro = $tipo === 'normal' ? self::elegirEnemigo($pool, $rng) : null;

            $salas[$index] = DungeonSala::create([
                'dungeon_run_id' => $run->id,
                'tipo' => $tipo,
                'enemigo_id' => $encuentro['enemigo_id'] ?? null,
                'nivel_enemigo' => $encuentro['nivel'] ?? null,
            ]);
        }

        foreach ($grafo['nodos'] as $index => $nodo) {
            $actualizacion = [];
            foreach ($nodo['vecinos'] as $dir => $vecinoIndex) {
                $columna = match ($dir) {
                    'norte' => 'norte_id',
                    'sur' => 'sur_id',
                    'este' => 'este_id',
                    'oeste' => 'oeste_id',
                };
                $actualizacion[$columna] = $salas[$vecinoIndex]->id;
            }
            if (! empty($actualizacion)) {
                $salas[$index]->update($actualizacion);
            }
        }

        $entrada = $salas[0];
        foreach ($run->jugadores as $jugador) {
            $jugador->update(['sala_actual_id' => $entrada->id]);
            DungeonSalaProgreso::create([
                'dungeon_run_player_id' => $jugador->id,
                'dungeon_sala_id' => $entrada->id,
                'visitada' => true,
                'resuelta' => true, // la entrada nunca tiene enemigo pre-rolado
            ]);
        }

        $run->update(['seed' => $seed, 'estado' => 'en_curso', 'iniciado_at' => now()]);

        return $run->fresh(['salas', 'jugadores.salaActual']);
    }

    /** @param Collection<int, MapEnemigo> $pool */
    private static function elegirEnemigo(Collection $pool, Randomizer $rng): ?array
    {
        if ($pool->isEmpty()) {
            return null;
        }

        $pesoTotal = $pool->sum(fn ($e) => max(1, (int) $e->pivot->tasa_aparicion));
        $tirada = $rng->getInt(1, $pesoTotal);
        $acumulado = 0;

        foreach ($pool as $enemigo) {
            $acumulado += max(1, (int) $enemigo->pivot->tasa_aparicion);
            if ($tirada <= $acumulado) {
                return ['enemigo_id' => $enemigo->id, 'nivel' => (int) $enemigo->pivot->nivel];
            }
        }

        $ultimo = $pool->last();

        return ['enemigo_id' => $ultimo->id, 'nivel' => (int) $ultimo->pivot->nivel];
    }
}
