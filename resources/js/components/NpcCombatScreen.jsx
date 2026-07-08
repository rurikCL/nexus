import { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from './ui.jsx';
import { NX } from '../data/seed.js';

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

export default function NpcCombatScreen({ npc, player, lugarImagen, onVictory, onDefeat, onFlee, initialState }) {
  const d20 = () => Math.floor(Math.random() * 20) + 1;

  const maxPlayer = { vida: player.vida, escudo: player.escudo };
  const maxNpc    = { vida: Math.max(npc.vida, 1), escudo: npc.escudo ?? 0 };

  const npcAtk = Math.max(npc.ataque,     1);
  const npcDef = Math.max(npc.defensa,    1);
  const npcMov = Math.max(npc.movimiento, 1);
  const npcIni = Math.max(npc.iniciativa, 1);
  const npcPnt = npc.punteria ?? 0;

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

  const FORMA_LABELS_SHORT = ['Shii-Cho', 'Makashi', 'Soresu', 'Ataru', 'Shien/DjSo', 'Niman', 'Juyo/Vaapad'];

  /* Habilidades de la forma actual (del pool, sin fetch adicional) */
  const habilidades = useMemo(() => {
    const slotIds = Array.isArray(porForma[String(currentForma)]) ? porForma[String(currentForma)] : [];
    return slotIds.filter(Boolean).map(id => habPool[String(id)]).filter(Boolean);
  }, [currentForma]);

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

  /* Fondo desde el lugar del NPC */
  useEffect(() => {
    if (bgImg || !npc.LugarID) return;
    const token = localStorage.getItem('nx-token');
    fetch(`/api/map/lugares/${npc.LugarID}`, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    })
      .then(r => r.json())
      .then(d => { if (d.lugar?.imagen) setBgImg(mediaUrl(d.lugar.imagen)); })
      .catch(() => {});
  }, []);

  const applyDmg = (dmg, hp) => {
    const newEsc = Math.max(0, hp.escudo - dmg);
    const rem    = dmg - hp.escudo;
    return { escudo: newEsc, vida: rem > 0 ? Math.max(0, hp.vida - rem) : hp.vida };
  };

  /* Iniciativa — solo si es combate nuevo (no restaurado) */
  useEffect(() => {
    if (initialState) return;
    const pR = d20(); const nR = d20();
    const pT = pR + effPlayerIni; const nT = nR + effNpcIni;
    const first = pT >= nT ? 'player' : 'npc';
    setTimeout(() => {
      setLog([
        { text: '⚔ ¡COMBATE INICIADO!', type: 'system', id: 0 },
        { text: `Ronda 1 — Iniciativa: Tú 1d20(${pR})+${effPlayerIni}=${pT} | ${npc.nombre} 1d20(${nR})+${effNpcIni}=${nT}`, type: 'info', id: 1 },
        { text: first === 'player' ? '¡Atacas primero!' : `¡${npc.nombre} actúa primero!`, type: first === 'player' ? 'success' : 'danger', id: 2 },
      ]);
      setPhase('battle');
      setCurrTurn(first);
      /* Pre-recuperar fuerza si el jugador actúa primero */
      if (first === 'player') setPlayerFuerza(2);
    }, 500);
  }, []);

  /* Termina el turno de quien actuó — decide si sigue la ronda o se tira nueva iniciativa */
  const endTurnAfter = (actor) => {
    if (rondaTurno === 0) {
      /* Primera acción de la ronda: actúa el otro, sin nueva tirada */
      const next = actor === 'player' ? 'npc' : 'player';
      setRondaTurno(1);
      setCurrTurn(next);
      if (next === 'player') setPlayerFuerza(p => Math.min(10, p + 2));
    } else {
      /* Ambos actuaron: termina la ronda, se tira nueva iniciativa */
      const pR = d20(); const nR = d20();
      const pT = pR + effPlayerIni; const nT = nR + effNpcIni;
      const first = pT >= nT ? 'player' : 'npc';
      setLog(prev => [...prev,
        { text: `Ronda ${ronda + 1} — Iniciativa: Tú 1d20(${pR})+${effPlayerIni}=${pT} | ${npc.nombre} 1d20(${nR})+${effNpcIni}=${nT}`, type: 'info', id: prev.length },
        { text: first === 'player' ? '¡Actúas primero!' : `¡${npc.nombre} actúa primero!`, type: first === 'player' ? 'success' : 'danger', id: prev.length + 1 },
      ]);
      setRonda(r => r + 1);
      setRondaTurno(0);
      setCurrTurn(first);
      if (first === 'player') setPlayerFuerza(p => Math.min(10, p + 2));
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
    const t = setTimeout(() => {
      /* Leer stats efectivos ahora (closure over current state at render time) */
      const useRanged = effNpcPnt > 0 && Math.random() > 0.5;
      let entries = [];
      let newHp;

      if (useRanged) {
        const [aR, dR] = [d20(), d20()];
        const [aT, dT] = [aR + effNpcPnt, dR + effPlayerMov];
        entries = [
          { text: `${npc.nombre} dispara: 1d20(${aR})+${effNpcPnt}=${aT}`, type: 'info' },
          { text: `Esquivas: 1d20(${dR})+${effPlayerMov}=${dT}`, type: 'info' },
        ];
        newHp = aT > dT ? applyDmg(effNpcPnt, playerHp) : { ...playerHp };
        entries.push(aT > dT ? { text: `¡Te impactan! −${effNpcPnt} daño`, type: 'danger' } : { text: '¡Esquivas!', type: 'success' });
      } else {
        const [aR, dR] = [d20(), d20()];
        const [aT, dT] = [aR + effNpcAtk, dR + effPlayerDef];
        entries = [
          { text: `${npc.nombre} ataca: 1d20(${aR})+${effNpcAtk}=${aT}`, type: 'info' },
          { text: `Defiendes: 1d20(${dR})+${effPlayerDef}=${dT}`, type: 'info' },
        ];
        newHp = aT > dT ? applyDmg(effNpcAtk, playerHp) : { ...playerHp };
        entries.push(aT > dT ? { text: `¡Golpe! −${effNpcAtk} daño`, type: 'danger' } : { text: 'Bloqueas el ataque', type: 'success' });
      }

      setLog(prev => [...prev, ...entries.map((e, i) => ({ ...e, id: prev.length + i }))]);
      setPlayerHp(newHp);

      /* Al fin del turno NPC: decrementar cooldowns/buffs y pre-recuperar fuerza del jugador */
      setCooldowns(prev => Object.fromEntries(
        Object.entries(prev).filter(([, v]) => v > 1).map(([k, v]) => [k, v - 1])
      ));
      setPlayerBuffs(prev => prev.map(b => ({ ...b, turns: b.turns - 1 })).filter(b => b.turns > 0));
      setNpcDebuffs(prev => prev.map(d => ({ ...d, turns: d.turns - 1 })).filter(d => d.turns > 0));

      setNpcBusy(false);
      if (newHp.vida <= 0) {
        setLog(prev => [...prev, { text: '☠ Has sido derrotado.', type: 'danger', id: prev.length }]);
        setPhase('defeat');
      } else {
        endTurnAfter('npc');
      }
    }, 1500);
    return () => clearTimeout(t);
  }, [currTurn, phase, ronda]);

  useEffect(() => { if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight; }, [log]);

  /* Ejecutar habilidad del jugador */
  const doPlayerSkill = (hab) => {
    if (phase !== 'battle' || currTurn !== 'player' || npcBusy) return;
    const habId = String(hab.id);
    if ((cooldowns[habId] ?? 0) > 0) return;
    if (playerFuerza < hab.costo_fuerza) return;

    const habBuff   = Array.isArray(hab.buff)   ? hab.buff   : [];
    const habDebuff = Array.isArray(hab.debuff) ? hab.debuff : [];

    /* Gastar fuerza */
    setPlayerFuerza(prev => prev - hab.costo_fuerza);

    /* Registrar cooldown */
    if (hab.cooldown > 0) {
      setCooldowns(prev => ({ ...prev, [habId]: hab.cooldown }));
    }

    /* Aplicar buff al jugador */
    if (habBuff.length > 0) {
      setPlayerBuffs(prev => [...prev, ...habBuff.map(stat => ({ stat, turns: 2 }))]);
    }

    const entries = [];

    /* ─── Habilidad de auto-buff ────────────────────────────────── */
    if (hab.objetivo === 'self') {
      const buffDesc = habBuff.map(s => `+1 ${s}`).join(', ');
      entries.push({ text: `${player.nombre} usa "${hab.nombre}"${buffDesc ? ` (${buffDesc})` : ''}`, type: 'info' });
      setLog(prev => [...prev, ...entries.map((e, i) => ({ ...e, id: prev.length + i }))]);
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

    entries.push({
      text: `${player.nombre} usa "${hab.nombre}": 1d20(${aR})+${atkVal}=${aT} vs 1d20(${dR})+${defVal}=${dT}`,
      type: 'info',
    });

    let newNpcHp = { ...npcHp };
    if (hit) {
      const dmg = hab.damage ?? (useAtq ? effPlayerAtk : effPlayerPnt);
      /* vs NPC: forma siempre neutral (sin bonus de efectividad) */
      newNpcHp = applyDmg(dmg, npcHp);
      entries.push({ text: `¡Impacto! −${dmg} daño`, type: 'success' });

      if (habDebuff.length > 0) {
        setNpcDebuffs(prev => [...prev, ...habDebuff.map(stat => ({ stat, turns: 2 }))]);
        entries.push({ text: `${npc.nombre}: ${habDebuff.map(s => `−1 ${s}`).join(', ')} (2 turnos)`, type: 'info' });
      }
    } else {
      entries.push({ text: 'Bloqueado / Falla', type: 'miss' });
    }

    setLog(prev => [...prev, ...entries.map((e, i) => ({ ...e, id: prev.length + i }))]);
    setNpcHp(newNpcHp);

    if (newNpcHp.vida <= 0) {
      setLog(prev => [...prev, { text: `⚡ ¡${npc.nombre} derrotado!`, type: 'success', id: prev.length }]);
      setPhase('victory');
    } else {
      endTurnAfter('player');
    }
  };

  /* Ataque básico: arma equipada o desarmado */
  const doPlayerBasicAttack = () => {
    if (phase !== 'battle' || currTurn !== 'player' || npcBusy) return;

    const arma        = player.arma_equipada;
    const esDistancia = arma?.tipo_ataque === 'distancia';
    const atkVal       = esDistancia ? effPlayerPnt : effPlayerAtk;
    const defVal       = esDistancia ? effNpcMov    : effNpcDef;

    const [aR, dR] = [d20(), d20()];
    const [aT, dT] = [aR + atkVal, dR + defVal];
    const hit = aT > dT;
    const accion = arma ? `ataca con ${arma.nombre}` : 'ataca desarmado';

    const entries = [{
      text: `${player.nombre} ${accion}: 1d20(${aR})+${atkVal}=${aT} vs 1d20(${dR})+${defVal}=${dT}`,
      type: 'info',
    }];

    let newNpcHp = { ...npcHp };
    if (hit) {
      const dmg = arma?.dano ?? 3;
      newNpcHp = applyDmg(dmg, npcHp);
      entries.push({ text: `¡Impacto! −${dmg} daño`, type: 'success' });
    } else {
      entries.push({ text: 'Bloqueado / Falla', type: 'miss' });
    }

    setLog(prev => [...prev, ...entries.map((e, i) => ({ ...e, id: prev.length + i }))]);
    setNpcHp(newNpcHp);

    if (newNpcHp.vida <= 0) {
      setLog(prev => [...prev, { text: `⚡ ¡${npc.nombre} derrotado!`, type: 'success', id: prev.length }]);
      setPhase('victory');
    } else {
      endTurnAfter('player');
    }
  };

  const isPlayerTurn = currTurn === 'player' && phase === 'battle' && !npcBusy;

  const pct  = (v, m) => m > 0 ? Math.max(0, Math.min(100, (v / m) * 100)) : 0;
  const vcol = (p) => p > 50 ? '#10b981' : p > 25 ? '#E6B325' : '#ff2d45';
  const LOG_C = { info: 'rgba(200,225,255,0.78)', success: '#10b981', danger: '#ff6b6b', miss: 'rgba(150,180,220,0.5)', system: '#38cdf0' };

  /* Badges para HUDs */
  const npcBadges = [
    { l: 'ATQ', v: effNpcAtk, c: '#ff7043', dim: effNpcAtk < npcAtk },
    { l: 'DEF', v: effNpcDef, c: '#38cdf0', dim: effNpcDef < npcDef },
    ...(npcPnt > 0 ? [{ l: 'PNT', v: effNpcPnt, c: '#10b981', dim: effNpcPnt < npcPnt }] : []),
    { l: 'MOV', v: effNpcMov, c: '#a78bfa', dim: effNpcMov < npcMov },
  ];
  const playerBadges = [
    { l: 'ATQ', v: effPlayerAtk, c: '#ff7043', bonus: effPlayerAtk > player.ataque },
    { l: 'DEF', v: effPlayerDef, c: '#38cdf0', bonus: effPlayerDef > player.defensa },
    ...(player.punteria > 0 ? [{ l: 'PNT', v: effPlayerPnt, c: '#10b981', bonus: effPlayerPnt > player.punteria }] : []),
    { l: 'MOV', v: effPlayerMov, c: '#a78bfa', bonus: effPlayerMov > player.movimiento },
  ];

  const HUD = ({ hp, maxHp, escudo, maxEscudo, photoUrl, nombre, borderColor, badges, ini, align }) => {
    const vPct = pct(hp, maxHp);
    const ePct = pct(escudo, maxEscudo);
    const vc   = vcol(vPct);
    const rev  = align === 'right';
    return (
      <div style={{
        background: 'rgba(6,12,26,0.92)', backdropFilter: 'blur(16px)',
        border: `1px solid ${borderColor}`, borderRadius: 14,
        padding: isMobile ? 8 : 14, display: 'flex', flexDirection: rev ? 'row-reverse' : 'row',
        gap: isMobile ? 8 : 14, alignItems: 'flex-start',
      }}>
        <div style={{
          width: isMobile ? 52 : 84, height: isMobile ? 68 : 122, borderRadius: 10, flexShrink: 0, overflow: 'hidden',
          border: `2px solid ${borderColor}`, background: 'rgba(255,255,255,0.06)', display: 'grid', placeItems: 'center',
        }}>
          {photoUrl
            ? <img src={photoUrl} alt={nombre} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            : <Icon name="user" size={26} style={{ color: 'var(--holo)', opacity: 0.5 }} />
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
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, auto)', gap: 4, justifyContent: rev ? 'end' : 'start' }}>
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

  const screen = (
    <div style={{
      position: 'absolute', inset: 0, zIndex: 9500,
      background: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(6px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 12,
    }}>
      <div style={{
        position: 'relative',
        width: '100%', maxWidth: 900,
        height: '100%', maxHeight: 640,
        borderRadius: 18,
        overflow: 'hidden',
        boxShadow: '0 0 80px rgba(0,0,0,0.9), 0 0 0 1px rgba(56,205,240,0.18)',
      }}>
        {/* Fondo */}
        {bgImg
          ? <img src={bgImg} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center' }} />
          : <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at 50% 30%, #0c1e42, #020810)' }} />
        }
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(2,6,16,0.72)' }} />

        {/* NPC HUD — arriba derecha */}
        <div style={{ position: 'absolute', top: 10, right: 10, zIndex: 10, width: isMobile ? 'calc(50% - 14px)' : 'clamp(190px, 36%, 260px)' }}>
          <HUD
            hp={npcHp.vida} maxHp={maxNpc.vida} escudo={npcHp.escudo} maxEscudo={maxNpc.escudo}
            nombre={npc.nombre} photoUrl={mediaUrl(npc.imagen_mini) || mediaUrl(npc.imagen)} ini={npcIni}
            borderColor="rgba(255,45,69,0.40)" badges={npcBadges} align="left"
          />
        </div>

        {/* Jugador HUD — abajo izquierda (móvil: arriba izquierda) */}
        <div style={{ position: 'absolute', ...(isMobile ? { top: 10, left: 10 } : { bottom: 90, left: 14 }), zIndex: 10, width: isMobile ? 'calc(50% - 14px)' : 'clamp(190px, 36%, 260px)' }}>
          <HUD
            hp={playerHp.vida} maxHp={maxPlayer.vida} escudo={playerHp.escudo} maxEscudo={maxPlayer.escudo}
            nombre={player.nombre} photoUrl={mediaUrl(player.photo)} ini={player.iniciativa}
            borderColor="rgba(56,205,240,0.30)" badges={playerBadges} align="right"
          />
        </div>

        {/* Log de combate — izquierda, colapsable */}
        <div style={{
          position: 'absolute', left: isMobile ? 8 : 14, top: isMobile ? 'calc(50% - 20px)' : 14, zIndex: 10,
          width: logCollapsed ? 36 : isMobile ? 'clamp(110px, 42%, 180px)' : 'clamp(150px, 26%, 240px)',
          maxHeight: isMobile ? '45%' : 'calc(100% - 260px)',
          background: 'rgba(4,9,20,0.88)', backdropFilter: 'blur(12px)',
          borderRadius: 10, border: '1px solid rgba(56,205,240,0.14)',
          display: 'flex', flexDirection: 'column',
          transition: 'width 0.20s ease', overflow: 'hidden',
        }}>
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
          {!logCollapsed && (
            <div ref={logRef} style={{ overflowY: 'auto', padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: 4, flex: 1 }}>
              {log.map(e => (
                <div key={e.id} style={{
                  fontSize: 10, color: LOG_C[e.type] ?? 'rgba(200,225,255,0.75)',
                  fontFamily: 'var(--font-data)', letterSpacing: '0.03em', lineHeight: 1.45,
                  borderLeft: e.type === 'system' ? '2px solid #38cdf0' : 'none',
                  paddingLeft: e.type === 'system' ? 6 : 0,
                  animation: 'nx-fade-up 0.2s ease both',
                }}>{e.text}</div>
              ))}
              {npcBusy && (
                <div style={{ display: 'flex', gap: 4, alignItems: 'center', marginTop: 3 }}>
                  <span style={{ fontSize: 9, color: '#ff9999', fontFamily: 'var(--font-data)' }}>{npc.nombre}…</span>
                  {[0, 1, 2].map(i => <div key={i} style={{ width: 3, height: 3, borderRadius: '50%', background: '#ff9999', animation: `nx-pulse 0.8s ${i * 0.2}s infinite` }} />)}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Barra de acciones */}
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 10,
          background: 'rgba(3,7,16,0.96)', backdropFilter: 'blur(16px)',
          borderTop: '1px solid rgba(56,205,240,0.13)',
          padding: '6px 12px 8px', display: 'flex', flexDirection: 'column', gap: 5,
          minHeight: 90,
        }}>
          {phase === 'initiative' && (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ color: 'rgba(150,200,255,0.4)', fontSize: 11, fontFamily: 'var(--font-data)', letterSpacing: '0.15em' }}>CALCULANDO INICIATIVA…</span>
            </div>
          )}
          {phase === 'victory' && (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 20 }}>
              <span style={{ fontSize: 16, color: '#10b981', fontFamily: 'var(--font-data)', letterSpacing: '0.14em' }}>⚡ VICTORIA</span>
              <button onClick={() => { localStorage.removeItem(NPC_COMBAT_LS); onVictory?.(); }} style={{ padding: '8px 22px', borderRadius: 7, cursor: 'pointer', background: 'rgba(16,185,129,0.18)', border: '1px solid rgba(16,185,129,0.5)', color: '#10b981', fontFamily: 'var(--font-data)', fontSize: 10, letterSpacing: '0.14em' }}>CONTINUAR →</button>
            </div>
          )}
          {phase === 'defeat' && (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 20 }}>
              <span style={{ fontSize: 16, color: '#ff6b6b', fontFamily: 'var(--font-data)', letterSpacing: '0.14em' }}>☠ DERROTA</span>
              <button onClick={() => { localStorage.removeItem(NPC_COMBAT_LS); onDefeat?.(); }} style={{ padding: '8px 22px', borderRadius: 7, cursor: 'pointer', background: 'rgba(255,45,69,0.14)', border: '1px solid rgba(255,45,69,0.45)', color: '#ff6b6b', fontFamily: 'var(--font-data)', fontSize: 10, letterSpacing: '0.14em' }}>RETIRARSE</button>
            </div>
          )}
          {phase === 'battle' && (
            <>
              {/* Barra de Fuerza */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 8, color: '#38cdf0', fontFamily: 'var(--font-data)', letterSpacing: '0.12em', flexShrink: 0 }}>FUERZA</span>
                <div style={{ display: 'flex', gap: 2, flex: 1 }}>
                  {Array.from({ length: 10 }, (_, i) => (
                    <div key={i} style={{
                      flex: 1, height: 6, borderRadius: 2,
                      background: i < playerFuerza ? '#38cdf0' : 'rgba(56,205,240,0.12)',
                      transition: 'background 0.2s ease',
                    }} />
                  ))}
                </div>
                <span style={{ fontSize: 8, color: '#38cdf0', fontFamily: 'var(--font-data)', flexShrink: 0 }}>{playerFuerza}/10</span>
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
                        onMouseEnter={e => { if (!disabled) { e.currentTarget.style.background = 'rgba(56,205,240,0.16)'; e.currentTarget.style.borderColor = 'rgba(56,205,240,0.48)'; } }}
                        onMouseLeave={e => { e.currentTarget.style.background = disabled ? 'rgba(56,205,240,0.03)' : 'rgba(56,205,240,0.08)'; e.currentTarget.style.borderColor = disabled ? 'rgba(56,205,240,0.09)' : 'rgba(56,205,240,0.26)'; }}
                      >
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

                <div style={{ width: 1, background: 'rgba(255,255,255,0.08)', flexShrink: 0, alignSelf: 'stretch', margin: '2px 0' }} />

                <ActionBtn onClick={() => { localStorage.removeItem(NPC_COMBAT_LS); setPhase('fled'); onFlee?.(); }}
                  bg="rgba(255,45,69,0.07)" border="rgba(255,45,69,0.22)"
                  hoverBg="rgba(255,45,69,0.18)" hoverBorder="rgba(255,45,69,0.5)" minW={50}
                >
                  <span style={{ fontSize: 18, lineHeight: 1 }}>🏃</span>
                  <span style={{ fontSize: 8, color: '#ff6b6b', fontFamily: 'var(--font-data)' }}>HUIR</span>
                </ActionBtn>
              </div>
            </>
          )}
        </div>

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
                        type: 'info', id: prev.length,
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
    </div>
  );

  const container = document.getElementById('nx-content') ?? document.body;
  return createPortal(screen, container);
}
