import './bootstrap.js';
import '../css/app.css';
import React, { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import './styles/tokens.css';
import './styles/hud.css';
import App from './App.jsx';
import Login from './Login.jsx';

function Root() {
  const [user, setUser]       = useState(null);
  const [checking, setChecking] = useState(true);

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
      setUser(null);
    });
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

  return <App user={user} onLogout={handleLogout} />;
}

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>
);
