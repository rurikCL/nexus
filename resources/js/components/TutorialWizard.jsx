import { useState, useEffect } from 'react';
import { NX } from '../data/seed.js';
import { Icon } from './ui.jsx';

const SABER_THEME = {
  azul:    { holo: '#3aa0ff', dim: '#2575cc' },
  verde:   { holo: '#34d36a', dim: '#23a04e' },
  ambar:   { holo: '#ffb01f', dim: '#cc8800' },
  purpura: { holo: '#b15cff', dim: '#8533e0' },
  cian:    { holo: '#26e3e3', dim: '#18a8a8' },
  blanco:  { holo: '#c8deff', dim: '#8899bb' },
  rojo:    { holo: '#ff2d45', dim: '#cc1030' },
};

const SABERS_LIST = [
  { id: 'azul',    label: 'Azul',    color: '#3aa0ff' },
  { id: 'verde',   label: 'Verde',   color: '#34d36a' },
  { id: 'ambar',   label: 'Ámbar',   color: '#ffb01f' },
  { id: 'purpura', label: 'Púrpura', color: '#b15cff' },
  { id: 'cian',    label: 'Cian',    color: '#26e3e3' },
  { id: 'blanco',  label: 'Blanco',  color: '#eaf2ff' },
  { id: 'rojo',    label: 'Rojo',    color: '#ff2d45' },
];

const STEPS = ['bienvenida', 'identidad', 'lado', 'clase', 'sable', 'tutor', 'listo'];

export default function TutorialWizard({ user, onComplete }) {
  const [step, setStep]     = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState(null);
  const [animKey, setAnimKey] = useState(0);

  const [form, setForm] = useState({
    name:        user?.name ?? '',
    handle:      '',
    bio:         '',
    side:        '',
    cls:         '',
    saber_color: 'azul',
    tutor_id:    null,
    tutor_name:  '',
  });

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const setSide = (side) => setForm(f => ({
    ...f,
    side,
    saber_color: side === 'oscuro' ? 'rojo' : (f.saber_color === 'rojo' ? 'azul' : f.saber_color),
  }));

  // Update HUD color as saber selection changes
  useEffect(() => {
    const t = SABER_THEME[form.saber_color] ?? SABER_THEME.azul;
    const root = document.documentElement;
    root.style.setProperty('--holo', t.holo);
    root.style.setProperty('--holo-dim', t.dim);
    root.style.setProperty('--holo-faint', `color-mix(in srgb, ${t.holo} 18%, transparent)`);
    root.style.setProperty('--holo-line', `color-mix(in srgb, ${t.holo} 32%, transparent)`);
  }, [form.saber_color]);

  // Reset to default holo on unmount
  useEffect(() => () => {
    const root = document.documentElement;
    root.style.removeProperty('--holo');
    root.style.removeProperty('--holo-dim');
    root.style.removeProperty('--holo-faint');
    root.style.removeProperty('--holo-line');
  }, []);

  const canNext = () => {
    if (step === 1) return form.name.trim().length > 0 && form.handle.trim().length > 0;
    if (step === 2) return !!form.side;
    if (step === 3) return !!form.cls;
    return true;
  };

  const submit = async () => {
    setSaving(true);
    setError(null);
    const token = localStorage.getItem('nx-token');
    try {
      const res = await fetch('/api/character', {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name:        form.name,
          handle:      form.handle,
          bio:         form.bio,
          side:        form.side,
          cls:         form.cls,
          saber_color: form.saber_color,
          tutor_id:    form.tutor_id,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message ?? 'Error al crear el personaje.');
        setSaving(false);
        return;
      }
      onComplete(data.character);
    } catch {
      setError('Error de conexión. Intenta nuevamente.');
      setSaving(false);
    }
  };

  const next = () => {
    setError(null);
    setAnimKey(k => k + 1);
    if (step === STEPS.length - 1) submit();
    else setStep(s => s + 1);
  };

  const back = () => {
    setError(null);
    setAnimKey(k => k + 1);
    setStep(s => s - 1);
  };

  const isLast = step === STEPS.length - 1;
  const btnLabel = isLast ? (saving ? 'PROCESANDO...' : 'COMPLETAR INICIACIÓN')
                  : step === 0 ? 'COMENZAR PROTOCOLO'
                  : 'CONTINUAR';

  return (
    <div style={{
      minHeight: '100vh', background: '#04070f',
      display: 'flex', flexDirection: 'column', position: 'relative',
    }}>
      <div className="nx-bg-grid" />
      <div className="nx-scanlines" />

      {/* Header */}
      <div style={{
        position: 'relative', zIndex: 2,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '14px 24px',
        borderBottom: '1px solid var(--holo-line)',
        background: 'rgba(4,7,15,0.85)', backdropFilter: 'blur(10px)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <img
            src="/assets/isotipo.png" alt=""
            style={{ width: 28, filter: 'drop-shadow(0 0 8px var(--holo))', animation: 'nx-pulse 2.5s infinite' }}
          />
          <div>
            <div className="nx-display" style={{ fontSize: 14, letterSpacing: '0.1em' }}>NÉXUS</div>
            <div className="nx-data" style={{ fontSize: 8, color: 'var(--holo)', letterSpacing: '0.25em' }}>
              PROTOCOLO DE INICIACIÓN
            </div>
          </div>
        </div>

        {/* Progress dots */}
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          {STEPS.map((_, i) => (
            <span key={i} style={{
              width: i === step ? 22 : 6, height: 6, borderRadius: 3,
              background: i < step ? 'var(--holo)' : i === step ? 'var(--holo)' : 'rgba(255,255,255,0.12)',
              opacity: i < step ? 0.5 : 1,
              boxShadow: i === step ? '0 0 10px var(--holo)' : 'none',
              transition: 'all 0.35s cubic-bezier(.4,0,.2,1)',
            }} />
          ))}
        </div>
      </div>

      {/* Body */}
      <div style={{
        flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '32px 20px', position: 'relative', zIndex: 1,
        overflowY: 'auto',
      }}>
        <div key={animKey} className="nx-fade" style={{ width: '100%', maxWidth: 660 }}>
          {step === 0 && <StepBienvenida user={user} />}
          {step === 1 && <StepIdentidad form={form} set={set} />}
          {step === 2 && <StepLado form={form} setSide={setSide} />}
          {step === 3 && <StepClase form={form} set={set} />}
          {step === 4 && <StepSable form={form} set={set} />}
          {step === 5 && <StepTutor form={form} set={set} token={localStorage.getItem('nx-token')} />}
          {step === 6 && <StepListo form={form} error={error} />}
        </div>
      </div>

      {/* Footer */}
      <div style={{
        position: 'relative', zIndex: 2,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '14px 24px',
        borderTop: '1px solid var(--holo-line)',
        background: 'rgba(4,7,15,0.85)', backdropFilter: 'blur(10px)',
      }}>
        <button
          onClick={back}
          style={{
            visibility: step === 0 ? 'hidden' : 'visible',
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '8px 16px',
            background: 'transparent', border: '1px solid var(--holo-line)',
            borderRadius: 6, cursor: 'pointer',
            color: 'var(--txt-dim)', fontFamily: 'var(--font-data)',
            fontSize: 11, letterSpacing: '0.12em', transition: 'all 0.2s',
          }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--holo)'; e.currentTarget.style.color = 'var(--txt)'; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--holo-line)'; e.currentTarget.style.color = 'var(--txt-dim)'; }}
        >
          ← ATRÁS
        </button>

        <span className="nx-data" style={{ fontSize: 10, color: 'var(--txt-faint)', letterSpacing: '0.2em' }}>
          {step + 1} / {STEPS.length}
        </span>

        <button
          onClick={next}
          disabled={!canNext() || saving}
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '10px 22px',
            background: canNext() && !saving ? 'var(--holo)' : 'rgba(255,255,255,0.06)',
            border: 'none', borderRadius: 6,
            cursor: canNext() && !saving ? 'pointer' : 'default',
            color: canNext() && !saving ? '#04070f' : 'var(--txt-faint)',
            fontFamily: 'var(--font-data)', fontSize: 12,
            fontWeight: 700, letterSpacing: '0.12em',
            transition: 'all 0.2s',
            boxShadow: canNext() && !saving
              ? '0 0 22px color-mix(in srgb, var(--holo) 40%, transparent)'
              : 'none',
          }}
        >
          {btnLabel}
        </button>
      </div>
    </div>
  );
}

/* ─── Step 0: Bienvenida ─── */
function StepBienvenida({ user }) {
  const firstName = user?.name?.split(' ')[0] ?? 'Iniciado';
  return (
    <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 32 }}>
      <div style={{ position: 'relative', display: 'inline-block', marginTop: 8 }}>
        <img
          src="/assets/isotipo.png" alt=""
          style={{ width: 80, filter: 'drop-shadow(0 0 24px var(--holo))', animation: 'nx-pulse 2.5s infinite' }}
        />
        {/* Orbit ring */}
        <div style={{
          position: 'absolute', inset: -18,
          border: '1px solid var(--holo-line)',
          borderRadius: '50%',
          animation: 'nx-pulse 3s ease-in-out infinite',
        }} />
      </div>

      <div>
        <div className="nx-kicker" style={{ fontSize: 10, marginBottom: 14, letterSpacing: '0.3em' }}>
          PROTOCOLO DE INICIACIÓN · NÉXUS v2.0
        </div>
        <h1 className="nx-display" style={{ fontSize: 34, lineHeight: 1.2, marginBottom: 16 }}>
          Bienvenido,{' '}
          <span style={{ color: 'var(--holo)' }}>{firstName}</span>
        </h1>
        <p style={{ fontSize: 15, color: 'var(--txt-dim)', lineHeight: 1.75, maxWidth: 480, margin: '0 auto' }}>
          El Holocrón de Combate NÉXUS registra a los guerreros de élite del sistema Pompeyo.
          Antes de ingresar, debes forjar tu identidad como combatiente.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, width: '100%', maxWidth: 420 }}>
        {[
          { icon: 'user',    text: 'Define tu identidad' },
          { icon: 'swords',  text: 'Elige tu forma de combate' },
          { icon: 'trophy',  text: 'Escala el ranking orbital' },
        ].map((item, i) => (
          <div key={i} style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
            padding: '16px 10px',
            border: '1px solid var(--holo-line)', borderRadius: 8,
            background: 'rgba(255,255,255,0.02)',
          }}>
            <span style={{ color: 'var(--holo)' }}><Icon name={item.icon} size={22} /></span>
            <span className="nx-data" style={{ fontSize: 10, color: 'var(--txt-dim)', textAlign: 'center', lineHeight: 1.5 }}>
              {item.text}
            </span>
          </div>
        ))}
      </div>

      <div className="nx-data" style={{ fontSize: 10, color: 'var(--txt-faint)', letterSpacing: '0.2em' }}>
        ESTE PROCESO TOMA MENOS DE 2 MINUTOS
      </div>
    </div>
  );
}

/* ─── Step 1: Identidad ─── */
function StepIdentidad({ form, set }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 26 }}>
      <div>
        <div className="nx-kicker" style={{ fontSize: 10, marginBottom: 10, letterSpacing: '0.25em' }}>
          PASO 1 · IDENTIDAD
        </div>
        <h2 className="nx-display" style={{ fontSize: 26, marginBottom: 10 }}>¿Cómo te llaman?</h2>
        <p style={{ fontSize: 13, color: 'var(--txt-dim)', lineHeight: 1.65 }}>
          Tu nombre de combate y handle son tu identidad pública en el sistema.
          El handle debe ser único y solo puede contener letras, números, guiones y guiones bajos.
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        <Field label="NOMBRE DE COMBATE *">
          <input
            type="text"
            value={form.name}
            onChange={e => set('name', e.target.value)}
            placeholder="Ej: Kira Solaris"
            maxLength={80}
            style={inputStyle}
            onFocus={e => e.target.style.borderColor = 'var(--holo)'}
            onBlur={e => e.target.style.borderColor = 'var(--holo-line)'}
          />
        </Field>

        <Field label="HANDLE (@ ÚNICO) *">
          <div style={{ position: 'relative' }}>
            <span style={{
              position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)',
              color: 'var(--holo)', fontFamily: 'var(--font-data)', fontSize: 14, pointerEvents: 'none',
            }}>@</span>
            <input
              type="text"
              value={form.handle}
              onChange={e => set('handle', e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ''))}
              placeholder="tu_handle"
              maxLength={20}
              style={{ ...inputStyle, paddingLeft: 30 }}
              onFocus={e => e.target.style.borderColor = 'var(--holo)'}
              onBlur={e => e.target.style.borderColor = 'var(--holo-line)'}
            />
          </div>
        </Field>

        <Field label="BIO (OPCIONAL)">
          <textarea
            value={form.bio}
            onChange={e => set('bio', e.target.value)}
            placeholder="Una breve descripción de tu combatiente..."
            rows={3}
            maxLength={300}
            style={{
              ...inputStyle, resize: 'vertical', lineHeight: 1.55,
              fontFamily: 'var(--font-body)',
            }}
            onFocus={e => e.target.style.borderColor = 'var(--holo)'}
            onBlur={e => e.target.style.borderColor = 'var(--holo-line)'}
          />
        </Field>
      </div>
    </div>
  );
}

/* ─── Step 2: Lado ─── */
const SIDES = [
  {
    id: 'luminoso',
    label: 'Lado Luminoso',
    desc: 'Disciplina, honor y protección',
    color: '#3aa0ff',
    subtext: 'El camino de la Fuerza como guía, el sacrificio como virtud.',
  },
  {
    id: 'oscuro',
    label: 'Lado Oscuro',
    desc: 'Pasión, ambición y poder',
    color: '#ff2d45',
    subtext: 'La ira como combustible, la victoria como propósito.',
  },
];

function StepLado({ form, setSide }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 26 }}>
      <div>
        <div className="nx-kicker" style={{ fontSize: 10, marginBottom: 10, letterSpacing: '0.25em' }}>
          PASO 2 · ALINEACIÓN
        </div>
        <h2 className="nx-display" style={{ fontSize: 26, marginBottom: 10 }}>¿A qué lado perteneces?</h2>
        <p style={{ fontSize: 13, color: 'var(--txt-dim)', lineHeight: 1.65 }}>
          Tu alineación define tu filosofía de combate y cómo el sistema te catalogará.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        {SIDES.map(side => {
          const active = form.side === side.id;
          return (
            <button
              key={side.id}
              onClick={() => setSide(side.id)}
              style={{
                padding: '22px 18px', textAlign: 'left', cursor: 'pointer',
                border: `2px solid ${active ? side.color : 'var(--holo-line)'}`,
                borderRadius: 10,
                background: active
                  ? `color-mix(in srgb, ${side.color} 10%, transparent)`
                  : 'rgba(255,255,255,0.02)',
                boxShadow: active ? `0 0 24px color-mix(in srgb, ${side.color} 28%, transparent)` : 'none',
                transition: 'all 0.22s',
              }}
              onMouseEnter={e => { if (!active) e.currentTarget.style.borderColor = `${side.color}66`; }}
              onMouseLeave={e => { if (!active) e.currentTarget.style.borderColor = 'var(--holo-line)'; }}
            >
              <div style={{
                fontSize: 16, fontWeight: 700, color: side.color,
                marginBottom: 6, fontFamily: 'var(--font-hud)', letterSpacing: '0.04em',
              }}>
                {side.label}
              </div>
              <div style={{ fontSize: 13, color: 'var(--txt-dim)', marginBottom: 10 }}>{side.desc}</div>
              <div style={{ fontSize: 11, color: 'var(--txt-faint)', lineHeight: 1.55 }}>{side.subtext}</div>
              {side.id === 'oscuro' && (
                <div className="nx-data" style={{ marginTop: 10, fontSize: 9, color: '#ff8080', letterSpacing: '0.12em' }}>
                  SABLE ROJO — EXCLUSIVO
                </div>
              )}
              {active && (
                <div style={{
                  marginTop: 8, display: 'flex', alignItems: 'center', gap: 5,
                  color: side.color, fontFamily: 'var(--font-data)', fontSize: 10, letterSpacing: '0.18em',
                }}>
                  ✓ SELECCIONADO
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ─── Step 3: Clase ─── */
function StepClase({ form, set }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
      <div>
        <div className="nx-kicker" style={{ fontSize: 10, marginBottom: 10, letterSpacing: '0.25em' }}>
          PASO 3 · FORMA DE COMBATE
        </div>
        <h2 className="nx-display" style={{ fontSize: 26, marginBottom: 10 }}>Elige tu estilo de lucha</h2>
        <p style={{ fontSize: 13, color: 'var(--txt-dim)', lineHeight: 1.65 }}>
          Las 7 Formas del combate con sable. Cada una define tu arquetipo y filosofía de pelea.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(168px, 1fr))', gap: 10 }}>
        {NX.CLASSES.map(cls => {
          const active = form.cls === cls.id;
          return (
            <button
              key={cls.id}
              onClick={() => set('cls', cls.id)}
              style={{
                padding: '14px 12px', textAlign: 'left', cursor: 'pointer',
                border: `2px solid ${active ? cls.accent : 'var(--holo-line)'}`,
                borderRadius: 8,
                background: active
                  ? `color-mix(in srgb, ${cls.accent} 10%, transparent)`
                  : 'rgba(255,255,255,0.02)',
                boxShadow: active ? `0 0 18px color-mix(in srgb, ${cls.accent} 22%, transparent)` : 'none',
                transition: 'all 0.2s',
              }}
              onMouseEnter={e => { if (!active) e.currentTarget.style.borderColor = `${cls.accent}55`; }}
              onMouseLeave={e => { if (!active) e.currentTarget.style.borderColor = 'var(--holo-line)'; }}
            >
              <div style={{
                display: 'flex', alignItems: 'center', gap: 6,
                color: active ? cls.accent : 'var(--txt-dim)', marginBottom: 7,
              }}>
                <Icon name={cls.icon} size={15} />
                <span className="nx-data" style={{ fontSize: 9, letterSpacing: '0.1em' }}>{cls.num}</span>
              </div>
              <div style={{
                fontSize: 13, fontWeight: 700, marginBottom: 4,
                color: active ? 'var(--txt)' : 'var(--txt-dim)',
              }}>
                {cls.name}
              </div>
              <div style={{ fontSize: 10, color: 'var(--txt-faint)', lineHeight: 1.45 }}>{cls.desc}</div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ─── Step 4: Sable ─── */
function StepSable({ form, set }) {
  const isDark = form.side === 'oscuro';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 26 }}>
      <div>
        <div className="nx-kicker" style={{ fontSize: 10, marginBottom: 10, letterSpacing: '0.25em' }}>
          PASO 4 · CRISTAL KYBER
        </div>
        <h2 className="nx-display" style={{ fontSize: 26, marginBottom: 10 }}>Color de tu sable</h2>
        <p style={{ fontSize: 13, color: 'var(--txt-dim)', lineHeight: 1.65 }}>
          {isDark
            ? 'Los guerreros del Lado Oscuro empuñan únicamente el sable rojo. El cristal Kyber sangrante es su marca.'
            : 'El cristal Kyber es la extensión de tu fuerza. Su color cambia el tema visual del sistema en tiempo real.'}
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 10 }}>
        {SABERS_LIST.map(s => {
          const active  = form.saber_color === s.id;
          const locked  = isDark && s.id !== 'rojo';
          return (
            <button
              key={s.id}
              onClick={() => !locked && set('saber_color', s.id)}
              title={locked ? 'Solo disponible en el Lado Luminoso' : s.label}
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
                padding: '14px 6px',
                border: `2px solid ${active ? s.color : locked ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.08)'}`,
                borderRadius: 10,
                background: active
                  ? `color-mix(in srgb, ${s.color} 13%, transparent)`
                  : 'rgba(255,255,255,0.02)',
                cursor: locked ? 'not-allowed' : 'pointer',
                opacity: locked ? 0.25 : 1,
                transition: 'all 0.2s',
                boxShadow: active ? `0 0 22px color-mix(in srgb, ${s.color} 35%, transparent)` : 'none',
              }}
            >
              {/* Blade */}
              <div style={{
                width: 6, height: 52, borderRadius: 3,
                background: `linear-gradient(to bottom, ${s.color}, color-mix(in srgb, ${s.color} 30%, transparent))`,
                boxShadow: `0 0 ${active ? 14 : 6}px ${locked ? 'transparent' : s.color}`,
                transition: 'box-shadow 0.25s',
                filter: locked ? 'grayscale(1)' : 'none',
              }} />
              <span className="nx-data" style={{
                fontSize: 9, color: active ? s.color : 'var(--txt-faint)', letterSpacing: '0.06em',
              }}>
                {s.label}
              </span>
            </button>
          );
        })}
      </div>

      <div style={{
        padding: '10px 16px', border: '1px solid var(--holo-line)', borderRadius: 6,
        background: 'rgba(255,255,255,0.02)',
      }}>
        <span className="nx-data" style={{ fontSize: 10, color: 'var(--txt-faint)', letterSpacing: '0.1em' }}>
          {isDark
            ? 'LADO OSCURO · SABLE ROJO ASIGNADO AUTOMÁTICAMENTE'
            : 'VISTA PREVIA ACTIVA · El HUD refleja el color de tu cristal Kyber seleccionado'}
        </span>
      </div>
    </div>
  );
}

/* ─── Step 5: Tutor ─── */
const TIER_LABEL = { caballero: 'Caballero', maestro: 'Maestro', granmaestro: 'Gran Maestro' };
const TIER_COLOR = { caballero: '#3aa0ff', maestro: '#b15cff', granmaestro: '#ffb01f' };

function StepTutor({ form, set, token }) {
  const [tutors, setTutors]   = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/tutors', {
      headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
    })
      .then(r => r.json())
      .then(d => { setTutors(d.tutors ?? []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const select = (t) => {
    if (form.tutor_id === t.id) {
      set('tutor_id', null);
      set('tutor_name', '');
    } else {
      set('tutor_id', t.id);
      set('tutor_name', t.name);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 26 }}>
      <div>
        <div className="nx-kicker" style={{ fontSize: 10, marginBottom: 10, letterSpacing: '0.25em' }}>
          PASO 5 · MENTOR · OPCIONAL
        </div>
        <h2 className="nx-display" style={{ fontSize: 26, marginBottom: 10 }}>¿Tienes un tutor?</h2>
        <p style={{ fontSize: 13, color: 'var(--txt-dim)', lineHeight: 1.65 }}>
          Un maestro puede guiarte en tus primeros pasos. Esta elección es opcional y puede cambiarse más tarde.
        </p>
      </div>

      {loading ? (
        <div className="nx-data" style={{ textAlign: 'center', color: 'var(--txt-faint)', fontSize: 11, padding: '40px 0' }}>
          CARGANDO MENTORES...
        </div>
      ) : tutors.length === 0 ? (
        <div style={{
          textAlign: 'center', padding: '32px 20px',
          border: '1px dashed var(--holo-line)', borderRadius: 8,
        }}>
          <div className="nx-data" style={{ fontSize: 11, color: 'var(--txt-faint)', letterSpacing: '0.15em' }}>
            NO HAY MENTORES DISPONIBLES EN ESTE MOMENTO
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {tutors.map(t => {
            const active = form.tutor_id === t.id;
            const tc = TIER_COLOR[t.tier] ?? 'var(--holo)';
            const initials = t.name.split(' ').slice(0, 2).map(w => w[0]?.toUpperCase() ?? '').join('');
            return (
              <button
                key={t.id}
                onClick={() => select(t)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 14,
                  padding: '14px 18px', textAlign: 'left', cursor: 'pointer',
                  border: `2px solid ${active ? tc : 'var(--holo-line)'}`,
                  borderRadius: 8,
                  background: active
                    ? `color-mix(in srgb, ${tc} 8%, transparent)`
                    : 'rgba(255,255,255,0.02)',
                  boxShadow: active ? `0 0 18px color-mix(in srgb, ${tc} 22%, transparent)` : 'none',
                  transition: 'all 0.2s',
                }}
                onMouseEnter={e => { if (!active) e.currentTarget.style.borderColor = `${tc}55`; }}
                onMouseLeave={e => { if (!active) e.currentTarget.style.borderColor = 'var(--holo-line)'; }}
              >
                <div style={{
                  width: 40, height: 40, borderRadius: 6, flexShrink: 0,
                  background: `color-mix(in srgb, ${tc} 14%, transparent)`,
                  border: `1px solid ${tc}`,
                  display: 'grid', placeItems: 'center',
                  fontFamily: 'var(--font-hud)', fontSize: 15, fontWeight: 700, color: tc,
                }}>
                  {initials}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: active ? 'var(--txt)' : 'var(--txt-dim)' }}>
                    {t.name}
                  </div>
                  <div className="nx-data" style={{ fontSize: 10, color: tc, letterSpacing: '0.08em', marginTop: 2 }}>
                    @{t.handle} · {TIER_LABEL[t.tier] ?? t.tier}
                  </div>
                </div>
                {active && (
                  <div className="nx-data" style={{ fontSize: 10, color: tc, letterSpacing: '0.15em', flexShrink: 0 }}>
                    ✓ ELEGIDO
                  </div>
                )}
              </button>
            );
          })}
        </div>
      )}

      <div style={{
        padding: '10px 16px', border: '1px solid var(--holo-line)', borderRadius: 6,
        background: 'rgba(255,255,255,0.02)',
      }}>
        <span className="nx-data" style={{ fontSize: 10, color: 'var(--txt-faint)', letterSpacing: '0.1em' }}>
          {form.tutor_id
            ? 'TUTOR SELECCIONADO · Puedes cambiar esto más adelante desde tu perfil'
            : 'OPCIONAL · Puedes continuar sin seleccionar un tutor'}
        </span>
      </div>
    </div>
  );
}

/* ─── Step 6: Listo ─── */
function StepListo({ form, error }) {
  const cls        = NX.CLASSES.find(c => c.id === form.cls);
  const side       = SIDES.find(s => s.id === form.side);
  const saberEntry = SABERS_LIST.find(s => s.id === form.saber_color);
  const initials   = form.name.split(' ').slice(0, 2).map(w => w[0]?.toUpperCase() ?? '').join('');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 26 }}>
      <div style={{ textAlign: 'center' }}>
        <div className="nx-kicker" style={{ fontSize: 10, marginBottom: 10, letterSpacing: '0.25em' }}>
          REVISIÓN FINAL
        </div>
        <h2 className="nx-display" style={{ fontSize: 28, marginBottom: 10 }}>Tu ficha de combatiente</h2>
        <p style={{ fontSize: 13, color: 'var(--txt-dim)' }}>
          Confirma tu identidad antes de ingresar al sistema.
        </p>
      </div>

      <div style={{ border: '1px solid var(--holo-line)', borderRadius: 10, overflow: 'hidden' }}>
        {/* Identity row */}
        <div style={{
          padding: '18px 20px', display: 'flex', alignItems: 'center', gap: 16,
          background: 'color-mix(in srgb, var(--holo) 7%, transparent)',
          borderBottom: '1px solid var(--holo-line)',
        }}>
          <div style={{
            width: 54, height: 54, borderRadius: 8, flexShrink: 0,
            background: 'color-mix(in srgb, var(--holo) 14%, transparent)',
            border: '2px solid var(--holo)', display: 'grid', placeItems: 'center',
            fontFamily: 'var(--font-hud)', fontSize: 20, fontWeight: 700, color: 'var(--holo)',
          }}>
            {initials}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="nx-display" style={{ fontSize: 20 }}>{form.name}</div>
            <div className="nx-data" style={{ fontSize: 12, color: 'var(--holo)', marginTop: 2 }}>@{form.handle}</div>
          </div>
          {/* Saber blade preview */}
          <div style={{
            width: 8, height: 48, borderRadius: 4, flexShrink: 0,
            background: `linear-gradient(to bottom, ${saberEntry?.color ?? '#38cdf0'}, transparent)`,
            boxShadow: `0 0 14px ${saberEntry?.color ?? '#38cdf0'}`,
          }} />
        </div>

        {/* Details grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr' }}>
          {[
            { label: 'LADO',          value: side?.label ?? '—',             color: side?.color },
            { label: 'FORMA',         value: cls ? `${cls.num} · ${cls.name}` : '—', color: cls?.accent },
            { label: 'CRISTAL KYBER', value: saberEntry?.label ?? '—',       color: saberEntry?.color },
            { label: 'TIER INICIAL',  value: 'Iniciado',                     color: 'var(--txt-dim)' },
          ].map((item, i) => (
            <div key={i} style={{
              padding: '14px 20px',
              borderBottom: i < 2 ? '1px solid var(--holo-line)' : 'none',
              borderRight: i % 2 === 0 ? '1px solid var(--holo-line)' : 'none',
            }}>
              <div className="nx-data" style={{ fontSize: 9, color: 'var(--txt-faint)', letterSpacing: '0.2em', marginBottom: 5 }}>
                {item.label}
              </div>
              <div style={{ fontSize: 13, fontWeight: 600, color: item.color ?? 'var(--txt)' }}>
                {item.value}
              </div>
            </div>
          ))}
        </div>

        {/* Tutor row (optional) */}
        {form.tutor_id && (
          <div style={{
            padding: '12px 20px', borderTop: '1px solid var(--holo-line)',
            background: 'rgba(255,255,255,0.02)',
          }}>
            <div className="nx-data" style={{ fontSize: 9, color: 'var(--txt-faint)', letterSpacing: '0.2em', marginBottom: 5 }}>
              TUTOR ASIGNADO
            </div>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--holo)' }}>
              {form.tutor_name}
            </div>
          </div>
        )}

        {form.bio && (
          <div style={{
            padding: '12px 20px', borderTop: '1px solid var(--holo-line)',
            background: 'rgba(255,255,255,0.02)',
          }}>
            <div className="nx-data" style={{ fontSize: 9, color: 'var(--txt-faint)', letterSpacing: '0.2em', marginBottom: 5 }}>BIO</div>
            <div style={{ fontSize: 12, color: 'var(--txt-dim)', lineHeight: 1.6 }}>{form.bio}</div>
          </div>
        )}
      </div>

      {error && (
        <div style={{
          padding: '12px 16px', borderRadius: 6,
          border: '1px solid rgba(255,45,69,0.35)',
          background: 'rgba(255,45,69,0.08)',
          color: '#ff8080', fontFamily: 'var(--font-data)', fontSize: 12,
          letterSpacing: '0.05em',
        }}>
          ⚠ {error}
        </div>
      )}
    </div>
  );
}

/* ─── Helpers ─── */
function Field({ label, children }) {
  return (
    <div>
      <label className="nx-data" style={{
        fontSize: 10, letterSpacing: '0.2em', color: 'var(--txt-faint)',
        display: 'block', marginBottom: 7,
      }}>
        {label}
      </label>
      {children}
    </div>
  );
}

const inputStyle = {
  width: '100%', padding: '12px 14px', boxSizing: 'border-box',
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid var(--holo-line)',
  borderRadius: 6,
  color: 'var(--txt)', fontSize: 15,
  fontFamily: 'var(--font-body)',
  outline: 'none',
  transition: 'border-color 0.2s',
};
