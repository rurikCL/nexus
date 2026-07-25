<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\DungeonRun;
use App\Models\DungeonRunPlayer;
use App\Models\DungeonSala;
use App\Models\DungeonSalaProgreso;
use App\Models\MapLugar;
use App\Models\MapRecompensa;
use App\Models\PvpCombat;
use App\Models\User;
use App\Services\DungeonGeneratorService;
use App\Services\MisionProgresoService;
use App\Services\RecompensaRollService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;

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
        $jugador->update(['sala_actual_id' => $destino->id, 'sala_anterior_id' => $salaActual->id]);

        $progresoDestino = DungeonSalaProgreso::firstOrCreate(
            ['dungeon_run_player_id' => $jugador->id, 'dungeon_sala_id' => $destino->id],
            ['visitada' => true, 'resuelta' => ! $destino->enemigo_id]
        );

        return response()->json([
            'sala' => $this->formatSala($destino, $jugador, $progresoDestino),
        ]);
    }

    /**
     * POST /map/dungeons/runs/{run}/huir — se retira de la sala bloqueada por un enemigo SIN
     * combatir, volviendo un paso atrás a la sala desde la que llegó (sin tirada, a diferencia
     * de huir en medio de un combate real ya iniciado). Solo aplica si la sala actual tiene un
     * enemigo sin resolver — si no hay nada que temer, no hay de qué huir.
     */
    public function huir(Request $request, int $runId): JsonResponse
    {
        $user = $request->user();
        $run = DungeonRun::findOrFail($runId);

        if (! $run->enCurso()) {
            return response()->json(['error' => 'Este dungeon no está en curso.'], 422);
        }

        $jugador = DungeonRunPlayer::where('dungeon_run_id', $run->id)->where('user_id', $user->id)->first();
        if (! $jugador || ! $jugador->activo()) {
            return response()->json(['error' => 'No participas en este dungeon.'], 403);
        }

        $salaActual = $jugador->salaActual;
        if (! $salaActual || ! $salaActual->enemigo_id) {
            return response()->json(['error' => 'No hay nada de qué huir en esta sala.'], 422);
        }

        $progresoActual = DungeonSalaProgreso::where('dungeon_run_player_id', $jugador->id)
            ->where('dungeon_sala_id', $salaActual->id)->first();
        if ($progresoActual?->resuelta) {
            return response()->json(['error' => 'Ya no hay ningún enemigo del cual huir aquí.'], 422);
        }

        if (! $jugador->sala_anterior_id) {
            return response()->json(['error' => 'No hay una sala anterior a la cual retroceder.'], 422);
        }

        $anterior = DungeonSala::findOrFail($jugador->sala_anterior_id);
        $jugador->update(['sala_actual_id' => $anterior->id, 'sala_anterior_id' => $salaActual->id]);

        return response()->json([
            'sala' => $this->formatSala($anterior, $jugador),
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

    /**
     * POST /map/dungeons/runs/{run}/abrir-cofre — abre el cofre de la sala actual del jugador
     * autenticado y sortea recompensas del pool configurado en el DungeonTemplate (Admin →
     * Dungeons → Recompensas). El cofre solo se abre una vez POR JUGADOR (progreso individual,
     * igual que los enemigos) aunque la sala sea compartida por todo el equipo.
     */
    public function abrirCofre(Request $request, int $runId): JsonResponse
    {
        $user = $request->user();
        $character = $user->character;
        $run = DungeonRun::findOrFail($runId);
        $jugador = DungeonRunPlayer::where('dungeon_run_id', $run->id)->where('user_id', $user->id)->first();

        if (! $jugador || ! $jugador->activo() || ! $character) {
            return response()->json(['error' => 'No participas en este dungeon.'], 403);
        }

        $sala = $jugador->salaActual;
        if (! $sala || ! $sala->tiene_cofre) {
            return response()->json(['error' => 'Esta sala no tiene un cofre.'], 422);
        }

        $progreso = DungeonSalaProgreso::firstOrCreate(
            ['dungeon_run_player_id' => $jugador->id, 'dungeon_sala_id' => $sala->id],
            ['visitada' => true, 'resuelta' => ! $sala->enemigo_id]
        );

        if ($progreso->cofre_abierto) {
            return response()->json(['ok' => true, 'ya_abierto' => true, 'recompensas' => []]);
        }

        $progreso->update(['cofre_abierto' => true]);

        $recompensas = RecompensaRollService::resolverYOtorgar(
            $run->template->recompensas()->with(['objeto', 'habilidad', 'medalla'])->get(),
            $user,
            $character
        );

        return response()->json([
            'ok' => true,
            'recompensas' => $recompensas,
            'credits' => $character->fresh()->credits,
        ]);
    }

    /**
     * POST /map/dungeons/runs/{run}/registrar-dano — persiste la vida/escudo con la que el
     * jugador terminó un encuentro 1v1 (victoria, derrota o huida), igual criterio que
     * NaveController::registrarDano: el cliente resuelve el combate y reporta el resultado
     * final, el servidor solo lo acota al máximo del personaje.
     */
    public function registrarDano(Request $request, int $runId): JsonResponse
    {
        $data = $request->validate([
            'vida' => 'required|integer|min:0',
            'escudo' => 'required|integer|min:0',
        ]);

        $user = $request->user();
        $character = $user->character;
        $jugador = DungeonRunPlayer::where('dungeon_run_id', $runId)->where('user_id', $user->id)->first();

        if (! $jugador || ! $jugador->activo() || ! $character) {
            return response()->json(['error' => 'No participas en este dungeon.'], 403);
        }

        $stats = $character->combatStats();
        $jugador->update([
            'hp_actual' => min($data['vida'], $stats['vida']),
            'escudo_actual' => min($data['escudo'], $stats['escudo']),
        ]);

        return response()->json(['ok' => true, 'hp_actual' => $jugador->hp_actual, 'escudo_actual' => $jugador->escudo_actual]);
    }

    /**
     * POST /map/dungeons/runs/{run}/usar-objeto {rol_objeto_id, target_user_id?} — consume un
     * objeto tipo 'utilizable' del inventario del personaje para restaurar vida/escudo dentro
     * del run (en el mapa, entre salas, o en medio de un encuentro 1v1 — ver NpcCombatScreen).
     * `target_user_id` es opcional (default: uno mismo) y permite usarlo en cualquier
     * compañero de equipo ACTIVO del mismo run, sin importar en qué sala esté parado — el
     * objeto siempre se descuenta del inventario de quien lo usa, no del objetivo.
     */
    public function usarObjeto(Request $request, int $runId): JsonResponse
    {
        $data = $request->validate([
            'rol_objeto_id' => 'required|integer|exists:rol_objetos,id',
            'target_user_id' => 'nullable|integer',
        ]);

        $user = $request->user();
        $character = $user->character;
        $run = DungeonRun::findOrFail($runId);
        $jugador = DungeonRunPlayer::where('dungeon_run_id', $run->id)->where('user_id', $user->id)->first();

        if (! $jugador || ! $jugador->activo() || ! $character) {
            return response()->json(['error' => 'No participas en este dungeon.'], 403);
        }
        if (! $run->enCurso()) {
            return response()->json(['error' => 'Este dungeon no está en curso.'], 422);
        }

        $targetUserId = $data['target_user_id'] ?? $user->id;
        $objetivoJugador = $jugador;
        $objetivoCharacter = $character;

        if ($targetUserId !== $user->id) {
            $objetivoJugador = DungeonRunPlayer::where('dungeon_run_id', $run->id)
                ->where('user_id', $targetUserId)
                ->where('estado', 'activo')
                ->first();

            if (! $objetivoJugador) {
                return response()->json(['error' => 'Ese jugador no está activo en este dungeon.'], 422);
            }

            $objetivoCharacter = $objetivoJugador->user->character;
            if (! $objetivoCharacter) {
                return response()->json(['error' => 'Ese jugador no tiene personaje.'], 422);
            }
        }

        $owned = $character->rolObjetos()->where('rol_objetos.id', $data['rol_objeto_id'])->first();
        if (! $owned || (int) $owned->pivot->cantidad < 1) {
            return response()->json(['error' => 'No tienes ese objeto en tu inventario.'], 422);
        }
        if ($owned->tipo !== 'utilizable') {
            return response()->json(['error' => 'Este objeto no se puede usar.'], 422);
        }

        $stats = $objetivoCharacter->combatStats();
        $objetivoJugador->update([
            'hp_actual' => min($stats['vida'], ($objetivoJugador->hp_actual ?? $stats['vida']) + (int) ($owned->cura_vida ?? 0)),
            'escudo_actual' => min($stats['escudo'], ($objetivoJugador->escudo_actual ?? $stats['escudo']) + (int) ($owned->cura_escudo ?? 0)),
        ]);

        if ((int) $owned->pivot->cantidad <= 1) {
            $character->rolObjetos()->detach($owned->id);
        } else {
            $character->rolObjetos()->updateExistingPivot($owned->id, ['cantidad' => $owned->pivot->cantidad - 1]);
        }

        return response()->json([
            'ok' => true,
            'nombre' => $owned->nombre,
            'target_user_id' => $objetivoJugador->user_id,
            'hp_actual' => $objetivoJugador->hp_actual,
            'escudo_actual' => $objetivoJugador->escudo_actual,
        ]);
    }

    /** 'esperando' -> forma de lobby (jugadores/listo/cupos); 'en_curso' -> forma de sala (posición del jugador). */
    private function formatEstadoOLobby(DungeonRun $run, User $user): array
    {
        if ($run->enEspera()) {
            return $this->formatLobby($run, $user->id);
        }

        $run->loadMissing(['jugadores.user.character', 'jugadores.salaActual', 'template.jefe', 'salas']);
        $jugador = $run->jugadores->firstWhere('user_id', $user->id);
        $stats = $jugador?->user?->character?->combatStats();

        return [
            'run' => $this->formatRunResumen($run),
            'sala' => $jugador?->salaActual ? $this->formatSala($jugador->salaActual, $jugador) : null,
            'mi_estado' => $stats ? [
                'hp_actual' => $jugador->hp_actual ?? $stats['vida'],
                'hp_max' => $stats['vida'],
                'escudo_actual' => $jugador->escudo_actual ?? $stats['escudo'],
                'escudo_max' => $stats['escudo'],
            ] : null,
            'equipo' => $this->formatEquipo($run),
            'mapa' => $jugador ? $this->formatMapa($run, $jugador) : [],
        ];
    }

    /**
     * Grafo completo del run (todas las salas, posiciones y conexiones) para el minimapa del
     * frontend. "tiene_enemigo"/"tiene_cofre" son siempre relativos AL JUGADOR consultado -el
     * progreso es individual, aunque la sala sea compartida por todo el equipo-.
     */
    private function formatMapa(DungeonRun $run, DungeonRunPlayer $jugador): array
    {
        $progresos = DungeonSalaProgreso::where('dungeon_run_player_id', $jugador->id)
            ->get()
            ->keyBy('dungeon_sala_id');

        return $run->salas->map(function (DungeonSala $sala) use ($progresos, $jugador) {
            $progreso = $progresos->get($sala->id);

            return [
                'id' => $sala->id,
                'tipo' => $sala->tipo,
                'pos_x' => $sala->pos_x,
                'pos_y' => $sala->pos_y,
                'norte_id' => $sala->norte_id,
                'sur_id' => $sala->sur_id,
                'este_id' => $sala->este_id,
                'oeste_id' => $sala->oeste_id,
                'tiene_enemigo' => (bool) ($sala->enemigo_id && ! $progreso?->resuelta),
                'tiene_cofre' => (bool) ($sala->tiene_cofre && ! $progreso?->cofre_abierto),
                'visitada' => (bool) $progreso?->visitada,
                'es_actual' => $jugador->sala_actual_id === $sala->id,
            ];
        })->values()->all();
    }

    /**
     * Vida/escudo actuales, foto y posición de cada jugador activo del equipo — para el panel
     * lateral en la sala y los puntitos de posición del minimapa (ver DungeonMinimap en el
     * frontend). "sala_actual_id" se expone para TODO el equipo sin importar fog-of-war: saber
     * dónde está parado un compañero no revela el contenido de esa sala.
     */
    private function formatEquipo(DungeonRun $run): array
    {
        return $run->jugadores->where('estado', 'activo')->map(function (DungeonRunPlayer $jp) {
            $character = $jp->user->character;
            $stats = $character?->combatStats();

            return [
                'user_id' => $jp->user_id,
                'name' => $character->name ?? $jp->user->name,
                'photo' => $character->photo ?? null,
                'saber_color' => $character->saber_color ?? null,
                'hp_actual' => $jp->hp_actual ?? $stats['vida'] ?? 0,
                'hp_max' => $stats['vida'] ?? 0,
                'escudo_actual' => $jp->escudo_actual ?? $stats['escudo'] ?? 0,
                'escudo_max' => $stats['escudo'] ?? 0,
                'sala_actual_id' => $jp->sala_actual_id,
                'en_sala_jefe' => $jp->salaActual?->tipo === 'jefe',
            ];
        })->values()->all();
    }

    private function formatLobby(DungeonRun $run, int $userId): array
    {
        $run->loadMissing([
            'jugadores.user.character',
            'template.jefe.recompensas.objeto',
            'template.jefe.recompensas.habilidad',
            'template.jefe.recompensas.medalla',
            'template.enemigos.recompensas.objeto',
            'template.enemigos.recompensas.habilidad',
            'template.enemigos.recompensas.medalla',
            'template.recompensas.objeto',
            'template.recompensas.habilidad',
            'template.recompensas.medalla',
        ]);

        $template = $run->template;
        $jefe = $template->jefe;

        return [
            'run' => $this->formatRunResumen($run),
            'jugadores' => $run->jugadores->map(fn (DungeonRunPlayer $jp) => [
                'user_id' => $jp->user_id,
                'name' => $jp->user->character->name ?? $jp->user->name,
                'handle' => $jp->user->character->handle ?? null,
                'photo' => $jp->user->character->photo ?? null,
                'saber_color' => $jp->user->character->saber_color ?? null,
                'listo' => $jp->listo,
                'estado' => $jp->estado,
                'soy_yo' => $jp->user_id === $userId,
            ])->values(),
            'cupos_equipo' => $run->template->cuposEquipo(),
            'min_jugadores' => self::MIN_JUGADORES,
            'loot' => [
                'cofres' => $this->formatRecompensasPreview($template->recompensas),
                'enemigos' => $template->enemigos->map(fn ($e) => [
                    'id' => $e->id,
                    'nombre' => $e->nombre,
                    'imagen' => $e->imagen_mini ?: $e->imagen,
                    'nivel' => $e->pivot->nivel ?? $e->nivel,
                    'recompensas' => $this->formatRecompensasPreview($e->recompensas),
                ])->values(),
                'jefe' => $jefe ? [
                    'nombre' => $jefe->nombre,
                    'imagen' => $jefe->imagen_mini ?: $jefe->imagen,
                    'recompensas' => $this->formatRecompensasPreview($jefe->recompensas),
                ] : null,
            ],
        ];
    }

    /** Vista previa (sin otorgar) del botín configurado — ver RecompensaRollService::aplicar para el equivalente que sí lo entrega. */
    private function formatRecompensasPreview(Collection $recompensas): array
    {
        return $recompensas->map(fn (MapRecompensa $r) => match ($r->tipo) {
            'creditos' => ['tipo' => 'creditos', 'label' => "{$r->valor} créditos"],
            'objeto' => ['tipo' => 'objeto', 'label' => $r->objeto->nombre ?? 'Objeto'],
            'habilidad' => ['tipo' => 'habilidad', 'label' => $r->habilidad->nombre ?? 'Habilidad'],
            'punto_habilidad' => ['tipo' => 'punto_habilidad', 'label' => "{$r->valor} punto" . ((int) $r->valor === 1 ? '' : 's') . ' de habilidad'],
            'titulo' => ['tipo' => 'titulo', 'label' => $r->nombre ?? 'Título'],
            'insignia' => ['tipo' => 'insignia', 'label' => $r->medalla->nombre ?? 'Insignia'],
            default => ['tipo' => $r->tipo, 'label' => $r->nombre ?? $r->tipo],
        })->values()->all();
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
            'tiene_cofre' => (bool) $sala->tiene_cofre,
            'cofre_abierto' => (bool) ($progreso?->cofre_abierto),
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
