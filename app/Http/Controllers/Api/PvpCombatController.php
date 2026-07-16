<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\CharacterHito;
use App\Models\Configuracion;
use App\Models\PvpCombat;
use App\Models\RolHabilidad;
use App\Models\User;
use App\Notifications\PvpCombatNotification;
use App\Notifications\PvpTurnoPushRecordatorio;
use App\Services\MisionProgresoService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
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

    private const TERMINAL_STATUSES = ['attacker_won', 'defender_won', 'fled_attacker', 'fled_defender'];

    /* Expresiones disponibles en combate PvP — whitelist autoritativa del servidor
     * (el cliente solo envía el id; emoji/label/desc los define el backend). */
    private const EMOTES = [
        'saludar' => ['emoji' => '👋',  'label' => 'Saludar',     'desc' => 'saluda a su rival'],
        'reir' => ['emoji' => '😂',  'label' => 'Reír',        'desc' => 'se ríe de su rival'],
        'llorar' => ['emoji' => '😢',  'label' => 'Llorar',      'desc' => 'llora'],
        'impresion' => ['emoji' => '😲',  'label' => 'Impresión',   'desc' => 'se muestra impresionado'],
        'enojo' => ['emoji' => '😠',  'label' => 'Enojarse',    'desc' => 'se enoja'],
        'dormir' => ['emoji' => '😴',  'label' => 'Dormir',      'desc' => 'finge dormirse de aburrimiento'],
        'adios' => ['emoji' => '🖐️', 'label' => 'Decir adiós', 'desc' => 'se despide'],
    ];

    /** POST /pvp/challenge */
    public function challenge(Request $request): JsonResponse
    {
        $data = $request->validate([
            'defender_id' => 'required|integer|exists:users,id',
            'origen' => 'nullable|string|in:nave,normal',
        ]);

        $attacker = $request->user();
        $defender = User::with('character')->findOrFail($data['defender_id']);

        if ($attacker->id === $defender->id) {
            return response()->json(['error' => 'No puedes atacarte a ti mismo'], 422);
        }
        if (! $attacker->character || ! $defender->character) {
            return response()->json(['error' => 'Ambos jugadores necesitan un personaje'], 422);
        }

        $attackerBusy = PvpCombat::whereIn('status', ['active', 'pending'])
            ->where(fn ($q) => $q->where('attacker_id', $attacker->id)->orWhere('defender_id', $attacker->id))
            ->exists();
        if ($attackerBusy) {
            return response()->json(['error' => 'Ya tienes un combate activo o pendiente. Resuélvelo primero.'], 422);
        }

        $defenderBusy = PvpCombat::whereIn('status', ['active', 'pending'])
            ->where(fn ($q) => $q->where('attacker_id', $defender->id)->orWhere('defender_id', $defender->id))
            ->exists();
        if ($defenderBusy) {
            return response()->json(['error' => 'Ese jugador ya tiene un combate activo o pendiente'], 422);
        }

        /* Combate naval: solo si el reto se originó desde el icono de nave del mapa
         * planetario (origen=nave) Y ambos jugadores tienen una nave equipada. En
         * cualquier otro caso (vista de lugar, zona, sistema, o falta de nave de
         * alguno de los dos) el combate es PvP normal de personaje. */
        $modo = 'normal';
        $naveAdvertencia = null;
        if (($data['origen'] ?? 'normal') === 'nave') {
            $attackerNave = self::getNaveOwned($attacker->character);
            $defenderNave = self::getNaveOwned($defender->character);
            if ($attackerNave && $attackerNave->nave && $defenderNave && $defenderNave->nave) {
                $modo = 'naval';

                if ($attackerNave->vida_actual <= 0) {
                    return response()->json([
                        'error' => 'Tu nave está rota — no puedes combatir. Repárala en el hangar antes de volver a intentarlo.',
                    ], 422);
                }
                if ($attackerNave->vida_actual < $attackerNave->nave->vida || $attackerNave->escudo_actual < $attackerNave->nave->escudo) {
                    $naveAdvertencia = "Tu nave está dañada ({$attackerNave->vida_actual}/{$attackerNave->nave->vida} vida, "
                        ."{$attackerNave->escudo_actual}/{$attackerNave->nave->escudo} escudo) — considera repararla en el hangar.";
                }
            }
        }

        $attackerStats = self::getCombatStats($attacker->character, $modo);
        $defenderStats = self::getCombatStats($defender->character, $modo);

        $roll = self::rollIniciativa($attackerStats['iniciativa'], $defenderStats['iniciativa']);
        $firstTurn = $roll['gana_atacante'] ? $attacker->id : $defender->id;

        $defChar = $defender->character;

        /* Pre-recuperar fuerza para quien actúa primero */
        $attackerFuerzaCfg = self::fuerzaConfig($attacker->character);
        $defenderFuerzaCfg = self::fuerzaConfig($defChar);
        $attackerFuerza = $firstTurn === $attacker->id ? $attackerFuerzaCfg['gen'] : 0;
        $defenderFuerza = $firstTurn === $defender->id ? $defenderFuerzaCfg['gen'] : 0;

        $combat = PvpCombat::create([
            'attacker_id' => $attacker->id,
            'defender_id' => $defender->id,
            'lugar_id' => $defChar->map_lugar_id,
            'zona_id' => $defChar->map_zona_id,
            'planeta_id' => $defChar->map_planeta_id,
            'sistema_id' => $defChar->map_sistema_id,
            'attacker_hp' => $attackerStats['vida'],
            'defender_hp' => $defenderStats['vida'],
            'attacker_escudo' => $attackerStats['escudo'],
            'defender_escudo' => $defenderStats['escudo'],
            'attacker_def_bonus' => 0,
            'defender_def_bonus' => 0,
            'attacker_fuerza' => $attackerFuerza,
            'defender_fuerza' => $defenderFuerza,
            'attacker_current_forma' => $attacker->character->formaEspecializacion(),
            'defender_current_forma' => $defChar->formaEspecializacion(),
            'current_turn' => $firstTurn,
            'ronda' => 1,
            'ronda_turno' => 0,
            'status' => 'pending',
            'modo' => $modo,
            'log' => [[
                'turn' => 1,
                'actor_id' => null,
                'messages' => [
                    "Ronda 1 — Iniciativa: {$attacker->character->name} 1d20({$roll['atk_dado']})+{$attackerStats['iniciativa']}={$roll['atk_total']} "
                        ."vs {$defChar->name} 1d20({$roll['def_dado']})+{$defenderStats['iniciativa']}={$roll['def_total']}",
                    $roll['gana_atacante'] ? "¡{$attacker->character->name} actúa primero!" : "¡{$defChar->name} actúa primero!",
                ],
            ]],
        ]);

        $defender->notify(new PvpCombatNotification(
            "Reto de combate de {$attacker->character->name}",
            'Te han retado a duelo — Acepta o rechaza en el mapa galáctico',
            $combat->id
        ));

        return response()->json([
            'combat' => $this->formatCombat($combat->load(self::WITHS), $attacker->id),
            'nave_advertencia' => $naveAdvertencia,
        ], 201);
    }

    /** POST /pvp/{id}/accept */
    public function accept(Request $request, int $id): JsonResponse
    {
        $user = $request->user();
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
        $user = $request->user();
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

    /** POST /pvp/{id}/cancel */
    public function cancel(Request $request, int $id): JsonResponse
    {
        $user = $request->user();
        $combat = PvpCombat::with(self::WITHS)->findOrFail($id);

        if ($combat->attacker_id !== $user->id) {
            return response()->json(['error' => 'Solo quien retó puede cancelar'], 403);
        }
        if ($combat->status !== 'pending') {
            return response()->json(['error' => 'El reto ya no está pendiente'], 422);
        }

        $combat->status = 'cancelled';
        $combat->save();

        $combat->defender->notify(new PvpCombatNotification(
            'Reto cancelado',
            "{$user->character->name} canceló el reto de combate",
            $combat->id
        ));

        return response()->json(['ok' => true]);
    }

    /** GET /pvp/active */
    public function active(Request $request): JsonResponse
    {
        $user = $request->user();

        $combat = PvpCombat::whereIn('status', ['active', 'pending'])
            ->where(fn ($q) => $q->where('attacker_id', $user->id)->orWhere('defender_id', $user->id))
            ->with(self::WITHS)
            ->latest()
            ->first();

        return response()->json(['combat' => $combat ? $this->formatCombat($combat, $user->id) : null]);
    }

    /** GET /pvp/{id} */
    public function show(Request $request, int $id): JsonResponse
    {
        $user = $request->user();
        $combat = PvpCombat::with(self::WITHS)->findOrFail($id);

        if (! $combat->involvedUser($user->id)) {
            return response()->json(['error' => 'No autorizado'], 403);
        }

        return response()->json(['combat' => $this->formatCombat($combat, $user->id)]);
    }

    /** POST /pvp/{id}/resumen-ia — crónica del duelo generada por IA para la tarjeta de resolución */
    public function resumenIA(Request $request, int $id): JsonResponse
    {
        $user = $request->user();
        $combat = PvpCombat::with(self::WITHS)->findOrFail($id);

        if (! $combat->involvedUser($user->id)) {
            return response()->json(['error' => 'No autorizado'], 403);
        }
        if (! in_array($combat->status, self::TERMINAL_STATUSES, true)) {
            return response()->json(['error' => 'El combate no ha terminado'], 422);
        }

        // Se genera una sola vez por combate y queda cacheado en la BD.
        if ($combat->resumen_ia) {
            return response()->json(['resumen' => $combat->resumen_ia]);
        }

        $attackerName = $combat->attacker->character->name ?? 'El atacante';
        $defenderName = $combat->defender->character->name ?? 'El defensor';

        $transcript = collect($combat->log ?? [])
            ->flatMap(fn ($entry) => $entry['messages'] ?? [])
            ->implode("\n");
        $transcript = mb_substr($transcript, 0, 6000);

        $prompt = 'Eres el cronista de la Orden en NÉXUS. A continuación tienes la bitácora, turno a turno, '
            ."de un duelo con sable de luz entre {$attackerName} y {$defenderName}. Escribe una crónica dramática "
            .'del duelo, en español, en prosa corrida (sin listas, sin markdown, sin títulos), yendo directo a los '
            .'momentos clave sin descripciones ambientales largas. '
            .'LÍMITE ESTRICTO: no más de 55 palabras en total, ni una más. No inventes datos que contradigan la bitácora.'
            ."\n\nBitácora:\n{$transcript}";

        $response = Http::withToken(config('services.mistral.api_key'))
            ->timeout(30)
            ->post('https://api.mistral.ai/v1/chat/completions', [
                'model' => 'open-mistral-nemo',
                'messages' => [['role' => 'user', 'content' => $prompt]],
                'max_tokens' => 160,
                'temperature' => 0.8,
            ]);

        if ($response->failed()) {
            Log::error('Mistral resumen de combate falló', ['status' => $response->status(), 'combat_id' => $id]);

            return response()->json(['error' => 'No se pudo generar el resumen.'], 502);
        }

        $resumen = trim((string) $response->json('choices.0.message.content', ''));
        if ($resumen === '') {
            return response()->json(['error' => 'No se pudo generar el resumen.'], 502);
        }

        $resumen = self::limitarPalabras($resumen, 60);

        $combat->update(['resumen_ia' => $resumen]);

        return response()->json(['resumen' => $resumen]);
    }

    /** Red de seguridad: el modelo no siempre respeta el límite de palabras pedido en el prompt. */
    private static function limitarPalabras(string $texto, int $max): string
    {
        $palabras = preg_split('/\s+/', trim($texto));
        if (count($palabras) <= $max) {
            return $texto;
        }

        return implode(' ', array_slice($palabras, 0, $max)).'…';
    }

    /** POST /pvp/{id}/action */
    public function action(Request $request, int $id): JsonResponse
    {
        $data = $request->validate(['skill' => 'required', 'forma' => 'nullable|integer|min:1|max:7']);

        $user = $request->user();
        $combat = PvpCombat::with(self::WITHS)->findOrFail($id);

        if (! $combat->involvedUser($user->id)) {
            return response()->json(['error' => 'No autorizado'], 403);
        }
        if ($combat->current_turn !== $user->id) {
            return response()->json(['error' => 'No es tu turno'], 422);
        }
        if ($combat->status !== 'active') {
            return response()->json(['error' => 'El combate ya terminó'], 422);
        }

        $isAttacker = $user->id === $combat->attacker_id;
        $actorChar = $isAttacker ? $combat->attacker->character : $combat->defender->character;
        $opponentUser = $isAttacker ? $combat->defender : $combat->attacker;
        $opponentChar = $opponentUser->character;

        $attackerFuerzaCfg = self::fuerzaConfig($combat->attacker->character);
        $defenderFuerzaCfg = self::fuerzaConfig($combat->defender->character);

        /* Estado actual del actor */
        $myFuerza = ($isAttacker ? $combat->attacker_fuerza : $combat->defender_fuerza) ?? 0;
        $myCooldowns = ($isAttacker ? $combat->attacker_cooldowns : $combat->defender_cooldowns) ?? [];
        $myBuffs = ($isAttacker ? $combat->attacker_buffs : $combat->defender_buffs) ?? [];
        $myDebuffs = ($isAttacker ? $combat->attacker_debuffs : $combat->defender_debuffs) ?? [];
        $oppBuffs = ($isAttacker ? $combat->defender_buffs : $combat->attacker_buffs) ?? [];
        $oppDebuffs = ($isAttacker ? $combat->defender_debuffs : $combat->attacker_debuffs) ?? [];
        $oppLastForma = ($isAttacker ? $combat->defender_last_forma : $combat->attacker_last_forma) ?? 0;

        /* Tick de cooldowns al inicio del turno (los buffs/debuffs se tickean por ronda, no por turno) */
        $myCooldowns = array_filter(
            array_map(fn ($v) => $v - 1, $myCooldowns),
            fn ($v) => $v > 0
        );

        /* Stats efectivos con buffs/debuffs */
        $actorBaseStats = self::getCombatStats($actorChar, $combat->modo);
        $opponentBaseStats = self::getCombatStats($opponentChar, $combat->modo);
        $actorStats = self::getEffectiveStats($actorBaseStats, $myBuffs, $myDebuffs);
        $opponentStats = self::getEffectiveStats($opponentBaseStats, $oppBuffs, $oppDebuffs);

        $log = $combat->log ?? [];
        $entry = ['turn' => count($log) + 1, 'actor_id' => $user->id, 'messages' => []];
        $skill = $data['skill'];

        /* ─── Huir (requiere ganar tirada de iniciativa contra el rival) ── */
        if ($skill === 'flee') {
            $roll = self::rollIniciativa($actorStats['iniciativa'], $opponentStats['iniciativa']);
            $entry['messages'][] = "{$actorChar->name} intenta huir: "
                ."1d20({$roll['atk_dado']})+{$actorStats['iniciativa']}={$roll['atk_total']} "
                ."vs 1d20({$roll['def_dado']})+{$opponentStats['iniciativa']}={$roll['def_total']}";

            if ($roll['gana_atacante']) {
                $combat->status = $isAttacker ? 'fled_attacker' : 'fled_defender';
                $entry['messages'][] = "¡{$actorChar->name} logra huir del combate!";
            } else {
                $entry['messages'][] = "{$actorChar->name} no logra huir y pierde el turno";
            }

            /* ─── Cambio de estancia ─────────────────────────────────────── */
        } elseif ($skill === 'stance') {
            $forma = (int) ($data['forma'] ?? 1);
            if ($forma < 1 || $forma > 7) {
                return response()->json(['error' => 'Forma inválida'], 422);
            }
            if ($isAttacker) {
                $combat->attacker_current_forma = $forma;
            } else {
                $combat->defender_current_forma = $forma;
            }
            $entry['messages'][] = "{$actorChar->name} cambia a Forma {$forma}";

            /* ─── Ataque básico (sable armado > arma equipada > desarmado) ──── */
        } elseif ($skill === 'unarmed') {
            if ($combat->modo === 'naval') {
                return response()->json(['error' => 'El ataque cuerpo a cuerpo no está disponible en combate naval'], 422);
            }
            $arma = $actorChar->armaEfectiva();
            $esDistancia = ($arma['tipo_ataque'] ?? null) === 'distancia';
            $atkVal = $esDistancia ? $actorStats['punteria'] : $actorStats['ataque'];
            $defVal = $esDistancia ? $opponentStats['movimiento'] : $opponentStats['defensa'];
            $atkDado = random_int(1, 20);
            $defDado = random_int(1, 20);
            $atkRoll = $atkDado + $atkVal;
            $defRoll = $defDado + $defVal;
            $critico = $arma['critico'] ?? 0;
            $esCritico = $atkDado >= (20 - $critico);
            $accion = $arma ? "ataca con {$arma['nombre']}" : 'ataca desarmado';
            $entry['messages'][] = "{$actorChar->name} {$accion}: 1d20+{$atkVal}={$atkRoll} vs 1d20+{$defVal}={$defRoll}";

            if ($esCritico || $atkRoll > $defRoll) {
                $dmg = ($arma['dano'] ?? 3) + ($esCritico ? 1 : 0);
                $dmgPerforante = (int) ($arma['dano_perforante'] ?? 0);
                $oppEscudoAntes = $isAttacker ? $combat->defender_escudo : $combat->attacker_escudo;
                if ($isAttacker) {
                    [$combat->defender_hp, $combat->defender_escudo] =
                        self::applyDamage($combat->defender_hp, $combat->defender_escudo, $dmg, 0, $dmgPerforante);
                } else {
                    [$combat->attacker_hp, $combat->attacker_escudo] =
                        self::applyDamage($combat->attacker_hp, $combat->attacker_escudo, $dmg, 0, $dmgPerforante);
                }
                $descDano = self::describeDano($dmg, 0, $dmgPerforante, $oppEscudoAntes);
                $entry['messages'][] = $esCritico ? "¡CRÍTICO! (natural {$atkDado}) {$descDano}" : "¡Impacto! {$descDano}";
            } else {
                $entry['messages'][] = "{$actorChar->name} falla el golpe";
            }

            /* ─── Evadir (solo combate naval): +1 Maniobra (defensa+movimiento) y +1 Iniciativa, 3 rondas ── */
        } elseif ($skill === 'evadir') {
            if ($combat->modo !== 'naval') {
                return response()->json(['error' => 'Evadir solo está disponible en combate naval'], 422);
            }
            foreach (['defensa', 'movimiento', 'iniciativa'] as $stat) {
                $myBuffs[] = ['stat' => $stat, 'turns' => 3];
            }
            $entry['messages'][] = "{$actorChar->name} evade: +1 Maniobra y +1 Iniciativa (3 rondas)";

            /* ─── Habilidad ───────────────────────────────────────────────── */
        } else {
            $skillId = (int) $skill;
            $myCurrentForma = $isAttacker
                ? ($combat->attacker_current_forma ?? 1)
                : ($combat->defender_current_forma ?? 1);

            /* Verificar que la habilidad está disponible: slots de la nave (combate naval)
             * o slots de la forma actual del sable (combate de personaje) */
            $naveSkillIds = self::getNaveSkillIds($actorChar, $combat->modo);
            if ($naveSkillIds) {
                $slotIds = $naveSkillIds;
            } else {
                $porForma = is_array($actorChar->habilidades_por_forma) ? $actorChar->habilidades_por_forma : [];
                $slotIds = array_filter($porForma[(string) $myCurrentForma] ?? []);
            }

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

            /* Gastar fuerza y registrar cooldown (las mejoras de nave pueden reducir el
             * cooldown de una habilidad específica — ver CharacterNave::bonoCooldownParaHabilidad) */
            $myFuerza -= $hab->costo_fuerza;
            $habCooldown = $hab->cooldown;
            if ($combat->modo === 'naval') {
                $actorNaveOwned = self::getNaveOwned($actorChar);
                if ($actorNaveOwned) {
                    $habCooldown = max(0, $habCooldown + $actorNaveOwned->bonoCooldownParaHabilidad($hab->id));
                }
            }
            if ($habCooldown > 0) {
                $myCooldowns[(string) $skillId] = $habCooldown;
            }

            /* Aplicar buff al actor (siempre al usar la habilidad) */
            $habBuff = is_array($hab->buff) ? $hab->buff : [];
            $habDebuff = is_array($hab->debuff) ? $hab->debuff : [];
            $habRondas = $hab->duracion ?: 2;
            foreach ($habBuff as $stat) {
                $myBuffs[] = ['stat' => $stat, 'turns' => $habRondas];
            }

            /* Registrar la forma usada */
            if ($isAttacker) {
                $combat->attacker_last_forma = $hab->forma;
            } else {
                $combat->defender_last_forma = $hab->forma;
            }

            $dmg = (int) ($hab->damage ?? 0);
            $dmgEscudo = (int) ($hab->damage_escudo ?? 0);
            $dmgPerforante = (int) ($hab->damage_perforante ?? 0);

            /* ─── Habilidad de auto-buff / auto-curación (objetivo: self) ── */
            if ($hab->objetivo === 'self') {
                $buffDesc = ! empty($habBuff) ? ' (+'.implode(', +', $habBuff).')' : '';
                $entry['messages'][] = "{$actorChar->name} usa {$hab->nombre}{$buffDesc}";

                if ($dmg < 0) {
                    $heal = -$dmg;
                    $maxHp = self::getMaxVida($actorChar, $combat->modo);
                    if ($isAttacker) {
                        $combat->attacker_hp = min($maxHp, $combat->attacker_hp + $heal);
                    } else {
                        $combat->defender_hp = min($maxHp, $combat->defender_hp + $heal);
                    }
                    $entry['messages'][] = "¡Curación! +{$heal} vida";
                }

                if ($dmgEscudo < 0) {
                    $healEsc = -$dmgEscudo;
                    $maxEsc = self::getMaxEscudo($actorChar, $combat->modo);
                    if ($isAttacker) {
                        $combat->attacker_escudo = min($maxEsc, $combat->attacker_escudo + $healEsc);
                    } else {
                        $combat->defender_escudo = min($maxEsc, $combat->defender_escudo + $healEsc);
                    }
                    $entry['messages'][] = "¡Escudo restaurado! +{$healEsc} escudo";
                }

                /* ─── Habilidad de curación a distancia (objetivo: target, damage < 0) ── */
            } elseif ($dmg < 0) {
                $heal = -$dmg;
                $maxHp = self::getMaxVida($opponentChar, $combat->modo);
                if ($isAttacker) {
                    $combat->defender_hp = min($maxHp, $combat->defender_hp + $heal);
                } else {
                    $combat->attacker_hp = min($maxHp, $combat->attacker_hp + $heal);
                }
                $entry['messages'][] = "{$actorChar->name} usa {$hab->nombre}: cura +{$heal} vida a {$opponentChar->name}";

                if ($dmgEscudo < 0) {
                    $healEsc = -$dmgEscudo;
                    $maxEsc = self::getMaxEscudo($opponentChar, $combat->modo);
                    if ($isAttacker) {
                        $combat->defender_escudo = min($maxEsc, $combat->defender_escudo + $healEsc);
                    } else {
                        $combat->attacker_escudo = min($maxEsc, $combat->attacker_escudo + $healEsc);
                    }
                    $entry['messages'][] = "¡Escudo restaurado! +{$healEsc} escudo a {$opponentChar->name}";
                }

                /* ─── Habilidad de ataque (objetivo: target, damage >= 0) ──────── */
            } else {
                $useAtq = $hab->tipo === 'melee';
                $atkVal = $useAtq ? $actorStats['ataque'] : $actorStats['punteria'];
                $defVal = $useAtq ? $opponentStats['defensa'] : $opponentStats['movimiento'];

                $atkRoll = random_int(1, 20) + $atkVal;
                $defRoll = random_int(1, 20) + $defVal;

                $entry['messages'][] = "{$actorChar->name} usa {$hab->nombre}: "
                    ."1d20+{$atkVal}={$atkRoll} vs 1d20+{$defVal}={$defRoll}";

                if ($atkRoll > $defRoll) {
                    $effective = self::isEffective((int) $hab->forma, (int) $oppLastForma);

                    if ($effective) {
                        $dmg = (int) round($dmg * 1.5);
                        $dmgEscudo = (int) round($dmgEscudo * 1.5);
                        $dmgPerforante = (int) round($dmgPerforante * 1.5);
                        $entry['messages'][] = "¡Forma efectiva! ×1.5 (Forma {$hab->forma} vs Forma {$oppLastForma})";
                    }

                    $oppEscudoAntes = $isAttacker ? $combat->defender_escudo : $combat->attacker_escudo;

                    if ($isAttacker) {
                        [$combat->defender_hp, $combat->defender_escudo] =
                            self::applyDamage($combat->defender_hp, $combat->defender_escudo, $dmg, $dmgEscudo, $dmgPerforante);
                    } else {
                        [$combat->attacker_hp, $combat->attacker_escudo] =
                            self::applyDamage($combat->attacker_hp, $combat->attacker_escudo, $dmg, $dmgEscudo, $dmgPerforante);
                    }

                    /* Debuffs al oponente solo si impacta */
                    foreach ($habDebuff as $stat) {
                        $oppDebuffs[] = ['stat' => $stat, 'turns' => $habRondas];
                    }

                    $debuffDesc = ! empty($habDebuff)
                        ? ' (penaliza: '.implode(', ', $habDebuff).')'
                        : '';
                    $descDano = self::describeDano($dmg, $dmgEscudo, $dmgPerforante, $oppEscudoAntes);
                    $entry['messages'][] = "¡Impacto! {$descDano}{$debuffDesc}";

                } else {
                    $entry['messages'][] = "{$actorChar->name} falla el ataque";
                }
            }
        }

        /* ─── Condición de victoria ───────────────────────────────────── */
        if ($combat->attacker_hp <= 0) {
            $combat->status = 'defender_won';
        } elseif ($combat->defender_hp <= 0) {
            $combat->status = 'attacker_won';
        }

        /* ─── Hito de victoria ──────────────────────────────────────────── */
        if (in_array($combat->status, ['attacker_won', 'defender_won'], true)) {
            $winnerUser = $combat->status === 'attacker_won' ? $combat->attacker : $combat->defender;
            $winnerChar = $winnerUser->character;
            $loserChar = $combat->status === 'attacker_won' ? $combat->defender->character : $combat->attacker->character;

            if ($winnerChar && $loserChar) {
                CharacterHito::firstOrCreate([
                    'character_id' => $winnerChar->id,
                    'hito' => "{$loserChar->name} derrotado",
                ]);
                MisionProgresoService::registrar($winnerUser, 'combate', 1);
            }
        }

        /* ─── Persistir daño de la nave equipada (solo si el combate fue naval) ── */
        if ($combat->modo === 'naval'
            && in_array($combat->status, ['attacker_won', 'defender_won', 'fled_attacker', 'fled_defender'], true)) {
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
                $combat->ronda_turno = 1;
                $combat->current_turn = $opponentUser->id;
                if ($isAttacker) {
                    $defenderFuerzaFinal = min($defenderFuerzaCfg['max'], $defenderFuerzaFinal + $defenderFuerzaCfg['gen']);
                } else {
                    $attackerFuerzaFinal = min($attackerFuerzaCfg['max'], $attackerFuerzaFinal + $attackerFuerzaCfg['gen']);
                }
            } else {
                /* Ambos actuaron: termina la ronda — tick de buffs/debuffs (duran N rondas) y nueva iniciativa */
                $myBuffs = self::tickEffects($myBuffs);
                $myDebuffs = self::tickEffects($myDebuffs);
                $oppBuffs = self::tickEffects($oppBuffs);
                $oppDebuffs = self::tickEffects($oppDebuffs);

                $combat->ronda += 1;
                $combat->ronda_turno = 0;

                $attBuffs = $isAttacker ? $myBuffs : $oppBuffs;
                $attDebuffs = $isAttacker ? $myDebuffs : $oppDebuffs;
                $defBuffs = $isAttacker ? $oppBuffs : $myBuffs;
                $defDebuffs = $isAttacker ? $oppDebuffs : $myDebuffs;

                $attEff = self::getEffectiveStats(self::getCombatStats($combat->attacker->character, $combat->modo), $attBuffs, $attDebuffs);
                $defEff = self::getEffectiveStats(self::getCombatStats($combat->defender->character, $combat->modo), $defBuffs, $defDebuffs);

                $roll = self::rollIniciativa($attEff['iniciativa'], $defEff['iniciativa']);
                $combat->current_turn = $roll['gana_atacante'] ? $combat->attacker_id : $combat->defender_id;

                $entry['messages'][] = "Ronda {$combat->ronda} — Iniciativa: {$combat->attacker->character->name} "
                    ."1d20({$roll['atk_dado']})+{$attEff['iniciativa']}={$roll['atk_total']} vs "
                    ."{$combat->defender->character->name} 1d20({$roll['def_dado']})+{$defEff['iniciativa']}={$roll['def_total']}";
                $entry['messages'][] = $roll['gana_atacante']
                    ? "¡{$combat->attacker->character->name} actúa primero!"
                    : "¡{$combat->defender->character->name} actúa primero!";

                if ($roll['gana_atacante']) {
                    $attackerFuerzaFinal = min($attackerFuerzaCfg['max'], $attackerFuerzaFinal + $attackerFuerzaCfg['gen']);
                } else {
                    $defenderFuerzaFinal = min($defenderFuerzaCfg['max'], $defenderFuerzaFinal + $defenderFuerzaCfg['gen']);
                }
            }
        }

        /* ─── Guardar estado del actor ────────────────────────────────── */
        $combat->attacker_fuerza = $attackerFuerzaFinal;
        $combat->defender_fuerza = $defenderFuerzaFinal;
        if ($isAttacker) {
            $combat->attacker_cooldowns = $myCooldowns ?: null;
            $combat->attacker_buffs = $myBuffs ?: null;
            $combat->attacker_debuffs = $myDebuffs ?: null;
            $combat->defender_buffs = $oppBuffs ?: null;
            $combat->defender_debuffs = $oppDebuffs ?: null;
        } else {
            $combat->defender_cooldowns = $myCooldowns ?: null;
            $combat->defender_buffs = $myBuffs ?: null;
            $combat->defender_debuffs = $myDebuffs ?: null;
            $combat->attacker_buffs = $oppBuffs ?: null;
            $combat->attacker_debuffs = $oppDebuffs ?: null;
        }

        $log[] = $entry;
        $combat->log = $log;
        $combat->save();

        /* ─── Notificar al oponente ───────────────────────────────────── */
        if ($combat->status === 'active') {
            // Sin notificación inmediata: la UI del combate (polling) ya refleja el cambio de turno.
            // Push diferido: solo llega si el oponente sigue sin responder pasado el plazo configurado

            $delaySeg = (int) Configuracion::valor('pvp_notif_push_delay_seg', 30);
            $opponentUser->notify(
                (new PvpTurnoPushRecordatorio($combat->id, $actorChar->name, count($log)))
                    ->delay(now()->addSeconds($delaySeg))
            );
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

    /** POST /pvp/{id}/emoji — expresión cosmética, disponible en cualquier momento (no consume turno) */
    public function emoji(Request $request, int $id): JsonResponse
    {
        $data = $request->validate([
            'emote_id' => ['required', 'string', 'in:'.implode(',', array_keys(self::EMOTES))],
        ]);

        $user = $request->user();
        $combat = PvpCombat::with(self::WITHS)->findOrFail($id);

        if (! $combat->involvedUser($user->id)) {
            return response()->json(['error' => 'No autorizado'], 403);
        }
        if ($combat->status !== 'active') {
            return response()->json(['error' => 'El combate no está activo'], 422);
        }

        $isAttacker = $user->id === $combat->attacker_id;
        $actorChar = $isAttacker ? $combat->attacker->character : $combat->defender->character;
        $emote = self::EMOTES[$data['emote_id']];

        $log = $combat->log ?? [];
        $log[] = [
            'turn' => count($log) + 1,
            'actor_id' => $user->id,
            'type' => 'emoji',
            'emoji' => $emote['emoji'],
            'messages' => ["{$actorChar->name} {$emote['desc']} {$emote['emoji']} ({$emote['label']})"],
        ];
        $combat->log = $log;
        $combat->save();

        return response()->json([
            'combat' => $this->formatCombat($combat->fresh(self::WITHS), $user->id),
        ]);
    }

    // ─────────────────────────── helpers ──────────────────────────────────────

    private function formatCombat(PvpCombat $c, int $myId): array
    {
        $att = $c->attacker;
        $def = $c->defender;
        $isAtt = $myId === $c->attacker_id;

        return [
            'id' => $c->id,
            'status' => $c->status,
            'modo' => $c->modo ?? 'normal',
            'ronda' => $c->ronda ?? 1,
            'current_turn' => $c->current_turn,
            'is_my_turn' => $c->current_turn === $myId && $c->status === 'active',
            'i_am_attacker' => $c->attacker_id === $myId,
            'attacker_hp' => $c->attacker_hp,
            'defender_hp' => $c->defender_hp,
            'attacker_escudo' => $c->attacker_escudo,
            'defender_escudo' => $c->defender_escudo,
            'attacker_def_bonus' => $c->attacker_def_bonus,
            'defender_def_bonus' => $c->defender_def_bonus,
            'lugar_id' => $c->lugar_id,
            'zona_id' => $c->zona_id,
            'planeta_id' => $c->planeta_id,
            'sistema_id' => $c->sistema_id,
            'log' => $c->log ?? [],
            /* Para el contador de "tiempo restante antes de notificar" en el HUD de combate */
            'turno_desde' => $c->updated_at?->toISOString(),
            'notif_delay_seg' => (int) Configuracion::valor('pvp_notif_push_delay_seg', 30),
            /* Estado de habilidades desde perspectiva del jugador */
            'my_fuerza' => $isAtt ? $c->attacker_fuerza : $c->defender_fuerza,
            'my_fuerza_max' => $isAtt ? self::fuerzaConfig($att->character)['max'] : self::fuerzaConfig($def->character)['max'],
            'my_cooldowns' => ($isAtt ? $c->attacker_cooldowns : $c->defender_cooldowns) ?? [],
            'my_buffs' => ($isAtt ? $c->attacker_buffs : $c->defender_buffs) ?? [],
            'my_debuffs' => ($isAtt ? $c->attacker_debuffs : $c->defender_debuffs) ?? [],
            'opp_buffs' => ($isAtt ? $c->defender_buffs : $c->attacker_buffs) ?? [],
            'opp_debuffs' => ($isAtt ? $c->defender_debuffs : $c->attacker_debuffs) ?? [],
            'my_last_forma' => $isAtt ? $c->attacker_last_forma : $c->defender_last_forma,
            'opp_last_forma' => $isAtt ? $c->defender_last_forma : $c->attacker_last_forma,
            'my_current_forma' => $isAtt ? ($c->attacker_current_forma ?? 1) : ($c->defender_current_forma ?? 1),
            'opp_current_forma' => $isAtt ? ($c->defender_current_forma ?? 1) : ($c->attacker_current_forma ?? 1),
            'attacker' => $this->formatPlayer($att, $c->attacker_current_forma ?? 1, $c->modo ?? 'normal'),
            'defender' => $this->formatPlayer($def, $c->defender_current_forma ?? 1, $c->modo ?? 'normal'),
        ];
    }

    private function formatPlayer(User $user, int $currentForma = 1, string $modo = 'normal'): array
    {
        $ch = $user->character;

        $naveSkillIds = self::getNaveSkillIds($ch, $modo);
        if ($naveSkillIds) {
            $slotIds = $naveSkillIds;
        } else {
            $porForma = is_array($ch?->habilidades_por_forma) ? $ch->habilidades_por_forma : [];
            $slotIds = array_filter($porForma[(string) $currentForma] ?? []);
        }

        $habilidades = $slotIds
            ? RolHabilidad::whereIn('id', $slotIds)->get()->map(fn ($h) => self::fmtHab($h))->values()->toArray()
            : [];

        $naveOwned = $modo === 'naval' ? self::getNaveOwned($ch) : null;

        return [
            'id' => $user->id,
            'name' => $ch?->name ?? $user->name,
            'handle' => $ch?->handle ?? $user->name,
            'photo_url' => $ch?->photo ? Storage::disk('public')->url($ch->photo) : null,
            'nave_imagen' => $naveOwned?->nave?->imagen,
            'stats' => self::getCombatStats($ch, $modo),
            /* Máximos reales (no el daño persistido) — para las barras de vida/escudo del HUD.
             * En modo naval, `stats.vida`/`stats.escudo` son el HP/escudo actual de la nave
             * (persiste entre combates), no su capacidad máxima; sin esto la barra de una nave
             * dañada o destruida sin reparar se ve como "0 vida" y sin escudo. */
            'vida_max' => self::getMaxVida($ch, $modo),
            'escudo_max' => self::getMaxEscudo($ch, $modo),
            'habilidades' => $habilidades,
            'current_forma' => $currentForma,
            'arma_equipada' => $ch?->armaEfectiva(),
            'es_nave' => $modo === 'naval',
        ];
    }

    private static function fmtHab(RolHabilidad $h): array
    {
        return [
            'id' => $h->id,
            'nombre' => $h->nombre,
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

    private function endMessage(PvpCombat $c, int $userId): string
    {
        $won = ($c->status === 'attacker_won' && $c->attacker_id === $userId)
            || ($c->status === 'defender_won' && $c->defender_id === $userId)
            || ($c->status === 'fled_attacker' && $c->defender_id === $userId)
            || ($c->status === 'fled_defender' && $c->attacker_id === $userId);

        return $won ? '¡Ganaste el combate PvP! (el rival huyó)' : 'Fuiste derrotado en el combate PvP';
    }

    private static function getCombatStats(?object $char, string $modo = 'normal'): array
    {
        if (! $char) {
            return ['vida' => 30, 'escudo' => 10, 'ataque' => 20, 'defensa' => 15,
                'iniciativa' => 10, 'punteria' => 10, 'movimiento' => 20];
        }

        /* Combate naval: si el combate se determinó como naval (ver challenge()),
         * los atributos de la nave equipada reemplazan por completo a los del
         * personaje (vida/escudo persisten el daño entre combates — requieren
         * reparación). En combate normal siempre se usan los stats del personaje,
         * tenga o no una nave equipada. */
        $naveOwned = $modo === 'naval' ? self::getNaveOwned($char) : null;
        if ($naveOwned && $naveOwned->nave) {
            $nave = $naveOwned->nave;

            /* Bonos de las mejoras instaladas en los 4 slots de la nave (rol_objetos
             * tipo mejora_nave) — ver CharacterNave::sumaBono(). */
            return [
                'vida' => min($naveOwned->vida_actual, $naveOwned->maxVidaConMejoras()),
                'escudo' => min($naveOwned->escudo_actual, $naveOwned->maxEscudoConMejoras()),
                'ataque' => $nave->ataque + $naveOwned->sumaBono('bono_ataque'),
                'defensa' => $nave->maniobrabilidad + $naveOwned->sumaBono('bono_defensa'),
                'movimiento' => $nave->maniobrabilidad + $naveOwned->sumaBono('bono_movimiento'),
                'iniciativa' => $nave->velocidad + $naveOwned->sumaBono('bono_iniciativa'),
                'punteria' => $nave->ataque + $naveOwned->sumaBono('bono_punteria'),
            ];
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

    /** Aplica buffs y debuffs sobre los stats base */
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

    /** Descuenta 1 ronda a cada efecto (buff/debuff) y elimina los que ya expiraron */
    private static function tickEffects(array $effects): array
    {
        return array_values(array_filter(
            array_map(fn ($e) => array_merge($e, ['turns' => $e['turns'] - 1]), $effects),
            fn ($e) => $e['turns'] > 0
        ));
    }

    /** ¿La forma del atacante supera la forma del defensor? */
    private static function isEffective(int $atkForma, int $defForma): bool
    {
        if ($atkForma === 0 || $defForma === 0) {
            return false;
        }

        return in_array($defForma, self::BEATS[$atkForma] ?? [], true);
    }

    private static function persistNaveDamage(?object $char, int $hp, int $escudo): void
    {
        $naveOwned = self::getNaveOwned($char);
        if ($naveOwned) {
            $naveOwned->update(['vida_actual' => max(0, $hp), 'escudo_actual' => max(0, $escudo)]);
        }
    }

    /** Nave equipada del personaje (con relación 'nave' cargada), o null si no aplica */
    private static function getNaveOwned(?object $char): ?object
    {
        if (! $char || ! method_exists($char, 'naveEquipada')) {
            return null;
        }

        return $char->relationLoaded('naveEquipada')
            ? $char->naveEquipada
            : $char->naveEquipada()->with('nave')->first();
    }

    /** IDs de las habilidades (tipo 'nave') asignadas a la nave equipada, o [] si el combate no es naval */
    private static function getNaveSkillIds(?object $char, string $modo = 'normal'): array
    {
        if ($modo !== 'naval') {
            return [];
        }

        $naveOwned = self::getNaveOwned($char);
        if (! $naveOwned || ! $naveOwned->nave) {
            return [];
        }

        $nave = $naveOwned->nave;

        return array_values(array_filter([
            $nave->habilidad_1, $nave->habilidad_2, $nave->habilidad_3, $nave->habilidad_4,
        ]));
    }

    /** Vida máxima para topar curaciones: vida base de la nave si el combate es naval, o vida de combate del personaje */
    private static function getMaxVida(?object $char, string $modo = 'normal'): int
    {
        $naveOwned = $modo === 'naval' ? self::getNaveOwned($char) : null;
        if ($naveOwned && $naveOwned->nave) {
            return $naveOwned->maxVidaConMejoras();
        }

        return (int) self::getCombatStats($char, $modo)['vida'];
    }

    /** Escudo máximo para topar curaciones de escudo: escudo base de la nave (+mejoras) si el combate es naval, o de combate del personaje */
    private static function getMaxEscudo(?object $char, string $modo = 'normal'): int
    {
        $naveOwned = $modo === 'naval' ? self::getNaveOwned($char) : null;
        if ($naveOwned && $naveOwned->nave) {
            return $naveOwned->maxEscudoConMejoras();
        }

        return (int) self::getCombatStats($char, $modo)['escudo'];
    }

    /**
     * Aplica daño con tres componentes: dmg (normal), dmgEscudo (extra solo
     * contra escudo) y dmgPerforante (ignora el escudo, siempre pasa a la vida).
     *
     * - Sin escudo: todo (dmg + dmgPerforante) pasa a la vida.
     * - Con escudo, si el componente dmgEscudo por sí solo NO agota el escudo
     *   restante: el escudo absorbe dmg + dmgEscudo por completo (sin dejar
     *   pasar nada, aunque el golpe sea mayor que el escudo restante) — solo
     *   el perforante llega a la vida.
     * - Con escudo, si el componente dmgEscudo por sí solo SÍ agota el escudo
     *   restante: el escudo queda en 0 y el resto (dmg + dmgPerforante) pasa
     *   directo a la vida.
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

    /**
     * Describe en texto el reparto de daño entre escudo y vida, según la misma
     * lógica de `applyDamage`. `escudoAntes` es el escudo del objetivo antes
     * del golpe.
     */
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
