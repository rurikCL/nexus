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
            'vida'        => 'nullable|integer|min:0|max:9999',
            'escudo'      => 'nullable|integer|min:0|max:9999',
            'defensa'     => 'nullable|integer|min:0|max:9999',
            'ataque'      => 'nullable|integer|min:0|max:9999',
            'movimiento'  => 'nullable|integer|min:0|max:9999',
            'iniciativa'  => 'nullable|integer|min:0|max:9999',
            'punteria'      => 'nullable|integer|min:0|max:9999',
            'puntos_libres' => 'nullable|integer|min:0|max:9999',
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
                'saber_color'   => 'azul',
                'gold'          => false,
                'stats'         => $defaultStats,
                'vida'          => 8,
                'escudo'        => 4,
                'defensa'       => 2,
                'ataque'        => 2,
                'movimiento'    => 2,
                'iniciativa'    => 2,
                'punteria'      => 2,
                'puntos_libres' => 5,
            ], $data)
        );

        return response()->json([
            'character' => $character->append(['winrate']),
        ], $character->wasRecentlyCreated ? 201 : 200);
    }

    public function updateHabilidades(Request $request): JsonResponse
    {
        $data = $request->validate([
            'forma'    => 'required|integer|min:1|max:7',
            'slots'    => 'required|array',
            'slots.*'  => 'nullable|exists:rol_habilidades,id',
        ]);

        $character = $request->user()->character;
        if (!$character) {
            return response()->json(['error' => 'Sin personaje'], 404);
        }

        $formaSlots     = is_array($character->habilidades_por_forma) ? $character->habilidades_por_forma : [];
        $slots          = $data['slots'];
        $normalized     = [(string)1 => null, (string)2 => null, (string)3 => null, (string)4 => null];
        foreach ($slots as $k => $v) {
            if (array_key_exists((string)$k, $normalized)) {
                $normalized[(string)$k] = $v ? (int)$v : null;
            }
        }
        $formaSlots[(string)$data['forma']] = array_values($normalized);
        $character->habilidades_por_forma   = $formaSlots;
        $character->current_forma           = $data['forma'];
        $character->save();

        return response()->json(['ok' => true]);
    }

    public function equiparArma(Request $request): JsonResponse
    {
        $data = $request->validate([
            'rol_objeto_id' => 'nullable|integer|exists:rol_objetos,id',
        ]);

        $character = $request->user()->character;
        if (!$character) {
            return response()->json(['error' => 'Sin personaje'], 404);
        }

        $armaId = $data['rol_objeto_id'] ?? null;

        if ($armaId) {
            $objeto = $character->rolObjetos()->where('rol_objetos.id', $armaId)->first();
            if (!$objeto) {
                return response()->json(['error' => 'No posees ese objeto'], 403);
            }
            if ($objeto->tipo !== 'arma') {
                return response()->json(['error' => 'Ese objeto no es un arma'], 422);
            }
        }

        $character->arma_equipada_id = $armaId;
        $character->save();

        return response()->json(['arma_equipada' => $character->armaEquipada()->first()]);
    }

    public function aprenderHabilidad(Request $request): JsonResponse
    {
        $data = $request->validate([
            'habilidad_id' => 'required|exists:rol_habilidades,id',
        ]);

        $user = $request->user();
        $user->habilidadesAprendidas()->syncWithoutDetaching([$data['habilidad_id']]);

        return response()->json(['ok' => true]);
    }

    public function updateReputation(Request $request): JsonResponse
    {
        $data = $request->validate([
            'delta' => 'required|integer|min:-1000|max:1000',
        ]);

        $character = $request->user()->character;
        if (!$character) {
            return response()->json(['error' => 'Sin personaje'], 404);
        }

        $character->reputation = ($character->reputation ?? 0) + $data['delta'];
        $character->save();

        return response()->json(['reputation' => $character->reputation]);
    }

    public function npcVictory(Request $request): JsonResponse
    {
        $data = $request->validate([
            'npc_id' => 'required|integer|exists:map_npcs,id',
        ]);

        $character = $request->user()->character;
        if (!$character) {
            return response()->json(['error' => 'Sin personaje'], 404);
        }

        $npc = \App\Models\MapNpc::withTrashed()->findOrFail($data['npc_id']);
        $hito = "{$npc->nombre} derrotado";

        \App\Models\CharacterHito::firstOrCreate([
            'character_id' => $character->id,
            'hito'         => $hito,
        ]);

        return response()->json(['hito' => $hito]);
    }
}
