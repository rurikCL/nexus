<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Task;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class TaskController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();

        if ($user->isTutor()) {
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

        // Verify the authenticated user is actually the tutor of this pupil
        $isPupil = $user->pupils()->where('pupil_id', $data['pupil_id'])->exists();
        if (!$isPupil) {
            return response()->json(['message' => 'Este usuario no es tu pupilo.'], 403);
        }

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

        return response()->json(['task' => $task->load(['tutor.character', 'pupil.character'])], 201);
    }

    public function update(Request $request, Task $task): JsonResponse
    {
        $user = $request->user();

        // Only pupil can update progress
        if ($task->pupil_id !== $user->id) {
            return response()->json(['message' => 'No autorizado.'], 403);
        }

        $data = $request->validate([
            'progress' => 'nullable|integer|min:0|max:100',
            'detail'   => 'nullable|string',
            'status'   => 'nullable|in:pendiente,en-curso,revision,completada',
        ]);

        $task->update($data);

        return response()->json(['task' => $task]);
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
