<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Proyecto;
use App\Models\ProyectoMensaje;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

/**
 * Petición de proyectos a los Sentinelas — cualquier usuario puede crear una
 * petición; solo Sentinelas (clase='Sentinela') y Maestros/Gran Maestro pueden
 * ver la lista completa, aprobarla/rechazarla y asignar responsable + ETA.
 * Una vez aprobada pasa a 'en_curso'; el responsable asignado (o quien gestiona)
 * puede después marcarla completada o cancelada.
 */
class ProyectoController extends Controller
{
    private function esGestor(User $user): bool
    {
        return $user->clase === 'Sentinela' || in_array($user->tier, ['maestro', 'granmaestro']);
    }

    private function puedeVer(User $user, Proyecto $proyecto): bool
    {
        return $this->esGestor($user)
            || $proyecto->solicitante_id === $user->id
            || $proyecto->responsable_id === $user->id;
    }

    // ── GET /api/proyectos ──────────────────────────────────────────────────
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();

        $query = Proyecto::with(['solicitante.character', 'responsable.character', 'aprobadoPor.character'])
            ->withCount('mensajes');

        if (! $this->esGestor($user)) {
            $query->where(fn ($q) => $q->where('solicitante_id', $user->id)->orWhere('responsable_id', $user->id));
        }

        $proyectos = $query->orderByDesc('created_at')->get()->map(fn ($p) => $this->formatProyecto($p));

        return response()->json(['proyectos' => $proyectos, 'es_gestor' => $this->esGestor($user)]);
    }

    /** GET /api/proyectos/usuarios — lista liviana para el selector de "responsable" al aprobar. */
    public function usuarios(Request $request): JsonResponse
    {
        if (! $this->esGestor($request->user())) {
            return response()->json(['message' => 'No autorizado.'], 403);
        }

        $usuarios = User::with('character')
            ->get()
            ->map(fn ($u) => [
                'id' => $u->id,
                'name' => $u->character?->name ?? $u->name,
                'handle' => $u->character?->handle,
                'tier' => $u->tier,
            ])
            ->sortBy('name')
            ->values();

        return response()->json(['usuarios' => $usuarios]);
    }

    // ── POST /api/proyectos ─────────────────────────────────────────────────
    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'titulo' => 'required|string|max:255',
            'descripcion' => 'required|string|max:5000',
        ]);

        $proyecto = Proyecto::create([
            'solicitante_id' => $request->user()->id,
            'titulo' => $data['titulo'],
            'descripcion' => $data['descripcion'],
            'status' => 'pendiente',
        ]);

        return response()->json(['proyecto' => $this->formatProyecto($this->loadProyecto($proyecto))], 201);
    }

    // ── GET /api/proyectos/{proyecto} ───────────────────────────────────────
    public function show(Request $request, Proyecto $proyecto): JsonResponse
    {
        if (! $this->puedeVer($request->user(), $proyecto)) {
            return response()->json(['message' => 'No autorizado.'], 403);
        }

        return response()->json(['proyecto' => $this->formatProyecto($this->loadProyecto($proyecto))]);
    }

    // ── POST /api/proyectos/{proyecto}/aprobar ──────────────────────────────
    public function aprobar(Request $request, Proyecto $proyecto): JsonResponse
    {
        $user = $request->user();
        if (! $this->esGestor($user)) {
            return response()->json(['message' => 'No autorizado.'], 403);
        }
        if ($proyecto->status !== 'pendiente') {
            return response()->json(['message' => 'Esta petición ya fue resuelta.'], 422);
        }

        $data = $request->validate([
            'responsable_id' => 'required|integer|exists:users,id',
            'eta' => 'required|date_format:Y-m-d',
        ]);

        $proyecto->update([
            'status' => 'en_curso',
            'responsable_id' => $data['responsable_id'],
            'eta' => $data['eta'],
            'aprobado_por_id' => $user->id,
        ]);

        return response()->json(['proyecto' => $this->formatProyecto($this->loadProyecto($proyecto))]);
    }

    // ── POST /api/proyectos/{proyecto}/rechazar ─────────────────────────────
    public function rechazar(Request $request, Proyecto $proyecto): JsonResponse
    {
        $user = $request->user();
        if (! $this->esGestor($user)) {
            return response()->json(['message' => 'No autorizado.'], 403);
        }
        if ($proyecto->status !== 'pendiente') {
            return response()->json(['message' => 'Esta petición ya fue resuelta.'], 422);
        }

        $proyecto->update(['status' => 'rechazada', 'aprobado_por_id' => $user->id]);

        return response()->json(['proyecto' => $this->formatProyecto($this->loadProyecto($proyecto))]);
    }

    // ── POST /api/proyectos/{proyecto}/completar ────────────────────────────
    public function completar(Request $request, Proyecto $proyecto): JsonResponse
    {
        return $this->cerrar($request, $proyecto, 'completado');
    }

    // ── POST /api/proyectos/{proyecto}/cancelar ─────────────────────────────
    public function cancelar(Request $request, Proyecto $proyecto): JsonResponse
    {
        return $this->cerrar($request, $proyecto, 'cancelado');
    }

    private function cerrar(Request $request, Proyecto $proyecto, string $nuevoStatus): JsonResponse
    {
        $user = $request->user();
        if (! $this->esGestor($user) && $proyecto->responsable_id !== $user->id) {
            return response()->json(['message' => 'No autorizado.'], 403);
        }
        if ($proyecto->status !== 'en_curso') {
            return response()->json(['message' => 'El proyecto no está en curso.'], 422);
        }

        $proyecto->update(['status' => $nuevoStatus]);

        return response()->json(['proyecto' => $this->formatProyecto($this->loadProyecto($proyecto))]);
    }

    // ── GET /api/proyectos/{proyecto}/mensajes ──────────────────────────────
    public function mensajes(Request $request, Proyecto $proyecto): JsonResponse
    {
        if (! $this->puedeVer($request->user(), $proyecto)) {
            return response()->json(['message' => 'No autorizado.'], 403);
        }

        $mensajes = $proyecto->mensajes()->with('user.character')->get()->map(fn ($m) => $this->formatMensaje($m));

        return response()->json(['mensajes' => $mensajes]);
    }

    // ── POST /api/proyectos/{proyecto}/mensajes ─────────────────────────────
    public function addMensaje(Request $request, Proyecto $proyecto): JsonResponse
    {
        $user = $request->user();
        if (! $this->puedeVer($user, $proyecto)) {
            return response()->json(['message' => 'No autorizado.'], 403);
        }

        $data = $request->validate(['mensaje' => 'required|string|max:2000']);

        $mensaje = $proyecto->mensajes()->create([
            'user_id' => $user->id,
            'mensaje' => $data['mensaje'],
        ]);

        return response()->json(['mensaje' => $this->formatMensaje($mensaje->load('user.character'))], 201);
    }

    // ── helpers ──────────────────────────────────────────────────────────────

    private function loadProyecto(Proyecto $proyecto): Proyecto
    {
        return $proyecto->fresh(['solicitante.character', 'responsable.character', 'aprobadoPor.character'])
            ->loadCount('mensajes');
    }

    private function formatUser(?User $user): ?array
    {
        if (! $user) {
            return null;
        }

        return [
            'id' => $user->id,
            'name' => $user->character?->name ?? $user->name,
            'handle' => $user->character?->handle,
            'photo_url' => $user->character?->photo ? Storage::disk('public')->url($user->character->photo) : null,
            'tier' => $user->tier,
        ];
    }

    private function formatProyecto(Proyecto $proyecto): array
    {
        return [
            'id' => $proyecto->id,
            'titulo' => $proyecto->titulo,
            'descripcion' => $proyecto->descripcion,
            'status' => $proyecto->status,
            'eta' => $proyecto->eta?->format('Y-m-d'),
            'solicitante' => $this->formatUser($proyecto->solicitante),
            'responsable' => $this->formatUser($proyecto->responsable),
            'aprobado_por' => $this->formatUser($proyecto->aprobadoPor),
            'mensajes_count' => $proyecto->mensajes_count ?? 0,
            'created_at' => $proyecto->created_at?->format('Y-m-d H:i'),
            'updated_at' => $proyecto->updated_at?->format('Y-m-d H:i'),
        ];
    }

    private function formatMensaje(ProyectoMensaje $mensaje): array
    {
        return [
            'id' => $mensaje->id,
            'mensaje' => $mensaje->mensaje,
            'user' => $this->formatUser($mensaje->user),
            'created_at' => $mensaje->created_at?->format('Y-m-d H:i'),
        ];
    }
}
