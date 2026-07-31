<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Task;
use App\Models\TaskUpdate;
use App\Notifications\TareaAsignada;
use App\Services\MisionProgresoService;
use App\Traits\ConvertsToWebp;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;

class TaskController extends Controller
{
    use ConvertsToWebp;

    public function index(Request $request): JsonResponse
    {
        $user = $request->user();
        $perspective = $request->query('perspective', $user->isTutor() ? 'tutor' : 'pupil');

        if ($perspective === 'tutor' && $user->isTutor()) {
            $tasks = Task::where('tutor_id', $user->id)
                ->with(['pupil.character', 'tutor.character'])
                ->orderByDesc('created_at')
                ->get();
        } else {
            $tasks = Task::where('pupil_id', $user->id)
                ->with(['tutor.character', 'pupil.character'])
                ->orderByDesc('created_at')
                ->get();
        }

        return response()->json(['tasks' => $tasks]);
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
            'reward' => 'nullable|integer|min:0',
        ]);

        $pupilIds = collect($data['pupil_ids'])->unique()->values();
        $ownedIds = $user->pupils()->whereIn('id', $pupilIds)->pluck('id');
        $notOwned = $pupilIds->diff($ownedIds);

        if ($notOwned->isNotEmpty()) {
            return response()->json(['message' => 'Alguno de los usuarios seleccionados no es pupilo tuyo.'], 422);
        }

        $tasks = $pupilIds->map(function (int $pupilId) use ($user, $data) {
            $task = Task::create([
                'tutor_id' => $user->id,
                'pupil_id' => $pupilId,
                'title' => $data['title'],
                'detail' => $data['detail'] ?? null,
                'due_date' => $data['due_date'] ?? null,
                'reward' => $data['reward'] ?? 0,
                'status' => 'pendiente',
                'progress' => 0,
            ]);

            // Notify pupil (persists to DB for offline delivery)
            $pupil = $task->pupil()->first();
            if ($pupil) {
                $pupil->notify(new TareaAsignada($task, $user));
            }

            return $task->load(['tutor.character', 'pupil.character']);
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

        $task->update(['status' => 'completada', 'progress' => 100]);

        // Award reward to pupil's character credits
        $pupil = $task->pupil()->with('character')->first();
        if ($pupil) {
            MisionProgresoService::registrar($pupil, 'tarea', 1);
        }
        if ($pupil && $pupil->character && $task->reward > 0) {
            $pupil->character->increment('credits', $task->reward);
        }

        return response()->json([
            'task' => $task,
            'credits_awarded' => $task->reward,
        ]);
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
