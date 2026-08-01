<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Character;
use App\Models\StatsTemporada;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

class CombatantController extends Controller
{
    private const WITH = [
        'user.tutor.character', 'user.sede', 'tituloActivo',
        'medallas.medalla', 'naveEquipada.nave',
        'mapSistema', 'mapPlaneta', 'mapZona', 'mapLugar',
    ];

    public function index(Request $request): JsonResponse
    {
        $characters = Character::with(self::WITH)
            ->get()
            ->map(fn ($c) => $this->formatCombatant($c))
            ->sortByDesc('wins')
            ->values();

        return response()->json(['combatants' => $characters]);
    }

    public function show(Request $request, string $handle): JsonResponse
    {
        $character = Character::with(self::WITH)
            ->where('handle', $handle)
            ->firstOrFail();

        return response()->json(['combatant' => $this->formatCombatant($character)]);
    }

    public function showPublic(Request $request, string $handle): JsonResponse
    {
        $character = Character::with(self::WITH)
            ->where('handle', $handle)
            ->firstOrFail();

        return response()->json(['combatant' => $this->formatCombatant($character)]);
    }

    private function formatCombatant(Character $character): array
    {
        $stats = StatsTemporada::totalsForUser($character->user_id);
        $user = $character->user;

        $trainingDays = $user->trainingDays()->where('type', 'personal');
        $totalEntrenamientos = (clone $trainingDays)->count();
        $totalBitacoras = (clone $trainingDays)->whereNotNull('note')->where('note', '!=', '')->count();
        $ultimaFecha = (clone $trainingDays)->orderByDesc('date')->first()?->date?->format('Y-m-d');

        $naveEquipada = $character->naveEquipada;

        $ubicacion = $character->mapLocationArray();
        $ubicacion['imagen'] = $character->mapLugar?->imagen
            ?? $character->mapZona?->imagen
            ?? $character->mapPlaneta?->imagen
            ?? null;

        return [
            'id' => $character->user_id,
            'handle' => $character->handle,
            'name' => $character->name,
            'bio' => $character->bio,
            'lore' => $character->lore,
            'cls' => $character->cls,
            'saber_color' => $character->saber_color,
            'sector' => $character->sector,
            'sponsor' => $character->sponsor,
            'joined_year' => $character->joined_year,
            'credits' => $character->credits,
            'wins' => $stats['wins'],
            'losses' => $stats['losses'],
            'streak' => $stats['streak'],
            'winrate' => $stats['winrate'],
            'combat_stats' => $character->combatStats(),
            'gold' => $character->gold,
            'side' => $character->side ?? 'luminoso',
            'tier' => $user->tier ?? 'iniciado',
            'sede_id' => $user->sede_id,
            'sede_nombre' => $user->sede?->nombre,
            'titulo_activo' => $character->tituloActivo?->only(['id', 'nombre', 'tipo']),
            'photo_url' => $character->imagenMapa()
                ? Storage::disk('public')->url($character->imagenMapa()).'?v='.$character->updated_at->timestamp
                : null,
            'tutor' => $user->tutor
                ? [
                    'id' => $user->tutor->id,
                    'name' => $user->tutor->character?->name ?? $user->tutor->name,
                    'handle' => $user->tutor->character?->handle,
                    'tier' => $user->tutor->tier,
                ]
                : null,
            'medals' => $character->medallas->map(fn ($cm) => [
                'id' => $cm->id,
                'activo' => $cm->activo,
                'medalla' => $cm->medalla ? [
                    'nombre' => $cm->medalla->nombre,
                    'imagen' => $cm->medalla->imagen,
                    'rareza' => $cm->medalla->rareza,
                ] : null,
            ])->values(),
            'misiones_completadas' => $user->misiones()->wherePivot('status', 'completada')->count(),
            'tareas_completadas' => $user->tasksAsPupil()->where('status', 'completada')->count(),
            'entrenamiento' => [
                'ultima_fecha' => $ultimaFecha,
                'total_entrenamientos' => $totalEntrenamientos,
                'total_bitacoras' => $totalBitacoras,
            ],
            'ubicacion' => $ubicacion,
            'nave_equipada' => $naveEquipada?->nave ? [
                'nombre' => $naveEquipada->nave->nombre,
                'imagen' => $naveEquipada->nave->imagen,
            ] : null,
        ];
    }
}
