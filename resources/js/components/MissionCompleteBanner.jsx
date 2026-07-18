import { createPortal } from 'react-dom';
import { Btn, Icon } from './ui.jsx';

function summarize(items, limit = 2) {
  const list = (items ?? []).filter(Boolean);
  if (list.length === 0) return '';
  if (list.length <= limit) return list.join(' · ');
  return `${list.slice(0, limit).join(' · ')} +${list.length - limit}`;
}

export function MissionCompleteBanner({ open, mision, busy, onComplete, onClose }) {
  if (!open || !mision) return null;
  const completed = mision.status === 'completada' || mision.completada_por_mi;

  const objetivos = summarize((mision.objetivos ?? []).map(o => o.nombre), 2);
  const recompensas = summarize((mision.recompensas ?? []).map(r => {
    if (r.tipo === 'habilidad' && r.habilidad?.nombre) return r.habilidad.nombre;
    if (r.tipo === 'hito' && (r.hito || r.nombre)) return r.hito || r.nombre;
    return r.nombre ? `${r.nombre}${r.valor > 0 ? ` x${r.valor}` : ''}` : null;
  }), 2);

  return createPortal(
    <div style={{
      position: 'fixed',
      top: 12,
      left: '50%',
      transform: 'translateX(-50%)',
      width: 'min(760px, calc(100vw - 24px))',
      zIndex: 1250,
      pointerEvents: 'none',
    }}>
      <div className="nx-panel solid nx-panel-glow" style={{
        pointerEvents: 'auto',
        overflow: 'hidden',
        border: '1px solid rgba(230,179,37,0.45)',
        boxShadow: '0 12px 36px rgba(0,0,0,0.45), 0 0 28px rgba(230,179,37,0.18)',
        background: 'linear-gradient(180deg, rgba(11,15,27,0.98), rgba(6,9,18,0.99))',
      }}>
        <div style={{
          height: 3,
          background: 'linear-gradient(90deg, transparent, var(--holocron-oro), transparent)',
        }} />
        <div style={{ padding: '14px 16px 15px', display: 'grid', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
            <div style={{
              width: 40, height: 40, borderRadius: 10,
              display: 'grid', placeItems: 'center',
              border: '1px solid rgba(230,179,37,0.45)',
              background: 'rgba(230,179,37,0.08)',
              color: 'var(--holocron-oro)',
              flexShrink: 0,
            }}>
              <Icon name="check" size={18} />
            </div>

            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="nx-kicker" style={{ marginBottom: 4 }}>
                {completed ? 'MISION COMPLETADA' : 'MISION LISTA PARA COMPLETAR'}
              </div>
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--txt)', marginBottom: 4 }}>
                {mision.nombre}
              </div>
              {objetivos && (
                <div style={{ fontSize: 12, color: 'var(--txt-dim)', lineHeight: 1.5 }}>
                  Objetivos: {objetivos}
                </div>
              )}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
                {(mision.recompensas ?? []).length > 0 ? (
                  <span style={{
                    fontSize: 10,
                    padding: '3px 8px',
                    borderRadius: 999,
                    background: 'rgba(230,179,37,0.1)',
                    border: '1px solid rgba(230,179,37,0.22)',
                    color: '#E6B325',
                  }}>
                    Recompensa: {recompensas || 'Definida'}
                  </span>
                ) : (
                  <span style={{
                    fontSize: 10,
                    padding: '3px 8px',
                    borderRadius: 999,
                    background: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    color: 'var(--txt-faint)',
                  }}>
                    Sin recompensa definida
                  </span>
                )}
              </div>
            </div>

            {onClose && (
              <button
                type="button"
                onClick={onClose}
                style={{
                  background: 'none',
                  border: 'none',
                  padding: 4,
                  cursor: 'pointer',
                  color: 'var(--txt-faint)',
                  flexShrink: 0,
                }}
              >
                <Icon name="x" size={14} />
              </button>
            )}
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <Btn kind="accent" icon="check" onClick={onComplete} disabled={busy} sm>
              {busy ? 'Completando...' : 'Completar misión'}
            </Btn>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
