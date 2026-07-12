<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Character;
use App\Models\Training;
use App\Models\TrainingDay;
use App\Models\TrainingPlanNode;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class SesionEntrenamientoController extends Controller
{
    const TRAINER_TIERS = ['caballero', 'maestro', 'granmaestro'];

    // -------------------------------------------------------------------------
    // Helpers
    // -------------------------------------------------------------------------

    private function formatTraining(Training $training, int $authUserId): array
    {
        $training->loadMissing(['encargados.character', 'attendance']);

        return [
            'id'               => $training->id,
            'titulo'           => $training->titulo,
            'fecha'            => $training->fecha->format('Y-m-d'),
            'closed_at'        => $training->closed_at?->toIso8601String(),
            'encargados'       => $training->encargados->map(fn($u) => [
                'id'        => $u->id,
                'name'      => $u->name,
                'character' => $u->character ? ['handle' => $u->character->handle] : null,
            ])->values(),
            'attendance_count' => $training->attendance->count(),
            'node_count'       => $training->planNodes()->count(),
            'is_closed'        => $training->isClosed(),
            'i_am_encargado'   => $training->encargados->contains('id', $authUserId),
        ];
    }

    private function isEncargado(Training $training, int $userId): bool
    {
        return $training->encargados()->where('user_id', $userId)->exists();
    }

    private function canMarkAttendance(Training $training, $user): bool
    {
        return $training->canBeMarkedBy($user);
    }

    private function formatPlanNode(TrainingPlanNode $node): array
    {
        return [
            'id'           => $node->id,
            'type'         => $node->type,
            'orden'        => $node->orden,
            'modulo_id'    => $node->modulo_id,
            'modulo'       => $node->modulo ? [
                'id'               => $node->modulo->id,
                'nombre'           => $node->modulo->nombre,
                'foco'             => $node->modulo->foco,
                'nivel_dificultad' => $node->modulo->nivel_dificultad,
                'esfuerzo'         => $node->modulo->esfuerzo,
            ] : null,
            'titulo'       => $node->titulo,
            'contenido'    => $node->contenido,
            'es_adicional' => $node->es_adicional,
            'created_by'   => $node->created_by,
            'creador'      => $node->creador ? [
                'id'     => $node->creador->id,
                'name'   => $node->creador->name,
                'handle' => $node->creador->character->handle ?? null,
            ] : null,
        ];
    }

    /**
     * Extrae el handle desde un código QR escaneado. El QR contiene la URL del
     * perfil público (".../c/{handle}"), pero también se acepta un handle plano.
     */
    private function extractHandle(string $code): ?string
    {
        $code = trim($code);
        if ($code === '') {
            return null;
        }

        if (preg_match('~/c/([^/?#]+)~', $code, $matches)) {
            return urldecode($matches[1]);
        }

        return $code;
    }

    // -------------------------------------------------------------------------
    // disponibles
    // -------------------------------------------------------------------------

    /**
     * GET /api/sesiones/disponibles?month=YYYY-MM
     * Returns training dates for the given month: [{id, fecha, titulo, closed}]
     */
    public function disponibles(Request $request): JsonResponse
    {
        $month = $request->query('month', now()->format('Y-m'));

        try {
            $start = Carbon::createFromFormat('Y-m', $month)->startOfMonth();
            $end   = $start->copy()->endOfMonth();
        } catch (\Exception $e) {
            return response()->json(['message' => 'Formato de mes inválido. Use YYYY-MM.'], 422);
        }

        $trainings = Training::whereBetween('fecha', [$start->toDateString(), $end->toDateString()])
            ->orderBy('fecha')
            ->get(['id', 'fecha', 'titulo', 'closed_at']);

        return response()->json([
            'month'     => $month,
            'sesiones'  => $trainings->map(fn($t) => [
                'id'     => $t->id,
                'fecha'  => $t->fecha->format('Y-m-d'),
                'titulo' => $t->titulo,
                'closed' => $t->isClosed(),
            ])->values(),
        ]);
    }

    // -------------------------------------------------------------------------
    // index
    // -------------------------------------------------------------------------

    /**
     * GET /api/sesiones
     * Recent list of trainings with encargados, attendance count, node count.
     */
    public function index(Request $request): JsonResponse
    {
        $authUserId = $request->user()->id;

        $trainings = Training::with(['encargados.character'])
            ->withCount([
                'attendance',
                'planNodes as node_count',
            ])
            ->orderByDesc('fecha')
            ->paginate(20);

        $items = $trainings->getCollection()->map(function (Training $t) use ($authUserId) {
            return [
                'id'               => $t->id,
                'titulo'           => $t->titulo,
                'fecha'            => $t->fecha->format('Y-m-d'),
                'closed_at'        => $t->closed_at?->toIso8601String(),
                'encargados'       => $t->encargados->map(fn($u) => [
                    'id'        => $u->id,
                    'name'      => $u->name,
                    'character' => $u->character ? ['handle' => $u->character->handle] : null,
                ])->values(),
                'attendance_count' => $t->attendance_count,
                'node_count'       => $t->node_count,
                'is_closed'        => $t->isClosed(),
                'i_am_encargado'   => $t->encargados->contains('id', $authUserId),
            ];
        });

        return response()->json([
            'data'         => $items,
            'current_page' => $trainings->currentPage(),
            'last_page'    => $trainings->lastPage(),
            'total'        => $trainings->total(),
        ]);
    }

    // -------------------------------------------------------------------------
    // store
    // -------------------------------------------------------------------------

    /**
     * POST /api/sesiones
     * Only caballero / maestro / granmaestro can create.
     */
    public function store(Request $request): JsonResponse
    {
        $user = $request->user();

        if (!in_array($user->tier, self::TRAINER_TIERS)) {
            return response()->json(['message' => 'No tienes permiso para crear sesiones de entrenamiento.'], 403);
        }

        $data = $request->validate([
            'titulo'        => 'required|string|in:Entrenamiento Oficial,Entrenamiento Libre,Actividad,Taller,Reunión',
            'fecha'         => 'required|date_format:Y-m-d',
            'encargados'    => 'nullable|array',
            'encargados.*'  => 'integer|exists:users,id',
        ]);

        $training = Training::create([
            'titulo'     => $data['titulo'],
            'fecha'      => $data['fecha'],
            'created_by' => $user->id,
        ]);

        $training->encargados()->sync($data['encargados'] ?? []);

        $training->load('encargados.character');

        return response()->json($this->formatTraining($training, $user->id), 201);
    }

    // -------------------------------------------------------------------------
    // show
    // -------------------------------------------------------------------------

    /**
     * GET /api/sesiones/{id}
     * Full training with plan nodes, encargados, and attendance list.
     */
    public function show(Request $request, int $id): JsonResponse
    {
        $training = Training::with([
            'encargados.character',
            'planNodes.modulo',
            'planNodes.creador.character',
            'attendance.user.character',
        ])->findOrFail($id);

        $authUser   = $request->user();
        $authUserId = $authUser->id;

        $planNodes = $training->planNodes->where('es_adicional', false)
            ->map(fn(TrainingPlanNode $node) => $this->formatPlanNode($node))
            ->values();

        $planNodesAdicionales = $training->planNodes->where('es_adicional', true)
            ->map(fn(TrainingPlanNode $node) => $this->formatPlanNode($node))
            ->values();

        $attendanceList = $training->attendance->map(fn(TrainingDay $day) => [
            'user_id'   => $day->user_id,
            'name'      => $day->user->name ?? null,
            'handle'    => $day->user->character->handle ?? null,
            'attended_at' => $day->created_at?->toIso8601String(),
        ])->values();

        // Global closing note
        $globalNote = TrainingDay::where('training_id', $training->id)
            ->where('type', 'global')
            ->first();

        return response()->json([
            'id'               => $training->id,
            'titulo'           => $training->titulo,
            'fecha'            => $training->fecha->format('Y-m-d'),
            'closed_at'        => $training->closed_at?->toIso8601String(),
            'is_closed'        => $training->isClosed(),
            'i_am_encargado'   => $this->isEncargado($training, $authUserId),
            'encargados'       => $training->encargados->map(fn($u) => [
                'id'        => $u->id,
                'name'      => $u->name,
                'character' => $u->character ? ['handle' => $u->character->handle] : null,
            ])->values(),
            'plan_nodes'              => $planNodes,
            'plan_nodes_adicionales'  => $planNodesAdicionales,
            'puede_agregar_adicional' => $training->canAddAdicional($authUser),
            'attendance'       => $attendanceList,
            'global_note'      => $globalNote ? [
                'focus'  => $globalNote->focus,
                'effort' => $globalNote->effort,
                'note'   => $globalNote->note,
                'tags'   => $globalNote->tags,
            ] : null,
        ]);
    }

    // -------------------------------------------------------------------------
    // savePlan
    // -------------------------------------------------------------------------

    /**
     * POST /api/sesiones/{id}/plan
     * Replace plan nodes. Only encargados (or creator) can edit.
     */
    public function savePlan(Request $request, int $id): JsonResponse
    {
        $training = Training::findOrFail($id);
        $user     = $request->user();

        if (!$this->isEncargado($training, $user->id)) {
            return response()->json(['message' => 'Solo los encargados pueden editar el plan.'], 403);
        }

        if ($training->isClosed()) {
            return response()->json(['message' => 'No se puede editar el plan de una sesión cerrada.'], 422);
        }

        $data = $request->validate([
            'nodes'              => 'required|array',
            'nodes.*.type'       => 'required|in:module,text',
            'nodes.*.modulo_id'  => 'nullable|integer|exists:modulos_entrenamiento,id',
            'nodes.*.titulo'     => 'nullable|string|max:255',
            'nodes.*.contenido'  => 'nullable|string',
            'nodes.*.orden'      => 'nullable|integer|min:0',
        ]);

        // Replace only the main-plan nodes — los nodos "Adicional" no se tocan.
        $training->mainPlanNodes()->delete();

        foreach ($data['nodes'] as $index => $nodeData) {
            $training->planNodes()->create([
                'type'         => $nodeData['type'],
                'modulo_id'    => $nodeData['modulo_id'] ?? null,
                'titulo'       => $nodeData['titulo'] ?? null,
                'contenido'    => $nodeData['contenido'] ?? null,
                'orden'        => $nodeData['orden'] ?? $index,
                'es_adicional' => false,
            ]);
        }

        $updatedNodes = $training->mainPlanNodes()->with('modulo')->get()
            ->map(fn(TrainingPlanNode $node) => $this->formatPlanNode($node))
            ->values();

        return response()->json(['plan_nodes' => $updatedNodes]);
    }

    // -------------------------------------------------------------------------
    // addAdicional / removeAdicional
    // -------------------------------------------------------------------------

    /**
     * POST /api/sesiones/{id}/plan/adicional
     * Cualquier caballero/maestro/granmaestro (sea o no encargado) puede aportar
     * un nodo al plan, marcado como "Adicional" y atribuido a su autor.
     */
    public function addAdicional(Request $request, int $id): JsonResponse
    {
        $training = Training::findOrFail($id);
        $user     = $request->user();

        if (!$training->canAddAdicional($user)) {
            return response()->json(['message' => 'Solo un rango caballero/maestro puede agregar nodos adicionales.'], 403);
        }

        if ($training->isClosed()) {
            return response()->json(['message' => 'No se puede agregar nodos a una sesión cerrada.'], 422);
        }

        $data = $request->validate([
            'type'      => 'required|in:module,text',
            'modulo_id' => 'nullable|integer|exists:modulos_entrenamiento,id',
            'titulo'    => 'nullable|string|max:255',
            'contenido' => 'nullable|string',
        ]);

        $siguienteOrden = ((int) $training->adicionalNodes()->max('orden')) + 1;

        $node = $training->planNodes()->create([
            'type'         => $data['type'],
            'modulo_id'    => $data['modulo_id'] ?? null,
            'titulo'       => $data['titulo'] ?? null,
            'contenido'    => $data['contenido'] ?? null,
            'orden'        => $siguienteOrden,
            'es_adicional' => true,
            'created_by'   => $user->id,
        ]);

        $node->load(['modulo', 'creador.character']);

        return response()->json(['node' => $this->formatPlanNode($node)], 201);
    }

    /**
     * DELETE /api/sesiones/{id}/plan/adicional/{nodeId}
     * Solo el autor del nodo o un encargado de la sesión puede eliminarlo.
     */
    public function removeAdicional(Request $request, int $id, int $nodeId): JsonResponse
    {
        $training = Training::findOrFail($id);
        $user     = $request->user();

        $node = $training->planNodes()->where('id', $nodeId)->where('es_adicional', true)->first();

        if (!$node) {
            return response()->json(['message' => 'Nodo adicional no encontrado.'], 404);
        }

        if ($node->created_by !== $user->id && !$this->isEncargado($training, $user->id)) {
            return response()->json(['message' => 'Solo el autor del nodo o un encargado puede eliminarlo.'], 403);
        }

        if ($training->isClosed()) {
            return response()->json(['message' => 'No se puede editar el plan de una sesión cerrada.'], 422);
        }

        $node->delete();

        return response()->json(['message' => 'Nodo adicional eliminado.']);
    }

    // -------------------------------------------------------------------------
    // attend
    // -------------------------------------------------------------------------

    /**
     * POST /api/sesiones/{id}/attend
     * Mark current user's attendance. Awards 75 credits.
     */
    public function attend(Request $request, int $id): JsonResponse
    {
        $training = Training::findOrFail($id);
        $user     = $request->user();

        if (!$this->canMarkAttendance($training, $user)) {
            return response()->json(['message' => 'Solo el encargado o un rango caballero/maestro puede marcar asistencia.'], 403);
        }

        if ($training->isClosed()) {
            return response()->json(['message' => 'La sesión ya está cerrada.'], 422);
        }

        $existing = TrainingDay::where('training_id', $training->id)
            ->where('user_id', $user->id)
            ->where('type', 'personal')
            ->first();

        if ($existing) {
            return response()->json(['message' => 'Ya marcaste asistencia a esta sesión.'], 409);
        }

        $day = TrainingDay::create([
            'user_id'     => $user->id,
            'training_id' => $training->id,
            'type'        => 'personal',
            'date'        => $training->fecha->format('Y-m-d'),
        ]);

        $creditsAwarded = 0;
        $character = $user->character;
        if ($character) {
            $character->increment('credits', 75);
            $creditsAwarded = 75;
        }

        return response()->json([
            'training_day'    => $day,
            'credits_awarded' => $creditsAwarded,
        ], 201);
    }

    // -------------------------------------------------------------------------
    // unattend
    // -------------------------------------------------------------------------

    /**
     * DELETE /api/sesiones/{id}/attend
     * Remove current user's attendance. Refunds 75 credits.
     */
    public function unattend(Request $request, int $id): JsonResponse
    {
        $training = Training::findOrFail($id);
        $user     = $request->user();

        if ($training->isClosed()) {
            return response()->json(['message' => 'No se puede retirar asistencia de una sesión cerrada.'], 422);
        }

        $day = TrainingDay::where('training_id', $training->id)
            ->where('user_id', $user->id)
            ->where('type', 'personal')
            ->first();

        if (!$day) {
            return response()->json(['message' => 'No tienes asistencia registrada en esta sesión.'], 404);
        }

        $day->delete();

        $character = $user->character;
        if ($character && $character->credits >= 75) {
            $character->decrement('credits', 75);
        }

        return response()->json(['message' => 'Asistencia retirada correctamente.']);
    }

    // -------------------------------------------------------------------------
    // attendScan
    // -------------------------------------------------------------------------

    /**
     * POST /api/sesiones/{id}/attend-scan
     * El encargado (o un rango caballero/maestro/granmaestro) escanea los QR de
     * perfil público de los asistentes y finaliza en un solo lote. Cada asistente
     * nuevo recibe 75 créditos. El encargado recibe 75 créditos por su propia
     * asistencia (si no la tenía ya) + 10 créditos por cada asistente marcado.
     */
    public function attendScan(Request $request, int $id): JsonResponse
    {
        $training = Training::findOrFail($id);
        $user     = $request->user();

        if (!$this->canMarkAttendance($training, $user)) {
            return response()->json(['message' => 'Solo el encargado o un rango caballero/maestro puede marcar asistencia.'], 403);
        }

        if ($training->isClosed()) {
            return response()->json(['message' => 'La sesión ya está cerrada.'], 422);
        }

        $data = $request->validate([
            'codes'   => 'array',
            'codes.*' => 'string',
        ]);

        // Extrae y deduplica handles (case-insensitive) preservando el escaneado
        $handles = [];
        $seen    = [];
        foreach ($data['codes'] ?? [] as $code) {
            $handle = $this->extractHandle($code);
            if ($handle === null) {
                continue;
            }
            $key = mb_strtolower($handle);
            if (isset($seen[$key])) {
                continue;
            }
            $seen[$key] = true;
            $handles[]  = $handle;
        }

        $results     = [];
        $markedCount = 0;

        foreach ($handles as $handle) {
            $character = Character::where('handle', $handle)->first();

            if (!$character) {
                $results[] = ['handle' => $handle, 'name' => null, 'status' => 'no_encontrado'];
                continue;
            }

            if ($character->user_id === $user->id) {
                $results[] = ['handle' => $handle, 'name' => $character->name, 'status' => 'es_encargado'];
                continue;
            }

            $existing = TrainingDay::where('training_id', $training->id)
                ->where('user_id', $character->user_id)
                ->where('type', 'personal')
                ->first();

            if ($existing) {
                $results[] = ['handle' => $handle, 'name' => $character->name, 'status' => 'ya_marcado'];
                continue;
            }

            TrainingDay::create([
                'user_id'     => $character->user_id,
                'training_id' => $training->id,
                'type'        => 'personal',
                'date'        => $training->fecha->format('Y-m-d'),
            ]);
            $character->increment('credits', 75);
            $markedCount++;
            $results[] = ['handle' => $handle, 'name' => $character->name, 'status' => 'marcado'];
        }

        // Asistencia + créditos del encargado que realiza el escaneo
        $encargadoCharacter = $user->character;
        $encargadoCredits   = 0;

        $encargadoExisting = TrainingDay::where('training_id', $training->id)
            ->where('user_id', $user->id)
            ->where('type', 'personal')
            ->first();

        if (!$encargadoExisting) {
            TrainingDay::create([
                'user_id'     => $user->id,
                'training_id' => $training->id,
                'type'        => 'personal',
                'date'        => $training->fecha->format('Y-m-d'),
            ]);
            if ($encargadoCharacter) {
                $encargadoCharacter->increment('credits', 75);
                $encargadoCredits += 75;
            }
        }

        $bonus = $markedCount * 10;
        if ($encargadoCharacter && $bonus > 0) {
            $encargadoCharacter->increment('credits', $bonus);
            $encargadoCredits += $bonus;
        }

        return response()->json([
            'marked'            => $markedCount,
            'results'           => $results,
            'encargado_credits' => $encargadoCredits,
        ]);
    }

    // -------------------------------------------------------------------------
    // close
    // -------------------------------------------------------------------------

    /**
     * POST /api/sesiones/{id}/close
     * Close session and write global note. Only encargados can close.
     */
    public function close(Request $request, int $id): JsonResponse
    {
        $training = Training::findOrFail($id);
        $user     = $request->user();

        if (!$this->isEncargado($training, $user->id)) {
            return response()->json(['message' => 'Solo los encargados pueden cerrar la sesión.'], 403);
        }

        if ($training->isClosed()) {
            return response()->json(['message' => 'La sesión ya está cerrada.'], 422);
        }

        $data = $request->validate([
            'focus'  => 'nullable|string|max:255',
            'effort' => 'nullable|integer|min:1|max:10',
            'note'   => 'nullable|string',
            'tags'   => 'nullable|array',
        ]);

        // Create global closing note
        TrainingDay::create([
            'user_id'     => $user->id,
            'training_id' => $training->id,
            'type'        => 'global',
            'date'        => $training->fecha->format('Y-m-d'),
            'focus'       => $data['focus'] ?? null,
            'effort'      => $data['effort'] ?? null,
            'note'        => $data['note'] ?? null,
            'tags'        => $data['tags'] ?? null,
        ]);

        // Mark training as closed
        $training->update([
            'closed_at' => now(),
            'closed_by' => $user->id,
        ]);

        $training->load('encargados.character');

        return response()->json($this->formatTraining($training, $user->id));
    }
}
