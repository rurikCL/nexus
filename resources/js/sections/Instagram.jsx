import { useState, useEffect, useCallback } from 'react';
import { Panel, Btn, Icon, Modal, toast } from '../components/ui.jsx';

function api(method, path, body) {
  const token = localStorage.getItem('nx-token');
  return fetch(path, {
    method,
    headers: { 'Content-Type': 'application/json', Accept: 'application/json', Authorization: `Bearer ${token}` },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  }).then(r => r.json().then(d => (r.ok ? d : Promise.reject(d))));
}

function formatDate(ts) {
  return new Date(ts).toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric' });
}

function PostCard({ post }) {
  const img = post.media_url ?? post.thumbnail_url;
  return (
    <a href={post.permalink} target="_blank" rel="noopener noreferrer"
      style={{ display: 'block', borderRadius: 'var(--radius)', overflow: 'hidden', position: 'relative', aspectRatio: '1/1', background: 'var(--surface)', border: '1px solid var(--holo-line)', transition: 'border-color .2s' }}
      onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--holo)'}
      onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--holo-line)'}>
      {img && (
        <img src={img} alt={post.caption?.slice(0, 60) ?? ''} loading="lazy"
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
      )}
      <div style={{
        position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(2,5,12,.9) 0%, transparent 55%)',
        padding: '10px', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', gap: 4,
      }}>
        {post.caption && (
          <p className="nx-data" style={{ fontSize: 11, color: 'var(--txt)', margin: 0, lineHeight: 1.4,
            display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
            {post.caption}
          </p>
        )}
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <span className="nx-data" style={{ fontSize: 10, color: 'var(--txt-dim)', display: 'flex', alignItems: 'center', gap: 3 }}>
            <Icon name="star" size={10} /> {post.like_count ?? 0}
          </span>
          <span className="nx-data" style={{ fontSize: 10, color: 'var(--txt-dim)' }}>
            {formatDate(post.timestamp)}
          </span>
          {post.media_type === 'VIDEO' && <Icon name="video" size={12} style={{ color: 'var(--holo)' }} />}
        </div>
      </div>
    </a>
  );
}

function PublishModal({ open, onClose, igUserId }) {
  const [imageUrl, setImageUrl] = useState('');
  const [caption, setCaption] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!imageUrl.trim()) return;
    setSaving(true);
    try {
      await api('POST', '/api/instagram/publish', { image_url: imageUrl.trim(), caption });
      toast('Post publicado en Instagram', { tone: 'success', icon: 'check' });
      setImageUrl('');
      setCaption('');
      onClose(true);
    } catch (err) {
      const msg = err?.detail?.error?.message ?? err?.error ?? 'Error al publicar';
      toast(msg, { tone: 'error', icon: 'x' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={() => onClose(false)} title="Nuevo Post" kicker="Instagram" width={480}>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div>
          <label className="nx-kicker" style={{ display: 'block', marginBottom: 6 }}>URL de la imagen (pública)</label>
          <input className="nx-input" value={imageUrl} onChange={e => setImageUrl(e.target.value)}
            placeholder="https://..." required style={{ width: '100%' }} />
          <p className="nx-data" style={{ fontSize: 10, color: 'var(--txt-dim)', marginTop: 4 }}>
            La imagen debe ser accesible públicamente desde Internet (no localhost).
          </p>
        </div>
        <div>
          <label className="nx-kicker" style={{ display: 'block', marginBottom: 6 }}>Caption</label>
          <textarea className="nx-input" value={caption} onChange={e => setCaption(e.target.value)}
            rows={4} maxLength={2200} placeholder="Escribe algo..." style={{ width: '100%', resize: 'vertical' }} />
          <p className="nx-data" style={{ fontSize: 10, color: 'var(--txt-dim)', marginTop: 4, textAlign: 'right' }}>
            {caption.length}/2200
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <Btn kind="ghost" type="button" sm onClick={() => onClose(false)}>Cancelar</Btn>
          <Btn kind="accent" type="submit" sm icon="upload" disabled={saving || !imageUrl.trim()}>
            {saving ? 'Publicando…' : 'Publicar'}
          </Btn>
        </div>
      </form>
    </Modal>
  );
}

export default function InstagramView() {
  const [status, setStatus] = useState(null);   // null = cargando, false = no conectado, obj = conectado
  const [posts, setPosts] = useState([]);
  const [loadingPosts, setLoadingPosts] = useState(false);
  const [publishOpen, setPublishOpen] = useState(false);
  const [connecting, setConnecting] = useState(false);

  // Leer ?connected=1 o ?error=... en la URL (post-OAuth redirect)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('connected') === '1') {
      toast('Instagram conectado correctamente', { tone: 'success', icon: 'check' });
      window.history.replaceState({}, '', '/instagram');
    } else if (params.get('error')) {
      const msgs = {
        access_denied: 'Acceso denegado por el usuario.',
        no_ig_business_account: 'No se encontró una cuenta de Instagram Business vinculada a tu página de Facebook.',
        token_exchange_failed: 'Error al intercambiar el código de autorización.',
        invalid_state: 'Estado inválido. Intenta de nuevo.',
      };
      toast(msgs[params.get('error')] ?? `Error: ${params.get('error')}`, { tone: 'error', icon: 'x' });
      window.history.replaceState({}, '', '/instagram');
    }
  }, []);

  const loadStatus = useCallback(async () => {
    try {
      const data = await api('GET', '/api/instagram/status');
      setStatus(data);
    } catch {
      setStatus(false);
    }
  }, []);

  const loadPosts = useCallback(async () => {
    setLoadingPosts(true);
    try {
      const data = await api('GET', '/api/instagram/posts?limit=12');
      setPosts(data.posts ?? []);
    } catch {
      toast('No se pudieron cargar los posts', { tone: 'error', icon: 'x' });
    } finally {
      setLoadingPosts(false);
    }
  }, []);

  useEffect(() => { loadStatus(); }, [loadStatus]);

  useEffect(() => {
    if (status?.connected) loadPosts();
  }, [status?.connected, loadPosts]);

  const handleConnect = async () => {
    setConnecting(true);
    try {
      const { url } = await api('GET', '/api/instagram/redirect');
      window.location.href = url;
    } catch {
      toast('No se pudo iniciar la conexión', { tone: 'error', icon: 'x' });
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    if (!confirm('¿Desconectar tu cuenta de Instagram?')) return;
    try {
      await api('DELETE', '/api/instagram/disconnect');
      setStatus({ connected: false });
      setPosts([]);
      toast('Cuenta desconectada', { tone: 'info', icon: 'x' });
    } catch {
      toast('Error al desconectar', { tone: 'error', icon: 'x' });
    }
  };

  // --- Estado: cargando ---
  if (status === null) {
    return (
      <Panel title="Instagram" icon="camera">
        <p className="nx-data" style={{ color: 'var(--txt-dim)', fontSize: 12 }}>Verificando conexión…</p>
      </Panel>
    );
  }

  // --- Estado: no conectado ---
  if (!status.connected) {
    return (
      <Panel title="Conectar Instagram" kicker="Integración" icon="camera" style={{ maxWidth: 480 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: '4px 0' }}>
          <p style={{ color: 'var(--txt-dim)', fontSize: 13, lineHeight: 1.6, margin: 0 }}>
            Conecta tu cuenta de <strong style={{ color: 'var(--txt)' }}>Instagram Business o Creator</strong> para
            ver tus publicaciones y crear nuevos posts directamente desde Nexus.
          </p>
          <ul style={{ color: 'var(--txt-dim)', fontSize: 12, paddingLeft: 18, margin: 0, lineHeight: 1.8 }}>
            <li>Ver tus últimas publicaciones</li>
            <li>Publicar imágenes con caption</li>
            <li>Acceso solo a tu propia cuenta</li>
          </ul>
          <div style={{ paddingTop: 4 }}>
            <Btn kind="accent" icon="link" onClick={handleConnect} disabled={connecting}>
              {connecting ? 'Redirigiendo…' : 'Conectar con Meta'}
            </Btn>
          </div>
          <p className="nx-data" style={{ fontSize: 10, color: 'var(--txt-dim)', margin: 0 }}>
            Requiere cuenta Instagram Business o Creator vinculada a una Página de Facebook.
          </p>
        </div>
      </Panel>
    );
  }

  // --- Estado: conectado ---
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Header de cuenta */}
      <Panel
        icon="camera"
        title={`@${status.username ?? status.ig_user_id}`}
        kicker="Instagram conectado"
        right={
          <div style={{ display: 'flex', gap: 8 }}>
            <Btn kind="accent" icon="upload" sm onClick={() => setPublishOpen(true)}>Nuevo post</Btn>
            <Btn kind="ghost" icon="x" sm onClick={handleDisconnect}>Desconectar</Btn>
          </div>
        }
      >
        {status.expired && (
          <div style={{ padding: '8px 12px', background: 'rgba(255,107,107,.1)', border: '1px solid rgba(255,107,107,.3)',
            borderRadius: 'var(--radius-sm)', color: '#ff6b6b', fontSize: 12 }}>
            <Icon name="zap" size={12} /> El token de acceso expiró. Reconecta tu cuenta.
          </div>
        )}
      </Panel>

      {/* Grid de posts */}
      <Panel title="Publicaciones" kicker={`${posts.length} posts`} icon="camera"
        right={<Btn kind="ghost" icon="arrow" sm onClick={loadPosts} disabled={loadingPosts}>Actualizar</Btn>}>
        {loadingPosts ? (
          <p className="nx-data" style={{ color: 'var(--txt-dim)', fontSize: 12 }}>Cargando posts…</p>
        ) : posts.length === 0 ? (
          <p className="nx-data" style={{ color: 'var(--txt-dim)', fontSize: 12 }}>No hay publicaciones.</p>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 10 }}>
            {posts.map(post => <PostCard key={post.id} post={post} />)}
          </div>
        )}
      </Panel>

      <PublishModal open={publishOpen} onClose={(published) => { setPublishOpen(false); if (published) loadPosts(); }} />
    </div>
  );
}
