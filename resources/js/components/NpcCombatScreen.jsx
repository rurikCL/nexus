import { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from './ui.jsx';
import { NX } from '../data/seed.js';
import { getRelativeCenter } from './combatFx.jsx';
import EnergyStrikeEffect from './EnergyStrikeEffect.jsx';
import RangedStrikeEffect from './RangedStrikeEffect.jsx';
import FloatingCombatText from './FloatingCombatText.jsx';
import { useDiceRoller, renderDiceText } from './DiceRoller.jsx';
import { SkillTooltip } from './SkillTooltip.jsx';
import { NpcCombatCardModal } from './CombatCard.jsx';

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/* Tabla de efectividad entre formas: forma atacante → formas que supera (igual que en PvP) */
const FORMA_BEATS = {
  1: [6],     // Shii-Cho    → Niman
  6: [3],     // Niman       → Soresu
  3: [4],     // Soresu      → Ataru
  4: [1],     // Ataru       → Shii-Cho
  2: [1, 5],  // Makashi     → Shii-Cho, Shien
  5: [4],     // Shien/DjSo  → Ataru
  7: [5, 6],  // Juyo/Vaapad → Shien, Niman
};
/* Forma 0 = universal: nunca aplica bono ni penalización */
const formaEsEfectiva = (atkForma, defForma) => {
  if (!atkForma || !defForma) return false;
  return (FORMA_BEATS[atkForma] ?? []).includes(defForma);
};

function useIsMobile() {
  const [m, setM] = useState(() => window.innerWidth < 640);
  useEffect(() => {
    const fn = () => setM(window.innerWidth < 640);
    window.addEventListener('resize', fn);
    return () => window.removeEventListener('resize', fn);
  }, []);
  return m;
}

const mediaUrl = (path) => {
  if (!path) return null;
  if (/^(https?:)?\/\//.test(path) || path.startsWith('data:') || path.startsWith('blob:')) return path;
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  if (cleanPath.startsWith('/storage/')) return cleanPath;
  if (cleanPath.startsWith('/admin/')) return `/storage${cleanPath}`;
  if (cleanPath.startsWith('/public/')) return cleanPath.replace('/public/', '/storage/');
  return `/storage${cleanPath}`;
};

const NPC_COMBAT_LS = 'nx-npc-combat';
const BADGE_ICON = { ATQ: 'sword', DEF: 'shield', PNT: 'target', MOV: 'arrow' };
const STAT_ABBR = { ataque: 'ATQ', defensa: 'DEF', punteria: 'PNT', movimiento: 'MOV', iniciativa: 'INI' };
const combatCardBtnStyle = {
  padding: '8px 20px', borderRadius: 7, cursor: 'pointer',
  background: 'rgba(56,205,240,0.10)', border: '1px solid rgba(56,205,240,0.4)',
  color: '#38cdf0', fontFamily: 'var(--font-data)', fontSize: 10, letterSpacing: '0.14em',
};

/* Fondo espacial autocontenido (estrellas + planetas) para combates navales */
function pseudoRandom(seed) {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

function useSpaceStarsCSS() {
  return useMemo(() => {
    const dot = (x, y, r, a) =>
      `radial-gradient(circle at ${x}% ${y}%, rgba(219,230,245,${a}) 0px, rgba(219,230,245,${a}) ${r.toFixed(2)}px, transparent ${(r + 0.5).toFixed(2)}px)`;
    return Array.from({ length: 160 }, (_, i) => {
      const x = (pseudoRandom(i * 12.9898 + 1) * 100).toFixed(2);
      const y = (pseudoRandom(i * 78.233 + 3) * 100).toFixed(2);
      const r = pseudoRandom(i * 37.719 + 5) * 0.9 + 0.3;
      const a = (pseudoRandom(i * 91.345 + 7) * 0.5 + 0.35).toFixed(2);
      return dot(x, y, r, a);
    }).join(', ');
  }, []);
}

function SpaceBackground() {
  const starsCSS = useSpaceStarsCSS();
  return (
    <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at 50% 25%, #0c1e42, #020810 75%)' }}>
      <div style={{ position: 'absolute', inset: 0, backgroundImage: starsCSS }} />
      {/* planetas decorativos */}
      <div style={{
        position: 'absolute', top: '6%', right: '8%', width: 150, height: 150, borderRadius: '50%',
        background: 'radial-gradient(circle at 35% 30%, #7bc8d4dd, #386185aa 55%, #0c1e4233 85%, transparent)',
        boxShadow: '0 0 70px 6px rgba(56,205,240,0.10)',
      }} />
      <div style={{
        position: 'absolute', bottom: '10%', left: '5%', width: 78, height: 78, borderRadius: '50%',
        background: 'radial-gradient(circle at 35% 30%, #d4a76add, #8a6a4aaa 55%, #2a1f1533 85%, transparent)',
        boxShadow: '0 0 40px 4px rgba(212,167,106,0.10)',
      }} />
      <div style={{
        position: 'absolute', top: '38%', left: '14%', width: 26, height: 26, borderRadius: '50%',
        background: 'radial-gradient(circle at 35% 30%, #a8b8d4dd, #5a6a8aaa 60%, transparent)',
      }} />
    </div>
  );
}

export default function NpcCombatScreen({ npc, player, lugarImagen, planetaNombre, lugarNombre, onVictory, onDefeat, onFlee, initialState, naveMode = false }) {
  const d20 = () => Math.floor(Math.random() * 20) + 1;

  const maxPlayer = { vida: player.vida, escudo: player.escudo };
  const maxNpc    = { vida: Math.max(npc.vida, 1), escudo: npc.escudo ?? 0 };

  const npcAtk = Math.max(npc.ataque,     1);
  const npcDef = Math.max(npc.defensa,    1);
  const npcMov = Math.max(npc.movimiento, 1);
  const npcIni = Math.max(npc.iniciativa, 1);
  const npcPnt = npc.punteria ?? 0;

  const maxFuerza      = player.maxFuerza      ?? 10;
  const fuerzaPorTurno = player.fuerzaPorTurno ?? 2;

  const [playerHp,     setPlayerHp]     = useState(initialState?.playerHp ?? { vida: maxPlayer.vida, escudo: maxPlayer.escudo });
  const [npcHp,        setNpcHp]        = useState(initialState?.npcHp    ?? { vida: maxNpc.vida,    escudo: maxNpc.escudo    });
  const [phase,        setPhase]        = useState(initialState?.phase     ?? 'initiative');
  const [currTurn,     setCurrTurn]     = useState(initialState?.currTurn  ?? null);
  const [log,          setLog]          = useState(initialState?.log       ?? []);
  const [ronda,        setRonda]        = useState(initialState?.ronda       ?? 1);
  const [rondaTurno,   setRondaTurno]   = useState(initialState?.rondaTurno  ?? 0);
  const [npcBusy,      setNpcBusy]      = useState(false);
  const [logCollapsed, setLogCollapsed] = useState(false);
  const [bgImg,        setBgImg]        = useState(lugarImagen ?? null);
  const logRef = useRef(null);
  const stageRef = useRef(null);
  const playerHudRef = useRef(null);
  const npcHudRef = useRef(null);
  const [strike, setStrike]         = useState(null);
  const [floatTexts, setFloatTexts] = useState([]);
  const [showCombatCard, setShowCombatCard] = useState(false);

  /* Texto flotante mostrado sobre el objetivo al terminar el golpe de energía */
  const resultTextFor = (hit, ranged, crit, dmg) => {
    if (!hit) return { variant: ranged ? 'dodge' : 'block', text: ranged ? 'ESQUIVADO' : 'BLOQUEADO' };
    if (crit) return { variant: 'crit', text: `¡CRÍTICO! −${dmg}` };
    return { variant: 'hit', text: `HIT: ${dmg}` };
  };

  /* Texto flotante independiente de un golpe (curaciones): aparece sobre `ref` sin VFX de golpe */
  const showFloatText = (ref, result) => {
    if (!stageRef.current || !ref.current) return;
    const pos = getRelativeCenter(ref.current, stageRef.current);
    setFloatTexts((prev) => [...prev, { id: `${Date.now()}-${Math.random()}`, x: pos.x, y: pos.y, ...result }]);
  };

  /* Dispara el VFX de golpe (melee/a distancia) entre jugador y NPC */
  const triggerStrike = ({ playerIsAttacker, ranged, hit, crit = false, dmg = 0 }) => {
    if (!stageRef.current) return;
    const attackerRef = playerIsAttacker ? playerHudRef : npcHudRef;
    const targetRef    = playerIsAttacker ? npcHudRef : playerHudRef;
    const arma = playerIsAttacker ? player.arma_equipada : null;
    const color = playerIsAttacker
      ? ((arma?.es_sable && NX.SABERS[arma.color_hoja]) || '#38cdf0')
      : '#ff2d45';
    setStrike({
      key: `${Date.now()}-${Math.random()}`,
      type: ranged ? 'ranged' : 'melee',
      outcome: hit ? 'hit' : (ranged ? 'dodge' : 'block'),
      color, attackerRef, targetRef,
      from: getRelativeCenter(attackerRef.current, stageRef.current),
      to: getRelativeCenter(targetRef.current, stageRef.current),
      result: resultTextFor(hit, ranged, crit, dmg),
    });
  };

  /* Estado de habilidades del jugador */
  const [playerFuerza, setPlayerFuerza] = useState(initialState?.playerFuerza ?? 0);
  const [cooldowns,    setCooldowns]    = useState(initialState?.cooldowns     ?? {});
  const [playerBuffs,  setPlayerBuffs]  = useState(initialState?.playerBuffs  ?? []);
  const [npcDebuffs,   setNpcDebuffs]   = useState(initialState?.npcDebuffs   ?? []);

  /* Forma actual y cambio de estancia */
  const habPool    = player.all_habilidades_data ?? {};
  const porForma   = player.habilidades_por_forma ?? {};
  const [currentForma,  setCurrentForma]  = useState(initialState?.currentForma ?? player.current_forma ?? 1);
  const [stancePicker,  setStancePicker]  = useState(false);
  const isMobile = useIsMobile();
  const { diceOverlay, rollDice, rolling } = useDiceRoller();
  const [hoveredHabId, setHoveredHabId] = useState(null);

  const FORMA_LABELS_SHORT = ['Shii-Cho', 'Makashi', 'Soresu', 'Ataru', 'Shien/DjSo', 'Niman', 'Juyo/Vaapad'];

  /* Habilidades de la forma actual (del pool, sin fetch adicional) */
  const habilidades = useMemo(() => {
    const slotIds = Array.isArray(porForma[String(currentForma)]) ? porForma[String(currentForma)] : [];
    return slotIds.filter(Boolean).map(id => habPool[String(id)]).filter(Boolean);
  }, [currentForma]);

  /* Agrupa el log plano en tarjetas de ronda → tarjetas de turno (por actor consecutivo) */
  const logRounds = useMemo(() => {
    const rounds = [];
    let curRound = null;
    let curTurn = null;
    log.forEach(entry => {
      const r = entry.ronda ?? 1;
      if (!curRound || curRound.ronda !== r) {
        curRound = { ronda: r, turns: [] };
        rounds.push(curRound);
        curTurn = null;
      }
      const actor = entry.actor ?? 'system';
      if (!curTurn || curTurn.actor !== actor) {
        curTurn = { actor, entries: [] };
        curRound.turns.push(curTurn);
      }
      curTurn.entries.push(entry);
    });
    return rounds;
  }, [log]);

  /* Stats efectivos considerando buffs/debuffs */
  const countBuff    = (stat) => playerBuffs.filter(b => b.stat === stat).length;
  const countNpcDeb  = (stat) => npcDebuffs.filter(d => d.stat === stat).length;

  const effPlayerAtk = player.ataque     + countBuff('ataque');
  const effPlayerDef = player.defensa    + countBuff('defensa');
  const effPlayerPnt = player.punteria   + countBuff('punteria');
  const effPlayerMov = player.movimiento + countBuff('movimiento');

  const effNpcAtk = Math.max(1, npcAtk - countNpcDeb('ataque'));
  const effNpcDef = Math.max(1, npcDef - countNpcDeb('defensa'));
  const effNpcMov = Math.max(1, npcMov - countNpcDeb('movimiento'));
  const effNpcPnt = Math.max(0, npcPnt - countNpcDeb('punteria'));

  const effPlayerIni = player.iniciativa + countBuff('iniciativa');
  const effNpcIni     = Math.max(1, npcIni - countNpcDeb('iniciativa'));

  /* Fondo desde el lugar del NPC (no aplica a combates navales: usan fondo espacial fijo) */
  useEffect(() => {
    if (naveMode || bgImg || !npc.LugarID) return;
    const token = localStorage.getItem('nx-token');
    fetch(`/api/map/lugares/${npc.LugarID}`, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    })
      .then(r => r.json())
      .then(d => { if (d.lugar?.imagen) setBgImg(mediaUrl(d.lugar.imagen)); })
      .catch(() => {});
  }, []);

  /* Mientras haya escudo (>0), absorbe TODO el golpe (dmg + dmgEscudo si corresponde)
     sin dejar pasar nada a la vida. Con el escudo ya en 0, solo dmg pasa directo a la vida. */
  const applyDmg = (dmg, hp, dmgEscudo = 0) => {
    if (hp.escudo > 0) {
      const total = dmg + Math.max(0, dmgEscudo);
      return { escudo: Math.max(0, hp.escudo - total), vida: hp.vida };
    }
    return { escudo: 0, vida: Math.max(0, hp.vida - dmg) };
  };

  /* Iniciativa — solo si es combate nuevo (no restaurado) */
  useEffect(() => {
    if (initialState) return;
    const pR = d20(); const nR = d20();
    const pT = pR + effPlayerIni; const nT = nR + effNpcIni;
    const first = pT >= nT ? 'player' : 'npc';
    (async () => {
      await sleep(300);
      await rollDice([
        { key: 'p-ini', color: '#38cdf0', label: 'TÚ', value: pR },
        { key: 'n-ini', color: '#ff6b6b', label: naveMode ? 'NAVE' : npc.nombre.slice(0, 8).toUpperCase(), value: nR },
      ]);
      setLog([
        { text: '⚔ ¡COMBATE INICIADO!', type: 'system', id: 0, ronda: 1, actor: 'system' },
        { text: `Ronda 1 — Iniciativa: Tú 1d20(${pR})+${effPlayerIni}=${pT} | ${npc.nombre} 1d20(${nR})+${effNpcIni}=${nT}`, type: 'info', id: 1, ronda: 1, actor: 'system' },
        { text: first === 'player' ? '¡Atacas primero!' : `¡${npc.nombre} actúa primero!`, type: first === 'player' ? 'success' : 'danger', id: 2, ronda: 1, actor: 'system' },
      ]);
      setPhase('battle');
      setCurrTurn(first);
      /* Pre-recuperar fuerza si el jugador actúa primero */
      if (first === 'player') setPlayerFuerza(fuerzaPorTurno);
    })();
  }, []);

  /* Termina el turno de quien actuó — decide si sigue la ronda o se tira nueva iniciativa */
  const endTurnAfter = async (actor) => {
    if (rondaTurno === 0) {
      /* Primera acción de la ronda: actúa el otro, sin nueva tirada */
      const next = actor === 'player' ? 'npc' : 'player';
      setRondaTurno(1);
      setCurrTurn(next);
      if (next === 'player') setPlayerFuerza(p => Math.min(maxFuerza, p + fuerzaPorTurno));
    } else {
      /* Ambos actuaron: termina la ronda — tick de buffs/debuffs (duran N rondas) y nueva iniciativa */
      setPlayerBuffs(prev => prev.map(b => ({ ...b, turns: b.turns - 1 })).filter(b => b.turns > 0));
      setNpcDebuffs(prev => prev.map(d => ({ ...d, turns: d.turns - 1 })).filter(d => d.turns > 0));

      const pR = d20(); const nR = d20();
      const pT = pR + effPlayerIni; const nT = nR + effNpcIni;
      const first = pT >= nT ? 'player' : 'npc';
      await rollDice([
        { key: 'p-ini', color: '#38cdf0', label: 'TÚ', value: pR },
        { key: 'n-ini', color: '#ff6b6b', label: naveMode ? 'NAVE' : npc.nombre.slice(0, 8).toUpperCase(), value: nR },
      ]);
      setLog(prev => [...prev,
        { text: `Ronda ${ronda + 1} — Iniciativa: Tú 1d20(${pR})+${effPlayerIni}=${pT} | ${npc.nombre} 1d20(${nR})+${effNpcIni}=${nT}`, type: 'info', id: prev.length, ronda: ronda + 1, actor: 'system' },
        { text: first === 'player' ? '¡Actúas primero!' : `¡${npc.nombre} actúa primero!`, type: first === 'player' ? 'success' : 'danger', id: prev.length + 1, ronda: ronda + 1, actor: 'system' },
      ]);
      setRonda(r => r + 1);
      setRondaTurno(0);
      setCurrTurn(first);
      if (first === 'player') setPlayerFuerza(p => Math.min(maxFuerza, p + fuerzaPorTurno));
    }
  };

  /* Persistir estado en localStorage cada vez que cambia algo de batalla */
  useEffect(() => {
    if (phase === 'initiative' || phase === 'victory' || phase === 'defeat' || phase === 'fled') return;
    localStorage.setItem(NPC_COMBAT_LS, JSON.stringify({
      npc, player, lugarImagen,
      state: { playerHp, npcHp, phase, currTurn, log, ronda, rondaTurno, playerFuerza, cooldowns, playerBuffs, npcDebuffs, currentForma },
    }));
  }, [playerHp, npcHp, phase, currTurn, log, ronda, rondaTurno, playerFuerza, cooldowns, playerBuffs, npcDebuffs, currentForma]);

  /* Turno del NPC */
  useEffect(() => {
    if (currTurn !== 'npc' || phase !== 'battle') return;
    setNpcBusy(true);
    let cancelled = false;
    const npcLabel = naveMode ? 'NAVE' : npc.nombre.slice(0, 8).toUpperCase();
    (async () => {
      await sleep(700);
      if (cancelled) return;

      /* Leer stats efectivos ahora (closure over current state at render time) */
      const useRanged = effNpcPnt > 0 && Math.random() > 0.5;
      const [aR, dR] = [d20(), d20()];
      const [aT, dT] = useRanged
        ? [aR + effNpcPnt, dR + effPlayerMov]
        : [aR + effNpcAtk, dR + effPlayerDef];

      await rollDice([
        { key: 'npc', color: '#ff6b6b', label: npcLabel, value: aR },
        { key: 'ply', color: '#38cdf0', label: 'TÚ', value: dR },
      ]);
      if (cancelled) return;

      triggerStrike({ playerIsAttacker: false, ranged: useRanged, hit: aT > dT, dmg: useRanged ? effNpcPnt : effNpcAtk });

      let entries;
      let newHp;
      if (useRanged) {
        entries = [
          { text: `${npc.nombre} dispara: 1d20(${aR})+${effNpcPnt}=${aT}`, type: 'info', diceColors: ['#ff6b6b'] },
          { text: `Esquivas: 1d20(${dR})+${effPlayerMov}=${dT}`, type: 'info', diceColors: ['#38cdf0'] },
        ];
        newHp = aT > dT ? applyDmg(effNpcPnt, playerHp) : { ...playerHp };
        entries.push(aT > dT ? { text: `¡Te impactan! −${effNpcPnt} daño`, type: 'danger' } : { text: '¡Esquivas!', type: 'success' });
      } else {
        entries = [
          { text: `${npc.nombre} ataca: 1d20(${aR})+${effNpcAtk}=${aT}`, type: 'info', diceColors: ['#ff6b6b'] },
          { text: `Defiendes: 1d20(${dR})+${effPlayerDef}=${dT}`, type: 'info', diceColors: ['#38cdf0'] },
        ];
        newHp = aT > dT ? applyDmg(effNpcAtk, playerHp) : { ...playerHp };
        entries.push(aT > dT ? { text: `¡Golpe! −${effNpcAtk} daño`, type: 'danger' } : { text: 'Bloqueas el ataque', type: 'success' });
      }
      entries = entries.map(e => ({ ...e, ronda, actor: 'npc' }));

      setLog(prev => [...prev, ...entries.map((e, i) => ({ ...e, id: prev.length + i }))]);
      setPlayerHp(newHp);

      /* Al fin del turno NPC: decrementar cooldowns (los buffs/debuffs se tickean por ronda en endTurnAfter) */
      setCooldowns(prev => Object.fromEntries(
        Object.entries(prev).filter(([, v]) => v > 1).map(([k, v]) => [k, v - 1])
      ));

      setNpcBusy(false);
      if (newHp.vida <= 0) {
        setLog(prev => [...prev, { text: '☠ Has sido derrotado.', type: 'danger', id: prev.length, ronda, actor: 'system' }]);
        setPhase('defeat');
      } else {
        endTurnAfter('npc');
      }
    })();
    return () => { cancelled = true; };
  }, [currTurn, phase, ronda]);

  useEffect(() => { if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight; }, [log]);

  /* Ejecutar habilidad del jugador */
  const doPlayerSkill = async (hab) => {
    if (phase !== 'battle' || currTurn !== 'player' || npcBusy || rolling) return;
    const habId = String(hab.id);
    if ((cooldowns[habId] ?? 0) > 0) return;
    if (playerFuerza < hab.costo_fuerza) return;

    const habBuff   = Array.isArray(hab.buff)   ? hab.buff   : [];
    const habDebuff = Array.isArray(hab.debuff) ? hab.debuff : [];
    const habRondas = hab.duracion ?? 2;

    /* Gastar fuerza */
    setPlayerFuerza(prev => prev - hab.costo_fuerza);

    /* Registrar cooldown */
    if (hab.cooldown > 0) {
      setCooldowns(prev => ({ ...prev, [habId]: hab.cooldown }));
    }

    /* Aplicar buff al jugador */
    if (habBuff.length > 0) {
      setPlayerBuffs(prev => [...prev, ...habBuff.map(stat => ({ stat, turns: habRondas }))]);
    }

    const entries = [];

    /* ─── Habilidad de auto-buff / auto-curación (objetivo: self) ── */
    if (hab.objetivo === 'self') {
      const buffDesc = habBuff.map(s => `+1 ${s}`).join(', ');
      entries.push({ text: `${player.nombre} usa "${hab.nombre}"${buffDesc ? ` (${buffDesc})` : ''}`, type: 'info' });

      const selfDmg = hab.damage ?? 0;
      const selfDmgEscudo = hab.damage_escudo ?? 0;
      let healedHp = { ...playerHp };
      if (selfDmg < 0) {
        const heal = -selfDmg;
        healedHp.vida = Math.min(maxPlayer.vida, healedHp.vida + heal);
        entries.push({ text: `¡Curación! +${heal} vida`, type: 'success' });
        showFloatText(playerHudRef, { variant: 'heal', text: `Curación: ${heal}` });
      }
      if (selfDmgEscudo < 0) {
        const healEsc = -selfDmgEscudo;
        healedHp.escudo = Math.min(maxPlayer.escudo, healedHp.escudo + healEsc);
        entries.push({ text: `¡Curación! +${healEsc} escudo`, type: 'success' });
        showFloatText(playerHudRef, { variant: 'heal', text: `Curación: ${healEsc}` });
      }
      if (selfDmg < 0 || selfDmgEscudo < 0) setPlayerHp(healedHp);

      setLog(prev => [...prev, ...entries.map((e, i) => ({ ...e, id: prev.length + i, ronda, actor: 'player' }))]);
      endTurnAfter('player');
      return;
    }

    /* ─── Habilidad de curación a distancia (objetivo: target, damage < 0) ─ */
    const targetDmg = hab.damage ?? 0;
    if (hab.objetivo === 'target' && targetDmg < 0) {
      const heal = -targetDmg;
      const newNpcHp = { ...npcHp, vida: Math.min(maxNpc.vida, npcHp.vida + heal) };
      entries.push({
        text: `${player.nombre} usa "${hab.nombre}": cura +${heal} vida a ${naveMode ? 'la nave enemiga' : npc.nombre}`,
        type: 'info',
      });
      showFloatText(npcHudRef, { variant: 'heal', text: `Curación: ${heal}` });
      setLog(prev => [...prev, ...entries.map((e, i) => ({ ...e, id: prev.length + i, ronda, actor: 'player' }))]);
      setNpcHp(newNpcHp);
      endTurnAfter('player');
      return;
    }

    /* ─── Habilidad de ataque ───────────────────────────────────── */
    const useAtq  = hab.tipo === 'melee';
    const atkVal  = useAtq ? effPlayerAtk : effPlayerPnt;
    const defVal  = useAtq ? effNpcDef    : effNpcMov;

    const [aR, dR] = [d20(), d20()];
    const [aT, dT] = [aR + atkVal, dR + defVal];
    const hit = aT > dT;

    await rollDice([
      { key: 'ply', color: '#38cdf0', label: 'TÚ', value: aR },
      { key: 'npc', color: '#ff6b6b', label: naveMode ? 'NAVE' : npc.nombre.slice(0, 8).toUpperCase(), value: dR },
    ]);

    entries.push({
      text: `${player.nombre} usa "${hab.nombre}": 1d20(${aR})+${atkVal}=${aT} vs 1d20(${dR})+${defVal}=${dT}`,
      type: 'info',
    });

    let newNpcHp = { ...npcHp };
    let dmgAplicado = 0;
    if (hit) {
      let dmg = hab.damage ?? (useAtq ? effPlayerAtk : effPlayerPnt);
      let dmgEscudo = hab.damage_escudo ?? 0;
      const effective = formaEsEfectiva(hab.forma, npc.forma ?? 0);
      if (effective) {
        dmg = Math.round(dmg * 1.5);
        dmgEscudo = Math.round(dmgEscudo * 1.5);
        entries.push({ text: `¡Forma efectiva! ×1.5 (Forma ${formaLabel(hab.forma)} vs Forma ${formaLabel(npc.forma)})`, type: 'success' });
      }
      const tieneEscudo = npcHp.escudo > 0;
      dmgAplicado = tieneEscudo ? dmg + Math.max(0, dmgEscudo) : dmg;
      newNpcHp = applyDmg(dmg, npcHp, dmgEscudo);
      entries.push({ text: `¡Impacto! −${dmgAplicado} daño ${tieneEscudo ? 'al escudo' : 'a la vida'}`, type: 'success' });

      if (habDebuff.length > 0) {
        setNpcDebuffs(prev => [...prev, ...habDebuff.map(stat => ({ stat, turns: habRondas }))]);
        entries.push({ text: `${npc.nombre}: ${habDebuff.map(s => `−1 ${s}`).join(', ')} (${habRondas} ronda${habRondas === 1 ? '' : 's'})`, type: 'info' });
      }
    } else {
      entries.push({ text: 'Bloqueado / Falla', type: 'miss' });
    }

    triggerStrike({ playerIsAttacker: true, ranged: !useAtq, hit, dmg: dmgAplicado });

    setLog(prev => [...prev, ...entries.map((e, i) => ({ ...e, id: prev.length + i, ronda, actor: 'player' }))]);
    setNpcHp(newNpcHp);

    if (newNpcHp.vida <= 0) {
      setLog(prev => [...prev, { text: `⚡ ¡${npc.nombre} derrotado!`, type: 'success', id: prev.length, ronda, actor: 'system' }]);
      setPhase('victory');
    } else {
      endTurnAfter('player');
    }
  };

  /* Intento de huida: requiere ganar tirada de iniciativa contra el rival */
  const doPlayerFlee = async () => {
    if (phase !== 'battle' || currTurn !== 'player' || npcBusy || rolling) return;

    const npcLabel = naveMode ? 'NAVE' : npc.nombre.slice(0, 8).toUpperCase();
    const [pR, nR] = [d20(), d20()];
    const [pT, nT] = [pR + effPlayerIni, nR + effNpcIni];
    const success = pT >= nT;

    await rollDice([
      { key: 'p-flee', color: '#38cdf0', label: 'TÚ', value: pR },
      { key: 'n-flee', color: '#ff6b6b', label: npcLabel, value: nR },
    ]);

    const entries = [{
      text: `${player.nombre} intenta huir: 1d20(${pR})+${effPlayerIni}=${pT} vs 1d20(${nR})+${effNpcIni}=${nT}`,
      type: 'info',
    }];
    entries.push(success
      ? { text: '¡Logras escapar del combate!', type: 'success' }
      : { text: 'No logras huir y pierdes el turno', type: 'danger' });

    setLog(prev => [...prev, ...entries.map((e, i) => ({ ...e, id: prev.length + i, ronda, actor: 'player' }))]);

    if (success) {
      localStorage.removeItem(NPC_COMBAT_LS);
      setPhase('fled');
      onFlee?.();
    } else {
      endTurnAfter('player');
    }
  };

  /* Evadir (solo naval): +1 Maniobra (defensa+movimiento) y +1 Iniciativa por 3 rondas —
     sirve para naves sin habilidades o para no quedar sin nada que hacer en el turno. */
  const doPlayerEvadir = () => {
    if (phase !== 'battle' || currTurn !== 'player' || npcBusy || rolling || !naveMode) return;

    setPlayerBuffs(prev => [...prev, ...['defensa', 'movimiento', 'iniciativa'].map(stat => ({ stat, turns: 3 }))]);
    setLog(prev => [...prev, {
      text: `${player.nombre} evade: +1 Maniobra y +1 Iniciativa (3 rondas)`,
      type: 'info', id: prev.length, ronda, actor: 'player',
    }]);
    endTurnAfter('player');
  };

  /* Ataque básico: arma equipada o desarmado */
  const doPlayerBasicAttack = async () => {
    if (phase !== 'battle' || currTurn !== 'player' || npcBusy || rolling) return;

    const arma        = player.arma_equipada;
    const esDistancia = arma?.tipo_ataque === 'distancia';
    const atkVal       = esDistancia ? effPlayerPnt : effPlayerAtk;
    const defVal       = esDistancia ? effNpcMov    : effNpcDef;

    const [aR, dR] = [d20(), d20()];
    const [aT, dT] = [aR + atkVal, dR + defVal];
    const critico   = arma?.critico ?? 0;
    const esCritico = aR >= (20 - critico);
    const hit = esCritico || aT > dT;
    const accion = arma ? `ataca con ${arma.nombre}` : 'ataca desarmado';

    await rollDice([
      { key: 'ply', color: '#38cdf0', label: 'TÚ', value: aR },
      { key: 'npc', color: '#ff6b6b', label: naveMode ? 'NAVE' : npc.nombre.slice(0, 8).toUpperCase(), value: dR },
    ]);

    const entries = [{
      text: `${player.nombre} ${accion}: 1d20(${aR})+${atkVal}=${aT} vs 1d20(${dR})+${defVal}=${dT}`,
      type: 'info',
    }];

    let newNpcHp = { ...npcHp };
    let dmg = 0;
    if (hit) {
      dmg = (arma?.dano ?? 3) + (esCritico ? 1 : 0);
      newNpcHp = applyDmg(dmg, npcHp);
      entries.push({ text: esCritico ? `¡CRÍTICO! (natural ${aR}) −${dmg} daño` : `¡Impacto! −${dmg} daño`, type: 'success' });
    } else {
      entries.push({ text: 'Bloqueado / Falla', type: 'miss' });
    }

    triggerStrike({ playerIsAttacker: true, ranged: esDistancia, hit, crit: esCritico, dmg });

    setLog(prev => [...prev, ...entries.map((e, i) => ({ ...e, id: prev.length + i, ronda, actor: 'player' }))]);
    setNpcHp(newNpcHp);

    if (newNpcHp.vida <= 0) {
      setLog(prev => [...prev, { text: `⚡ ¡${npc.nombre} derrotado!`, type: 'success', id: prev.length, ronda, actor: 'system' }]);
      setPhase('victory');
    } else {
      endTurnAfter('player');
    }
  };

  const isPlayerTurn = currTurn === 'player' && phase === 'battle' && !npcBusy && !rolling;
  useEffect(() => { if (!isPlayerTurn) setHoveredHabId(null); }, [isPlayerTurn]);

  /* Bloquea el scroll de la página mientras el combate está en pantalla */
  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prevOverflow; };
  }, []);

  const pct  = (v, m) => m > 0 ? Math.max(0, Math.min(100, (v / m) * 100)) : 0;
  const vcol = (p) => p > 50 ? '#10b981' : p > 25 ? '#E6B325' : '#ff2d45';
  const LOG_C = { info: 'rgba(200,225,255,0.78)', success: '#10b981', danger: '#ff6b6b', miss: 'rgba(150,180,220,0.5)', system: '#38cdf0' };

  /* Badges para HUDs — en combate naval solo se muestran ATQ y MOV (maniobrabilidad) */
  const npcBadgesFull = [
    { l: 'ATQ', v: effNpcAtk, c: '#ff7043', dim: effNpcAtk < npcAtk },
    { l: 'DEF', v: effNpcDef, c: '#38cdf0', dim: effNpcDef < npcDef },
    ...(npcPnt > 0 ? [{ l: 'PNT', v: effNpcPnt, c: '#10b981', dim: effNpcPnt < npcPnt }] : []),
    { l: 'MOV', v: effNpcMov, c: '#a78bfa', dim: effNpcMov < npcMov },
  ];
  const playerBadgesFull = [
    { l: 'ATQ', v: effPlayerAtk, c: '#ff7043', bonus: effPlayerAtk > player.ataque },
    { l: 'DEF', v: effPlayerDef, c: '#38cdf0', bonus: effPlayerDef > player.defensa },
    ...(player.punteria > 0 ? [{ l: 'PNT', v: effPlayerPnt, c: '#10b981', bonus: effPlayerPnt > player.punteria }] : []),
    { l: 'MOV', v: effPlayerMov, c: '#a78bfa', bonus: effPlayerMov > player.movimiento },
  ];
  const naveBadgeFilter = (b) => b.l === 'ATQ' || b.l === 'MOV';
  const npcBadges    = naveMode ? npcBadgesFull.filter(naveBadgeFilter)    : npcBadgesFull;
  const playerBadges = naveMode ? playerBadgesFull.filter(naveBadgeFilter) : playerBadgesFull;

  const HUD = ({ hp, maxHp, escudo, maxEscudo, photoUrl, nombre, borderColor, badges, ini, align, fallbackIcon = 'user', buffs = [], debuffs = [], forma = 0, formaSide, effectsPosition = 'side' }) => {
    const vPct = pct(hp, maxHp);
    const ePct = pct(escudo, maxEscudo);
    const vc   = vcol(vPct);
    const rev  = align === 'right';
    const formaImgSrc = forma > 0 ? NX.CLASSES[forma - 1]?.img : null;
    const formaBox = formaImgSrc && (
      <div title={`Forma ${formaLabel(forma)}`} style={{
        width: isMobile ? 40 : 56, height: isMobile ? 90 : 120, borderRadius: 10, flexShrink: 0, alignSelf: 'center',
        overflow: 'hidden', border: `2px solid ${borderColor}`, background: 'rgba(255,255,255,0.06)',
      }}>
        <img src={formaImgSrc} alt={`Forma ${formaLabel(forma)}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      </div>
    );
    const effects = Object.values(
      [...buffs.map(b => ({ ...b, kind: 'buff' })), ...debuffs.map(d => ({ ...d, kind: 'debuff' }))]
        .reduce((acc, e) => {
          const key = `${e.kind}-${e.stat}`;
          acc[key] = acc[key]
            ? { ...acc[key], amount: acc[key].amount + 1, turns: Math.max(acc[key].turns, e.turns) }
            : { kind: e.kind, stat: e.stat, amount: 1, turns: e.turns };
          return acc;
        }, {})
    );
    const renderBadge = (e, i) => {
      const abbr = STAT_ABBR[e.stat] ?? e.stat.slice(0, 3).toUpperCase();
      const c = e.kind === 'buff' ? '#10b981' : '#ff6b6b';
      return (
        <span key={`${e.kind}-${e.stat}-${i}`} title={`${e.kind === 'buff' ? 'Buff' : 'Debuff'} · ${e.turns} ronda${e.turns === 1 ? '' : 's'} restante${e.turns === 1 ? '' : 's'}`} style={{
          display: 'inline-flex', alignItems: 'center', gap: 3, flexShrink: 0, whiteSpace: 'nowrap',
          fontSize: 8, fontFamily: 'var(--font-data)', padding: '2px 5px', borderRadius: 4,
          background: `${c}18`, border: `1px solid ${c}55`, color: c, fontWeight: 700,
        }}>
          {BADGE_ICON[abbr] && <Icon name={BADGE_ICON[abbr]} size={8} />}
          {e.kind === 'buff' ? '+' : '−'}{e.amount} {abbr}
          <span style={{ opacity: 0.75, fontWeight: 400 }}>· {e.turns}r</span>
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
          width: isMobile ? 74 : 130, height: isMobile ? 62 : 100, borderRadius: 10, flexShrink: 0, overflow: 'hidden',
          border: `2px solid ${borderColor}`, background: 'rgba(255,255,255,0.06)', display: 'grid', placeItems: 'center',
        }}>
          {photoUrl
            ? <img src={photoUrl} alt={nombre} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            : <Icon name={fallbackIcon} size={26} style={{ color: 'var(--holo)', opacity: 0.5 }} />
          }
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', flexDirection: rev ? 'row-reverse' : 'row', alignItems: 'center', justifyContent: 'space-between', gap: 6, marginBottom: 8 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{nombre}</div>
            {ini != null && (
              <span style={{
                fontSize: 9, fontFamily: 'var(--font-data)', padding: '2px 6px', borderRadius: 4,
                background: 'rgba(230,179,37,0.12)', border: '1px solid rgba(230,179,37,0.4)', color: '#E6B325',
                display: 'flex', alignItems: 'center', gap: 3, flexShrink: 0,
              }}>
                <span style={{ fontSize: 9, lineHeight: 1 }}>⚡</span>{ini}
              </span>
            )}
          </div>
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
                {b.l} {b.v}{b.bonus ? ' ▲' : b.dim ? ' ▼' : ''}
              </span>
            ))}
          </div>
        </div>
      </div>
    );

    const cardRow = (
      <div style={{ display: 'flex', alignItems: 'stretch', gap: 6 }}>
        {formaSide === 'left' && formaBox}
        {effectsPosition === 'side' ? (rev ? <>{card}{effectsColumn}</> : <>{effectsColumn}{card}</>) : card}
        {formaSide === 'right' && formaBox}
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

  const ActionBtn = ({ onClick, disabled, bg, border, hoverBg, hoverBorder, children, minW = 56 }) => (
    <button onClick={disabled ? undefined : onClick} disabled={disabled} style={{
      minWidth: minW, borderRadius: 8, cursor: disabled ? 'not-allowed' : 'pointer',
      background: bg, border: `1px solid ${border}`,
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      gap: 3, padding: '6px 8px', opacity: disabled ? 0.35 : 1, transition: 'all 0.14s', flexShrink: 0,
    }}
      onMouseEnter={e => { if (!disabled) { e.currentTarget.style.background = hoverBg; e.currentTarget.style.borderColor = hoverBorder; } }}
      onMouseLeave={e => { e.currentTarget.style.background = bg; e.currentTarget.style.borderColor = border; }}
    >{children}</button>
  );

  /* Icono por tipo de habilidad */
  const tipoIcon = (tipo) => tipo === 'melee' ? '⚔' : '◎';
  const formaLabel = (f) => ['―', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII'][f] ?? String(f);

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
          REGISTRO · RONDA {ronda}
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
          {round.turns.map((turn, ti) => {
            const isSystem = turn.actor === 'system';
            const isNpc    = turn.actor === 'npc';
            const label    = isSystem ? null : isNpc ? npc.nombre : (player.nombre || 'Tú');
            const accent   = isSystem ? 'rgba(150,200,255,0.35)' : isNpc ? 'rgba(255,45,69,0.35)' : 'rgba(56,205,240,0.35)';
            return (
              <div key={ti} style={{
                display: 'flex', flexDirection: 'column', gap: 2,
                ...(isSystem ? {} : {
                  border: `1px solid ${accent}`, borderRadius: 6,
                  background: isNpc ? 'rgba(255,45,69,0.05)' : 'rgba(56,205,240,0.05)',
                  padding: '4px 6px',
                }),
              }}>
                {label && (
                  <div style={{ fontSize: 7, color: accent.replace('0.35', '0.85'), fontFamily: 'var(--font-data)', letterSpacing: '0.08em', fontWeight: 700 }}>
                    {isNpc ? '👤 ' : '⚔ '}{label.toUpperCase()}
                  </div>
                )}
                {turn.entries.map(e => (
                  <div key={e.id} style={{
                    fontSize: 10, color: LOG_C[e.type] ?? 'rgba(200,225,255,0.75)',
                    fontFamily: 'var(--font-data)', letterSpacing: '0.03em', lineHeight: 1.4,
                    paddingLeft: isSystem ? 6 : 0,
                    borderLeft: isSystem ? '2px solid #38cdf0' : 'none',
                    animation: 'nx-fade-up 0.2s ease both',
                  }}>{renderDiceText(e.text, e.diceColors)}</div>
                ))}
              </div>
            );
          })}
        </div>
      ))}
      {npcBusy && (
        <div style={{ display: 'flex', gap: 4, alignItems: 'center', marginTop: 3 }}>
          <span style={{ fontSize: 9, color: '#ff9999', fontFamily: 'var(--font-data)' }}>{npc.nombre}…</span>
          {[0, 1, 2].map(i => <div key={i} style={{ width: 3, height: 3, borderRadius: '50%', background: '#ff9999', animation: `nx-pulse 0.8s ${i * 0.2}s infinite` }} />)}
        </div>
      )}
    </div>
  );

  /* Contenido de la barra de acciones — compartido entre el layout desktop (absoluto) y mobile (flex, dentro de la columna) */
  const actionBarInner = (
    <>
      {phase === 'initiative' && (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ color: 'rgba(150,200,255,0.4)', fontSize: 11, fontFamily: 'var(--font-data)', letterSpacing: '0.15em' }}>CALCULANDO INICIATIVA…</span>
        </div>
      )}
      {phase === 'victory' && (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 20 }}>
          <span style={{ fontSize: 16, color: '#10b981', fontFamily: 'var(--font-data)', letterSpacing: '0.14em' }}>⚡ VICTORIA</span>
          <button onClick={() => setShowCombatCard(true)} style={combatCardBtnStyle}>📸 TARJETA</button>
          <button onClick={() => { localStorage.removeItem(NPC_COMBAT_LS); onVictory?.(); }} style={{ padding: '8px 22px', borderRadius: 7, cursor: 'pointer', background: 'rgba(16,185,129,0.18)', border: '1px solid rgba(16,185,129,0.5)', color: '#10b981', fontFamily: 'var(--font-data)', fontSize: 10, letterSpacing: '0.14em' }}>CONTINUAR →</button>
        </div>
      )}
      {phase === 'defeat' && (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 20 }}>
          <span style={{ fontSize: 16, color: '#ff6b6b', fontFamily: 'var(--font-data)', letterSpacing: '0.14em' }}>☠ DERROTA</span>
          <button onClick={() => setShowCombatCard(true)} style={combatCardBtnStyle}>📸 TARJETA</button>
          <button onClick={() => { localStorage.removeItem(NPC_COMBAT_LS); onDefeat?.(); }} style={{ padding: '8px 22px', borderRadius: 7, cursor: 'pointer', background: 'rgba(255,45,69,0.14)', border: '1px solid rgba(255,45,69,0.45)', color: '#ff6b6b', fontFamily: 'var(--font-data)', fontSize: 10, letterSpacing: '0.14em' }}>RETIRARSE</button>
        </div>
      )}
      {phase === 'battle' && (
        <>
          {/* Barra de Fuerza */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 8, color: '#38cdf0', fontFamily: 'var(--font-data)', letterSpacing: '0.12em', flexShrink: 0 }}>FUERZA</span>
            <div style={{ display: 'flex', gap: 2, flex: 1 }}>
              {Array.from({ length: maxFuerza }, (_, i) => (
                <div key={i} style={{
                  flex: 1, height: 6, borderRadius: 2,
                  background: i < playerFuerza ? '#38cdf0' : 'rgba(56,205,240,0.12)',
                  transition: 'background 0.2s ease',
                }} />
              ))}
            </div>
            <span style={{ fontSize: 8, color: '#38cdf0', fontFamily: 'var(--font-data)', flexShrink: 0 }}>{playerFuerza}/{maxFuerza}</span>
          </div>

          {/* Botones de habilidades */}
          <div style={{ display: 'flex', gap: 6, alignItems: 'stretch', flex: 1, overflowX: isMobile ? 'auto' : 'visible', flexWrap: 'nowrap' }}>
            {habilidades.length === 0 ? (
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ fontSize: 10, color: 'rgba(150,200,255,0.3)', fontFamily: 'var(--font-data)' }}>Sin habilidades equipadas</span>
              </div>
            ) : (
              habilidades.map(hab => {
                const habId    = String(hab.id);
                const cdLeft   = cooldowns[habId] ?? 0;
                const noFuerza = playerFuerza < hab.costo_fuerza;
                const disabled = !isPlayerTurn || cdLeft > 0 || noFuerza;
                const isSelf   = hab.objetivo === 'self';

                return (
                  <button key={hab.id} onClick={() => !disabled && doPlayerSkill(hab)}
                    disabled={disabled}
                    style={{
                      flex: isMobile ? '0 0 auto' : 1, minWidth: isMobile ? 64 : 0, borderRadius: 8,
                      cursor: disabled ? 'not-allowed' : 'pointer',
                      background: disabled ? 'rgba(56,205,240,0.03)' : 'rgba(56,205,240,0.08)',
                      border: `1px solid ${disabled ? 'rgba(56,205,240,0.09)' : 'rgba(56,205,240,0.26)'}`,
                      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                      gap: 2, padding: '4px 6px', opacity: disabled ? 0.45 : 1,
                      position: 'relative', transition: 'all 0.13s',
                    }}
                    onMouseEnter={e => { if (!disabled) { e.currentTarget.style.background = 'rgba(56,205,240,0.16)'; e.currentTarget.style.borderColor = 'rgba(56,205,240,0.48)'; } setHoveredHabId(hab.id); }}
                    onMouseLeave={e => { e.currentTarget.style.background = disabled ? 'rgba(56,205,240,0.03)' : 'rgba(56,205,240,0.08)'; e.currentTarget.style.borderColor = disabled ? 'rgba(56,205,240,0.09)' : 'rgba(56,205,240,0.26)'; setHoveredHabId(null); }}
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
                    <span style={{ fontSize: 14, lineHeight: 1 }}>{tipoIcon(hab.tipo)}</span>
                    <span style={{
                      fontSize: 8, color: 'var(--txt)', fontFamily: 'var(--font-data)', letterSpacing: '0.04em',
                      whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%', textAlign: 'center',
                    }}>{hab.nombre}</span>
                    <div style={{ display: 'flex', gap: 3, alignItems: 'center' }}>
                      {!isSelf && (
                        <span style={{ fontSize: 7, color: '#ff7043', fontFamily: 'var(--font-data)' }}>
                          DMG {hab.damage}
                        </span>
                      )}
                      {isSelf && (
                        <span style={{ fontSize: 7, color: '#10b981', fontFamily: 'var(--font-data)' }}>BUFF</span>
                      )}
                      <span style={{
                        fontSize: 7, fontFamily: 'var(--font-data)', padding: '1px 4px', borderRadius: 3,
                        background: noFuerza && isPlayerTurn ? 'rgba(255,45,69,0.25)' : 'rgba(56,205,240,0.15)',
                        color: noFuerza && isPlayerTurn ? '#ff6b6b' : '#38cdf0',
                      }}>
                        ⚡{hab.costo_fuerza}
                      </span>
                      {hab.forma > 0 && (
                        <span style={{ fontSize: 7, color: 'rgba(150,200,255,0.5)', fontFamily: 'var(--font-data)' }}>
                          F{formaLabel(hab.forma)}
                        </span>
                      )}
                    </div>
                  </button>
                );
              })
            )}

            {!naveMode && (
              <>
                <div style={{ width: 1, background: 'rgba(255,255,255,0.08)', flexShrink: 0, alignSelf: 'stretch', margin: '2px 0' }} />

                <ActionBtn onClick={() => isPlayerTurn && doPlayerBasicAttack()}
                  disabled={!isPlayerTurn}
                  bg="rgba(255,140,0,0.07)" border="rgba(255,140,0,0.22)"
                  hoverBg="rgba(255,140,0,0.18)" hoverBorder="rgba(255,140,0,0.5)" minW={58}
                >
                  <span style={{ fontSize: 16, lineHeight: 1 }}>{player.arma_equipada ? '🗡' : '✊'}</span>
                  <span style={{
                    fontSize: 7, fontFamily: 'var(--font-data)', letterSpacing: '0.04em', whiteSpace: 'nowrap',
                    maxWidth: 64, overflow: 'hidden', textOverflow: 'ellipsis',
                    color: (player.arma_equipada?.es_sable && NX.SABERS[player.arma_equipada.color_hoja]) || '#ff9955',
                  }}>
                    {player.arma_equipada ? player.arma_equipada.nombre.toUpperCase() : 'DESARMADO'}
                  </span>
                  <span style={{ fontSize: 7, color: '#ff7043', fontFamily: 'var(--font-data)' }}>DMG {player.arma_equipada?.dano ?? 3}</span>
                </ActionBtn>
              </>
            )}

            {!naveMode && (
              <>
                <div style={{ width: 1, background: 'rgba(255,255,255,0.08)', flexShrink: 0, alignSelf: 'stretch', margin: '2px 0' }} />

                <ActionBtn onClick={() => isPlayerTurn && setStancePicker(true)}
                  disabled={!isPlayerTurn}
                  bg="rgba(139,92,246,0.07)" border="rgba(139,92,246,0.22)"
                  hoverBg="rgba(139,92,246,0.18)" hoverBorder="rgba(139,92,246,0.5)" minW={54}
                >
                  <span style={{ fontSize: 14, lineHeight: 1 }}>🔄</span>
                  <span style={{ fontSize: 7, color: '#a78bfa', fontFamily: 'var(--font-data)', whiteSpace: 'nowrap', maxWidth: 60, overflow: 'hidden', textOverflow: 'ellipsis' }}>{FORMA_LABELS_SHORT[currentForma - 1] ?? `F${currentForma}`}</span>
                  <span style={{ fontSize: 7, color: '#a78bfa', fontFamily: 'var(--font-data)' }}>ESTANCIA</span>
                </ActionBtn>
              </>
            )}

            {naveMode && (
              <>
                <div style={{ width: 1, background: 'rgba(255,255,255,0.08)', flexShrink: 0, alignSelf: 'stretch', margin: '2px 0' }} />

                <ActionBtn onClick={() => isPlayerTurn && doPlayerEvadir()}
                  disabled={!isPlayerTurn}
                  bg="rgba(16,185,129,0.07)" border="rgba(16,185,129,0.22)"
                  hoverBg="rgba(16,185,129,0.18)" hoverBorder="rgba(16,185,129,0.5)" minW={54}
                >
                  <span style={{ fontSize: 16, lineHeight: 1 }}>🌀</span>
                  <span style={{ fontSize: 7, color: '#10b981', fontFamily: 'var(--font-data)' }}>EVADIR</span>
                </ActionBtn>
              </>
            )}

            <div style={{ width: 1, background: 'rgba(255,255,255,0.08)', flexShrink: 0, alignSelf: 'stretch', margin: '2px 0' }} />

            <ActionBtn onClick={() => isPlayerTurn && doPlayerFlee()}
              disabled={!isPlayerTurn}
              bg="rgba(255,45,69,0.07)" border="rgba(255,45,69,0.22)"
              hoverBg="rgba(255,45,69,0.18)" hoverBorder="rgba(255,45,69,0.5)" minW={50}
            >
              <span style={{ fontSize: 18, lineHeight: 1 }}>🏃</span>
              <span style={{ fontSize: 8, color: '#ff6b6b', fontFamily: 'var(--font-data)' }}>HUIR</span>
            </ActionBtn>
          </div>
        </>
      )}
    </>
  );

  const actionBar = (
    <div style={{
      position: isMobile ? 'relative' : 'absolute',
      ...(isMobile ? {} : { bottom: 0, left: 0, right: 0 }),
      zIndex: 10, flexShrink: 0,
      background: 'rgba(3,7,16,0.96)', backdropFilter: 'blur(16px)',
      borderTop: '1px solid rgba(56,205,240,0.13)',
      borderRadius: isMobile ? 10 : 0,
      padding: '6px 12px 8px', display: 'flex', flexDirection: 'column', gap: 5,
      minHeight: 90,
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
      <div ref={stageRef} style={{
        position: 'relative',
        width: '100%', maxWidth: 900,
        height: '100%', maxHeight: 640,
        borderRadius: 18,
        overflow: 'hidden',
        boxShadow: '0 0 80px rgba(0,0,0,0.9), 0 0 0 1px rgba(56,205,240,0.18)',
      }}>
        {/* Fondo */}
        {naveMode
          ? <SpaceBackground />
          : bgImg
          ? <img src={bgImg} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center' }} />
          : <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at 50% 30%, #0c1e42, #020810)' }} />
        }
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(2,6,16,0.72)' }} />

        {diceOverlay}

        {isMobile ? (
          /* Layout mobile: enemigo arriba (full width) → registro/resumen al medio → jugador abajo (full width) → barra de acciones */
          <div style={{ position: 'absolute', inset: 8, zIndex: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div ref={npcHudRef}>
              <HUD
                hp={npcHp.vida} maxHp={maxNpc.vida} escudo={npcHp.escudo} maxEscudo={maxNpc.escudo}
                nombre={npc.nombre} photoUrl={mediaUrl(npc.imagen_mini) || mediaUrl(npc.imagen)} ini={npcIni}
                borderColor="rgba(255,45,69,0.40)" badges={npcBadges} align="left"
                fallbackIcon={naveMode ? 'ship' : 'user'}
                debuffs={npcDebuffs}
                forma={naveMode ? 0 : (npc.forma ?? 0)} formaSide="right"
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

            <div ref={playerHudRef}>
              <HUD
                hp={playerHp.vida} maxHp={maxPlayer.vida} escudo={playerHp.escudo} maxEscudo={maxPlayer.escudo}
                nombre={player.nombre} photoUrl={mediaUrl(player.photo)} ini={player.iniciativa}
                borderColor="rgba(56,205,240,0.30)" badges={playerBadges} align="right"
                fallbackIcon={naveMode ? 'ship' : 'user'}
                buffs={playerBuffs}
                forma={naveMode ? 0 : currentForma} formaSide="left"
                effectsPosition="above"
              />
            </div>

            {actionBar}
          </div>
        ) : (
          <>
            {/* NPC HUD — arriba derecha */}
            <div ref={npcHudRef} style={{ position: 'absolute', top: 10, right: 10, zIndex: 10, width: 'clamp(360px, 55%, 520px)' }}>
              <HUD
                hp={npcHp.vida} maxHp={maxNpc.vida} escudo={npcHp.escudo} maxEscudo={maxNpc.escudo}
                nombre={npc.nombre} photoUrl={mediaUrl(npc.imagen_mini) || mediaUrl(npc.imagen)} ini={npcIni}
                borderColor="rgba(255,45,69,0.40)" badges={npcBadges} align="left"
                fallbackIcon={naveMode ? 'ship' : 'user'}
                debuffs={npcDebuffs}
                forma={naveMode ? 0 : (npc.forma ?? 0)} formaSide="right"
              />
            </div>

            {/* Jugador HUD — abajo izquierda */}
            <div ref={playerHudRef} style={{ position: 'absolute', bottom: 90, left: 14, zIndex: 10, width: 'clamp(360px, 55%, 520px)' }}>
              <HUD
                hp={playerHp.vida} maxHp={maxPlayer.vida} escudo={playerHp.escudo} maxEscudo={maxPlayer.escudo}
                nombre={player.nombre} photoUrl={mediaUrl(player.photo)} ini={player.iniciativa}
                borderColor="rgba(56,205,240,0.30)" badges={playerBadges} align="right"
                fallbackIcon={naveMode ? 'ship' : 'user'}
                buffs={playerBuffs}
                forma={naveMode ? 0 : currentForma} formaSide="left"
              />
            </div>
          </>
        )}

        {/* Golpe de energía (melee) o mira (a distancia) */}
        {strike && (strike.type === 'melee' ? (
          <EnergyStrikeEffect key={strike.key}
            from={strike.from} to={strike.to} color={strike.color} outcome={strike.outcome}
            stageRef={stageRef} attackerRef={strike.attackerRef} targetRef={strike.targetRef}
            onDone={() => {
              setFloatTexts((prev) => [...prev, { id: strike.key, x: strike.to.x, y: strike.to.y, ...strike.result }]);
              setStrike(null);
            }}
          />
        ) : (
          <RangedStrikeEffect key={strike.key}
            from={strike.from} to={strike.to} color={strike.color} outcome={strike.outcome}
            stageRef={stageRef} attackerRef={strike.attackerRef} targetRef={strike.targetRef}
            onDone={() => {
              setFloatTexts((prev) => [...prev, { id: strike.key, x: strike.to.x, y: strike.to.y, ...strike.result }]);
              setStrike(null);
            }}
          />
        ))}

        {/* Resultado del ataque — texto flotante sobre el personaje afectado; cada uno vive su propio segundo */}
        {floatTexts.map((ft) => (
          <FloatingCombatText key={ft.id}
            x={ft.x} y={ft.y} text={ft.text} variant={ft.variant}
            onDone={() => setFloatTexts((prev) => prev.filter((f) => f.id !== ft.id))}
          />
        ))}

        {/* Log de combate — izquierda, colapsable (desktop; en mobile va integrado en la columna central) */}
        {!isMobile && (
          <div style={{
            position: 'absolute', left: 14, top: 14, zIndex: 10,
            width: logCollapsed ? 36 : 'clamp(150px, 26%, 240px)',
            maxHeight: 'calc(100% - 260px)',
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
        {stancePicker && !naveMode && (
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
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
                {FORMA_LABELS_SHORT.map((label, i) => {
                  const f = i + 1;
                  const active = f === currentForma;
                  const hasSlots = Array.isArray(porForma[String(f)]) && porForma[String(f)].some(Boolean);
                  return (
                    <button key={f} onClick={() => {
                      if (active) { setStancePicker(false); return; }
                      setCurrentForma(f);
                      setStancePicker(false);
                      setLog(prev => [...prev, {
                        text: `🔄 Cambias a Forma ${f} (${label})`,
                        type: 'info', id: prev.length, ronda, actor: 'player',
                      }]);
                      endTurnAfter('player');
                    }} style={{
                      padding: '10px 6px', borderRadius: 8, cursor: 'pointer', textAlign: 'center',
                      background: active ? 'rgba(139,92,246,0.25)' : hasSlots ? 'rgba(139,92,246,0.06)' : 'rgba(255,255,255,0.03)',
                      border: `1px solid ${active ? '#a78bfa' : hasSlots ? 'rgba(139,92,246,0.3)' : 'rgba(255,255,255,0.08)'}`,
                      opacity: active ? 1 : 0.85,
                    }}>
                      <div style={{ fontSize: 13, fontFamily: 'var(--font-data)', color: active ? '#a78bfa' : '#fff', fontWeight: 700 }}>F{f}</div>
                      <div style={{ fontSize: 8, color: 'rgba(200,180,255,0.6)', marginTop: 3, lineHeight: 1.3 }}>{label}</div>
                      {!hasSlots && <div style={{ fontSize: 7, color: 'rgba(150,150,150,0.5)', marginTop: 2 }}>sin slots</div>}
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
      {showCombatCard && (
        <NpcCombatCardModal
          phase={phase} player={player} npc={npc} log={log} ronda={ronda} naveMode={naveMode}
          planetaNombre={planetaNombre} lugarNombre={lugarNombre}
          onClose={() => setShowCombatCard(false)}
        />
      )}
    </div>
  );

  const container = document.getElementById('nx-content') ?? document.body;
  return createPortal(screen, container);
}
