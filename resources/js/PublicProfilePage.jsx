import { useEffect, useState } from 'react';
import { NX } from './data/seed.js';
import { PublicProfile } from './sections/Combatientes.jsx';

/* NÉXUS — Página pública de perfil (/c/:handle), sin autenticación */

const HUD_COLORS = ['#FF6B00', '#38cdf0', '#8b5cf6', '#10b981', '#ec4899', '#f97316', '#E6B325', '#3aa0ff'];
function hashColor(str) {
  let h = 5381;
  for (let i = 0; i < str.length; i++) h = ((h << 5) + h) ^ str.charCodeAt(i);
  return HUD_COLORS[Math.abs(h) % HUD_COLORS.length];
}

function mapPublicCombatant(p) {
  const initials = (p.name ?? '').split(' ').slice(0, 2).map(w => w[0]?.toUpperCase() ?? '').join('');
  return {
    id:        `p${p.id}`,
    userId:    p.id,
    handle:    p.handle,
    name:      p.name,
    bio:       p.bio ?? '',
    cls:       p.cls ?? 'forma1',
    side:      p.side ?? 'luminoso',
    saberName: p.saber_color ?? 'azul',
    saber:     NX.SABERS[p.saber_color] ?? NX.SABERS.azul,
    wins:      p.wins ?? 0,
    losses:    p.losses ?? 0,
    streak:    p.streak ?? 0,
    winrate:   p.winrate ?? 0,
    stats:     p.stats ?? { fuerza: 50, velocidad: 50, tecnica: 50, defensa: 50, foco: 50 },
    gold:      p.gold ?? false,
    tier:      p.tier ?? 'iniciado',
    sector:    p.sector ?? '',
    sponsor:   p.sponsor ?? '',
    joined:    p.joined_year ? String(p.joined_year) : '',
    photo_url: p.photo_url ?? null,
    titulo_activo: p.titulo_activo ?? null,
    tutor:     p.tutor ?? null,
    medals:    [],
    initials,
    color: hashColor(p.handle ?? p.name ?? 'x'),
  };
}

const EMPTY_S = { tasks: [], combats: [], byId: () => null };

export default function PublicProfilePage({ handle }) {
  const [state, setState] = useState({ loading: true, error: false, combatant: null });

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/public/combatants/${encodeURIComponent(handle)}`, { headers: { Accept: 'application/json' } })
      .then(r => (r.ok ? r.json() : Promise.reject()))
      .then(d => { if (!cancelled) setState({ loading: false, error: false, combatant: mapPublicCombatant(d.combatant) }); })
      .catch(() => { if (!cancelled) setState({ loading: false, error: true, combatant: null }); });
    return () => { cancelled = true; };
  }, [handle]);

  const goHome = () => { window.location.href = '/'; };

  if (state.loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: '#04070f' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
          <img src="/assets/isotipo.png" alt="" style={{ width: 44, opacity: 0.7, animation: 'nx-pulse 1.4s infinite' }} />
          <div className="nx-data" style={{ fontSize: 11, color: 'var(--holo)', letterSpacing: '0.2em' }}>CARGANDO PERFIL...</div>
        </div>
      </div>
    );
  }

  if (state.error || !state.combatant) {
    return (
      <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: '#04070f', padding: 24 }}>
        <div style={{ textAlign: 'center' }}>
          <div className="nx-display" style={{ fontSize: 20, color: 'var(--txt)', marginBottom: 8 }}>Combatiente no encontrado</div>
          <div className="nx-data" style={{ fontSize: 12, color: 'var(--txt-faint)', marginBottom: 20 }}>@{handle}</div>
          <button className="nx-btn nx-btn-accent" onClick={goHome}>Ir a Néxus</button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: '#04070f' }}>
      <PublicProfile c={state.combatant} S={EMPTY_S} onClose={goHome} onChallenge={null} />
    </div>
  );
}
