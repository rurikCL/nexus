<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Mision;
use App\Models\Objetivo;
use App\Models\Recompensa;
use App\Models\User;
use App\Traits\ConvertsToWebp;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\Storage;

class MisionController extends Controller
{
    use ConvertsToWebp;

    private const ADMIN_TIERS = ['caballero', 'maestro', 'granmaestro'];

    private function isAdmin(User $user): bool
    {
        return in_array($user->tier, self::ADMIN_TIERS);
    }

    /**
     * Cuando la misión se guarda con multipart/form-data (por la subida de foto_mision),
     * objetivos/recompensas llegan como strings JSON — los decodifica antes de validar.
     */
    private function decodeJsonArrayFields(Request $request): void
    {
        foreach (['objetivos', 'recompensas'] as $field) {
            $value = $request->input($field);
            if (is_string($value)) {
                $request->merge([$field => json_decode($value, true) ?? []]);
            }
        }
    }

    // ── GET /api/misiones/npcs-mision ────────────────────────────────────────
    public function npcsMision(Request $request): JsonResponse
    {
        $npcs = \DB::table('map_npcs')
            ->leftJoin('map_lugares', 'map_npcs.LugarID', '=', 'map_lugares.id')
            ->whereNull('map_npcs.deleted_at')
            ->select(
                'map_npcs.id',
                'map_npcs.nombre',
                'map_npcs.imagen_mini',
                'map_lugares.nombre as lugar'
            )
            ->orderBy('map_npcs.nombre')
            ->get();

        return response()->json(['npcs' => $npcs]);
    }

    // ── GET /api/misiones ─────────────────────────────────────────────────────
    // Admin sees all missions; regular users see nothing (use specific endpoints)
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();

        if (! $this->isAdmin($user)) {
            return response()->json(['misiones' => []]);
        }

        $query = Mision::with(['objetivos', 'recompensas.habilidad', 'recompensas.objeto', 'users', 'npc']);

        if ($request->filled('tipo')) {
            $query->where('tipo_mision', $request->tipo);
        }

        $misiones = $query->orderBy('orden')->orderByDesc('created_at')
            ->get()
            ->map(fn ($m) => $this->formatMision($m, true));

        return response()->json(['misiones' => $misiones]);
    }

    // ── GET /api/misiones/comunidad ───────────────────────────────────────────
    public function comunidad(Request $request): JsonResponse
    {
        $user = $request->user();

        $misiones = Mision::with(['objetivos', 'recompensas.habilidad', 'recompensas.objeto', 'users.character'])
            ->where('tipo_mision', 'comunidad')
            ->where('activa', true)
            ->orderBy('orden')
            ->get()
            ->map(function ($m) use ($user) {
                $base = $this->formatMision($m);

                $participantes = $m->users->map(fn ($u) => [
                    'id'           => $u->id,
                    'name'         => $u->name,
                    'handle'       => $u->character?->handle ?? '',
                    'photo_url'    => $u->character?->photo_url ?? null,
                    'progreso'     => $u->pivot->progreso,
                    'progreso_json' => $u->pivot->progreso_json
                        ? json_decode($u->pivot->progreso_json, true)
                        : null,
                    'status'       => $u->pivot->status,
                ])->values();

                $totalProgreso = $m->users->sum(fn ($u) => $u->pivot->progreso);

                $miPivot = $m->users->firstWhere('id', $user->id);

                return array_merge($base, [
                    'participantes'    => $participantes,
                    'total_progreso'   => $totalProgreso,
                    'completada_por_mi' => $miPivot?->pivot->status === 'completada',
                ]);
            });

        return response()->json(['misiones' => $misiones]);
    }

    // ── GET /api/misiones/individual ──────────────────────────────────────────
    public function individual(Request $request): JsonResponse
    {
        $user = $request->user();

        $userMisionIds = $user->misiones()->pluck('misiones.id');

        // Solo misiones individuales que el usuario ya pidió al NPC (tiene registro en mision_user),
        // sin importar el estado (pendiente, en-curso o completada).
        $misiones = Mision::with(['objetivos', 'recompensas.habilidad', 'recompensas.objeto', 'npc.lugar'])
            ->where('tipo_mision', 'individual')
            ->where('activa', true)
            ->whereIn('id', $userMisionIds)
            ->orderBy('orden')
            ->get()
            ->map(function ($m) use ($user) {
                $base = $this->formatMision($m);

                $pivot = $m->users()->where('user_id', $user->id)->first()?->pivot;

                return array_merge($base, [
                    'status'       => $pivot?->status ?? 'pendiente',
                    'progreso'     => $pivot?->progreso ?? 0,
                    'progreso_json' => $pivot?->progreso_json
                        ? json_decode($pivot->progreso_json, true)
                        : null,
                    'npc'          => $m->npc ? [
                        'id'         => $m->npc->id,
                        'nombre'     => $m->npc->nombre,
                        'imagen_mini' => $m->npc->imagen_mini,
                        'lugar'      => $m->npc->lugar?->nombre,
                    ] : null,
                ]);
            });

        return response()->json(['misiones' => $misiones]);
    }

    // ── GET /api/misiones/temporada/{temporadaId} ─────────────────────────────
    public function porTemporada(Request $request, int $temporadaId): JsonResponse
    {
        $user = $request->user();

        $misiones = Mision::with(['objetivos', 'recompensas.habilidad', 'recompensas.objeto'])
            ->where('tipo_mision', 'temporada')
            ->where('temporada_id', $temporadaId)
            ->where('activa', true)
            ->orderBy('orden')
            ->get()
            ->map(function ($m) use ($user) {
                $base = $this->formatMision($m);

                $pivot = $m->users()->where('user_id', $user->id)->first()?->pivot;

                return array_merge($base, [
                    'completada_por_mi' => $pivot?->status === 'completada',
                    'status'            => $pivot?->status ?? null,
                    'progreso'          => $pivot?->progreso ?? 0,
                ]);
            });

        return response()->json(['misiones' => $misiones]);
    }

    // ── POST /api/misiones ────────────────────────────────────────────────────
    public function store(Request $request): JsonResponse
    {
        if (! $this->isAdmin($request->user())) {
            return response()->json(['message' => 'No autorizado.'], 403);
        }

        $this->decodeJsonArrayFields($request);

        $data = $request->validate([
            'nombre'            => 'required|string|max:255',
            'mision'            => 'required|string',
            'descripcion'       => 'nullable|string',
            'foto_mision'       => $request->hasFile('foto_mision') ? 'nullable|file|image|max:5120' : 'nullable|string|max:500',
            'tipo_mision'       => 'sometimes|in:temporada,comunidad,individual',
            'temporada_id'      => 'nullable|integer|exists:temporadas,id',
            'npc_id'            => 'nullable|integer|exists:map_npcs,id',
            'puntos_requeridos' => 'sometimes|integer|min:0',
            'activa'            => 'sometimes|boolean',
            'orden'             => 'sometimes|integer|min:0',
            'fecha_inicio'      => 'nullable|date_format:Y-m-d',
            'fecha_termino'     => 'nullable|date_format:Y-m-d',
            'objetivos'         => 'sometimes|array',
            'objetivos.*.nombre'      => 'required|string|max:255',
            'objetivos.*.descripcion' => 'nullable|string',
            'objetivos.*.tipo'        => 'sometimes|string|max:100',
            'objetivos.*.meta'        => 'sometimes|numeric',
            'objetivos.*.unidad'      => 'nullable|string|max:100',
            'objetivos.*.progreso_tipo' => 'sometimes|in:conteo,porcentaje',
            'recompensas'       => 'sometimes|array',
            'recompensas.*.nombre'       => 'required|string|max:255',
            'recompensas.*.descripcion'  => 'nullable|string',
            'recompensas.*.tipo'         => 'sometimes|string|max:100',
            'recompensas.*.valor'        => 'sometimes|numeric',
            'recompensas.*.imagen'       => 'nullable|string|max:500',
            'recompensas.*.habilidad_id' => 'nullable|integer|exists:rol_habilidades,id',
            'recompensas.*.objeto_id'    => 'nullable|integer|exists:rol_objetos,id',
            'hito_requerimiento' => 'nullable|string',
            'entregar_hito'      => 'nullable|string',
        ]);

        if ($request->hasFile('foto_mision')) {
            $data['foto_mision'] = $this->saveAsWebp($request->file('foto_mision'), 'admin/misiones');
        }

        $mision = Mision::create(Arr::except($data, ['objetivos', 'recompensas']));

        foreach ($data['objetivos'] ?? [] as $obj) {
            $mision->objetivos()->create($obj);
        }

        foreach ($data['recompensas'] ?? [] as $rec) {
            $mision->recompensas()->create(Arr::except($rec, ['id']));
        }

        $mision->load(['objetivos', 'recompensas.habilidad', 'recompensas.objeto', 'users']);

        return response()->json(['mision' => $this->formatMision($mision, true)], 201);
    }

    // ── PATCH /api/misiones/{mision} ──────────────────────────────────────────
    public function update(Request $request, Mision $mision): JsonResponse
    {
        if (! $this->isAdmin($request->user())) {
            return response()->json(['message' => 'No autorizado.'], 403);
        }

        $this->decodeJsonArrayFields($request);

        $data = $request->validate([
            'nombre'            => 'sometimes|string|max:255',
            'mision'            => 'sometimes|string',
            'descripcion'       => 'nullable|string',
            'foto_mision'       => $request->hasFile('foto_mision') ? 'nullable|file|image|max:5120' : 'nullable|string|max:500',
            'tipo_mision'       => 'sometimes|in:temporada,comunidad,individual',
            'temporada_id'      => 'nullable|integer|exists:temporadas,id',
            'npc_id'            => 'nullable|integer|exists:map_npcs,id',
            'puntos_requeridos' => 'sometimes|integer|min:0',
            'activa'            => 'sometimes|boolean',
            'orden'             => 'sometimes|integer|min:0',
            'fecha_inicio'      => 'nullable|date_format:Y-m-d',
            'fecha_termino'     => 'nullable|date_format:Y-m-d',
            'objetivos'         => 'sometimes|array',
            'objetivos.*.id'          => 'sometimes|integer',
            'objetivos.*.nombre'      => 'required|string|max:255',
            'objetivos.*.descripcion' => 'nullable|string',
            'objetivos.*.tipo'        => 'sometimes|string|max:100',
            'objetivos.*.meta'        => 'sometimes|numeric',
            'objetivos.*.unidad'      => 'nullable|string|max:100',
            'objetivos.*.progreso_tipo' => 'sometimes|in:conteo,porcentaje',
            'recompensas'       => 'sometimes|array',
            'recompensas.*.id'           => 'sometimes|integer',
            'recompensas.*.nombre'       => 'required|string|max:255',
            'recompensas.*.descripcion'  => 'nullable|string',
            'recompensas.*.tipo'         => 'sometimes|string|max:100',
            'recompensas.*.valor'        => 'sometimes|numeric',
            'recompensas.*.imagen'       => 'nullable|string|max:500',
            'recompensas.*.habilidad_id' => 'nullable|integer|exists:rol_habilidades,id',
            'recompensas.*.objeto_id'    => 'nullable|integer|exists:rol_objetos,id',
            'hito_requerimiento' => 'nullable|string',
            'entregar_hito'      => 'nullable|string',
        ]);

        $reemplazandoFoto = $request->hasFile('foto_mision');
        $borrandoFoto     = array_key_exists('foto_mision', $data) && $data['foto_mision'] === null;

        if (($reemplazandoFoto || $borrandoFoto) && $mision->foto_mision && !str_starts_with($mision->foto_mision, 'http')) {
            Storage::disk('public')->delete($mision->foto_mision);
        }
        if ($reemplazandoFoto) {
            $data['foto_mision'] = $this->saveAsWebp($request->file('foto_mision'), 'admin/misiones');
        }

        $mision->update(Arr::except($data, ['objetivos', 'recompensas']));

        // Sync objetivos
        if (array_key_exists('objetivos', $data)) {
            $incomingObjetivoIds = collect($data['objetivos'])
                ->pluck('id')
                ->filter()
                ->values();

            // Delete removed objetivos
            $mision->objetivos()->whereNotIn('id', $incomingObjetivoIds)->delete();

            foreach ($data['objetivos'] as $obj) {
                if (! empty($obj['id'])) {
                    Objetivo::where('id', $obj['id'])
                        ->where('mision_id', $mision->id)
                        ->update(Arr::except($obj, ['id']));
                } else {
                    $mision->objetivos()->create(Arr::except($obj, ['id']));
                }
            }
        }

        // Sync recompensas
        if (array_key_exists('recompensas', $data)) {
            $incomingRecompensaIds = collect($data['recompensas'])
                ->pluck('id')
                ->filter()
                ->values();

            $mision->recompensas()->whereNotIn('id', $incomingRecompensaIds)->delete();

            foreach ($data['recompensas'] as $rec) {
                if (! empty($rec['id'])) {
                    Recompensa::where('id', $rec['id'])
                        ->where('mision_id', $mision->id)
                        ->update(Arr::except($rec, ['id']));
                } else {
                    $mision->recompensas()->create(Arr::except($rec, ['id']));
                }
            }
        }

        $mision->load(['objetivos', 'recompensas.habilidad', 'recompensas.objeto', 'users']);

        return response()->json(['mision' => $this->formatMision($mision->fresh(['objetivos', 'recompensas.habilidad', 'recompensas.objeto', 'users']), true)]);
    }

    // ── DELETE /api/misiones/{mision} ─────────────────────────────────────────
    public function destroy(Request $request, Mision $mision): JsonResponse
    {
        if (! $this->isAdmin($request->user())) {
            return response()->json(['message' => 'No autorizado.'], 403);
        }

        $mision->delete();

        return response()->json(['message' => 'Misión eliminada.']);
    }

    // ── POST /api/misiones/{mision}/assign ────────────────────────────────────
    public function assign(Request $request, Mision $mision): JsonResponse
    {
        if (! $this->isAdmin($request->user())) {
            return response()->json(['message' => 'No autorizado.'], 403);
        }

        $data = $request->validate([
            'user_id' => 'required|integer|exists:users,id',
        ]);

        $mision->users()->syncWithoutDetaching([
            $data['user_id'] => ['status' => 'pendiente', 'progreso' => 0],
        ]);

        $mision->load(['objetivos', 'recompensas.habilidad', 'recompensas.objeto', 'users']);

        return response()->json(['mision' => $this->formatMision($mision, true)]);
    }

    // ── POST /api/misiones/{mision}/accept ────────────────────────────────────
    public function accept(Request $request, Mision $mision): JsonResponse
    {
        $user = $request->user();
        $mision->users()->syncWithoutDetaching([
            $user->id => ['status' => 'pendiente', 'progreso' => 0],
        ]);

        return response()->json(['message' => 'Misión aceptada.']);
    }

    // ── DELETE /api/misiones/{mision}/users/{userId} ──────────────────────────
    public function unassign(Request $request, Mision $mision, int $userId): JsonResponse
    {
        if (! $this->isAdmin($request->user())) {
            return response()->json(['message' => 'No autorizado.'], 403);
        }

        $mision->users()->detach($userId);

        $mision->load(['objetivos', 'recompensas.habilidad', 'recompensas.objeto', 'users']);

        return response()->json(['mision' => $this->formatMision($mision, true)]);
    }

    // ── PATCH /api/misiones/{mision}/progress ─────────────────────────────────
    public function updateProgress(Request $request, Mision $mision): JsonResponse
    {
        $user = $request->user();

        if (! $mision->users()->where('user_id', $user->id)->exists()) {
            return response()->json(['message' => 'No estás asignado a esta misión.'], 403);
        }

        $data = $request->validate([
            'progreso'      => 'required|integer|min:0|max:100',
            'status'        => 'nullable|in:pendiente,en-curso,completada',
            'progreso_json' => 'nullable|array',
        ]);

        $status = $data['status']
            ?? ($data['progreso'] >= 100 ? 'completada' : ($data['progreso'] > 0 ? 'en-curso' : 'pendiente'));

        $pivotData = [
            'progreso' => $data['progreso'],
            'status'   => $status,
        ];

        if (isset($data['progreso_json'])) {
            $pivotData['progreso_json'] = json_encode($data['progreso_json']);
        }

        $mision->users()->updateExistingPivot($user->id, $pivotData);

        return response()->json(['message' => 'Progreso actualizado.']);
    }

    // ── POST /api/misiones/{mision}/completar ─────────────────────────────────
    public function completar(Request $request, Mision $mision): JsonResponse
    {
        $user      = $request->user();
        $character = $user->character;

        // Verificar hitos requeridos
        if ($mision->hito_requerimiento) {
            $requeridos  = array_filter(array_map('trim', explode(',', $mision->hito_requerimiento)));
            $tieneHitos  = $character
                ? $character->hitos()->whereIn('hito', $requeridos)->pluck('hito')->toArray()
                : [];
            $faltantes   = array_values(array_diff($requeridos, $tieneHitos));

            if (! empty($faltantes)) {
                return response()->json([
                    'message'  => 'No cumples los hitos requeridos para esta misión.',
                    'faltantes' => $faltantes,
                ], 403);
            }
        }

        $mision->users()->syncWithoutDetaching([
            $user->id => ['status' => 'completada', 'progreso' => 100],
        ]);

        $mision->load(['objetivos', 'recompensas.habilidad', 'recompensas.objeto']);

        // Otorgar recompensas según su tipo
        $habilidadesAprendidas = [];
        $objetosOtorgados      = [];
        $objetosSinEspacio     = [];
        $creditosOtorgados     = 0;
        foreach ($mision->recompensas as $recompensa) {
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
            }
        }

        // Otorgar hitos de la misión
        $hitosOtorgados = [];
        if ($mision->entregar_hito && $character) {
            $hitos = array_filter(array_map('trim', explode(',', $mision->entregar_hito)));
            foreach ($hitos as $hito) {
                \App\Models\CharacterHito::firstOrCreate(
                    ['character_id' => $character->id, 'hito' => $hito]
                );
                $hitosOtorgados[] = $hito;
            }
        }

        $pivot = $mision->users()->where('user_id', $user->id)->first()?->pivot;

        return response()->json([
            'message'                => 'Misión completada.',
            'habilidades_aprendidas' => $habilidadesAprendidas,
            'objetos_otorgados'      => $objetosOtorgados,
            'objetos_sin_espacio'    => $objetosSinEspacio,
            'creditos_otorgados'     => $creditosOtorgados,
            'hitos_otorgados'        => $hitosOtorgados,
            'mision'                 => array_merge($this->formatMision($mision), [
                'status'   => $pivot?->status ?? 'completada',
                'progreso' => $pivot?->progreso ?? 100,
            ]),
        ]);
    }

    // ── Shared formatter ──────────────────────────────────────────────────────

    private function formatMision(Mision $mision, bool $withUsers = false): array
    {
        $base = [
            'id'                => $mision->id,
            'nombre'            => $mision->nombre,
            'mision'            => $mision->mision,
            'descripcion'       => $mision->descripcion,
            'foto_mision'       => $mision->foto_mision,
            'tipo_mision'       => $mision->tipo_mision ?? 'individual',
            'temporada_id'      => $mision->temporada_id,
            'npc_id'            => $mision->npc_id,
            'puntos_requeridos' => $mision->puntos_requeridos,
            'activa'            => (bool) $mision->activa,
            'orden'             => $mision->orden,
            'fecha_inicio'         => $mision->fecha_inicio?->format('Y-m-d'),
            'fecha_termino'        => $mision->fecha_termino?->format('Y-m-d'),
            'hito_requerimiento'   => $mision->hito_requerimiento,
            'entregar_hito'        => $mision->entregar_hito,
            'npc'               => $mision->relationLoaded('npc') && $mision->npc
                ? ['id' => $mision->npc->id, 'nombre' => $mision->npc->nombre, 'imagen_mini' => $mision->npc->imagen_mini]
                : null,
            'objetivos'         => $mision->relationLoaded('objetivos')
                ? $mision->objetivos->map(fn ($o) => [
                    'id'           => $o->id,
                    'nombre'       => $o->nombre,
                    'descripcion'  => $o->descripcion,
                    'tipo'         => $o->tipo,
                    'meta'         => $o->meta,
                    'unidad'       => $o->unidad,
                    'progreso_tipo' => $o->progreso_tipo ?? 'conteo',
                ])->values()
                : [],
            'recompensas'       => $mision->relationLoaded('recompensas')
                ? $mision->recompensas->map(fn ($r) => [
                    'id'           => $r->id,
                    'nombre'       => $r->nombre,
                    'descripcion'  => $r->descripcion,
                    'tipo'         => $r->tipo,
                    'valor'        => $r->valor,
                    'imagen'       => $r->imagen,
                    'habilidad_id' => $r->habilidad_id,
                    'habilidad'    => $r->relationLoaded('habilidad') && $r->habilidad
                        ? ['id' => $r->habilidad->id, 'nombre' => $r->habilidad->nombre]
                        : null,
                    'objeto_id'    => $r->objeto_id,
                    'objeto'       => $r->relationLoaded('objeto') && $r->objeto
                        ? ['id' => $r->objeto->id, 'nombre' => $r->objeto->nombre, 'imagen' => $r->objeto->imagen]
                        : null,
                ])->values()
                : [],
        ];

        if ($withUsers && $mision->relationLoaded('users')) {
            $base['users'] = $mision->users->map(fn ($u) => [
                'id'       => $u->id,
                'name'     => $u->name,
                'handle'   => $u->character?->handle ?? '',
                'tier'     => $u->tier ?? 'iniciado',
                'status'   => $u->pivot->status,
                'progreso' => $u->pivot->progreso,
            ])->values();
        }

        return $base;
    }
}
