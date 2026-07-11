import './bootstrap.js';
import '../css/app.css';
import React, { useState, useEffect, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import './styles/tokens.css';
import './styles/hud.css';
import App from './App.jsx';
import Login from './Login.jsx';
import TutorialWizard from './components/TutorialWizard.jsx';
import { TransmisionOverlay } from './components/TransmisionOverlay.jsx';
import PublicProfilePage from './PublicProfilePage.jsx';

const PUBLIC_PROFILE_MATCH = location.pathname.match(/^\/c\/([^/]+)\/?$/);

function Root() {
  // Vista pública de perfil (/c/:handle) — no requiere sesión, se resuelve antes de cualquier chequeo de auth
  if (PUBLIC_PROFILE_MATCH) {
    return <PublicProfilePage handle={decodeURIComponent(PUBLIC_PROFILE_MATCH[1])} />;
  }

  const [user, setUser]       = useState(null);
  const [checking, setChecking] = useState(true);

  // Cola de transmisiones en tiempo real
  const [transmision, setTransmision]   = useState(null);
  const transmisionQueue                = useRef([]);
  const transmisionActive               = useRef(null);

  const pushTransmision = (notif) => {
    if (transmisionActive.current) {
      transmisionQueue.current.push(notif);
    } else {
      transmisionActive.current = notif;
      setTransmision(notif);
    }
  };

  const dismissTransmision = () => {
    const notif = transmisionActive.current;
    if (notif?._notifId) {
      const token = localStorage.getItem('nx-token');
      fetch(`/api/notifications/${notif._notifId}/read`, {
        method: 'POST',
        headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
      }).catch(() => {});
    }
    const next = transmisionQueue.current.shift() ?? null;
    transmisionActive.current = next;
    setTransmision(next);
  };

  useEffect(() => {
    const token = localStorage.getItem('nx-token');
    const cached = localStorage.getItem('nx-user');

    if (!token) { setChecking(false); return; }

    // Muestra la app con datos cacheados inmediatamente mientras valida
    if (cached) {
      try { setUser(JSON.parse(cached)); } catch {}
    }

    // Valida el token con el servidor
    fetch('/api/me', {
      headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
    })
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(me => {
        const updated = { ...JSON.parse(cached ?? '{}'), ...me };
        setUser(updated);
        localStorage.setItem('nx-user', JSON.stringify(updated));
      })
      .catch(() => {
        // Token inválido o expirado — fuerza login
        localStorage.removeItem('nx-token');
        localStorage.removeItem('nx-user');
        setUser(null);
      })
      .finally(() => setChecking(false));
  }, []);

  const handleLogin = (userData) => setUser(userData);

  const handleLogout = () => {
    const token = localStorage.getItem('nx-token');
    fetch('/api/logout', {
      method: 'POST',
      headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
    }).finally(() => {
      localStorage.removeItem('nx-token');
      localStorage.removeItem('nx-user');
      localStorage.removeItem('nx-state-v3');
      setUser(null);
    });
  };

  const handleUserUpdate = (updatedUser) => {
    setUser(updatedUser);
    localStorage.setItem('nx-user', JSON.stringify(updatedUser));
  };


  if (checking && !user) {
    return (
      <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: '#04070f' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
          <img src="/assets/isotipo.png" alt="" style={{ width: 44, opacity: 0.7, animation: 'nx-pulse 1.4s infinite' }} />
          <div className="nx-data" style={{ fontSize: 11, color: 'var(--holo)', letterSpacing: '0.2em' }}>VERIFICANDO ACCESO...</div>
        </div>
      </div>
    );
  }

  if (!user) return <Login onLogin={handleLogin} />;

  if (!user.character) {
    return (
      <TutorialWizard
        user={user}
        onComplete={(char) => handleUserUpdate({ ...user, character: char })}
      />
    );
  }

  return (
    <>
      <App user={user} onLogout={handleLogout} onUserUpdate={handleUserUpdate} onTransmision={pushTransmision} />
      {transmision && (
        <TransmisionOverlay notification={transmision} onDismiss={dismissTransmision} />
      )}
    </>
  );
}

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>
);
