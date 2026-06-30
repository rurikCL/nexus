<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\PvpCombat;
use App\Models\User;
use App\Notifications\PvpCombatNotification;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

class PvpCombatController extends Controller
{
    /** POST /pvp/challenge — attacker inicia un combate */
    public function challenge(Request $request): JsonResponse
    {
        $data = $request->validate([
            'defender_id' => 'required|integer|exists:users,id',
        ]);

        $attacker = $request->user();
        $defender = User::with('character')->findOrFail($data['defender_id']);

        if ($attacker->id === $defender->id) {
            return response()->json(['error' => 'No puedes atacarte a ti mismo'], 422);
        }

        if (!$attacker->character || !$defender->character) {
            return response()->json(['error' => 'Ambos jugadores necesitan un personaje'], 422);
        }

        // Un jugador solo puede tener un combate activo a la vez
        $userActive = PvpCombat::where('status', 'active')
            ->where(fn($q) => $q->where('attacker_id', $attacker->id)->orWhere('defender_id', $attacker->id))
            ->exists();
        if ($userActive) {
            return response()->json(['error' => 'Ya tienes un combate activo. Resuélvelo primero.'], 422);
        }

        $attackerStats = self::getCombatStats($attacker->character);
        $defenderStats = self::getCombatStats($defender->character);

        // Iniciativa: mayor va primero
        $atkInit = random_int(1, 6) + $attackerStats['iniciativa'];
        $defInit = random_int(1, 6) + $defenderStats['iniciativa'];
        $firstTurn = $atkInit >= $defInit ? $attacker->id : $defender->id;

        $defChar = $defender->character;
        $combat = PvpCombat::create([
            'attacker_id'        => $attacker->id,
            'defender_id'        => $defender->id,
            'lugar_id'           => $defChar->map_lugar_id,
            'zona_id'            => $defChar->map_zona_id,
            'planeta_id'         => $defChar->map_planeta_id,
            'sistema_id'         => $defChar->map_sistema_id,
            'attacker_hp'        => $attackerStats['vida'],
            'defender_hp'        => $defenderStats['vida'],
            'attacker_escudo'    => $attackerStats['escudo'],
            'defender_escudo'    => $defenderStats['escudo'],
            'attacker_def_bonus' => 0,
            'defender_def_bonus' => 0,
            'current_turn'       => $firstTurn,
            'status'             => 'active',
            'log'                => [],
        ]);

        $iniciativaMsg = $firstTurn === $attacker->id
            ? "{$attacker->character->name} actúa primero"
            : "Tú actúas primero";

        $defender->notify(new PvpCombatNotification(
            "¡{$attacker->character->name} te ataca!",
            "{$iniciativaMsg} — Ve al mapa para combatir",
            $combat->id
        ));

        return response()->json([
            'combat' => $this->formatCombat($combat->load(['attacker.character', 'defender.character']), $attacker->id),
        ], 201);
    }

    /** GET /pvp/active — combate activo del usuario autenticado */
    public function active(Request $request): JsonResponse
    {
        $user = $request->user();

        $combat = PvpCombat::where('status', 'active')
            ->where(fn($q) => $q->where('attacker_id', $user->id)->orWhere('defender_id', $user->id))
            ->with(['attacker.character', 'defender.character'])
            ->latest()
            ->first();

        return response()->json(['combat' => $combat ? $this->formatCombat($combat, $user->id) : null]);
    }

    /** GET /pvp/{id} — estado del combate */
    public function show(Request $request, int $id): JsonResponse
    {
        $user = $request->user();
        $combat = PvpCombat::with(['attacker.character', 'defender.character'])->findOrFail($id);

        if (!$combat->involvedUser($user->id)) {
            return response()->json(['error' => 'No autorizado'], 403);
        }

        return response()->json(['combat' => $this->formatCombat($combat, $user->id)]);
    }

    /** POST /pvp/{id}/action — ejecuta la acción del turno */
    public function action(Request $request, int $id): JsonResponse
    {
        $data = $request->validate([
            'skill' => 'required|in:melee,distancia,postura,potente,flee',
        ]);

        $user = $request->user();
        $combat = PvpCombat::with(['attacker.character', 'defender.character'])->findOrFail($id);

        if (!$combat->involvedUser($user->id)) {
            return response()->json(['error' => 'No autorizado'], 403);
        }
        if ($combat->current_turn !== $user->id) {
            return response()->json(['error' => 'No es tu turno'], 422);
        }
        if ($combat->status !== 'active') {
            return response()->json(['error' => 'El combate ya terminó'], 422);
        }

        $isAttacker  = $user->id === $combat->attacker_id;
        $actorChar   = $isAttacker ? $combat->attacker->character : $combat->defender->character;
        $opponentUser= $isAttacker ? $combat->defender : $combat->attacker;
        $opponentChar= $opponentUser->character;

        $actorStats   = self::getCombatStats($actorChar);
        $opponentStats= self::getCombatStats($opponentChar);

        $log   = $combat->log ?? [];
        $entry = ['turn' => count($log) + 1, 'actor_id' => $user->id, 'messages' => []];
        $skill = $data['skill'];

        if ($skill === 'flee') {
            $combat->status      = $isAttacker ? 'fled_attacker' : 'fled_defender';
            $entry['messages'][] = "{$actorChar->name} huyó del combate";

        } elseif ($skill === 'postura') {
            if ($isAttacker) $combat->attacker_def_bonus = 4;
            else             $combat->defender_def_bonus = 4;
            $entry['messages'][] = "{$actorChar->name} adopta postura defensiva (+4 DEF)";

        } else {
            $defBonus = $isAttacker ? $combat->defender_def_bonus : $combat->attacker_def_bonus;
            $atkVal   = $actorStats['ataque'];

            if ($skill === 'distancia') {
                $atkVal = $actorStats['punteria'] ?? $atkVal;
            }

            $atkRoll = random_int(1, 6) + $atkVal;
            $defRoll = random_int(1, 6) + $opponentStats['defensa'] + $defBonus;

            // Limpiar bonus defensivo tras uso
            if ($isAttacker) $combat->defender_def_bonus = 0;
            else             $combat->attacker_def_bonus = 0;

            if ($atkRoll > $defRoll) {
                $dmg = $atkVal;
                if ($skill === 'potente') $dmg = (int) round($dmg * 1.5);

                if ($isAttacker) {
                    [$combat->defender_hp, $combat->defender_escudo] =
                        self::applyDamage($combat->defender_hp, $combat->defender_escudo, $dmg);
                } else {
                    [$combat->attacker_hp, $combat->attacker_escudo] =
                        self::applyDamage($combat->attacker_hp, $combat->attacker_escudo, $dmg);
                }
                $entry['messages'][] = "¡{$actorChar->name} acierta! ({$atkRoll} vs {$defRoll}) — -{$dmg} HP";
            } else {
                $entry['messages'][] = "{$actorChar->name} falla el ataque ({$atkRoll} vs {$defRoll})";
            }
        }

        // Condición de victoria
        if ($combat->attacker_hp <= 0)      $combat->status = 'defender_won';
        elseif ($combat->defender_hp <= 0)  $combat->status = 'attacker_won';

        // Cambiar turno si sigue activo
        if ($combat->status === 'active') {
            $combat->current_turn = $opponentUser->id;
        }

        $log[]      = $entry;
        $combat->log = $log;
        $combat->save();

        // Notificar al oponente
        if ($combat->status === 'active') {
            $opponentUser->notify(new PvpCombatNotification(
                'Es tu turno en el combate',
                "vs {$actorChar->name} — Responde en el mapa",
                $combat->id
            ));
        } else {
            // Combate terminado — notificar al que no fue el actor
            $opponentUser->notify(new PvpCombatNotification(
                'Combate PvP terminado',
                $this->endMessage($combat, $opponentUser->id),
                $combat->id
            ));
        }

        return response()->json([
            'combat' => $this->formatCombat(
                $combat->fresh(['attacker.character', 'defender.character']),
                $user->id
            ),
        ]);
    }

    // ──────────────────────────────── helpers ─────────────────────────────────

    private function formatCombat(PvpCombat $c, int $myId): array
    {
        $att = $c->attacker;
        $def = $c->defender;

        return [
            'id'                 => $c->id,
            'status'             => $c->status,
            'current_turn'       => $c->current_turn,
            'is_my_turn'         => $c->current_turn === $myId && $c->status === 'active',
            'i_am_attacker'      => $c->attacker_id === $myId,
            'attacker_hp'        => $c->attacker_hp,
            'defender_hp'        => $c->defender_hp,
            'attacker_escudo'    => $c->attacker_escudo,
            'defender_escudo'    => $c->defender_escudo,
            'attacker_def_bonus' => $c->attacker_def_bonus,
            'defender_def_bonus' => $c->defender_def_bonus,
            'lugar_id'           => $c->lugar_id,
            'zona_id'            => $c->zona_id,
            'planeta_id'         => $c->planeta_id,
            'sistema_id'         => $c->sistema_id,
            'log'                => $c->log ?? [],
            'attacker'           => $this->formatPlayer($att),
            'defender'           => $this->formatPlayer($def),
        ];
    }

    private function formatPlayer(User $user): array
    {
        $ch = $user->character;
        return [
            'id'        => $user->id,
            'name'      => $ch?->name ?? $user->name,
            'handle'    => $ch?->handle ?? $user->name,
            'photo_url' => $ch?->photo ? Storage::disk('public')->url($ch->photo) : null,
            'stats'     => self::getCombatStats($ch),
        ];
    }

    private function endMessage(PvpCombat $c, int $userId): string
    {
        $won = ($c->status === 'attacker_won' && $c->attacker_id === $userId)
            || ($c->status === 'defender_won' && $c->defender_id === $userId);
        return $won ? '¡Ganaste el combate PvP!' : 'Fuiste derrotado en el combate PvP';
    }

    private static function getCombatStats(?object $char): array
    {
        if (!$char) {
            return ['vida' => 30, 'escudo' => 10, 'ataque' => 20, 'defensa' => 15,
                    'iniciativa' => 10, 'punteria' => 10, 'movimiento' => 20];
        }
        $s = is_array($char->stats) ? $char->stats : [];
        $f = $s['fuerza']    ?? 50;
        $v = $s['velocidad'] ?? 50;
        $t = $s['tecnica']   ?? 50;
        $d = $s['defensa']   ?? 50;
        $k = $s['foco']      ?? 50;
        return [
            'vida'       => $char->vida       ?? (30 + (int) round($f * 1.5)),
            'escudo'     => $char->escudo     ?? (10 + (int) round($t * 0.4)),
            'ataque'     => $char->ataque     ?? (int) round($f * 0.8),
            'defensa'    => $char->defensa    ?? (int) round($d * 0.8),
            'movimiento' => $char->movimiento ?? (int) round($v * 0.8),
            'iniciativa' => $char->iniciativa ?? (int) round(($v + $k) / 2 * 0.5),
            'punteria'   => $char->punteria   ?? (int) round(($t + $k) / 2 * 0.5),
        ];
    }

    private static function applyDamage(int $hp, int $escudo, int $dmg): array
    {
        if ($escudo > 0) {
            $absorbed = min($escudo, $dmg);
            $escudo  -= $absorbed;
            $dmg     -= $absorbed;
        }
        return [max(0, $hp - $dmg), max(0, $escudo)];
    }
}
