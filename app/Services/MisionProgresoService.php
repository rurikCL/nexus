<?php

namespace App\Services;

use App\Models\Mision;
use App\Models\User;

/**
 * Registra avance automático de objetivos de misión (cualquier tipo_mision)
 * cuando ocurren eventos concretos del juego (combate ganado, sesión de
 * entrenamiento asistida, tarea aprobada). Nunca marca una misión como
 * 'completada' — eso solo ocurre cuando el jugador confirma en
 * POST /misiones/{id}/completar (MisionController::completar), que además
 * exige que todos los objetivos ya estén al 100%.
 */
class MisionProgresoService
{
    public static function registrar(User $user, string $tipo, int $cantidad = 1): void
    {
        $misiones = Mision::where('activa', true)
            ->whereHas('objetivos', fn ($q) => $q->where('tipo', $tipo))
            ->with('objetivos')
            ->get();

        foreach ($misiones as $mision) {
            $pivot = $mision->users()->where('user_id', $user->id)->first()?->pivot;
            if ($pivot && $pivot->status === 'completada') {
                continue;
            }

            $progresoJson = $pivot?->progreso_json ? json_decode($pivot->progreso_json, true) : [];

            foreach ($mision->objetivos->where('tipo', $tipo) as $objetivo) {
                $actual = $progresoJson[(string) $objetivo->id] ?? 0;
                $progresoJson[(string) $objetivo->id] = min($objetivo->meta, $actual + $cantidad);
            }

            $porcentajes = $mision->objetivos->map(fn ($o) => $o->meta > 0
                ? min(100, (($progresoJson[(string) $o->id] ?? 0) / $o->meta) * 100)
                : 100);
            $progresoGeneral = $porcentajes->isEmpty() ? 0 : (int) round($porcentajes->avg());

            $mision->users()->syncWithoutDetaching([
                $user->id => [
                    'status' => $progresoGeneral > 0 ? 'en-curso' : 'pendiente',
                    'progreso' => $progresoGeneral,
                    'progreso_json' => json_encode($progresoJson),
                ],
            ]);
        }
    }
}
