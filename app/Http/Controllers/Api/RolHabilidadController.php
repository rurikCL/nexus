<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\RolHabilidad;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Storage;

class RolHabilidadController extends Controller
{
    public function index(\Illuminate\Http\Request $request): JsonResponse
    {
        $query = RolHabilidad::orderBy('forma')->orderBy('nombre');

        if ($request->boolean('aprendidas')) {
            $user       = $request->user();
            $aprendidasIds = $user->habilidadesAprendidas()->pluck('habilidad_id')->toArray();
            $query->whereIn('id', $aprendidasIds);
        }

        $habilidades = $query->get()->map(fn($h) => array_merge($h->toArray(), [
            'icono_url' => $h->icono ? Storage::disk('public')->url($h->icono) : null,
        ]));

        return response()->json(['habilidades' => $habilidades]);
    }
}
