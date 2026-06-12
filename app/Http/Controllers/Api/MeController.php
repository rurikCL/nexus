<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class MeController extends Controller
{
    public function show(Request $request): JsonResponse
    {
        $user = $request->user()->load('character');
        $character = $user->character;

        return response()->json([
            'id'        => $user->id,
            'name'      => $user->name,
            'email'     => $user->email,
            'is_tutor'  => $user->isTutor(),
            'character' => $character ? [
                'id'          => $character->id,
                'handle'      => $character->handle,
                'name'        => $character->name,
                'bio'         => $character->bio,
                'cls'         => $character->cls,
                'saber_color' => $character->saber_color,
                'sector'      => $character->sector,
                'sponsor'     => $character->sponsor,
                'joined_year' => $character->joined_year,
                'credits'     => $character->credits,
                'wins'        => $character->wins,
                'losses'      => $character->losses,
                'streak'      => $character->streak,
                'stats'       => $character->stats,
                'gold'        => $character->gold,
                'tier'        => $character->tier,
                'winrate'     => $character->winrate,
            ] : null,
        ]);
    }
}
