import { useState } from 'react';
import { Icon } from './components/ui.jsx';

const BG = (
  <>
    <div className="nx-bg-grid" />
    <div className="nx-scanlines" />
    <div style={{ position: 'fixed', inset: 0, zIndex: 0, background: 'radial-gradient(1200px 800px at 78% -10%, rgba(0,71,186,0.22), transparent 60%), radial-gradient(900px 700px at 8% 110%, rgba(255,107,0,0.07), transparent 55%), linear-gradient(180deg, #07101f, #04070f)' }} />
  </>
);

function ErrorBanner({ msg }) {
  if (!msg) return null;
  return (
    <div style={{ padding: '10px 14px', borderRadius: 'var(--radius-md)', border: '1px solid rgba(255,107,0,0.4)', background: 'rgba(255,107,0,0.1)', color: 'var(--holocron-naranja)', fontSize: 13, display: 'flex', alignItems: 'center', gap: 8 }}>
      <Icon name="x" size={14} />{msg}
    </div>
  );
}

function PwField({ value, onChange, placeholder = '••••••••', label = 'Contraseña' }) {
  const [show, setShow] = useState(false);
  return (
    <div style={{ display: 'grid', gap: 6 }}>
      <label className="nx-label">{label}</label>
      <div style={{ position: 'relative' }}>
        <input
          className="nx-input"
          type={show ? 'text' : 'password'}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          required
          style={{ paddingRight: 42 }}
        />
        <button type="button" onClick={() => setShow(s => !s)}
          style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--txt-faint)', padding: 2 }}>
          <Icon name="eye" size={16} />
        </button>
      </div>
    </div>
  );
}

function CardShell({ children }) {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', overflow: 'hidden' }}>
      {BG}
      <div className="nx-panel nx-panel-glow nx-fade" style={{ position: 'relative', zIndex: 1, width: '100%', maxWidth: 420, margin: '0 16px', padding: 0 }}>
        {/* Logo */}
        <div style={{ padding: '28px 32px 22px', borderBottom: '1px solid var(--holo-line)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
          <img src="/assets/isotipo.png" alt="NÉXUS" style={{ width: 52, height: 52, filter: 'drop-shadow(0 0 18px rgba(230,179,37,.5))' }} />
          <div style={{ textAlign: 'center' }}>
            <div className="nx-display" style={{ fontSize: 22, letterSpacing: '0.1em', color: 'var(--txt)' }}>NÉXUS</div>
            <div className="nx-data" style={{ fontSize: 10, color: 'var(--holo)', letterSpacing: '0.28em', marginTop: 3 }}>HOLOCRON DE COMBATE</div>
          </div>
        </div>
        {children}
        <div style={{ padding: '14px 32px', borderTop: '1px solid var(--holo-line)', textAlign: 'center' }}>
          <div className="nx-data" style={{ fontSize: 10, color: 'var(--txt-faint)', letterSpacing: '0.06em' }}>
            © Esgrima Jedi Chile — Temporada 3
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── LOGIN ── */
function LoginForm({ onLogin, onSwitch }) {
  const [email, setEmail]     = useState('');
  const [password, setPassword] = useState('');
  const [error, setError]     = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      const res  = await fetch('/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify({ email, password }) });
      const data = await res.json();
      if (!res.ok) { setError(data.errors?.email?.[0] ?? data.message ?? 'Credenciales incorrectas.'); return; }
      localStorage.setItem('nx-token', data.token);
      localStorage.setItem('nx-user', JSON.stringify(data.user));
      window.axios.defaults.headers.common['Authorization'] = `Bearer ${data.token}`;
      onLogin(data.user);
    } catch { setError('No se pudo conectar con el servidor.'); }
    finally  { setLoading(false); }
  };

  return (
    <form onSubmit={submit} style={{ padding: '26px 32px 28px', display: 'grid', gap: 18 }}>
      <div style={{ textAlign: 'center' }}>
        <div className="nx-kicker" style={{ fontSize: 10 }}>Acceso de combatiente</div>
      </div>

      <ErrorBanner msg={error} />

      <div style={{ display: 'grid', gap: 6 }}>
        <label className="nx-label">Email</label>
        <input className="nx-input" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="combatiente@nexus.cl" required autoFocus />
      </div>

      <PwField value={password} onChange={e => setPassword(e.target.value)} />

      <button type="submit" disabled={loading} className="nx-btn nx-btn-accent" style={{ width: '100%', justifyContent: 'center', padding: '12px', marginTop: 2, fontSize: 13 }}>
        {loading
          ? <><span className="nx-live-dot" style={{ background: '#fff', boxShadow: 'none' }} />Verificando...</>
          : <><Icon name="zap" size={15} />Ingresar al Sistema</>}
      </button>

      <div style={{ textAlign: 'center', borderTop: '1px solid var(--holo-line)', paddingTop: 16 }}>
        <span className="nx-data" style={{ fontSize: 11, color: 'var(--txt-faint)' }}>¿Aún no tienes cuenta?</span>{' '}
        <button type="button" onClick={onSwitch} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--holo)', fontFamily: 'var(--font-data)', fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textDecoration: 'underline' }}>
          Registrarse
        </button>
      </div>
    </form>
  );
}

/* ── REGISTRO ── */
function RegisterForm({ onLogin, onSwitch }) {
  const [name, setName]         = useState('');
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm]   = useState('');
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (password !== confirm) { setError('Las contraseñas no coinciden.'); return; }
    setLoading(true);
    try {
      const res  = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ name, email, password, password_confirmation: confirm }),
      });
      const data = await res.json();
      if (!res.ok) {
        const first = Object.values(data.errors ?? {})[0]?.[0];
        setError(first ?? data.message ?? 'Error al registrar.');
        return;
      }
      localStorage.setItem('nx-token', data.token);
      localStorage.setItem('nx-user', JSON.stringify(data.user));
      window.axios.defaults.headers.common['Authorization'] = `Bearer ${data.token}`;
      onLogin(data.user);
    } catch { setError('No se pudo conectar con el servidor.'); }
    finally  { setLoading(false); }
  };

  return (
    <form onSubmit={submit} style={{ padding: '26px 32px 28px', display: 'grid', gap: 16 }}>
      <div style={{ textAlign: 'center' }}>
        <div className="nx-kicker" style={{ fontSize: 10 }}>Nuevo combatiente</div>
      </div>

      <ErrorBanner msg={error} />

      <div style={{ display: 'grid', gap: 6 }}>
        <label className="nx-label">Nombre</label>
        <input className="nx-input" type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Tu nombre de combate" required autoFocus maxLength={100} />
      </div>

      <div style={{ display: 'grid', gap: 6 }}>
        <label className="nx-label">Email</label>
        <input className="nx-input" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="combatiente@nexus.cl" required />
      </div>

      <PwField value={password} onChange={e => setPassword(e.target.value)} label="Contraseña" placeholder="Mínimo 8 caracteres" />
      <PwField value={confirm}  onChange={e => setConfirm(e.target.value)}  label="Confirmar contraseña" />

      <button type="submit" disabled={loading} className="nx-btn nx-btn-accent" style={{ width: '100%', justifyContent: 'center', padding: '12px', marginTop: 2, fontSize: 13 }}>
        {loading
          ? <><span className="nx-live-dot" style={{ background: '#fff', boxShadow: 'none' }} />Creando cuenta...</>
          : <><Icon name="shield" size={15} />Unirse a la Academia</>}
      </button>

      <div style={{ textAlign: 'center', borderTop: '1px solid var(--holo-line)', paddingTop: 16 }}>
        <span className="nx-data" style={{ fontSize: 11, color: 'var(--txt-faint)' }}>¿Ya tienes cuenta?</span>{' '}
        <button type="button" onClick={onSwitch} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--holo)', fontFamily: 'var(--font-data)', fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textDecoration: 'underline' }}>
          Iniciar sesión
        </button>
      </div>
    </form>
  );
}

/* ── EXPORT ── */
export default function Login({ onLogin }) {
  const [mode, setMode] = useState('login');
  return (
    <CardShell>
      {mode === 'login'
        ? <LoginForm  onLogin={onLogin} onSwitch={() => setMode('register')} />
        : <RegisterForm onLogin={onLogin} onSwitch={() => setMode('login')} />}
    </CardShell>
  );
}
