<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Temporada;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class TemporadaController extends Controller
{
    public function index(): JsonResponse
    {
        $temporadas = Temporada::with([
            'primerLugar.character',
            'segundoLugar.character',
            'tercerLugar.character',
            'recompensas',
        ])->orderByDesc('periodo_inicio')->get();

        return response()->json(['temporadas' => $temporadas->map(fn($t) => $this->format($t))]);
    }

    public function show(Temporada $temporada): JsonResponse
    {
        $temporada->load([
            'primerLugar.character', 'segundoLugar.character',
            'tercerLugar.character', 'recompensas',
        ]);
        return response()->json(['temporada' => $this->format($temporada)]);
    }

    public function store(Request $request): JsonResponse
    {
        $this->requireTutor($request);

        $data = $request->validate([
            'nombre'                    => 'required|string|max:100',
            'descripcion'               => 'nullable|string',
            'foto_emblema'              => 'nullable|string',
            'periodo_inicio'            => 'required|date',
            'periodo_fin'               => 'required|date|after:periodo_inicio',
            'primer_lugar_id'           => 'nullable|integer|exists:users,id',
            'segundo_lugar_id'          => 'nullable|integer|exists:users,id',
            'tercer_lugar_id'           => 'nullable|integer|exists:users,id',
            'recompensas'               => 'nullable|array',
            'recompensas.*.nombre'      => 'required|string|max:100',
            'recompensas.*.descripcion' => 'nullable|string',
            'recompensas.*.creditos'    => 'nullable|integer|min:0',
            'recompensas.*.experiencia' => 'nullable|integer|min:0',
            'recompensas.*.medalla_id'  => 'nullable|string|max:60',
        ]);

        $recompensas = $data['recompensas'] ?? [];
        unset($data['recompensas']);

        $temporada = Temporada::create($data);
        foreach ($recompensas as $r) {
            $temporada->recompensas()->create($r);
        }

        return response()->json([
            'temporada' => $this->format(
                $temporada->load(['primerLugar.character', 'segundoLugar.character', 'tercerLugar.character', 'recompensas'])
            ),
        ], 201);
    }

    public function update(Request $request, Temporada $temporada): JsonResponse
    {
        $this->requireTutor($request);

        $data = $request->validate([
            'nombre'                    => 'required|string|max:100',
            'descripcion'               => 'nullable|string',
            'foto_emblema'              => 'nullable|string',
            'periodo_inicio'            => 'required|date',
            'periodo_fin'               => 'required|date|after:periodo_inicio',
            'primer_lugar_id'           => 'nullable|integer|exists:users,id',
            'segundo_lugar_id'          => 'nullable|integer|exists:users,id',
            'tercer_lugar_id'           => 'nullable|integer|exists:users,id',
            'recompensas'               => 'nullable|array',
            'recompensas.*.nombre'      => 'required|string|max:100',
            'recompensas.*.descripcion' => 'nullable|string',
            'recompensas.*.creditos'    => 'nullable|integer|min:0',
            'recompensas.*.experiencia' => 'nullable|integer|min:0',
            'recompensas.*.medalla_id'  => 'nullable|string|max:60',
        ]);

        $recompensas = $data['recompensas'] ?? [];
        unset($data['recompensas']);

        $temporada->update($data);
        $temporada->recompensas()->delete();
        foreach ($recompensas as $r) {
            $temporada->recompensas()->create($r);
        }

        return response()->json([
            'temporada' => $this->format(
                $temporada->load(['primerLugar.character', 'segundoLugar.character', 'tercerLugar.character', 'recompensas'])
            ),
        ]);
    }

    private function requireTutor(Request $request): void
    {
        $tier = $request->user()->tier ?? 'iniciado';
        if (!in_array($tier, ['maestro', 'granmaestro'])) {
            abort(403, 'Solo los tutores pueden gestionar temporadas.');
        }
    }

    private function format(Temporada $t): array
    {
        $fmtUser = fn(?User $u) => $u ? [
            'id'       => $u->id,
            'name'     => $u->character?->name ?? $u->name,
            'handle'   => $u->character?->handle ?? '',
            'tier'     => $u->tier ?? 'iniciado',
            'initials' => strtoupper(substr($u->character?->handle ?? $u->name ?? '?', 0, 2)),
        ] : null;

        $emblemaUrl = $t->foto_emblema
            ? url('storage/' . $t->foto_emblema) . '?v=' . ($t->updated_at?->timestamp ?? 0)
            : null;

        return [
            'id'             => $t->id,
            'nombre'         => $t->nombre,
            'descripcion'    => $t->descripcion,
            'foto_emblema'   => $emblemaUrl,
            'foto_path'      => $t->foto_emblema,
            'periodo_inicio' => $t->periodo_inicio?->format('Y-m-d'),
            'periodo_fin'    => $t->periodo_fin?->format('Y-m-d'),
            'activa'         => now()->between($t->periodo_inicio, $t->periodo_fin),
            'primer_lugar'   => $fmtUser($t->primerLugar),
            'segundo_lugar'  => $fmtUser($t->segundoLugar),
            'tercer_lugar'   => $fmtUser($t->tercerLugar),
            'primer_lugar_id'  => $t->primer_lugar_id,
            'segundo_lugar_id' => $t->segundo_lugar_id,
            'tercer_lugar_id'  => $t->tercer_lugar_id,
            'recompensas'    => $t->recompensas->map(fn($r) => [
                'id'          => $r->id,
                'nombre'      => $r->nombre,
                'descripcion' => $r->descripcion,
                'creditos'    => $r->creditos,
                'experiencia' => $r->experiencia,
                'medalla_id'  => $r->medalla_id,
            ])->values(),
        ];
    }
}
