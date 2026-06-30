import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from './ui.jsx';

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

export default function PvpCombatScreen({ combat: initialCombat, userId, onClose, lugarImagen }) {
  const [combat, setCombat]             = useState(initialCombat);
  const [busy, setBusy]                 = useState(false);
  const [logCollapsed, setLogCollapsed] = useState(false);
  const [bgImg, setBgImg]               = useState(lugarImagen ?? null);
  const pollRef                         = useRef(null);
  const logRef                          = useRef(null);

  const me  = combat.i_am_attacker ? combat.attacker : combat.defender;
  const opp = combat.i_am_attacker ? combat.defender : combat.attacker;
  const myHp        = combat.i_am_attacker ? combat.attacker_hp        : combat.defender_hp;
  const myEscudo    = combat.i_am_attacker ? combat.attacker_escudo    : combat.defender_escudo;
  const myDefBonus  = combat.i_am_attacker ? combat.attacker_def_bonus : combat.defender_def_bonus;
  const oppHp       = combat.i_am_attacker ? combat.defender_hp        : combat.attacker_hp;
  const oppEscudo   = combat.i_am_attacker ? combat.defender_escudo    : combat.attacker_escudo;
  const oppDefBonus = combat.i_am_attacker ? combat.defender_def_bonus : combat.attacker_def_bonus;

  /* fondo: si no vino del padre, busca via API lugar → zona → planeta → sistema */
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

  /* polling cuando no es mi turno */
  useEffect(() => {
    clearInterval(pollRef.current);
    if (combat.status !== 'active' || combat.is_my_turn) return;
    pollRef.current = setInterval(() => {
      apiFetch(`/pvp/${combat.id}`)
        .then(d => { if (d?.combat) setCombat(d.combat); })
        .catch(() => {});
    }, 4000);
    return () => clearInterval(pollRef.current);
  }, [combat.is_my_turn, combat.status, combat.id]);

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [combat.log]);

  const doAction = async (skill) => {
    if (busy || !combat.is_my_turn || combat.status !== 'active') return;
    setBusy(true);
    try {
      const d = await apiPost(`/pvp/${combat.id}/action`, { skill });
      if (d?.combat) setCombat(d.combat);
    } catch { /* toast shown by apiPost */ }
    finally { setBusy(false); }
  };

  const isOver = combat.status !== 'active';
  const iWon   = (combat.status === 'attacker_won' &&  combat.i_am_attacker)
              || (combat.status === 'defender_won' && !combat.i_am_attacker);
  const iFled  = (combat.status === 'fled_attacker' &&  combat.i_am_attacker)
              || (combat.status === 'fled_defender' && !combat.i_am_attacker);

  const pct  = (v, m) => m > 0 ? Math.max(0, Math.min(100, (v / m) * 100)) : 0;
  const vcol = (p) => p > 50 ? '#10b981' : p > 25 ? '#E6B325' : '#ff2d45';

  const myBadges = [
    { l: 'ATQ', v: me.stats.ataque,                    c: '#ff7043' },
    { l: 'DEF', v: me.stats.defensa + (myDefBonus||0), c: '#38cdf0', bonus: myDefBonus > 0 },
    { l: 'PNT', v: me.stats.punteria,                  c: '#10b981' },
    { l: 'INI', v: me.stats.iniciativa,                c: '#E6B325' },
  ];
  const oppBadges = [
    { l: 'ATQ', v: opp.stats.ataque,                     c: '#ff7043' },
    { l: 'DEF', v: opp.stats.defensa + (oppDefBonus||0), c: '#38cdf0', bonus: oppDefBonus > 0 },
    { l: 'PNT', v: opp.stats.punteria,                   c: '#10b981' },
    { l: 'INI', v: opp.stats.iniciativa,                 c: '#E6B325' },
  ];

  const HUD = ({ hp, maxHp, escudo, maxEscudo, photoUrl, nombre, handle, borderColor, badges, align }) => {
    const vPct = pct(hp, maxHp);
    const ePct = pct(escudo, maxEscudo);
    const vc   = vcol(vPct);
    const rev  = align === 'right';
    return (
      <div style={{
        background: 'rgba(6,12,26,0.92)', backdropFilter: 'blur(16px)',
        border: `1px solid ${borderColor}`, borderRadius: 14,
        padding: 14, display: 'flex', flexDirection: rev ? 'row-reverse' : 'row',
        gap: 14, alignItems: 'flex-start',
      }}>
        <div style={{
          width: 64, height: 64, borderRadius: 10, flexShrink: 0, overflow: 'hidden',
          border: `2px solid ${borderColor}`, background: 'rgba(255,255,255,0.06)',
          display: 'grid', placeItems: 'center',
        }}>
          {photoUrl
            ? <img src={photoUrl} alt={nombre} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            : <Icon name="user" size={26} style={{ color: 'var(--holo)', opacity: 0.5 }} />
          }
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#fff', marginBottom: 2, textAlign: rev ? 'right' : 'left', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{nombre}</div>
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

  const SKILLS = [
    { id: 'melee',     icon: '⚔', name: 'Melee',        desc: `ATQ ${me.stats?.ataque ?? 0}` },
    { id: 'distancia', icon: '◎', name: 'Distancia',     desc: `PNT ${me.stats?.punteria ?? 0}` },
    { id: 'postura',   icon: '🛡', name: 'Postura',       desc: '+4 DEF 1 turno' },
    { id: 'potente',   icon: '⚡', name: 'Golpe Potente', desc: 'ATQ ×1.5' },
  ];

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
        borderRadius: 18, overflow: 'hidden',
        boxShadow: '0 0 80px rgba(0,0,0,0.9), 0 0 0 1px rgba(56,205,240,0.18)',
      }}>
        {/* Fondo: imagen del lugar vía <img> */}
        {bgImg
          ? <img src={bgImg} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center' }} />
          : <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at 50% 30%, #0c1e42, #020810)' }} />
        }
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(2,6,16,0.72)' }} />

        {/* Contenido sobre el fondo */}
        <div style={{ position: 'relative', width: '100%', height: '100%' }}>

        {/* Oponente HUD — arriba derecha */}
        <div style={{ position: 'absolute', top: 14, right: 14, zIndex: 10, width: 'clamp(200px, 36%, 320px)' }}>
          <HUD
            hp={oppHp} maxHp={opp.stats.vida} escudo={oppEscudo} maxEscudo={opp.stats.escudo}
            nombre={opp.name} handle={opp.handle} photoUrl={opp.photo_url}
            borderColor="rgba(255,45,69,0.40)" badges={oppBadges} align="left"
          />
        </div>

        {/* Mi HUD — abajo izquierda, sobre la action bar */}
        <div style={{ position: 'absolute', bottom: 90, left: 14, zIndex: 10, width: 'clamp(200px, 36%, 320px)' }}>
          <HUD
            hp={myHp} maxHp={me.stats.vida} escudo={myEscudo} maxEscudo={me.stats.escudo}
            nombre={me.name} handle={me.handle} photoUrl={me.photo_url}
            borderColor="rgba(56,205,240,0.30)" badges={myBadges} align="right"
          />
        </div>

        {/* Log de combate — izquierda, colapsable */}
        <div style={{
          position: 'absolute', left: 14, top: 14, zIndex: 10,
          width: logCollapsed ? 40 : 'clamp(160px, 26%, 280px)',
          maxHeight: 'calc(100% - 260px)',
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
              <span style={{ fontSize: 7, color: 'rgba(150,200,255,0.5)', fontFamily: 'var(--font-data)', letterSpacing: '0.16em', flex: 1, whiteSpace: 'nowrap' }}>REGISTRO</span>
            )}
            <span style={{ fontSize: 11, color: 'rgba(150,200,255,0.4)', flexShrink: 0 }}>{logCollapsed ? '›' : '‹'}</span>
          </div>
          {!logCollapsed && (
            <div ref={logRef} style={{ overflowY: 'auto', padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: 4, flex: 1 }}>
              {(combat.log ?? []).map((entry, i) =>
                (entry.messages ?? []).map((m, j) => (
                  <div key={`${i}-${j}`} style={{
                    fontSize: 10, color: 'rgba(200,225,255,0.78)',
                    fontFamily: 'var(--font-data)', letterSpacing: '0.03em', lineHeight: 1.45,
                    animation: 'nx-fade-up 0.2s ease both',
                  }}>{m}</div>
                ))
              )}
              {!combat.is_my_turn && combat.status === 'active' && (
                <div style={{ display: 'flex', gap: 4, alignItems: 'center', marginTop: 3 }}>
                  <span style={{ fontSize: 9, color: '#ff9999', fontFamily: 'var(--font-data)' }}>{opp.name}…</span>
                  {[0,1,2].map(i => <div key={i} style={{ width: 3, height: 3, borderRadius: '50%', background: '#ff9999', animation: `nx-pulse 0.8s ${i*0.2}s infinite` }} />)}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Barra de acciones — fija al fondo */}
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 10,
          background: 'rgba(3,7,16,0.96)', backdropFilter: 'blur(16px)',
          borderTop: '1px solid rgba(56,205,240,0.13)',
          padding: '8px 16px', display: 'flex', gap: 8, alignItems: 'stretch',
          minHeight: 82,
        }}>
          {isOver ? (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 20 }}>
              {iWon ? (
                <>
                  <span style={{ fontSize: 16, color: '#10b981', fontFamily: 'var(--font-data)', letterSpacing: '0.14em' }}>⚡ VICTORIA</span>
                  <button onClick={() => onClose({ won: true })} style={{ padding: '8px 28px', borderRadius: 7, cursor: 'pointer', background: 'rgba(16,185,129,0.18)', border: '1px solid rgba(16,185,129,0.5)', color: '#10b981', fontFamily: 'var(--font-data)', fontSize: 10, letterSpacing: '0.14em' }}>CONTINUAR →</button>
                </>
              ) : iFled ? (
                <>
                  <span style={{ fontSize: 16, color: 'var(--txt-dim)', fontFamily: 'var(--font-data)', letterSpacing: '0.14em' }}>🏃 HUISTE</span>
                  <button onClick={() => onClose({ fled: true })} style={{ padding: '8px 28px', borderRadius: 7, cursor: 'pointer', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.2)', color: 'var(--txt-dim)', fontFamily: 'var(--font-data)', fontSize: 10, letterSpacing: '0.14em' }}>RETIRARSE</button>
                </>
              ) : (
                <>
                  <span style={{ fontSize: 16, color: '#ff6b6b', fontFamily: 'var(--font-data)', letterSpacing: '0.14em' }}>☠ DERROTA</span>
                  <button onClick={() => onClose({ won: false })} style={{ padding: '8px 28px', borderRadius: 7, cursor: 'pointer', background: 'rgba(255,45,69,0.14)', border: '1px solid rgba(255,45,69,0.45)', color: '#ff6b6b', fontFamily: 'var(--font-data)', fontSize: 10, letterSpacing: '0.14em' }}>RETIRARSE</button>
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
              {SKILLS.map(sk => {
                const active = !busy;
                return (
                  <button key={sk.id} onClick={() => active && doAction(sk.id)} disabled={!active} style={{
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
              <button onClick={() => doAction('flee')} disabled={busy} style={{
                minWidth: 56, borderRadius: 8, cursor: busy ? 'not-allowed' : 'pointer',
                background: 'rgba(255,45,69,0.07)', border: '1px solid rgba(255,45,69,0.22)',
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                gap: 3, padding: '6px 8px', opacity: busy ? 0.35 : 1, transition: 'all 0.14s', flexShrink: 0,
              }}
                onMouseEnter={e => { if (!busy) { e.currentTarget.style.background = 'rgba(255,45,69,0.18)'; e.currentTarget.style.borderColor = 'rgba(255,45,69,0.5)'; } }}
                onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,45,69,0.07)'; e.currentTarget.style.borderColor = 'rgba(255,45,69,0.22)'; }}
              >
                <span style={{ fontSize: 18, lineHeight: 1 }}>🏃</span>
                <span style={{ fontSize: 8, color: '#ff6b6b', fontFamily: 'var(--font-data)' }}>HUIR</span>
              </button>
            </>
          )}
        </div>
        </div>
      </div>
    </div>
  );

  const container = document.getElementById('nx-content') ?? document.body;
  return createPortal(screen, container);
}
