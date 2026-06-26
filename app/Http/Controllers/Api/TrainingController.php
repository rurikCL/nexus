<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\TrainingDay;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class TrainingController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $month = $request->query('month', now()->format('Y-m'));

        try {
            $start = Carbon::createFromFormat('Y-m', $month)->startOfMonth();
            $end   = $start->copy()->endOfMonth();
        } catch (\Exception $e) {
            return response()->json(['message' => 'Formato de mes inválido. Use YYYY-MM.'], 422);
        }

        $days = $request->user()->trainingDays()
            ->with('media')
            ->whereBetween('date', [$start->toDateString(), $end->toDateString()])
            ->orderBy('date')
            ->get()
            ->keyBy(fn($d) => $d->date->format('Y-m-d'));

        return response()->json([
            'month'  => $month,
            'logged' => $days,
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'day'    => 'required|date_format:Y-m-d',
            'focus'  => 'nullable|string',
            'effort' => 'nullable|integer|min:1|max:10',
            'note'   => 'nullable|string',
            'tags'   => 'nullable|array',
        ]);

        $user = $request->user();

        $existing = $user->trainingDays()->where('date', $data['day'])->where('type', 'personal')->first();
        if ($existing) {
            return response()->json(['message' => 'Ya tienes un registro para este día.'], 409);
        }

        // Verify a training session exists for this date
        $training = \App\Models\Training::where('fecha', $data['day'])->whereNull('closed_at')->first();
        if (!$training) {
            return response()->json(['message' => 'No hay una sesión de entrenamiento programada para este día.'], 422);
        }

        $day = $user->trainingDays()->create([
            'date'        => $data['day'],
            'training_id' => $training->id,
            'type'        => 'personal',
            'focus'       => $data['focus'] ?? null,
            'effort'      => $data['effort'] ?? 5,
            'note'        => $data['note'] ?? null,
            'tags'        => $data['tags'] ?? null,
        ]);

        // Award 75 credits
        $character = $user->character;
        if ($character) {
            $character->increment('credits', 75);
        }

        return response()->json([
            'training_day'    => $day,
            'credits_awarded' => 75,
        ], 201);
    }

    public function update(Request $request, string $day): JsonResponse
    {
        $data = $request->validate([
            'focus'  => 'nullable|string',
            'effort' => 'nullable|integer|min:1|max:10',
            'note'   => 'nullable|string',
            'tags'   => 'nullable|array',
        ]);

        $trainingDay = $request->user()->trainingDays()
            ->where('date', $day)
            ->firstOrFail();

        $trainingDay->update($data);

        return response()->json(['training_day' => $trainingDay]);
    }
}
