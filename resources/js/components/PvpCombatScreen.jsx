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

  const myFuerza   = combat.my_fuerza    ?? 0;
  const myCooldowns = combat.my_cooldowns ?? {};
  const myBuffs    = combat.my_buffs     ?? [];
  const myDebuffs  = combat.my_debuffs   ?? [];
  const oppDebuffs = combat.opp_debuffs  ?? [];
  const oppBuffs   = combat.opp_buffs    ?? [];
  const myLastForma  = combat.my_last_forma  ?? 0;
  const oppLastForma = combat.opp_last_forma ?? 0;

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
        .then(d => { if (d?.combat) setCombat(d.combat); })
        .catch(() => {});
    }, 4000);
    return () => clearInterval(pollRef.current);
  }, [combat.is_my_turn, combat.status, combat.id]);

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [combat.log]);

  const doAction = async (skillId) => {
    if (busy || !combat.is_my_turn || combat.status !== 'active') return;
    setBusy(true);
    try {
      const d = await apiPost(`/pvp/${combat.id}/action`, { skill: String(skillId) });
      if (d?.combat) setCombat(d.combat);
    } catch { /* toast shown by apiPost */ }
    finally { setBusy(false); }
  };

  const isPending  = combat.status === 'pending';
  const isDeclined = combat.status === 'declined';
  const isOver = combat.status !== 'active' && !isPending;
  const iWon   = (combat.status === 'attacker_won'  &&  combat.i_am_attacker)
              || (combat.status === 'defender_won'  && !combat.i_am_attacker)
              || (combat.status === 'fled_attacker' && !combat.i_am_attacker)
              || (combat.status === 'fled_defender' &&  combat.i_am_attacker);
  const iFled  = (combat.status === 'fled_attacker' &&  combat.i_am_attacker)
              || (combat.status === 'fled_defender' && !combat.i_am_attacker);

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
    { l: 'INI', v: me.stats?.iniciativa ?? 0, c: '#E6B325' },
  ];
  const oppBadges = [
    { l: 'ATQ', v: effOppStat('ataque'),   c: '#ff7043', dim: countBuff(oppDebuffs, 'ataque')   > 0 },
    { l: 'DEF', v: effOppStat('defensa') + (oppDefBonus || 0), c: '#38cdf0', dim: countBuff(oppDebuffs, 'defensa') > 0 },
    { l: 'PNT', v: effOppStat('punteria'), c: '#10b981', dim: countBuff(oppDebuffs, 'punteria') > 0 },
    { l: 'INI', v: opp.stats?.iniciativa ?? 0, c: '#E6B325' },
    ...(oppLastForma > 0 ? [{ l: `F${formaLabel(oppLastForma)}`, v: null, c: 'rgba(200,200,255,0.5)' }] : []),
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
                opacity: b.dim ? 0.55 : 1,
                ...(b.bonus ? { boxShadow: `0 0 8px ${b.c}55`, fontWeight: 700 } : {}),
              }}>{b.l}{b.v !== null ? ` ${b.v}` : ''}{b.bonus ? ' ▲' : b.dim ? ' ▼' : ''}</span>
            ))}
          </div>
        </div>
      </div>
    );
  };

  const myHabilidades = me.habilidades ?? [];

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
        {bgImg
          ? <img src={bgImg} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center' }} />
          : <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at 50% 30%, #0c1e42, #020810)' }} />
        }
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(2,6,16,0.72)' }} />

        <div style={{ position: 'relative', width: '100%', height: '100%' }}>

        {/* Oponente HUD — arriba derecha */}
        <div style={{ position: 'absolute', top: 14, right: 14, zIndex: 10, width: 'clamp(200px, 36%, 320px)' }}>
          <HUD
            hp={oppHp} maxHp={opp.stats.vida} escudo={oppEscudo} maxEscudo={opp.stats.escudo}
            nombre={opp.name} handle={opp.handle} photoUrl={opp.photo_url}
            borderColor="rgba(255,45,69,0.40)" badges={oppBadges} align="left"
          />
        </div>

        {/* Mi HUD — abajo izquierda */}
        <div style={{ position: 'absolute', bottom: 100, left: 14, zIndex: 10, width: 'clamp(200px, 36%, 320px)' }}>
          <HUD
            hp={myHp} maxHp={me.stats.vida} escudo={myEscudo} maxEscudo={me.stats.escudo}
            nombre={me.name} handle={me.handle} photoUrl={me.photo_url}
            borderColor="rgba(56,205,240,0.30)" badges={myBadges} align="right"
          />
        </div>

        {/* Log de combate */}
        <div style={{
          position: 'absolute', left: 14, top: 14, zIndex: 10,
          width: logCollapsed ? 40 : 'clamp(160px, 26%, 280px)',
          maxHeight: 'calc(100% - 270px)',
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
                  {[0, 1, 2].map(i => <div key={i} style={{ width: 3, height: 3, borderRadius: '50%', background: '#ff9999', animation: `nx-pulse 0.8s ${i * 0.2}s infinite` }} />)}
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
          padding: '6px 16px 8px', display: 'flex', flexDirection: 'column', gap: 5,
          minHeight: 92,
        }}>
          {isPending ? (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
              <span style={{ color: '#E6B325', fontSize: 12, fontFamily: 'var(--font-data)', letterSpacing: '0.15em' }}>
                ⚔ RETO ENVIADO
              </span>
              <span style={{ color: 'rgba(150,200,255,0.45)', fontSize: 10, fontFamily: 'var(--font-data)', letterSpacing: '0.12em', animation: 'nx-pulse 1.5s infinite' }}>
                ESPERANDO RESPUESTA DE {(opp.name ?? '').toUpperCase()}…
              </span>
            </div>
          ) : isOver ? (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 20 }}>
              {isDeclined ? (
                <>
                  <span style={{ fontSize: 16, color: '#E6B325', fontFamily: 'var(--font-data)', letterSpacing: '0.14em' }}>✗ RETO RECHAZADO</span>
                  <button onClick={() => onClose({})} style={{ padding: '8px 28px', borderRadius: 7, cursor: 'pointer', background: 'rgba(230,179,37,0.10)', border: '1px solid rgba(230,179,37,0.4)', color: '#E6B325', fontFamily: 'var(--font-data)', fontSize: 10, letterSpacing: '0.14em' }}>CERRAR</button>
                </>
              ) : iWon ? (
                <>
                  <span style={{ fontSize: 16, color: '#10b981', fontFamily: 'var(--font-data)', letterSpacing: '0.14em' }}>
                    {(combat.status === 'fled_attacker' || combat.status === 'fled_defender') ? '🏃 RIVAL HUYÓ — VICTORIA' : '⚡ VICTORIA'}
                  </span>
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
              {/* Barra de Fuerza */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 8, color: '#38cdf0', fontFamily: 'var(--font-data)', letterSpacing: '0.12em', flexShrink: 0 }}>FUERZA</span>
                <div style={{ display: 'flex', gap: 2, flex: 1 }}>
                  {Array.from({ length: 10 }, (_, i) => (
                    <div key={i} style={{
                      flex: 1, height: 6, borderRadius: 2,
                      background: i < myFuerza ? '#38cdf0' : 'rgba(56,205,240,0.12)',
                      transition: 'background 0.2s ease',
                    }} />
                  ))}
                </div>
                <span style={{ fontSize: 8, color: '#38cdf0', fontFamily: 'var(--font-data)', flexShrink: 0 }}>{myFuerza}/10</span>
              </div>

              {/* Botones de habilidades */}
              <div style={{ display: 'flex', gap: 6, alignItems: 'stretch', flex: 1 }}>
                {myHabilidades.length === 0 ? (
                  <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
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
                          flex: 1, minWidth: 0, borderRadius: 8,
                          cursor: disabled ? 'not-allowed' : 'pointer',
                          background: effective
                            ? 'rgba(16,185,129,0.12)'
                            : disabled ? 'rgba(56,205,240,0.03)' : 'rgba(56,205,240,0.08)',
                          border: `1px solid ${effective ? 'rgba(16,185,129,0.45)' : disabled ? 'rgba(56,205,240,0.09)' : 'rgba(56,205,240,0.26)'}`,
                          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                          gap: 2, padding: '4px 6px', opacity: disabled ? 0.45 : 1,
                          position: 'relative', transition: 'all 0.13s',
                        }}
                        onMouseEnter={e => { if (!disabled) { e.currentTarget.style.background = effective ? 'rgba(16,185,129,0.22)' : 'rgba(56,205,240,0.16)'; e.currentTarget.style.borderColor = effective ? 'rgba(16,185,129,0.7)' : 'rgba(56,205,240,0.48)'; } }}
                        onMouseLeave={e => { e.currentTarget.style.background = effective ? 'rgba(16,185,129,0.12)' : disabled ? 'rgba(56,205,240,0.03)' : 'rgba(56,205,240,0.08)'; e.currentTarget.style.borderColor = effective ? 'rgba(16,185,129,0.45)' : disabled ? 'rgba(56,205,240,0.09)' : 'rgba(56,205,240,0.26)'; }}
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
                        {/* Indicador de efectividad */}
                        {effective && (
                          <div style={{
                            position: 'absolute', top: 3, right: 4, fontSize: 8,
                            color: '#10b981', fontFamily: 'var(--font-data)', fontWeight: 700, zIndex: 1,
                          }}>EFF</div>
                        )}
                        <span style={{ fontSize: 14, lineHeight: 1 }}>{tipoIcon(hab.tipo)}</span>
                        <span style={{
                          fontSize: 8, color: 'var(--txt)', fontFamily: 'var(--font-data)', letterSpacing: '0.04em',
                          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%', textAlign: 'center',
                        }}>{hab.nombre}</span>
                        <div style={{ display: 'flex', gap: 3, alignItems: 'center' }}>
                          {!isSelf && (
                            <span style={{ fontSize: 7, color: effective ? '#10b981' : '#ff7043', fontFamily: 'var(--font-data)', fontWeight: effective ? 700 : 400 }}>
                              DMG {effective ? `${Math.round(hab.damage * 1.5)}` : hab.damage}
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
                      </button>
                    );
                  })
                )}

                <div style={{ width: 1, background: 'rgba(255,255,255,0.08)', flexShrink: 0, alignSelf: 'stretch', margin: '2px 0' }} />

                {/* Ataque desarmado */}
                <button onClick={() => doAction('unarmed')} disabled={busy} style={{
                  minWidth: 54, borderRadius: 8, cursor: busy ? 'not-allowed' : 'pointer',
                  background: 'rgba(255,140,0,0.07)', border: '1px solid rgba(255,140,0,0.22)',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                  gap: 3, padding: '6px 8px', opacity: busy ? 0.35 : 1, transition: 'all 0.14s', flexShrink: 0,
                }}
                  onMouseEnter={e => { if (!busy) { e.currentTarget.style.background = 'rgba(255,140,0,0.18)'; e.currentTarget.style.borderColor = 'rgba(255,140,0,0.5)'; } }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,140,0,0.07)'; e.currentTarget.style.borderColor = 'rgba(255,140,0,0.22)'; }}
                >
                  <span style={{ fontSize: 16, lineHeight: 1 }}>✊</span>
                  <span style={{ fontSize: 7, color: '#ff9955', fontFamily: 'var(--font-data)', letterSpacing: '0.04em' }}>DESARMADO</span>
                  <span style={{ fontSize: 7, color: '#ff7043', fontFamily: 'var(--font-data)' }}>DMG 2</span>
                </button>

                {/* Huir */}
                <button onClick={() => doAction('flee')} disabled={busy} style={{
                  minWidth: 50, borderRadius: 8, cursor: busy ? 'not-allowed' : 'pointer',
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
              </div>
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
