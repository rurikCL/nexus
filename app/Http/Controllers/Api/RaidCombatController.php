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
use App\Services\RecompensaRollService;
use App\Support\Combat\AplicaEstadosCombate;
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
    use AplicaEstadosCombate;

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
        'saludar' => ['emoji' => '👋', 'label' => 'Saludar', 'desc' => 'saluda al grupo'],
        'curacion' => ['emoji' => '❤️‍🩹', 'label' => 'Solicitar curación', 'desc' => 'solicita curación'],
        'escudo' => ['emoji' => '🛡️', 'label' => 'Curar escudo', 'desc' => 'solicita curar escudo'],
        'buff' => ['emoji' => '✨', 'label' => 'Solicitar buff', 'desc' => 'solicita un buff'],
        'foco' => ['emoji' => '🎯', 'label' => 'Ataque concentrado', 'desc' => 'solicita ataque concentrado al jefe'],
        'debuff' => ['emoji' => '☠️', 'label' => 'Debuff al jefe', 'desc' => 'solicita debuff al jefe'],
        'quitar_agro' => ['emoji' => '🙋', 'label' => 'Quiten mi agro', 'desc' => 'solicita que le quiten el agro'],
        'si' => ['emoji' => '✅', 'label' => 'Sí', 'desc' => 'responde que sí'],
        'no' => ['emoji' => '❌', 'label' => 'No', 'desc' => 'responde que no'],
        'gracias' => ['emoji' => '🙏', 'label' => 'Gracias', 'desc' => 'agradece al equipo'],
        'felicitar' => ['emoji' => '👏', 'label' => 'Felicitar', 'desc' => 'felicita al grupo'],
        'sorprenderse' => ['emoji' => '😲', 'label' => 'Sorprenderse', 'desc' => 'se sorprende'],
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
        $myEstados = $myPlayer->estados ?? [];
        $npcEstados = $raid->npc_estados ?? [];
        $myFuerza = $myPlayer->fuerza;

        $actorStats = self::getEffectiveStats(self::getCombatStats($actorChar), $myBuffs, $myDebuffs);
        $npcEffective = self::getEffectiveStats(self::getNpcStats($raid->npc), $raid->npc_buffs ?? [], $raid->npc_debuffs ?? []);

        $log = $raid->log ?? [];
        $entry = ['turn' => count($log) + 1, 'actor' => 'jugador', 'actor_id' => $user->id, 'messages' => [], 'effects' => []];

        /* Parálisis: pierde el turno sin importar el skill enviado, y queda inmune al próximo intento */
        $paralisisInfo = self::resolverParalisisAlEmpezarTurno($myEstados);
        $myEstados = $paralisisInfo['estados'];

        if ($paralisisInfo['paralizado']) {
            $entry['messages'][] = "{$actorChar->name} está paralizado y pierde el turno";
        } elseif ($skill === 'flee') {
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
            $confundido = self::resolverConfundido($myEstados);
            if ($confundido) {
                $entry['messages'][] = "¡{$actorChar->name} está confundido y ataca hacia sí mismo!";
            }
            $statsObjetivo = $confundido ? $actorStats : $npcEffective;

            $arma = $actorChar->armaEfectiva();
            $esDistancia = ($arma['tipo_ataque'] ?? null) === 'distancia';
            $atkVal = $esDistancia ? $actorStats['punteria'] : $actorStats['ataque'];
            $defVal = $esDistancia ? $statsObjetivo['movimiento'] : $statsObjetivo['defensa'];
            $atkDado = self::mitigarTiradaAturdido($myEstados, random_int(1, 20));
            $defDado = self::mitigarTiradaAturdido($confundido ? $myEstados : $npcEstados, random_int(1, 20));
            $atkRoll = $atkDado + $atkVal;
            $defRoll = $defDado + $defVal;
            $critico = $arma['critico'] ?? 0;
            $esCritico = $atkDado >= (20 - $critico);
            $accion = $arma ? "ataca con {$arma['nombre']}" : 'ataca desarmado';
            $entry['messages'][] = "{$actorChar->name} {$accion} a {$raid->npc->nombre}: 1d20({$atkDado})+{$atkVal}={$atkRoll} vs 1d20({$defDado})+{$defVal}={$defRoll}";
            $entry['dice'] = ['atk' => $atkDado, 'def' => $defDado];

            $estadosObjetivo = $confundido ? $myEstados : $npcEstados;
            $protegidoInfo = self::consumirProtegido($estadosObjetivo);
            $estadosObjetivo = $protegidoInfo['estados'];
            $marcaInfo = self::consumirMarcado($estadosObjetivo, $atkDado);
            $estadosObjetivo = $marcaInfo['estados'];
            if ($confundido) {
                $myEstados = $estadosObjetivo;
            } else {
                $npcEstados = $estadosObjetivo;
            }

            $hit = $esCritico || $atkRoll > $defRoll;
            if ($protegidoInfo['activo']) {
                $hit = false;
                $entry['messages'][] = '¡El objetivo estaba protegido y bloquea el golpe automáticamente!';
            } elseif ($marcaInfo['activo']) {
                $hit = $marcaInfo['forzar_exito'];
                $entry['messages'][] = $hit
                    ? '¡El objetivo estaba marcado — el golpe conecta automáticamente!'
                    : '¡El objetivo estaba marcado, pero el ataque falla igual (natural 1)!';
            }
            $entry['hit'] = $hit;
            $entry['crit'] = $esCritico;

            if ($hit) {
                $dmg = self::mitigarDanoDebilitado($myEstados, ($arma['dano'] ?? 3) + ($esCritico ? 1 : 0));
                $dmgPerforante = (int) ($arma['dano_perforante'] ?? 0);
                if ($confundido) {
                    $escudoAntes = $myPlayer->escudo;
                    [$myPlayer->hp, $myPlayer->escudo] = self::applyDamage($myPlayer->hp, $myPlayer->escudo, $dmg, 0, $dmgPerforante);
                    if ($myPlayer->hp <= 0) {
                        $myPlayer->status = 'derrotado';
                    }
                } else {
                    $escudoAntes = $raid->npc_escudo;
                    [$raid->npc_hp, $raid->npc_escudo] = self::applyDamage($raid->npc_hp, $raid->npc_escudo, $dmg, 0, $dmgPerforante);
                    $myPlayer->dano_al_jefe += $dmg + $dmgPerforante;
                }
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

            /* El buff (si la habilidad tiene uno) SIEMPRE se aplica al usarla, sin importar
             * si además es una habilidad de ataque contra el jefe (igual que en PvP) — solo
             * las habilidades "self" permiten elegir a cuál de los combatientes del grupo
             * afecta; el resto siempre beneficia a quien la usa. */
            $buffTargetPlayer = $myPlayer;
            $esBuffUnoMismo = true;
            if ($hab->objetivo === 'self') {
                /* En RAID, una habilidad "self" no afecta automáticamente a quien la usa:
                 * el jugador elige a cuál de los 4 combatientes (incluso él mismo) afecta. */
                $targetUserId = (int) ($data['target_user_id'] ?? $user->id);
                $targetPlayer = $raid->jugadores->firstWhere('user_id', $targetUserId);
                if (! $targetPlayer || $targetPlayer->status !== 'activo') {
                    return response()->json(['error' => 'Objetivo inválido — debe ser un combatiente activo del grupo.'], 422);
                }
                $buffTargetPlayer = $targetPlayer;
                $esBuffUnoMismo = $targetPlayer->id === $myPlayer->id;
            }
            $buffTargetChar = $buffTargetPlayer->user->character;
            $buffTargetUserId = $buffTargetPlayer->user_id;

            $buffDesc = ! empty($habBuff) ? ' (+'.implode(', +', $habBuff).')' : '';
            if (! empty($habBuff)) {
                $targetBuffsArr = $esBuffUnoMismo ? $myBuffs : ($buffTargetPlayer->buffs ?? []);
                $targetEstadosArr = $esBuffUnoMismo ? $myEstados : ($buffTargetPlayer->estados ?? []);
                foreach ($habBuff as $stat) {
                    if (self::esTipoEstado($stat)) {
                        $targetEstadosArr = self::aplicarEstadoDeHabilidad($targetEstadosArr, $stat);
                    } else {
                        $targetBuffsArr[] = ['stat' => $stat, 'turns' => $habRondas];
                    }
                }
                if ($esBuffUnoMismo) {
                    $myBuffs = $targetBuffsArr;
                    $myEstados = $targetEstadosArr;
                } else {
                    $buffTargetPlayer->buffs = $targetBuffsArr;
                    $buffTargetPlayer->estados = $targetEstadosArr;
                }
                $entry['effects'][] = ['type' => 'buff', 'target_user_id' => $buffTargetUserId];
            }

            if ($hab->objetivo === 'self') {
                $entry['target_user_id'] = $buffTargetUserId;
                $entry['messages'][] = $esBuffUnoMismo
                    ? "{$actorChar->name} usa {$hab->nombre}{$buffDesc}"
                    : "{$actorChar->name} usa {$hab->nombre} en {$buffTargetChar->name}{$buffDesc}";

                $targetMax = self::getCombatStats($buffTargetChar);
                $targetHp = $esBuffUnoMismo ? $myPlayer->hp : $buffTargetPlayer->hp;
                $targetEscudo = $esBuffUnoMismo ? $myPlayer->escudo : $buffTargetPlayer->escudo;

                if ($dmg < 0) {
                    $heal = -$dmg;
                    $newHp = min($targetMax['vida'], $targetHp + $heal);
                    if ($esBuffUnoMismo) {
                        $myPlayer->hp = $newHp;
                    } else {
                        $buffTargetPlayer->hp = $newHp;
                    }
                    $entry['effects'][] = ['type' => 'heal', 'target_user_id' => $buffTargetUserId];
                    $entry['messages'][] = "¡Curación! +{$heal} vida".($esBuffUnoMismo ? '' : " a {$buffTargetChar->name}");
                }
                if ($dmgEscudo < 0) {
                    $healEsc = -$dmgEscudo;
                    $newEsc = min($targetMax['escudo'], $targetEscudo + $healEsc);
                    if ($esBuffUnoMismo) {
                        $myPlayer->escudo = $newEsc;
                    } else {
                        $buffTargetPlayer->escudo = $newEsc;
                    }
                    $entry['effects'][] = ['type' => 'heal', 'target_user_id' => $buffTargetUserId];
                    $entry['messages'][] = "¡Escudo restaurado! +{$healEsc}".($esBuffUnoMismo ? '' : " a {$buffTargetChar->name}");
                }

                if (! $esBuffUnoMismo) {
                    $buffTargetPlayer->save();
                }

                /* Una habilidad "self" no tiene tirada de ataque — si además carga un debuff
                 * (p.ej. un estado) para el jefe, se aplica sin condición de impacto. */
                if (! empty($habDebuff)) {
                    $npcDebuffsArr = $raid->npc_debuffs ?? [];
                    foreach ($habDebuff as $stat) {
                        if (self::esTipoEstado($stat)) {
                            $npcEstados = self::aplicarEstadoDeHabilidad($npcEstados, $stat);
                        } else {
                            $npcDebuffsArr[] = ['stat' => $stat, 'turns' => $habRondas];
                        }
                    }
                    $raid->npc_debuffs = $npcDebuffsArr;
                    $entry['messages'][] = "{$raid->npc->nombre} sufre: ".implode(', ', $habDebuff);
                }
            } elseif ($dmg < 0) {
                $heal = -$dmg;
                $maxHp = self::getNpcStats($raid->npc)['vida'];
                $raid->npc_hp = min($maxHp, $raid->npc_hp + $heal);
                $entry['messages'][] = "{$actorChar->name} usa {$hab->nombre}: cura +{$heal} vida a {$raid->npc->nombre}";
            } else {
                $confundidoHab = self::resolverConfundido($myEstados);
                if ($confundidoHab) {
                    $entry['messages'][] = "¡{$actorChar->name} está confundido y ataca hacia sí mismo!";
                }
                $statsObjetivoHab = $confundidoHab ? $actorStats : $npcEffective;

                $useAtq = $hab->tipo === 'melee';
                $atkVal = $useAtq ? $actorStats['ataque'] : $actorStats['punteria'];
                $defVal = $useAtq ? $statsObjetivoHab['defensa'] : $statsObjetivoHab['movimiento'];
                $atkDado = self::mitigarTiradaAturdido($myEstados, random_int(1, 20));
                $defDado = self::mitigarTiradaAturdido($confundidoHab ? $myEstados : $npcEstados, random_int(1, 20));
                $atkRoll = $atkDado + $atkVal;
                $defRoll = $defDado + $defVal;

                $entry['messages'][] = "{$actorChar->name} usa {$hab->nombre} contra {$raid->npc->nombre}: "
                    ."1d20({$atkDado})+{$atkVal}={$atkRoll} vs 1d20({$defDado})+{$defVal}={$defRoll}";
                $entry['dice'] = ['atk' => $atkDado, 'def' => $defDado];

                $estadosObjetivoHab = $confundidoHab ? $myEstados : $npcEstados;
                $protegidoHab = self::consumirProtegido($estadosObjetivoHab);
                $estadosObjetivoHab = $protegidoHab['estados'];
                $marcaHab = self::consumirMarcado($estadosObjetivoHab, $atkDado);
                $estadosObjetivoHab = $marcaHab['estados'];
                if ($confundidoHab) {
                    $myEstados = $estadosObjetivoHab;
                } else {
                    $npcEstados = $estadosObjetivoHab;
                }

                $hitHab = $atkRoll > $defRoll;
                if ($protegidoHab['activo']) {
                    $hitHab = false;
                    $entry['messages'][] = '¡El objetivo estaba protegido y bloquea el golpe automáticamente!';
                } elseif ($marcaHab['activo']) {
                    $hitHab = $marcaHab['forzar_exito'];
                    $entry['messages'][] = $hitHab
                        ? '¡El objetivo estaba marcado — el golpe conecta automáticamente!'
                        : '¡El objetivo estaba marcado, pero el ataque falla igual (natural 1)!';
                }
                $entry['hit'] = $hitHab;

                if ($hitHab) {
                    $effective = $confundidoHab ? false : self::isEffective((int) $hab->forma, (int) $raid->npc_forma);
                    if ($effective) {
                        $dmg = (int) round($dmg * 1.5);
                        $dmgEscudo = (int) round($dmgEscudo * 1.5);
                        $dmgPerforante = (int) round($dmgPerforante * 1.5);
                    }
                    $dmg = self::mitigarDanoDebilitado($myEstados, $dmg);

                    if ($confundidoHab) {
                        $escudoAntes = $myPlayer->escudo;
                        [$myPlayer->hp, $myPlayer->escudo] = self::applyDamage($myPlayer->hp, $myPlayer->escudo, $dmg, $dmgEscudo, $dmgPerforante);
                        if ($myPlayer->hp <= 0) {
                            $myPlayer->status = 'derrotado';
                        }
                    } else {
                        $escudoAntes = $raid->npc_escudo;
                        [$raid->npc_hp, $raid->npc_escudo] = self::applyDamage($raid->npc_hp, $raid->npc_escudo, $dmg, $dmgEscudo, $dmgPerforante);
                        $myPlayer->dano_al_jefe += max(0, $dmg) + max(0, $dmgEscudo) + max(0, $dmgPerforante);

                        $npcDebuffs = $raid->npc_debuffs ?? [];
                        foreach ($habDebuff as $stat) {
                            if (self::esTipoEstado($stat)) {
                                $npcEstados = self::aplicarEstadoDeHabilidad($npcEstados, $stat);
                            } else {
                                $npcDebuffs[] = ['stat' => $stat, 'turns' => $habRondas];
                            }
                        }
                        $raid->npc_debuffs = $npcDebuffs;
                    }

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
        $myPlayer->estados = $myEstados ?: null;
        $raid->npc_estados = $npcEstados ?: null;

        if ($raid->npc_hp <= 0 && $raid->status === 'activo') {
            $raid->status = 'ganado';
            $entry['messages'][] = "¡{$raid->npc->nombre} ha sido derrotado! Victoria del grupo.";
            foreach ($this->grantVictoryRewards($raid) as $mensaje) {
                $entry['messages'][] = $mensaje;
            }
        } elseif ($raid->status === 'activo' && $raid->jugadores->where('status', 'activo')->where('hp', '>', 0)->count() === 0) {
            /* Puede pasar si la confusión hizo que el último jugador activo se golpeara a sí mismo. */
            $raid->status = 'perdido';
            $entry['messages'][] = 'Todos los jugadores han caído. El jefe los ha derrotado.';
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

                $rpChar = $rp->user->character;
                $tick = self::tickEstadosRonda($rp->estados ?? [], $rp->hp, self::getCombatStats($rpChar)['vida'], $rpChar->name);
                $rp->estados = $tick['estados'] ?: null;
                $rp->hp = $tick['hp'];
                if ($rp->hp <= 0) {
                    $rp->status = 'derrotado';
                }
                foreach ($tick['mensajes'] as $mensajeEstado) {
                    $log[] = ['turn' => count($log) + 1, 'actor' => 'sistema', 'messages' => [$mensajeEstado]];
                }

                $rp->save();
            }
            $raid->npc_buffs = self::tickEffects($raid->npc_buffs ?? []) ?: null;
            $raid->npc_debuffs = self::tickEffects($raid->npc_debuffs ?? []) ?: null;

            $npcTick = self::tickEstadosRonda($raid->npc_estados ?? [], $raid->npc_hp, self::getNpcStats($raid->npc)['vida'], $raid->npc->nombre);
            $raid->npc_estados = $npcTick['estados'] ?: null;
            $raid->npc_hp = $npcTick['hp'];
            foreach ($npcTick['mensajes'] as $mensajeEstado) {
                $log[] = ['turn' => count($log) + 1, 'actor' => 'sistema', 'messages' => [$mensajeEstado]];
            }

            /* El sangrado/envenenado del tick puede haber matado al jefe o a los jugadores restantes */
            if ($raid->npc_hp <= 0) {
                $raid->status = 'ganado';
                $mensajes = ["¡{$raid->npc->nombre} ha sido derrotado! Victoria del grupo.", ...$this->grantVictoryRewards($raid)];
                $log[] = ['turn' => count($log) + 1, 'actor' => 'sistema', 'messages' => $mensajes];

                return;
            }

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

        /* Parálisis del jefe: pierde el turno y queda inmune al próximo intento */
        $npcEstados = $raid->npc_estados ?? [];
        $paralisisInfo = self::resolverParalisisAlEmpezarTurno($npcEstados);
        $npcEstados = $paralisisInfo['estados'];
        if ($paralisisInfo['paralizado']) {
            $raid->npc_estados = $npcEstados ?: null;
            $log[] = ['turn' => count($log) + 1, 'actor' => 'npc', 'messages' => ["{$npc->nombre} está paralizado y pierde el turno"]];

            return;
        }

        /* Confundido: el jefe puede golpearse a sí mismo en vez del objetivo elegido */
        $target = $activos->sortByDesc('dano_al_jefe')->first();
        $targetEsNpc = false;
        if (self::resolverConfundido($npcEstados)) {
            $opciones = array_merge(['npc'], $activos->pluck('user_id')->all());
            $elegido = $opciones[array_rand($opciones)];
            $log[] = ['turn' => count($log) + 1, 'actor' => 'sistema', 'messages' => ["¡{$npc->nombre} está confundido!"]];
            if ($elegido === 'npc') {
                $targetEsNpc = true;
            } else {
                $target = $activos->firstWhere('user_id', $elegido);
            }
        }
        $targetChar = $targetEsNpc ? null : $target->user->character;

        $npcStats = self::getEffectiveStats(self::getNpcStats($npc), $raid->npc_buffs ?? [], $raid->npc_debuffs ?? []);
        $npcCooldowns = array_filter(array_map(fn ($v) => $v - 1, $raid->npc_cooldowns ?? []), fn ($v) => $v > 0);

        /* "self" (buffs sobre sí mismo) queda excluido: el turno automático del jefe solo sabe
         * atacar, no tiene forma de dirigir una habilidad de buff hacia sí mismo. */
        $habilidadesNpc = RolHabilidad::whereIn('id', $npc->habilidadIds())->get()->keyBy('id');
        $disponibles = array_values(array_filter(
            $npc->habilidadIds(),
            fn ($hid) => ($npcCooldowns[(string) $hid] ?? 0) <= 0 && ($habilidadesNpc->get($hid)?->objetivo) !== 'self'
        ));
        $hab = (! empty($disponibles) && random_int(1, 100) <= 60)
            ? $habilidadesNpc->get($disponibles[array_rand($disponibles)])
            : null;

        /* El buff propio de la habilidad (si tiene uno) se aplica al jefe mismo al usarla,
         * sin importar si el golpe conecta — mismo criterio que el buff del jugador. No
         * afecta la tirada de ESTE turno (npcStats ya se calculó más arriba), solo a partir
         * del próximo, igual que el resto de los buffs/debuffs del combate. */
        $habBuffNpc = $hab && is_array($hab->buff) ? $hab->buff : [];
        if (! empty($habBuffNpc)) {
            $npcBuffsArr = $raid->npc_buffs ?? [];
            $habRondasNpc = $hab->duracion ?: 2;
            foreach ($habBuffNpc as $stat) {
                if (self::esTipoEstado($stat)) {
                    $npcEstados = self::aplicarEstadoDeHabilidad($npcEstados, $stat);
                } else {
                    $npcBuffsArr[] = ['stat' => $stat, 'turns' => $habRondasNpc];
                }
            }
            $raid->npc_buffs = $npcBuffsArr;
            $log[] = ['turn' => count($log) + 1, 'actor' => 'npc', 'messages' => ["{$npc->nombre} se refuerza: +".implode(', +', $habBuffNpc)]];
        }

        /* Daño base de un ataque normal (sin habilidad): configurado en la ficha del Jefe
         * (dano/dano_escudo/dano_perforante) — el stat de Ataque solo decide si conecta. */
        $dmgBase = $hab ? (int) ($hab->damage ?? 0) : (int) ($npc->dano ?? 0);
        $dmgEscudoBase = $hab ? (int) ($hab->damage_escudo ?? 0) : (int) ($npc->dano_escudo ?? 0);
        $dmgPerfBase = $hab ? (int) ($hab->damage_perforante ?? 0) : (int) ($npc->dano_perforante ?? 0);
        $formaAtaque = $hab ? (int) $hab->forma : (int) $raid->npc_forma;
        $accion = $hab ? "usa {$hab->nombre}" : 'ataca';

        /* Bono por nivel de dificultad: +nivel de daño (o de curación si dmgBase es negativo) */
        $dmgBase += $dmgBase >= 0 ? $npc->nivelDificultad() : -$npc->nivelDificultad();

        if ($hab && $hab->cooldown > 0) {
            $npcCooldowns[(string) $hab->id] = $hab->cooldown;
        }
        $raid->npc_cooldowns = $npcCooldowns ?: null;

        $targetStats = $targetEsNpc ? $npcStats : self::getEffectiveStats(self::getCombatStats($targetChar), $target->buffs ?? [], $target->debuffs ?? []);
        $targetEstadosPrevios = $targetEsNpc ? $npcEstados : ($target->estados ?? []);

        $atkDado = self::mitigarTiradaAturdido($npcEstados, random_int(1, 20));
        $defDado = self::mitigarTiradaAturdido($targetEstadosPrevios, random_int(1, 20));
        $atkVal = $npcStats['ataque'];
        $defVal = $targetStats['defensa'];
        $atkRoll = $atkDado + $atkVal;
        $defRoll = $defDado + $defVal;
        $esCritico = $atkDado >= $npc->critThreshold(); // Umbral según nivel de dificultad (ej. nivel 4 → 21-4=17, crítico con 17-20)

        $nombreObjetivo = $targetEsNpc ? $npc->nombre : $targetChar->name;
        $log[] = [
            'turn' => count($log) + 1, 'actor' => 'npc',
            'target_user_id' => $targetEsNpc ? null : $target->user_id,
            'dice' => ['atk' => $atkDado, 'def' => $defDado],
            'messages' => [
                "{$npc->nombre} {$accion} contra {$nombreObjetivo}: 1d20({$atkDado})+{$atkVal}={$atkRoll} vs 1d20({$defDado})+{$defVal}={$defRoll}",
            ],
        ];

        /* Marcado/protegido del objetivo se consumen sin importar si el golpe finalmente conecta */
        $protegidoInfo = self::consumirProtegido($targetEstadosPrevios);
        $targetEstadosPrevios = $protegidoInfo['estados'];
        $marcaInfo = self::consumirMarcado($targetEstadosPrevios, $atkDado);
        $targetEstadosPrevios = $marcaInfo['estados'];
        if ($targetEsNpc) {
            $npcEstados = $targetEstadosPrevios;
        } else {
            $target->estados = $targetEstadosPrevios ?: null;
        }
        $raid->npc_estados = $npcEstados ?: null;

        $hit = $esCritico || $atkRoll > $defRoll;
        if ($protegidoInfo['activo']) {
            $hit = false;
        } elseif ($marcaInfo['activo']) {
            $hit = $marcaInfo['forzar_exito'];
        }

        if (! $hit) {
            $missMsg = match (true) {
                $protegidoInfo['activo'] => '¡El objetivo estaba protegido y bloquea el golpe automáticamente!',
                $marcaInfo['activo'] => '¡El objetivo estaba marcado, pero el ataque falla igual (natural 1)!',
                default => "{$nombreObjetivo} esquiva/bloquea el ataque de {$npc->nombre}.",
            };
            $log[] = [
                'turn' => count($log) + 1, 'actor' => 'npc', 'hit' => false, 'target_user_id' => $targetEsNpc ? null : $target->user_id,
                'messages' => [$missMsg],
            ];
            if (! $targetEsNpc) {
                $target->save();
            }

            return;
        }
        if ($marcaInfo['activo']) {
            $log[] = ['turn' => count($log) + 1, 'actor' => 'npc', 'hit' => true, 'messages' => ['¡El objetivo estaba marcado — el golpe conecta automáticamente!']];
        }

        if ($targetEsNpc) {
            /* Confundido: el jefe se golpea a sí mismo — sin la mecánica de crítico en área */
            $dmg = self::mitigarDanoDebilitado($npcEstados, $dmgBase);
            $escudoAntes = $raid->npc_escudo;
            [$raid->npc_hp, $raid->npc_escudo] = self::applyDamage($raid->npc_hp, $raid->npc_escudo, $dmg, $dmgEscudoBase, $dmgPerfBase);
            $desc = self::describeDano($dmg, $dmgEscudoBase, $dmgPerfBase, $escudoAntes);
            $log[] = ['turn' => count($log) + 1, 'actor' => 'npc', 'hit' => true, 'messages' => ["{$npc->nombre} se golpea a sí mismo: {$desc}"]];

            return;
        }

        if ($esCritico) {
            $critBonus = $npc->nivelBonoCritico();
            $habDebuffCrit = $hab && is_array($hab->debuff) ? $hab->debuff : [];
            $msgs = ["¡CRÍTICO! {$npc->nombre} concentra su furia y golpea a todos los combatientes."];
            $targets = [];
            foreach ($activos as $rp) {
                $rpChar = $rp->user->character;
                $rpEffective = self::isEffective($formaAtaque, (int) $rp->current_forma);
                $d = self::mitigarDanoDebilitado($npcEstados, ($rpEffective ? (int) round($dmgBase * 1.5) : $dmgBase) + $critBonus);
                $dE = $rpEffective ? (int) round($dmgEscudoBase * 1.5) : $dmgEscudoBase;
                $dP = $rpEffective ? (int) round($dmgPerfBase * 1.5) : $dmgPerfBase;
                $escudoAntes = $rp->escudo;
                [$rp->hp, $rp->escudo] = self::applyDamage($rp->hp, $rp->escudo, $d, $dE, $dP);
                if ($rp->hp <= 0) {
                    $rp->status = 'derrotado';
                }
                /* Antes solo se aplicaba el debuff de la habilidad en el golpe no-crítico (rama
                 * de abajo) — un jefe crítico dejaba pasar el efecto de estado de su propia
                 * habilidad en el AoE. Se aplica igual a cada combatiente golpeado. */
                if (! empty($habDebuffCrit)) {
                    $tb = $rp->debuffs ?? [];
                    $te = $rp->estados ?? [];
                    foreach ($habDebuffCrit as $stat) {
                        if (self::esTipoEstado($stat)) {
                            $te = self::aplicarEstadoDeHabilidad($te, $stat);
                        } else {
                            $tb[] = ['stat' => $stat, 'turns' => $hab->duracion ?: 2];
                        }
                    }
                    $rp->debuffs = $tb;
                    $rp->estados = $te ?: null;
                }
                $rp->save();
                $desc = self::describeDano($d, $dE, $dP, $escudoAntes);
                $msgs[] = "{$rpChar->name}: {$desc}".($rpEffective ? ' (¡forma efectiva!)' : '');
                $targets[] = ['user_id' => $rp->user_id, 'effective' => $rpEffective];
            }
            $log[] = ['turn' => count($log) + 1, 'actor' => 'npc', 'crit' => true, 'hit' => true, 'aoe' => true, 'targets' => $targets, 'messages' => $msgs];
        } else {
            $effective = self::isEffective($formaAtaque, (int) $target->current_forma);
            $dmg = self::mitigarDanoDebilitado($npcEstados, $effective ? (int) round($dmgBase * 1.5) : $dmgBase);
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
                    $te = $target->estados ?? [];
                    foreach ($habDebuff as $stat) {
                        if (self::esTipoEstado($stat)) {
                            $te = self::aplicarEstadoDeHabilidad($te, $stat);
                        } else {
                            $tb[] = ['stat' => $stat, 'turns' => $hab->duracion ?: 2];
                        }
                    }
                    $target->debuffs = $tb;
                    $target->estados = $te ?: null;
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

    /** Hito + progreso de misión + sorteo de botín (recompensas del jefe) para todos los participantes que no huyeron. */
    private function grantVictoryRewards(RaidCombat $raid): array
    {
        $mensajes = [];
        $recompensas = $raid->npc->recompensas()->with(['objeto', 'habilidad', 'medalla'])->get();

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
                MisionProgresoService::registrarHito($rpUser, "{$raid->npc->nombre} derrotado");
                MisionProgresoService::registrar($rpUser, 'combate', 1);

                $otorgadas = RecompensaRollService::resolverYOtorgar($recompensas, $rpUser, $rpChar);
                if ($otorgadas) {
                    $desc = collect($otorgadas)->pluck('label')->implode(' y ');
                    $mensajes[] = "🎁 {$rpChar->name} recibe: {$desc}";
                }
            }
        }

        return $mensajes;
    }

    // ─────────────────────────── formato de respuesta ──────────────────────

    private function formatRaid(RaidCombat $raid, int $myUserId): array
    {
        $npc = $raid->npc;
        $npcBase = self::getNpcStats($npc);
        $npcEffective = self::getEffectiveStats($npcBase, $raid->npc_buffs ?? [], $raid->npc_debuffs ?? []);
        $current = $raid->turn_order[$raid->turn_index] ?? null;
        $agroTargetUserId = $raid->jugadores
            ->where('status', 'activo')
            ->where('hp', '>', 0)
            ->sortByDesc('dano_al_jefe')
            ->first()?->user_id;

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
                'estados' => $rp->estados ?? [],
                'status' => $rp->status,
                'dano_al_jefe' => $rp->dano_al_jefe,
                'habilidades' => $habilidades,
                'arma_equipada' => $ch?->armaEfectiva(),
                'listo' => (bool) $rp->listo,
                'es_yo' => false, // se completa más abajo
                'es_mi_turno' => (bool) ($current && $current['type'] === 'player' && (int) $current['user_id'] === $rp->user_id),
            ];
        })->values();

        $jugadores = $jugadores->map(function ($j) use ($myUserId, $agroTargetUserId) {
            $j['es_yo'] = $j['user_id'] === $myUserId;
            $j['es_bajo_agro'] = $agroTargetUserId !== null && $j['user_id'] === $agroTargetUserId;

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
            'npc_agro_user_id' => $agroTargetUserId,
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
                'estados' => $raid->npc_estados ?? [],
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
        // +1 a todos los atributos por nivel de dificultad (además del bono de daño/crítico
        // que nivelDificultad() ya aporta en el resto del combate).
        $nivel = $npc->nivelDificultad();

        return [
            'vida' => ($npc->vida ?: 30) + $nivel,
            'escudo' => ($npc->escudo ?: 0) + $nivel,
            'ataque' => ($npc->ataque ?: 10) + $nivel,
            'defensa' => ($npc->defensa ?: 10) + $nivel,
            'movimiento' => ($npc->movimiento ?: 10) + $nivel,
            'iniciativa' => ($npc->iniciativa ?: 10) + $nivel,
            'punteria' => ($npc->punteria ?: 10) + $nivel,
        ];
    }

    private static function getCombatStats(?object $char): array
    {
        if (! $char) {
            return ['vida' => 30, 'escudo' => 10, 'ataque' => 20, 'defensa' => 15,
                'iniciativa' => 10, 'punteria' => 10, 'movimiento' => 20];
        }

        if (method_exists($char, 'combatStats')) {
            return $char->combatStats();
        }

        $bonos = method_exists($char, 'sableBonos')
            ? $char->sableBonos()
            : ['ataque' => 0, 'defensa' => 0, 'punteria' => 0, 'movimiento' => 0, 'iniciativa' => 0, 'vida' => 0, 'escudo' => 0];
        $cap = max(1, (int) Configuracion::valor('cap_stats_items', 15));

        $stats = [
            'vida' => ($char->vida ?? 8) + $bonos['vida'],
            'escudo' => ($char->escudo ?? 4) + $bonos['escudo'],
            'ataque' => ($char->ataque ?? 2) + $bonos['ataque'],
            'defensa' => ($char->defensa ?? 2) + $bonos['defensa'],
            'movimiento' => ($char->movimiento ?? 2) + $bonos['movimiento'],
            'iniciativa' => ($char->iniciativa ?? 2) + $bonos['iniciativa'],
            'punteria' => ($char->punteria ?? 2) + $bonos['punteria'],
        ];

        foreach ($stats as $key => $value) {
            $stats[$key] = max(1, min($cap, (int) $value));
        }

        return $stats;
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
        $cap = max(1, (int) Configuracion::valor('cap_stats_buff', 18));
        foreach ($stats as $key => $value) {
            $stats[$key] = max(0, min($cap, (int) $value));
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
