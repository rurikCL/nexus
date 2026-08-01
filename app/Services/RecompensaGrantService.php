<?php

namespace App\Services;

use App\Models\User;

/**
 * Otorga una colección de recompensas (mismo shape que Recompensa y EventoRecompensa:
 * tipo, valor, nombre, habilidad_id, objeto_id, medalla_id) al personaje de un usuario.
 * Compartido entre MisionController (recompensas de misión) y EventController
 * (recompensas de evento) — la única diferencia entre ambos orígenes es qué columna
 * de procedencia se deja en character_titulos / character_medallas, indicada por
 * $origin (ej. ['mision_id' => $id] o ['event_id' => $id]).
 */
class RecompensaGrantService
{
    /** @param iterable<object> $recompensas */
    public function otorgar(iterable $recompensas, User $user, array $origin = []): array
    {
        $character = $user->character;

        $habilidadesAprendidas = [];
        $objetosOtorgados = [];
        $objetosSinEspacio = [];
        $creditosOtorgados = 0;
        $puntosLibresOtorgados = 0;
        $titulosOtorgados = [];
        $medallasOtorgadas = [];

        foreach ($recompensas as $recompensa) {
            if ($recompensa->tipo === 'habilidad' && $recompensa->habilidad_id) {
                $user->habilidadesAprendidas()->syncWithoutDetaching([$recompensa->habilidad_id]);
                $habilidadesAprendidas[] = $recompensa->habilidad_id;
            } elseif ($recompensa->tipo === 'objeto' && $recompensa->objeto_id && $character) {
                if ($character->inventarioLleno()) {
                    $objetosSinEspacio[] = $recompensa->objeto_id;
                } else {
                    $character->rolObjetos()->syncWithoutDetaching([$recompensa->objeto_id]);
                    $objetosOtorgados[] = $recompensa->objeto_id;
                }
            } elseif ($recompensa->tipo === 'creditos' && $recompensa->valor && $character) {
                $character->increment('credits', $recompensa->valor);
                $creditosOtorgados += $recompensa->valor;
            } elseif ($recompensa->tipo === 'punto_habilidad' && $recompensa->valor && $character) {
                $character->increment('puntos_libres', $recompensa->valor);
                $puntosLibresOtorgados += $recompensa->valor;
            } elseif ($recompensa->tipo === 'titulo' && $character) {
                $titulo = $character->titulos()->firstOrCreate(
                    ['nombre' => $recompensa->nombre],
                    array_merge(['tipo' => 'titulo'], $origin)
                );
                $titulosOtorgados[] = $titulo->only(['id', 'nombre', 'tipo']);
            } elseif ($recompensa->tipo === 'insignia' && $recompensa->medalla_id && $character) {
                $medalla = $character->medallas()->firstOrCreate(
                    ['medalla_id' => $recompensa->medalla_id],
                    $origin
                );
                $medalla->load('medalla');
                $medallasOtorgadas[] = ['id' => $medalla->id, 'medalla_id' => $medalla->medalla_id, 'medalla' => $medalla->medalla];
            }
        }

        return [
            'habilidades_aprendidas' => $habilidadesAprendidas,
            'objetos_otorgados' => $objetosOtorgados,
            'objetos_sin_espacio' => $objetosSinEspacio,
            'creditos_otorgados' => $creditosOtorgados,
            'puntos_libres_otorgados' => $puntosLibresOtorgados,
            'titulos_otorgados' => $titulosOtorgados,
            'medallas_otorgadas' => $medallasOtorgadas,
        ];
    }
}
