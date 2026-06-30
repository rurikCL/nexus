<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\RolHabilidad;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Storage;

class RolHabilidadController extends Controller
{
    public function index(): JsonResponse
    {
        $habilidades = RolHabilidad::orderBy('forma')->orderBy('nombre')->get()
            ->map(fn($h) => array_merge($h->toArray(), [
                'icono_url' => $h->icono ? Storage::disk('public')->url($h->icono) : null,
            ]));

        return response()->json(['habilidades' => $habilidades]);
    }
}
