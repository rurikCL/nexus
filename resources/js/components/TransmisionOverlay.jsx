import { useState, useEffect, useRef } from 'react';
import { Icon } from './ui.jsx';

const TONES = {
  orange: { color: '#FF6B00', glow: 'rgba(255,107,0,.45)',  bg: 'rgba(255,107,0,.07)'  },
  green:  { color: '#10b981', glow: 'rgba(16,185,129,.45)', bg: 'rgba(16,185,129,.07)' },
  red:    { color: '#ff2d45', glow: 'rgba(255,45,69,.45)',  bg: 'rgba(255,45,69,.07)'  },
  blue:   { color: '#3aa0ff', glow: 'rgba(58,160,255,.45)', bg: 'rgba(58,160,255,.07)' },
  holo:   { color: '#E6B325', glow: 'rgba(230,179,37,.45)', bg: 'rgba(230,179,37,.07)' },
};

const AUTO_DISMISS_MS = 9000;

function SignalBars({ color }) {
  return (
    <div style={{ display: 'flex', gap: 3, alignItems: 'flex-end' }}>
      {[4, 8, 12, 8, 4].map((h, i) => (
        <span key={i} style={{
          display: 'block', width: 3, height: h, borderRadius: 1,
          background: color, animation: `nx-signal-bar .9s ease-in-out ${i * .1}s infinite alternate`,
        }} />
      ))}
    </div>
  );
}

export function TransmisionOverlay({ notification, onDismiss }) {
  const [phase, setPhase] = useState('enter'); // enter → shown → exit
  const [progress, setProgress] = useState(100);
  const timerRef = useRef(null);
  const startRef = useRef(null);

  const tone = TONES[notification?.tone] ?? TONES.holo;

  useEffect(() => {
    if (!notification) return;
    setPhase('enter');
    setProgress(100);

    const t = setTimeout(() => setPhase('shown'), 80);

    startRef.current = Date.now();
    timerRef.current = setInterval(() => {
      const elapsed = Date.now() - startRef.current;
      const pct = Math.max(0, 100 - (elapsed / AUTO_DISMISS_MS) * 100);
      setProgress(pct);
      if (elapsed >= AUTO_DISMISS_MS) handleDismiss();
    }, 80);

    return () => { clearTimeout(t); clearInterval(timerRef.current); };
  }, [notification]);

  const handleDismiss = () => {
    clearInterval(timerRef.current);
    setPhase('exit');
    setTimeout(onDismiss, 380);
  };

  if (!notification) return null;

  const isShown = phase === 'shown';

  return (
    <div
      onClick={handleDismiss}
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        display: 'grid', placeItems: 'center',
        background: 'rgba(4,7,15,.88)',
        backdropFilter: 'blur(6px)',
        cursor: 'pointer',
        opacity: phase === 'exit' ? 0 : 1,
        transition: phase === 'exit' ? 'opacity .38s ease' : 'opacity .18s ease',
      }}
    >
      {/* Scanlines */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        background: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,.12) 2px, rgba(0,0,0,.12) 4px)',
      }} />

      {/* Corner brackets */}
      {[
        { top: 20, left: 20, borderTop: '2px solid', borderLeft: '2px solid' },
        { top: 20, right: 20, borderTop: '2px solid', borderRight: '2px solid' },
        { bottom: 20, left: 20, borderBottom: '2px solid', borderLeft: '2px solid' },
        { bottom: 20, right: 20, borderBottom: '2px solid', borderRight: '2px solid' },
      ].map((s, i) => (
        <div key={i} style={{
          position: 'absolute', width: 36, height: 36,
          borderColor: `${tone.color}88`, ...s,
        }} />
      ))}

      {/* Panel */}
      <div
        onClick={e => e.stopPropagation()}
        style={{
          position: 'relative',
          background: 'linear-gradient(160deg, rgba(8,12,26,.98) 0%, rgba(4,7,15,.99) 100%)',
          border: `1px solid ${tone.color}`,
          boxShadow: `0 0 0 1px ${tone.color}22, 0 0 60px ${tone.glow}, 0 0 120px ${tone.glow}55, inset 0 0 40px rgba(0,0,0,.6)`,
          padding: '28px 36px 20px',
          width: 480, maxWidth: 'calc(100vw - 48px)',
          textAlign: 'center', cursor: 'default',
          transform: isShown ? 'translateY(0) scale(1)' : 'translateY(18px) scale(.96)',
          opacity: isShown ? 1 : 0,
          transition: 'transform .52s cubic-bezier(.16,1,.3,1), opacity .4s ease',
        }}
      >
        {/* Horizontal scan on panel */}
        <div style={{
          position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden',
          background: 'repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(0,0,0,.06) 3px, rgba(0,0,0,.06) 4px)',
        }} />

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14, marginBottom: 22 }}>
          <SignalBars color={tone.color} />
          <div style={{
            fontFamily: 'var(--font-hud)', fontSize: 10, letterSpacing: '.3em',
            color: tone.color, animation: 'nx-pulse 1.4s ease-in-out infinite',
          }}>
            TRANSMISIÓN ENTRANTE
          </div>
          <SignalBars color={tone.color} />
        </div>

        {/* Icon ring */}
        <div style={{
          width: 72, height: 72, borderRadius: '50%', margin: '0 auto 18px',
          display: 'grid', placeItems: 'center',
          background: tone.bg,
          border: `1px solid ${tone.color}`,
          boxShadow: `0 0 24px ${tone.glow}, inset 0 0 16px ${tone.bg}`,
          color: tone.color,
        }}>
          <Icon name={notification.icon || 'bell'} size={34} stroke={1.5} />
        </div>

        {/* Title */}
        <div style={{
          fontFamily: 'var(--font-hud)', fontSize: 18, color: '#fff',
          textShadow: `0 0 24px ${tone.glow}`,
          lineHeight: 1.25, marginBottom: 8,
        }}>
          {notification.title}
        </div>

        {/* Body */}
        {notification.body && (
          <div style={{
            fontSize: 13, color: 'var(--text-dim)',
            lineHeight: 1.5, marginBottom: 22,
          }}>
            {notification.body}
          </div>
        )}

        {/* Divider */}
        <div style={{ height: 1, background: `linear-gradient(90deg, transparent, ${tone.color}44, transparent)`, marginBottom: 18 }} />

        {/* Actions */}
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginBottom: 16 }}>
          {notification.action_label && (
            <button
              onClick={handleDismiss}
              style={{
                padding: '8px 22px', border: 'none', cursor: 'pointer',
                background: tone.color, color: '#000',
                fontFamily: 'var(--font-hud)', fontSize: 11, fontWeight: 700,
                letterSpacing: '.12em',
                clipPath: 'polygon(8px 0%, 100% 0%, calc(100% - 8px) 100%, 0% 100%)',
              }}
            >
              {notification.action_label}
            </button>
          )}
          <button
            onClick={handleDismiss}
            style={{
              padding: '8px 22px', cursor: 'pointer',
              background: 'transparent', color: 'var(--text-dim)',
              border: '1px solid rgba(255,255,255,.14)',
              fontFamily: 'var(--font-hud)', fontSize: 11, letterSpacing: '.12em',
            }}
          >
            DESCARTAR
          </button>
        </div>

        {/* Progress bar */}
        <div style={{ height: 2, background: 'rgba(255,255,255,.07)', borderRadius: 1 }}>
          <div style={{
            height: '100%', borderRadius: 1,
            width: `${progress}%`,
            background: tone.color,
            boxShadow: `0 0 6px ${tone.glow}`,
            transition: 'width .08s linear',
          }} />
        </div>

        {/* Auto-dismiss hint */}
        <div style={{ marginTop: 6, fontSize: 10, color: 'rgba(255,255,255,.2)', fontFamily: 'var(--font-hud)', letterSpacing: '.1em' }}>
          CIERRA AUTOMÁTICAMENTE · CLICK PARA DESCARTAR
        </div>
      </div>
    </div>
  );
}
