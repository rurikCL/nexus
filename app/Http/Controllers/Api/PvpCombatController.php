<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\PvpCombat;
use App\Models\RolHabilidad;
use App\Models\User;
use App\Notifications\PvpCombatNotification;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

class PvpCombatController extends Controller
{
    private const WITHS = [
        'attacker.character.armaEquipada', 'defender.character.armaEquipada',
        'attacker.character.sableActivo.nucleo', 'defender.character.sableActivo.nucleo',
        'attacker.character.sableActivo.cristal', 'defender.character.sableActivo.cristal',
        'attacker.character.sableActivo.lente', 'defender.character.sableActivo.lente',
        'attacker.character.sableActivo.emisor', 'defender.character.sableActivo.emisor',
        'attacker.character.sableActivo.estabilizador', 'defender.character.sableActivo.estabilizador',
        'attacker.character.sableActivo.empunadura', 'defender.character.sableActivo.empunadura',
        'attacker.character.sableActivo.modulo', 'defender.character.sableActivo.modulo',
        'attacker.character.sableActivo.accesorio', 'defender.character.sableActivo.accesorio',
        'attacker.character.naveEquipada.nave', 'defender.character.naveEquipada.nave',
    ];

    /* Tabla de efectividad: forma atacante → formas que supera */
    private const BEATS = [
        1 => [6],     // Shii-Cho    → Niman
        6 => [3],     // Niman       → Soresu
        3 => [4],     // Soresu      → Ataru
        4 => [1],     // Ataru       → Shii-Cho
        2 => [1, 5],  // Makashi     → Shii-Cho, Shien
        5 => [4],     // Shien/DjSo  → Ataru
        7 => [5, 6],  // Juyo/Vaapad → Shien, Niman
    ];

    /** POST /pvp/challenge */
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

        $attackerBusy = PvpCombat::whereIn('status', ['active', 'pending'])
            ->where(fn($q) => $q->where('attacker_id', $attacker->id)->orWhere('defender_id', $attacker->id))
            ->exists();
        if ($attackerBusy) {
            return response()->json(['error' => 'Ya tienes un combate activo o pendiente. Resuélvelo primero.'], 422);
        }

        $defenderBusy = PvpCombat::whereIn('status', ['active', 'pending'])
            ->where(fn($q) => $q->where('attacker_id', $defender->id)->orWhere('defender_id', $defender->id))
            ->exists();
        if ($defenderBusy) {
            return response()->json(['error' => 'Ese jugador ya tiene un combate activo o pendiente'], 422);
        }

        $attackerStats = self::getCombatStats($attacker->character);
        $defenderStats = self::getCombatStats($defender->character);

        $roll = self::rollIniciativa($attackerStats['iniciativa'], $defenderStats['iniciativa']);
        $firstTurn = $roll['gana_atacante'] ? $attacker->id : $defender->id;

        $defChar = $defender->character;

        /* Pre-recuperar fuerza para quien actúa primero */
        $attackerFuerzaCfg = self::fuerzaConfig($attacker->character);
        $defenderFuerzaCfg = self::fuerzaConfig($defChar);
        $attackerFuerza = $firstTurn === $attacker->id ? $attackerFuerzaCfg['gen'] : 0;
        $defenderFuerza = $firstTurn === $defender->id ? $defenderFuerzaCfg['gen'] : 0;

        $combat = PvpCombat::create([
            'attacker_id'            => $attacker->id,
            'defender_id'            => $defender->id,
            'lugar_id'               => $defChar->map_lugar_id,
            'zona_id'                => $defChar->map_zona_id,
            'planeta_id'             => $defChar->map_planeta_id,
            'sistema_id'             => $defChar->map_sistema_id,
            'attacker_hp'            => $attackerStats['vida'],
            'defender_hp'            => $defenderStats['vida'],
            'attacker_escudo'        => $attackerStats['escudo'],
            'defender_escudo'        => $defenderStats['escudo'],
            'attacker_def_bonus'     => 0,
            'defender_def_bonus'     => 0,
            'attacker_fuerza'        => $attackerFuerza,
            'defender_fuerza'        => $defenderFuerza,
            'attacker_current_forma' => $attacker->character->current_forma ?? 1,
            'defender_current_forma' => $defChar->current_forma ?? 1,
            'current_turn'           => $firstTurn,
            'ronda'                  => 1,
            'ronda_turno'            => 0,
            'status'                 => 'pending',
            'log'                    => [[
                'turn'     => 1,
                'actor_id' => null,
                'messages' => [
                    "Ronda 1 — Iniciativa: {$attacker->character->name} 1d20({$roll['atk_dado']})+{$attackerStats['iniciativa']}={$roll['atk_total']} "
                        . "vs {$defChar->name} 1d20({$roll['def_dado']})+{$defenderStats['iniciativa']}={$roll['def_total']}",
                    $roll['gana_atacante'] ? "¡{$attacker->character->name} actúa primero!" : "¡{$defChar->name} actúa primero!",
                ],
            ]],
        ]);

        $defender->notify(new PvpCombatNotification(
            "Reto de combate de {$attacker->character->name}",
            "Te han retado a duelo — Acepta o rechaza en el mapa galáctico",
            $combat->id
        ));

        return response()->json([
            'combat' => $this->formatCombat($combat->load(self::WITHS), $attacker->id),
        ], 201);
    }

    /** POST /pvp/{id}/accept */
    public function accept(Request $request, int $id): JsonResponse
    {
        $user   = $request->user();
        $combat = PvpCombat::with(self::WITHS)->findOrFail($id);

        if ($combat->defender_id !== $user->id) {
            return response()->json(['error' => 'Solo el retado puede aceptar'], 403);
        }
        if ($combat->status !== 'pending') {
            return response()->json(['error' => 'El reto ya no está pendiente'], 422);
        }

        $combat->status = 'active';
        $combat->save();

        $combat->attacker->notify(new PvpCombatNotification(
            '¡Reto aceptado!',
            "{$user->character->name} aceptó tu duelo — Ve al mapa para combatir",
            $combat->id
        ));

        return response()->json([
            'combat' => $this->formatCombat($combat->fresh(self::WITHS), $user->id),
        ]);
    }

    /** POST /pvp/{id}/decline */
    public function decline(Request $request, int $id): JsonResponse
    {
        $user   = $request->user();
        $combat = PvpCombat::with(self::WITHS)->findOrFail($id);

        if ($combat->defender_id !== $user->id) {
            return response()->json(['error' => 'Solo el retado puede rechazar'], 403);
        }
        if ($combat->status !== 'pending') {
            return response()->json(['error' => 'El reto ya no está pendiente'], 422);
        }

        $combat->status = 'declined';
        $combat->save();

        $combat->attacker->notify(new PvpCombatNotification(
            'Reto rechazado',
            "{$user->character->name} rechazó tu reto de combate",
            $combat->id
        ));

        return response()->json(['ok' => true]);
    }

    /** GET /pvp/active */
    public function active(Request $request): JsonResponse
    {
        $user = $request->user();

        $combat = PvpCombat::whereIn('status', ['active', 'pending'])
            ->where(fn($q) => $q->where('attacker_id', $user->id)->orWhere('defender_id', $user->id))
            ->with(self::WITHS)
            ->latest()
            ->first();

        return response()->json(['combat' => $combat ? $this->formatCombat($combat, $user->id) : null]);
    }

    /** GET /pvp/{id} */
    public function show(Request $request, int $id): JsonResponse
    {
        $user   = $request->user();
        $combat = PvpCombat::with(self::WITHS)->findOrFail($id);

        if (!$combat->involvedUser($user->id)) {
            return response()->json(['error' => 'No autorizado'], 403);
        }

        return response()->json(['combat' => $this->formatCombat($combat, $user->id)]);
    }

    /** POST /pvp/{id}/action */
    public function action(Request $request, int $id): JsonResponse
    {
        $data = $request->validate(['skill' => 'required', 'forma' => 'nullable|integer|min:1|max:7']);

        $user   = $request->user();
        $combat = PvpCombat::with(self::WITHS)->findOrFail($id);

        if (!$combat->involvedUser($user->id)) {
            return response()->json(['error' => 'No autorizado'], 403);
        }
        if ($combat->current_turn !== $user->id) {
            return response()->json(['error' => 'No es tu turno'], 422);
        }
        if ($combat->status !== 'active') {
            return response()->json(['error' => 'El combate ya terminó'], 422);
        }

        $isAttacker   = $user->id === $combat->attacker_id;
        $actorChar    = $isAttacker ? $combat->attacker->character : $combat->defender->character;
        $opponentUser = $isAttacker ? $combat->defender            : $combat->attacker;
        $opponentChar = $opponentUser->character;

        $attackerFuerzaCfg = self::fuerzaConfig($combat->attacker->character);
        $defenderFuerzaCfg = self::fuerzaConfig($combat->defender->character);

        /* Estado actual del actor */
        $myFuerza     = ($isAttacker ? $combat->attacker_fuerza    : $combat->defender_fuerza)    ?? 0;
        $myCooldowns  = ($isAttacker ? $combat->attacker_cooldowns : $combat->defender_cooldowns)  ?? [];
        $myBuffs      = ($isAttacker ? $combat->attacker_buffs     : $combat->defender_buffs)      ?? [];
        $myDebuffs    = ($isAttacker ? $combat->attacker_debuffs   : $combat->defender_debuffs)    ?? [];
        $oppBuffs     = ($isAttacker ? $combat->defender_buffs     : $combat->attacker_buffs)      ?? [];
        $oppDebuffs   = ($isAttacker ? $combat->defender_debuffs   : $combat->attacker_debuffs)    ?? [];
        $oppLastForma = ($isAttacker ? $combat->defender_last_forma : $combat->attacker_last_forma) ?? 0;

        /* Tick: decrementar buffs/debuffs y cooldowns al inicio del turno */
        $tick = fn(array $arr) => array_values(array_filter(
            array_map(fn($e) => array_merge($e, ['turns' => $e['turns'] - 1]), $arr),
            fn($e) => $e['turns'] > 0
        ));
        $myBuffs   = $tick($myBuffs);
        $myDebuffs = $tick($myDebuffs);
        $oppBuffs  = $tick($oppBuffs);
        $oppDebuffs = $tick($oppDebuffs);

        $myCooldowns = array_filter(
            array_map(fn($v) => $v - 1, $myCooldowns),
            fn($v) => $v > 0
        );

        /* Stats efectivos con buffs/debuffs */
        $actorBaseStats   = self::getCombatStats($actorChar);
        $opponentBaseStats = self::getCombatStats($opponentChar);
        $actorStats    = self::getEffectiveStats($actorBaseStats,   $myBuffs,   $myDebuffs);
        $opponentStats = self::getEffectiveStats($opponentBaseStats, $oppBuffs, $oppDebuffs);

        $log   = $combat->log ?? [];
        $entry = ['turn' => count($log) + 1, 'actor_id' => $user->id, 'messages' => []];
        $skill = $data['skill'];

        /* ─── Huir ────────────────────────────────────────────────────── */
        if ($skill === 'flee') {
            $combat->status      = $isAttacker ? 'fled_attacker' : 'fled_defender';
            $entry['messages'][] = "{$actorChar->name} huyó del combate";

        /* ─── Cambio de estancia ─────────────────────────────────────── */
        } elseif ($skill === 'stance') {
            $forma = (int) ($data['forma'] ?? 1);
            if ($forma < 1 || $forma > 7) {
                return response()->json(['error' => 'Forma inválida'], 422);
            }
            if ($isAttacker) $combat->attacker_current_forma = $forma;
            else             $combat->defender_current_forma = $forma;
            $entry['messages'][] = "{$actorChar->name} cambia a Forma {$forma}";

        /* ─── Ataque básico (sable armado > arma equipada > desarmado) ──── */
        } elseif ($skill === 'unarmed') {
            $arma        = $actorChar->armaEfectiva();
            $esDistancia = ($arma['tipo_ataque'] ?? null) === 'distancia';
            $atkVal      = $esDistancia ? $actorStats['punteria']    : $actorStats['ataque'];
            $defVal      = $esDistancia ? $opponentStats['movimiento'] : $opponentStats['defensa'];
            $atkDado     = random_int(1, 20);
            $defDado     = random_int(1, 20);
            $atkRoll     = $atkDado + $atkVal;
            $defRoll     = $defDado + $defVal;
            $critico     = $arma['critico'] ?? 0;
            $esCritico   = $atkDado >= (20 - $critico);
            $accion      = $arma ? "ataca con {$arma['nombre']}" : 'ataca desarmado';
            $entry['messages'][] = "{$actorChar->name} {$accion}: 1d20+{$atkVal}={$atkRoll} vs 1d20+{$defVal}={$defRoll}";

            if ($esCritico || $atkRoll > $defRoll) {
                $dmg = ($arma['dano'] ?? 3) + ($esCritico ? 1 : 0);
                if ($isAttacker) {
                    [$combat->defender_hp, $combat->defender_escudo] =
                        self::applyDamage($combat->defender_hp, $combat->defender_escudo, $dmg);
                } else {
                    [$combat->attacker_hp, $combat->attacker_escudo] =
                        self::applyDamage($combat->attacker_hp, $combat->attacker_escudo, $dmg);
                }
                $entry['messages'][] = $esCritico ? "¡CRÍTICO! (natural {$atkDado}) −{$dmg} daño" : "¡Impacto! −{$dmg} daño";
            } else {
                $entry['messages'][] = "{$actorChar->name} falla el golpe";
            }

        /* ─── Habilidad ───────────────────────────────────────────────── */
        } else {
            $skillId      = (int) $skill;
            $myCurrentForma = $isAttacker
                ? ($combat->attacker_current_forma ?? 1)
                : ($combat->defender_current_forma ?? 1);

            /* Verificar que la habilidad está en los slots de la forma actual */
            $porForma = is_array($actorChar->habilidades_por_forma) ? $actorChar->habilidades_por_forma : [];
            $slotIds  = array_filter($porForma[(string)$myCurrentForma] ?? []);

            if (!in_array($skillId, $slotIds)) {
                return response()->json(['error' => 'Habilidad no disponible en esta forma'], 422);
            }

            $hab = RolHabilidad::find($skillId);
            if (!$hab) {
                return response()->json(['error' => 'Habilidad no encontrada'], 422);
            }
            if (($myCooldowns[(string)$skillId] ?? 0) > 0) {
                return response()->json(['error' => 'Habilidad en cooldown'], 422);
            }
            if ($myFuerza < $hab->costo_fuerza) {
                return response()->json(['error' => "Fuerza insuficiente ({$myFuerza}/{$hab->costo_fuerza})"], 422);
            }

            /* Gastar fuerza y registrar cooldown */
            $myFuerza -= $hab->costo_fuerza;
            if ($hab->cooldown > 0) {
                $myCooldowns[(string)$skillId] = $hab->cooldown;
            }

            /* Aplicar buff al actor (siempre al usar la habilidad) */
            $habBuff   = is_array($hab->buff)   ? $hab->buff   : [];
            $habDebuff = is_array($hab->debuff) ? $hab->debuff : [];
            foreach ($habBuff as $stat) {
                $myBuffs[] = ['stat' => $stat, 'turns' => 2];
            }

            /* Registrar la forma usada */
            if ($isAttacker) $combat->attacker_last_forma = $hab->forma;
            else             $combat->defender_last_forma = $hab->forma;

            /* ─── Habilidad de auto-buff (objetivo: self) ─────────────── */
            if ($hab->objetivo === 'self') {
                $buffDesc = !empty($habBuff) ? ' (+' . implode(', +', $habBuff) . ')' : '';
                $entry['messages'][] = "{$actorChar->name} usa {$hab->nombre}{$buffDesc}";

            /* ─── Habilidad de ataque (objetivo: target) ──────────────── */
            } else {
                $useAtq  = $hab->tipo === 'melee';
                $atkVal  = $useAtq ? $actorStats['ataque']   : $actorStats['punteria'];
                $defVal  = $useAtq ? $opponentStats['defensa'] : $opponentStats['movimiento'];

                $atkRoll = random_int(1, 20) + $atkVal;
                $defRoll = random_int(1, 20) + $defVal;

                $entry['messages'][] = "{$actorChar->name} usa {$hab->nombre}: "
                    . "1d20+{$atkVal}={$atkRoll} vs 1d20+{$defVal}={$defRoll}";

                if ($atkRoll > $defRoll) {
                    $dmg       = $hab->damage ?? 0;
                    $effective = self::isEffective((int)$hab->forma, (int)$oppLastForma);

                    if ($effective) {
                        $dmg = (int) round($dmg * 1.5);
                        $entry['messages'][] = "¡Forma efectiva! ×1.5 (Forma {$hab->forma} vs Forma {$oppLastForma})";
                    }

                    if ($isAttacker) {
                        [$combat->defender_hp, $combat->defender_escudo] =
                            self::applyDamage($combat->defender_hp, $combat->defender_escudo, $dmg);
                    } else {
                        [$combat->attacker_hp, $combat->attacker_escudo] =
                            self::applyDamage($combat->attacker_hp, $combat->attacker_escudo, $dmg);
                    }

                    /* Debuffs al oponente solo si impacta */
                    foreach ($habDebuff as $stat) {
                        $oppDebuffs[] = ['stat' => $stat, 'turns' => 2];
                    }

                    $debuffDesc = !empty($habDebuff)
                        ? ' (penaliza: ' . implode(', ', $habDebuff) . ')'
                        : '';
                    $entry['messages'][] = "¡Impacto! −{$dmg} daño{$debuffDesc}";

                } else {
                    $entry['messages'][] = "{$actorChar->name} falla el ataque";
                }
            }
        }

        /* ─── Condición de victoria ───────────────────────────────────── */
        if ($combat->attacker_hp <= 0)     $combat->status = 'defender_won';
        elseif ($combat->defender_hp <= 0) $combat->status = 'attacker_won';

        /* ─── Hito de victoria ──────────────────────────────────────────── */
        if (in_array($combat->status, ['attacker_won', 'defender_won'], true)) {
            $winnerChar = $combat->status === 'attacker_won' ? $combat->attacker->character : $combat->defender->character;
            $loserChar  = $combat->status === 'attacker_won' ? $combat->defender->character : $combat->attacker->character;

            if ($winnerChar && $loserChar) {
                \App\Models\CharacterHito::firstOrCreate([
                    'character_id' => $winnerChar->id,
                    'hito'         => "{$loserChar->name} derrotado",
                ]);
            }
        }

        /* ─── Persistir daño de la nave equipada (si el combate fue naval) ── */
        if (in_array($combat->status, ['attacker_won', 'defender_won', 'fled_attacker', 'fled_defender'], true)) {
            self::persistNaveDamage($combat->attacker->character, $combat->attacker_hp, $combat->attacker_escudo);
            self::persistNaveDamage($combat->defender->character, $combat->defender_hp, $combat->defender_escudo);
        }

        /* ─── Fuerza final de cada bando (antes del pre-cobro de ronda) ──── */
        $attackerFuerzaFinal = $isAttacker ? $myFuerza : ($combat->attacker_fuerza ?? 0);
        $defenderFuerzaFinal = $isAttacker ? ($combat->defender_fuerza ?? 0) : $myFuerza;

        /* ─── Cambio de turno / rondas ──────────────────────────────────── */
        if ($combat->status === 'active') {
            if ($combat->ronda_turno === 0) {
                /* Primera acción de la ronda: actúa el otro, sin nueva tirada */
                $combat->ronda_turno  = 1;
                $combat->current_turn = $opponentUser->id;
                if ($isAttacker) $defenderFuerzaFinal = min($defenderFuerzaCfg['max'], $defenderFuerzaFinal + $defenderFuerzaCfg['gen']);
                else             $attackerFuerzaFinal = min($attackerFuerzaCfg['max'], $attackerFuerzaFinal + $attackerFuerzaCfg['gen']);
            } else {
                /* Ambos actuaron: termina la ronda, se tira nueva iniciativa */
                $combat->ronda      += 1;
                $combat->ronda_turno = 0;

                $attBuffs   = $isAttacker ? $myBuffs   : $oppBuffs;
                $attDebuffs = $isAttacker ? $myDebuffs : $oppDebuffs;
                $defBuffs   = $isAttacker ? $oppBuffs  : $myBuffs;
                $defDebuffs = $isAttacker ? $oppDebuffs : $myDebuffs;

                $attEff = self::getEffectiveStats(self::getCombatStats($combat->attacker->character), $attBuffs, $attDebuffs);
                $defEff = self::getEffectiveStats(self::getCombatStats($combat->defender->character), $defBuffs, $defDebuffs);

                $roll = self::rollIniciativa($attEff['iniciativa'], $defEff['iniciativa']);
                $combat->current_turn = $roll['gana_atacante'] ? $combat->attacker_id : $combat->defender_id;

                $entry['messages'][] = "Ronda {$combat->ronda} — Iniciativa: {$combat->attacker->character->name} "
                    . "1d20({$roll['atk_dado']})+{$attEff['iniciativa']}={$roll['atk_total']} vs "
                    . "{$combat->defender->character->name} 1d20({$roll['def_dado']})+{$defEff['iniciativa']}={$roll['def_total']}";
                $entry['messages'][] = $roll['gana_atacante']
                    ? "¡{$combat->attacker->character->name} actúa primero!"
                    : "¡{$combat->defender->character->name} actúa primero!";

                if ($roll['gana_atacante']) $attackerFuerzaFinal = min($attackerFuerzaCfg['max'], $attackerFuerzaFinal + $attackerFuerzaCfg['gen']);
                else                        $defenderFuerzaFinal = min($defenderFuerzaCfg['max'], $defenderFuerzaFinal + $defenderFuerzaCfg['gen']);
            }
        }

        /* ─── Guardar estado del actor ────────────────────────────────── */
        $combat->attacker_fuerza = $attackerFuerzaFinal;
        $combat->defender_fuerza = $defenderFuerzaFinal;
        if ($isAttacker) {
            $combat->attacker_cooldowns = $myCooldowns ?: null;
            $combat->attacker_buffs     = $myBuffs     ?: null;
            $combat->attacker_debuffs   = $myDebuffs   ?: null;
            $combat->defender_buffs     = $oppBuffs    ?: null;
            $combat->defender_debuffs   = $oppDebuffs  ?: null;
        } else {
            $combat->defender_cooldowns = $myCooldowns ?: null;
            $combat->defender_buffs     = $myBuffs     ?: null;
            $combat->defender_debuffs   = $myDebuffs   ?: null;
            $combat->attacker_buffs     = $oppBuffs    ?: null;
            $combat->attacker_debuffs   = $oppDebuffs  ?: null;
        }

        $log[]       = $entry;
        $combat->log = $log;
        $combat->save();

        /* ─── Notificar al oponente ───────────────────────────────────── */
        if ($combat->status === 'active') {
            $opponentUser->notify(new PvpCombatNotification(
                'Es tu turno en el combate',
                "vs {$actorChar->name} — Responde en el mapa",
                $combat->id
            ));
        } else {
            $opponentUser->notify(new PvpCombatNotification(
                'Combate PvP terminado',
                $this->endMessage($combat, $opponentUser->id),
                $combat->id
            ));
        }

        return response()->json([
            'combat' => $this->formatCombat(
                $combat->fresh(self::WITHS),
                $user->id
            ),
        ]);
    }

    // ─────────────────────────── helpers ──────────────────────────────────────

    private function formatCombat(PvpCombat $c, int $myId): array
    {
        $att   = $c->attacker;
        $def   = $c->defender;
        $isAtt = $myId === $c->attacker_id;

        return [
            'id'              => $c->id,
            'status'          => $c->status,
            'ronda'           => $c->ronda ?? 1,
            'current_turn'    => $c->current_turn,
            'is_my_turn'      => $c->current_turn === $myId && $c->status === 'active',
            'i_am_attacker'   => $c->attacker_id === $myId,
            'attacker_hp'     => $c->attacker_hp,
            'defender_hp'     => $c->defender_hp,
            'attacker_escudo' => $c->attacker_escudo,
            'defender_escudo' => $c->defender_escudo,
            'attacker_def_bonus' => $c->attacker_def_bonus,
            'defender_def_bonus' => $c->defender_def_bonus,
            'lugar_id'        => $c->lugar_id,
            'zona_id'         => $c->zona_id,
            'planeta_id'      => $c->planeta_id,
            'sistema_id'      => $c->sistema_id,
            'log'             => $c->log ?? [],
            /* Estado de habilidades desde perspectiva del jugador */
            'my_fuerza'      => $isAtt ? $c->attacker_fuerza    : $c->defender_fuerza,
            'my_fuerza_max'  => $isAtt ? self::fuerzaConfig($att->character)['max'] : self::fuerzaConfig($def->character)['max'],
            'my_cooldowns'   => ($isAtt ? $c->attacker_cooldowns : $c->defender_cooldowns) ?? [],
            'my_buffs'       => ($isAtt ? $c->attacker_buffs     : $c->defender_buffs)     ?? [],
            'my_debuffs'     => ($isAtt ? $c->attacker_debuffs   : $c->defender_debuffs)   ?? [],
            'opp_buffs'      => ($isAtt ? $c->defender_buffs     : $c->attacker_buffs)     ?? [],
            'opp_debuffs'    => ($isAtt ? $c->defender_debuffs   : $c->attacker_debuffs)   ?? [],
            'my_last_forma'      => $isAtt ? $c->attacker_last_forma    : $c->defender_last_forma,
            'opp_last_forma'     => $isAtt ? $c->defender_last_forma    : $c->attacker_last_forma,
            'my_current_forma'   => $isAtt ? ($c->attacker_current_forma ?? 1) : ($c->defender_current_forma ?? 1),
            'opp_current_forma'  => $isAtt ? ($c->defender_current_forma ?? 1) : ($c->attacker_current_forma ?? 1),
            'attacker'           => $this->formatPlayer($att, $c->attacker_current_forma ?? 1),
            'defender'           => $this->formatPlayer($def, $c->defender_current_forma ?? 1),
        ];
    }

    private function formatPlayer(User $user, int $currentForma = 1): array
    {
        $ch       = $user->character;
        $porForma = is_array($ch?->habilidades_por_forma) ? $ch->habilidades_por_forma : [];
        $slotIds  = array_filter($porForma[(string)$currentForma] ?? []);

        $habilidades = $slotIds
            ? RolHabilidad::whereIn('id', $slotIds)->get()->map(fn($h) => self::fmtHab($h))->values()->toArray()
            : [];

        return [
            'id'           => $user->id,
            'name'         => $ch?->name ?? $user->name,
            'handle'       => $ch?->handle ?? $user->name,
            'photo_url'    => $ch?->photo ? Storage::disk('public')->url($ch->photo) : null,
            'stats'        => self::getCombatStats($ch),
            'habilidades'  => $habilidades,
            'current_forma' => $currentForma,
            'arma_equipada' => $ch?->armaEfectiva(),
        ];
    }

    private static function fmtHab(RolHabilidad $h): array
    {
        return [
            'id'           => $h->id,
            'nombre'       => $h->nombre,
            'tipo'         => $h->tipo,
            'forma'        => $h->forma,
            'costo_fuerza' => $h->costo_fuerza,
            'damage'       => $h->damage,
            'cooldown'     => $h->cooldown,
            'objetivo'     => $h->objetivo,
            'buff'         => $h->buff ?? [],
            'debuff'       => $h->debuff ?? [],
            'efecto'       => $h->efecto,
        ];
    }

    private function endMessage(PvpCombat $c, int $userId): string
    {
        $won = ($c->status === 'attacker_won'  && $c->attacker_id === $userId)
            || ($c->status === 'defender_won'  && $c->defender_id === $userId)
            || ($c->status === 'fled_attacker' && $c->defender_id === $userId)
            || ($c->status === 'fled_defender' && $c->attacker_id === $userId);
        return $won ? '¡Ganaste el combate PvP! (el rival huyó)' : 'Fuiste derrotado en el combate PvP';
    }

    private static function getCombatStats(?object $char): array
    {
        if (!$char) {
            return ['vida' => 30, 'escudo' => 10, 'ataque' => 20, 'defensa' => 15,
                    'iniciativa' => 10, 'punteria' => 10, 'movimiento' => 20];
        }

        /* Combate naval: si el personaje tiene una nave equipada, sus atributos
         * reemplazan por completo a los del personaje (vida/escudo persisten el
         * daño entre combates — requieren reparación). */
        if (method_exists($char, 'naveEquipada')) {
            $naveOwned = $char->relationLoaded('naveEquipada')
                ? $char->naveEquipada
                : $char->naveEquipada()->with('nave')->first();

            if ($naveOwned && $naveOwned->nave) {
                $nave = $naveOwned->nave;
                return [
                    'vida'       => $naveOwned->vida_actual,
                    'escudo'     => $naveOwned->escudo_actual,
                    'ataque'     => $nave->ataque,
                    'defensa'    => $nave->maniobrabilidad,
                    'movimiento' => $nave->maniobrabilidad,
                    'iniciativa' => $nave->velocidad,
                    'punteria'   => $nave->ataque,
                ];
            }
        }

        $s = is_array($char->stats) ? $char->stats : [];
        $f = $s['fuerza']    ?? 50;
        $v = $s['velocidad'] ?? 50;
        $t = $s['tecnica']   ?? 50;
        $d = $s['defensa']   ?? 50;
        $k = $s['foco']      ?? 50;
        $bonos = method_exists($char, 'sableBonos')
            ? $char->sableBonos()
            : ['ataque' => 0, 'defensa' => 0, 'punteria' => 0, 'movimiento' => 0, 'iniciativa' => 0, 'vida' => 0, 'escudo' => 0];
        return [
            'vida'       => ($char->vida       ?? (30 + (int) round($f * 1.5))) + $bonos['vida'],
            'escudo'     => ($char->escudo     ?? (10 + (int) round($t * 0.4))) + $bonos['escudo'],
            'ataque'     => ($char->ataque     ?? (int) round($f * 0.8)) + $bonos['ataque'],
            'defensa'    => ($char->defensa    ?? (int) round($d * 0.8)) + $bonos['defensa'],
            'movimiento' => ($char->movimiento ?? (int) round($v * 0.8)) + $bonos['movimiento'],
            'iniciativa' => ($char->iniciativa ?? (int) round(($v + $k) / 2 * 0.5)) + $bonos['iniciativa'],
            'punteria'   => ($char->punteria   ?? (int) round(($t + $k) / 2 * 0.5)) + $bonos['punteria'],
        ];
    }

    /** Fuerza máxima (10 + bono del sable) y generación por turno (2 + bono del sable) */
    private static function fuerzaConfig(?object $char): array
    {
        $bonos = ($char && method_exists($char, 'sableBonos'))
            ? $char->sableBonos()
            : ['fuerza' => 0, 'generacion_fuerza' => 0];

        return [
            'max' => 10 + ($bonos['fuerza'] ?? 0),
            'gen' => 2 + ($bonos['generacion_fuerza'] ?? 0),
        ];
    }

    /** Tirada de iniciativa 1d20 + iniciativa para ambos bandos */
    private static function rollIniciativa(int $attackerIniciativa, int $defenderIniciativa): array
    {
        $atkDado  = random_int(1, 20);
        $defDado  = random_int(1, 20);
        $atkTotal = $atkDado + $attackerIniciativa;
        $defTotal = $defDado + $defenderIniciativa;

        return [
            'atk_dado'      => $atkDado,
            'def_dado'      => $defDado,
            'atk_total'     => $atkTotal,
            'def_total'     => $defTotal,
            'gana_atacante' => $atkTotal >= $defTotal,
        ];
    }

    /** Aplica buffs y debuffs sobre los stats base */
    private static function getEffectiveStats(array $base, array $buffs, array $debuffs): array
    {
        $stats = $base;
        foreach ($buffs   as $b) { if (isset($stats[$b['stat']])) $stats[$b['stat']] += 1; }
        foreach ($debuffs as $d) { if (isset($stats[$d['stat']])) $stats[$d['stat']] = max(0, $stats[$d['stat']] - 1); }
        return $stats;
    }

    /** ¿La forma del atacante supera la forma del defensor? */
    private static function isEffective(int $atkForma, int $defForma): bool
    {
        if ($atkForma === 0 || $defForma === 0) return false;
        return in_array($defForma, self::BEATS[$atkForma] ?? [], true);
    }

    private static function persistNaveDamage(?object $char, int $hp, int $escudo): void
    {
        if (!$char || !method_exists($char, 'naveEquipada')) {
            return;
        }

        $naveOwned = $char->naveEquipada()->first();
        if ($naveOwned) {
            $naveOwned->update(['vida_actual' => max(0, $hp), 'escudo_actual' => max(0, $escudo)]);
        }
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
