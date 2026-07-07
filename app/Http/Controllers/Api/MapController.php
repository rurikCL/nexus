<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\MapSistema;
use App\Models\MapPlaneta;
use App\Models\MapZona;
use App\Models\MapLugar;
use App\Models\MapNpc;
use App\Models\Mision;
use App\Models\PvpCombat;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;

class MapController extends Controller
{
    private function presentes(string $fk): \Closure
    {
        return fn($q) => $q->select('id', $fk, 'user_id', 'handle', 'photo', 'saber_color');
    }

    public function sistemas(): JsonResponse
    {
        $sistemas = MapSistema::where('visible', true)
            ->withCount('planetas')
            ->with(['presentesPersonajes' => $this->presentes('map_sistema_id')])
            ->orderBy('nombre')
            ->get();

        return response()->json(['sistemas' => $sistemas]);
    }

    public function sistema(int $id): JsonResponse
    {
        $sistema = MapSistema::where('visible', true)
            ->with([
                'presentesPersonajes' => $this->presentes('map_sistema_id'),
                'planetas' => fn($q) => $q->where('visible', true)
                    ->with(['presentesPersonajes' => $this->presentes('map_planeta_id')]),
            ])
            ->findOrFail($id);

        return response()->json(['sistema' => $sistema]);
    }

    public function planeta(int $id): JsonResponse
    {
        $planeta = MapPlaneta::where('visible', true)
            ->with([
                'sistema',
                'presentesPersonajes' => $this->presentes('map_planeta_id'),
                'zonas' => fn($q) => $q->where('visible', true)
                    ->with(['presentesPersonajes' => $this->presentes('map_zona_id')]),
            ])
            ->findOrFail($id);

        return response()->json(['planeta' => $planeta]);
    }

    public function zona(int $id): JsonResponse
    {
        $zona = MapZona::where('visible', true)
            ->with([
                'planeta.sistema',
                'presentesPersonajes' => $this->presentes('map_zona_id'),
                'lugares' => fn($q) => $q->where('visible', true)
                    ->with(['presentesPersonajes' => $this->presentes('map_lugar_id')]),
            ])
            ->findOrFail($id);

        return response()->json(['zona' => $zona]);
    }

    public function lugar(Request $request, int $id): JsonResponse
    {
        $lugar = MapLugar::where('visible', true)
            ->with([
                'zona.planeta.sistema',
                'npcs'                => fn($q) => $q->where('visible', true),
                'norte:id,nombre',
                'sur:id,nombre',
                'este:id,nombre',
                'oeste:id,nombre',
                'presentesPersonajes' => $this->presentes('map_lugar_id'),
            ])
            ->findOrFail($id);

        $characterHitos = $request->user()?->character
            ? $request->user()->character->hitos()->pluck('hito')->all()
            : [];

        $npcsDisponibles = $lugar->npcs->filter(fn (MapNpc $npc) => $this->npcCumpleRequisitos($npc, $characterHitos))->values();
        $lugar->setRelation('npcs', $this->attachMisionInfo($npcsDisponibles, $request->user()));

        $character = $request->user()?->character;
        $requiredPassId = $lugar->pase;

        if ($requiredPassId && $character) {
            $hasPass = $character->rolObjetos()
                ->where('rol_objetos.id', $requiredPassId)
                ->exists();

            if (! $hasPass) {
                return response()->json([
                    'message' => 'No posees el objeto requerido para entrar a este lugar.',
                    'required_pass_id' => $requiredPassId,
                ], 403);
            }
        }

        if ($requiredPassId && ! $character) {
            return response()->json([
                'message' => 'No posees el objeto requerido para entrar a este lugar.',
                'required_pass_id' => $requiredPassId,
            ], 403);
        }

        return response()->json(['lugar' => $lugar]);
    }

    public function updateLocation(Request $request): JsonResponse
    {
        $user = $request->user();
        $character = $user?->character;
        if (! $character) {
            return response()->json(['ok' => false], 404);
        }

        $activeCombat = PvpCombat::where('status', 'active')
            ->where(fn($q) => $q->where('attacker_id', $user->id)->orWhere('defender_id', $user->id))
            ->exists();

        if ($activeCombat) {
            return response()->json([
                'ok'      => false,
                'blocked' => true,
                'message' => 'No puedes moverte mientras tienes un combate activo.',
            ], 422);
        }

        $character->update([
            'map_sistema_id' => $request->input('sistema_id'),
            'map_planeta_id' => $request->input('planeta_id'),
            'map_zona_id'    => $request->input('zona_id'),
            'map_lugar_id'   => $request->input('lugar_id'),
        ]);

        return response()->json(['ok' => true]);
    }

    public function npc(Request $request, int $id): JsonResponse
    {
        $npc = MapNpc::where('visible', true)
            ->with('lugar.zona.planeta.sistema')
            ->findOrFail($id);

        $characterHitos = $request->user()?->character
            ? $request->user()->character->hitos()->pluck('hito')->all()
            : [];

        if (! $this->npcCumpleRequisitos($npc, $characterHitos)) {
            abort(404);
        }

        $npc = $this->attachMisionInfo(collect([$npc]), $request->user())->first();

        return response()->json(['npc' => $npc]);
    }

    /**
     * Determina si un NPC debe aparecer para el personaje: cumple el/los hito(s)
     * requeridos (si tiene) y está dentro del rango de fechas configurado (si tiene).
     */
    private function npcCumpleRequisitos(MapNpc $npc, array $characterHitos): bool
    {
        if ($npc->hito_requerimiento) {
            $requeridos = array_filter(array_map('trim', explode(',', $npc->hito_requerimiento)));
            if (! empty(array_diff($requeridos, $characterHitos))) {
                return false;
            }
        }

        $hoy = now()->toDateString();

        if ($npc->fecha_inicio && $hoy < $npc->fecha_inicio->toDateString()) {
            return false;
        }

        if ($npc->fecha_fin && $hoy > $npc->fecha_fin->toDateString()) {
            return false;
        }

        return true;
    }

    /**
     * Adjunta a cada NPC la misión individual activa que ofrece (misiones.npc_id),
     * junto con el estado de esa misión para el usuario autenticado.
     */
    private function attachMisionInfo(Collection $npcs, ?User $user): Collection
    {
        $npcIds = $npcs->pluck('id');

        $misionesPorNpc = Mision::whereIn('npc_id', $npcIds)
            ->where('activa', true)
            ->with(['objetivos', 'recompensas.habilidad', 'recompensas.objeto'])
            ->orderBy('orden')
            ->get()
            ->groupBy('npc_id');

        $misionIds = $misionesPorNpc->flatten()->pluck('id');

        $pivots = ($user && $misionIds->isNotEmpty())
            ? \DB::table('mision_user')->where('user_id', $user->id)->whereIn('mision_id', $misionIds)->get()->keyBy('mision_id')
            : collect();

        $characterHitos = $user?->character
            ? $user->character->hitos()->pluck('hito')->all()
            : [];

        return $npcs->map(function (MapNpc $npc) use ($misionesPorNpc, $pivots, $characterHitos) {
            $mision = $misionesPorNpc->get($npc->id)?->first();

            if (! $mision) {
                $npc->setAttribute('mision_disponible', null);
                return $npc;
            }

            $pivot = $pivots->get($mision->id);
            $requeridos = $mision->hito_requerimiento
                ? array_filter(array_map('trim', explode(',', $mision->hito_requerimiento)))
                : [];
            $cumpleHitos = empty(array_diff($requeridos, $characterHitos));

            $npc->setAttribute('mision_disponible', [
                'id'                 => $mision->id,
                'nombre'             => $mision->nombre,
                'mision'             => $mision->mision,
                'descripcion'        => $mision->descripcion,
                'foto_mision'        => $mision->foto_mision,
                'hito_requerimiento' => $mision->hito_requerimiento,
                'entregar_hito'      => $mision->entregar_hito,
                'objetivos'          => $mision->objetivos->map(fn ($o) => [
                    'id'          => $o->id,
                    'nombre'      => $o->nombre,
                    'descripcion' => $o->descripcion,
                    'tipo'        => $o->tipo,
                    'meta'        => $o->meta,
                    'unidad'      => $o->unidad,
                ])->values(),
                'recompensas'        => $mision->recompensas->map(fn ($r) => [
                    'id'          => $r->id,
                    'nombre'      => $r->nombre,
                    'descripcion' => $r->descripcion,
                    'tipo'        => $r->tipo,
                    'valor'       => $r->valor,
                    'imagen'      => $r->imagen,
                    'habilidad'   => $r->habilidad ? ['id' => $r->habilidad->id, 'nombre' => $r->habilidad->nombre] : null,
                    'objeto'      => $r->objeto ? ['id' => $r->objeto->id, 'nombre' => $r->objeto->nombre, 'imagen' => $r->objeto->imagen] : null,
                ])->values(),
                'estado'             => $pivot->status ?? null,
                'puede_completar'    => (bool) ($pivot && $pivot->status !== 'completada' && $cumpleHitos),
            ]);

            return $npc;
        });
    }
}
