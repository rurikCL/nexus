import { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from './ui.jsx';
import { NX } from '../data/seed.js';
import { useDiceRoller, renderDiceText } from './DiceRoller.jsx';
import { SkillTooltip } from './SkillTooltip.jsx';
import { getRelativeCenter } from './combatFx.jsx';
import EnergyStrikeEffect from './EnergyStrikeEffect.jsx';
import RangedStrikeEffect from './RangedStrikeEffect.jsx';
import FloatingCombatText from './FloatingCombatText.jsx';
import FleeEffect from './FleeEffect.jsx';
import CombatCardModal from './CombatCard.jsx';
import { EmojiRing, EmojiBurst } from './EmojiExpressions.jsx';

/* Clasifica una entrada del log del servidor como golpe melee/a distancia,
   con impacto o falla, para disparar el VFX correspondiente. El servidor no
   envía esta clasificación estructurada, así que se infiere del texto del
   mensaje + el arma/habilidades del lado que actuó. */
function classifyPvpAttack(entry, combat, myId) {
  const msgs = entry.messages ?? [];
  if (msgs.some((m) => /intenta huir/.test(m))) return null; // la huida tiene su propia animación
  const attackMsg = msgs.find((m) => / vs 1d20/.test(m));
  if (!attackMsg) return null;

  const actorIsMe = entry.actor_id === myId;
  const actorSide = actorIsMe
    ? (combat.i_am_attacker ? combat.attacker : combat.defender)
    : (combat.i_am_attacker ? combat.defender : combat.attacker);

  let ranged;
  if (/ataca (con|desarmado)/.test(attackMsg)) {
    ranged = actorSide?.arma_equipada?.tipo_ataque === 'distancia';
  } else {
    const nameMatch = attackMsg.match(/usa (.+?): 1d20/);
    const hab = nameMatch ? (actorSide?.habilidades ?? []).find((h) => h.nombre === nameMatch[1]) : null;
    ranged = hab ? hab.tipo !== 'melee' : false;
  }

  const hit = msgs.some((m) => /¡Impacto!|¡CRÍTICO!/.test(m));
  const crit = msgs.some((m) => /¡CRÍTICO!/.test(m));
  // Un mismo mensaje puede reportar dos cifras de daño (p. ej. escudo perforado) — se suman todas.
  const dmg = [...msgs.join(' ').matchAll(/−(\d+) daño/g)].reduce((sum, m) => sum + Number(m[1]), 0);
  return { actorIsMe, ranged, hit, crit, dmg };
}

/* Extrae pares de tirada 1d20 embebidos en un mensaje del log del servidor.
   Soporta el formato "1d20+X=Y" (habilidades/ataque básico) y "1d20(D)+X=Y" (iniciativa). */
function diceValuesFromMessage(msg) {
  const rx = /1d20(?:\((\d+)\))?\+(-?\d+)=(-?\d+)/g;
  const out = [];
  let m;
  while ((m = rx.exec(msg))) {
    const dado = m[1] !== undefined ? Number(m[1]) : Number(m[3]) - Number(m[2]);
    out.push(Math.max(1, Math.min(20, dado)));
  }
  return out;
}

/* Agrupa las tiradas de una entrada de log en pares [rollA, rollB] con su color/label,
   en el orden en que aparecen (acción propia primero, reroll de iniciativa después si lo hay). */
function extractRollGroups(entry, { myId, attackerId }) {
  const groups = [];
  for (const msg of entry.messages ?? []) {
    const vals = diceValuesFromMessage(msg);
    if (vals.length < 2) continue;
    const isIniciativa = /^Ronda \d+ —/.test(msg);
    const aIsMe = isIniciativa ? myId === attackerId : entry.actor_id === myId;
    groups.push([
      { key: 'a', color: aIsMe ? '#38cdf0' : '#ff6b6b', label: aIsMe ? 'TÚ' : 'RIVAL', value: vals[0] },
      { key: 'b', color: aIsMe ? '#ff6b6b' : '#38cdf0', label: aIsMe ? 'RIVAL' : 'TÚ', value: vals[1] },
    ]);
  }
  return groups;
}

/* Texto flotante mostrado sobre el objetivo al terminar el golpe de energía */
function resultTextFor(hit, ranged, crit, dmg) {
  if (!hit) return { variant: ranged ? 'dodge' : 'block', text: ranged ? 'ESQUIVADO' : 'BLOQUEADO' };
  if (crit) return { variant: 'crit', text: `¡CRÍTICO! −${dmg}` };
  return { variant: 'hit', text: `HIT: ${dmg}` };
}

/* Detecta una curación (auto-curación u a distancia) en una entrada del log del backend */
function classifyPvpHeal(entry, myId) {
  const msgs = entry.messages ?? [];
  const actorIsMe = entry.actor_id === myId;

  const selfMatch = msgs.map((m) => m.match(/^¡Curación! \+(\d+) (?:vida|escudo)/)).find(Boolean);
  if (selfMatch) return { healedIsMe: actorIsMe, heal: Number(selfMatch[1]) };

  const targetMatch = msgs.map((m) => m.match(/cura \+(\d+) vida a/)).find(Boolean);
  if (targetMatch) return { healedIsMe: !actorIsMe, heal: Number(targetMatch[1]) };

  return null;
}

/* Detecta un intento de huida en una entrada del log y si tuvo éxito */
function classifyPvpFlee(entry, myId) {
  const msgs = entry.messages ?? [];
  if (!msgs.some((m) => /intenta huir/.test(m))) return null;
  const actorIsMe = entry.actor_id === myId;
  const success = msgs.some((m) => /logra huir del combate/.test(m));
  return { actorIsMe, success };
}

/* Detecta una expresión/emoji usada por alguno de los dos jugadores */
function classifyPvpEmoji(entry, myId) {
  if (entry.type !== 'emoji' || !entry.emoji) return null;
  return { actorIsMe: entry.actor_id === myId, emoji: entry.emoji };
}

function useIsMobile() {
  const [m, setM] = useState(() => window.innerWidth < 640);
  useEffect(() => {
    const fn = () => setM(window.innerWidth < 640);
    window.addEventListener('resize', fn);
    return () => window.removeEventListener('resize', fn);
  }, []);
  return m;
}

const AUTH = () => {
  const t = localStorage.getItem('nx-token');
  return { Accept: 'application/json', Authorization: `Bearer ${t}` };
};
const apiFetch = (path) =>
  fetch(`/api${path}`, { headers: AUTH() }).then((r) => {
    if (!r.ok) throw new Error(r.status);
    return r.json();
  });
const apiPost = (path, data) =>
  fetch(`/api${path}`, {
    method: 'POST',
    headers: { ...AUTH(), 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  }).then((r) => {
    if (!r.ok) throw new Error(r.status);
    return r.json();
  });
const mediaUrl = (path) => {
  if (!path) return null;
  if (/^(https?:)?\/\//.test(path) || path.startsWith('data:') || path.startsWith('blob:')) return path;
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  if (cleanPath.startsWith('/storage/')) return cleanPath;
  if (cleanPath.startsWith('/admin/'))   return `/storage${cleanPath}`;
  if (cleanPath.startsWith('/public/'))  return cleanPath.replace('/public/', '/storage/');
  return `/storage${cleanPath}`;
};

/* Tabla de efectividad (forma atacante → formas que supera) */
const BEATS = {
  1: [6], 6: [3], 3: [4], 4: [1],
  2: [1, 5], 5: [4], 7: [5, 6],
};
const isEffective = (atkForma, defForma) => {
  if (!atkForma || !defForma) return false;
  return (BEATS[atkForma] ?? []).includes(defForma);
};

const tipoIcon   = (tipo) => tipo === 'melee' ? '⚔' : '◎';
const formaLabel = (f)    => ['―', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII'][f] ?? String(f);
const BADGE_ICON = { ATQ: 'sword', DEF: 'shield', PNT: 'target', MOV: 'arrow', INI: 'zap' };
const STAT_ABBR = { ataque: 'ATQ', defensa: 'DEF', punteria: 'PNT', movimiento: 'AGI', iniciativa: 'INI' };

/* Colapsa buffs/debuffs repetidos sobre el mismo stat en una sola entrada (suma monto, toma la mayor duración) */
const mergeEffects = (buffs = [], debuffs = []) => Object.values(
  [...buffs.map(b => ({ ...b, kind: 'buff' })), ...debuffs.map(d => ({ ...d, kind: 'debuff' }))]
    .reduce((acc, e) => {
      const key = `${e.kind}-${e.stat}`;
      acc[key] = acc[key]
        ? { ...acc[key], amount: acc[key].amount + 1, turns: Math.max(acc[key].turns, e.turns) }
        : { kind: e.kind, stat: e.stat, amount: 1, turns: e.turns };
      return acc;
    }, {})
);

export default function PvpCombatScreen({ combat: initialCombat, userId, onClose, lugarImagen }) {
  const [combat, setCombat]             = useState(initialCombat);
  const [busy, setBusy]                 = useState(false);
  const [logCollapsed, setLogCollapsed] = useState(false);
  const [bgImg, setBgImg]               = useState(lugarImagen ?? null);
  const pollRef                         = useRef(null);
  const logRef                          = useRef(null);
  const stageRef                        = useRef(null);
  const myHudRef                        = useRef(null);
  const oppHudRef                       = useRef(null);
  const myAvatarRef                     = useRef(null);
  const [strike, setStrike]             = useState(null);
  const [fleeFx, setFleeFx]             = useState(null);
  const [showCombatCard, setShowCombatCard] = useState(false);
  const [floatTexts, setFloatTexts]     = useState([]);
  const [emojiPicker, setEmojiPicker]   = useState(false);
  const [emojiBurst, setEmojiBurst]     = useState(null);
  const pendingCombatRef = useRef(null);
  /* Duración máxima observada por efecto (buff/debuff), para dibujar la barrita
     de rondas restantes que se va reduciendo — se resetea cuando el efecto expira. */
  const effectMaxTurnsRef = useRef({});

  const me  = combat.i_am_attacker ? combat.attacker : combat.defender;
  const opp = combat.i_am_attacker ? combat.defender : combat.attacker;
  const myHp        = combat.i_am_attacker ? combat.attacker_hp        : combat.defender_hp;
  const myEscudo    = combat.i_am_attacker ? combat.attacker_escudo    : combat.defender_escudo;
  const myDefBonus  = combat.i_am_attacker ? combat.attacker_def_bonus : combat.defender_def_bonus;
  const oppHp       = combat.i_am_attacker ? combat.defender_hp        : combat.attacker_hp;
  const oppEscudo   = combat.i_am_attacker ? combat.defender_escudo    : combat.attacker_escudo;
  const oppDefBonus = combat.i_am_attacker ? combat.defender_def_bonus : combat.attacker_def_bonus;

  const myFuerza    = combat.my_fuerza     ?? 0;
  const myFuerzaMax = combat.my_fuerza_max ?? 10;
  const myCooldowns = combat.my_cooldowns ?? {};
  const myBuffs    = combat.my_buffs     ?? [];
  const myDebuffs  = combat.my_debuffs   ?? [];
  const oppDebuffs = combat.opp_debuffs  ?? [];
  const oppBuffs   = combat.opp_buffs    ?? [];
  const myLastForma    = combat.my_last_forma    ?? 0;
  const oppLastForma   = combat.opp_last_forma   ?? 0;
  const myCurrentForma = combat.my_current_forma ?? 1;
  const oppCurrentForma = combat.opp_current_forma ?? 1;

  const [stancePicker, setStancePicker] = useState(false);
  const isMobile = useIsMobile();
  const FORMA_LABELS_SHORT = ['Shii-Cho', 'Makashi', 'Soresu', 'Ataru', 'Shien/DjSo', 'Niman', 'Juyo/Vaapad'];
  const { diceOverlay, rollDice } = useDiceRoller();
  const [hoveredHabId, setHoveredHabId] = useState(null);
  useEffect(() => { if (!combat.is_my_turn || busy) setHoveredHabId(null); }, [combat.is_my_turn, busy]);

  /* Bloquea el scroll de la página mientras el combate está en pantalla */
  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prevOverflow; };
  }, []);

  /* Rastrea cuántas entradas de log ya se mostraron, para animar solo las nuevas */
  const combatLogLenRef = useRef((combat.log ?? []).length);
  useEffect(() => { combatLogLenRef.current = (combat.log ?? []).length; }, [combat]);

  const commitPendingCombat = () => {
    if (!pendingCombatRef.current) return;
    setCombat(pendingCombatRef.current);
    pendingCombatRef.current = null;
  };

  /* Anima con dados las tiradas de las entradas nuevas antes de revelar el estado actualizado */
  const revealWithDice = async (newCombat) => {
    const prevLen = combatLogLenRef.current;
    const newEntries = (newCombat.log ?? []).slice(prevLen);
    const attackerId = newCombat.attacker?.id;
    let lastAttack = null;
    let lastHeal = null;
    let lastFlee = null;
    let lastEmoji = null;
    for (const entry of newEntries) {
      const groups = extractRollGroups(entry, { myId: userId, attackerId });
      for (const g of groups) await rollDice(g);
      const classified = classifyPvpAttack(entry, newCombat, userId);
      if (classified) lastAttack = classified;
      const healed = classifyPvpHeal(entry, userId);
      if (healed) lastHeal = healed;
      const fled = classifyPvpFlee(entry, userId);
      if (fled) lastFlee = fled;
      const emoted = classifyPvpEmoji(entry, userId);
      if (emoted && !emoted.actorIsMe) lastEmoji = emoted;
    }

    if (lastEmoji) {
      setEmojiBurst({ id: `${Date.now()}-${Math.random()}`, emoji: lastEmoji.emoji });
    }

    if (lastHeal && stageRef.current) {
      const healRef = lastHeal.healedIsMe ? myHudRef : oppHudRef;
      if (healRef.current) {
        const pos = getRelativeCenter(healRef.current, stageRef.current);
        setFloatTexts((prev) => [...prev, {
          id: `${Date.now()}-${Math.random()}`, x: pos.x, y: pos.y,
          variant: 'heal', text: `Curación: ${lastHeal.heal}`,
        }]);
      }
    }

    if (lastAttack && stageRef.current) {
      const attackerRef = lastAttack.actorIsMe ? myHudRef : oppHudRef;
      const targetRef    = lastAttack.actorIsMe ? oppHudRef : myHudRef;
      const actorSide = lastAttack.actorIsMe
        ? (newCombat.i_am_attacker ? newCombat.attacker : newCombat.defender)
        : (newCombat.i_am_attacker ? newCombat.defender : newCombat.attacker);
      const arma = actorSide?.arma_equipada;
      const color = (arma?.es_sable && NX.SABERS[arma.color_hoja]) || (lastAttack.actorIsMe ? '#38cdf0' : '#ff2d45');

      pendingCombatRef.current = newCombat;
      setStrike({
        key: `${Date.now()}-${Math.random()}`,
        type: lastAttack.ranged ? 'ranged' : 'melee',
        outcome: lastAttack.hit ? 'hit' : (lastAttack.ranged ? 'dodge' : 'block'),
        color,
        attackerRef,
        targetRef,
        from: getRelativeCenter(attackerRef.current, stageRef.current),
        to: getRelativeCenter(targetRef.current, stageRef.current),
        result: resultTextFor(lastAttack.hit, lastAttack.ranged, lastAttack.crit, lastAttack.dmg),
        onResolve: commitPendingCombat,
      });
      return;
    }

    if (lastFlee && stageRef.current) {
      const actorRef = lastFlee.actorIsMe ? myHudRef : oppHudRef;
      if (actorRef.current) {
        pendingCombatRef.current = newCombat;
        setFleeFx({
          key: `${Date.now()}-${Math.random()}`,
          outcome: lastFlee.success ? 'success' : 'fail',
          dir: lastFlee.actorIsMe ? -1 : 1,
          actorRef,
          onResolve: commitPendingCombat,
        });
        return;
      }
    }

    setCombat(newCombat);
  };

  /* Fondo */
  useEffect(() => {
    if (lugarImagen) return;
    const token = localStorage.getItem('nx-token');
    const get = (url) =>
      fetch(url, { headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' } })
        .then(r => r.ok ? r.json() : Promise.resolve({}))
        .catch(() => ({}));
    const tryLevel = (id, endpoint, key) =>
      id ? get(`/api/map/${endpoint}/${id}`).then(d => d?.[key]?.imagen || null) : Promise.resolve(null);
    (async () => {
      const img =
        await tryLevel(combat.lugar_id,   'lugares',  'lugar')   ||
        await tryLevel(combat.zona_id,    'zonas',    'zona')    ||
        await tryLevel(combat.planeta_id, 'planetas', 'planeta') ||
        await tryLevel(combat.sistema_id, 'sistemas', 'sistema');
      if (img) setBgImg(mediaUrl(img));
    })();
  }, [combat.lugar_id, combat.zona_id, combat.planeta_id, combat.sistema_id]);

  /* Polling cuando no es mi turno o cuando el combate está pendiente */
  useEffect(() => {
    clearInterval(pollRef.current);
    const shouldPoll = combat.status === 'pending' || (combat.status === 'active' && !combat.is_my_turn);
    if (!shouldPoll) return;
    pollRef.current = setInterval(() => {
      apiFetch(`/pvp/${combat.id}`)
        .then(d => { if (d?.combat) revealWithDice(d.combat); })
        .catch(() => {});
    }, 4000);
    return () => clearInterval(pollRef.current);
  }, [combat.is_my_turn, combat.status, combat.id]);

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [combat.log]);

  const cancelChallenge = async () => {
    if (busy || !isPending) return;
    setBusy(true);
    try {
      await apiPost(`/pvp/${combat.id}/cancel`, {});
      onClose({});
    } catch { /* toast shown by apiPost */ setBusy(false); }
  };

  const doAction = async (skillId) => {
    if (busy || !combat.is_my_turn || combat.status !== 'active') return;
    setBusy(true);
    try {
      const d = await apiPost(`/pvp/${combat.id}/action`, { skill: String(skillId) });
      if (d?.combat) await revealWithDice(d.combat);
    } catch { /* toast shown by apiPost */ }
    finally { setBusy(false); }
  };

  const doStance = async (forma) => {
    if (busy || !combat.is_my_turn || combat.status !== 'active') return;
    setStancePicker(false);
    setBusy(true);
    try {
      const d = await apiPost(`/pvp/${combat.id}/action`, { skill: 'stance', forma });
      if (d?.combat) await revealWithDice(d.combat);
    } catch { /* ignore */ }
    finally { setBusy(false); }
  };

  /* Expresión cosmética: no consume turno, se muestra al instante en local y se sincroniza
     al rival (que la verá al llegar en su próximo polling del combate). */
  const sendEmoji = async (it) => {
    setEmojiPicker(false);
    setEmojiBurst({ id: `${Date.now()}`, emoji: it.emoji });
    try {
      const d = await apiPost(`/pvp/${combat.id}/emoji`, { emote_id: it.id });
      if (d?.combat) await revealWithDice(d.combat);
    } catch { /* ignore */ }
  };

  const isPending   = combat.status === 'pending';
  const isDeclined  = combat.status === 'declined';
  const isCancelled = combat.status === 'cancelled';
  const isOver = combat.status !== 'active' && !isPending;
  const iWon   = (combat.status === 'attacker_won'  &&  combat.i_am_attacker)
              || (combat.status === 'defender_won'  && !combat.i_am_attacker)
              || (combat.status === 'fled_attacker' && !combat.i_am_attacker)
              || (combat.status === 'fled_defender' &&  combat.i_am_attacker);
  const iFled  = (combat.status === 'fled_attacker' &&  combat.i_am_attacker)
              || (combat.status === 'fled_defender' && !combat.i_am_attacker);

  const overPayload = iWon ? { won: true } : iFled ? { fled: true } : { won: false };

  const pct  = (v, m) => m > 0 ? Math.max(0, Math.min(100, (v / m) * 100)) : 0;
  const vcol = (p) => p > 50 ? '#10b981' : p > 25 ? '#E6B325' : '#ff2d45';

  /* Stats efectivos para mostrar en HUD */
  const countBuff   = (arr, stat) => (arr ?? []).filter(b => b.stat === stat).length;
  const effMyStat   = (stat) => (me.stats?.[stat] ?? 0) + countBuff(myBuffs, stat)  - countBuff(myDebuffs, stat);
  const effOppStat  = (stat) => (opp.stats?.[stat] ?? 0) + countBuff(oppBuffs, stat) - countBuff(oppDebuffs, stat);

  const myBadges = [
    { l: 'ATQ', v: effMyStat('ataque'),    c: '#ff7043', bonus: countBuff(myBuffs, 'ataque')   > 0, dim: countBuff(myDebuffs, 'ataque')   > 0 },
    { l: 'DEF', v: effMyStat('defensa') + (myDefBonus || 0), c: '#38cdf0', bonus: countBuff(myBuffs, 'defensa') > 0 },
    { l: 'PNT', v: effMyStat('punteria'),  c: '#10b981', bonus: countBuff(myBuffs, 'punteria') > 0 },
    { l: 'AGI', v: effMyStat('movimiento'), c: '#a78bfa', bonus: countBuff(myBuffs, 'movimiento') > 0, dim: countBuff(myDebuffs, 'movimiento') > 0 },
  ];
  const myIni = me.stats?.iniciativa ?? 0;
  const oppBadges = [
    { l: 'ATQ', v: effOppStat('ataque'),   c: '#ff7043', dim: countBuff(oppDebuffs, 'ataque')   > 0 },
    { l: 'DEF', v: effOppStat('defensa') + (oppDefBonus || 0), c: '#38cdf0', dim: countBuff(oppDebuffs, 'defensa') > 0 },
    { l: 'PNT', v: effOppStat('punteria'), c: '#10b981', dim: countBuff(oppDebuffs, 'punteria') > 0 },
    { l: 'AGI', v: effOppStat('movimiento'), c: '#a78bfa', dim: countBuff(oppDebuffs, 'movimiento') > 0 },
  ];
  const oppIni = opp.stats?.iniciativa ?? 0;

  /* En combate naval se muestra la imagen de la nave equipada en vez de la
     foto del personaje, y no hay forma/estancia que mostrar (las naves no
     tienen forma de sable). */
  const myPhotoUrl  = mediaUrl(me.es_nave  ? me.nave_imagen  : me.photo_url);
  const oppPhotoUrl = mediaUrl(opp.es_nave ? opp.nave_imagen : opp.photo_url);
  const myFormaProp  = me.es_nave  ? 0 : myCurrentForma;
  const oppFormaProp = opp.es_nave ? 0 : oppCurrentForma;

  /* Adjunta a cada efecto el % de rondas restantes respecto de la mayor duración
     observada desde que apareció, para la barrita que se va reduciendo. */
  const withDurationPct = (side, effects) => {
    const store = effectMaxTurnsRef.current;
    const activeKeys = new Set();
    const withPct = effects.map(e => {
      const key = `${side}-${e.kind}-${e.stat}`;
      activeKeys.add(key);
      const max = Math.max(store[key] ?? 0, e.turns);
      store[key] = max;
      return { ...e, pct: pct(e.turns, max) };
    });
    Object.keys(store).forEach(k => { if (k.startsWith(`${side}-`) && !activeKeys.has(k)) delete store[k]; });
    return withPct;
  };
  const myEffects  = withDurationPct('my', mergeEffects(myBuffs, myDebuffs));
  const oppEffects = withDurationPct('opp', mergeEffects(oppBuffs, oppDebuffs));

  const HUD = ({ hp, maxHp, escudo, maxEscudo, photoUrl, nombre, handle, borderColor, badges, ini, align, effects = [], forma = 0, effectsPosition = 'side', avatarRef, onAvatarClick }) => {
    const vPct = pct(hp, maxHp);
    const ePct = pct(escudo, maxEscudo);
    const vc   = vcol(vPct);
    const rev  = align === 'right';
    const formaImgSrc = forma > 0 ? NX.CLASSES[forma - 1]?.img : null;
    const renderBadge = (e, i) => {
      const abbr = STAT_ABBR[e.stat] ?? e.stat.slice(0, 3).toUpperCase();
      const c = e.kind === 'buff' ? '#10b981' : '#ff6b6b';
      return (
        <span key={`${e.kind}-${e.stat}-${i}`} title={`${e.kind === 'buff' ? 'Buff' : 'Debuff'} · ${e.turns} ronda${e.turns === 1 ? '' : 's'} restante${e.turns === 1 ? '' : 's'}`} style={{
          display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: 2, flexShrink: 0,
          fontSize: 8, fontFamily: 'var(--font-data)', padding: '2px 5px', borderRadius: 4,
          background: `${c}18`, border: `1px solid ${c}55`, color: c, fontWeight: 700,
        }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, whiteSpace: 'nowrap' }}>
            {BADGE_ICON[abbr] && <Icon name={BADGE_ICON[abbr]} size={8} />}
            {e.kind === 'buff' ? '+' : '−'}{e.amount}
          </span>
          <div style={{ width: 18, height: 2, background: `${c}30`, borderRadius: 1 }}>
            <div style={{ height: '100%', width: `${e.pct}%`, background: c, borderRadius: 1, transition: 'width 0.4s ease' }} />
          </div>
        </span>
      );
    };
    const effectsColumn = effects.length > 0 && (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flexShrink: 0, justifyContent: 'center' }}>
        {effects.map(renderBadge)}
      </div>
    );
    const effectsRow = effects.length > 0 && (
      <div style={{ display: 'flex', flexDirection: 'row', flexWrap: 'wrap', gap: 4, justifyContent: 'center' }}>
        {effects.map(renderBadge)}
      </div>
    );

    const card = (
      <div style={{
        background: 'rgba(6,12,26,0.92)', backdropFilter: 'blur(16px)',
        border: `1px solid ${borderColor}`, borderRadius: 14,
        padding: isMobile ? 8 : 14, display: 'flex', flexDirection: rev ? 'row-reverse' : 'row',
        gap: isMobile ? 8 : 14, alignItems: 'flex-start', flex: 1, minWidth: 0,
      }}>
        <div style={{
          position: 'relative',
          width: isMobile ? 74 : 130, height: isMobile ? 62 : 100, borderRadius: 10, flexShrink: 0, overflow: 'visible',
        }}>
          <div ref={avatarRef} onClick={onAvatarClick} title={onAvatarClick ? 'Expresarse' : undefined}
            className={onAvatarClick ? 'nx-emoji-avatar-trigger' : undefined}
            style={{
              width: '100%', height: '100%', borderRadius: 10, overflow: 'hidden',
              border: `2px solid ${borderColor}`, background: 'rgba(255,255,255,0.06)',
              display: 'grid', placeItems: 'center',
            }}>
            {photoUrl
              ? <img src={photoUrl} alt={nombre} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : <Icon name="user" size={26} style={{ color: 'var(--holo)', opacity: 0.5 }} />
            }
          </div>
          {formaImgSrc && (
            <div title={`Forma ${formaLabel(forma)}`} style={{
              position: 'absolute', bottom: -6, right: -6, zIndex: 1,
              width: isMobile ? 22 : 30, height: isMobile ? 34 : 46, borderRadius: 8,
              overflow: 'hidden', border: `2px solid ${borderColor}`, background: 'rgba(6,12,26,0.95)',
              boxShadow: '0 2px 6px rgba(0,0,0,0.6)',
            }}>
              <img src={formaImgSrc} alt={`Forma ${formaLabel(forma)}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            </div>
          )}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', flexDirection: rev ? 'row-reverse' : 'row', alignItems: 'center', justifyContent: 'space-between', gap: 6, marginBottom: 2 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{nombre}</div>
            <span style={{
              fontSize: 9, fontFamily: 'var(--font-data)', padding: '2px 6px', borderRadius: 4,
              background: 'rgba(230,179,37,0.12)', border: '1px solid rgba(230,179,37,0.4)', color: '#E6B325',
              display: 'flex', alignItems: 'center', gap: 3, flexShrink: 0,
            }}>
              <span style={{ fontSize: 9, lineHeight: 1 }}>⚡</span>{ini}
            </span>
          </div>
          <div style={{ fontSize: 9, color: 'var(--txt-faint)', fontFamily: 'var(--font-data)', textAlign: rev ? 'right' : 'left', marginBottom: 8 }}>@{handle}</div>
          {maxEscudo > 0 && (
            <div style={{ marginBottom: 5 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                <span style={{ fontSize: 8, color: '#38cdf0', fontFamily: 'var(--font-data)' }}>ESC</span>
                <span style={{ fontSize: 8, color: '#38cdf0', fontFamily: 'var(--font-data)' }}>{escudo}/{maxEscudo}</span>
              </div>
              <div style={{ height: 4, background: 'rgba(56,205,240,0.12)', borderRadius: 2 }}>
                <div style={{ height: '100%', width: `${ePct}%`, background: '#38cdf0', borderRadius: 2, transition: 'width 0.4s ease' }} />
              </div>
            </div>
          )}
          <div style={{ marginBottom: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
              <span style={{ fontSize: 8, color: vc, fontFamily: 'var(--font-data)' }}>VID</span>
              <span style={{ fontSize: 8, color: vc, fontFamily: 'var(--font-data)' }}>{hp}/{maxHp}</span>
            </div>
            <div style={{ height: 9, background: 'rgba(16,185,129,0.12)', borderRadius: 5 }}>
              <div style={{ height: '100%', width: `${vPct}%`, background: vc, borderRadius: 5, transition: 'width 0.4s ease' }} />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, auto)', gap: 4, justifyContent: rev ? 'end' : 'start' }}>
            {badges.map(b => (
              <span key={b.l} style={{
                display: 'inline-flex', alignItems: 'center', gap: 3,
                fontSize: 9, fontFamily: 'var(--font-data)', padding: '2px 6px', borderRadius: 4,
                background: `${b.c}14`, border: `1px solid ${b.c}45`, color: b.c,
                opacity: b.dim ? 0.55 : 1,
                ...(b.bonus ? { boxShadow: `0 0 8px ${b.c}55`, fontWeight: 700 } : {}),
              }}>
                {BADGE_ICON[b.l] && <Icon name={BADGE_ICON[b.l]} size={9} />}
                {b.l}{b.v !== null ? ` ${b.v}` : ''}{b.bonus ? ' ▲' : b.dim ? ' ▼' : ''}
              </span>
            ))}
          </div>
        </div>
      </div>
    );

    const cardRow = (
      <div style={{ display: 'flex', alignItems: 'stretch', gap: 6 }}>
        {effectsPosition === 'side' ? (rev ? <>{card}{effectsColumn}</> : <>{effectsColumn}{card}</>) : card}
      </div>
    );

    if (effectsPosition === 'side') return cardRow;

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {effectsPosition === 'above' && effectsRow}
        {cardRow}
        {effectsPosition === 'below' && effectsRow}
      </div>
    );
  };

  const myHabilidades = me.habilidades ?? [];

  /* Agrupa el log del servidor (una entrada por turno) en tarjetas de ronda → tarjetas de turno */
  const logRounds = useMemo(() => {
    const rounds = [];
    let currentRonda = 1;
    const getRound = (r) => {
      let last = rounds[rounds.length - 1];
      if (!last || last.ronda !== r) { last = { ronda: r, turns: [] }; rounds.push(last); }
      return last;
    };
    (combat.log ?? []).forEach(entry => {
      const msgs = entry.messages ?? [];
      const markerIdx = msgs.findIndex(m => /^Ronda \d+ —/.test(m));
      const before = markerIdx === -1 ? msgs : msgs.slice(0, markerIdx);
      if (before.length > 0) {
        getRound(currentRonda).turns.push({ actorId: entry.actor_id, key: `${entry.turn}-a`, messages: before });
      }
      if (markerIdx !== -1) {
        const after = msgs.slice(markerIdx);
        const match = after[0].match(/^Ronda (\d+)/);
        currentRonda = match ? parseInt(match[1], 10) : currentRonda + 1;
        getRound(currentRonda).turns.push({ actorId: null, key: `${entry.turn}-b`, messages: after });
      }
    });
    return rounds;
  }, [combat.log]);

  /* Encabezado del registro/resumen de ronda — compartido entre el panel flotante (desktop) y el bloque central (mobile) */
  const logHeader = (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 6, padding: '7px 9px',
      cursor: 'pointer', userSelect: 'none', flexShrink: 0,
      borderBottom: logCollapsed ? 'none' : '1px solid rgba(56,205,240,0.10)',
    }} onClick={() => setLogCollapsed(p => !p)}>
      <span style={{ fontSize: 14, flexShrink: 0, lineHeight: 1 }}>📋</span>
      {!logCollapsed && (
        <span style={{ fontSize: 7, color: 'rgba(150,200,255,0.5)', fontFamily: 'var(--font-data)', letterSpacing: '0.16em', flex: 1, whiteSpace: 'nowrap' }}>
          REGISTRO · RONDA {combat.ronda ?? 1}
        </span>
      )}
      <span style={{ fontSize: 11, color: 'rgba(150,200,255,0.4)', flexShrink: 0 }}>{logCollapsed ? '›' : '‹'}</span>
    </div>
  );
  const logBody = !logCollapsed && (
    <div ref={logRef} style={{ overflowY: 'auto', padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: 6, flex: 1 }}>
      {logRounds.map(round => (
        <div key={round.ronda} style={{
          border: '1px solid rgba(56,205,240,0.16)', borderRadius: 8,
          background: 'rgba(56,205,240,0.035)', padding: '5px 6px', display: 'flex', flexDirection: 'column', gap: 4,
        }}>
          <div style={{
            fontSize: 8, color: '#38cdf0', fontFamily: 'var(--font-data)', letterSpacing: '0.14em',
            fontWeight: 700, opacity: 0.85,
          }}>RONDA {round.ronda}</div>
          {round.turns.map(turn => {
            const isSystem = turn.actorId == null;
            const isOpp    = turn.actorId === opp.id;
            const label    = isSystem ? null : isOpp ? opp.name : (me.name || 'Tú');
            const accent   = isSystem ? 'rgba(150,200,255,0.35)' : isOpp ? 'rgba(255,45,69,0.35)' : 'rgba(56,205,240,0.35)';
            const diceColors = isSystem
              ? (combat.i_am_attacker ? ['#38cdf0', '#ff6b6b'] : ['#ff6b6b', '#38cdf0'])
              : (isOpp ? ['#ff6b6b', '#38cdf0'] : ['#38cdf0', '#ff6b6b']);
            return (
              <div key={turn.key} style={{
                display: 'flex', flexDirection: 'column', gap: 2,
                ...(isSystem ? {} : {
                  border: `1px solid ${accent}`, borderRadius: 6,
                  background: isOpp ? 'rgba(255,45,69,0.05)' : 'rgba(56,205,240,0.05)',
                  padding: '4px 6px',
                }),
              }}>
                {label && (
                  <div style={{ fontSize: 7, color: accent.replace('0.35', '0.85'), fontFamily: 'var(--font-data)', letterSpacing: '0.08em', fontWeight: 700 }}>
                    {isOpp ? '👤 ' : '⚔ '}{label.toUpperCase()}
                  </div>
                )}
                {turn.messages.map((m, j) => (
                  <div key={j} style={{
                    fontSize: 10, color: 'rgba(200,225,255,0.78)',
                    fontFamily: 'var(--font-data)', letterSpacing: '0.03em', lineHeight: 1.4,
                    paddingLeft: isSystem ? 6 : 0,
                    borderLeft: isSystem ? '2px solid #38cdf0' : 'none',
                    animation: 'nx-fade-up 0.2s ease both',
                  }}>{renderDiceText(m, diceColors)}</div>
                ))}
              </div>
            );
          })}
        </div>
      ))}
      {!combat.is_my_turn && combat.status === 'active' && (
        <div style={{ display: 'flex', gap: 4, alignItems: 'center', marginTop: 3 }}>
          <span style={{ fontSize: 9, color: '#ff9999', fontFamily: 'var(--font-data)' }}>{opp.name}…</span>
          {[0, 1, 2].map(i => <div key={i} style={{ width: 3, height: 3, borderRadius: '50%', background: '#ff9999', animation: `nx-pulse 0.8s ${i * 0.2}s infinite` }} />)}
        </div>
      )}
    </div>
  );

  /* Contenido de la barra de acciones — compartido entre el layout desktop (absoluto) y mobile (flex, dentro de la columna) */
  const actionBarInner = (
    isPending ? (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
        <span style={{ color: '#E6B325', fontSize: 12, fontFamily: 'var(--font-data)', letterSpacing: '0.15em' }}>
          ⚔ RETO ENVIADO
        </span>
        <span style={{ color: 'rgba(150,200,255,0.45)', fontSize: 10, fontFamily: 'var(--font-data)', letterSpacing: '0.12em', animation: 'nx-pulse 1.5s infinite' }}>
          ESPERANDO RESPUESTA DE {(opp.name ?? '').toUpperCase()}…
        </span>
        <button onClick={cancelChallenge} disabled={busy} style={{
          padding: '6px 20px', borderRadius: 7, cursor: busy ? 'not-allowed' : 'pointer',
          background: 'rgba(255,45,69,0.08)', border: '1px solid rgba(255,45,69,0.3)',
          color: '#ff6b6b', fontFamily: 'var(--font-data)', fontSize: 9, letterSpacing: '0.14em',
          opacity: busy ? 0.5 : 1,
        }}>CANCELAR RETO</button>
      </div>
    ) : isOver ? (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 20 }}>
        {(isDeclined || isCancelled) ? (
          <>
            <span style={{ fontSize: 16, color: '#E6B325', fontFamily: 'var(--font-data)', letterSpacing: '0.14em' }}>
              {isCancelled ? '✗ RETO CANCELADO' : '✗ RETO RECHAZADO'}
            </span>
            <button onClick={() => onClose({})} style={{ padding: '8px 28px', borderRadius: 7, cursor: 'pointer', background: 'rgba(230,179,37,0.10)', border: '1px solid rgba(230,179,37,0.4)', color: '#E6B325', fontFamily: 'var(--font-data)', fontSize: 10, letterSpacing: '0.14em' }}>CERRAR</button>
          </>
        ) : iWon ? (
          <>
            <span style={{ fontSize: 16, color: '#10b981', fontFamily: 'var(--font-data)', letterSpacing: '0.14em' }}>
              {(combat.status === 'fled_attacker' || combat.status === 'fled_defender') ? '🏃 RIVAL HUYÓ — VICTORIA' : '⚡ VICTORIA'}
            </span>
            <button onClick={() => setShowCombatCard(true)} style={{ padding: '8px 28px', borderRadius: 7, cursor: 'pointer', background: 'rgba(16,185,129,0.18)', border: '1px solid rgba(16,185,129,0.5)', color: '#10b981', fontFamily: 'var(--font-data)', fontSize: 10, letterSpacing: '0.14em' }}>CONTINUAR →</button>
          </>
        ) : iFled ? (
          <>
            <span style={{ fontSize: 16, color: 'var(--txt-dim)', fontFamily: 'var(--font-data)', letterSpacing: '0.14em' }}>🏃 HUISTE</span>
            <button onClick={() => setShowCombatCard(true)} style={{ padding: '8px 28px', borderRadius: 7, cursor: 'pointer', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.2)', color: 'var(--txt-dim)', fontFamily: 'var(--font-data)', fontSize: 10, letterSpacing: '0.14em' }}>RETIRARSE</button>
          </>
        ) : (
          <>
            <span style={{ fontSize: 16, color: '#ff6b6b', fontFamily: 'var(--font-data)', letterSpacing: '0.14em' }}>☠ DERROTA</span>
            <button onClick={() => setShowCombatCard(true)} style={{ padding: '8px 28px', borderRadius: 7, cursor: 'pointer', background: 'rgba(255,45,69,0.14)', border: '1px solid rgba(255,45,69,0.45)', color: '#ff6b6b', fontFamily: 'var(--font-data)', fontSize: 10, letterSpacing: '0.14em' }}>RETIRARSE</button>
          </>
        )}
      </div>
    ) : !combat.is_my_turn ? (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ color: 'rgba(150,200,255,0.4)', fontSize: 11, fontFamily: 'var(--font-data)', letterSpacing: '0.15em', animation: 'nx-pulse 1.5s infinite' }}>
          ESPERANDO A {(opp.name ?? '').toUpperCase()}…
        </span>
      </div>
    ) : (
      <>
        {/* Barra de Fuerza */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 8, color: '#38cdf0', fontFamily: 'var(--font-data)', letterSpacing: '0.12em', flexShrink: 0 }}>FUERZA</span>
          <div style={{ display: 'flex', gap: 2, flex: 1 }}>
            {Array.from({ length: myFuerzaMax }, (_, i) => (
              <div key={i} style={{
                flex: 1, height: 6, borderRadius: 2,
                background: i < myFuerza ? '#38cdf0' : 'rgba(56,205,240,0.12)',
                transition: 'background 0.2s ease',
              }} />
            ))}
          </div>
          <span style={{ fontSize: 8, color: '#38cdf0', fontFamily: 'var(--font-data)', flexShrink: 0 }}>{myFuerza}/{myFuerzaMax}</span>
        </div>

        {/* Habilidades (grid 2x2) + otras opciones (grid 2x2) */}
        <div style={{ display: 'flex', gap: 10, alignItems: 'stretch', flex: 1, minHeight: 0 }}>
          {/* Habilidades */}
          <div style={{ flex: '1 1 62%', minWidth: 0, display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gridTemplateRows: 'repeat(2, 1fr)', gap: 5 }}>
            {myHabilidades.length === 0 ? (
              <div style={{ gridColumn: '1 / -1', gridRow: '1 / -1', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ fontSize: 10, color: 'rgba(150,200,255,0.3)', fontFamily: 'var(--font-data)' }}>Sin habilidades equipadas</span>
              </div>
            ) : (
              myHabilidades.map(hab => {
                const habId    = String(hab.id);
                const cdLeft   = myCooldowns[habId] ?? 0;
                const noFuerza = myFuerza < hab.costo_fuerza;
                const effective = isEffective(hab.forma, oppLastForma);
                const disabled = busy || cdLeft > 0 || noFuerza;
                const isSelf   = hab.objetivo === 'self';

                return (
                  <button key={hab.id}
                    onClick={() => !disabled && doAction(hab.id)}
                    disabled={disabled}
                    style={{
                      minWidth: 0, borderRadius: 8,
                      cursor: disabled ? 'not-allowed' : 'pointer',
                      background: effective
                        ? 'rgba(16,185,129,0.12)'
                        : disabled ? 'rgba(56,205,240,0.03)' : 'rgba(56,205,240,0.08)',
                      border: `1px solid ${effective ? 'rgba(16,185,129,0.45)' : disabled ? 'rgba(56,205,240,0.09)' : 'rgba(56,205,240,0.26)'}`,
                      display: 'flex', flexDirection: 'column', alignItems: 'stretch', textAlign: 'left',
                      gap: 3, padding: 4, opacity: disabled ? 0.45 : 1,
                      position: 'relative', transition: 'all 0.13s',
                    }}
                    onMouseEnter={e => { if (!disabled) { e.currentTarget.style.background = effective ? 'rgba(16,185,129,0.22)' : 'rgba(56,205,240,0.16)'; e.currentTarget.style.borderColor = effective ? 'rgba(16,185,129,0.7)' : 'rgba(56,205,240,0.48)'; } setHoveredHabId(hab.id); }}
                    onMouseLeave={e => { e.currentTarget.style.background = effective ? 'rgba(16,185,129,0.12)' : disabled ? 'rgba(56,205,240,0.03)' : 'rgba(56,205,240,0.08)'; e.currentTarget.style.borderColor = effective ? 'rgba(16,185,129,0.45)' : disabled ? 'rgba(56,205,240,0.09)' : 'rgba(56,205,240,0.26)'; setHoveredHabId(null); }}
                  >
                    {hoveredHabId === hab.id && <SkillTooltip hab={hab} />}
                    {/* Overlay de cooldown */}
                    {cdLeft > 0 && (
                      <div style={{
                        position: 'absolute', inset: 0, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center',
                        background: 'rgba(0,0,0,0.55)', zIndex: 2,
                      }}>
                        <span style={{ fontSize: 13, color: '#ff6b6b', fontFamily: 'var(--font-data)', fontWeight: 700 }}>CD {cdLeft}</span>
                      </div>
                    )}
                    {/* Cabecera: nombre de la habilidad */}
                    <div style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 4,
                      borderBottom: `1px solid ${effective ? 'rgba(16,185,129,0.3)' : 'rgba(56,205,240,0.16)'}`, paddingBottom: 3,
                    }}>
                      <span style={{
                        fontSize: 9, color: 'var(--txt)', fontFamily: 'var(--font-data)', fontWeight: 700, letterSpacing: '0.02em',
                        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0,
                      }}>{hab.nombre}</span>
                      {effective && (
                        <span style={{ fontSize: 7, color: '#10b981', fontFamily: 'var(--font-data)', fontWeight: 700, flexShrink: 0 }}>EFF</span>
                      )}
                    </div>
                    {/* Cuerpo: imagen a la izquierda, daño y demás a la derecha */}
                    <div style={{ display: 'flex', flex: 1, minHeight: 0, alignItems: 'center', gap: 6 }}>
                      <div style={{
                        width: 34, height: 34, flexShrink: 0, borderRadius: 6, overflow: 'hidden',
                        background: 'rgba(0,0,0,0.28)', display: 'grid', placeItems: 'center',
                      }}>
                        {hab.icono_url
                          ? <img src={hab.icono_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          : <span style={{ fontSize: 16, lineHeight: 1 }}>{tipoIcon(hab.tipo)}</span>
                        }
                      </div>
                      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3, justifyContent: 'center' }}>
                        <span style={{ fontSize: 7, color: 'rgba(150,200,255,0.55)', fontFamily: 'var(--font-data)' }}>
                          {hab.tipo === 'melee' ? '⚔ Melee' : hab.tipo === 'nave' ? '🚀 Nave' : '◎ Distancia'}
                        </span>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, alignItems: 'center' }}>
                          {!isSelf && (
                            <span style={{ fontSize: 7, color: effective ? '#10b981' : '#ff7043', fontFamily: 'var(--font-data)', fontWeight: effective ? 700 : 400 }}>
                              DMG {effective ? `${Math.round(hab.damage * 1.5)}` : hab.damage}
                              {!!hab.damage_perforante && (
                                <span style={{ color: '#8aa0c0' }}>
                                  {' '}+{effective ? Math.round(hab.damage_perforante * 1.5) : hab.damage_perforante}P
                                </span>
                              )}
                            </span>
                          )}
                          {isSelf && (
                            <span style={{ fontSize: 7, color: '#10b981', fontFamily: 'var(--font-data)' }}>BUFF</span>
                          )}
                          <span style={{
                            fontSize: 7, fontFamily: 'var(--font-data)', padding: '1px 4px', borderRadius: 3,
                            background: noFuerza ? 'rgba(255,45,69,0.25)' : 'rgba(56,205,240,0.15)',
                            color: noFuerza ? '#ff6b6b' : '#38cdf0',
                          }}>
                            ⚡{hab.costo_fuerza}
                          </span>
                          {hab.forma > 0 && (
                            <span style={{ fontSize: 7, color: 'rgba(150,200,255,0.5)', fontFamily: 'var(--font-data)' }}>
                              F{formaLabel(hab.forma)}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>

          <div style={{ width: 1, background: 'rgba(255,255,255,0.08)', flexShrink: 0, alignSelf: 'stretch' }} />

          {/* Otras opciones */}
          <div style={{ flex: '1 1 38%', minWidth: 0, display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gridTemplateRows: 'repeat(2, 1fr)', gap: 5 }}>
            {/* Ataque básico (arma equipada o desarmado) — las naves no lo tienen */}
            {!me.es_nave && (
              <button onClick={() => doAction('unarmed')} disabled={busy} style={{
                minWidth: 0, borderRadius: 8, cursor: busy ? 'not-allowed' : 'pointer',
                background: 'rgba(255,140,0,0.07)', border: '1px solid rgba(255,140,0,0.22)',
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                gap: 2, padding: '3px 6px', opacity: busy ? 0.35 : 1, transition: 'all 0.14s',
              }}
                onMouseEnter={e => { if (!busy) { e.currentTarget.style.background = 'rgba(255,140,0,0.18)'; e.currentTarget.style.borderColor = 'rgba(255,140,0,0.5)'; } }}
                onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,140,0,0.07)'; e.currentTarget.style.borderColor = 'rgba(255,140,0,0.22)'; }}
              >
                {me.arma_equipada?.imagen ? (
                  <div style={{ width: 26, height: 26, borderRadius: 5, overflow: 'hidden', flexShrink: 0 }}>
                    <img src={mediaUrl(me.arma_equipada.imagen)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  </div>
                ) : me.arma_equipada?.es_sable ? (
                  <Icon name="sword" size={18} style={{ color: NX.SABERS[me.arma_equipada.color_hoja] ?? '#ff9955', filter: `drop-shadow(0 0 4px ${NX.SABERS[me.arma_equipada.color_hoja] ?? '#ff9955'})` }} />
                ) : (
                  <span style={{ fontSize: 16, lineHeight: 1 }}>✊</span>
                )}
                <span style={{
                  fontSize: 7, fontFamily: 'var(--font-data)', letterSpacing: '0.04em', whiteSpace: 'nowrap',
                  maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis',
                  color: (me.arma_equipada?.es_sable && NX.SABERS[me.arma_equipada.color_hoja]) || '#ff9955',
                }}>
                  {me.arma_equipada ? me.arma_equipada.nombre.toUpperCase() : 'DESARMADO'}
                </span>
                <span style={{ fontSize: 7, color: '#ff7043', fontFamily: 'var(--font-data)' }}>
                  DMG {me.arma_equipada?.dano ?? 3}
                  {!!me.arma_equipada?.dano_perforante && (
                    <span style={{ color: '#8aa0c0' }}> +{me.arma_equipada.dano_perforante}P</span>
                  )}
                </span>
              </button>
            )}

            {/* Estancia (las naves no tienen estancias — solo combate normal) */}
            {!me.es_nave && (
              <button onClick={() => !busy && combat.is_my_turn && setStancePicker(true)} disabled={busy} style={{
                minWidth: 0, borderRadius: 8, cursor: busy ? 'not-allowed' : 'pointer',
                background: 'rgba(139,92,246,0.07)', border: '1px solid rgba(139,92,246,0.22)',
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                gap: 2, padding: '3px 6px', opacity: busy ? 0.35 : 1, transition: 'all 0.14s',
              }}
                onMouseEnter={e => { if (!busy) { e.currentTarget.style.background = 'rgba(139,92,246,0.18)'; e.currentTarget.style.borderColor = 'rgba(139,92,246,0.5)'; } }}
                onMouseLeave={e => { e.currentTarget.style.background = 'rgba(139,92,246,0.07)'; e.currentTarget.style.borderColor = 'rgba(139,92,246,0.22)'; }}
              >
                {NX.CLASSES[myCurrentForma - 1]?.img ? (
                  <div style={{ width: 22, height: 22, borderRadius: 5, overflow: 'hidden', flexShrink: 0 }}>
                    <img src={NX.CLASSES[myCurrentForma - 1].img} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  </div>
                ) : (
                  <span style={{ fontSize: 14, lineHeight: 1 }}>🔄</span>
                )}
                <span style={{ fontSize: 7, color: '#a78bfa', fontFamily: 'var(--font-data)', whiteSpace: 'nowrap', maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis' }}>{FORMA_LABELS_SHORT[myCurrentForma - 1] ?? `F${myCurrentForma}`}</span>
                <span style={{ fontSize: 7, color: '#a78bfa', fontFamily: 'var(--font-data)' }}>ESTANCIA</span>
              </button>
            )}

            {/* Evadir (solo naval): +1 Maniobra y +1 Iniciativa por 3 rondas — sirve cuando la nave no tiene habilidades */}
            {me.es_nave && (
              <button onClick={() => doAction('evadir')} disabled={busy} style={{
                minWidth: 0, borderRadius: 8, cursor: busy ? 'not-allowed' : 'pointer',
                background: 'rgba(16,185,129,0.07)', border: '1px solid rgba(16,185,129,0.22)',
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                gap: 2, padding: '3px 6px', opacity: busy ? 0.35 : 1, transition: 'all 0.14s',
              }}
                onMouseEnter={e => { if (!busy) { e.currentTarget.style.background = 'rgba(16,185,129,0.18)'; e.currentTarget.style.borderColor = 'rgba(16,185,129,0.5)'; } }}
                onMouseLeave={e => { e.currentTarget.style.background = 'rgba(16,185,129,0.07)'; e.currentTarget.style.borderColor = 'rgba(16,185,129,0.22)'; }}
              >
                <span style={{ fontSize: 16, lineHeight: 1 }}>🌀</span>
                <span style={{ fontSize: 7, color: '#10b981', fontFamily: 'var(--font-data)' }}>EVADIR</span>
              </button>
            )}

            {/* Huir */}
            <button onClick={() => doAction('flee')} disabled={busy} style={{
              minWidth: 0, borderRadius: 8, cursor: busy ? 'not-allowed' : 'pointer',
              background: 'rgba(255,45,69,0.07)', border: '1px solid rgba(255,45,69,0.22)',
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              gap: 2, padding: '3px 6px', opacity: busy ? 0.35 : 1, transition: 'all 0.14s',
            }}
              onMouseEnter={e => { if (!busy) { e.currentTarget.style.background = 'rgba(255,45,69,0.18)'; e.currentTarget.style.borderColor = 'rgba(255,45,69,0.5)'; } }}
              onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,45,69,0.07)'; e.currentTarget.style.borderColor = 'rgba(255,45,69,0.22)'; }}
            >
              <span style={{ fontSize: 18, lineHeight: 1 }}>🏃</span>
              <span style={{ fontSize: 8, color: '#ff6b6b', fontFamily: 'var(--font-data)' }}>HUIR</span>
            </button>

            {/* Emote — abre el anillo de emoticones anclado al propio avatar */}
            <button onClick={() => setEmojiPicker(v => !v)} style={{
              minWidth: 0, borderRadius: 8, cursor: 'pointer',
              background: 'rgba(230,179,37,0.07)', border: '1px solid rgba(230,179,37,0.22)',
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              gap: 2, padding: '3px 6px', transition: 'all 0.14s',
            }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(230,179,37,0.18)'; e.currentTarget.style.borderColor = 'rgba(230,179,37,0.5)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'rgba(230,179,37,0.07)'; e.currentTarget.style.borderColor = 'rgba(230,179,37,0.22)'; }}
            >
              <span style={{ fontSize: 18, lineHeight: 1 }}>😊</span>
              <span style={{ fontSize: 8, color: '#E6B325', fontFamily: 'var(--font-data)' }}>EMOTE</span>
            </button>
          </div>
        </div>
      </>
    )
  );

  const actionBar = (
    <div style={{
      position: isMobile ? 'relative' : 'absolute',
      ...(isMobile ? {} : { bottom: 0, left: 0, right: 0 }),
      zIndex: 10, flexShrink: 0,
      background: 'rgba(3,7,16,0.96)', backdropFilter: 'blur(16px)',
      borderTop: '1px solid rgba(56,205,240,0.13)',
      borderRadius: isMobile ? 10 : 0,
      padding: isMobile ? '8px 10px 12px' : '6px 16px 8px', display: 'flex', flexDirection: 'column', gap: 5,
      minHeight: isMobile ? 195 : 175,
    }}>
      {actionBarInner}
    </div>
  );

  const screen = (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9500,
      background: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(6px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 12,
    }}>
      <div style={{
        position: 'relative',
        width: '100%', maxWidth: 900,
        height: '100%', maxHeight: 720,
        borderRadius: 18, overflow: 'hidden',
        boxShadow: '0 0 80px rgba(0,0,0,0.9), 0 0 0 1px rgba(56,205,240,0.18)',
      }}>
        {bgImg
          ? <img src={bgImg} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center' }} />
          : <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at 50% 30%, #0c1e42, #020810)' }} />
        }
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(2,6,16,0.72)' }} />

        <div ref={stageRef} style={{ position: 'relative', width: '100%', height: '100%' }}>

        {diceOverlay}

        {isMobile ? (
          /* Layout mobile: oponente arriba (full width) → registro/resumen al medio → yo abajo (full width) → barra de acciones */
          <div style={{ position: 'absolute', inset: 8, zIndex: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div ref={oppHudRef}>
              <HUD
                hp={oppHp} maxHp={opp.vida_max} escudo={oppEscudo} maxEscudo={opp.escudo_max}
                nombre={opp.name} handle={opp.handle} photoUrl={oppPhotoUrl} ini={oppIni}
                borderColor="rgba(255,45,69,0.40)" badges={oppBadges} align="left"
                effects={oppEffects}
                forma={oppFormaProp}
                effectsPosition="below"
              />
            </div>

            <div style={{
              flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column',
              background: 'rgba(4,9,20,0.55)', backdropFilter: 'blur(10px)',
              borderRadius: 10, border: '1px solid rgba(56,205,240,0.14)', overflow: 'hidden',
            }}>
              {logHeader}
              {logBody}
            </div>

            <div ref={myHudRef}>
              <HUD
                hp={myHp} maxHp={me.vida_max} escudo={myEscudo} maxEscudo={me.escudo_max}
                nombre={me.name} handle={me.handle} photoUrl={myPhotoUrl} ini={myIni}
                borderColor="rgba(56,205,240,0.30)" badges={myBadges} align="right"
                effects={myEffects}
                forma={myFormaProp}
                effectsPosition="above"
                avatarRef={myAvatarRef}
              />
            </div>

            {actionBar}
          </div>
        ) : (
          <>
            {/* Oponente HUD — arriba derecha */}
            <div ref={oppHudRef} style={{ position: 'absolute', top: 10, right: 10, zIndex: 10, width: 'clamp(380px, 48%, 480px)' }}>
              <HUD
                hp={oppHp} maxHp={opp.vida_max} escudo={oppEscudo} maxEscudo={opp.escudo_max}
                nombre={opp.name} handle={opp.handle} photoUrl={oppPhotoUrl} ini={oppIni}
                borderColor="rgba(255,45,69,0.40)" badges={oppBadges} align="left"
                effects={oppEffects}
                forma={oppFormaProp}
              />
            </div>

            {/* Mi HUD — abajo izquierda */}
            <div ref={myHudRef} style={{ position: 'absolute', bottom: 195, left: 14, zIndex: 10, width: 'clamp(380px, 48%, 480px)' }}>
              <HUD
                hp={myHp} maxHp={me.vida_max} escudo={myEscudo} maxEscudo={me.escudo_max}
                nombre={me.name} handle={me.handle} photoUrl={myPhotoUrl} ini={myIni}
                borderColor="rgba(56,205,240,0.30)" badges={myBadges} align="right"
                effects={myEffects}
                forma={myFormaProp}
                avatarRef={myAvatarRef}
              />
            </div>
          </>
        )}

        {emojiPicker && (
          <EmojiRing
            anchorRef={myAvatarRef} stageRef={stageRef}
            onSelect={sendEmoji}
            onClose={() => setEmojiPicker(false)}
          />
        )}
        {emojiBurst && (
          <EmojiBurst key={emojiBurst.id} emoji={emojiBurst.emoji} onDone={() => setEmojiBurst(null)} />
        )}

        {/* Golpe de energía (melee) o mira (a distancia) sobre el stage */}
        {strike && (strike.type === 'melee' ? (
          <EnergyStrikeEffect key={strike.key}
            from={strike.from} to={strike.to} color={strike.color} outcome={strike.outcome}
            stageRef={stageRef} attackerRef={strike.attackerRef} targetRef={strike.targetRef}
            onDone={() => {
              strike.onResolve?.();
              setFloatTexts((prev) => [...prev, { id: strike.key, x: strike.to.x, y: strike.to.y, ...strike.result }]);
              setStrike(null);
            }}
          />
        ) : (
          <RangedStrikeEffect key={strike.key}
            from={strike.from} to={strike.to} color={strike.color} outcome={strike.outcome}
            stageRef={stageRef} attackerRef={strike.attackerRef} targetRef={strike.targetRef}
            onDone={() => {
              strike.onResolve?.();
              setFloatTexts((prev) => [...prev, { id: strike.key, x: strike.to.x, y: strike.to.y, ...strike.result }]);
              setStrike(null);
            }}
          />
        ))}

        {/* Animación de huida — separada de la de ataque: dash+desvanecimiento si escapa, rebote+sacudida si falla */}
        {fleeFx && (
          <FleeEffect key={fleeFx.key}
            outcome={fleeFx.outcome} dir={fleeFx.dir}
            stageRef={stageRef} actorRef={fleeFx.actorRef}
            onDone={() => {
              fleeFx.onResolve?.();
              setFleeFx(null);
            }}
          />
        )}

        {/* Resultado del ataque — texto flotante sobre el personaje afectado; cada uno vive su propio segundo */}
        {floatTexts.map((ft) => (
          <FloatingCombatText key={ft.id}
            x={ft.x} y={ft.y} text={ft.text} variant={ft.variant}
            onDone={() => setFloatTexts((prev) => prev.filter((f) => f.id !== ft.id))}
          />
        ))}

        {/* Log de combate (desktop; en mobile va integrado en la columna central) */}
        {!isMobile && (
          <div style={{
            position: 'absolute', left: 14, top: 14, zIndex: 10,
            width: logCollapsed ? 36 : 'clamp(160px, 26%, 280px)',
            maxHeight: 'calc(100% - 365px)',
            background: 'rgba(4,9,20,0.88)', backdropFilter: 'blur(12px)',
            borderRadius: 10, border: '1px solid rgba(56,205,240,0.14)',
            display: 'flex', flexDirection: 'column',
            transition: 'width 0.20s ease', overflow: 'hidden',
          }}>
            {logHeader}
            {logBody}
          </div>
        )}

        {/* Barra de acciones (desktop; en mobile va integrada en la columna central) */}
        {!isMobile && actionBar}

        {/* Stance Picker Modal */}
        {stancePicker && (
          <div style={{
            position: 'absolute', inset: 0, zIndex: 20,
            background: 'rgba(2,6,16,0.88)', backdropFilter: 'blur(8px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }} onClick={() => setStancePicker(false)}>
            <div onClick={e => e.stopPropagation()} style={{
              background: 'rgba(6,12,26,0.97)', border: '1px solid rgba(139,92,246,0.35)',
              borderRadius: 16, padding: 24, width: 360, maxWidth: '90%',
            }}>
              <div style={{ fontSize: 11, color: '#a78bfa', fontFamily: 'var(--font-data)', letterSpacing: '0.14em', marginBottom: 16, textAlign: 'center' }}>
                🔄 CAMBIAR ESTANCIA — Acabará tu turno
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(3, 1fr)' : 'repeat(4, 1fr)', gap: 8 }}>
                {FORMA_LABELS_SHORT.map((label, i) => {
                  const f = i + 1;
                  const active = f === myCurrentForma;
                  return (
                    <button key={f} onClick={() => doStance(f)} style={{
                      padding: '10px 6px', borderRadius: 8, cursor: 'pointer', textAlign: 'center',
                      background: active ? 'rgba(139,92,246,0.25)' : 'rgba(139,92,246,0.06)',
                      border: `1px solid ${active ? '#a78bfa' : 'rgba(139,92,246,0.3)'}`,
                      opacity: active ? 1 : 0.85,
                    }}>
                      <div style={{ fontSize: 13, fontFamily: 'var(--font-data)', color: active ? '#a78bfa' : '#fff', fontWeight: 700 }}>F{f}</div>
                      <div style={{ fontSize: 8, color: 'rgba(200,180,255,0.6)', marginTop: 3, lineHeight: 1.3 }}>{label}</div>
                    </button>
                  );
                })}
              </div>
              <button onClick={() => setStancePicker(false)} style={{
                marginTop: 16, width: '100%', padding: '8px', borderRadius: 8, cursor: 'pointer',
                background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)',
                color: 'rgba(200,200,255,0.5)', fontSize: 10, fontFamily: 'var(--font-data)',
              }}>Cancelar</button>
            </div>
          </div>
        )}
        </div>
      </div>
    </div>
  );

  const container = document.getElementById('nx-content') ?? document.body;

  /* Al terminar el combate se cierra la ventana y solo queda el resumen; al cerrarlo se vuelve al mapa */
  if (showCombatCard) {
    return createPortal(
      <CombatCardModal combat={combat} onClose={() => onClose(overPayload)} />,
      container
    );
  }

  return createPortal(screen, container);
}
