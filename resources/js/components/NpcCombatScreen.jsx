import { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from './ui.jsx';

const mediaUrl = (path) => {
  if (!path) return null;
  if (/^(https?:)?\/\//.test(path) || path.startsWith('data:') || path.startsWith('blob:')) return path;
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  if (cleanPath.startsWith('/storage/')) return cleanPath;
  if (cleanPath.startsWith('/admin/')) return `/storage${cleanPath}`;
  if (cleanPath.startsWith('/public/')) return cleanPath.replace('/public/', '/storage/');
  return `/storage${cleanPath}`;
};

export default function NpcCombatScreen({ npc, player, lugarImagen, onVictory, onDefeat, onFlee }) {
  const d6 = () => Math.floor(Math.random() * 6) + 1;

  const maxPlayer = { vida: player.vida, escudo: player.escudo };
  const maxNpc    = { vida: Math.max(npc.vida, 1), escudo: npc.escudo ?? 0 };

  const npcAtk = Math.max(npc.ataque,     1);
  const npcDef = Math.max(npc.defensa,    1);
  const npcMov = Math.max(npc.movimiento, 1);
  const npcIni = Math.max(npc.iniciativa, 1);
  const npcPnt = npc.punteria ?? 0;

  const [playerHp,     setPlayerHp]     = useState({ vida: maxPlayer.vida, escudo: maxPlayer.escudo });
  const [npcHp,        setNpcHp]        = useState({ vida: maxNpc.vida,    escudo: maxNpc.escudo    });
  const [phase,        setPhase]        = useState('initiative');
  const [currTurn,     setCurrTurn]     = useState(null);
  const [log,          setLog]          = useState([]);
  const [npcBusy,      setNpcBusy]      = useState(false);
  const [logCollapsed, setLogCollapsed] = useState(false);
  const [defBonus,     setDefBonus]     = useState(0);
  const [bgImg,        setBgImg]        = useState(lugarImagen ?? null);
  const logRef = useRef(null);

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

  /* Iniciativa */
  useEffect(() => {
    const pR = d6(); const nR = d6();
    const pT = pR + player.iniciativa; const nT = nR + npcIni;
    const first = pT >= nT ? 'player' : 'npc';
    setTimeout(() => {
      setLog([
        { text: '⚔ ¡COMBATE INICIADO!', type: 'system', id: 0 },
        { text: `Iniciativa — Tú: 1d6(${pR})+${player.iniciativa}=${pT} | ${npc.nombre}: 1d6(${nR})+${npcIni}=${nT}`, type: 'info', id: 1 },
        { text: first === 'player' ? '¡Atacas primero!' : `¡${npc.nombre} actúa primero!`, type: first === 'player' ? 'success' : 'danger', id: 2 },
      ]);
      setPhase('battle');
      setCurrTurn(first);
    }, 500);
  }, []);

  /* Turno del NPC */
  useEffect(() => {
    if (currTurn !== 'npc' || phase !== 'battle') return;
    setNpcBusy(true);
    const t = setTimeout(() => {
      const useRanged = npcPnt > 0 && Math.random() > 0.5;
      let entries = [];
      let newHp;
      const curDef = player.defensa + defBonus;
      if (useRanged) {
        const [aR, dR] = [d6(), d6()];
        const [aT, dT] = [aR + npcPnt, dR + player.movimiento];
        entries = [
          { text: `${npc.nombre} dispara: 1d6(${aR})+${npcPnt}=${aT}`, type: 'info' },
          { text: `Esquivas: 1d6(${dR})+${player.movimiento}=${dT}`, type: 'info' },
        ];
        newHp = aT > dT ? applyDmg(npcAtk, playerHp) : { ...playerHp };
        entries.push(aT > dT ? { text: `¡Te impactan! −${npcAtk} daño`, type: 'danger' } : { text: '¡Esquivas!', type: 'success' });
      } else {
        const [aR, dR] = [d6(), d6()];
        const [aT, dT] = [aR + npcAtk, dR + curDef];
        entries = [
          { text: `${npc.nombre} ataca: 1d6(${aR})+${npcAtk}=${aT}`, type: 'info' },
          { text: `Defiendes: 1d6(${dR})+${curDef}=${dT}${defBonus > 0 ? ` (+${defBonus} postura)` : ''}`, type: 'info' },
        ];
        newHp = aT > dT ? applyDmg(npcAtk, playerHp) : { ...playerHp };
        entries.push(aT > dT ? { text: `¡Golpe! −${npcAtk} daño`, type: 'danger' } : { text: 'Bloqueas el ataque', type: 'success' });
      }
      setDefBonus(0);
      setLog(prev => [...prev, ...entries.map((e, i) => ({ ...e, id: prev.length + i }))]);
      setPlayerHp(newHp);
      setNpcBusy(false);
      if (newHp.vida <= 0) {
        setLog(prev => [...prev, { text: '☠ Has sido derrotado.', type: 'danger', id: prev.length }]);
        setPhase('defeat');
      } else {
        setCurrTurn('player');
      }
    }, 1500);
    return () => clearTimeout(t);
  }, [currTurn, phase, defBonus]);

  useEffect(() => { if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight; }, [log]);

  const doPlayerAttack = (label, atkVal, defVal, dmg) => {
    const [aR, dR] = [d6(), d6()];
    const [aT, dT] = [aR + atkVal, dR + defVal];
    const hit = aT > dT;
    const newNpcHp = hit ? applyDmg(dmg, npcHp) : { ...npcHp };
    const entries = [
      { text: `${label}: 1d6(${aR})+${atkVal}=${aT} vs 1d6(${dR})+${defVal}=${dT}`, type: 'info' },
      hit ? { text: `¡Impacto! −${dmg} daño`, type: 'success' } : { text: 'Bloqueado / Falla', type: 'miss' },
    ];
    setLog(prev => [...prev, ...entries.map((e, i) => ({ ...e, id: prev.length + i }))]);
    setNpcHp(newNpcHp);
    if (newNpcHp.vida <= 0) {
      setLog(prev => [...prev, { text: `⚡ ¡${npc.nombre} derrotado!`, type: 'success', id: prev.length }]);
      setPhase('victory');
    } else {
      setCurrTurn('npc');
    }
  };

  const isPlayerTurn = currTurn === 'player' && phase === 'battle' && !npcBusy;

  const SKILLS = useMemo(() => [
    { id: 'melee',   icon: '⚔', name: 'Melee',        desc: `ATQ ${player.ataque}`,    fn: () => doPlayerAttack('Melee',       player.ataque,   npcDef, player.ataque) },
    { id: 'ranged',  icon: '◎', name: 'Distancia',     desc: `PNT ${player.punteria}`,  fn: () => doPlayerAttack('Distancia',   player.punteria, npcMov, player.ataque), disabled: player.punteria <= 0 },
    { id: 'postura', icon: '🛡', name: 'Postura',       desc: '+4 DEF 1 turno',         fn: () => { setDefBonus(4); setLog(prev => [...prev, { text: 'Postura defensiva — +4 DEF este turno', type: 'info', id: prev.length }]); setCurrTurn('npc'); } },
    { id: 'potente', icon: '⚡', name: 'Golpe Potente', desc: `ATQ ×1.5`,               fn: () => doPlayerAttack('Golpe potente', player.ataque, npcDef, Math.ceil(player.ataque * 1.5)) },
  ], [isPlayerTurn, npcHp, playerHp, defBonus]);

  const pct  = (v, m) => m > 0 ? Math.max(0, Math.min(100, (v / m) * 100)) : 0;
  const vcol = (p) => p > 50 ? '#10b981' : p > 25 ? '#E6B325' : '#ff2d45';
  const LOG_C = { info: 'rgba(200,225,255,0.78)', success: '#10b981', danger: '#ff6b6b', miss: 'rgba(150,180,220,0.5)', system: '#38cdf0' };

  const npcBadges = [
    { l: 'ATQ', v: npcAtk, c: '#ff7043' }, { l: 'DEF', v: npcDef, c: '#38cdf0' },
    { l: 'MOV', v: npcMov, c: '#a78bfa' }, { l: 'INI', v: npcIni, c: '#E6B325' },
    ...(npcPnt > 0 ? [{ l: 'PNT', v: npcPnt, c: '#10b981' }] : []),
  ];
  const playerBadges = [
    { l: 'ATQ', v: player.ataque,              c: '#ff7043' },
    { l: 'DEF', v: player.defensa + defBonus,  c: '#38cdf0', bonus: defBonus > 0 },
    { l: 'MOV', v: player.movimiento,          c: '#a78bfa' },
    { l: 'INI', v: player.iniciativa,          c: '#E6B325' },
    ...(player.punteria > 0 ? [{ l: 'PNT', v: player.punteria, c: '#10b981' }] : []),
  ];

  const HUD = ({ hp, maxHp, escudo, maxEscudo, photoUrl, nombre, borderColor, badges, align }) => {
    const vPct = pct(hp, maxHp);
    const ePct = pct(escudo, maxEscudo);
    const vc   = vcol(vPct);
    const rev  = align === 'right';
    return (
      <div style={{
        background: 'rgba(6,12,26,0.92)', backdropFilter: 'blur(16px)',
        border: `1px solid ${borderColor}`, borderRadius: 14,
        padding: 14, display: 'flex', flexDirection: rev ? 'row-reverse' : 'row',
        gap: 14, alignItems: 'flex-start', minWidth: 260,
      }}>
        <div style={{
          width: 64, height: 64, borderRadius: 10, flexShrink: 0, overflow: 'hidden',
          border: `2px solid ${borderColor}`, background: 'rgba(255,255,255,0.06)', display: 'grid', placeItems: 'center',
        }}>
          {photoUrl
            ? <img src={photoUrl} alt={nombre} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            : <Icon name="user" size={26} style={{ color: 'var(--holo)', opacity: 0.5 }} />
          }
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#fff', marginBottom: 8, textAlign: rev ? 'right' : 'left', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{nombre}</div>
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
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', justifyContent: rev ? 'flex-end' : 'flex-start' }}>
            {badges.map(b => (
              <span key={b.l} style={{
                fontSize: 9, fontFamily: 'var(--font-data)', padding: '2px 6px', borderRadius: 4,
                background: `${b.c}14`, border: `1px solid ${b.c}45`, color: b.c,
                ...(b.bonus ? { boxShadow: `0 0 8px ${b.c}55`, fontWeight: 700 } : {}),
              }}>{b.l} {b.v}{b.bonus ? ' ▲' : ''}</span>
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
        <div style={{ position: 'absolute', top: 14, right: 14, zIndex: 10, width: 'clamp(190px, 36%, 260px)' }}>
          <HUD
            hp={npcHp.vida} maxHp={maxNpc.vida} escudo={npcHp.escudo} maxEscudo={maxNpc.escudo}
            nombre={npc.nombre} photoUrl={mediaUrl(npc.imagen_mini) || mediaUrl(npc.imagen)}
            borderColor="rgba(255,45,69,0.40)" badges={npcBadges} align="left"
          />
        </div>

        {/* Jugador HUD — abajo izquierda */}
        <div style={{ position: 'absolute', bottom: 82, left: 14, zIndex: 10, width: 'clamp(190px, 36%, 260px)' }}>
          <HUD
            hp={playerHp.vida} maxHp={maxPlayer.vida} escudo={playerHp.escudo} maxEscudo={maxPlayer.escudo}
            nombre={player.nombre} photoUrl={player.photo}
            borderColor="rgba(56,205,240,0.30)" badges={playerBadges} align="right"
          />
        </div>

        {/* Log de combate — izquierda, colapsable */}
        <div style={{
          position: 'absolute', left: 14, top: 14, zIndex: 10,
          width: logCollapsed ? 40 : 'clamp(150px, 26%, 240px)',
          maxHeight: 'calc(100% - 250px)',
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
                REGISTRO
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
                  {[0,1,2].map(i => <div key={i} style={{ width: 3, height: 3, borderRadius: '50%', background: '#ff9999', animation: `nx-pulse 0.8s ${i*0.2}s infinite` }} />)}
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
          padding: '8px 12px', display: 'flex', gap: 6, alignItems: 'stretch',
          minHeight: 76,
        }}>
          {phase === 'initiative' && (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ color: 'rgba(150,200,255,0.4)', fontSize: 11, fontFamily: 'var(--font-data)', letterSpacing: '0.15em' }}>CALCULANDO INICIATIVA…</span>
            </div>
          )}
          {phase === 'victory' && (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 20 }}>
              <span style={{ fontSize: 16, color: '#10b981', fontFamily: 'var(--font-data)', letterSpacing: '0.14em' }}>⚡ VICTORIA</span>
              <button onClick={onVictory} style={{ padding: '8px 22px', borderRadius: 7, cursor: 'pointer', background: 'rgba(16,185,129,0.18)', border: '1px solid rgba(16,185,129,0.5)', color: '#10b981', fontFamily: 'var(--font-data)', fontSize: 10, letterSpacing: '0.14em' }}>CONTINUAR →</button>
            </div>
          )}
          {phase === 'defeat' && (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 20 }}>
              <span style={{ fontSize: 16, color: '#ff6b6b', fontFamily: 'var(--font-data)', letterSpacing: '0.14em' }}>☠ DERROTA</span>
              <button onClick={onDefeat} style={{ padding: '8px 22px', borderRadius: 7, cursor: 'pointer', background: 'rgba(255,45,69,0.14)', border: '1px solid rgba(255,45,69,0.45)', color: '#ff6b6b', fontFamily: 'var(--font-data)', fontSize: 10, letterSpacing: '0.14em' }}>RETIRARSE</button>
            </div>
          )}
          {phase === 'battle' && (
            <>
              {SKILLS.map(sk => {
                const active = isPlayerTurn && !sk.disabled;
                return (
                  <button key={sk.id} onClick={() => active && sk.fn()} disabled={!active} style={{
                    flex: 1, minWidth: 0, borderRadius: 8, cursor: active ? 'pointer' : 'not-allowed',
                    background: active ? 'rgba(56,205,240,0.08)' : 'rgba(56,205,240,0.03)',
                    border: `1px solid ${active ? 'rgba(56,205,240,0.26)' : 'rgba(56,205,240,0.09)'}`,
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                    gap: 3, padding: '6px 4px', opacity: active ? 1 : 0.36, transition: 'all 0.13s',
                  }}
                    onMouseEnter={e => { if (active) { e.currentTarget.style.background = 'rgba(56,205,240,0.16)'; e.currentTarget.style.borderColor = 'rgba(56,205,240,0.48)'; e.currentTarget.style.boxShadow = '0 0 14px -5px rgba(56,205,240,0.4)'; } }}
                    onMouseLeave={e => { e.currentTarget.style.background = active ? 'rgba(56,205,240,0.08)' : 'rgba(56,205,240,0.03)'; e.currentTarget.style.borderColor = active ? 'rgba(56,205,240,0.26)' : 'rgba(56,205,240,0.09)'; e.currentTarget.style.boxShadow = 'none'; }}
                  >
                    <span style={{ fontSize: 18, lineHeight: 1 }}>{sk.icon}</span>
                    <span style={{ fontSize: 9, color: 'var(--txt)', fontFamily: 'var(--font-data)', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>{sk.name}</span>
                    <span style={{ fontSize: 7, color: 'var(--txt-faint)', fontFamily: 'var(--font-data)' }}>{sk.desc}</span>
                  </button>
                );
              })}

              <div style={{ width: 1, background: 'rgba(255,255,255,0.08)', flexShrink: 0, alignSelf: 'stretch', margin: '4px 0' }} />

              <ActionBtn disabled bg="rgba(255,255,255,0.04)" border="rgba(255,255,255,0.09)" hoverBg="" hoverBorder="" minW={52}>
                <span style={{ fontSize: 18, lineHeight: 1 }}>🎒</span>
                <span style={{ fontSize: 8, color: 'var(--txt-dim)', fontFamily: 'var(--font-data)' }}>ÍTEM</span>
              </ActionBtn>

              <ActionBtn onClick={() => doPlayerAttack('Desarmado', 2, npcDef, 3)} disabled={!isPlayerTurn}
                bg={isPlayerTurn ? 'rgba(230,179,37,0.08)' : 'rgba(230,179,37,0.03)'}
                border={isPlayerTurn ? 'rgba(230,179,37,0.28)' : 'rgba(230,179,37,0.09)'}
                hoverBg="rgba(230,179,37,0.18)" hoverBorder="rgba(230,179,37,0.5)" minW={60}
              >
                <span style={{ fontSize: 18, lineHeight: 1 }}>👊</span>
                <span style={{ fontSize: 8, color: '#E6B325', fontFamily: 'var(--font-data)', opacity: isPlayerTurn ? 1 : 0.5 }}>DESARMADO</span>
              </ActionBtn>

              <ActionBtn onClick={() => { setPhase('fled'); onFlee?.(); }}
                bg="rgba(255,45,69,0.07)" border="rgba(255,45,69,0.22)"
                hoverBg="rgba(255,45,69,0.18)" hoverBorder="rgba(255,45,69,0.5)" minW={50}
              >
                <span style={{ fontSize: 18, lineHeight: 1 }}>🏃</span>
                <span style={{ fontSize: 8, color: '#ff6b6b', fontFamily: 'var(--font-data)' }}>HUIR</span>
              </ActionBtn>
            </>
          )}
        </div>
      </div>
    </div>
  );

  const container = document.getElementById('nx-content') ?? document.body;
  return createPortal(screen, container);
}
