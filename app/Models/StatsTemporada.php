<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class StatsTemporada extends Model
{
    protected $fillable = ['user_id', 'temporada_id', 'wins', 'losses', 'streak'];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function temporada(): BelongsTo
    {
        return $this->belongsTo(Temporada::class);
    }

    /**
     * Devuelve { wins, losses, streak, winrate } agregados para un user_id.
     * wins y losses son la suma de todos los registros; streak viene del más reciente.
     */
    public static function totalsForUser(int $userId): array
    {
        $rows = static::where('user_id', $userId)->orderByDesc('updated_at')->get();

        $wins   = $rows->sum('wins');
        $losses = $rows->sum('losses');
        $streak = $rows->first()?->streak ?? 0;
        $total  = $wins + $losses;

        return [
            'wins'    => $wins,
            'losses'  => $losses,
            'streak'  => $streak,
            'winrate' => $total > 0 ? round($wins / $total * 100) : 0,
        ];
    }

    /**
     * Incrementa wins/streak (o losses y resetea streak) para user_id.
     * Usa $temporadaId si se provee; si es null, detecta la temporada activa por fecha.
     */
    public static function recordResult(int $userId, bool $won, ?int $temporadaId = null): void
    {
        if ($temporadaId === null) {
            $temporadaId = Temporada::whereDate('periodo_inicio', '<=', now())
                ->whereDate('periodo_fin', '>=', now())
                ->value('id');
        }

        $stats = static::firstOrCreate(
            ['user_id' => $userId, 'temporada_id' => $temporadaId],
            ['wins' => 0, 'losses' => 0, 'streak' => 0]
        );

        if ($won) {
            $stats->increment('wins');
            $stats->increment('streak');
        } else {
            $stats->increment('losses');
            $stats->update(['streak' => 0]);
        }
    }
}
