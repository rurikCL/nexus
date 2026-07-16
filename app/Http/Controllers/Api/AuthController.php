<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Sede;
use App\Models\StatsTemporada;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;
use Illuminate\Validation\Rules\Password;

class AuthController extends Controller
{
    /** GET /public/sedes — para el selector de sede en el formulario de registro (sin auth). */
    public function sedes(): JsonResponse
    {
        $sedes = Sede::where('activa', true)->orderBy('nombre')->get()->map(fn ($s) => [
            'id' => $s->id,
            'nombre' => $s->nombre,
            'ubicacion' => $s->ubicacion,
            'pais' => $s->pais,
            'region' => $s->region,
            'imagen_url' => $s->imagen ? Storage::disk('public')->url($s->imagen) : null,
        ]);

        return response()->json(['sedes' => $sedes]);
    }

    public function login(Request $request): JsonResponse
    {
        $request->validate([
            'email'    => 'required|email',
            'password' => 'required',
        ]);

        $user = User::where('email', $request->email)->first();

        if (!$user || !Hash::check($request->password, $user->password)) {
            throw ValidationException::withMessages([
                'email' => ['Las credenciales son incorrectas.'],
            ]);
        }

        $token = $user->createToken('nexus-api')->plainTextToken;

        $user->load('character', 'roles');
        $character = $user->character;

        return response()->json([
            'token' => $token,
            'user'  => [
                'id'        => $user->id,
                'name'      => $user->name,
                'email'     => $user->email,
                'tier'      => $user->tier,
                'is_tutor'  => $user->isTutor(),
                'roles'     => $user->roles->pluck('name'),
                'character' => $character ? array_merge([
                    'handle'      => $character->handle,
                    'cls'         => $character->cls,
                    'saber_color' => $character->saber_color,
                    'side'        => $character->side,
                    'credits'     => $character->credits,
                ], StatsTemporada::totalsForUser($user->id)) : null,
            ],
        ]);
    }

    public function register(Request $request): JsonResponse
    {
        $request->validate([
            'name'     => 'required|string|max:100',
            'email'    => 'required|email|unique:users,email',
            'password' => ['required', 'confirmed', Password::min(8)],
            'sede_id'  => 'required|integer|exists:sedes,id',
        ]);

        $user = User::create([
            'name'     => $request->name,
            'email'    => $request->email,
            'password' => Hash::make($request->password),
            'tier'     => 'iniciado',
            'sede_id'  => $request->sede_id,
        ]);

        $token = $user->createToken('nexus-api')->plainTextToken;

        return response()->json([
            'token' => $token,
            'user'  => [
                'id'       => $user->id,
                'name'     => $user->name,
                'email'    => $user->email,
                'tier'     => $user->tier,
                'is_tutor' => false,
                'character'=> null,
            ],
        ], 201);
    }

    public function logout(Request $request): JsonResponse
    {
        $request->user()->currentAccessToken()->delete();

        return response()->json(['message' => 'Sesión cerrada.']);
    }
}
