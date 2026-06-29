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
            'lore'        => 'nullable|string',
            'cls'         => 'required|in:forma1,forma2,forma3,forma4,forma5,forma6,forma7',
            'saber_color' => 'nullable|string',
            'side'        => 'nullable|in:luminoso,oscuro',
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
            'grado'       => 'nullable|integer|min:1|max:5',
            'clase'       => 'nullable|string|in:Sentinela,Guardian,Consul',
            'tier'        => 'nullable|string|in:iniciado,padawan,caballero,maestro,granmaestro',
            'tutor_id'    => 'nullable|exists:users,id',
        ]);

        $user = $request->user();

        $canEditRango = in_array($user->tier, ['caballero', 'maestro', 'granmaestro']);

        // Guardar grado, clase, tier y tutor_id en el usuario (no en el personaje)
        $userUpdate = [];
        if (array_key_exists('grado', $data)) {
            $userUpdate['grado'] = ($user->tier === 'caballero') ? $data['grado'] : null;
        }
        if (array_key_exists('clase', $data)) {
            $userUpdate['clase'] = $data['clase'];
        }
        if (array_key_exists('tier', $data) && $canEditRango) {
            $userUpdate['tier'] = $data['tier'];
        }
        if (array_key_exists('tutor_id', $data)) {
            $userUpdate['tutor_id'] = $data['tutor_id'];
        }
        if (!empty($userUpdate)) {
            $user->update($userUpdate);
        }
        unset($data['grado'], $data['clase'], $data['tier'], $data['tutor_id']);

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
            'character' => $character->append(['winrate']),
        ], $character->wasRecentlyCreated ? 201 : 200);
    }
}
