<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Task;
use App\Notifications\TareaAsignada;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class TaskController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $user        = $request->user();
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

    public function store(Request $request): JsonResponse
    {
        $user = $request->user();

        if (!$user->isTutor()) {
            return response()->json(['message' => 'Solo los tutores pueden asignar tareas.'], 403);
        }

        $data = $request->validate([
            'pupil_id' => 'required|integer|exists:users,id',
            'title'    => 'required|string|max:255',
            'detail'   => 'nullable|string',
            'due_date' => 'nullable|date_format:Y-m-d',
            'reward'   => 'nullable|integer|min:0',
        ]);

        $task = Task::create([
            'tutor_id' => $user->id,
            'pupil_id' => $data['pupil_id'],
            'title'    => $data['title'],
            'detail'   => $data['detail'] ?? null,
            'due_date' => $data['due_date'] ?? null,
            'reward'   => $data['reward'] ?? 0,
            'status'   => 'pendiente',
            'progress' => 0,
        ]);

        // Notify pupil (persists to DB for offline delivery)
        $pupil = $task->pupil()->first();
        if ($pupil) {
            $pupil->notify(new TareaAsignada($task, $user));
        }

        return response()->json(['task' => $task->load(['tutor.character', 'pupil.character'])], 201);
    }

    public function update(Request $request, Task $task): JsonResponse
    {
        $user = $request->user();

        $isTutor = $task->tutor_id === $user->id;
        $isPupil = $task->pupil_id === $user->id;

        if (!$isTutor && !$isPupil) {
            return response()->json(['message' => 'No autorizado.'], 403);
        }

        if ($isTutor) {
            // Tutor can only send back to en-curso (reject)
            $data = $request->validate([
                'status'   => 'nullable|in:pendiente,en-curso',
                'progress' => 'nullable|integer|min:0|max:100',
            ]);
        } else {
            $data = $request->validate([
                'progress' => 'nullable|integer|min:0|max:100',
                'detail'   => 'nullable|string',
                'status'   => 'nullable|in:pendiente,en-curso,revision,completada',
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
        if ($pupil && $pupil->character && $task->reward > 0) {
            $pupil->character->increment('credits', $task->reward);
        }

        return response()->json([
            'task'            => $task,
            'credits_awarded' => $task->reward,
        ]);
    }
}
