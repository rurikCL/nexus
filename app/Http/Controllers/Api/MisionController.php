<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Mision;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class MisionController extends Controller
{
    private const ADMIN_TIERS = ['caballero', 'maestro', 'granmaestro'];

    private function isAdmin(User $user): bool
    {
        return in_array($user->tier, self::ADMIN_TIERS);
    }

    public function index(Request $request): JsonResponse
    {
        $user = $request->user();

        if ($this->isAdmin($user)) {
            $misiones = Mision::with(['users.character'])
                ->orderByDesc('created_at')
                ->get()
                ->map(fn($m) => $this->formatAdmin($m));
        } else {
            $misiones = $user->misiones()
                ->orderByDesc('misiones.created_at')
                ->get()
                ->map(fn($m) => $this->formatUser($m));
        }

        return response()->json(['misiones' => $misiones]);
    }

    public function store(Request $request): JsonResponse
    {
        if (!$this->isAdmin($request->user())) {
            return response()->json(['message' => 'No autorizado.'], 403);
        }

        $data = $request->validate([
            'nombre'        => 'required|string|max:255',
            'mision'        => 'required|string',
            'descripcion'   => 'nullable|string',
            'foto_mision'   => 'nullable|string|max:500',
            'recompensa_id' => 'nullable|integer|exists:recompensas,id',
            'fecha_inicio'  => 'nullable|date_format:Y-m-d',
            'fecha_termino' => 'nullable|date_format:Y-m-d',
            'objetivo_id'   => 'nullable|integer|exists:objetivos,id',
        ]);

        $mision = Mision::create($data);

        return response()->json(['mision' => $this->formatAdmin($mision->load('users.character'))], 201);
    }

    public function update(Request $request, Mision $mision): JsonResponse
    {
        if (!$this->isAdmin($request->user())) {
            return response()->json(['message' => 'No autorizado.'], 403);
        }

        $data = $request->validate([
            'nombre'        => 'sometimes|string|max:255',
            'mision'        => 'sometimes|string',
            'descripcion'   => 'nullable|string',
            'foto_mision'   => 'nullable|string|max:500',
            'recompensa_id' => 'nullable|integer|exists:recompensas,id',
            'fecha_inicio'  => 'nullable|date_format:Y-m-d',
            'fecha_termino' => 'nullable|date_format:Y-m-d',
            'objetivo_id'   => 'nullable|integer|exists:objetivos,id',
        ]);

        $mision->update($data);

        return response()->json(['mision' => $this->formatAdmin($mision->fresh()->load('users.character'))]);
    }

    public function destroy(Request $request, Mision $mision): JsonResponse
    {
        if (!$this->isAdmin($request->user())) {
            return response()->json(['message' => 'No autorizado.'], 403);
        }

        $mision->delete();

        return response()->json(['message' => 'Misión eliminada.']);
    }

    public function assign(Request $request, Mision $mision): JsonResponse
    {
        if (!$this->isAdmin($request->user())) {
            return response()->json(['message' => 'No autorizado.'], 403);
        }

        $data = $request->validate([
            'user_id' => 'required|integer|exists:users,id',
        ]);

        $mision->users()->syncWithoutDetaching([
            $data['user_id'] => ['status' => 'pendiente', 'progreso' => 0],
        ]);

        return response()->json(['mision' => $this->formatAdmin($mision->load('users.character'))]);
    }

    public function unassign(Request $request, Mision $mision, int $userId): JsonResponse
    {
        if (!$this->isAdmin($request->user())) {
            return response()->json(['message' => 'No autorizado.'], 403);
        }

        $mision->users()->detach($userId);

        return response()->json(['mision' => $this->formatAdmin($mision->load('users.character'))]);
    }

    public function updateProgress(Request $request, Mision $mision): JsonResponse
    {
        $user = $request->user();

        if (!$mision->users()->where('user_id', $user->id)->exists()) {
            return response()->json(['message' => 'No estás asignado a esta misión.'], 403);
        }

        $data = $request->validate([
            'progreso' => 'required|integer|min:0|max:100',
            'status'   => 'nullable|in:pendiente,en-curso,completada',
        ]);

        $status = $data['status']
            ?? ($data['progreso'] >= 100 ? 'completada' : ($data['progreso'] > 0 ? 'en-curso' : 'pendiente'));

        $mision->users()->updateExistingPivot($user->id, [
            'progreso' => $data['progreso'],
            'status'   => $status,
        ]);

        return response()->json(['message' => 'Progreso actualizado.']);
    }

    private function formatAdmin(Mision $mision): array
    {
        return [
            'id'            => $mision->id,
            'nombre'        => $mision->nombre,
            'mision'        => $mision->mision,
            'descripcion'   => $mision->descripcion,
            'foto_mision'   => $mision->foto_mision,
            'fecha_inicio'  => $mision->fecha_inicio?->format('Y-m-d'),
            'fecha_termino' => $mision->fecha_termino?->format('Y-m-d'),
            'recompensa_id' => $mision->recompensa_id,
            'objetivo_id'   => $mision->objetivo_id,
            'users'         => $mision->users->map(fn($u) => [
                'id'       => $u->id,
                'name'     => $u->name,
                'handle'   => $u->character?->handle ?? '',
                'tier'     => $u->tier ?? 'iniciado',
                'status'   => $u->pivot->status,
                'progreso' => $u->pivot->progreso,
            ])->values(),
        ];
    }

    private function formatUser(Mision $mision): array
    {
        return [
            'id'            => $mision->id,
            'nombre'        => $mision->nombre,
            'mision'        => $mision->mision,
            'descripcion'   => $mision->descripcion,
            'foto_mision'   => $mision->foto_mision,
            'fecha_inicio'  => $mision->fecha_inicio?->format('Y-m-d'),
            'fecha_termino' => $mision->fecha_termino?->format('Y-m-d'),
            'recompensa_id' => $mision->recompensa_id,
            'objetivo_id'   => $mision->objetivo_id,
            'status'        => $mision->pivot?->status ?? 'pendiente',
            'progreso'      => $mision->pivot?->progreso ?? 0,
        ];
    }
}
