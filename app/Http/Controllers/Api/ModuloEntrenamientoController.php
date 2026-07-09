<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ModuloEntrenamiento;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ModuloEntrenamientoController extends Controller
{
    private const ADMIN_TIERS  = ['caballero', 'maestro', 'granmaestro'];
    private const NIVELES      = ['basico', 'intermedio', 'avanzado', 'experto'];
    private const ESTADOS      = ['pendiente', 'revision', 'confirmado'];
    private const RANGOS       = ['iniciado', 'padawan', 'caballero', 'maestro'];
    private const FOCOS        = ['Técnica', 'Cardio', 'Sparring', 'Footwork', 'Fuerza', 'Estudio', 'Recuperación'];
    private const FORMAS       = ['forma1', 'forma2', 'forma3', 'forma4', 'forma5', 'forma6', 'forma7'];

    private function isAdmin(User $user): bool
    {
        return in_array($user->tier, self::ADMIN_TIERS);
    }

    /** Un revisor válido es Guardian (clase) o maestro/granmaestro (tier). */
    private function isValidRevisor(User $user): bool
    {
        return $user->clase === 'Guardian'
            || in_array($user->tier, ['maestro', 'granmaestro']);
    }

    private function format(ModuloEntrenamiento $m): array
    {
        return [
            'id'               => $m->id,
            'nombre'           => $m->nombre,
            'descripcion'      => $m->descripcion,
            'objetivos'        => $m->objetivos ?? [],
            'foco'             => $m->foco,
            'esfuerzo'         => $m->esfuerzo,
            'forma'            => $m->forma,
            'fotos'            => $m->fotos ?? [],
            'video'            => $m->video,
            'nivel_dificultad' => $m->nivel_dificultad,
            'estado'           => $m->estado,
            'rango'            => $m->rango,
            'creado_por'       => $m->creadoPor ? [
                'id'     => $m->creadoPor->id,
                'name'   => $m->creadoPor->name,
                'handle' => $m->creadoPor->character?->handle ?? '',
            ] : null,
            'revisado_por'     => $m->revisadoPor ? [
                'id'     => $m->revisadoPor->id,
                'name'   => $m->revisadoPor->name,
                'handle' => $m->revisadoPor->character?->handle ?? '',
                'clase'  => $m->revisadoPor->clase,
                'tier'   => $m->revisadoPor->tier,
            ] : null,
            'created_at'       => $m->created_at?->format('Y-m-d'),
        ];
    }

    public function index(): JsonResponse
    {
        $modulos = ModuloEntrenamiento::with(['creadoPor.character', 'revisadoPor.character'])
            ->orderByDesc('created_at')
            ->get()
            ->map(fn($m) => $this->format($m));

        return response()->json(['modulos' => $modulos]);
    }

    public function show(ModuloEntrenamiento $moduloEntrenamiento): JsonResponse
    {
        $moduloEntrenamiento->load(['creadoPor.character', 'revisadoPor.character']);
        return response()->json(['modulo' => $this->format($moduloEntrenamiento)]);
    }

    /** Devuelve la lista de usuarios habilitados para revisar módulos. */
    public function revisores(): JsonResponse
    {
        $revisores = User::with('character')
            ->where(function ($q) {
                $q->where('clase', 'Guardian')
                  ->orWhereIn('tier', ['maestro', 'granmaestro']);
            })
            ->get()
            ->map(fn($u) => [
                'id'     => $u->id,
                'name'   => $u->name,
                'handle' => $u->character?->handle ?? '',
                'clase'  => $u->clase,
                'tier'   => $u->tier,
            ]);

        return response()->json(['revisores' => $revisores]);
    }

    public function store(Request $request): JsonResponse
    {
        if (!$this->isAdmin($request->user())) {
            return response()->json(['message' => 'No autorizado.'], 403);
        }

        $data = $request->validate([
            'nombre'           => 'required|string|max:255',
            'descripcion'      => 'nullable|string',
            'objetivos'        => 'nullable|array',
            'objetivos.*'      => 'string|max:255',
            'foco'             => 'nullable|string|in:' . implode(',', self::FOCOS),
            'esfuerzo'         => 'nullable|integer|min:1|max:10',
            'forma'            => 'nullable|string|in:' . implode(',', self::FORMAS),
            'fotos'            => 'nullable|array|max:6',
            'fotos.*'          => 'string|max:500',
            'video'            => 'nullable|string|max:500',
            'nivel_dificultad' => 'nullable|string|in:' . implode(',', self::NIVELES),
            'estado'           => 'nullable|string|in:' . implode(',', self::ESTADOS),
            'rango'            => 'nullable|string|in:' . implode(',', self::RANGOS),
            'revisado_por'     => 'nullable|integer|exists:users,id',
        ]);

        if (!empty($data['revisado_por'])) {
            $revisor = User::find($data['revisado_por']);
            if (!$revisor || !$this->isValidRevisor($revisor)) {
                return response()->json(['message' => 'El revisor debe ser Guardian o Maestro/Gran Maestro.'], 422);
            }
        }

        $modulo = ModuloEntrenamiento::create([
            ...$data,
            'creado_por'       => $request->user()->id,
            'nivel_dificultad' => $data['nivel_dificultad'] ?? 'basico',
            'esfuerzo'         => $data['esfuerzo'] ?? 5,
            'estado'           => $data['estado'] ?? 'pendiente',
        ]);

        return response()->json(['modulo' => $this->format($modulo->load(['creadoPor.character', 'revisadoPor.character']))], 201);
    }

    public function update(Request $request, ModuloEntrenamiento $moduloEntrenamiento): JsonResponse
    {
        if (!$this->isAdmin($request->user())) {
            return response()->json(['message' => 'No autorizado.'], 403);
        }

        $data = $request->validate([
            'nombre'           => 'sometimes|string|max:255',
            'descripcion'      => 'nullable|string',
            'objetivos'        => 'nullable|array',
            'objetivos.*'      => 'string|max:255',
            'foco'             => 'nullable|string|in:' . implode(',', self::FOCOS),
            'esfuerzo'         => 'nullable|integer|min:1|max:10',
            'forma'            => 'nullable|string|in:' . implode(',', self::FORMAS),
            'fotos'            => 'nullable|array|max:6',
            'fotos.*'          => 'string|max:500',
            'video'            => 'nullable|string|max:500',
            'nivel_dificultad' => 'nullable|string|in:' . implode(',', self::NIVELES),
            'estado'           => 'nullable|string|in:' . implode(',', self::ESTADOS),
            'rango'            => 'nullable|string|in:' . implode(',', self::RANGOS),
            'revisado_por'     => 'nullable|integer|exists:users,id',
        ]);

        if (!empty($data['revisado_por'])) {
            $revisor = User::find($data['revisado_por']);
            if (!$revisor || !$this->isValidRevisor($revisor)) {
                return response()->json(['message' => 'El revisor debe ser Guardian o Maestro/Gran Maestro.'], 422);
            }
        }

        $moduloEntrenamiento->update($data);

        return response()->json(['modulo' => $this->format($moduloEntrenamiento->fresh()->load(['creadoPor.character', 'revisadoPor.character']))]);
    }

    public function destroy(Request $request, ModuloEntrenamiento $moduloEntrenamiento): JsonResponse
    {
        if (!$this->isAdmin($request->user())) {
            return response()->json(['message' => 'No autorizado.'], 403);
        }

        $moduloEntrenamiento->delete();

        return response()->json(['message' => 'Módulo eliminado.']);
    }
}
