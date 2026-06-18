<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\MapSistema;
use App\Models\MapPlaneta;
use App\Models\MapZona;
use App\Models\MapLugar;
use App\Models\MapNpc;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class MapController extends Controller
{
    private function presentes(string $fk): \Closure
    {
        return fn($q) => $q->select('id', $fk, 'handle', 'photo', 'saber_color');
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
        $character = $request->user()?->character;
        if (! $character) {
            return response()->json(['ok' => false], 404);
        }

        $character->update([
            'map_sistema_id' => $request->input('sistema_id'),
            'map_planeta_id' => $request->input('planeta_id'),
            'map_zona_id'    => $request->input('zona_id'),
            'map_lugar_id'   => $request->input('lugar_id'),
        ]);

        return response()->json(['ok' => true]);
    }

    public function npc(int $id): JsonResponse
    {
        $npc = MapNpc::where('visible', true)
            ->with('lugar.zona.planeta.sistema')
            ->findOrFail($id);

        return response()->json(['npc' => $npc]);
    }
}
