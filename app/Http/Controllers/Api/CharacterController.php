<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class CharacterController extends Controller
{
    public function upsert(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name'        => 'required|string|max:255',
            'handle'      => 'required|string|max:20',
            'bio'         => 'nullable|string',
            'cls'         => 'required|in:vanguardia,espectro,titan,oraculo',
            'saber_color' => 'nullable|string',
            'sector'      => 'nullable|string',
            'sponsor'     => 'nullable|string',
            'joined_year' => 'nullable|digits:4|integer',
            'stats'       => 'nullable|array',
            'stats.fuerza'    => 'nullable|integer|min:0|max:100',
            'stats.velocidad' => 'nullable|integer|min:0|max:100',
            'stats.tecnica'   => 'nullable|integer|min:0|max:100',
            'stats.defensa'   => 'nullable|integer|min:0|max:100',
            'stats.foco'      => 'nullable|integer|min:0|max:100',
            'gold'        => 'nullable|boolean',
        ]);

        $user = $request->user();

        // Validate handle uniqueness excluding current user's character
        $handleQuery = \App\Models\Character::where('handle', $data['handle']);
        if ($user->character) {
            $handleQuery->where('id', '!=', $user->character->id);
        }
        if ($handleQuery->exists()) {
            return response()->json(['message' => 'El handle ya está en uso.'], 422);
        }

        $defaultStats = ['fuerza' => 50, 'velocidad' => 50, 'tecnica' => 50, 'defensa' => 50, 'foco' => 50];

        $character = $user->character()->updateOrCreate(
            ['user_id' => $user->id],
            array_merge([
                'saber_color' => 'azul',
                'gold'        => false,
                'stats'       => $defaultStats,
            ], $data)
        );

        return response()->json([
            'character' => $character->append(['tier', 'winrate']),
        ], $user->wasRecentlyCreated ? 201 : 200);
    }
}
