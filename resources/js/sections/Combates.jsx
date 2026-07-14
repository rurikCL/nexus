import { useState, useEffect, useRef, useCallback } from 'react';

function useWindowWidth() {
  const [w, setW] = useState(() => window.innerWidth);
  useEffect(() => {
    const fn = () => setW(window.innerWidth);
    window.addEventListener('resize', fn);
    return () => window.removeEventListener('resize', fn);
  }, []);
  return w;
}
import { NX } from '../data/seed.js';
import { Icon, Panel, Btn, Chip, Avatar, TierBadge, Stat, MedalIcon, Modal, toast, ImageSlot } from '../components/ui.jsx';

/* ===================== SCORING ===================== */

const CRITERIA = [
  { key: 'flujo',           title: 'Flujo y Ritmo',      desc: 'Continuidad, ausencia de tiempos muertos, cadencia dinámica',
    labels: ['Insuficiente', 'Bueno', 'Coherente', 'Excelente', 'Destacado'] },
  { key: 'fuerza',          title: 'Control de Fuerza',  desc: 'Equilibrio visual de potencia y seguridad física',
    labels: ['Excesivo', 'Controlado', 'Coherente', 'Impecable', 'Dominio técnico'] },
  { key: 'zona',            title: 'Control de Zona',    desc: 'Dominio de la arena, aprovechar el terreno y respetar límites',
    labels: ['Desorientado', 'Dentro de zona', 'Fluidez de espacio', 'Utiliza entorno', 'Excelencia'] },
  { key: 'tecnica',         title: 'Técnica y Forma',    desc: 'Precisión y ejecución del estilo de combate elegido',
    labels: ['Erróneo', 'Confuso', 'Reconocible', 'Correcto', 'Maestral'] },
  { key: 'caracterizacion', title: 'Caracterización',    desc: 'Inmersión en el rol, presencia escénica, uso de la fuerza',
    labels: ['Falta compromiso', 'Inmersión', 'Reconocible', 'Comprometido', 'Magistral'] },
];
const SCORE_VALS = [0, 0.5, 1, 1.5, 2];
const SCORE_LABELS = ['0', '½', '1', '1½', '2'];

const PENALTY_TYPES = [
  { key: 'leve',          label: 'Leve',          pts: 0.5 },
  { key: 'grave',         label: 'Grave',         pts: 1   },
  { key: 'muy_grave',     label: 'Muy Grave',     pts: 2   },
  { key: 'descalificado', label: 'Descalificado', pts: null },
];

function initScores() { return Object.fromEntries(CRITERIA.map(c => [c.key, null])); }
function sumScores(scores) { return CRITERIA.reduce((s, c) => s + (scores[c.key] ?? 0), 0); }
function sumPenalties(pens) {
  if (pens.includes('descalificado')) return Infinity;
  return pens.reduce((s, k) => s + (PENALTY_TYPES.find(p => p.key === k)?.pts ?? 0), 0);
}
const charImg = (c) => `/assets/${c.cls.charAt(0).toUpperCase() + c.cls.slice(1)}.png`;

function ScorePicker({ value, onChange, labels, color, sm }) {
  return (
    <div style={{ display: 'flex', gap: sm ? 2 : 3 }}>
      {SCORE_VALS.map((v, i) => {
        const sel = value === v;
        return (
          <button key={v} onClick={() => onChange(sel ? null : v)} title={labels[i]}
            className="nx-btn"
            style={{ padding: sm ? '4px 5px' : '5px 8px', minWidth: sm ? 27 : 34,
              fontSize: sm ? 10 : 11, justifyContent: 'center',
              fontFamily: 'var(--font-data)', letterSpacing: '0.02em',
              background: sel ? `color-mix(in srgb, ${color} 20%, transparent)` : undefined,
              borderColor: sel ? color : undefined,
              color: sel ? color : 'var(--txt-dim)' }}>
            {SCORE_LABELS[i]}
          </button>
        );
      })}
    </div>
  );
}

/* ── Centro VS cinematográfico con chispas ── */
function VsCenter({ saberA, saberB, isMobile, children }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const cvs = canvasRef.current;
    if (!cvs) return;
    const ctx = cvs.getContext('2d');
    const W = cvs.width, H = cvs.height;
    const CX = W / 2, CY = H / 2;
    const COLS = [saberA, saberB, '#E8B83A', '#FFFFFF'];

    function mkP() {
      const ang = Math.random() * Math.PI * 2;
      const spd = 0.9 + Math.random() * 2.4;
      return {
        x: CX, y: CY,
        vx: Math.cos(ang) * spd, vy: Math.sin(ang) * spd - 0.7,
        life: 0, max: 26 + Math.random() * 34,
        r: 0.7 + Math.random() * 1.5,
        c: COLS[Math.floor(Math.random() * COLS.length)],
      };
    }

    let ps = Array.from({ length: 16 }, mkP);
    let raf;

    function tick() {
      ctx.clearRect(0, 0, W, H);
      ps.forEach(p => {
        p.x += p.vx; p.y += p.vy;
        p.vy += 0.045; p.vx *= 0.986; p.life++;
        if (p.life > p.max) Object.assign(p, mkP());
        const t   = p.life / p.max;
        const alpha = (1 - t) * 0.88;
        const r   = p.r * (1 - t * 0.45);
        ctx.beginPath();
        ctx.arc(p.x, p.y, Math.max(0.1, r), 0, Math.PI * 2);
        ctx.fillStyle = p.c + Math.round(alpha * 255).toString(16).padStart(2, '0');
        ctx.fill();
      });
      raf = requestAnimationFrame(tick);
    }

    tick();
    return () => cancelAnimationFrame(raf);
  }, [saberA, saberB]);

  const cvW = isMobile ? 80 : 110;
  const cvH = isMobile ? 130 : 200;

  return (
    <div style={{ position: 'absolute', top: '50%', left: '50%',
      transform: 'translate(-50%, -50%)', zIndex: 20,
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      pointerEvents: 'none' }}>

      {/* Conduit energético superior */}
      <div style={{ width: 1, height: isMobile ? 28 : 44, marginBottom: -1,
        background: `linear-gradient(to top, transparent, ${saberA}CC)` }} />

      {/* Glifo VS */}
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <canvas ref={canvasRef} width={cvW} height={cvH}
          style={{ position: 'absolute', left: '50%', top: '50%',
            transform: 'translate(-50%, -50%)', width: cvW, height: cvH }} />
        <div className="nx-display" style={{
          fontSize: isMobile ? 46 : 72, lineHeight: 1, letterSpacing: '0.03em',
          background: `linear-gradient(180deg, ${saberA} 0%, #E8B83A 45%, ${saberB} 100%)`,
          WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
          animation: 'nx-vs-pulse 2.8s ease-in-out infinite',
          position: 'relative', zIndex: 1, userSelect: 'none' }}>VS</div>
      </div>

      {/* Conduit energético inferior */}
      <div style={{ width: 1, height: isMobile ? 28 : 44, marginTop: -1,
        background: `linear-gradient(to bottom, transparent, ${saberB}CC)` }} />

      {children}
    </div>
  );
}

export function ScoringScreen({ combat, onClose, S }) {
  const isMobile = useWindowWidth() < 640;
  const [scoresA,   setScoresA]   = useState(initScores);
  const [scoresB,   setScoresB]   = useState(initScores);
  const [pensA,     setPensA]     = useState([]);
  const [pensB,     setPensB]     = useState([]);
  const [feedbackA, setFeedbackA] = useState('');
  const [feedbackB, setFeedbackB] = useState('');

  useEffect(() => {
    setScoresA(initScores()); setScoresB(initScores()); setPensA([]); setPensB([]);
    setFeedbackA(''); setFeedbackB('');
  }, [combat?.id]);

  if (!combat) return null;
  const a = combat._a ?? S.byId(combat.a);
  const b = combat._b ?? S.byId(combat.b);

  const rawA = sumScores(scoresA), rawB = sumScores(scoresB);
  const penA = sumPenalties(pensA),  penB = sumPenalties(pensB);
  const dqA = pensA.includes('descalificado'), dqB = pensB.includes('descalificado');
  const totalA = dqA ? -Infinity : rawA - penA;
  const totalB = dqB ? -Infinity : rawB - penB;

  const allFilled = CRITERIA.every(c => scoresA[c.key] !== null && scoresB[c.key] !== null);
  const winner = dqA && dqB ? null : dqA ? 'b' : dqB ? 'a' : totalA > totalB ? 'a' : totalB > totalA ? 'b' : null;
  const canSubmit = allFilled && (winner !== null);

  const submit = async () => {
    const scoreData = { scoresA, scoresB, pensA, pensB };
    S.resolveCombatWithWinner(combat.id, winner, scoreData);
    onClose();
    const wName = (winner === 'a' ? a : b).name;
    toast('Resultado registrado', { tone: 'success', icon: 'trophy',
      desc: `Ganó ${wName} · ${(winner === 'a' ? rawA - penA : rawB - penB).toFixed(1)} pts` });

    // Si es un combate real (ID numérico), persiste en la BD
    if (typeof combat.id === 'number') {
      const token = localStorage.getItem('nx-token');
      try {
        await fetch(`/api/combats/${combat.id}/resolve`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ winner, score_data: scoreData, feedback_a: feedbackA || null, feedback_b: feedbackB || null }),
        });
      } catch { /* optimistic update ya aplicado */ }
    }
  };

  const saberA = a.saber, saberB = b.saber;
  const scoreA = dqA ? null : Math.max(0, rawA - penA);
  const scoreB = dqB ? null : Math.max(0, rawB - penB);

  return (
    <div className="nx-fade" style={{ display: 'grid', gap: 16 }}>

      {/* Topbar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <button className="nx-btn" onClick={onClose} style={{ gap: 7, padding: '7px 12px' }}>
          <Icon name="chevron" size={14} style={{ transform: 'rotate(180deg)' }} />
          <span style={{ fontSize: 12 }}>Volver</span>
        </button>
        <div style={{ flex: 1 }}>
          <div className="nx-kicker" style={{ fontSize: 9 }}>{combat.event} · {combat.round}</div>
          <div className="nx-display" style={{ fontSize: 14 }}>Evaluación de Combate</div>
        </div>
        {!isMobile && <Btn kind="accent" icon="trophy" onClick={submit} disabled={!canSubmit}>Registrar resultado</Btn>}
      </div>

      {/* VS hero — cinematic */}
      <div style={{ position: 'relative', height: isMobile ? 210 : 310, overflow: 'hidden',
        borderRadius: 'var(--radius)', border: '1px solid var(--holo-line)' }}>

        {/* Base oscuro */}
        <div style={{ position: 'absolute', inset: 0, background: '#030609' }} />

        {/* ── Fondo sable A: negro al borde izq → saberA al centro → transparente ── */}
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none',
          background: `linear-gradient(to right, #030609 0%, ${saberA}88 46%, transparent 58%)` }} />

        {/* ── Fondo sable B: negro al borde der → saberB al centro → transparente ── */}
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none',
          background: `linear-gradient(to left, #030609 0%, ${saberB}88 46%, transparent 58%)` }} />

        {/* ── Glow radial A desde la figura ── */}
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none',
          background: `radial-gradient(ellipse at 15% 100%, ${saberA}40 0%, transparent 50%)` }} />

        {/* ── Glow radial B desde la figura ── */}
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none',
          background: `radial-gradient(ellipse at 85% 100%, ${saberB}40 0%, transparent 50%)` }} />

        {/* ── FOTO A — encima del fondo coloreado, alto completo ── */}
        {a.photo_url ? (
          <img src={a.photo_url} alt={a.name}
            style={{ position: 'absolute', bottom: 0, left: 0,
              height: '100%', width: 'auto',
              objectFit: 'contain', objectPosition: 'left bottom',
              filter: `drop-shadow(0 0 22px ${saberA}80)`,
              WebkitMaskImage: 'linear-gradient(to right, black 45%, transparent 88%)',
              maskImage: 'linear-gradient(to right, black 45%, transparent 88%)' }} />
        ) : (
          <img src={charImg(a)} alt={a.name}
            style={{ position: 'absolute', bottom: 0, left: '8%',
              height: '97%', width: 'auto', objectFit: 'contain',
              filter: `drop-shadow(-6px 0 22px ${saberA}80)`,
              WebkitMaskImage: 'linear-gradient(to right, black 45%, transparent 88%)',
              maskImage: 'linear-gradient(to right, black 45%, transparent 88%)' }} />
        )}

        {/* ── FOTO B — encima del fondo coloreado, alto completo ── */}
        {b.photo_url ? (
          <img src={b.photo_url} alt={b.name}
            style={{ position: 'absolute', bottom: 0, right: 0,
              height: '100%', width: 'auto',
              objectFit: 'contain', objectPosition: 'right bottom',
              filter: `drop-shadow(0 0 22px ${saberB}80)`,
              WebkitMaskImage: 'linear-gradient(to left, black 45%, transparent 88%)',
              maskImage: 'linear-gradient(to left, black 45%, transparent 88%)' }} />
        ) : (
          <img src={charImg(b)} alt={b.name}
            style={{ position: 'absolute', bottom: 0, right: '8%',
              height: '97%', width: 'auto', objectFit: 'contain',
              transform: 'scaleX(-1)',
              filter: `drop-shadow(6px 0 22px ${saberB}80)`,
              WebkitMaskImage: 'linear-gradient(to left, black 45%, transparent 88%)',
              maskImage: 'linear-gradient(to left, black 45%, transparent 88%)' }} />
        )}

        {/* ── Línea diagonal de separación con glow ── */}
        <div style={{ position: 'absolute', inset: 0,
          clipPath: 'polygon(54% 0, 60% 0, 46% 100%, 40% 100%)',
          background: `linear-gradient(to bottom, ${saberB}55, rgba(255,255,255,0.55) 50%, ${saberA}55)`,
          filter: 'blur(5px)' }} />

        {/* Fade inferior para legibilidad del texto */}
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 110,
          background: 'linear-gradient(to top, rgba(3,6,9,0.92) 0%, rgba(3,6,9,0.55) 60%, transparent 100%)' }} />

        {/* ── Badges de clase (sólo con photo_url) ── */}
        {a.photo_url && (
          <img src={charImg(a)} alt=""
            style={{ position: 'absolute', bottom: 76, left: 12, height: 48, width: 'auto',
              objectFit: 'contain', opacity: 0.82, zIndex: 2,
              filter: `drop-shadow(0 0 10px ${saberA}cc)` }} />
        )}
        {b.photo_url && (
          <img src={charImg(b)} alt=""
            style={{ position: 'absolute', bottom: 76, right: 12, height: 48, width: 'auto',
              objectFit: 'contain', opacity: 0.82, zIndex: 2,
              filter: `drop-shadow(0 0 10px ${saberB}cc)` }} />
        )}

        {/* ── Puntaje A — arriba izquierda ── */}
        <div style={{ position: 'absolute', top: 12, left: 14 }}>
          <div className="nx-num" style={{ fontSize: isMobile ? 26 : 40, lineHeight: 1,
            color: dqA ? '#ff6b6b' : winner === 'a' ? 'var(--holocron-oro)' : 'rgba(255,255,255,0.9)',
            textShadow: `0 0 24px ${winner === 'a' ? 'var(--holocron-oro)' : saberA}66` }}>
            {dqA ? 'DQ' : (scoreA ?? '—')}
          </div>
          {penA > 0 && !dqA && (
            <div className="nx-data" style={{ fontSize: 9, color: '#ff6b6b', marginTop: 1 }}>−{penA.toFixed(1)} pen.</div>
          )}
        </div>

        {/* ── Puntaje B — arriba derecha ── */}
        <div style={{ position: 'absolute', top: 12, right: 14, textAlign: 'right' }}>
          <div className="nx-num" style={{ fontSize: isMobile ? 26 : 40, lineHeight: 1,
            color: dqB ? '#ff6b6b' : winner === 'b' ? 'var(--holocron-oro)' : 'rgba(255,255,255,0.9)',
            textShadow: `0 0 24px ${winner === 'b' ? 'var(--holocron-oro)' : saberB}66` }}>
            {dqB ? 'DQ' : (scoreB ?? '—')}
          </div>
          {penB > 0 && !dqB && (
            <div className="nx-data" style={{ fontSize: 9, color: '#ff6b6b', marginTop: 1 }}>−{penB.toFixed(1)} pen.</div>
          )}
        </div>

        {/* ── Info A — abajo izquierda ── */}
        <div style={{ position: 'absolute', bottom: 12, left: 14 }}>
          {winner === 'a' && (
            <div style={{ fontSize: 8, fontFamily: 'var(--font-data)', letterSpacing: '0.18em',
              color: 'var(--holocron-oro)', fontWeight: 700, marginBottom: 4,
              textShadow: '0 0 12px var(--holocron-oro)' }}>◆ GANADOR</div>
          )}
          <div className="nx-display" style={{ fontSize: isMobile ? 13 : 16, lineHeight: 1,
            letterSpacing: '0.06em', textTransform: 'uppercase',
            color: '#fff', textShadow: `0 0 18px ${saberA}88` }}>{a.name}</div>
          {!isMobile && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginTop: 5 }}>
              <TierBadge tier={a.tier} sm />
              <span className="nx-data" style={{ fontSize: 9, color: 'rgba(255,255,255,0.45)',
                letterSpacing: '0.08em' }}>{a.wins}W·{a.losses}L</span>
            </div>
          )}
        </div>

        {/* ── Info B — abajo derecha ── */}
        <div style={{ position: 'absolute', bottom: 12, right: 14, textAlign: 'right' }}>
          {winner === 'b' && (
            <div style={{ fontSize: 8, fontFamily: 'var(--font-data)', letterSpacing: '0.18em',
              color: 'var(--holocron-oro)', fontWeight: 700, marginBottom: 4,
              textShadow: '0 0 12px var(--holocron-oro)' }}>GANADOR ◆</div>
          )}
          <div className="nx-display" style={{ fontSize: isMobile ? 13 : 16, lineHeight: 1,
            letterSpacing: '0.06em', textTransform: 'uppercase',
            color: '#fff', textShadow: `0 0 18px ${saberB}88` }}>{b.name}</div>
          {!isMobile && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, justifyContent: 'flex-end', marginTop: 5 }}>
              <span className="nx-data" style={{ fontSize: 9, color: 'rgba(255,255,255,0.45)',
                letterSpacing: '0.08em' }}>{b.wins}W·{b.losses}L</span>
              <TierBadge tier={b.tier} sm />
            </div>
          )}
        </div>

        {/* ── VS — centro cinematográfico ── */}
        <VsCenter saberA={saberA} saberB={saberB} isMobile={isMobile}>
          {allFilled && winner === null && (
            <div className="nx-data" style={{ fontSize: 8, color: 'rgba(255,255,255,0.5)',
              letterSpacing: '0.22em', marginTop: 2 }}>EMPATE</div>
          )}
        </VsCenter>
      </div>

      {/* Tabla de evaluación */}
      <Panel kicker="Tabla de evaluación" title="Criterios de Puntuación" icon="target">
        {/* Cabecera de columnas — solo desktop */}
        {!isMobile && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 210px 210px', gap: 12, padding: '0 12px 8px', borderBottom: '1px solid var(--holo-line)' }}>
            <span className="nx-kicker" style={{ fontSize: 9 }}>Criterio</span>
            <span className="nx-kicker" style={{ fontSize: 9, textAlign: 'center', color: a.color }}>{a.name}</span>
            <span className="nx-kicker" style={{ fontSize: 9, textAlign: 'center', color: b.color }}>{b.name}</span>
          </div>
        )}

        <div style={{ display: 'grid', gap: 4, marginTop: 8 }}>
          {CRITERIA.map((cr) => (
            <div key={cr.key} className="nx-panel solid"
              style={{ padding: '12px', display: isMobile ? 'flex' : 'grid',
                flexDirection: isMobile ? 'column' : undefined,
                gridTemplateColumns: isMobile ? undefined : '1fr 210px 210px',
                gap: 12, alignItems: isMobile ? 'stretch' : 'center' }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{cr.title}</div>
                <div className="nx-data" style={{ fontSize: 10, color: 'var(--txt-faint)', marginTop: 2, lineHeight: 1.4 }}>{cr.desc}</div>
                {!isMobile && (
                  <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', columnGap: 8, rowGap: 2, marginTop: 8 }}>
                    {SCORE_VALS.map((v, i) => (
                      <>
                        <span key={`v-${v}`} className="nx-num" style={{ fontSize: 9, color: 'var(--txt-dim)', textAlign: 'right' }}>{SCORE_LABELS[i]}</span>
                        <span key={`l-${v}`} className="nx-data" style={{ fontSize: 9, color: 'var(--txt-faint)' }}>{cr.labels[i]}</span>
                      </>
                    ))}
                  </div>
                )}
              </div>
              {isMobile ? (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 4 }}>
                  <div>
                    <div style={{ fontSize: 9, fontFamily: 'var(--font-data)', color: a.color, marginBottom: 5 }}>{a.name}</div>
                    <ScorePicker sm value={scoresA[cr.key]} onChange={(v) => setScoresA(s => ({ ...s, [cr.key]: v }))} labels={cr.labels} color={a.color} />
                  </div>
                  <div>
                    <div style={{ fontSize: 9, fontFamily: 'var(--font-data)', color: b.color, marginBottom: 5 }}>{b.name}</div>
                    <ScorePicker sm value={scoresB[cr.key]} onChange={(v) => setScoresB(s => ({ ...s, [cr.key]: v }))} labels={cr.labels} color={b.color} />
                  </div>
                </div>
              ) : (
                <>
                  <div style={{ display: 'flex', justifyContent: 'center', alignSelf: 'center' }}>
                    <ScorePicker value={scoresA[cr.key]} onChange={(v) => setScoresA(s => ({ ...s, [cr.key]: v }))} labels={cr.labels} color={a.color} />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'center', alignSelf: 'center' }}>
                    <ScorePicker value={scoresB[cr.key]} onChange={(v) => setScoresB(s => ({ ...s, [cr.key]: v }))} labels={cr.labels} color={b.color} />
                  </div>
                </>
              )}
            </div>
          ))}

          {/* Fila totales */}
          {isMobile ? (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', marginTop: 4 }}>
              <div className="nx-kicker" style={{ fontSize: 9 }}>SUBTOTAL (máx. 10)</div>
              <div style={{ display: 'flex', gap: 18 }}>
                <div className="nx-num" style={{ fontSize: 18, color: a.color }}>{sumScores(scoresA).toFixed(1)}</div>
                <div className="nx-num" style={{ fontSize: 18, color: b.color }}>{sumScores(scoresB).toFixed(1)}</div>
              </div>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 210px 210px', gap: 12, padding: '10px 12px', marginTop: 4 }}>
              <div className="nx-kicker" style={{ fontSize: 9, alignSelf: 'center' }}>SUBTOTAL (máx. 10)</div>
              <div className="nx-num" style={{ fontSize: 20, textAlign: 'center', color: a.color }}>{sumScores(scoresA).toFixed(1)}</div>
              <div className="nx-num" style={{ fontSize: 20, textAlign: 'center', color: b.color }}>{sumScores(scoresB).toFixed(1)}</div>
            </div>
          )}
        </div>
      </Panel>

      {/* Penalizaciones */}
      <Panel kicker="Infracciones" title="Penalizaciones" icon="shield">
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 16 }}>
          {[{ fighter: a, pens: pensA, setPens: setPensA }, { fighter: b, pens: pensB, setPens: setPensB }].map(({ fighter, pens, setPens }) => (
            <div key={fighter.id}>
              <div style={{ fontSize: 11, fontWeight: 700, marginBottom: 10, color: fighter.color }}>{fighter.name}</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
                {PENALTY_TYPES.map((pt) => {
                  const active = pens.includes(pt.key);
                  const isDq = pt.key === 'descalificado';
                  return (
                    <button key={pt.key} onClick={() => setPens(p => active ? p.filter(x => x !== pt.key) : [...p, pt.key])}
                      className="nx-chip" style={{ cursor: 'pointer',
                        background: active ? `color-mix(in srgb, #ff6b6b 22%, transparent)` : undefined,
                        borderColor: active ? '#ff6b6b' : undefined,
                        color: active ? '#ff6b6b' : 'var(--txt-dim)' }}>
                      {isDq ? '⚠ Descalificado' : `${pt.label} −${pt.pts}`}
                    </button>
                  );
                })}
              </div>
              {pens.length > 0 && !pens.includes('descalificado') && (
                <div className="nx-data" style={{ fontSize: 10, color: '#ff6b6b', marginTop: 8 }}>
                  Total penalización: −{sumPenalties(pens).toFixed(1)} pts
                </div>
              )}
            </div>
          ))}
        </div>
        <div className="nx-data" style={{ fontSize: 10, color: 'var(--txt-faint)', marginTop: 14 }}>
          Los criterios detallados de penalización se configurarán próximamente.
        </div>
      </Panel>

      {/* Feedback */}
      <Panel kicker="Retroalimentación del árbitro" title="Feedback" icon="target">
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 16 }}>
          {[{ fighter: a, value: feedbackA, set: setFeedbackA }, { fighter: b, value: feedbackB, set: setFeedbackB }].map(({ fighter, value, set }) => (
            <div key={fighter.id}>
              <div style={{ fontSize: 11, fontWeight: 700, marginBottom: 8, color: fighter.color }}>{fighter.name}</div>
              <textarea
                className="nx-input"
                value={value}
                onChange={e => set(e.target.value)}
                placeholder={`Retroalimentación para ${fighter.name}...`}
                style={{ minHeight: 90, resize: 'vertical', fontSize: 12, lineHeight: 1.6, width: '100%', boxSizing: 'border-box' }}
              />
            </div>
          ))}
        </div>
      </Panel>

      {/* Footer acción */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, paddingBottom: 8, flexWrap: 'wrap' }}>
        <Btn onClick={onClose}>Cancelar</Btn>
        <Btn kind="accent" icon="trophy" onClick={submit} disabled={!canSubmit} style={isMobile ? { flex: 1, justifyContent: 'center' } : {}}>
          {!allFilled ? 'Completa los criterios' : winner === null ? 'Resultado empatado' : `Registrar — gana ${(winner === 'a' ? a : b).name}`}
        </Btn>
      </div>
    </div>
  );
}

/* ===================== VISTA DEL COMBATE (read-only) ===================== */

function ScoreDisplay({ value, color, sm }) {
  return (
    <div style={{ display: 'flex', gap: sm ? 2 : 3 }}>
      {SCORE_VALS.map((v, i) => {
        const sel = value === v;
        return (
          <div key={v} title={SCORE_LABELS[i]}
            style={{ padding: sm ? '4px 5px' : '5px 8px', minWidth: sm ? 27 : 34,
              fontSize: sm ? 10 : 11, textAlign: 'center',
              fontFamily: 'var(--font-data)', letterSpacing: '0.02em',
              borderRadius: 'var(--radius-sm)', border: `1px solid ${sel ? color : 'var(--holo-line)'}`,
              background: sel ? `color-mix(in srgb, ${color} 20%, transparent)` : 'transparent',
              color: sel ? color : 'var(--txt-faint)' }}>
            {SCORE_LABELS[i]}
          </div>
        );
      })}
    </div>
  );
}

export function CombatViewScreen({ combat, onClose, S }) {
  const isMobile = useWindowWidth() < 640;
  if (!combat) return null;
  const a = combat._a ?? S.byId(combat.a);
  const b = combat._b ?? S.byId(combat.b);

  const sd = combat.score_data ?? {};
  const scoresA = sd.scoresA ?? initScores();
  const scoresB = sd.scoresB ?? initScores();
  const pensA   = sd.pensA ?? [];
  const pensB   = sd.pensB ?? [];

  const rawA = sumScores(scoresA), rawB = sumScores(scoresB);
  const penA = sumPenalties(pensA), penB = sumPenalties(pensB);
  const dqA  = pensA.includes('descalificado'), dqB = pensB.includes('descalificado');
  const scoreA = dqA ? null : Math.max(0, rawA - penA);
  const scoreB = dqB ? null : Math.max(0, rawB - penB);
  const winner  = combat.winner;
  const saberA  = a.saber, saberB = b.saber;

  return (
    <div className="nx-fade" style={{ display: 'grid', gap: 16 }}>

      {/* Topbar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <button className="nx-btn" onClick={onClose} style={{ gap: 7, padding: '7px 12px' }}>
          <Icon name="chevron" size={14} style={{ transform: 'rotate(180deg)' }} />
          <span style={{ fontSize: 12 }}>Volver</span>
        </button>
        <div style={{ flex: 1 }}>
          <div className="nx-kicker" style={{ fontSize: 9 }}>{combat.event} · {combat.round}</div>
          <div className="nx-display" style={{ fontSize: 14 }}>Vista del Combate</div>
        </div>
        <Chip tone="green" icon="trophy">Resultado registrado</Chip>
      </div>

      {/* VS hero */}
      <div style={{ position: 'relative', height: isMobile ? 210 : 310, overflow: 'hidden',
        borderRadius: 'var(--radius)', border: '1px solid var(--holo-line)' }}>
        <div style={{ position: 'absolute', inset: 0, background: '#030609' }} />

        {/* ── Fondo sable A: negro al borde izq → saberA al centro → transparente ── */}
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none',
          background: `linear-gradient(to right, #030609 0%, ${saberA}88 46%, transparent 58%)` }} />

        {/* ── Fondo sable B: negro al borde der → saberB al centro → transparente ── */}
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none',
          background: `linear-gradient(to left, #030609 0%, ${saberB}88 46%, transparent 58%)` }} />

        {/* ── Glow radial A desde la figura ── */}
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none',
          background: `radial-gradient(ellipse at 15% 100%, ${saberA}40 0%, transparent 50%)` }} />

        {/* ── Glow radial B desde la figura ── */}
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none',
          background: `radial-gradient(ellipse at 85% 100%, ${saberB}40 0%, transparent 50%)` }} />

        {/* ── FOTO A — encima del fondo coloreado, alto completo ── */}
        {a.photo_url ? (
          <img src={a.photo_url} alt={a.name}
            style={{ position: 'absolute', bottom: 0, left: 0,
              height: '100%', width: 'auto',
              objectFit: 'contain', objectPosition: 'left bottom',
              filter: `drop-shadow(0 0 22px ${saberA}80)`,
              WebkitMaskImage: 'linear-gradient(to right, black 45%, transparent 88%)',
              maskImage: 'linear-gradient(to right, black 45%, transparent 88%)' }} />
        ) : (
          <img src={charImg(a)} alt={a.name}
            style={{ position: 'absolute', bottom: 0, left: '8%',
              height: '97%', width: 'auto', objectFit: 'contain',
              filter: `drop-shadow(-6px 0 22px ${saberA}80)`,
              WebkitMaskImage: 'linear-gradient(to right, black 45%, transparent 88%)',
              maskImage: 'linear-gradient(to right, black 45%, transparent 88%)' }} />
        )}

        {/* ── FOTO B — encima del fondo coloreado, alto completo ── */}
        {b.photo_url ? (
          <img src={b.photo_url} alt={b.name}
            style={{ position: 'absolute', bottom: 0, right: 0,
              height: '100%', width: 'auto',
              objectFit: 'contain', objectPosition: 'right bottom',
              filter: `drop-shadow(0 0 22px ${saberB}80)`,
              WebkitMaskImage: 'linear-gradient(to left, black 45%, transparent 88%)',
              maskImage: 'linear-gradient(to left, black 45%, transparent 88%)' }} />
        ) : (
          <img src={charImg(b)} alt={b.name}
            style={{ position: 'absolute', bottom: 0, right: '8%',
              height: '97%', width: 'auto', objectFit: 'contain',
              transform: 'scaleX(-1)',
              filter: `drop-shadow(6px 0 22px ${saberB}80)`,
              WebkitMaskImage: 'linear-gradient(to left, black 45%, transparent 88%)',
              maskImage: 'linear-gradient(to left, black 45%, transparent 88%)' }} />
        )}

        <div style={{ position: 'absolute', inset: 0,
          clipPath: 'polygon(54% 0, 60% 0, 46% 100%, 40% 100%)',
          background: `linear-gradient(to bottom, ${saberB}55, rgba(255,255,255,0.55) 50%, ${saberA}55)`,
          filter: 'blur(5px)' }} />

        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 110,
          background: 'linear-gradient(to top, rgba(3,6,9,0.92) 0%, rgba(3,6,9,0.55) 60%, transparent 100%)' }} />

        {/* ── Badges de clase (sólo con photo_url) ── */}
        {a.photo_url && (
          <img src={charImg(a)} alt=""
            style={{ position: 'absolute', bottom: 76, left: 12, height: 48, width: 'auto',
              objectFit: 'contain', opacity: 0.82, zIndex: 2,
              filter: `drop-shadow(0 0 10px ${saberA}cc)` }} />
        )}
        {b.photo_url && (
          <img src={charImg(b)} alt=""
            style={{ position: 'absolute', bottom: 76, right: 12, height: 48, width: 'auto',
              objectFit: 'contain', opacity: 0.82, zIndex: 2,
              filter: `drop-shadow(0 0 10px ${saberB}cc)` }} />
        )}

        <div style={{ position: 'absolute', top: 12, left: 14 }}>
          <div className="nx-num" style={{ fontSize: isMobile ? 26 : 40, lineHeight: 1,
            color: dqA ? '#ff6b6b' : winner === 'a' ? 'var(--holocron-oro)' : 'rgba(255,255,255,0.9)',
            textShadow: `0 0 24px ${winner === 'a' ? 'var(--holocron-oro)' : saberA}66` }}>
            {dqA ? 'DQ' : (scoreA ?? '—')}
          </div>
          {penA > 0 && !dqA && (
            <div className="nx-data" style={{ fontSize: 9, color: '#ff6b6b', marginTop: 1 }}>−{penA.toFixed(1)} pen.</div>
          )}
        </div>

        <div style={{ position: 'absolute', top: 12, right: 14, textAlign: 'right' }}>
          <div className="nx-num" style={{ fontSize: isMobile ? 26 : 40, lineHeight: 1,
            color: dqB ? '#ff6b6b' : winner === 'b' ? 'var(--holocron-oro)' : 'rgba(255,255,255,0.9)',
            textShadow: `0 0 24px ${winner === 'b' ? 'var(--holocron-oro)' : saberB}66` }}>
            {dqB ? 'DQ' : (scoreB ?? '—')}
          </div>
          {penB > 0 && !dqB && (
            <div className="nx-data" style={{ fontSize: 9, color: '#ff6b6b', marginTop: 1 }}>−{penB.toFixed(1)} pen.</div>
          )}
        </div>

        <div style={{ position: 'absolute', bottom: 12, left: 14 }}>
          {winner === 'a' && (
            <div style={{ fontSize: 8, fontFamily: 'var(--font-data)', letterSpacing: '0.18em',
              color: 'var(--holocron-oro)', fontWeight: 700, marginBottom: 4,
              textShadow: '0 0 12px var(--holocron-oro)' }}>◆ GANADOR</div>
          )}
          <div className="nx-display" style={{ fontSize: isMobile ? 13 : 16, lineHeight: 1,
            letterSpacing: '0.06em', textTransform: 'uppercase',
            color: '#fff', textShadow: `0 0 18px ${saberA}88` }}>{a.name}</div>
          {!isMobile && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginTop: 5 }}>
              <TierBadge tier={a.tier} sm />
              <span className="nx-data" style={{ fontSize: 9, color: 'rgba(255,255,255,0.45)',
                letterSpacing: '0.08em' }}>{a.wins}W·{a.losses}L</span>
            </div>
          )}
        </div>

        <div style={{ position: 'absolute', bottom: 12, right: 14, textAlign: 'right' }}>
          {winner === 'b' && (
            <div style={{ fontSize: 8, fontFamily: 'var(--font-data)', letterSpacing: '0.18em',
              color: 'var(--holocron-oro)', fontWeight: 700, marginBottom: 4,
              textShadow: '0 0 12px var(--holocron-oro)' }}>GANADOR ◆</div>
          )}
          <div className="nx-display" style={{ fontSize: isMobile ? 13 : 16, lineHeight: 1,
            letterSpacing: '0.06em', textTransform: 'uppercase',
            color: '#fff', textShadow: `0 0 18px ${saberB}88` }}>{b.name}</div>
          {!isMobile && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, justifyContent: 'flex-end', marginTop: 5 }}>
              <span className="nx-data" style={{ fontSize: 9, color: 'rgba(255,255,255,0.45)',
                letterSpacing: '0.08em' }}>{b.wins}W·{b.losses}L</span>
              <TierBadge tier={b.tier} sm />
            </div>
          )}
        </div>

        {/* ── VS — centro cinematográfico ── */}
        <VsCenter saberA={saberA} saberB={saberB} isMobile={isMobile} />
      </div>

      {/* Tabla de evaluación — read-only */}
      <Panel kicker="Evaluación registrada" title="Criterios de Puntuación" icon="target">
        {!isMobile && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 210px 210px', gap: 12, padding: '0 12px 8px', borderBottom: '1px solid var(--holo-line)' }}>
            <span className="nx-kicker" style={{ fontSize: 9 }}>Criterio</span>
            <span className="nx-kicker" style={{ fontSize: 9, textAlign: 'center', color: a.color }}>{a.name}</span>
            <span className="nx-kicker" style={{ fontSize: 9, textAlign: 'center', color: b.color }}>{b.name}</span>
          </div>
        )}

        <div style={{ display: 'grid', gap: 4, marginTop: 8 }}>
          {CRITERIA.map((cr) => (
            <div key={cr.key} className="nx-panel solid"
              style={{ padding: '12px', display: isMobile ? 'flex' : 'grid',
                flexDirection: isMobile ? 'column' : undefined,
                gridTemplateColumns: isMobile ? undefined : '1fr 210px 210px',
                gap: 12, alignItems: isMobile ? 'stretch' : 'center' }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{cr.title}</div>
                <div className="nx-data" style={{ fontSize: 10, color: 'var(--txt-faint)', marginTop: 2, lineHeight: 1.4 }}>{cr.desc}</div>
              </div>
              {isMobile ? (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 4 }}>
                  <div>
                    <div style={{ fontSize: 9, fontFamily: 'var(--font-data)', color: a.color, marginBottom: 5 }}>{a.name}</div>
                    <ScoreDisplay sm value={scoresA[cr.key]} color={a.color} />
                  </div>
                  <div>
                    <div style={{ fontSize: 9, fontFamily: 'var(--font-data)', color: b.color, marginBottom: 5 }}>{b.name}</div>
                    <ScoreDisplay sm value={scoresB[cr.key]} color={b.color} />
                  </div>
                </div>
              ) : (
                <>
                  <div style={{ display: 'flex', justifyContent: 'center' }}>
                    <ScoreDisplay value={scoresA[cr.key]} color={a.color} />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'center' }}>
                    <ScoreDisplay value={scoresB[cr.key]} color={b.color} />
                  </div>
                </>
              )}
            </div>
          ))}

          {isMobile ? (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', marginTop: 4 }}>
              <div className="nx-kicker" style={{ fontSize: 9 }}>SUBTOTAL (máx. 10)</div>
              <div style={{ display: 'flex', gap: 18 }}>
                <div className="nx-num" style={{ fontSize: 18, color: a.color }}>{rawA.toFixed(1)}</div>
                <div className="nx-num" style={{ fontSize: 18, color: b.color }}>{rawB.toFixed(1)}</div>
              </div>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 210px 210px', gap: 12, padding: '10px 12px', marginTop: 4 }}>
              <div className="nx-kicker" style={{ fontSize: 9, alignSelf: 'center' }}>SUBTOTAL (máx. 10)</div>
              <div className="nx-num" style={{ fontSize: 20, textAlign: 'center', color: a.color }}>{rawA.toFixed(1)}</div>
              <div className="nx-num" style={{ fontSize: 20, textAlign: 'center', color: b.color }}>{rawB.toFixed(1)}</div>
            </div>
          )}
        </div>
      </Panel>

      {/* Penalizaciones — read-only */}
      <Panel kicker="Infracciones" title="Penalizaciones" icon="shield">
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 16 }}>
          {[{ fighter: a, pens: pensA }, { fighter: b, pens: pensB }].map(({ fighter, pens }) => (
            <div key={fighter.id}>
              <div style={{ fontSize: 11, fontWeight: 700, marginBottom: 10, color: fighter.color }}>{fighter.name}</div>
              {pens.length === 0 ? (
                <div className="nx-data" style={{ fontSize: 11, color: 'var(--txt-faint)' }}>Sin penalizaciones</div>
              ) : (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
                  {pens.map((pk) => {
                    const pt = PENALTY_TYPES.find(p => p.key === pk);
                    return (
                      <div key={pk} className="nx-chip"
                        style={{ background: 'color-mix(in srgb, #ff6b6b 22%, transparent)', borderColor: '#ff6b6b', color: '#ff6b6b' }}>
                        {pt?.key === 'descalificado' ? '⚠ Descalificado' : `${pt?.label} −${pt?.pts}`}
                      </div>
                    );
                  })}
                </div>
              )}
              {pens.length > 0 && !pens.includes('descalificado') && (
                <div className="nx-data" style={{ fontSize: 10, color: '#ff6b6b', marginTop: 8 }}>
                  Total penalización: −{sumPenalties(pens).toFixed(1)} pts
                </div>
              )}
            </div>
          ))}
        </div>
      </Panel>

      {/* Feedback */}
      <Panel kicker="Retroalimentación del árbitro" title="Feedback" icon="target">
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 16 }}>
          {[{ fighter: a, text: combat.feedback_a }, { fighter: b, text: combat.feedback_b }].map(({ fighter, text }) => (
            <div key={fighter.id}>
              <div style={{ fontSize: 11, fontWeight: 700, marginBottom: 8, color: fighter.color }}>{fighter.name}</div>
              {text ? (
                <div style={{ fontSize: 12, lineHeight: 1.6, color: 'var(--txt-dim)',
                  background: 'var(--space-panel-solid)', border: '1px solid var(--holo-line)',
                  borderRadius: 'var(--radius-sm)', padding: '10px 12px', whiteSpace: 'pre-wrap' }}>
                  {text}
                </div>
              ) : (
                <div className="nx-data" style={{ fontSize: 11, color: 'var(--txt-faint)', fontStyle: 'italic' }}>
                  No hay feedback registrado
                </div>
              )}
            </div>
          ))}
        </div>
      </Panel>

    </div>
  );
}

/* NÉXUS — Ranking + Combates (eventos, apuestas, retar) */

/* ===================== RANKING ===================== */
export function RankingView({ S }) {
  const rk = S.ranking;
  const podium = rk.slice(0, 3);
  const rest = rk.slice(3);
  const order = [1, 0, 2]; // visual: 2º, 1º, 3º

  return (
    <div className="nx-fade" style={{ display: 'grid', gap: 18 }}>
      <Panel kicker="Temporada 3 · Liga Orbital" title="Escalera de Combate" icon="trophy"
        right={<div style={{ display: 'flex', gap: 6 }}>{Object.keys(NX.TIERS).map(k => <TierBadge key={k} tier={k} sm />)}</div>}>
        {/* Podio */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14, alignItems: 'end', marginBottom: 20 }}>
          {order.map((idx) => {
            const c = podium[idx]; if (!c) return <div key={idx} />;
            const place = idx + 1;
            const h = place === 1 ? 168 : place === 2 ? 138 : 116;
            const medal = place === 1 ? 'var(--holocron-oro)' : place === 2 ? '#cbd5e1' : '#cd7f32';
            return (
              <div key={c.id} className="nx-panel solid" style={{ padding: 16, textAlign: 'center', height: h, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', position: 'relative', borderColor: place === 1 ? 'var(--holocron-oro)' : undefined, boxShadow: place === 1 ? '0 0 30px -10px var(--holocron-oro)' : undefined }}>
                <div className="nx-num" style={{ position: 'absolute', top: 10, left: 0, right: 0, fontSize: place === 1 ? 30 : 22, color: medal }}>#{place}</div>
                <Avatar c={c} size={place === 1 ? 56 : 46} ring style={{ margin: '0 auto 8px' }} />
                <div style={{ fontWeight: 700, fontSize: place === 1 ? 15 : 13, color: c.id === 'you' ? 'var(--holocron-naranja)' : 'var(--txt)' }}>{c.name}</div>
                <div className="nx-num" style={{ fontSize: 13, color: medal, marginTop: 2 }}>{c.wins}W · {c.winrate}%</div>
              </div>
            );
          })}
        </div>

        {/* Tabla resto */}
        <div style={{ display: 'grid', gap: 6 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '36px 1fr 110px 70px 70px 90px', gap: 10, padding: '0 12px' }}>
            {['#', 'Combatiente', 'Tier', 'Récord', 'Efic.', 'Créditos'].map((h, i) => (
              <div key={h} className="nx-kicker" style={{ fontSize: 9, textAlign: i >= 3 ? 'right' : 'left' }}>{h}</div>
            ))}
          </div>
          {rest.map((c, i) => {
            const isYou = c.id === 'you';
            return (
              <div key={c.id} className="nx-panel solid" style={{ display: 'grid', gridTemplateColumns: '36px 1fr 110px 70px 70px 90px', gap: 10, padding: '10px 12px', alignItems: 'center', borderColor: isYou ? 'var(--holocron-naranja)' : undefined, background: isYou ? 'color-mix(in srgb, var(--holocron-naranja) 8%, var(--space-panel-solid))' : undefined }}>
                <span className="nx-num" style={{ fontSize: 15, color: 'var(--txt-faint)' }}>{i + 4}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                  <Avatar c={c} size={30} />
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: isYou ? 700 : 500, color: isYou ? 'var(--holocron-naranja)' : 'var(--txt)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.name}</div>
                    <div className="nx-data" style={{ fontSize: 10, color: 'var(--txt-faint)' }}>@{c.handle}</div>
                  </div>
                </div>
                <TierBadge tier={c.tier} sm />
                <span className="nx-num" style={{ fontSize: 13, textAlign: 'right' }}>{c.wins}-{c.losses}</span>
                <span className="nx-num" style={{ fontSize: 13, textAlign: 'right', color: 'var(--holo)' }}>{c.winrate}%</span>
                <span className="nx-num" style={{ fontSize: 13, textAlign: 'right', color: 'var(--holocron-oro)' }}>{(c.credits / 1000).toFixed(1)}k</span>
              </div>
            );
          })}
        </div>
      </Panel>
    </div>
  );
}

/* ===================== COMBATES ===================== */
export function CombatesView({ S, user, initialViewCombat, onClearViewCombat }) {
  const [bet,        setBet]        = useState(null);
  const [challenge,  setChallenge]  = useState(false);
  const [scoring,    setScoring]    = useState(null);
  const [viewing,    setViewing]    = useState(null);
  const [pending,    setPending]    = useState([]);
  const [accepting,  setAccepting]  = useState(null); // challenge a aceptar

  useEffect(() => {
    if (initialViewCombat) {
      setViewing(initialViewCombat);
      onClearViewCombat?.();
    }
  }, [initialViewCombat]);

  useEffect(() => {
    const token = localStorage.getItem('nx-token');
    if (!token) return;
    fetch('/api/challenges', { headers: { Accept: 'application/json', Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data?.challenges) setPending(data.challenges); })
      .catch(() => {});
  }, []);

  const handleReject = async (id) => {
    const token = localStorage.getItem('nx-token');
    await fetch(`/api/challenges/${id}/reject`, { method: 'POST', headers: { Accept: 'application/json', Authorization: `Bearer ${token}` } });
    setPending(p => p.filter(c => c.id !== id));
    toast('Desafío rechazado', { tone: 'dim', icon: 'x' });
  };

  if (viewing) {
    return <CombatViewScreen combat={viewing} onClose={() => setViewing(null)} S={S} />;
  }

  if (scoring) {
    return <ScoringScreen combat={scoring} onClose={() => setScoring(null)} S={S} />;
  }

  const incoming = pending.filter(c => c.target_id === user?.id);
  const outgoing = pending.filter(c => c.challenger_id === user?.id);

  return (
    <div className="nx-fade" style={{ display: 'grid', gap: 18 }}>
      {/* Header acción */}
      <div className="nx-panel" style={{ padding: 16, display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
        <span style={{ color: 'var(--holocron-naranja)' }}><Icon name="swords" size={22} /></span>
        <div style={{ flex: 1, minWidth: 200 }}>
          <div className="nx-display" style={{ fontSize: 15 }}>Arena de Combate</div>
          <div style={{ fontSize: 12, color: 'var(--txt-dim)' }}>Apuesta con tus créditos o reta a un combatiente a un duelo oficial.</div>
        </div>
        <div className="nx-panel solid" style={{ padding: '8px 14px', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ color: 'var(--holocron-oro)' }}><Icon name="coin" size={16} /></span>
          <span className="nx-num" style={{ fontSize: 18, color: 'var(--holocron-oro)' }}>{NX.fmtCLP(S.credits)}</span>
        </div>
        <Btn kind="accent" icon="swords" onClick={() => setChallenge(true)}>Retar combate</Btn>
      </div>

      {/* Desafíos recibidos */}
      {incoming.length > 0 && (
        <Panel kicker="Pendientes de respuesta" title="Desafíos Recibidos" icon="swords">
          <div style={{ display: 'grid', gap: 10 }}>
            {incoming.map(c => {
              const challenger = c.challenger?.character;
              const fechaProp  = c.fecha_desafio ? new Date(c.fecha_desafio).toLocaleString('es-CL', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'Sin fecha propuesta';
              return (
                <div key={c.id} className="nx-panel solid" style={{ padding: 14, display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap', borderColor: 'color-mix(in srgb, var(--holocron-naranja) 40%, transparent)' }}>
                  <div style={{ flex: 1, minWidth: 180 }}>
                    <div style={{ fontWeight: 700, fontSize: 14 }}>{challenger?.name ?? 'Combatiente'} <span style={{ color: 'var(--txt-faint)', fontWeight: 400 }}>te desafía</span></div>
                    <div className="nx-data" style={{ fontSize: 11, color: 'var(--txt-dim)', marginTop: 3 }}>
                      Apuesta: {NX.fmtCLP(c.stake)} · {fechaProp}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <Btn onClick={() => handleReject(c.id)}>Rechazar</Btn>
                    <Btn kind="accent" icon="check" onClick={() => setAccepting(c)}>Aceptar</Btn>
                  </div>
                </div>
              );
            })}
          </div>
        </Panel>
      )}

      {/* Desafíos enviados pendientes */}
      {outgoing.length > 0 && (
        <Panel kicker="En espera" title="Desafíos Enviados" icon="target">
          <div style={{ display: 'grid', gap: 10 }}>
            {outgoing.map(c => {
              const target    = c.target?.character;
              const fechaProp = c.fecha_desafio ? new Date(c.fecha_desafio).toLocaleString('es-CL', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'Sin fecha';
              return (
                <div key={c.id} className="nx-panel solid" style={{ padding: 14, display: 'flex', alignItems: 'center', gap: 14 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: 14 }}>vs {target?.name ?? 'Combatiente'}</div>
                    <div className="nx-data" style={{ fontSize: 11, color: 'var(--txt-dim)', marginTop: 3 }}>Apuesta: {NX.fmtCLP(c.stake)} · {fechaProp}</div>
                  </div>
                  <Chip tone="dim">Esperando respuesta</Chip>
                </div>
              );
            })}
          </div>
        </Panel>
      )}

      {/* Combates oficiales + apuestas */}
      <Panel kicker="Cartelera oficial" title="Combates y Apuestas" icon="target"
        right={<Chip tone="dim" icon="coin">{S.bets.length} apuestas activas</Chip>}>
        <div style={{ display: 'grid', gap: 14 }}>
          {S.combats.length === 0
            ? <div style={{ textAlign: 'center', padding: 24, color: 'var(--txt-faint)', fontSize: 12 }}>No hay combates en cartelera</div>
            : S.combats.map((m) => <CombatCard key={m.id} m={m} S={S} user={user} onBet={(pick) => setBet({ combat: m, pick })} onScore={() => setScoring(m)} onView={m.resolved ? () => setViewing(m) : undefined} />)}
        </div>
      </Panel>

      {/* Mis apuestas */}
      {S.bets.length > 0 && (
        <Panel kicker="Tu cartera" title="Mis Apuestas" icon="coin">
          <div style={{ display: 'grid', gap: 10 }}>
            {S.bets.map((b) => {
              const m = S.combats.find(x => x.id === b.combatId);
              const fighter = b.pick === 'a' ? (m?._a ?? S.byId(m?.a)) : (m?._b ?? S.byId(m?.b));
              return (
                <div key={b.id} className="nx-panel solid" style={{ padding: 12, display: 'flex', alignItems: 'center', gap: 12 }}>
                  <Avatar c={fighter} size={34} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{fighter?.name ?? '—'}</div>
                    <div className="nx-data" style={{ fontSize: 11, color: 'var(--txt-faint)' }}>{m?.event} · cuota {b.odds}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div className="nx-num" style={{ fontSize: 14, color: 'var(--holocron-oro)' }}>{NX.fmtCLP(b.amount)}</div>
                    <Chip tone={b.status === 'ganada' ? 'green' : b.status === 'perdida' ? 'red' : 'dim'} style={{ marginTop: 4 }}>
                      {b.status === 'abierta' ? `posible +${NX.fmtCLP(Math.round(b.amount * b.odds))}` : b.status === 'ganada' ? `ganaste +${NX.fmtCLP(Math.round(b.amount * b.odds))}` : 'perdida'}
                    </Chip>
                  </div>
                </div>
              );
            })}
          </div>
        </Panel>
      )}

      <BetModal data={bet} onClose={() => setBet(null)} S={S} />
      <ChallengeModal open={challenge} onClose={() => setChallenge(false)} S={S} />
      <AcceptChallengeModal
        challenge={accepting}
        onClose={() => setAccepting(null)}
        onAccepted={(id) => {
          setPending(p => p.filter(c => c.id !== id));
          setAccepting(null);
        }}
        S={S}
      />
    </div>
  );
}

export function CombatCard({ m, S, user, onBet, onScore, onView }) {
  const a = m._a ?? S.byId(m.a);
  const b = m._b ?? S.byId(m.b);
  const myBet = S.bets.find(x => x.combatId === m.id);
  const isJuez = user?.roles?.includes('juez');
  const Fighter = ({ c, side, odds }) => (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, textAlign: 'center' }}>
      <Avatar c={c} size={52} ring />
      <div>
        <div style={{ fontWeight: 700, fontSize: 14 }}>{c.name}</div>
        <div className="nx-data" style={{ fontSize: 11, color: 'var(--txt-faint)' }}>{c.wins}W-{c.losses}L</div>
      </div>
      <button disabled={m.resolved || (myBet && myBet.pick !== side)} onClick={() => onBet(side)}
        className="nx-btn" style={{
          width: '100%', justifyContent: 'center', flexDirection: 'column', gap: 2, padding: '8px',
          borderColor: myBet && myBet.pick === side ? 'var(--holocron-oro)' : undefined,
          background: myBet && myBet.pick === side ? 'color-mix(in srgb, var(--holocron-oro) 16%, transparent)' : undefined }}>
        <span style={{ fontSize: 9, color: 'var(--txt-dim)' }}>CUOTA</span>
        <span className="nx-num" style={{ fontSize: 18, color: 'var(--holo)' }}>{odds.toFixed(2)}</span>
      </button>
    </div>
  );
  return (
    <div className="nx-panel solid" style={{ padding: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <Chip tone="dim">{m.event} · {m.round}</Chip>
        <span className="nx-data" style={{ fontSize: 11, color: m.live ? '#ff6b6b' : 'var(--txt-faint)', display: 'flex', alignItems: 'center', gap: 6 }}>
          {m.live && <span className="nx-live-dot" style={{ width: 6, height: 6 }} />}{m.live ? 'EN VIVO' : m.when}
        </span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <Fighter c={a} side="a" odds={m.oddsA} />
        <div className="nx-display" style={{ fontSize: 20, color: 'var(--holocron-naranja)', opacity: 0.8 }}>VS</div>
        <Fighter c={b} side="b" odds={m.oddsB} />
      </div>
      {!m.resolved ? (
        isJuez && (
          <div style={{ display: 'flex', justifyContent: 'center', marginTop: 14 }}>
            <Btn sm kind="accent" icon="target" onClick={onScore}>Puntuar combate</Btn>
          </div>
        )
      ) : (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 10, marginTop: 14, flexWrap: 'wrap' }}>
          <Chip tone="green" icon="trophy">Ganó {(m.winner === 'a' ? a : b).name}</Chip>
          {onView && <Btn sm onClick={onView}>Ver evaluación</Btn>}
        </div>
      )}
    </div>
  );
}

export function BetModal({ data, onClose, S }) {
  const [amt, setAmt] = useState(200);
  useEffect(() => { if (data) setAmt(200); }, [data]);
  if (!data) return null;
  const { combat, pick } = data;
  const fighter = pick === 'a' ? (combat._a ?? S.byId(combat.a)) : (combat._b ?? S.byId(combat.b));
  const odds = pick === 'a' ? combat.oddsA : combat.oddsB;
  const payout = Math.round(amt * odds);
  const QUICK = [100, 250, 500, 1000];
  const place = () => {
    if (amt > S.credits) { toast('Créditos insuficientes', { tone: 'error', icon: 'x' }); return; }
    if (amt <= 0) return;
    S.placeBet({ combatId: combat.id, pick, amount: amt, odds });
    onClose();
    toast('Apuesta registrada', { tone: 'success', icon: 'coin', desc: `${NX.fmtCLP(amt)} a ${fighter.name} · posible ${NX.fmtCLP(payout)}` });
  };
  return (
    <Modal open={!!data} onClose={onClose} kicker={`${combat.event} · cuota ${odds.toFixed(2)}`} title={`Apostar a ${fighter.name}`} width={460}>
      <div style={{ display: 'grid', gap: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, justifyContent: 'center' }}>
          <Avatar c={fighter} size={56} ring />
          <div><div style={{ fontWeight: 700, fontSize: 16 }}>{fighter.name}</div><TierBadge tier={fighter.tier} sm /></div>
        </div>
        <div>
          <label className="nx-label">Monto a apostar</label>
          <input className="nx-input nx-data" type="number" value={amt} onChange={(e) => setAmt(+e.target.value)} style={{ fontSize: 18 }} />
          <div style={{ display: 'flex', gap: 7, marginTop: 9 }}>
            {QUICK.map(q => <button key={q} className="nx-chip dim" style={{ cursor: 'pointer', flex: 1, justifyContent: 'center' }} onClick={() => setAmt(q)}>{q}</button>)}
            <button className="nx-chip dim" style={{ cursor: 'pointer', flex: 1, justifyContent: 'center' }} onClick={() => setAmt(S.credits)}>MAX</button>
          </div>
        </div>
        <div className="nx-panel" style={{ padding: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div><div className="nx-kicker">Ganancia potencial</div><div className="nx-num" style={{ fontSize: 24, color: 'var(--holocron-oro)' }}>{NX.fmtCLP(payout)}</div></div>
          <div style={{ textAlign: 'right' }}><div className="nx-kicker">Tu saldo</div><div className="nx-num" style={{ fontSize: 16, color: amt > S.credits ? '#ff6b6b' : 'var(--txt)' }}>{NX.fmtCLP(S.credits)}</div></div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <Btn onClick={onClose}>Cancelar</Btn>
          <Btn kind="gold" icon="coin" onClick={place} disabled={amt > S.credits || amt <= 0}>Confirmar apuesta</Btn>
        </div>
      </div>
    </Modal>
  );
}

export function ChallengeModal({ open, onClose, S, initialOppId }) {
  const opponents = S.combatants.filter(c => c.id !== 'you');
  const [oppId,  setOppId]  = useState(initialOppId ?? opponents[0]?.id ?? null);
  const [stake,  setStake]  = useState(300);
  const [msg,    setMsg]    = useState('');
  const [fecha,  setFecha]  = useState('');
  const [picking,  setPicking]  = useState(false);
  const [sending,  setSending]  = useState(false);

  useEffect(() => {
    if (open) { setOppId(initialOppId ?? opponents[0]?.id ?? null); setStake(300); setMsg(''); setFecha(''); }
  }, [open, initialOppId]);
  if (!open) return null;

  const opp = S.byId(oppId);
  if (!opp) return null;

  const submit = async () => {
    if (stake > S.credits) { toast('No tienes créditos para esa apuesta', { tone: 'error', icon: 'x' }); return; }
    setSending(true);
    try {
      if (opp.userId) {
        // Usuario real — llama a la API
        const token = localStorage.getItem('nx-token');
        const res = await fetch('/api/challenges', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ target_id: opp.userId, stake, fecha_desafio: fecha || null }),
        });
        if (!res.ok) throw new Error('Error al enviar desafío');
      } else {
        // Combatiente demo (seed) — acción local
        S.createChallenge(oppId, stake);
      }
      onClose();
      toast(`Desafío enviado a ${opp.name}`, { tone: 'success', icon: 'swords', desc: 'Combate oficial pendiente de aceptación' });
    } catch {
      toast('No se pudo enviar el desafío', { tone: 'error', icon: 'x' });
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      <Modal open={open} onClose={onClose} kicker="Duelo oficial" title="Retar a Combate" width={480}>
        <div style={{ display: 'grid', gap: 16 }}>

          {/* Oponente seleccionado */}
          <div>
            <label className="nx-label">Oponente</label>
            <button onClick={() => setPicking(true)} className="nx-panel solid" style={{
              width: '100%', padding: '12px 14px', cursor: 'pointer', display: 'flex',
              alignItems: 'center', gap: 12, textAlign: 'left',
              borderColor: 'var(--holo-line)', transition: 'border-color .15s' }}
              onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--holo)'}
              onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--holo-line)'}>
              <Avatar c={opp} size={40} ring />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 14 }}>{opp.name}</div>
                <div className="nx-data" style={{ fontSize: 11, color: 'var(--txt-faint)' }}>
                  {opp.wins}W-{opp.losses}L · @{opp.handle}
                </div>
              </div>
              <TierBadge tier={opp.tier} sm />
              <span style={{ color: 'var(--txt-faint)' }}><Icon name="chevron" size={16} /></span>
            </button>
          </div>

          <div>
            <label className="nx-label">Apuesta del duelo (créditos)</label>
            <input className="nx-input nx-data" type="number" value={stake} onChange={(e) => setStake(+e.target.value)} style={{ fontSize: 16 }} />
          </div>
          <div>
            <label className="nx-label">Fecha propuesta del combate</label>
            <input className="nx-input" type="datetime-local" value={fecha} onChange={(e) => setFecha(e.target.value)} />
          </div>
          <div>
            <label className="nx-label">Mensaje (opcional)</label>
            <input className="nx-input" value={msg} onChange={(e) => setMsg(e.target.value)} placeholder="Te espero en la arena..." />
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
            <Btn onClick={onClose}>Cancelar</Btn>
            <Btn kind="accent" icon="swords" onClick={submit} disabled={stake > S.credits || sending}>
              {sending ? 'Enviando...' : 'Enviar desafío'}
            </Btn>
          </div>
        </div>
      </Modal>

      {/* Modal secundario: selector de oponente */}
      <FighterPickerModal
        open={picking}
        opponents={opponents}
        selected={oppId}
        onPick={(id) => { setOppId(id); setPicking(false); }}
        onClose={() => setPicking(false)}
      />
    </>
  );
}

function FighterPickerModal({ open, opponents, selected, onPick, onClose }) {
  const [q, setQ] = useState('');
  useEffect(() => { if (open) setQ(''); }, [open]);

  const filtered = opponents.filter(c =>
    !q || `${c.name} ${c.handle}`.toLowerCase().includes(q.toLowerCase())
  );

  return (
    <Modal open={open} onClose={onClose} kicker="Elige tu rival" title="Seleccionar Oponente" width={520}>
      <div style={{ display: 'grid', gap: 14 }}>
        <div style={{ position: 'relative' }}>
          <span style={{ position: 'absolute', left: 11, top: 11, color: 'var(--txt-faint)' }}>
            <Icon name="filter" size={15} />
          </span>
          <input
            className="nx-input"
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder="Buscar combatiente..."
            style={{ paddingLeft: 34 }}
            autoFocus
          />
        </div>

        <div style={{ display: 'grid', gap: 8, maxHeight: 340, overflowY: 'auto', paddingRight: 4 }}>
          {filtered.map(c => {
            const active = c.id === selected;
            return (
              <button key={c.id} onClick={() => onPick(c.id)} className="nx-panel solid" style={{
                padding: '12px 14px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12,
                textAlign: 'left', transition: 'all .15s',
                borderColor: active ? 'var(--holocron-naranja)' : undefined,
                background: active ? 'color-mix(in srgb, var(--holocron-naranja) 12%, var(--space-panel-solid))' : undefined }}>
                <Avatar c={c} size={40} ring />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>{c.name}</div>
                  <div className="nx-data" style={{ fontSize: 11, color: 'var(--txt-faint)' }}>
                    {c.wins}W-{c.losses}L · {c.winrate}% efic.
                  </div>
                </div>
                <TierBadge tier={c.tier} sm />
                {active && <span style={{ color: 'var(--holocron-naranja)' }}><Icon name="check" size={16} /></span>}
              </button>
            );
          })}
          {filtered.length === 0 && (
            <div style={{ textAlign: 'center', padding: 24, color: 'var(--txt-faint)' }} className="nx-data">
              Sin resultados
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}

/* ---- Modal aceptar desafío ---- */
function AcceptChallengeModal({ challenge, onClose, onAccepted, S }) {
  const [fecha,   setFecha]   = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (challenge?.fecha_desafio) {
      const d = new Date(challenge.fecha_desafio);
      const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
      setFecha(local);
    } else {
      setFecha('');
    }
  }, [challenge]);

  if (!challenge) return null;

  const challenger = challenge.challenger?.character;

  const submit = async () => {
    setSending(true);
    try {
      const token = localStorage.getItem('nx-token');
      const res = await fetch(`/api/challenges/${challenge.id}/accept`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ fecha_desafio: fecha || null }),
      });
      if (!res.ok) throw new Error('Error al aceptar');
      const data = await res.json();
      if (data.combat) {
        S.setCombats(prev => [data.combat, ...prev.filter(c => c.id !== data.combat.id)]);
      }
      toast('Desafío aceptado', { tone: 'success', icon: 'swords', desc: `Combate agendado con ${challenger?.name ?? 'tu rival'}` });
      onAccepted(challenge.id);
    } catch {
      toast('No se pudo aceptar el desafío', { tone: 'error', icon: 'x' });
    } finally {
      setSending(false);
    }
  };

  return (
    <Modal open={!!challenge} onClose={onClose} kicker="Responder desafío" title="Aceptar Combate" width={440}>
      <div style={{ display: 'grid', gap: 16 }}>
        <div style={{ padding: '12px 14px', background: 'color-mix(in srgb, var(--holocron-naranja) 10%, transparent)', border: '1px solid color-mix(in srgb, var(--holocron-naranja) 30%, transparent)', borderRadius: 'var(--radius-md)', fontSize: 13 }}>
          <span style={{ fontWeight: 700 }}>{challenger?.name ?? 'Combatiente'}</span> te ha retado a duelo.
          <div className="nx-data" style={{ fontSize: 11, color: 'var(--txt-faint)', marginTop: 4 }}>
            Apuesta: {NX.fmtCLP(challenge.stake)}
          </div>
        </div>
        <div>
          <label className="nx-label">Fecha del combate</label>
          <div style={{ fontSize: 11, color: 'var(--txt-faint)', marginBottom: 6 }}>
            {challenge.fecha_desafio ? 'Fecha propuesta — puedes modificarla.' : 'No se propuso fecha, elige una.'}
          </div>
          <input className="nx-input" type="datetime-local" value={fecha} onChange={e => setFecha(e.target.value)} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <Btn onClick={onClose}>Cancelar</Btn>
          <Btn kind="accent" icon="swords" onClick={submit} disabled={sending}>
            {sending ? 'Aceptando...' : 'Confirmar combate'}
          </Btn>
        </div>
      </div>
    </Modal>
  );
}

