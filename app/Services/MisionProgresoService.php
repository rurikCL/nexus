<?php

namespace App\Services;

use App\Models\Mision;
use App\Models\User;
use App\Notifications\MisionListaParaCompletar;
use Illuminate\Support\Collection;

/**
 * Registra avance automático de objetivos de misión (cualquier tipo_mision)
 * cuando ocurren eventos concretos del juego. Nunca marca una misión como
 * 'completada' — eso solo ocurre cuando el jugador confirma en
 * POST /misiones/{id}/completar (MisionController::completar), que además
 * exige que todos los objetivos ya estén al 100%.
 */
class MisionProgresoService
{
    private static function calcularProgresoGeneral(Mision $mision, array $progresoJson, array $characterHitos = []): int
    {
        $objetivos = self::buildObjetivosConProgreso($mision, $progresoJson, $characterHitos);
        if ($objetivos->isEmpty()) {
            return 0;
        }

        $porcentajes = $objetivos->map(function (array $o) {
            $meta = (int) ($o['meta'] ?? 0);
            if ($meta <= 0) {
                return 100;
            }
            return min(100, ((int) ($o['progreso_actual'] ?? 0) / $meta) * 100);
        });

        return (int) round($porcentajes->avg());
    }

    public static function buildObjetivosConProgreso(Mision $mision, array $progresoJson, array $characterHitos = []): Collection
    {
        $hitos = array_map('strval', $characterHitos);

        return $mision->objetivos->map(function ($o) use ($progresoJson, $hitos) {
            $meta = (int) ($o->meta ?? 0);
            $unidad = trim((string) ($o->unidad ?? ''));
            $actual = (int) ($progresoJson[(string) $o->id] ?? 0);

            if ($o->tipo === 'hito') {
                $actual = in_array($unidad, $hitos, true) ? max(1, $meta) : 0;
            }

            return [
                'id' => $o->id,
                'nombre' => $o->nombre,
                'descripcion' => $o->descripcion,
                'tipo' => $o->tipo,
                'meta' => $o->meta,
                'unidad' => $o->unidad,
                'progreso_tipo' => $o->progreso_tipo ?? 'conteo',
                'progreso_actual' => min($meta > 0 ? $meta : 0, $actual),
                'completado' => $actual >= $meta,
            ];
        })->values();
    }

    public static function registrarHito(User $user, string $hito): void
    {
        $hito = trim($hito);
        if ($hito === '') {
            return;
        }

        $misiones = Mision::where('activa', true)
            ->whereHas('objetivos', fn ($q) => $q->where('tipo', 'hito')->where('unidad', $hito))
            ->with('objetivos')
            ->get();

        foreach ($misiones as $mision) {
            $pivot = $mision->users()->where('user_id', $user->id)->first()?->pivot;
            if (! $pivot || $pivot->status === 'completada') {
                continue;
            }

            $progresoAntes = $pivot?->progreso_json ? json_decode($pivot->progreso_json, true) : [];
            $progresoJson = $progresoAntes;

            foreach ($mision->objetivos->where('tipo', 'hito')->where('unidad', $hito) as $objetivo) {
                $progresoJson[(string) $objetivo->id] = max((int) $objetivo->meta, 1);
            }

            $characterHitos = $user->character ? $user->character->hitos()->pluck('hito')->all() : [];
            $progresoGeneral = self::calcularProgresoGeneral($mision, $progresoJson, $characterHitos);

            $mision->users()->syncWithoutDetaching([
                $user->id => [
                    'status' => $progresoGeneral > 0 ? 'en-curso' : 'pendiente',
                    'progreso' => $progresoGeneral,
                    'progreso_json' => json_encode($progresoJson),
                ],
            ]);

            self::notificarSiListaParaCompletar($user, $mision, $progresoAntes, $progresoJson);
        }
    }

    public static function registrar(User $user, string $tipo, int $cantidad = 1): void
    {
        $misiones = Mision::where('activa', true)
            ->whereHas('objetivos', fn ($q) => $q->where('tipo', $tipo))
            ->with('objetivos')
            ->get();

        foreach ($misiones as $mision) {
            $pivot = $mision->users()->where('user_id', $user->id)->first()?->pivot;
            if (! $pivot || $pivot->status === 'completada') {
                continue;
            }

            $progresoAntes = $pivot?->progreso_json ? json_decode($pivot->progreso_json, true) : [];
            $progresoJson = $progresoAntes;

            foreach ($mision->objetivos->where('tipo', $tipo) as $objetivo) {
                $actual = $progresoJson[(string) $objetivo->id] ?? 0;
                $progresoJson[(string) $objetivo->id] = min($objetivo->meta, $actual + $cantidad);
            }

            $characterHitos = $user->character ? $user->character->hitos()->pluck('hito')->all() : [];
            $progresoGeneral = self::calcularProgresoGeneral($mision, $progresoJson, $characterHitos);

            $mision->users()->syncWithoutDetaching([
                $user->id => [
                    'status' => $progresoGeneral > 0 ? 'en-curso' : 'pendiente',
                    'progreso' => $progresoGeneral,
                    'progreso_json' => json_encode($progresoJson),
                ],
            ]);

            self::notificarSiListaParaCompletar($user, $mision, $progresoAntes, $progresoJson);
        }
    }

    public static function registrarMenu(User $user, string $slug): void
    {
        $slug = trim(strtolower($slug));

        if ($slug === '') {
            return;
        }

        $misiones = Mision::where('activa', true)
            ->whereHas('objetivos', fn ($q) => $q->where('tipo', 'menu')->where('unidad', $slug))
            ->with('objetivos')
            ->get();

        foreach ($misiones as $mision) {
            $pivot = $mision->users()->where('user_id', $user->id)->first()?->pivot;
            if (! $pivot || $pivot->status === 'completada') {
                continue;
            }

            $progresoAntes = $pivot?->progreso_json ? json_decode($pivot->progreso_json, true) : [];
            $progresoJson = $progresoAntes;

            foreach ($mision->objetivos->where('tipo', 'menu')->where('unidad', $slug) as $objetivo) {
                $progresoJson[(string) $objetivo->id] = $objetivo->meta;
            }

            $characterHitos = $user->character ? $user->character->hitos()->pluck('hito')->all() : [];
            $progresoGeneral = self::calcularProgresoGeneral($mision, $progresoJson, $characterHitos);

            $mision->users()->syncWithoutDetaching([
                $user->id => [
                    'status' => $progresoGeneral > 0 ? 'en-curso' : 'pendiente',
                    'progreso' => $progresoGeneral,
                    'progreso_json' => json_encode($progresoJson),
                ],
            ]);

            self::notificarSiListaParaCompletar($user, $mision, $progresoAntes, $progresoJson);
        }
    }

    public static function notificarSiListaParaCompletar(User $user, Mision $mision, array $progresoAntes, array $progresoDespues): void
    {
        $mision->loadMissing(['objetivos', 'recompensas.habilidad', 'recompensas.objeto']);

        if (! self::puedeCompletarCon($user, $mision, $progresoDespues)) {
            return;
        }

        if (self::puedeCompletarCon($user, $mision, $progresoAntes)) {
            return;
        }

        $user->notify(new MisionListaParaCompletar(self::buildMissionBannerPayload($user, $mision, $progresoDespues)));
    }

    public static function buildMissionBannerPayload(User $user, Mision $mision, array $progresoJson = []): array
    {
        $mision->loadMissing(['objetivos', 'recompensas.habilidad', 'recompensas.objeto']);
        $character = $user->character;
        $characterHitos = $character ? $character->hitos()->pluck('hito')->all() : [];

        $objetivos = self::buildObjetivosConProgreso($mision, $progresoJson, $characterHitos);

        $recompensas = $mision->recompensas->map(fn ($r) => [
            'id' => $r->id,
            'nombre' => $r->nombre,
            'descripcion' => $r->descripcion,
            'tipo' => $r->tipo,
            'valor' => $r->valor,
            'hito' => $r->hito,
            'habilidad' => $r->relationLoaded('habilidad') && $r->habilidad
                ? ['id' => $r->habilidad->id, 'nombre' => $r->habilidad->nombre]
                : null,
            'objeto' => $r->relationLoaded('objeto') && $r->objeto
                ? ['id' => $r->objeto->id, 'nombre' => $r->objeto->nombre]
                : null,
        ])->values();

        $requeridos = $mision->hito_requerimiento
            ? array_filter(array_map('trim', explode(',', $mision->hito_requerimiento)))
            : [];
        $cumpleHitos = empty(array_diff($requeridos, $characterHitos));

        return [
            'id' => $mision->id,
            'nombre' => $mision->nombre,
            'mision' => $mision->mision,
            'descripcion' => $mision->descripcion,
            'objetivos' => $objetivos->toArray(),
            'recompensas' => $recompensas->toArray(),
            'cumple_hitos' => $cumpleHitos,
            'puede_completar' => self::puedeCompletarCon($user, $mision, $progresoJson),
        ];
    }

    public static function puedeCompletarCon(User $user, Mision $mision, array $progresoJson): bool
    {
        $pivot = $mision->users()->where('user_id', $user->id)->first()?->pivot;
        if (! $pivot || $pivot->status === 'completada') {
            return false;
        }

        $character = $user->character;
        $characterHitos = $character ? $character->hitos()->pluck('hito')->all() : [];
        $requeridos = $mision->hito_requerimiento
            ? array_filter(array_map('trim', explode(',', $mision->hito_requerimiento)))
            : [];
        $cumpleHitos = empty(array_diff($requeridos, $characterHitos));
        if (! $cumpleHitos) {
            return false;
        }

        if ($mision->objetivos->isEmpty()) {
            return true;
        }

        return self::buildObjetivosConProgreso($mision, $progresoJson, $characterHitos)
            ->every(fn ($o) => $o['completado']);
    }
}
