import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import QRCode from 'qrcode';
import { ICON_PATHS, toast } from './ui.jsx';
import { NX } from '../data/seed.js';
import {
  CARD_W, CARD_H, mediaUrl, loadImage, ensureFonts,
  drawIcon as drawIconRaw, drawImageRounded, fitText, printCardImage, paintCardLogo,
  COMBAT_STAT_META as STAT_META, COMBAT_STATS, COMBAT_STAT_DEFAULTS as COMBAT_DEFAULTS,
} from '../utils/printableCard.js';

const drawIcon = (ctx, name, cx, cy, size, color, strokeWidth) =>
  drawIconRaw(ctx, ICON_PATHS, name, cx, cy, size, color, strokeWidth);

/* Colores planos por tier/tono — los de NX.TIERS/NX.MEDALS son var(--css) y
   canvas 2D no puede resolverlos, así que se duplican en hex (mismo criterio
   que TIER_COLOR en Comando.jsx). */
const TIER_COLOR = {
  iniciado: '#8aa0c0', padawan: '#38cdf0', caballero: '#10b981',
  maestro: '#FF6B00', granmaestro: '#E6B325',
};
const MEDAL_TONE_COLOR = { gold: '#E6B325', orange: '#FF6B00', holo: '#38cdf0', red: '#ff2d45' };

const SIDE_FRAME = {
  luminoso: { bg1: '#0a1a3a', bg2: '#040c1e', line: '#3aa0ff' },
  oscuro:   { bg1: '#2a0a0f', bg2: '#0f0304', line: '#ff2d45' },
};

/** Dibuja la carta imprimible del personaje y devuelve el canvas listo para exportar. */
export async function drawCharacterCard(character, user) {
  await ensureFonts();

  const side = SIDE_FRAME[character.side] ?? SIDE_FRAME.luminoso;
  const saberColor = NX.SABERS[character.saber] ?? NX.SABERS.azul;
  const classInfo = NX.CLASSES.find(c => c.id === character.cls) ?? NX.CLASSES[0];
  const tierKey = user?.tier ?? character.tier ?? 'iniciado';
  const tierLabel = NX.TIERS[tierKey]?.label ?? 'Iniciado';
  const tierColor = TIER_COLOR[tierKey] ?? TIER_COLOR.iniciado;
  const medalIds = (user?.character?.medals ?? character.medals ?? []).slice(0, 5);
  const handle = character.handle ?? '';
  const publicUrl = `${window.location.origin}/c/${encodeURIComponent(handle)}`;
  const baseCombat = character.combat_base_stats ?? {};

  const [photoImg, qrDataUrl] = await Promise.all([
    loadImage(mediaUrl(character.photo ?? character.photo_url)),
    handle
      ? QRCode.toDataURL(publicUrl, { width: 160, margin: 0, color: { dark: '#eaf9ffcc', light: '#00000000' } }).catch(() => null)
      : Promise.resolve(null),
  ]);
  const qrImg = qrDataUrl ? await loadImage(qrDataUrl) : null;

  const canvas = document.createElement('canvas');
  canvas.width = CARD_W;
  canvas.height = CARD_H;
  const ctx = canvas.getContext('2d');

  const pad = 22;
  const innerX = pad + 22;
  const innerRight = CARD_W - pad - 22;
  const innerW = innerRight - innerX;

  /* ── marco exterior ── */
  ctx.fillStyle = side.bg2;
  ctx.beginPath();
  ctx.roundRect(0, 0, CARD_W, CARD_H, 34);
  ctx.fill();

  const bg = ctx.createLinearGradient(0, 0, 0, CARD_H);
  bg.addColorStop(0, side.bg1);
  bg.addColorStop(1, side.bg2);
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(pad, pad, CARD_W - pad * 2, CARD_H - pad * 2, 22);
  ctx.clip();
  ctx.fillStyle = bg;
  ctx.fillRect(pad, pad, CARD_W - pad * 2, CARD_H - pad * 2);
  ctx.restore();

  ctx.save();
  ctx.beginPath();
  ctx.roundRect(pad, pad, CARD_W - pad * 2, CARD_H - pad * 2, 22);
  ctx.lineWidth = 3;
  ctx.strokeStyle = `${side.line}aa`;
  ctx.stroke();
  ctx.restore();

  /* ── encabezado: nombre + tier ── */
  ctx.textAlign = 'left';
  const displayName = (character.name ?? '???').toUpperCase();
  fitText(ctx, displayName, innerW - 66, '32px Orbitron');
  ctx.fillStyle = '#eaf2ff';
  ctx.fillText(displayName, innerX, pad + 54);

  ctx.beginPath();
  ctx.arc(innerRight - 24, pad + 40, 23, 0, Math.PI * 2);
  ctx.fillStyle = tierColor;
  ctx.fill();
  ctx.textAlign = 'center';
  ctx.fillStyle = '#04070f';
  ctx.font = '800 20px Orbitron';
  ctx.fillText(tierLabel.charAt(0), innerRight - 24, pad + 48);

  /* ── subencabezado: forma de combate + color de sable ── */
  const subY = pad + 96;
  ctx.textAlign = 'left';
  drawIcon(ctx, classInfo.icon, innerX + 11, subY - 6, 22, classInfo.accent, 2.1);
  ctx.fillStyle = classInfo.accent;
  ctx.font = '700 16px "JetBrains Mono"';
  ctx.fillText(`${classInfo.num} · ${classInfo.name}`, innerX + 30, subY);

  ctx.textAlign = 'right';
  ctx.fillStyle = 'rgba(220,230,255,0.7)';
  ctx.font = '600 14px "JetBrains Mono"';
  ctx.fillText(`Sable ${character.saber ?? ''}`, innerRight - 16, subY);
  ctx.beginPath();
  ctx.arc(innerRight - 4, subY - 5, 7, 0, Math.PI * 2);
  ctx.save();
  ctx.shadowColor = saberColor;
  ctx.shadowBlur = 8;
  ctx.fillStyle = saberColor;
  ctx.fill();
  ctx.restore();

  /* ── arte: foto de personaje ── */
  const artY = pad + 118;
  const artH = 396;
  if (photoImg) {
    drawImageRounded(ctx, photoImg, innerX, artY, innerW, artH, 16, `${side.line}66`);
  } else {
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(innerX, artY, innerW, artH, 16);
    ctx.clip();
    const artBg = ctx.createRadialGradient(
      innerX + innerW / 2, artY + artH / 2, 20,
      innerX + innerW / 2, artY + artH / 2, innerW / 1.3,
    );
    artBg.addColorStop(0, `${classInfo.accent}22`);
    artBg.addColorStop(1, '#04070f');
    ctx.fillStyle = artBg;
    ctx.fillRect(innerX, artY, innerW, artH);
    ctx.globalAlpha = 0.4;
    drawIcon(ctx, classInfo.icon, innerX + innerW / 2, artY + artH / 2, 150, classInfo.accent, 1.6);
    ctx.globalAlpha = 1;
    ctx.restore();
    ctx.beginPath();
    ctx.roundRect(innerX, artY, innerW, artH, 16);
    ctx.lineWidth = 3;
    ctx.strokeStyle = `${side.line}66`;
    ctx.stroke();
  }

  /* ── línea de tipo: lado de la Fuerza ── */
  const typeY = artY + artH + 36;
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(150,200,255,0.55)';
  ctx.font = '600 15px "JetBrains Mono"';
  const sideLabel = character.side === 'oscuro' ? 'Lado Oscuro' : 'Lado Luminoso';
  ctx.fillText(sideLabel.toUpperCase(), CARD_W / 2, typeY);
  ctx.strokeStyle = 'rgba(255,255,255,0.12)';
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(innerX, typeY - 22); ctx.lineTo(innerRight, typeY - 22); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(innerX, typeY + 12); ctx.lineTo(innerRight, typeY + 12); ctx.stroke();

  /* ── atributos de combate ── */
  const statsTop = typeY + 46;
  const rowH = 47;
  COMBAT_STATS.forEach((key, i) => {
    const meta = STAT_META[key];
    const value = baseCombat[key] ?? character[key] ?? COMBAT_DEFAULTS[key];
    const rowY = statsTop + i * rowH;

    drawIcon(ctx, meta.icon, innerX + 13, rowY - 6, 22, meta.color, 2);
    ctx.textAlign = 'left';
    ctx.fillStyle = 'rgba(220,230,255,0.8)';
    ctx.font = '600 16px "JetBrains Mono"';
    ctx.fillText(meta.label.toUpperCase(), innerX + 34, rowY);

    ctx.textAlign = 'right';
    ctx.fillStyle = meta.color;
    ctx.font = '800 24px Orbitron';
    ctx.fillText(String(value), innerRight - 6, rowY + 3);

    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(innerX, rowY + 16);
    ctx.lineTo(innerRight, rowY + 16);
    ctx.stroke();
  });

  /* ── pie: QR de perfil, handle y medallas ── */
  const footY = statsTop + COMBAT_STATS.length * rowH + 18;
  if (qrImg) {
    drawImageRounded(ctx, qrImg, innerX, footY, 56, 56, 8, null);
  }
  ctx.textAlign = 'left';
  const handleX = qrImg ? innerX + 66 : innerX;
  ctx.fillStyle = '#eaf2ff';
  ctx.font = '700 18px Orbitron';
  ctx.fillText(`@${handle.toUpperCase()}`, handleX, footY + 24);
  ctx.fillStyle = 'rgba(150,200,255,0.5)';
  ctx.font = '400 12px "JetBrains Mono"';
  ctx.fillText('Perfil público', handleX, footY + 42);

  if (medalIds.length) {
    const medalR = 15;
    const LOGO_RESERVE = 50; // deja libre la esquina inferior derecha para el logo de esgrima
    let medalX = innerRight - medalR - LOGO_RESERVE;
    for (const id of [...medalIds].reverse()) {
      const medal = NX.MEDALS[id];
      if (!medal) continue;
      const color = MEDAL_TONE_COLOR[medal.tone] ?? '#38cdf0';
      ctx.beginPath();
      ctx.arc(medalX, footY + 24, medalR, 0, Math.PI * 2);
      ctx.fillStyle = `${color}22`;
      ctx.fill();
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = color;
      ctx.stroke();
      drawIcon(ctx, medal.icon, medalX, footY + 24, 16, color, 1.8);
      medalX -= medalR * 2 + 8;
    }
  }

  /* ── colofón ── */
  const dateStr = new Date().toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric' });
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(120,150,190,0.55)';
  ctx.font = '400 12px "JetBrains Mono"';
  ctx.fillText(`NÉXUS ACADEMIA — ${dateStr}`, CARD_W / 2, CARD_H - pad - 8);

  await paintCardLogo(ctx, innerRight, CARD_H - pad);

  return canvas;
}

/**
 * Modal que genera la carta de personaje al montarse y permite descargarla,
 * compartirla (Web Share API) o imprimirla al tamaño físico de una carta
 * Magic (63mm × 88mm) mediante una ventana con `@page` dedicada.
 */
export default function CharacterCardModal({ character, user, onClose, onGenerated }) {
  const [dataUrl, setDataUrl] = useState(null);
  const [error, setError] = useState(false);
  const cancelledRef = useRef(false);

  useEffect(() => {
    cancelledRef.current = false;
    drawCharacterCard(character, user)
      .then((canvas) => {
        if (cancelledRef.current) return;
        const url = canvas.toDataURL('image/png');
        setDataUrl(url);
        onGenerated?.(url);
      })
      .catch(() => { if (!cancelledRef.current) setError(true); });
    return () => { cancelledRef.current = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fileName = `nexus-carta-${(character.handle ?? character.name ?? 'personaje').toLowerCase().replace(/\s+/g, '-')}.png`;

  const download = () => {
    if (!dataUrl) return;
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = fileName;
    a.click();
  };

  const printCard = () => {
    if (!dataUrl) return;
    printCardImage(dataUrl, () => toast('El navegador bloqueó la ventana de impresión', { tone: 'error', icon: 'x' }));
  };

  const share = async () => {
    if (!dataUrl) return;
    try {
      const blob = await (await fetch(dataUrl)).blob();
      const file = new File([blob], fileName, { type: 'image/png' });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: 'Carta de Personaje NÉXUS' });
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
            No se pudo generar la carta.
          </div>
        ) : !dataUrl ? (
          <div style={{
            width: 252, height: 353, display: 'grid', placeItems: 'center',
            color: 'var(--holo)', fontFamily: 'var(--font-data)', fontSize: 11, letterSpacing: '0.14em',
          }}>
            GENERANDO CARTA…
          </div>
        ) : (
          <img src={dataUrl} alt="Carta de personaje" style={{
            width: 252, height: 353, borderRadius: 14,
            boxShadow: '0 0 40px rgba(56,205,240,0.25)', display: 'block',
          }} />
        )}
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
          <button className="nx-btn nx-btn-ghost" onClick={onClose}>Cerrar</button>
          {dataUrl && (
            <>
              <button className="nx-btn nx-btn-accent" onClick={download}>⬇ Descargar</button>
              <button className="nx-btn nx-btn-accent" onClick={printCard}>🖨 Imprimir</button>
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
