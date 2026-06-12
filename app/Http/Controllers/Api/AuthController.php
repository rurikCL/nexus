<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;
use Illuminate\Validation\Rules\Password;

class AuthController extends Controller
{
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

        $user->load('character');
        $character = $user->character;

        return response()->json([
            'token' => $token,
            'user'  => [
                'id'        => $user->id,
                'name'      => $user->name,
                'email'     => $user->email,
                'tier'      => $user->tier,
                'is_tutor'  => $user->isTutor(),
                'character' => $character ? [
                    'handle'      => $character->handle,
                    'cls'         => $character->cls,
                    'saber_color' => $character->saber_color,
                    'side'        => $character->side,
                    'wins'        => $character->wins,
                    'losses'      => $character->losses,
                    'credits'     => $character->credits,
                ] : null,
            ],
        ]);
    }

    public function register(Request $request): JsonResponse
    {
        $request->validate([
            'name'     => 'required|string|max:100',
            'email'    => 'required|email|unique:users,email',
            'password' => ['required', 'confirmed', Password::min(8)],
        ]);

        $user = User::create([
            'name'     => $request->name,
            'email'    => $request->email,
            'password' => Hash::make($request->password),
            'tier'     => 'iniciado',
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
