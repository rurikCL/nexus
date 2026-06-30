<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\RolHabilidad;
use Illuminate\Http\JsonResponse;

class RolHabilidadController extends Controller
{
    public function index(): JsonResponse
    {
        $habilidades = RolHabilidad::orderBy('forma')->orderBy('nombre')->get();

        return response()->json(['habilidades' => $habilidades]);
    }
}
