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
 * decide qué salas normales tienen enemigo garantizado / al azar y cuáles
 * tienen cofre (ver reparteEncuentros/reparteCofres), persiste run + salas
 * conectadas, y ubica a todo el equipo en la entrada.
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

        // Índices de sala "normal" (ni entrada ni jefe) sobre los que se reparten enemigos/cofres.
        $normales = collect($grafo['nodos'])->keys()
            ->reject(fn ($i) => $i === 0 || $i === $grafo['jefeIndex'])
            ->values();

        /*
         * Enemigos garantizados = mitad de las salas totales del dungeon (redondeado hacia
         * abajo), acotado a la cantidad de salas normales disponibles. El resto de las salas
         * normales tira 50% independiente de tener encuentro.
         */
        $cantidadGarantizados = min($normales->count(), intdiv($numSalas, 2));
        $indicesGarantizados = self::elegirIndicesAlAzar($normales, $cantidadGarantizados, $rng);

        // Cofres: cantidad fija según la rareza del template (ver DungeonTemplate::cofresTotal), repartidos al azar.
        $cantidadCofres = min($normales->count(), $template->cofresTotal());
        $indicesConCofre = self::elegirIndicesAlAzar($normales, $cantidadCofres, $rng);

        $salas = [];
        foreach ($grafo['nodos'] as $index => $nodo) {
            $tipo = $index === 0 ? 'entrada' : ($index === $grafo['jefeIndex'] ? 'jefe' : 'normal');

            $tieneEnemigo = $tipo === 'normal' && (
                $indicesGarantizados->contains($index)
                || $rng->getInt(1, 100) <= 50
            );
            $encuentro = $tieneEnemigo ? self::elegirEnemigo($pool, $rng) : null;

            $tieneCofre = $tipo === 'normal' && $indicesConCofre->contains($index);

            $salas[$index] = DungeonSala::create([
                'dungeon_run_id' => $run->id,
                'tipo' => $tipo,
                'enemigo_id' => $encuentro['enemigo_id'] ?? null,
                'nivel_enemigo' => $encuentro['nivel'] ?? null,
                'pos_x' => $nodo['x'],
                'pos_y' => $nodo['y'],
                'tiene_cofre' => $tieneCofre,
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
        $run->loadMissing('jugadores.user.character');
        foreach ($run->jugadores as $jugador) {
            $stats = $jugador->user->character?->combatStats();
            $jugador->update([
                'sala_actual_id' => $entrada->id,
                // Vida/escudo con los que el equipo arranca el dungeon — se van gastando entre
                // salas y solo se recuperan con objetos 'utilizable' (ver DungeonController::usarObjeto).
                'hp_actual' => $stats['vida'] ?? null,
                'escudo_actual' => $stats['escudo'] ?? null,
            ]);
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

    /**
     * Elige $cantidad índices distintos al azar de $indices (sin reemplazo), con el mismo
     * generador seedeado que el resto de la generación — determinístico por seed.
     *
     * @param  Collection<int, int>  $indices
     * @return Collection<int, int>
     */
    private static function elegirIndicesAlAzar(Collection $indices, int $cantidad, Randomizer $rng): Collection
    {
        $disponibles = $indices->values()->all();
        $elegidos = [];

        for ($i = 0; $i < $cantidad && count($disponibles) > 0; $i++) {
            $pos = $rng->getInt(0, count($disponibles) - 1);
            $elegidos[] = $disponibles[$pos];
            array_splice($disponibles, $pos, 1);
        }

        return collect($elegidos);
    }
}
