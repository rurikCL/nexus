<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\RolObjeto;
use App\Models\Task;
use App\Models\TaskUpdate;
use App\Notifications\TareaAsignada;
use App\Services\MisionProgresoService;
use App\Services\RecompensaGrantService;
use App\Traits\ConvertsToWebp;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;

class TaskController extends Controller
{
    use ConvertsToWebp;

    private const RECOMPENSAS_WITH = ['recompensas.habilidad', 'recompensas.objeto'];

    public function index(Request $request): JsonResponse
    {
        $user = $request->user();
        $perspective = $request->query('perspective', $user->isTutor() ? 'tutor' : 'pupil');

        if ($perspective === 'tutor' && $user->isTutor()) {
            $tasks = Task::where('tutor_id', $user->id)
                ->with(array_merge(['pupil.character', 'tutor.character'], self::RECOMPENSAS_WITH))
                ->orderByDesc('created_at')
                ->get();
        } else {
            $tasks = Task::where('pupil_id', $user->id)
                ->with(array_merge(['tutor.character', 'pupil.character'], self::RECOMPENSAS_WITH))
                ->orderByDesc('created_at')
                ->get();
        }

        return response()->json(['tasks' => $tasks]);
    }

    /** Créditos disponibles, habilidades ya conocidas e inventario del tutor — para el editor de recompensas al asignar. */
    public function recursosTutor(Request $request): JsonResponse
    {
        $user = $request->user();
        if (! $user->isTutor()) {
            return response()->json(['credits' => 0, 'habilidades' => [], 'objetos' => []]);
        }

        $habilidades = $user->habilidadesAprendidas()
            ->get(['rol_habilidades.id', 'rol_habilidades.nombre', 'rol_habilidades.forma'])
            ->map(fn ($h) => ['id' => $h->id, 'label' => $h->nombre, 'forma' => $h->forma]);

        $objetos = ($user->character?->rolObjetos ?? collect())
            ->map(fn ($o) => ['id' => $o->id, 'label' => $o->nombre, 'cantidad' => $o->pivot->cantidad]);

        return response()->json([
            'credits' => $user->character?->credits ?? 0,
            'habilidades' => $habilidades->values(),
            'objetos' => $objetos->values(),
        ]);
    }

    /** Lista los pupilos reales del tutor autenticado (users.tutor_id = mi id), para poblar el selector de asignación. */
    public function pupils(Request $request): JsonResponse
    {
        $user = $request->user();

        if (! $user->isTutor()) {
            return response()->json(['pupils' => []]);
        }

        $pupils = $user->pupils()
            ->with('character')
            ->withMax('trainingDays', 'date')
            ->orderBy('name')
            ->get();

        return response()->json(['pupils' => $pupils]);
    }

    public function store(Request $request): JsonResponse
    {
        $user = $request->user();

        if (! $user->isTutor()) {
            return response()->json(['message' => 'Solo los tutores pueden asignar tareas.'], 403);
        }

        $data = $request->validate([
            'pupil_ids' => 'required|array|min:1',
            'pupil_ids.*' => 'integer|exists:users,id',
            'title' => 'required|string|max:255',
            'detail' => 'nullable|string',
            'due_date' => 'nullable|date_format:Y-m-d',
            'recompensas' => 'sometimes|array',
            'recompensas.*.nombre' => 'required|string|max:255',
            'recompensas.*.tipo' => 'required|in:creditos,objeto,habilidad',
            'recompensas.*.valor' => 'sometimes|numeric|min:0',
            'recompensas.*.habilidad_id' => 'nullable|integer|exists:rol_habilidades,id',
            'recompensas.*.objeto_id' => 'nullable|integer|exists:rol_objetos,id',
        ]);

        $pupilIds = collect($data['pupil_ids'])->unique()->values();
        $ownedIds = $user->pupils()->whereIn('id', $pupilIds)->pluck('id');
        $notOwned = $pupilIds->diff($ownedIds);

        if ($notOwned->isNotEmpty()) {
            return response()->json(['message' => 'Alguno de los usuarios seleccionados no es pupilo tuyo.'], 422);
        }

        $recompensas = collect($data['recompensas'] ?? []);
        $pupilCount = $pupilIds->count();
        $character = $user->character;

        // Créditos: el tutor financia la recompensa completa de todos los pupilos al asignar.
        $totalCreditos = (int) $recompensas->where('tipo', 'creditos')->sum('valor') * $pupilCount;
        if ($totalCreditos > 0 && (! $character || $character->credits < $totalCreditos)) {
            return response()->json([
                'message' => "No tienes créditos suficientes: se necesitan {$totalCreditos} para {$pupilCount} pupilo(s).",
            ], 422);
        }

        // Habilidades: solo se pueden ofrecer las que el tutor ya conoce.
        $habilidadIds = $recompensas->where('tipo', 'habilidad')->pluck('habilidad_id')->filter()->unique();
        if ($habilidadIds->isNotEmpty()) {
            $conocidas = $user->habilidadesAprendidas()->whereIn('habilidad_id', $habilidadIds)->pluck('habilidad_id');
            if ($habilidadIds->diff($conocidas)->isNotEmpty()) {
                return response()->json(['message' => 'Solo puedes ofrecer como recompensa habilidades que ya conoces.'], 422);
            }
        }

        // Objetos: se descuentan del inventario del tutor (una unidad por pupilo asignado).
        $objetoNeeds = $recompensas->where('tipo', 'objeto')->pluck('objeto_id')->filter()->countBy();
        foreach ($objetoNeeds as $objetoId => $lineas) {
            $necesarios = $lineas * $pupilCount;
            $tienen = $character?->rolObjetos()->where('rol_objetos.id', $objetoId)->first()?->pivot->cantidad ?? 0;
            if ($tienen < $necesarios) {
                $nombre = RolObjeto::find($objetoId)?->nombre ?? "objeto #{$objetoId}";
                return response()->json(['message' => "No tienes suficientes '{$nombre}' en tu inventario: se necesitan {$necesarios}."], 422);
            }
        }

        $tasks = DB::transaction(function () use ($user, $data, $pupilIds, $recompensas, $totalCreditos, $objetoNeeds, $pupilCount, $character) {
            if ($totalCreditos > 0) {
                $character->decrement('credits', $totalCreditos);
            }

            foreach ($objetoNeeds as $objetoId => $lineas) {
                $necesarios = $lineas * $pupilCount;
                $pivot = $character->rolObjetos()->where('rol_objetos.id', $objetoId)->first()->pivot;
                $restante = $pivot->cantidad - $necesarios;
                if ($restante > 0) {
                    $character->rolObjetos()->updateExistingPivot($objetoId, ['cantidad' => $restante]);
                } else {
                    $character->rolObjetos()->detach($objetoId);
                }
            }

            return $pupilIds->map(function (int $pupilId) use ($user, $data, $recompensas) {
                $task = Task::create([
                    'tutor_id' => $user->id,
                    'pupil_id' => $pupilId,
                    'title' => $data['title'],
                    'detail' => $data['detail'] ?? null,
                    'due_date' => $data['due_date'] ?? null,
                    'reward' => 0,
                    'status' => 'pendiente',
                    'progress' => 0,
                ]);

                foreach ($recompensas as $rec) {
                    $task->recompensas()->create(Arr::except($rec, ['id']));
                }

                // Notify pupil (persists to DB for offline delivery)
                $pupil = $task->pupil()->first();
                if ($pupil) {
                    $pupil->notify(new TareaAsignada($task, $user));
                }

                return $task->load(array_merge(['tutor.character', 'pupil.character'], self::RECOMPENSAS_WITH));
            });
        });

        return response()->json(['tasks' => $tasks->values()], 201);
    }

    public function update(Request $request, Task $task): JsonResponse
    {
        $user = $request->user();

        $isTutor = $task->tutor_id === $user->id;
        $isPupil = $task->pupil_id === $user->id;

        if (! $isTutor && ! $isPupil) {
            return response()->json(['message' => 'No autorizado.'], 403);
        }

        if ($isTutor) {
            // Tutor can only send back to en-curso (reject)
            $data = $request->validate([
                'status' => 'nullable|in:pendiente,en-curso',
                'progress' => 'nullable|integer|min:0|max:100',
            ]);
        } else {
            $data = $request->validate([
                'progress' => 'nullable|integer|min:0|max:100',
                'detail' => 'nullable|string',
                'status' => 'nullable|in:pendiente,en-curso,revision,completada',
            ]);
        }

        $task->update($data);

        return response()->json(['task' => $task->load(['tutor.character', 'pupil.character'])]);
    }

    public function approve(Request $request, Task $task): JsonResponse
    {
        $user = $request->user();

        // Only tutor can approve
        if ($task->tutor_id !== $user->id) {
            return response()->json(['message' => 'Solo el tutor puede aprobar la tarea.'], 403);
        }

        if ($task->status === 'completada') {
            return response()->json(['message' => 'La tarea ya está completada.'], 409);
        }

        $otorgado = DB::transaction(function () use ($task) {
            $task->update(['status' => 'completada', 'progress' => 100]);

            $pupil = $task->pupil()->with('character')->first();
            if (! $pupil) {
                return [];
            }

            MisionProgresoService::registrar($pupil, 'tarea', 1);

            // Créditos del campo legado 'reward' (tareas antiguas, previas al sistema de recompensas).
            if ($pupil->character && $task->reward > 0) {
                $pupil->character->increment('credits', $task->reward);
            }

            // Recompensas estructuradas — ya fueron descontadas del tutor al asignar la tarea.
            return app(RecompensaGrantService::class)->otorgar($task->recompensas()->get(), $pupil);
        });

        return response()->json(array_merge([
            'task' => $task->fresh(self::RECOMPENSAS_WITH),
            'credits_awarded' => $task->reward,
        ], $otorgado));
    }

    /** Registro de avance de una tarea: comentarios, cambios de progreso y evidencia adjunta. */
    public function updates(Request $request, Task $task): JsonResponse
    {
        $user = $request->user();

        if ($task->tutor_id !== $user->id && $task->pupil_id !== $user->id) {
            return response()->json(['message' => 'No autorizado.'], 403);
        }

        $updates = $task->updates()->with(['user:id,name', 'files'])->get();

        return response()->json(['updates' => $updates]);
    }

    public function addUpdate(Request $request, Task $task): JsonResponse
    {
        $user = $request->user();

        $isTutor = $task->tutor_id === $user->id;
        $isPupil = $task->pupil_id === $user->id;

        if (! $isTutor && ! $isPupil) {
            return response()->json(['message' => 'No autorizado.'], 403);
        }

        $data = $request->validate([
            'comment' => 'nullable|string|max:1000',
            'progress' => 'nullable|integer|min:0|max:100',
            'files' => 'nullable|array|max:5',
            'files.*' => 'file|mimes:jpg,jpeg,png,webp,gif,mp4,mov,pdf|max:20480',
        ]);

        // Solo el pupilo puede reportar avance de progreso; el tutor solo comenta.
        $progress = ($isPupil && isset($data['progress'])) ? $data['progress'] : null;

        if (empty($data['comment']) && $progress === null && ! $request->hasFile('files')) {
            return response()->json(['message' => 'Agrega un comentario, un avance o evidencia.'], 422);
        }

        $update = TaskUpdate::create([
            'task_id' => $task->id,
            'user_id' => $user->id,
            'progress' => $progress,
            'comment' => $data['comment'] ?? null,
        ]);

        foreach ($request->file('files', []) as $file) {
            [$path, $type] = $this->storeEvidence($file, "tasks/{$task->id}");

            $update->files()->create([
                'path' => $path,
                'original_name' => $file->getClientOriginalName(),
                'type' => $type,
            ]);
        }

        if ($progress !== null) {
            $task->update([
                'progress' => $progress,
                'status' => $progress > 0 && $task->status === 'pendiente' ? 'en-curso' : $task->status,
            ]);
        }

        return response()->json([
            'update' => $update->load(['user:id,name', 'files']),
            'task' => $task->fresh(['tutor.character', 'pupil.character']),
        ], 201);
    }

    /** Guarda un archivo de evidencia: las imágenes se convierten a WebP; el resto se guarda tal cual. */
    private function storeEvidence(UploadedFile $file, string $directory): array
    {
        $mime = (string) $file->getMimeType();

        if (str_starts_with($mime, 'image/')) {
            return [$this->saveAsWebp($file, $directory), 'photo'];
        }

        Storage::disk('public')->makeDirectory($directory);
        $type = str_starts_with($mime, 'video/') ? 'video' : 'file';

        return [$file->store($directory, 'public'), $type];
    }
}
