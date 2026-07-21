<?php

namespace App\Services;

use App\Models\Character;
use App\Models\MapRecompensa;
use App\Models\User;
use Illuminate\Support\Collection;

/**
 * Resuelve el botín al derrotar un NPC (tipo jefe) o Enemigo con recompensas configuradas
 * (ver MapNpc::recompensas / MapEnemigo::recompensas). Toda recompensa de tipo "creditos"
 * se entrega siempre; además, si hay alguna recompensa de otro tipo, se sortea UNA sola
 * entre ellas mediante un sorteo ponderado por su "porcentaje" relativo al resto del pool
 * (no es una probabilidad independiente por ítem: con una sola recompensa no-crédito
 * definida, esa siempre se entrega sin importar su porcentaje).
 */
class RecompensaRollService
{
    /** @param Collection<int, MapRecompensa> $recompensas */
    public static function resolverYOtorgar(Collection $recompensas, User $user, ?Character $character): array
    {
        if (!$character || $recompensas->isEmpty()) {
            return [];
        }

        $otorgadas = [];

        foreach ($recompensas->where('tipo', 'creditos') as $r) {
            if ($aplicada = self::aplicar($r, $user, $character)) {
                $otorgadas[] = $aplicada;
            }
        }

        $otras = $recompensas->where('tipo', '!=', 'creditos');
        if ($otras->isNotEmpty()) {
            $elegida = self::elegirPonderada($otras);
            if ($elegida && ($aplicada = self::aplicar($elegida, $user, $character))) {
                $otorgadas[] = $aplicada;
            }
        }

        return $otorgadas;
    }

    /** @param Collection<int, MapRecompensa> $recompensas */
    private static function elegirPonderada(Collection $recompensas): ?MapRecompensa
    {
        $total = (int) $recompensas->sum(fn ($r) => max(0, (int) $r->porcentaje));
        if ($total <= 0) {
            return $recompensas->first();
        }

        $roll = random_int(1, $total);
        $acumulado = 0;
        foreach ($recompensas as $r) {
            $acumulado += max(0, (int) $r->porcentaje);
            if ($roll <= $acumulado) {
                return $r;
            }
        }

        return $recompensas->last();
    }

    private static function aplicar(MapRecompensa $r, User $user, Character $character): ?array
    {
        if ($r->tipo === 'creditos' && $r->valor) {
            $character->increment('credits', $r->valor);

            return ['tipo' => 'creditos', 'valor' => $r->valor, 'label' => "{$r->valor} créditos"];
        }

        if ($r->tipo === 'objeto' && $r->objeto_id) {
            if ($character->inventarioLleno()) {
                return ['tipo' => 'objeto', 'objeto_id' => $r->objeto_id, 'sin_espacio' => true, 'label' => ($r->objeto->nombre ?? 'objeto') . ' (sin espacio en inventario)'];
            }
            $character->rolObjetos()->syncWithoutDetaching([$r->objeto_id]);

            return ['tipo' => 'objeto', 'objeto_id' => $r->objeto_id, 'label' => $r->objeto->nombre ?? 'objeto'];
        }

        if ($r->tipo === 'habilidad' && $r->habilidad_id) {
            $user->habilidadesAprendidas()->syncWithoutDetaching([$r->habilidad_id]);

            return ['tipo' => 'habilidad', 'habilidad_id' => $r->habilidad_id, 'label' => $r->habilidad->nombre ?? 'habilidad'];
        }

        if ($r->tipo === 'punto_habilidad' && $r->valor) {
            $character->increment('puntos_libres', $r->valor);

            return ['tipo' => 'punto_habilidad', 'valor' => $r->valor, 'label' => "{$r->valor} punto" . ($r->valor === 1 ? '' : 's') . ' de habilidad'];
        }

        if ($r->tipo === 'titulo' && $r->nombre) {
            $character->titulos()->firstOrCreate(['nombre' => $r->nombre], ['tipo' => 'titulo']);

            return ['tipo' => 'titulo', 'nombre' => $r->nombre, 'label' => "título \"{$r->nombre}\""];
        }

        if ($r->tipo === 'insignia' && $r->medalla_id) {
            $character->medallas()->firstOrCreate(['medalla_id' => $r->medalla_id]);

            return ['tipo' => 'insignia', 'medalla_id' => $r->medalla_id, 'label' => 'insignia "' . ($r->medalla->nombre ?? '') . '"'];
        }

        return null;
    }
}
