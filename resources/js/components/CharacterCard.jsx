import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import QRCode from 'qrcode';
import { ICON_PATHS, toast } from './ui.jsx';
import { NX } from '../data/seed.js';
import {
  CARD_W, CARD_H, mediaUrl, loadImage, ensureFonts,
  drawIcon as drawIconRaw, drawImageRounded, fitText, wrapText, printCardImage, paintCardLogo, paintGridBackground, paintVidaEscudoBox, paintBoxBg,
  COMBAT_STAT_META as STAT_META, COMBAT_STAT_DEFAULTS as COMBAT_DEFAULTS,
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

/* Mismos assets que RANGOS_JEDI en Comando.jsx (apartado "Rango" de Mi Personaje). */
const TIER_RANGO_IMG = {
  iniciado:    '/assets/INITIATE.png',
  padawan:     '/assets/PADAWAN.png',
  caballero:   '/assets/KNIGHT.png',
  maestro:     '/assets/MASTER.png',
  granmaestro: '/assets/GRANDMASTER.png',
};

const SIDE_FRAME = {
  luminoso: { bg1: '#0a1a3a', bg2: '#040c1e', line: '#3aa0ff' },
  oscuro:   { bg1: '#2a0a0f', bg2: '#0f0304', line: '#ff2d45' },
};

/** Dibuja un sable de luz vertical (hoja + puño) — misma composición visual que SaberBlade en Comando.jsx. */
function drawSaberBlade(ctx, x, y, w, h, color) {
  const hiltH = Math.min(64, h * 0.24);
  const bladeGap = 6;
  const bladeH = h - hiltH - bladeGap;
  const bladeW = Math.max(7, Math.min(14, w * 0.42));
  const bladeX = x + (w - bladeW) / 2;

  ctx.save();
  ctx.shadowColor = color;
  ctx.shadowBlur = 14;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.roundRect(bladeX, y, bladeW, bladeH, bladeW / 2);
  ctx.fill();
  ctx.restore();

  const coreW = Math.max(2, bladeW * 0.38);
  ctx.fillStyle = 'rgba(255,255,255,0.92)';
  ctx.beginPath();
  ctx.roundRect(bladeX + (bladeW - coreW) / 2, y + 4, coreW, bladeH - 8, coreW / 2);
  ctx.fill();

  const hiltW = Math.max(16, Math.min(24, w * 0.7));
  const hiltX = x + (w - hiltW) / 2;
  const hiltY = y + bladeH + bladeGap;
  const grad = ctx.createLinearGradient(hiltX, 0, hiltX + hiltW, 0);
  grad.addColorStop(0, '#2c3445');
  grad.addColorStop(0.5, '#a9b8cf');
  grad.addColorStop(1, '#2c3445');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.roundRect(hiltX, hiltY, hiltW, hiltH, 4);
  ctx.fill();
  ctx.lineWidth = 1;
  ctx.strokeStyle = '#161d29';
  ctx.stroke();

  ctx.fillStyle = '#161d29';
  ctx.fillRect(hiltX + 2, hiltY + hiltH * 0.14, hiltW - 4, hiltH * 0.12);

  ctx.save();
  ctx.shadowColor = color;
  ctx.shadowBlur = 6;
  ctx.fillStyle = color;
  ctx.fillRect(hiltX + 2, hiltY + hiltH * 0.42, hiltW - 4, hiltH * 0.1);
  ctx.restore();

  ctx.fillStyle = '#161d29';
  ctx.fillRect(hiltX + 2, hiltY + hiltH * 0.66, hiltW - 4, hiltH * 0.12);
}

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

  const [photoImg, qrDataUrl, rankImg] = await Promise.all([
    loadImage(mediaUrl(character.photo ?? character.photo_url)),
    handle
      ? QRCode.toDataURL(publicUrl, { width: 160, margin: 0, color: { dark: '#eaf9ffcc', light: '#00000000' } }).catch(() => null)
      : Promise.resolve(null),
    loadImage(TIER_RANGO_IMG[tierKey] ?? TIER_RANGO_IMG.iniciado),
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

  paintGridBackground(ctx, pad, pad, CARD_W - pad * 2, CARD_H - pad * 2, 22);

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

  const badgeR = 23;
  const badgeCx = innerRight - 24;
  const badgeCy = pad + 40;
  if (rankImg) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(badgeCx, badgeCy, badgeR, 0, Math.PI * 2);
    ctx.clip();
    ctx.fillStyle = '#04070f';
    ctx.fillRect(badgeCx - badgeR, badgeCy - badgeR, badgeR * 2, badgeR * 2);
    const scale = Math.max((badgeR * 2) / rankImg.width, (badgeR * 2) / rankImg.height);
    const dw = rankImg.width * scale;
    const dh = rankImg.height * scale;
    ctx.drawImage(rankImg, badgeCx - dw / 2, badgeCy - dh / 2, dw, dh);
    ctx.restore();
    ctx.beginPath();
    ctx.arc(badgeCx, badgeCy, badgeR, 0, Math.PI * 2);
    ctx.save();
    ctx.shadowColor = tierColor;
    ctx.shadowBlur = 6;
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = tierColor;
    ctx.stroke();
    ctx.restore();
  } else {
    ctx.beginPath();
    ctx.arc(badgeCx, badgeCy, badgeR, 0, Math.PI * 2);
    ctx.fillStyle = tierColor;
    ctx.fill();
    ctx.textAlign = 'center';
    ctx.fillStyle = '#04070f';
    ctx.font = '800 20px Orbitron';
    ctx.fillText(tierLabel.charAt(0), badgeCx, badgeCy + 8);
  }

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

  /* ── arte: foto de personaje + sable de luz a la derecha (como en Mi Personaje) ── */
  const artY = pad + 118;
  const artH = 396;
  const saberColW = 52;
  const saberGap = 12;
  const artW = innerW - saberColW - saberGap;
  if (photoImg) {
    drawImageRounded(ctx, photoImg, innerX, artY, artW, artH, 16, `${side.line}66`);
  } else {
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(innerX, artY, artW, artH, 16);
    ctx.clip();
    const artBg = ctx.createRadialGradient(
      innerX + artW / 2, artY + artH / 2, 20,
      innerX + artW / 2, artY + artH / 2, artW / 1.3,
    );
    artBg.addColorStop(0, `${classInfo.accent}22`);
    artBg.addColorStop(1, '#04070f');
    ctx.fillStyle = artBg;
    ctx.fillRect(innerX, artY, artW, artH);
    ctx.globalAlpha = 0.4;
    drawIcon(ctx, classInfo.icon, innerX + artW / 2, artY + artH / 2, 130, classInfo.accent, 1.6);
    ctx.globalAlpha = 1;
    ctx.restore();
    ctx.beginPath();
    ctx.roundRect(innerX, artY, artW, artH, 16);
    ctx.lineWidth = 3;
    ctx.strokeStyle = `${side.line}66`;
    ctx.stroke();
  }
  drawSaberBlade(ctx, innerX + artW + saberGap, artY, saberColW, artH, saberColor);

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

  /* ── vida (corazones) y escudo (energía) — etiqueta como los demás atributos, valor en íconos ── */
  const vidaVal = Math.max(0, Math.round(Number(baseCombat.vida ?? character.vida ?? COMBAT_DEFAULTS.vida) || 0));
  const escudoVal = Math.max(0, Math.round(Number(baseCombat.escudo ?? character.escudo ?? COMBAT_DEFAULTS.escudo) || 0));

  let y = typeY + 14;
  y = paintVidaEscudoBox(ctx, {
    x: innerX, y, w: innerW, vidaVal, escudoVal,
    vidaMeta: STAT_META.vida, escudoMeta: STAT_META.escudo,
    drawIcon: (name, cx, cy, size, color, strokeWidth) => drawIcon(ctx, name, cx, cy, size, color, strokeWidth),
  });
  y += 18;

  /* ── dos columnas: lore (izquierda) + atributos de combate (derecha) ── */
  const statsTop = y;
  const rowH = 44;
  const ATTR_ORDER = ['ataque', 'defensa', 'punteria', 'movimiento', 'iniciativa'];
  const sectionH = ATTR_ORDER.length * rowH;
  const colGap = 22;
  const loreColW = innerW * 0.42;
  const attrColX = innerX + loreColW + colGap;
  const attrColW = innerW - loreColW - colGap;

  const attrBoxTop = statsTop - 16;
  const attrBoxBottom = statsTop + sectionH + 10;
  paintBoxBg(ctx, innerX, attrBoxTop, innerW, attrBoxBottom - attrBoxTop, 10);

  ctx.textAlign = 'left';
  ctx.fillStyle = '#38cdf0';
  ctx.font = '700 11px "JetBrains Mono"';
  ctx.fillText('LORE', innerX, statsTop);
  ctx.fillStyle = 'rgba(220,230,255,0.78)';
  ctx.font = '400 15px "JetBrains Mono"';
  const loreLineH = 20;
  const loreMaxLines = Math.max(1, Math.floor((sectionH - 20) / loreLineH));
  const loreText = character.lore || character.bio || 'Sin historia registrada.';
  wrapText(ctx, loreText, innerX, statsTop + 20, loreColW, loreLineH, loreMaxLines);

  ATTR_ORDER.forEach((key, i) => {
    const meta = STAT_META[key];
    const value = baseCombat[key] ?? character[key] ?? COMBAT_DEFAULTS[key];
    const rowY = statsTop + i * rowH;

    drawIcon(ctx, meta.icon, attrColX + 11, rowY - 6, 20, meta.color, 2);
    ctx.textAlign = 'left';
    ctx.fillStyle = 'rgba(220,230,255,0.8)';
    ctx.font = '600 14px "JetBrains Mono"';
    ctx.fillText(meta.label.toUpperCase(), attrColX + 26, rowY);

    ctx.textAlign = 'right';
    ctx.fillStyle = meta.color;
    ctx.font = '800 22px Orbitron';
    ctx.fillText(String(value), attrColX + attrColW - 4, rowY + 3);

    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(attrColX, rowY + 16);
    ctx.lineTo(attrColX + attrColW, rowY + 16);
    ctx.stroke();
  });

  ctx.strokeStyle = 'rgba(255,255,255,0.14)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(innerX + loreColW + colGap / 2, attrBoxTop + 6);
  ctx.lineTo(innerX + loreColW + colGap / 2, attrBoxBottom - 6);
  ctx.stroke();

  /* ── pie: QR de perfil, handle y medallas ── */
  const footY = statsTop + sectionH + 14;
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

  const LOGO_SIZE = 62;
  if (medalIds.length) {
    const medalR = 15;
    const LOGO_RESERVE = LOGO_SIZE + 8 + 16; // deja libre la esquina inferior derecha para el logo de esgrima
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

  await paintCardLogo(ctx, innerRight, CARD_H - pad, LOGO_SIZE);

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
