import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ICON_PATHS } from './ui.jsx';

/* Duplicado liviano de resources/js/components/PvpCombatScreen.jsx#mediaUrl —
   se mantiene local para no acoplar este módulo (uso puntual, sin estado) al
   componente de la pantalla de combate. */
function mediaUrl(path) {
  if (!path) return null;
  if (/^(https?:)?\/\//.test(path) || path.startsWith('data:') || path.startsWith('blob:')) return path;
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  if (cleanPath.startsWith('/storage/')) return cleanPath;
  if (cleanPath.startsWith('/admin/'))   return `/storage${cleanPath}`;
  if (cleanPath.startsWith('/public/'))  return cleanPath.replace('/public/', '/storage/');
  return `/storage${cleanPath}`;
}

/** Suma daño infligido, curación y críticos por bando a partir del log de un combate PvP. */
export function summarizeCombat(combat) {
  const log = combat.log ?? [];
  const mk = () => ({ dmgDealt: 0, healDone: 0, crits: 0 });
  const totals = { [combat.attacker.id]: mk(), [combat.defender.id]: mk() };
  for (const entry of log) {
    const side = totals[entry.actor_id];
    if (!side) continue; // entrada inicial de iniciativa (ronda 1), sin actor
    for (const m of entry.messages ?? []) {
      const dmgMatch = m.match(/−(\d+) daño/);
      if (dmgMatch) side.dmgDealt += Number(dmgMatch[1]);
      if (/¡CRÍTICO!/.test(m)) side.crits += 1;
      const healMatch = m.match(/\+(\d+) (?:vida|escudo)/);
      if (healMatch) side.healDone += Number(healMatch[1]);
    }
  }
  return {
    rounds: combat.ronda ?? 1,
    attacker: totals[combat.attacker.id],
    defender: totals[combat.defender.id],
  };
}

/** Igual que summarizeCombat pero para el log plano (un mensaje por entrada) de NpcCombatScreen. */
export function summarizeNpcLog(log = []) {
  const mk = () => ({ dmgDealt: 0, healDone: 0, crits: 0 });
  const totals = { player: mk(), npc: mk() };
  let rounds = 1;
  for (const entry of log) {
    rounds = Math.max(rounds, entry.ronda ?? 1);
    const side = totals[entry.actor];
    if (!side) continue; // entradas 'system' (iniciativa, cambio de estancia, etc.)
    const dmgMatch = entry.text.match(/−(\d+) daño/);
    if (dmgMatch) side.dmgDealt += Number(dmgMatch[1]);
    if (/¡CRÍTICO!/.test(entry.text)) side.crits += 1;
    const healMatch = entry.text.match(/\+(\d+) (?:vida|escudo)/);
    if (healMatch) side.healDone += Number(healMatch[1]);
  }
  return { rounds, player: totals.player, npc: totals.npc };
}

function loadImage(src) {
  return new Promise((resolve) => {
    if (!src) { resolve(null); return; }
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

async function ensureFonts() {
  if (!document.fonts) return;
  try {
    await document.fonts.ready;
    await Promise.all([
      document.fonts.load('800 64px Orbitron'),
      document.fonts.load('800 34px Orbitron'),
      document.fonts.load('700 26px Orbitron'),
      document.fonts.load('600 22px "JetBrains Mono"'),
      document.fonts.load('400 20px "JetBrains Mono"'),
    ]);
  } catch { /* si las fuentes no cargan a tiempo, se usa el fallback del sistema */ }
}

/** Dibuja un ícono de resources/js/components/ui.jsx (viewBox 24x24) centrado en (cx, cy) con tamaño `size`. */
function drawIcon(ctx, name, cx, cy, size, color, strokeWidth = 1.8) {
  const d = ICON_PATHS[name];
  if (!d) return;
  ctx.save();
  ctx.translate(cx - size / 2, cy - size / 2);
  ctx.scale(size / 24, size / 24);
  ctx.strokeStyle = color;
  ctx.lineWidth = strokeWidth;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (const seg of d.split('M').filter(Boolean)) {
    ctx.stroke(new Path2D(`M${seg}`));
  }
  ctx.restore();
}

function drawAvatar(ctx, img, cx, cy, r, ringColor, isNave) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.closePath();
  ctx.clip();
  ctx.fillStyle = '#0a1428';
  ctx.fill();
  if (img) {
    const scale = Math.max((r * 2) / img.width, (r * 2) / img.height);
    const w = img.width * scale;
    const h = img.height * scale;
    ctx.drawImage(img, cx - w / 2, cy - h / 2, w, h);
  }
  ctx.restore();

  ctx.save();
  ctx.shadowColor = ringColor;
  ctx.shadowBlur = 26;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.lineWidth = 6;
  ctx.strokeStyle = ringColor;
  ctx.stroke();
  ctx.restore();

  if (!img) {
    drawIcon(ctx, isNave ? 'ship' : 'user', cx, cy, r * 0.9, 'rgba(150,200,255,0.5)', 2.2);
  }
}

function fitText(ctx, text, maxWidth, baseFont, minFont = 18) {
  let size = parseInt(baseFont, 10);
  const rest = baseFont.replace(/^\d+px\s*/, '');
  while (size > minFont) {
    ctx.font = `${size}px ${rest}`;
    if (ctx.measureText(text).width <= maxWidth) break;
    size -= 2;
  }
  ctx.font = `${size}px ${rest}`;
  return size;
}

/**
 * Núcleo de dibujo compartido por la tarjeta PvP y la de combate contra NPC:
 * layout, tipografía y estallidos son idénticos — solo cambian los datos.
 *
 * - `winner`/`loser`: { name, handle?, imageSrc, isNave } — el ganador siempre
 *   se dibuja a la izquierda con el anillo dorado y la corona.
 * - `rows`: [{ icon, label, color, left, right }] — `left` es el valor del
 *   ganador, `right` el del perdedor.
 */
async function renderResultCard({ winner, loser, rounds, subtitle, rows }) {
  await ensureFonts();

  const W = 1080;
  const H = 1350;
  const DPR = 2;
  const canvas = document.createElement('canvas');
  canvas.width = W * DPR;
  canvas.height = H * DPR;
  const ctx = canvas.getContext('2d');
  ctx.scale(DPR, DPR);

  const [winnerImg, loserImg] = await Promise.all([
    loadImage(winner.imageSrc),
    loadImage(loser.imageSrc),
  ]);

  /* ── fondo ── */
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#070d1c');
  bg.addColorStop(1, '#01030a');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  ctx.save();
  ctx.filter = 'blur(70px)';
  const glow = ctx.createRadialGradient(W / 2, 480, 40, W / 2, 480, 420);
  glow.addColorStop(0, 'rgba(56,205,240,0.16)');
  glow.addColorStop(1, 'rgba(56,205,240,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);
  ctx.restore();

  ctx.strokeStyle = 'rgba(56,205,240,0.06)';
  ctx.lineWidth = 1;
  for (let y = 0; y < H; y += 60) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
  for (let x = 0; x < W; x += 60) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }

  ctx.strokeStyle = 'rgba(56,205,240,0.35)';
  ctx.lineWidth = 2;
  ctx.strokeRect(16, 16, W - 32, H - 32);

  /* ── encabezado ── */
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(150,200,255,0.6)';
  ctx.font = '600 24px "JetBrains Mono"';
  ctx.fillText('N É X U S   ·   R E G I S T R O   D E   C O M B A T E', W / 2, 100);

  const headlineColor = '#E6B325';
  const headline = `🏆 ${winner.name.toUpperCase()}`;
  fitText(ctx, headline, W - 160, '62px Orbitron');
  ctx.fillStyle = headlineColor;
  ctx.fillText(headline, W / 2, 200);

  ctx.fillStyle = 'rgba(220,230,255,0.75)';
  ctx.font = '400 28px "JetBrains Mono"';
  ctx.fillText(subtitle, W / 2, 245);

  /* ── avatares — el ganador siempre a la izquierda ── */
  const cy = 480;
  const r = 150;
  const winnerX = 300;
  const loserX = 780;

  drawIcon(ctx, 'crown', winnerX, cy - r - 45, 56, headlineColor, 2.4);
  drawAvatar(ctx, winnerImg, winnerX, cy, r, headlineColor, winner.isNave);
  drawAvatar(ctx, loserImg, loserX, cy, r, 'rgba(150,170,210,0.45)', loser.isNave);

  ctx.fillStyle = 'rgba(230,240,255,0.9)';
  ctx.font = '800 40px Orbitron';
  ctx.fillText('VS', W / 2, cy + 15);

  const drawNameplate = (combatant, x, color) => {
    ctx.fillStyle = color;
    const nameSize = fitText(ctx, combatant.name, 260, '32px Orbitron');
    ctx.font = `800 ${nameSize}px Orbitron`;
    ctx.fillText(combatant.name, x, cy + r + 55);
    if (combatant.handle) {
      ctx.fillStyle = 'rgba(160,190,230,0.55)';
      ctx.font = '400 22px "JetBrains Mono"';
      ctx.fillText(`@${combatant.handle}`, x, cy + r + 85);
    }
  };
  drawNameplate(winner, winnerX, headlineColor);
  drawNameplate(loser, loserX, 'rgba(220,230,255,0.85)');

  /* ── rondas ── */
  const roundsY = 720;
  ctx.fillStyle = 'rgba(150,200,255,0.55)';
  ctx.font = '600 22px "JetBrains Mono"';
  ctx.fillText('RONDAS DISPUTADAS', W / 2, roundsY);
  ctx.fillStyle = '#38cdf0';
  ctx.font = '800 54px Orbitron';
  ctx.fillText(String(rounds), W / 2, roundsY + 55);

  /* ── tabla comparativa ── */
  let rowY = 850;
  const rowH = 100;
  ctx.strokeStyle = 'rgba(56,205,240,0.14)';
  ctx.lineWidth = 1;
  for (const row of rows) {
    ctx.beginPath();
    ctx.moveTo(90, rowY - rowH / 2 + 10);
    ctx.lineTo(W - 90, rowY - rowH / 2 + 10);
    ctx.stroke();

    ctx.textAlign = 'center';
    ctx.font = '800 44px Orbitron';
    ctx.fillStyle = headlineColor;
    ctx.fillText(String(row.left), winnerX, rowY + 16);
    ctx.fillStyle = 'rgba(220,230,255,0.85)';
    ctx.fillText(String(row.right), loserX, rowY + 16);

    drawIcon(ctx, row.icon, W / 2, rowY - 22, 30, row.color, 2.2);
    ctx.fillStyle = 'rgba(160,190,230,0.6)';
    ctx.font = '600 18px "JetBrains Mono"';
    ctx.fillText(row.label, W / 2, rowY + 26);

    rowY += rowH;
  }

  /* ── pie ── */
  const dateStr = new Date().toLocaleDateString('es-CL', { day: '2-digit', month: 'long', year: 'numeric' });
  ctx.fillStyle = 'rgba(120,150,190,0.5)';
  ctx.font = '400 20px "JetBrains Mono"';
  ctx.fillText(`Generado en NÉXUS — ${dateStr}`, W / 2, H - 50);

  return canvas;
}

const STAT_ROWS = (leftVal, rightVal) => [
  { icon: 'sword', label: 'DAÑO INFLIGIDO', color: '#ff7043', left: leftVal.dmgDealt, right: rightVal.dmgDealt },
  { icon: 'plus', label: 'CURACIÓN TOTAL', color: '#10b981', left: leftVal.healDone, right: rightVal.healDone },
  { icon: 'zap', label: 'GOLPES CRÍTICOS', color: '#E6B325', left: leftVal.crits, right: rightVal.crits },
];

/** Dibuja la tarjeta de resolución de un combate PvP y devuelve el canvas listo para exportar. */
export async function drawCombatCard(combat) {
  const summary = summarizeCombat(combat);
  const isFled = combat.status === 'fled_attacker' || combat.status === 'fled_defender';
  const winnerSide = combat.status === 'attacker_won' || combat.status === 'fled_defender' ? 'attacker' : 'defender';
  const loserSide = winnerSide === 'attacker' ? 'defender' : 'attacker';
  const winnerData = combat[winnerSide];
  const loserData = combat[loserSide];

  const winner = {
    name: winnerData.name, handle: winnerData.handle, isNave: winnerData.es_nave,
    imageSrc: mediaUrl(winnerData.es_nave ? winnerData.nave_imagen : winnerData.photo_url),
  };
  const loser = {
    name: loserData.name, handle: loserData.handle, isNave: loserData.es_nave,
    imageSrc: mediaUrl(loserData.es_nave ? loserData.nave_imagen : loserData.photo_url),
  };
  const subtitle = isFled
    ? `${loser.name} huyó del combate`
    : `vence a ${loser.name} en un duelo por turnos`;

  return renderResultCard({
    winner, loser, rounds: summary.rounds, subtitle,
    rows: STAT_ROWS(summary[winnerSide], summary[loserSide]),
  });
}

/** Dibuja la tarjeta de resolución de un combate contra NPC (o encuentro naval) y devuelve el canvas. */
export async function drawNpcCombatCard({ phase, player, npc, log, ronda, naveMode }) {
  const summary = summarizeNpcLog(log);
  const playerWon = phase === 'victory';

  const playerCombatant = {
    name: player.nombre, handle: null, isNave: naveMode,
    imageSrc: mediaUrl(player.photo),
  };
  const npcCombatant = {
    name: npc.nombre, handle: null, isNave: naveMode,
    imageSrc: mediaUrl(npc.imagen_mini) || mediaUrl(npc.imagen),
  };
  const winner = playerWon ? playerCombatant : npcCombatant;
  const loser = playerWon ? npcCombatant : playerCombatant;
  const subtitle = `vence a ${loser.name} en ${naveMode ? 'combate espacial' : 'combate'}`;

  return renderResultCard({
    winner, loser, rounds: summary.rounds ?? ronda, subtitle,
    rows: STAT_ROWS(playerWon ? summary.player : summary.npc, playerWon ? summary.npc : summary.player),
  });
}

/**
 * Panel compartido: genera y muestra la imagen resultante de `generate()` al
 * montarse, con opciones para descargarla o compartirla directamente (Web
 * Share API, disponible en navegadores móviles — cae al link de descarga si
 * no aplica). `generate` es una función sin argumentos que devuelve el canvas
 * (así el mismo panel sirve tanto para combates PvP como contra NPC).
 */
function ResultCardModal({ generate, fileName, onClose }) {
  const [dataUrl, setDataUrl] = useState(null);
  const [error, setError] = useState(false);
  const cancelledRef = useRef(false);

  useEffect(() => {
    cancelledRef.current = false;
    generate()
      .then((canvas) => { if (!cancelledRef.current) setDataUrl(canvas.toDataURL('image/png')); })
      .catch(() => { if (!cancelledRef.current) setError(true); });
    return () => { cancelledRef.current = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const download = () => {
    if (!dataUrl) return;
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = fileName;
    a.click();
  };

  const share = async () => {
    if (!dataUrl) return;
    try {
      const blob = await (await fetch(dataUrl)).blob();
      const file = new File([blob], fileName, { type: 'image/png' });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: 'Combate NÉXUS' });
        return;
      }
    } catch { /* cancelado por el usuario o no soportado — cae a descarga */ }
    download();
  };

  const canShareFiles = typeof navigator !== 'undefined' && !!navigator.share;

  return createPortal(
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9500, display: 'flex',
      alignItems: 'center', justifyContent: 'center', padding: 20,
      background: 'rgba(2,6,16,0.88)', backdropFilter: 'blur(6px)',
    }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, maxHeight: '94vh' }}>
        {error ? (
          <div style={{ color: '#ff6b6b', fontFamily: 'var(--font-data)', fontSize: 12 }}>
            No se pudo generar la tarjeta.
          </div>
        ) : !dataUrl ? (
          <div style={{
            width: 260, height: 325, display: 'grid', placeItems: 'center',
            color: 'var(--holo)', fontFamily: 'var(--font-data)', fontSize: 11, letterSpacing: '0.14em',
          }}>
            GENERANDO TARJETA…
          </div>
        ) : (
          <img src={dataUrl} alt="Tarjeta de resolución de combate" style={{
            maxWidth: 'min(86vw, 360px)', maxHeight: '72vh', borderRadius: 14,
            boxShadow: '0 0 40px rgba(56,205,240,0.25)', display: 'block',
          }} />
        )}
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
          <button className="nx-btn nx-btn-ghost" onClick={onClose}>Cerrar</button>
          {dataUrl && (
            <>
              <button className="nx-btn nx-btn-accent" onClick={download}>⬇ Descargar</button>
              {canShareFiles && (
                <button className="nx-btn nx-btn-accent" onClick={share}>📤 Compartir</button>
              )}
            </>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}

/** Tarjeta de resolución para un combate PvP (ver PvpCombatScreen.jsx). */
export default function CombatCardModal({ combat, onClose }) {
  return (
    <ResultCardModal
      generate={() => drawCombatCard(combat)}
      fileName={`nexus-combate-${combat.id}.png`}
      onClose={onClose}
    />
  );
}

/** Tarjeta de resolución para un combate contra NPC / encuentro naval (ver NpcCombatScreen.jsx). */
export function NpcCombatCardModal({ phase, player, npc, log, ronda, naveMode, onClose }) {
  return (
    <ResultCardModal
      generate={() => drawNpcCombatCard({ phase, player, npc, log, ronda, naveMode })}
      fileName={`nexus-combate-${(npc?.nombre ?? 'npc').toLowerCase().replace(/\s+/g, '-')}.png`}
      onClose={onClose}
    />
  );
}
