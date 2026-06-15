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

class MapController extends Controller
{
    public function sistemas(): JsonResponse
    {
        $sistemas = MapSistema::where('visible', true)
            ->withCount('planetas')
            ->orderBy('nombre')
            ->get();

        return response()->json(['sistemas' => $sistemas]);
    }

    public function sistema(int $id): JsonResponse
    {
        $sistema = MapSistema::where('visible', true)
            ->with(['planetas' => fn($q) => $q->where('visible', true)])
            ->findOrFail($id);

        return response()->json(['sistema' => $sistema]);
    }

    public function planeta(int $id): JsonResponse
    {
        $planeta = MapPlaneta::where('visible', true)
            ->with([
                'sistema',
                'zonas' => fn($q) => $q->where('visible', true),
            ])
            ->findOrFail($id);

        return response()->json(['planeta' => $planeta]);
    }

    public function zona(int $id): JsonResponse
    {
        $zona = MapZona::where('visible', true)
            ->with([
                'planeta.sistema',
                'lugares' => fn($q) => $q->where('visible', true),
            ])
            ->findOrFail($id);

        return response()->json(['zona' => $zona]);
    }

    public function lugar(int $id): JsonResponse
    {
        $lugar = MapLugar::where('visible', true)
            ->with([
                'zona.planeta.sistema',
                'npcs' => fn($q) => $q->where('visible', true),
                'norte:id,nombre',
                'sur:id,nombre',
                'este:id,nombre',
                'oeste:id,nombre',
            ])
            ->findOrFail($id);

        return response()->json(['lugar' => $lugar]);
    }

    public function npc(int $id): JsonResponse
    {
        $npc = MapNpc::where('visible', true)
            ->with('lugar.zona.planeta.sistema')
            ->findOrFail($id);

        return response()->json(['npc' => $npc]);
    }
}
