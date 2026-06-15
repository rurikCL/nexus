<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\StatsTemporada;
use App\Models\Temporada;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class TemporadaController extends Controller
{
    private const RANGOS = ['iniciado', 'padawan', 'caballero', 'maestro', 'granmaestro'];

    private function eagerLoads(): array
    {
        return [
            'primerLugar.character', 'segundoLugar.character', 'tercerLugar.character',
            'recompensas',
            'podios.primerLugar.character',
            'podios.segundoLugar.character',
            'podios.tercerLugar.character',
        ];
    }

    public function index(): JsonResponse
    {
        $temporadas = Temporada::with($this->eagerLoads())
            ->orderByDesc('periodo_inicio')->get();

        return response()->json(['temporadas' => $temporadas->map(fn($t) => $this->format($t))]);
    }

    public function show(Temporada $temporada): JsonResponse
    {
        $temporada->load($this->eagerLoads());
        return response()->json(['temporada' => $this->format($temporada)]);
    }

    public function store(Request $request): JsonResponse
    {
        $this->requireTutor($request);

        $data = $request->validate($this->rules());

        [$recompensas, $podios, $data] = $this->extractRelations($data);

        $temporada = Temporada::create($data);
        $this->syncRelations($temporada, $recompensas, $podios, $data['divide_por_rango'] ?? false);

        return response()->json([
            'temporada' => $this->format($temporada->load($this->eagerLoads())),
        ], 201);
    }

    public function update(Request $request, Temporada $temporada): JsonResponse
    {
        $this->requireTutor($request);

        $data = $request->validate($this->rules());

        [$recompensas, $podios, $data] = $this->extractRelations($data);

        $temporada->update($data);
        $temporada->recompensas()->delete();
        $temporada->podios()->delete();
        $this->syncRelations($temporada, $recompensas, $podios, $data['divide_por_rango'] ?? false);

        return response()->json([
            'temporada' => $this->format($temporada->load($this->eagerLoads())),
        ]);
    }

    // ── Helpers ────────────────────────────────────────────────

    private function rules(): array
    {
        return [
            'nombre'                    => 'required|string|max:100',
            'descripcion'               => 'nullable|string',
            'foto_emblema'              => 'nullable|string',
            'divide_por_rango'          => 'boolean',
            'asignacion_automatica'     => 'boolean',
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
            'podios'                        => 'nullable|array',
            'podios.*.rango'                => 'required|string|in:' . implode(',', self::RANGOS),
            'podios.*.primer_lugar_id'      => 'nullable|integer|exists:users,id',
            'podios.*.segundo_lugar_id'     => 'nullable|integer|exists:users,id',
            'podios.*.tercer_lugar_id'      => 'nullable|integer|exists:users,id',
        ];
    }

    private function extractRelations(array $data): array
    {
        $recompensas = $data['recompensas'] ?? [];
        $podios      = $data['podios']      ?? [];
        unset($data['recompensas'], $data['podios']);
        return [$recompensas, $podios, $data];
    }

    private function syncRelations(Temporada $temporada, array $recompensas, array $podios, bool $dividePorRango): void
    {
        foreach ($recompensas as $r) {
            $temporada->recompensas()->create($r);
        }

        if ($dividePorRango) {
            foreach ($podios as $p) {
                $temporada->podios()->create([
                    'rango'            => $p['rango'],
                    'primer_lugar_id'  => $p['primer_lugar_id']  ?: null,
                    'segundo_lugar_id' => $p['segundo_lugar_id'] ?: null,
                    'tercer_lugar_id'  => $p['tercer_lugar_id']  ?: null,
                ]);
            }
        }
    }

    private function requireTutor(Request $request): void
    {
        if (!in_array($request->user()->tier ?? 'iniciado', ['maestro', 'granmaestro'])) {
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

        $auto = $t->asignacion_automatica ?? true;

        // Podio global (manual o auto)
        if ($auto) {
            $topGlobal = StatsTemporada::where('temporada_id', $t->id)
                ->orderByDesc('wins')->orderByDesc('streak')
                ->limit(3)->with('user.character')->get();
            $primerLugar  = $fmtUser($topGlobal[0]?->user ?? null);
            $segundoLugar = $fmtUser($topGlobal[1]?->user ?? null);
            $tercerLugar  = $fmtUser($topGlobal[2]?->user ?? null);
            $primerLugarId  = $topGlobal[0]?->user_id;
            $segundoLugarId = $topGlobal[1]?->user_id;
            $tercerLugarId  = $topGlobal[2]?->user_id;
        } else {
            $primerLugar  = $fmtUser($t->primerLugar);
            $segundoLugar = $fmtUser($t->segundoLugar);
            $tercerLugar  = $fmtUser($t->tercerLugar);
            $primerLugarId  = $t->primer_lugar_id;
            $segundoLugarId = $t->segundo_lugar_id;
            $tercerLugarId  = $t->tercer_lugar_id;
        }

        // Podio por rango (manual o auto)
        if ($t->divide_por_rango) {
            if ($auto) {
                $podios = collect(self::RANGOS)->map(function ($rango) use ($t, $fmtUser) {
                    $top = StatsTemporada::where('temporada_id', $t->id)
                        ->whereHas('user', fn($q) => $q->where('tier', $rango))
                        ->orderByDesc('wins')->orderByDesc('streak')
                        ->limit(3)->with('user.character')->get();
                    return [
                        'rango'            => $rango,
                        'primer_lugar'     => $fmtUser($top[0]?->user ?? null),
                        'segundo_lugar'    => $fmtUser($top[1]?->user ?? null),
                        'tercer_lugar'     => $fmtUser($top[2]?->user ?? null),
                        'primer_lugar_id'  => $top[0]?->user_id,
                        'segundo_lugar_id' => $top[1]?->user_id,
                        'tercer_lugar_id'  => $top[2]?->user_id,
                    ];
                })->filter(fn($p) => $p['primer_lugar'] !== null)->values();
            } else {
                $podios = $t->podios->map(fn($p) => [
                    'rango'            => $p->rango,
                    'primer_lugar'     => $fmtUser($p->primerLugar),
                    'segundo_lugar'    => $fmtUser($p->segundoLugar),
                    'tercer_lugar'     => $fmtUser($p->tercerLugar),
                    'primer_lugar_id'  => $p->primer_lugar_id,
                    'segundo_lugar_id' => $p->segundo_lugar_id,
                    'tercer_lugar_id'  => $p->tercer_lugar_id,
                ])->values();
            }
        } else {
            $podios = collect();
        }

        return [
            'id'                    => $t->id,
            'nombre'                => $t->nombre,
            'descripcion'           => $t->descripcion,
            'foto_emblema'          => $emblemaUrl,
            'foto_path'             => $t->foto_emblema,
            'divide_por_rango'      => $t->divide_por_rango,
            'asignacion_automatica' => $auto,
            'periodo_inicio'        => $t->periodo_inicio?->format('Y-m-d'),
            'periodo_fin'           => $t->periodo_fin?->format('Y-m-d'),
            'activa'                => now()->between($t->periodo_inicio, $t->periodo_fin),
            'primer_lugar'          => $primerLugar,
            'segundo_lugar'         => $segundoLugar,
            'tercer_lugar'          => $tercerLugar,
            'primer_lugar_id'       => $primerLugarId,
            'segundo_lugar_id'      => $segundoLugarId,
            'tercer_lugar_id'       => $tercerLugarId,
            'podios'                => $podios,
            'recompensas'      => $t->recompensas->map(fn($r) => [
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
