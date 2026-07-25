<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\DungeonRun;
use App\Models\DungeonRunPlayer;
use App\Models\DungeonSala;
use App\Models\DungeonSalaProgreso;
use App\Models\MapLugar;
use App\Models\PvpCombat;
use App\Models\User;
use App\Services\DungeonGeneratorService;
use App\Services\MisionProgresoService;
use App\Services\RecompensaRollService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Dungeon rogue-like en equipo: se arma un lobby al entrar por un
 * map_lugares tipo='portal_dungeon' (ver unirse/listo), el equipo confirmado
 * recorre un DungeonRun generado por DungeonGeneratorService -cada jugador a
 * su propio ritmo, los encuentros normales son 1v1 independientes (ver
 * enemigoVictory)- y converge de nuevo al llegar a la sala jefe, donde se
 * pelea junto vía RaidCombatController::join (con dungeon_run_id).
 */
class DungeonController extends Controller
{
    /** Mínimo de jugadores en el lobby para poder confirmar "listo", igual que RaidCombatController::MIN_JUGADORES. */
    private const MIN_JUGADORES = 2;

    /** POST /map/dungeons/{lugarId}/unirse — entra al lobby del dungeon de ese portal (lo crea si no hay uno esperando con cupo). */
    public function unirse(Request $request, int $lugarId): JsonResponse
    {
        $user = $request->user();
        $lugar = MapLugar::findOrFail($lugarId);

        if ($lugar->tipo !== 'portal_dungeon' || ! $lugar->dungeon_template_id) {
            return response()->json(['error' => 'Este lugar no es una entrada de dungeon.'], 422);
        }
        if (! $user->character) {
            return response()->json(['error' => 'Necesitas un personaje para entrar.'], 422);
        }

        $template = $lugar->dungeonTemplate()->with('jefe')->firstOrFail();

        $jugadorActivo = DungeonRunPlayer::where('user_id', $user->id)
            ->where('estado', 'activo')
            ->whereHas('run', fn ($q) => $q->whereIn('estado', ['esperando', 'en_curso']))
            ->with('run')
            ->first();

        if ($jugadorActivo) {
            if ($jugadorActivo->run->dungeon_template_id !== $template->id) {
                return response()->json(['error' => 'Ya tienes otro dungeon en curso. Resuélvelo o abandónalo primero.'], 422);
            }

            return response()->json($this->formatEstadoOLobby($jugadorActivo->run, $user));
        }

        $run = DungeonRun::where('dungeon_template_id', $template->id)
            ->where('estado', 'esperando')
            ->withCount('jugadores')
            ->having('jugadores_count', '<', $template->cuposEquipo())
            ->first();

        if (! $run) {
            $run = DungeonRun::create([
                'dungeon_template_id' => $template->id,
                'creado_por_id' => $user->id,
                'estado' => 'esperando',
            ]);
        }

        DungeonRunPlayer::create([
            'dungeon_run_id' => $run->id,
            'user_id' => $user->id,
            'listo' => false,
            'estado' => 'activo',
        ]);

        return response()->json($this->formatLobby($run->fresh(), $user->id));
    }

    /** POST /map/dungeons/runs/{run}/listo — confirma (o desmarca) listo; arranca el run en cuanto todo el equipo lo está. */
    public function listo(Request $request, int $runId): JsonResponse
    {
        $user = $request->user();
        $run = DungeonRun::with('jugadores')->findOrFail($runId);

        if (! $run->enEspera()) {
            return response()->json(['error' => 'Este dungeon ya arrancó.'], 422);
        }

        $jugador = $run->jugadores->firstWhere('user_id', $user->id);
        if (! $jugador || ! $jugador->activo()) {
            return response()->json(['error' => 'No participas en este dungeon.'], 403);
        }

        $jugador->update(['listo' => ! $jugador->listo]);
        $run->refresh()->load('jugadores');

        $activos = $run->jugadores->where('estado', 'activo');
        $todosListos = $activos->count() >= self::MIN_JUGADORES && $activos->every(fn ($j) => $j->listo);

        if ($todosListos) {
            $run = DungeonGeneratorService::generar($run);
        }

        return response()->json($this->formatEstadoOLobby($run->fresh(), $user));
    }

    /** POST /map/dungeons/runs/{run}/salir — abandona el lobby o el run en curso. */
    public function salir(Request $request, int $runId): JsonResponse
    {
        $user = $request->user();
        $run = DungeonRun::with('jugadores')->findOrFail($runId);
        $jugador = $run->jugadores->firstWhere('user_id', $user->id);

        if (! $jugador) {
            return response()->json(['error' => 'No participas en este dungeon.'], 403);
        }

        if ($run->enEspera()) {
            $jugador->delete();
            if ($run->jugadores()->count() === 0) {
                $run->delete();
            }

            return response()->json(['ok' => true]);
        }

        $jugador->update(['estado' => 'abandonado']);

        if ($run->jugadores()->where('estado', 'activo')->count() === 0) {
            $run->salas()->delete();
            $run->update(['estado' => 'abandonado']);
        }

        return response()->json(['ok' => true]);
    }

    /** GET /map/dungeons/runs/{run} — estado del run + la sala donde está parado el jugador autenticado. */
    public function estado(Request $request, int $runId): JsonResponse
    {
        $user = $request->user();
        $run = DungeonRun::with(['jugadores.user.character', 'jugadores.salaActual', 'template.jefe'])->findOrFail($runId);
        $jugador = $run->jugadores->firstWhere('user_id', $user->id);

        if (! $jugador) {
            return response()->json(['error' => 'No participas en este dungeon.'], 403);
        }

        return response()->json($this->formatEstadoOLobby($run, $user));
    }

    /** POST /map/dungeons/runs/{run}/mover {direccion} — mueve solo al jugador autenticado dentro del grafo compartido. */
    public function mover(Request $request, int $runId): JsonResponse
    {
        $data = $request->validate(['direccion' => 'required|in:norte,sur,este,oeste']);

        $user = $request->user();
        $run = DungeonRun::findOrFail($runId);

        if (! $run->enCurso()) {
            return response()->json(['error' => 'Este dungeon no está en curso.'], 422);
        }

        $jugador = DungeonRunPlayer::where('dungeon_run_id', $run->id)->where('user_id', $user->id)->first();
        if (! $jugador || ! $jugador->activo()) {
            return response()->json(['error' => 'No participas en este dungeon.'], 403);
        }

        $activeCombat = PvpCombat::where('status', 'active')
            ->where(fn ($q) => $q->where('attacker_id', $user->id)->orWhere('defender_id', $user->id))
            ->exists();
        if ($activeCombat) {
            return response()->json(['error' => 'No puedes moverte mientras tienes un combate PvP activo.'], 422);
        }

        $salaActual = $jugador->salaActual;
        if (! $salaActual) {
            return response()->json(['error' => 'Tu posición en el dungeon no es válida.'], 422);
        }

        $progresoActual = DungeonSalaProgreso::where('dungeon_run_player_id', $jugador->id)
            ->where('dungeon_sala_id', $salaActual->id)->first();
        if ($salaActual->enemigo_id && ! $progresoActual?->resuelta) {
            return response()->json(['error' => 'Debes derrotar al enemigo de esta sala antes de continuar.'], 422);
        }

        $columna = match ($data['direccion']) {
            'norte' => 'norte_id', 'sur' => 'sur_id', 'este' => 'este_id', 'oeste' => 'oeste_id',
        };
        $destinoId = $salaActual->{$columna};
        if (! $destinoId) {
            return response()->json(['error' => 'No hay salida en esa dirección.'], 422);
        }

        $destino = DungeonSala::findOrFail($destinoId);
        $jugador->update(['sala_actual_id' => $destino->id]);

        $progresoDestino = DungeonSalaProgreso::firstOrCreate(
            ['dungeon_run_player_id' => $jugador->id, 'dungeon_sala_id' => $destino->id],
            ['visitada' => true, 'resuelta' => ! $destino->enemigo_id]
        );

        return response()->json([
            'sala' => $this->formatSala($destino, $jugador, $progresoDestino),
        ]);
    }

    /** POST /map/dungeons/runs/{run}/enemigo-victory — resuelve el 1v1 de la sala actual del jugador autenticado. */
    public function enemigoVictory(Request $request, int $runId): JsonResponse
    {
        $user = $request->user();
        $character = $user->character;
        $run = DungeonRun::findOrFail($runId);

        $jugador = DungeonRunPlayer::where('dungeon_run_id', $run->id)->where('user_id', $user->id)->first();
        if (! $jugador || ! $character) {
            return response()->json(['error' => 'No participas en este dungeon.'], 403);
        }

        $sala = $jugador->salaActual;
        if (! $sala || ! $sala->enemigo_id) {
            return response()->json(['error' => 'Esta sala no tiene un enemigo activo.'], 422);
        }

        $progreso = DungeonSalaProgreso::firstOrCreate(
            ['dungeon_run_player_id' => $jugador->id, 'dungeon_sala_id' => $sala->id],
            ['visitada' => true, 'resuelta' => false]
        );

        if ($progreso->resuelta) {
            return response()->json(['ok' => true, 'ya_resuelto' => true, 'recompensas' => []]);
        }

        $progreso->update(['resuelta' => true]);

        $enemigo = $sala->enemigo;
        MisionProgresoService::registrar($user, 'combate', 1);

        $recompensas = RecompensaRollService::resolverYOtorgar(
            $enemigo->recompensas()->with(['objeto', 'habilidad', 'medalla'])->get(),
            $user,
            $character
        );

        return response()->json([
            'ok' => true,
            'nombre' => $enemigo->nombre,
            'recompensas' => $recompensas,
            'credits' => $character->fresh()->credits,
        ]);
    }

    /** 'esperando' -> forma de lobby (jugadores/listo/cupos); 'en_curso' -> forma de sala (posición del jugador). */
    private function formatEstadoOLobby(DungeonRun $run, User $user): array
    {
        if ($run->enEspera()) {
            return $this->formatLobby($run, $user->id);
        }

        $run->loadMissing(['jugadores.user.character', 'jugadores.salaActual', 'template.jefe']);
        $jugador = $run->jugadores->firstWhere('user_id', $user->id);

        return [
            'run' => $this->formatRunResumen($run),
            'sala' => $jugador?->salaActual ? $this->formatSala($jugador->salaActual, $jugador) : null,
        ];
    }

    private function formatLobby(DungeonRun $run, int $userId): array
    {
        $run->loadMissing(['jugadores.user.character', 'template.jefe']);

        return [
            'run' => $this->formatRunResumen($run),
            'jugadores' => $run->jugadores->map(fn (DungeonRunPlayer $jp) => [
                'user_id' => $jp->user_id,
                'name' => $jp->user->character->name ?? $jp->user->name,
                'listo' => $jp->listo,
                'estado' => $jp->estado,
                'soy_yo' => $jp->user_id === $userId,
            ])->values(),
            'cupos_equipo' => $run->template->cuposEquipo(),
            'min_jugadores' => self::MIN_JUGADORES,
        ];
    }

    private function formatRunResumen(DungeonRun $run): array
    {
        return [
            'id' => $run->id,
            'estado' => $run->estado,
            'template' => [
                'id' => $run->template->id,
                'nombre' => $run->template->nombre,
                'jefe_npc_id' => $run->template->jefe_npc_id,
                'jefe_nombre' => $run->template->jefe->nombre ?? null,
            ],
        ];
    }

    /**
     * El enemigo se devuelve como el modelo MapEnemigo completo (con habilidad1/habilidad2
     * cargadas y 'nivel' sobrescrito por el de esta sala) -mismo criterio que
     * LugarEncuentroController::check()- para que el frontend pueda pasarlo directo como
     * prop `npc` de NpcCombatScreen sin transformarlo.
     */
    private function formatSala(DungeonSala $sala, DungeonRunPlayer $jugador, ?DungeonSalaProgreso $progreso = null): array
    {
        $progreso ??= DungeonSalaProgreso::where('dungeon_run_player_id', $jugador->id)
            ->where('dungeon_sala_id', $sala->id)->first();

        $sala->loadMissing(['norte:id,tipo', 'sur:id,tipo', 'este:id,tipo', 'oeste:id,tipo', 'enemigo.habilidad1', 'enemigo.habilidad2']);

        $enemigo = null;
        if (! $progreso?->resuelta && $sala->enemigo) {
            $enemigo = $sala->enemigo;
            $enemigo->nivel = $sala->nivel_enemigo ?? $enemigo->nivel;
        }

        return [
            'id' => $sala->id,
            'tipo' => $sala->tipo,
            'resuelta' => (bool) ($progreso?->resuelta),
            'enemigo' => $enemigo,
            'jefe_npc_id' => $sala->tipo === 'jefe' ? $jugador->run->template->jefe_npc_id : null,
            'salidas' => [
                'norte' => $sala->norte?->only(['id', 'tipo']),
                'sur' => $sala->sur?->only(['id', 'tipo']),
                'este' => $sala->este?->only(['id', 'tipo']),
                'oeste' => $sala->oeste?->only(['id', 'tipo']),
            ],
        ];
    }
}
