<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\CharacterHito;
use App\Models\Configuracion;
use App\Models\MapNpc;
use App\Models\RaidCombat;
use App\Models\RaidCombatPlayer;
use App\Models\RolHabilidad;
use App\Services\MisionProgresoService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

/**
 * Combate RAID: varios jugadores vs 1 NPC tipo "jefe". Controlador y lógica
 * completamente separados de PvpCombatController/CombatController (combate
 * NPC 1v1, resuelto en el cliente) — aquí el servidor es autoritativo porque
 * hay varios clientes distintos viendo el mismo estado compartido.
 *
 * Flujo: join() encola al jugador (o lo suma a una cola "esperando" existente
 * para ese jefe) hasta llenar los cupos configurados en el NPC (raid_slots).
 * No hace falta llenar todos los cupos: en cuanto todos los que se unieron
 * marcan ready() y hay al menos MIN_JUGADORES, arranca el combate con una
 * tirada de iniciativa para todos los participantes (jugadores + jefe). Cada
 * ronda tiene un turno por participante. El turno del jefe se resuelve
 * automáticamente en el servidor (sin acción de ningún cliente) apenas le
 * toca, así que un solo action() de un jugador puede hacer avanzar el combate
 * varios turnos de golpe si de por medio hay turnos del jefe.
 */
class RaidCombatController extends Controller
{
    /* Tabla de efectividad entre formas: forma atacante → formas que supera (igual que PvP/NPC) */
    private const BEATS = [
        1 => [6],     // Shii-Cho    → Niman
        6 => [3],     // Niman       → Soresu
        3 => [4],     // Soresu      → Ataru
        4 => [1],     // Ataru       → Shii-Cho
        2 => [1, 5],  // Makashi     → Shii-Cho, Shien
        5 => [4],     // Shien/DjSo  → Ataru
        7 => [5, 6],  // Juyo/Vaapad → Shien, Niman
    ];

    /** Mínimo de jugadores para poder iniciar el combate, sin importar los cupos configurados en el NPC. */
    private const MIN_JUGADORES = 2;

    /* Expresiones disponibles en combate RAID — whitelist autoritativa del servidor
     * (el cliente solo envía el id; emoji/label/desc los define el backend). Misma
     * lista que PvpCombatController::EMOTES. */
    private const EMOTES = [
        'saludar' => ['emoji' => '👋',  'label' => 'Saludar',     'desc' => 'saluda al grupo'],
        'reir' => ['emoji' => '😂',  'label' => 'Reír',        'desc' => 'se ríe'],
        'llorar' => ['emoji' => '😢',  'label' => 'Llorar',      'desc' => 'llora'],
        'impresion' => ['emoji' => '😲',  'label' => 'Impresión',   'desc' => 'se muestra impresionado'],
        'enojo' => ['emoji' => '😠',  'label' => 'Enojarse',    'desc' => 'se enoja'],
        'dormir' => ['emoji' => '😴',  'label' => 'Dormir',      'desc' => 'finge dormirse de aburrimiento'],
        'adios' => ['emoji' => '🖐️', 'label' => 'Decir adiós', 'desc' => 'se despide'],
    ];

    /** Cupos de la cola para un jefe: lo configurado en el NPC (raid_slots), con un piso de MIN_JUGADORES. */
    private static function slotsFor(MapNpc $npc): array
    {
        return range(1, max(self::MIN_JUGADORES, $npc->raidCupos()));
    }

    /** POST /raid/join/{npcId} — se une a la cola de un jefe (o la crea); arranca el combate al llegar a 4. */
    public function join(Request $request, int $npcId): JsonResponse
    {
        $user = $request->user();
        $npc = MapNpc::findOrFail($npcId);

        if (($npc->tipo ?? '') !== 'jefe') {
            return response()->json(['error' => 'Este NPC no es un jefe de asalto.'], 422);
        }
        if (! $user->character) {
            return response()->json(['error' => 'Necesitas un personaje para combatir.'], 422);
        }

        $existing = RaidCombatPlayer::where('user_id', $user->id)->where('status', 'activo')
            ->whereHas('raidCombat', fn ($q) => $q->whereIn('status', ['esperando', 'activo']))
            ->with('raidCombat')->first();

        if ($existing) {
            if ($existing->raidCombat->npc_id !== $npc->id) {
                return response()->json(['error' => 'Ya tienes un combate RAID en curso con otro jefe. Resuélvelo primero.'], 422);
            }

            return response()->json(['raid' => $this->formatRaid($existing->raidCombat->load(['npc', 'jugadores.user.character']), $user->id)]);
        }

        $raid = RaidCombat::where('npc_id', $npc->id)->where('status', 'esperando')->first();

        if (! $raid) {
            $stats = self::getNpcStats($npc);
            $raid = RaidCombat::create([
                'npc_id' => $npc->id,
                'status' => 'esperando',
                'npc_hp' => $stats['vida'],
                'npc_escudo' => $stats['escudo'],
                'npc_forma' => $npc->forma ?? 0,
                'lugar_id' => $npc->LugarID,
                'log' => [],
            ]);
        }

        $slots = self::slotsFor($npc);
        $taken = $raid->jugadores()->pluck('slot')->all();
        $slot = collect($slots)->first(fn ($s) => ! in_array($s, $taken, true));

        if (! $slot) {
            return response()->json(['error' => 'La cola de este jefe ya está llena. Intenta más tarde.'], 422);
        }

        $charStats = self::getCombatStats($user->character);

        RaidCombatPlayer::create([
            'raid_combat_id' => $raid->id,
            'user_id' => $user->id,
            'slot' => $slot,
            'hp' => $charStats['vida'],
            'escudo' => $charStats['escudo'],
            'fuerza' => 0,
            'current_forma' => $user->character->formaEspecializacion(),
            'status' => 'activo',
            'listo' => false,
        ]);

        return response()->json(['raid' => $this->formatRaid($raid->fresh(['npc', 'jugadores.user.character']), $user->id)]);
    }

    /**
     * POST /raid/{id}/ready — marca (o desmarca) al jugador actual como listo. El combate
     * arranca automáticamente en cuanto TODOS los jugadores unidos a la cola estén listos,
     * siempre que haya al menos MIN_JUGADORES (no hace falta llenar todos los cupos del NPC).
     */
    public function ready(Request $request, int $id): JsonResponse
    {
        $raid = RaidCombat::with(['npc', 'jugadores.user.character'])->findOrFail($id);
        $user = $request->user();

        if ($raid->status !== 'esperando') {
            return response()->json(['error' => 'El combate ya comenzó.'], 422);
        }

        $rp = $raid->jugadores->firstWhere('user_id', $user->id);
        if (! $rp) {
            return response()->json(['error' => 'No participas en este combate.'], 403);
        }

        $rp->listo = ! $rp->listo;
        $rp->save();
        $raid->refresh()->load('jugadores');

        $total = $raid->jugadores->count();
        $todosListos = $total >= self::MIN_JUGADORES && $raid->jugadores->every(fn ($j) => $j->listo);

        if ($todosListos) {
            $this->startCombat($raid);
        }

        return response()->json(['raid' => $this->formatRaid($raid->fresh(['npc', 'jugadores.user.character']), $user->id)]);
    }

    /** POST /raid/{id}/leave — abandona la cola (solo mientras se espera; una vez activo se usa action(skill: flee)). */
    public function leave(Request $request, int $id): JsonResponse
    {
        $raid = RaidCombat::findOrFail($id);
        $user = $request->user();
        $rp = RaidCombatPlayer::where('raid_combat_id', $id)->where('user_id', $user->id)->first();

        if (! $rp) {
            return response()->json(['error' => 'No participas en este combate.'], 403);
        }
        if ($raid->status !== 'esperando') {
            return response()->json(['error' => 'Solo puedes abandonar mientras se espera en la cola.'], 422);
        }

        $rp->delete();
        if ($raid->jugadores()->count() === 0) {
            $raid->delete();
        }

        return response()->json(['ok' => true]);
    }

    /** GET /raid/active — combate RAID (en cola o activo) en el que participo, si hay alguno. */
    public function active(Request $request): JsonResponse
    {
        $user = $request->user();
        $rp = RaidCombatPlayer::where('user_id', $user->id)->where('status', 'activo')
            ->whereHas('raidCombat', fn ($q) => $q->whereIn('status', ['esperando', 'activo']))
            ->with('raidCombat')->latest()->first();

        if (! $rp) {
            return response()->json(['raid' => null]);
        }

        return response()->json(['raid' => $this->formatRaid($rp->raidCombat->load(['npc', 'jugadores.user.character']), $user->id)]);
    }

    /** GET /raid/{id} — estado completo (para polling). */
    public function show(Request $request, int $id): JsonResponse
    {
        $raid = RaidCombat::with(['npc', 'jugadores.user.character'])->findOrFail($id);
        $user = $request->user();

        if (! $raid->jugadores->contains('user_id', $user->id)) {
            return response()->json(['error' => 'No participas en este combate.'], 403);
        }

        $log = $raid->log ?? [];
        if ($this->checkTurnTimeout($raid, $log)) {
            $raid->log = $log;
            $raid->save();
            $raid->refresh()->load(['npc', 'jugadores.user.character']);
        }

        return response()->json(['raid' => $this->formatRaid($raid, $user->id)]);
    }

    /** POST /raid/{id}/emoji — expresión cosmética, disponible en cualquier momento (no consume turno). */
    public function emoji(Request $request, int $id): JsonResponse
    {
        $data = $request->validate([
            'emote_id' => ['required', 'string', 'in:'.implode(',', array_keys(self::EMOTES))],
        ]);

        $user = $request->user();
        $raid = RaidCombat::with(['npc', 'jugadores.user.character'])->findOrFail($id);

        $myPlayer = $raid->jugadores->firstWhere('user_id', $user->id);
        if (! $myPlayer) {
            return response()->json(['error' => 'No participas en este combate.'], 403);
        }
        if (! $raid->isActive()) {
            return response()->json(['error' => 'El combate no está activo.'], 422);
        }

        $actorChar = $myPlayer->user->character;
        $emote = self::EMOTES[$data['emote_id']];

        $log = $raid->log ?? [];
        $log[] = [
            'turn' => count($log) + 1,
            'actor' => 'jugador',
            'actor_id' => $user->id,
            'type' => 'emoji',
            'emoji' => $emote['emoji'],
            'messages' => ["{$actorChar->name} {$emote['desc']} {$emote['emoji']} ({$emote['label']})"],
        ];
        $raid->log = $log;
        $raid->save();

        return response()->json([
            'raid' => $this->formatRaid($raid->fresh(['npc', 'jugadores.user.character']), $user->id),
        ]);
    }

    /** POST /raid/{id}/action — ataque/habilidad/cambio de forma/huida del jugador cuyo turno es. */
    public function action(Request $request, int $id): JsonResponse
    {
        $raid = RaidCombat::with(['npc', 'jugadores.user.character'])->findOrFail($id);
        $user = $request->user();

        if (! $raid->isActive()) {
            return response()->json(['error' => 'El combate no está activo.'], 422);
        }

        $myPlayer = $raid->jugadores->firstWhere('user_id', $user->id);
        if (! $myPlayer) {
            return response()->json(['error' => 'No participas en este combate.'], 403);
        }
        if ($myPlayer->status !== 'activo' || $myPlayer->hp <= 0) {
            return response()->json(['error' => 'Ya no participas activamente en este combate.'], 422);
        }

        $current = $raid->turn_order[$raid->turn_index] ?? null;
        if (! $current || $current['type'] !== 'player' || (int) $current['user_id'] !== $user->id) {
            return response()->json(['error' => 'No es tu turno.'], 422);
        }

        $data = $request->validate([
            'skill' => 'required',
            'forma' => 'nullable|integer|min:1|max:7',
            'target_user_id' => 'nullable|integer',
        ]);

        $skill = $data['skill'];
        $actorChar = $myPlayer->user->character;

        $myCooldowns = array_filter(array_map(fn ($v) => $v - 1, $myPlayer->cooldowns ?? []), fn ($v) => $v > 0);
        $myBuffs = $myPlayer->buffs ?? [];
        $myDebuffs = $myPlayer->debuffs ?? [];
        $myFuerza = $myPlayer->fuerza;

        $actorStats = self::getEffectiveStats(self::getCombatStats($actorChar), $myBuffs, $myDebuffs);
        $npcEffective = self::getEffectiveStats(self::getNpcStats($raid->npc), $raid->npc_buffs ?? [], $raid->npc_debuffs ?? []);

        $log = $raid->log ?? [];
        $entry = ['turn' => count($log) + 1, 'actor' => 'jugador', 'actor_id' => $user->id, 'messages' => []];

        if ($skill === 'flee') {
            $roll = self::rollIniciativa($actorStats['iniciativa'], $npcEffective['iniciativa']);
            $entry['messages'][] = "{$actorChar->name} intenta huir: 1d20({$roll['atk_dado']})+{$actorStats['iniciativa']}={$roll['atk_total']} "
                ."vs 1d20({$roll['def_dado']})+{$npcEffective['iniciativa']}={$roll['def_total']}";
            if ($roll['gana_atacante']) {
                $myPlayer->status = 'huido';
                $entry['messages'][] = "¡{$actorChar->name} logra huir del combate!";
            } else {
                $entry['messages'][] = "{$actorChar->name} no logra huir y pierde el turno";
            }
            $entry['dice'] = ['atk' => $roll['atk_dado'], 'def' => $roll['def_dado']];
            $entry['hit'] = $roll['gana_atacante'];
        } elseif ($skill === 'stance') {
            $forma = (int) ($data['forma'] ?? 1);
            if ($forma < 1 || $forma > 7) {
                return response()->json(['error' => 'Forma inválida'], 422);
            }
            $myPlayer->current_forma = $forma;
            $entry['messages'][] = "{$actorChar->name} cambia a Forma {$forma}";
        } elseif ($skill === 'unarmed') {
            $arma = $actorChar->armaEfectiva();
            $esDistancia = ($arma['tipo_ataque'] ?? null) === 'distancia';
            $atkVal = $esDistancia ? $actorStats['punteria'] : $actorStats['ataque'];
            $defVal = $esDistancia ? $npcEffective['movimiento'] : $npcEffective['defensa'];
            $atkDado = random_int(1, 20);
            $defDado = random_int(1, 20);
            $atkRoll = $atkDado + $atkVal;
            $defRoll = $defDado + $defVal;
            $critico = $arma['critico'] ?? 0;
            $esCritico = $atkDado >= (20 - $critico);
            $accion = $arma ? "ataca con {$arma['nombre']}" : 'ataca desarmado';
            $entry['messages'][] = "{$actorChar->name} {$accion} a {$raid->npc->nombre}: 1d20({$atkDado})+{$atkVal}={$atkRoll} vs 1d20({$defDado})+{$defVal}={$defRoll}";
            $entry['dice'] = ['atk' => $atkDado, 'def' => $defDado];
            $entry['hit'] = $esCritico || $atkRoll > $defRoll;
            $entry['crit'] = $esCritico;

            if ($esCritico || $atkRoll > $defRoll) {
                $dmg = ($arma['dano'] ?? 3) + ($esCritico ? 1 : 0);
                $dmgPerforante = (int) ($arma['dano_perforante'] ?? 0);
                $escudoAntes = $raid->npc_escudo;
                [$raid->npc_hp, $raid->npc_escudo] = self::applyDamage($raid->npc_hp, $raid->npc_escudo, $dmg, 0, $dmgPerforante);
                $myPlayer->dano_al_jefe += $dmg + $dmgPerforante;
                $desc = self::describeDano($dmg, 0, $dmgPerforante, $escudoAntes);
                $entry['messages'][] = $esCritico ? "¡CRÍTICO! {$desc}" : "¡Impacto! {$desc}";
            } else {
                $entry['messages'][] = "{$actorChar->name} falla el golpe";
            }
        } else {
            $skillId = (int) $skill;
            $porForma = is_array($actorChar->habilidades_por_forma) ? $actorChar->habilidades_por_forma : [];
            $slotIds = array_filter($porForma[(string) $myPlayer->current_forma] ?? []);

            if (! in_array($skillId, $slotIds)) {
                return response()->json(['error' => 'Habilidad no disponible en esta forma'], 422);
            }

            $hab = RolHabilidad::find($skillId);
            if (! $hab) {
                return response()->json(['error' => 'Habilidad no encontrada'], 422);
            }
            if (($myCooldowns[(string) $skillId] ?? 0) > 0) {
                return response()->json(['error' => 'Habilidad en cooldown'], 422);
            }
            if ($myFuerza < $hab->costo_fuerza) {
                return response()->json(['error' => "Fuerza insuficiente ({$myFuerza}/{$hab->costo_fuerza})"], 422);
            }

            $myFuerza -= $hab->costo_fuerza;
            if ($hab->cooldown > 0) {
                $myCooldowns[(string) $skillId] = $hab->cooldown;
            }

            $habBuff = is_array($hab->buff) ? $hab->buff : [];
            $habDebuff = is_array($hab->debuff) ? $hab->debuff : [];
            $habRondas = $hab->duracion ?: 2;
            $dmg = (int) ($hab->damage ?? 0);
            $dmgEscudo = (int) ($hab->damage_escudo ?? 0);
            $dmgPerforante = (int) ($hab->damage_perforante ?? 0);

            if ($hab->objetivo === 'self') {
                /* En RAID, una habilidad "self" no afecta automáticamente a quien la usa:
                 * el jugador elige a cuál de los 4 combatientes (incluso él mismo) afecta. */
                $targetUserId = (int) ($data['target_user_id'] ?? $user->id);
                $targetPlayer = $raid->jugadores->firstWhere('user_id', $targetUserId);
                if (! $targetPlayer || $targetPlayer->status !== 'activo') {
                    return response()->json(['error' => 'Objetivo inválido — debe ser un combatiente activo del grupo.'], 422);
                }
                $esUnoMismo = $targetPlayer->id === $myPlayer->id;
                $targetChar = $targetPlayer->user->character;
                $entry['target_user_id'] = $targetUserId;

                $buffDesc = ! empty($habBuff) ? ' (+'.implode(', +', $habBuff).')' : '';
                $entry['messages'][] = $esUnoMismo
                    ? "{$actorChar->name} usa {$hab->nombre}{$buffDesc}"
                    : "{$actorChar->name} usa {$hab->nombre} en {$targetChar->name}{$buffDesc}";

                $targetBuffsArr = $esUnoMismo ? $myBuffs : ($targetPlayer->buffs ?? []);
                foreach ($habBuff as $stat) {
                    $targetBuffsArr[] = ['stat' => $stat, 'turns' => $habRondas];
                }

                $targetMax = self::getCombatStats($targetChar);
                $targetHp = $esUnoMismo ? $myPlayer->hp : $targetPlayer->hp;
                $targetEscudo = $esUnoMismo ? $myPlayer->escudo : $targetPlayer->escudo;

                if ($dmg < 0) {
                    $heal = -$dmg;
                    $newHp = min($targetMax['vida'], $targetHp + $heal);
                    if ($esUnoMismo) {
                        $myPlayer->hp = $newHp;
                    } else {
                        $targetPlayer->hp = $newHp;
                    }
                    $entry['messages'][] = "¡Curación! +{$heal} vida".($esUnoMismo ? '' : " a {$targetChar->name}");
                }
                if ($dmgEscudo < 0) {
                    $healEsc = -$dmgEscudo;
                    $newEsc = min($targetMax['escudo'], $targetEscudo + $healEsc);
                    if ($esUnoMismo) {
                        $myPlayer->escudo = $newEsc;
                    } else {
                        $targetPlayer->escudo = $newEsc;
                    }
                    $entry['messages'][] = "¡Escudo restaurado! +{$healEsc}".($esUnoMismo ? '' : " a {$targetChar->name}");
                }

                if ($esUnoMismo) {
                    $myBuffs = $targetBuffsArr;
                } else {
                    $targetPlayer->buffs = $targetBuffsArr;
                    $targetPlayer->save();
                }
            } elseif ($dmg < 0) {
                $heal = -$dmg;
                $maxHp = self::getNpcStats($raid->npc)['vida'];
                $raid->npc_hp = min($maxHp, $raid->npc_hp + $heal);
                $entry['messages'][] = "{$actorChar->name} usa {$hab->nombre}: cura +{$heal} vida a {$raid->npc->nombre}";
            } else {
                $useAtq = $hab->tipo === 'melee';
                $atkVal = $useAtq ? $actorStats['ataque'] : $actorStats['punteria'];
                $defVal = $useAtq ? $npcEffective['defensa'] : $npcEffective['movimiento'];
                $atkDado = random_int(1, 20);
                $defDado = random_int(1, 20);
                $atkRoll = $atkDado + $atkVal;
                $defRoll = $defDado + $defVal;

                $entry['messages'][] = "{$actorChar->name} usa {$hab->nombre} contra {$raid->npc->nombre}: "
                    ."1d20({$atkDado})+{$atkVal}={$atkRoll} vs 1d20({$defDado})+{$defVal}={$defRoll}";
                $entry['dice'] = ['atk' => $atkDado, 'def' => $defDado];
                $entry['hit'] = $atkRoll > $defRoll;

                if ($atkRoll > $defRoll) {
                    $effective = self::isEffective((int) $hab->forma, (int) $raid->npc_forma);
                    if ($effective) {
                        $dmg = (int) round($dmg * 1.5);
                        $dmgEscudo = (int) round($dmgEscudo * 1.5);
                        $dmgPerforante = (int) round($dmgPerforante * 1.5);
                    }
                    $escudoAntes = $raid->npc_escudo;
                    [$raid->npc_hp, $raid->npc_escudo] = self::applyDamage($raid->npc_hp, $raid->npc_escudo, $dmg, $dmgEscudo, $dmgPerforante);
                    $myPlayer->dano_al_jefe += max(0, $dmg) + max(0, $dmgEscudo) + max(0, $dmgPerforante);

                    $npcDebuffs = $raid->npc_debuffs ?? [];
                    foreach ($habDebuff as $stat) {
                        $npcDebuffs[] = ['stat' => $stat, 'turns' => $habRondas];
                    }
                    $raid->npc_debuffs = $npcDebuffs;

                    $desc = self::describeDano($dmg, $dmgEscudo, $dmgPerforante, $escudoAntes);
                    $entry['messages'][] = ($effective ? '¡Forma efectiva! ×1.5 — ' : '')."¡Impacto! {$desc}";
                } else {
                    $entry['messages'][] = "{$actorChar->name} falla el ataque";
                }
            }
        }

        $myPlayer->fuerza = $myFuerza;
        $myPlayer->cooldowns = $myCooldowns ?: null;
        $myPlayer->buffs = $myBuffs ?: null;
        $myPlayer->debuffs = $myDebuffs ?: null;

        if ($raid->npc_hp <= 0 && $raid->status === 'activo') {
            $raid->status = 'ganado';
            $entry['messages'][] = "¡{$raid->npc->nombre} ha sido derrotado! Victoria del grupo.";
            $this->grantVictoryRewards($raid);
        }

        $log[] = $entry;

        if ($raid->status === 'activo') {
            $this->advanceIndex($raid, $log);
            $this->settleFromCurrentPosition($raid, $log);
        }

        $myPlayer->save();
        $raid->log = $log;
        $raid->save();

        return response()->json(['raid' => $this->formatRaid($raid->fresh(['npc', 'jugadores.user.character']), $user->id)]);
    }

    // ─────────────────────────── lógica de turnos ──────────────────────────

    /** Arranca el combate: tirada de iniciativa inicial y resuelve turnos de jefe en cadena si corresponde. */
    private function startCombat(RaidCombat $raid): void
    {
        $raid->load('jugadores.user.character', 'npc');

        $log = [['turn' => 1, 'actor' => 'sistema', 'messages' => [
            "¡Todos los combatientes están listos! Comienza el asalto contra {$raid->npc->nombre}.",
        ]]];

        $raid->status = 'activo';
        $raid->ronda = 1;
        $this->beginRound($raid, $log);
        $this->settleFromCurrentPosition($raid, $log);

        $raid->log = $log;
        $raid->save();
    }

    /** Tira iniciativa para el jefe y los jugadores activos, genera fuerza de ronda, y fija el nuevo turn_order. */
    private function beginRound(RaidCombat $raid, array &$log): void
    {
        $rolls = [];

        foreach ($raid->jugadores as $rp) {
            if ($rp->status !== 'activo' || $rp->hp <= 0) {
                continue;
            }
            $char = $rp->user->character;
            $cfg = self::fuerzaConfig($char);
            $rp->fuerza = min($cfg['max'], $rp->fuerza + $cfg['gen']);
            $rp->save();

            $stats = self::getEffectiveStats(self::getCombatStats($char), $rp->buffs ?? [], $rp->debuffs ?? []);
            $dado = random_int(1, 20);
            $rolls[] = ['type' => 'player', 'user_id' => $rp->user_id, 'dado' => $dado, 'total' => $dado + $stats['iniciativa'], 'nombre' => $char->name];
        }

        if ($raid->npc_hp > 0) {
            $stats = self::getEffectiveStats(self::getNpcStats($raid->npc), $raid->npc_buffs ?? [], $raid->npc_debuffs ?? []);
            $dado = random_int(1, 20);
            $rolls[] = ['type' => 'npc', 'user_id' => null, 'dado' => $dado, 'total' => $dado + $stats['iniciativa'], 'nombre' => $raid->npc->nombre];
        }

        usort($rolls, fn ($a, $b) => $b['total'] <=> $a['total']);

        $orden = collect($rolls)->map(fn ($r) => "{$r['nombre']} 1d20({$r['dado']})={$r['total']}")->implode(' | ');
        $log[] = ['turn' => count($log) + 1, 'actor' => 'sistema', 'messages' => ["Ronda {$raid->ronda} — Orden de turnos: {$orden}"]];

        $raid->turn_order = array_map(fn ($r) => ['type' => $r['type'], 'user_id' => $r['user_id']], $rolls);
        $raid->turn_index = 0;
        $raid->turn_started_at = now();
    }

    /** Avanza el puntero de turno; al completar una ronda, tiquea efectos y arranca una nueva ronda. */
    private function advanceIndex(RaidCombat $raid, array &$log): void
    {
        if ($raid->status !== 'activo') {
            return;
        }

        $raid->turn_index++;

        if ($raid->turn_index >= count($raid->turn_order ?? [])) {
            foreach ($raid->jugadores as $rp) {
                if ($rp->status !== 'activo') {
                    continue;
                }
                $rp->buffs = self::tickEffects($rp->buffs ?? []) ?: null;
                $rp->debuffs = self::tickEffects($rp->debuffs ?? []) ?: null;
                $rp->save();
            }
            $raid->npc_buffs = self::tickEffects($raid->npc_buffs ?? []) ?: null;
            $raid->npc_debuffs = self::tickEffects($raid->npc_debuffs ?? []) ?: null;

            $activos = $raid->jugadores->where('status', 'activo')->where('hp', '>', 0)->count();
            if ($activos === 0) {
                $raid->status = 'perdido';
                $log[] = ['turn' => count($log) + 1, 'actor' => 'sistema', 'messages' => ['Todos los jugadores han caído. El jefe los ha derrotado.']];

                return;
            }

            $raid->ronda++;
            $this->beginRound($raid, $log);

            return;
        }

        $raid->turn_started_at = now();
    }

    /**
     * Si el turno actual es de un jugador y superó `raid_max_wait` segundos sin actuar,
     * registra la pérdida de turno y lo avanza (posiblemente resolviendo turnos del jefe
     * a continuación). Se revisa en cada polling de show() ya que no hay cron/queue en
     * este sistema sincrónico. Devuelve true si se aplicó un salto de turno.
     */
    private function checkTurnTimeout(RaidCombat $raid, array &$log): bool
    {
        if (! $raid->isActive() || ! $raid->turn_started_at) {
            return false;
        }

        $current = $raid->turn_order[$raid->turn_index] ?? null;
        if (! $current || $current['type'] !== 'player') {
            return false;
        }

        $maxWait = (int) Configuracion::valor('raid_max_wait', 30);
        if ($raid->turn_started_at->diffInSeconds(now()) < $maxWait) {
            return false;
        }

        $rp = $raid->jugadores->firstWhere('user_id', $current['user_id']);
        $nombre = $rp?->user?->character?->name ?? 'El jugador';
        $log[] = ['turn' => count($log) + 1, 'actor' => 'sistema', 'messages' => ["{$nombre} no actuó a tiempo y pierde su turno."]];

        $this->advanceIndex($raid, $log);
        $this->settleFromCurrentPosition($raid, $log);

        return true;
    }

    /** Desde la posición actual del puntero, resuelve automáticamente todos los turnos del jefe (y salta jugadores inactivos) hasta topar con un jugador activo o el fin del combate. */
    private function settleFromCurrentPosition(RaidCombat $raid, array &$log): void
    {
        while ($raid->status === 'activo') {
            $current = $raid->turn_order[$raid->turn_index] ?? null;
            if (! $current) {
                break;
            }

            if ($current['type'] === 'npc') {
                $this->resolveNpcTurn($raid, $log);
                $this->advanceIndex($raid, $log);

                continue;
            }

            $rp = $raid->jugadores->firstWhere('user_id', $current['user_id']);
            if ($rp && $rp->status === 'activo' && $rp->hp > 0) {
                break;
            }
            $this->advanceIndex($raid, $log);
        }
    }

    /** IA del jefe: prioriza al jugador que más daño le ha hecho; un crítico ataca a todos los jugadores activos a la vez. */
    private function resolveNpcTurn(RaidCombat $raid, array &$log): void
    {
        $npc = $raid->npc;
        $activos = $raid->jugadores->where('status', 'activo')->where('hp', '>', 0)->values();

        if ($activos->isEmpty()) {
            $raid->status = 'perdido';
            $log[] = ['turn' => count($log) + 1, 'actor' => 'sistema', 'messages' => ['Todos los jugadores han caído. El jefe los ha derrotado.']];

            return;
        }

        $target = $activos->sortByDesc('dano_al_jefe')->first();
        $targetChar = $target->user->character;

        $npcStats = self::getEffectiveStats(self::getNpcStats($npc), $raid->npc_buffs ?? [], $raid->npc_debuffs ?? []);
        $npcCooldowns = array_filter(array_map(fn ($v) => $v - 1, $raid->npc_cooldowns ?? []), fn ($v) => $v > 0);

        $disponibles = array_values(array_filter($npc->habilidadIds(), fn ($hid) => ($npcCooldowns[(string) $hid] ?? 0) <= 0));
        $hab = (! empty($disponibles) && random_int(1, 100) <= 60)
            ? RolHabilidad::find($disponibles[array_rand($disponibles)])
            : null;

        $dmgBase = $hab ? (int) ($hab->damage ?? 0) : max(1, (int) round($npcStats['ataque'] * 0.3));
        $dmgEscudoBase = $hab ? (int) ($hab->damage_escudo ?? 0) : 0;
        $dmgPerfBase = $hab ? (int) ($hab->damage_perforante ?? 0) : 0;
        $formaAtaque = $hab ? (int) $hab->forma : (int) $raid->npc_forma;
        $accion = $hab ? "usa {$hab->nombre}" : 'ataca';

        /* Bono por nivel de dificultad: +nivel de daño (o de curación si dmgBase es negativo) */
        $dmgBase += $dmgBase >= 0 ? $npc->nivelDificultad() : -$npc->nivelDificultad();

        if ($hab && $hab->cooldown > 0) {
            $npcCooldowns[(string) $hab->id] = $hab->cooldown;
        }
        $raid->npc_cooldowns = $npcCooldowns ?: null;

        $targetStats = self::getEffectiveStats(self::getCombatStats($targetChar), $target->buffs ?? [], $target->debuffs ?? []);
        $atkDado = random_int(1, 20);
        $defDado = random_int(1, 20);
        $atkVal = $npcStats['ataque'];
        $defVal = $targetStats['defensa'];
        $atkRoll = $atkDado + $atkVal;
        $defRoll = $defDado + $defVal;
        $esCritico = $atkDado >= $npc->critThreshold(); // Umbral según nivel de dificultad (ej. nivel 4 → 21-4=17, crítico con 17-20)

        $log[] = [
            'turn' => count($log) + 1, 'actor' => 'npc',
            'target_user_id' => $target->user_id,
            'dice' => ['atk' => $atkDado, 'def' => $defDado],
            'messages' => [
                "{$npc->nombre} {$accion} contra {$targetChar->name}: 1d20({$atkDado})+{$atkVal}={$atkRoll} vs 1d20({$defDado})+{$defVal}={$defRoll}",
            ],
        ];

        if (! ($esCritico || $atkRoll > $defRoll)) {
            $log[] = [
                'turn' => count($log) + 1, 'actor' => 'npc', 'hit' => false, 'target_user_id' => $target->user_id,
                'messages' => ["{$targetChar->name} esquiva/bloquea el ataque de {$npc->nombre}."],
            ];

            return;
        }

        if ($esCritico) {
            $critBonus = $npc->nivelBonoCritico();
            $msgs = ["¡CRÍTICO! {$npc->nombre} concentra su furia y golpea a todos los combatientes."];
            $targets = [];
            foreach ($activos as $rp) {
                $rpChar = $rp->user->character;
                $rpEffective = self::isEffective($formaAtaque, (int) $rp->current_forma);
                $d = ($rpEffective ? (int) round($dmgBase * 1.5) : $dmgBase) + $critBonus;
                $dE = $rpEffective ? (int) round($dmgEscudoBase * 1.5) : $dmgEscudoBase;
                $dP = $rpEffective ? (int) round($dmgPerfBase * 1.5) : $dmgPerfBase;
                $escudoAntes = $rp->escudo;
                [$rp->hp, $rp->escudo] = self::applyDamage($rp->hp, $rp->escudo, $d, $dE, $dP);
                if ($rp->hp <= 0) {
                    $rp->status = 'derrotado';
                }
                $rp->save();
                $desc = self::describeDano($d, $dE, $dP, $escudoAntes);
                $msgs[] = "{$rpChar->name}: {$desc}".($rpEffective ? ' (¡forma efectiva!)' : '');
                $targets[] = ['user_id' => $rp->user_id, 'effective' => $rpEffective];
            }
            $log[] = ['turn' => count($log) + 1, 'actor' => 'npc', 'crit' => true, 'hit' => true, 'aoe' => true, 'targets' => $targets, 'messages' => $msgs];
        } else {
            $effective = self::isEffective($formaAtaque, (int) $target->current_forma);
            $dmg = $effective ? (int) round($dmgBase * 1.5) : $dmgBase;
            $dmgEscudo = $effective ? (int) round($dmgEscudoBase * 1.5) : $dmgEscudoBase;
            $dmgPerf = $effective ? (int) round($dmgPerfBase * 1.5) : $dmgPerfBase;
            $escudoAntes = $target->escudo;
            [$target->hp, $target->escudo] = self::applyDamage($target->hp, $target->escudo, $dmg, $dmgEscudo, $dmgPerf);
            if ($target->hp <= 0) {
                $target->status = 'derrotado';
            }

            if ($hab) {
                $habDebuff = is_array($hab->debuff) ? $hab->debuff : [];
                if (! empty($habDebuff)) {
                    $tb = $target->debuffs ?? [];
                    foreach ($habDebuff as $stat) {
                        $tb[] = ['stat' => $stat, 'turns' => $hab->duracion ?: 2];
                    }
                    $target->debuffs = $tb;
                }
            }
            $target->save();

            $desc = self::describeDano($dmg, $dmgEscudo, $dmgPerf, $escudoAntes);
            $log[] = [
                'turn' => count($log) + 1, 'actor' => 'npc', 'hit' => true, 'crit' => false,
                'target_user_id' => $target->user_id, 'effective' => $effective,
                'messages' => [($effective ? '¡Forma efectiva! ×1.5 — ' : '')."¡Impacto! {$desc}"],
            ];
        }

        if ($raid->jugadores->where('status', 'activo')->where('hp', '>', 0)->count() === 0) {
            $raid->status = 'perdido';
            $log[] = ['turn' => count($log) + 1, 'actor' => 'sistema', 'messages' => ['Todos los jugadores han caído. El jefe los ha derrotado.']];
        }
    }

    /** Hito + progreso de misión para todos los participantes que no huyeron. */
    private function grantVictoryRewards(RaidCombat $raid): void
    {
        foreach ($raid->jugadores as $rp) {
            if ($rp->status === 'huido') {
                continue;
            }
            $rpUser = $rp->user;
            $rpChar = $rpUser->character;
            if ($rpChar) {
                CharacterHito::firstOrCreate([
                    'character_id' => $rpChar->id,
                    'hito' => "{$raid->npc->nombre} derrotado",
                ]);
                MisionProgresoService::registrar($rpUser, 'combate', 1);
            }
        }
    }

    // ─────────────────────────── formato de respuesta ──────────────────────

    private function formatRaid(RaidCombat $raid, int $myUserId): array
    {
        $npc = $raid->npc;
        $npcBase = self::getNpcStats($npc);
        $npcEffective = self::getEffectiveStats($npcBase, $raid->npc_buffs ?? [], $raid->npc_debuffs ?? []);
        $current = $raid->turn_order[$raid->turn_index] ?? null;

        $jugadores = $raid->jugadores->sortBy('slot')->map(function (RaidCombatPlayer $rp) use ($current) {
            $ch = $rp->user->character;
            $porForma = is_array($ch->habilidades_por_forma ?? null) ? $ch->habilidades_por_forma : [];
            $slotIds = array_filter($porForma[(string) $rp->current_forma] ?? []);
            $habilidades = $slotIds
                ? RolHabilidad::whereIn('id', $slotIds)->get()->map(fn ($h) => self::fmtHab($h))->values()
                : collect();
            $fCfg = self::fuerzaConfig($ch);
            $baseStats = self::getCombatStats($ch);
            $effStats = self::getEffectiveStats($baseStats, $rp->buffs ?? [], $rp->debuffs ?? []);

            return [
                'user_id' => $rp->user_id,
                'slot' => $rp->slot,
                'name' => $ch->name ?? $rp->user->name,
                'handle' => $ch->handle ?? $rp->user->name,
                'photo_url' => $ch?->photo ? Storage::disk('public')->url($ch->photo) : null,
                'hp' => $rp->hp,
                'max_hp' => $baseStats['vida'],
                'escudo' => $rp->escudo,
                'max_escudo' => $baseStats['escudo'],
                'fuerza' => $rp->fuerza,
                'fuerza_max' => $fCfg['max'],
                'current_forma' => $rp->current_forma,
                'ataque' => $effStats['ataque'],
                'defensa' => $effStats['defensa'],
                'punteria' => $effStats['punteria'],
                'movimiento' => $effStats['movimiento'],
                'ataque_base' => $baseStats['ataque'],
                'defensa_base' => $baseStats['defensa'],
                'punteria_base' => $baseStats['punteria'],
                'movimiento_base' => $baseStats['movimiento'],
                'cooldowns' => $rp->cooldowns ?? [],
                'buffs' => $rp->buffs ?? [],
                'debuffs' => $rp->debuffs ?? [],
                'status' => $rp->status,
                'dano_al_jefe' => $rp->dano_al_jefe,
                'habilidades' => $habilidades,
                'arma_equipada' => $ch?->armaEfectiva(),
                'listo' => (bool) $rp->listo,
                'es_yo' => false, // se completa más abajo
                'es_mi_turno' => (bool) ($current && $current['type'] === 'player' && (int) $current['user_id'] === $rp->user_id),
            ];
        })->values();

        $jugadores = $jugadores->map(function ($j) use ($myUserId) {
            $j['es_yo'] = $j['user_id'] === $myUserId;

            return $j;
        });

        $myPlayer = $jugadores->firstWhere('user_id', $myUserId);

        return [
            'id' => $raid->id,
            'status' => $raid->status,
            'ronda' => $raid->ronda,
            'turn_order' => $raid->turn_order ?? [],
            'turn_index' => $raid->turn_index,
            'turn_started_at' => $raid->turn_started_at?->toIso8601String(),
            'turn_max_wait' => (int) Configuracion::valor('raid_max_wait', 30),
            'es_turno_del_jefe' => (bool) ($current && $current['type'] === 'npc'),
            'log' => $raid->log ?? [],
            'npc' => [
                'id' => $npc->id,
                'nombre' => $npc->nombre,
                'imagen' => $npc->imagen ? Storage::disk('public')->url($npc->imagen) : null,
                'imagen_mini' => $npc->imagen_mini ? Storage::disk('public')->url($npc->imagen_mini) : null,
                'hp' => $raid->npc_hp,
                'max_hp' => $npcBase['vida'],
                'escudo' => $raid->npc_escudo,
                'max_escudo' => $npcBase['escudo'],
                'forma' => $raid->npc_forma,
                'nivel' => $npc->nivelDificultad(),
                'ataque' => $npcEffective['ataque'],
                'defensa' => $npcEffective['defensa'],
                'punteria' => $npcEffective['punteria'],
                'movimiento' => $npcEffective['movimiento'],
                'ataque_base' => $npcBase['ataque'],
                'defensa_base' => $npcBase['defensa'],
                'punteria_base' => $npcBase['punteria'],
                'movimiento_base' => $npcBase['movimiento'],
                'buffs' => $raid->npc_buffs ?? [],
                'debuffs' => $raid->npc_debuffs ?? [],
            ],
            'jugadores' => $jugadores->values(),
            'mi_slot' => $myPlayer['slot'] ?? null,
            'estoy_en_combate' => $myPlayer !== null,
            'lugar_id' => $raid->lugar_id,
            'cupos_totales' => count(self::slotsFor($npc)),
            'minimo_jugadores' => self::MIN_JUGADORES,
            'listos_count' => $jugadores->where('listo', true)->count(),
        ];
    }

    private static function fmtHab(RolHabilidad $h): array
    {
        return [
            'id' => $h->id,
            'nombre' => $h->nombre,
            'icono_url' => $h->icono ? Storage::disk('public')->url($h->icono) : null,
            'tipo' => $h->tipo,
            'forma' => $h->forma,
            'costo_fuerza' => $h->costo_fuerza,
            'damage' => $h->damage,
            'damage_escudo' => $h->damage_escudo,
            'damage_perforante' => $h->damage_perforante,
            'cooldown' => $h->cooldown,
            'objetivo' => $h->objetivo,
            'buff' => $h->buff ?? [],
            'debuff' => $h->debuff ?? [],
            'duracion' => $h->duracion,
            'efecto' => $h->efecto,
        ];
    }

    // ─────────────────────────── helpers de combate ─────────────────────────

    private static function getNpcStats(MapNpc $npc): array
    {
        return [
            'vida' => $npc->vida ?: 30,
            'escudo' => $npc->escudo ?: 0,
            'ataque' => $npc->ataque ?: 10,
            'defensa' => $npc->defensa ?: 10,
            'movimiento' => $npc->movimiento ?: 10,
            'iniciativa' => $npc->iniciativa ?: 10,
            'punteria' => $npc->punteria ?: 10,
        ];
    }

    private static function getCombatStats(?object $char): array
    {
        if (! $char) {
            return ['vida' => 30, 'escudo' => 10, 'ataque' => 20, 'defensa' => 15,
                'iniciativa' => 10, 'punteria' => 10, 'movimiento' => 20];
        }

        $s = is_array($char->stats) ? $char->stats : [];
        $f = $s['fuerza'] ?? 50;
        $v = $s['velocidad'] ?? 50;
        $t = $s['tecnica'] ?? 50;
        $d = $s['defensa'] ?? 50;
        $k = $s['foco'] ?? 50;
        $bonos = method_exists($char, 'sableBonos')
            ? $char->sableBonos()
            : ['ataque' => 0, 'defensa' => 0, 'punteria' => 0, 'movimiento' => 0, 'iniciativa' => 0, 'vida' => 0, 'escudo' => 0];

        return [
            'vida' => ($char->vida ?? (30 + (int) round($f * 1.5))) + $bonos['vida'],
            'escudo' => ($char->escudo ?? (10 + (int) round($t * 0.4))) + $bonos['escudo'],
            'ataque' => ($char->ataque ?? (int) round($f * 0.8)) + $bonos['ataque'],
            'defensa' => ($char->defensa ?? (int) round($d * 0.8)) + $bonos['defensa'],
            'movimiento' => ($char->movimiento ?? (int) round($v * 0.8)) + $bonos['movimiento'],
            'iniciativa' => ($char->iniciativa ?? (int) round(($v + $k) / 2 * 0.5)) + $bonos['iniciativa'],
            'punteria' => ($char->punteria ?? (int) round(($t + $k) / 2 * 0.5)) + $bonos['punteria'],
        ];
    }

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

    private static function rollIniciativa(int $attackerIniciativa, int $defenderIniciativa): array
    {
        $atkDado = random_int(1, 20);
        $defDado = random_int(1, 20);
        $atkTotal = $atkDado + $attackerIniciativa;
        $defTotal = $defDado + $defenderIniciativa;

        return [
            'atk_dado' => $atkDado,
            'def_dado' => $defDado,
            'atk_total' => $atkTotal,
            'def_total' => $defTotal,
            'gana_atacante' => $atkTotal >= $defTotal,
        ];
    }

    private static function getEffectiveStats(array $base, array $buffs, array $debuffs): array
    {
        $stats = $base;
        foreach ($buffs as $b) {
            if (isset($stats[$b['stat']])) {
                $stats[$b['stat']] += 1;
            }
        }
        foreach ($debuffs as $d) {
            if (isset($stats[$d['stat']])) {
                $stats[$d['stat']] = max(0, $stats[$d['stat']] - 1);
            }
        }

        return $stats;
    }

    private static function tickEffects(array $effects): array
    {
        return array_values(array_filter(
            array_map(fn ($e) => array_merge($e, ['turns' => $e['turns'] - 1]), $effects),
            fn ($e) => $e['turns'] > 0
        ));
    }

    private static function isEffective(int $atkForma, int $defForma): bool
    {
        if ($atkForma === 0 || $defForma === 0) {
            return false;
        }

        return in_array($defForma, self::BEATS[$atkForma] ?? [], true);
    }

    /**
     * Aplica daño con tres componentes: dmg (normal), dmgEscudo (extra solo contra
     * escudo) y dmgPerforante (ignora el escudo, siempre pasa a la vida). Misma
     * lógica que PvpCombatController/CombatController.
     */
    private static function applyDamage(int $hp, int $escudo, int $dmg, int $dmgEscudo = 0, int $dmgPerforante = 0): array
    {
        if ($escudo <= 0) {
            return [max(0, $hp - $dmg - $dmgPerforante), 0];
        }

        $escudoTrasComponenteEscudo = max(0, $escudo - max(0, $dmgEscudo));
        if ($escudoTrasComponenteEscudo > 0) {
            return [max(0, $hp - $dmgPerforante), max(0, $escudoTrasComponenteEscudo - $dmg)];
        }

        return [max(0, $hp - $dmg - $dmgPerforante), 0];
    }

    private static function describeDano(int $dmg, int $dmgEscudo, int $dmgPerforante, int $escudoAntes): string
    {
        if ($escudoAntes <= 0) {
            return '−'.($dmg + $dmgPerforante).' daño a la vida';
        }

        $escudoTrasComponenteEscudo = max(0, $escudoAntes - max(0, $dmgEscudo));
        if ($escudoTrasComponenteEscudo > 0) {
            $totalEscudo = $dmg + max(0, $dmgEscudo);
            $msg = "−{$totalEscudo} daño al escudo";
            if ($dmgPerforante > 0) {
                $msg .= ", −{$dmgPerforante} daño perforante a la vida";
            }

            return $msg;
        }

        $totalVida = $dmg + $dmgPerforante;

        return '−'.max(0, $dmgEscudo)." daño al escudo — ¡escudo perforado! −{$totalVida} daño a la vida";
    }
}
