<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Torneo;
use App\Models\TorneoCombate;
use App\Models\TorneoInscripcion;
use App\Traits\ConvertsToWebp;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;

class TorneoController extends Controller
{
    use ConvertsToWebp;

    // ── GET /api/torneos ──────────────────────────────────────────────────────
    public function index(Request $request): JsonResponse
    {
        $torneos = Torneo::withCount(['inscripciones as inscritos_count' => function ($q) {
            $q->where('estado', '!=', 'eliminado');
        }])->orderByDesc('created_at')->get();

        return response()->json(['torneos' => $torneos->map(fn ($t) => $this->formatTorneo($t))]);
    }

    // ── GET /api/torneos/{torneo} ─────────────────────────────────────────────
    public function show(Request $request, Torneo $torneo): JsonResponse
    {
        $user = $request->user();

        $torneo->load(['inscripciones.user.character', 'ganador.character']);
        $combates = $torneo->combates()
            ->with(['userA.character', 'userB.character', 'ganador.character'])
            ->orderBy('ronda')->orderBy('posicion')
            ->get();

        $miInscripcion = $torneo->inscripciones->firstWhere('user_id', $user->id);

        return response()->json([
            'torneo' => array_merge($this->formatTorneo($torneo), [
                'participantes' => $torneo->inscripciones->map(fn ($i) => [
                    'user_id' => $i->user_id,
                    'name'    => $i->user->name,
                    'handle'  => $i->user->character?->handle ?? '',
                    'photo_url' => $this->photoUrl($i->user->character),
                    'estado'  => $i->estado,
                    'seed'    => $i->seed,
                ])->values(),
                'combates' => $combates->groupBy('ronda')->map(fn ($grupo, $ronda) => [
                    'ronda'     => (int) $ronda,
                    'combates'  => $grupo->map(fn ($c) => $this->formatCombate($c))->values(),
                ])->values(),
                'mi_inscripcion' => $miInscripcion ? [
                    'estado' => $miInscripcion->estado,
                    'seed'   => $miInscripcion->seed,
                ] : null,
            ]),
        ]);
    }

    // ── POST /api/torneos ──────────────────────────────────────────────────────
    public function store(Request $request): JsonResponse
    {
        if (! $request->user()->isTutor()) {
            return response()->json(['message' => 'No autorizado.'], 403);
        }

        $data = $request->validate([
            'nombre'       => 'required|string|max:255',
            'descripcion'  => 'nullable|string',
            'imagen'       => $request->hasFile('imagen') ? 'nullable|file|image|max:5120' : 'nullable|string|max:500',
            'premios'      => 'nullable|string',
            'requisitos'   => 'nullable|string',
            'cupos'        => 'required|integer|min:2',
            'fecha_inicio' => 'nullable|date_format:Y-m-d',
        ]);

        if ($request->hasFile('imagen')) {
            $data['imagen'] = $this->saveAsWebp($request->file('imagen'), 'admin/torneos');
        }

        $torneo = Torneo::create($data);

        return response()->json(['torneo' => $this->formatTorneo($torneo)], 201);
    }

    // ── PATCH /api/torneos/{torneo} ───────────────────────────────────────────
    public function update(Request $request, Torneo $torneo): JsonResponse
    {
        if (! $request->user()->isTutor()) {
            return response()->json(['message' => 'No autorizado.'], 403);
        }

        $data = $request->validate([
            'nombre'       => 'sometimes|string|max:255',
            'descripcion'  => 'nullable|string',
            'imagen'       => $request->hasFile('imagen') ? 'nullable|file|image|max:5120' : 'nullable|string|max:500',
            'premios'      => 'nullable|string',
            'requisitos'   => 'nullable|string',
            'cupos'        => 'sometimes|integer|min:2',
            'fecha_inicio' => 'nullable|date_format:Y-m-d',
        ]);

        $reemplazandoImagen = $request->hasFile('imagen');
        $borrandoImagen     = array_key_exists('imagen', $data) && $data['imagen'] === null;

        if (($reemplazandoImagen || $borrandoImagen) && $torneo->imagen && ! str_starts_with($torneo->imagen, 'http')) {
            Storage::disk('public')->delete($torneo->imagen);
        }
        if ($reemplazandoImagen) {
            $data['imagen'] = $this->saveAsWebp($request->file('imagen'), 'admin/torneos');
        }

        $torneo->update($data);

        return response()->json(['torneo' => $this->formatTorneo($torneo->fresh())]);
    }

    // ── DELETE /api/torneos/{torneo} ──────────────────────────────────────────
    public function destroy(Request $request, Torneo $torneo): JsonResponse
    {
        if (! $request->user()->isTutor()) {
            return response()->json(['message' => 'No autorizado.'], 403);
        }

        $torneo->delete();

        return response()->json(['message' => 'Torneo eliminado.']);
    }

    // ── POST /api/torneos/{torneo}/inscribir ──────────────────────────────────
    public function inscribir(Request $request, Torneo $torneo): JsonResponse
    {
        $user = $request->user();

        if (! $user->character) {
            return response()->json(['message' => 'Necesitas un personaje para inscribirte.'], 422);
        }

        if ($torneo->estado !== 'inscripcion') {
            return response()->json(['message' => 'La inscripción de este torneo ya está cerrada.'], 409);
        }

        if ($torneo->inscripciones()->where('user_id', $user->id)->exists()) {
            return response()->json(['message' => 'Ya estás inscrito en este torneo.'], 409);
        }

        if ($torneo->inscripciones()->count() >= $torneo->cupos) {
            return response()->json(['message' => 'No quedan cupos disponibles.'], 409);
        }

        $torneo->inscripciones()->create(['user_id' => $user->id]);

        return response()->json(['message' => 'Inscripción realizada.']);
    }

    // ── DELETE /api/torneos/{torneo}/inscribir ────────────────────────────────
    public function retirar(Request $request, Torneo $torneo): JsonResponse
    {
        $user = $request->user();

        if ($torneo->estado !== 'inscripcion') {
            return response()->json(['message' => 'Ya no puedes retirarte de este torneo.'], 409);
        }

        $torneo->inscripciones()->where('user_id', $user->id)->delete();

        return response()->json(['message' => 'Inscripción retirada.']);
    }

    // ── POST /api/torneos/{torneo}/iniciar ────────────────────────────────────
    public function iniciar(Request $request, Torneo $torneo): JsonResponse
    {
        if (! $request->user()->isTutor()) {
            return response()->json(['message' => 'No autorizado.'], 403);
        }

        if ($torneo->estado !== 'inscripcion') {
            return response()->json(['message' => 'El árbol de este torneo ya fue generado.'], 409);
        }

        $inscritos = $torneo->inscripciones()->where('estado', 'inscrito')->pluck('user_id')->all();

        if (count($inscritos) < 2) {
            return response()->json(['message' => 'Se necesitan al menos 2 inscritos para generar el árbol.'], 422);
        }

        DB::transaction(function () use ($torneo, $inscritos) {
            $bracketSize = 1;
            while ($bracketSize < count($inscritos)) {
                $bracketSize *= 2;
            }

            $slots = array_pad($inscritos, $bracketSize, null);
            shuffle($slots);

            $totalRounds = 0;
            for ($n = $bracketSize; $n > 1; $n = intdiv($n, 2)) {
                $totalRounds++;
            }

            // Crear los combates de atrás hacia adelante (final primero) para poder enlazar next_combate_id.
            $matchesByRound = [];
            for ($ronda = $totalRounds; $ronda >= 1; $ronda--) {
                $numMatches = $bracketSize / (2 ** $ronda);
                $matchesByRound[$ronda] = [];

                for ($posicion = 0; $posicion < $numMatches; $posicion++) {
                    $next = $matchesByRound[$ronda + 1][intdiv($posicion, 2)] ?? null;

                    $combate = TorneoCombate::create([
                        'torneo_id'       => $torneo->id,
                        'ronda'           => $ronda,
                        'posicion'        => $posicion,
                        'next_combate_id' => $next?->id,
                        'next_slot'       => $next ? ($posicion % 2 === 0 ? 'a' : 'b') : null,
                    ]);

                    $matchesByRound[$ronda][$posicion] = $combate;
                }
            }

            // Rellenar la ronda 1 con los combatientes barajados y resolver los byes.
            foreach ($matchesByRound[1] as $posicion => $combate) {
                $userA = $slots[$posicion * 2] ?? null;
                $userB = $slots[$posicion * 2 + 1] ?? null;

                $combate->update(['user_a_id' => $userA, 'user_b_id' => $userB]);

                if (($userA === null) !== ($userB === null)) {
                    $ganador = $userA ?? $userB;
                    $combate->update(['estado' => 'bye', 'ganador_id' => $ganador]);
                    $this->propagarGanador($combate, $ganador);
                }
            }

            $torneo->update(['estado' => 'en_curso']);
        });

        return response()->json(['message' => 'Árbol generado.']);
    }

    // ── POST /api/torneos/{torneo}/combates/{combate}/resolver ───────────────
    public function resolverCombate(Request $request, Torneo $torneo, TorneoCombate $combate): JsonResponse
    {
        if (! $request->user()->isTutor()) {
            return response()->json(['message' => 'No autorizado.'], 403);
        }

        if ($combate->torneo_id !== $torneo->id) {
            return response()->json(['message' => 'Combate no pertenece a este torneo.'], 404);
        }

        if ($combate->estado !== 'pendiente' || ! $combate->user_a_id || ! $combate->user_b_id) {
            return response()->json(['message' => 'Este combate no puede resolverse.'], 409);
        }

        $data = $request->validate([
            'puntos_a'      => 'required|integer|min:0',
            'puntos_b'      => 'required|integer|min:0',
            'faltas_a'      => 'required|integer|min:0',
            'faltas_b'      => 'required|integer|min:0',
            'falta_grave_a' => 'sometimes|boolean',
            'falta_grave_b' => 'sometimes|boolean',
            'ganador'       => 'required|in:a,b',
        ]);

        $ganadorId = $data['ganador'] === 'a' ? $combate->user_a_id : $combate->user_b_id;
        $perdedorId = $data['ganador'] === 'a' ? $combate->user_b_id : $combate->user_a_id;

        DB::transaction(function () use ($torneo, $combate, $data, $ganadorId, $perdedorId, $request) {
            $combate->update([
                'puntos_a'      => $data['puntos_a'],
                'puntos_b'      => $data['puntos_b'],
                'faltas_a'      => $data['faltas_a'],
                'faltas_b'      => $data['faltas_b'],
                'falta_grave_a' => $data['falta_grave_a'] ?? false,
                'falta_grave_b' => $data['falta_grave_b'] ?? false,
                'estado'        => 'resuelto',
                'ganador_id'    => $ganadorId,
                'resuelto_por'  => $request->user()->id,
            ]);

            $torneo->inscripciones()->where('user_id', $perdedorId)->update(['estado' => 'eliminado']);

            if ($combate->next_combate_id) {
                $this->propagarGanador($combate, $ganadorId);
            } else {
                $torneo->update(['estado' => 'finalizado', 'ganador_user_id' => $ganadorId]);
                $torneo->inscripciones()->where('user_id', $ganadorId)->update(['estado' => 'campeon']);
            }
        });

        return response()->json(['message' => 'Combate resuelto.', 'combate' => $this->formatCombate($combate->fresh(['userA.character', 'userB.character', 'ganador.character']))]);
    }

    private function propagarGanador(TorneoCombate $combate, int $ganadorId): void
    {
        if (! $combate->next_combate_id) {
            return;
        }

        $campo = $combate->next_slot === 'a' ? 'user_a_id' : 'user_b_id';
        TorneoCombate::whereKey($combate->next_combate_id)->update([$campo => $ganadorId]);
    }

    // ── Shared formatters ──────────────────────────────────────────────────────

    private function photoUrl($character): ?string
    {
        if (! $character || ! $character->photo) {
            return null;
        }

        return '/storage/' . $character->photo . '?v=' . $character->updated_at->timestamp;
    }

    private function formatTorneo(Torneo $torneo): array
    {
        return [
            'id'              => $torneo->id,
            'nombre'          => $torneo->nombre,
            'descripcion'     => $torneo->descripcion,
            'imagen'          => $torneo->imagen,
            'premios'         => $torneo->premios,
            'requisitos'      => $torneo->requisitos,
            'cupos'           => $torneo->cupos,
            'estado'          => $torneo->estado,
            'fecha_inicio'    => $torneo->fecha_inicio?->format('Y-m-d'),
            'inscritos_count' => $torneo->inscritos_count ?? $torneo->inscripciones()->count(),
            'ganador'         => $torneo->relationLoaded('ganador') && $torneo->ganador ? [
                'user_id' => $torneo->ganador->id,
                'name'    => $torneo->ganador->name,
                'handle'  => $torneo->ganador->character?->handle ?? '',
            ] : null,
        ];
    }

    private function formatCombate(TorneoCombate $combate): array
    {
        $lado = function ($user) {
            if (! $user) {
                return null;
            }

            return [
                'user_id'   => $user->id,
                'name'      => $user->name,
                'handle'    => $user->character?->handle ?? '',
                'photo_url' => $this->photoUrl($user->character),
            ];
        };

        return [
            'id'             => $combate->id,
            'ronda'          => $combate->ronda,
            'posicion'       => $combate->posicion,
            'estado'         => $combate->estado,
            'user_a'         => $lado($combate->userA),
            'user_b'         => $lado($combate->userB),
            'puntos_a'       => $combate->puntos_a,
            'puntos_b'       => $combate->puntos_b,
            'faltas_a'       => $combate->faltas_a,
            'faltas_b'       => $combate->faltas_b,
            'falta_grave_a'  => (bool) $combate->falta_grave_a,
            'falta_grave_b'  => (bool) $combate->falta_grave_b,
            'ganador_id'     => $combate->ganador_id,
        ];
    }
}
