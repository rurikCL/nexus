/* NÉXUS — utilidades compartidas para tarjetas imprimibles con Canvas 2D
   (tamaño físico de una carta tipo Magic: 63mm × 88mm ≈ 2.5in × 3.5in @300dpi).
   Usado por resources/js/components/CharacterCard.jsx y EntityCard.jsx. */

export const CARD_W = 750;
export const CARD_H = 1050;

export function mediaUrl(path) {
  if (!path) return null;
  if (/^(https?:)?\/\//.test(path) || path.startsWith('data:') || path.startsWith('blob:')) return path;
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  if (cleanPath.startsWith('/storage/')) return cleanPath;
  if (cleanPath.startsWith('/public/'))  return cleanPath.replace('/public/', '/storage/');
  return `/storage${cleanPath}`;
}

export function loadImage(src) {
  return new Promise((resolve) => {
    if (!src) { resolve(null); return; }
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

export async function ensureFonts() {
  if (!document.fonts) return;
  try {
    await document.fonts.ready;
    await Promise.all([
      document.fonts.load('800 40px Orbitron'),
      document.fonts.load('800 28px Orbitron'),
      document.fonts.load('700 22px Orbitron'),
      document.fonts.load('600 16px "JetBrains Mono"'),
      document.fonts.load('400 14px "JetBrains Mono"'),
    ]);
  } catch { /* si las fuentes no cargan a tiempo, se usa el fallback del sistema */ }
}

/** Dibuja un ícono de ui.jsx (ICON_PATHS, viewBox 24x24) centrado en (cx, cy) con tamaño `size`. */
export function drawIcon(ctx, iconPaths, name, cx, cy, size, color, strokeWidth = 1.8) {
  const d = iconPaths[name];
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

/** Dibuja una imagen recortada dentro de un rectángulo de esquinas redondeadas, con borde opcional. */
export function drawImageRounded(ctx, img, x, y, w, h, radius, borderColor, borderWidth = 3) {
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, radius);
  ctx.closePath();
  ctx.clip();
  ctx.fillStyle = '#0a1428';
  ctx.fill();
  if (img) {
    const scale = Math.max(w / img.width, h / img.height);
    const dw = img.width * scale;
    const dh = img.height * scale;
    ctx.drawImage(img, x + w / 2 - dw / 2, y + h / 2 - dh / 2, dw, dh);
  }
  ctx.restore();

  if (borderColor) {
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, radius);
    ctx.lineWidth = borderWidth;
    ctx.strokeStyle = borderColor;
    ctx.stroke();
    ctx.restore();
  }
}

export function fitText(ctx, text, maxWidth, baseFont, minFont = 14) {
  let size = parseInt(baseFont, 10);
  const rest = baseFont.replace(/^\d+px\s*/, '');
  while (size > minFont) {
    ctx.font = `${size}px ${rest}`;
    if (ctx.measureText(text).width <= maxWidth) break;
    size -= 1;
  }
  ctx.font = `${size}px ${rest}`;
  return size;
}

/** Envuelve `text` en líneas de máximo `maxWidth` px (con `ctx.font` ya seteado) y las dibuja centradas desde (cx, y), separadas por `lineHeight`. Devuelve el Y final. */
export function wrapText(ctx, text, cx, y, maxWidth, lineHeight, maxLines = Infinity) {
  const words = text.split(/\s+/).filter(Boolean);
  let line = '';
  let cy = y;
  let lines = 0;
  for (const word of words) {
    if (lines >= maxLines) break;
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      ctx.fillText(line, cx, cy);
      line = word;
      cy += lineHeight;
      lines += 1;
    } else {
      line = test;
    }
  }
  if (line && lines < maxLines) { ctx.fillText(line, cx, cy); cy += lineHeight; }
  return cy;
}

const CARD_LOGO_URL = '/assets/esgrimaGemini.png';
let cardLogoPromise = null;

/** Sello del logo de esgrima en la esquina inferior derecha de una caja (p.ej. el recuadro de arte de la carta) — carga la imagen una sola vez y la cachea entre llamadas. */
export async function paintCardLogo(ctx, boxRight, boxBottom, size = 40, margin = 8) {
  if (!cardLogoPromise) cardLogoPromise = loadImage(CARD_LOGO_URL);
  const img = await cardLogoPromise;
  if (!img) return;
  const x = boxRight - size - margin;
  const y = boxBottom - size - margin;
  ctx.save();
  ctx.globalAlpha = 0.92;
  ctx.shadowColor = 'rgba(0,0,0,0.7)';
  ctx.shadowBlur = 6;
  ctx.drawImage(img, x, y, size, size);
  ctx.restore();
}

/* Metadatos de los 7 atributos de combate compartidos por personajes, NPCs,
   jefes y enemigos — mismos íconos/colores que BONUS_FIELDS en ArmadoSable.jsx,
   para mantener el lenguaje visual del resto de la app (ATQ naranja, DEF cian,
   PNT verde, AGI violeta, INI dorado...). */
export const COMBAT_STAT_META = {
  vida:       { label: 'Vida',       icon: 'zap',    color: '#ff2d45' },
  escudo:     { label: 'Escudo',     icon: 'shield', color: '#26e3e3' },
  defensa:    { label: 'Defensa',    icon: 'shield', color: '#38cdf0' },
  ataque:     { label: 'Ataque',     icon: 'sword',  color: '#ff7043' },
  movimiento: { label: 'Agilidad',   icon: 'zap',    color: '#a78bfa' },
  iniciativa: { label: 'Iniciativa', icon: 'star',   color: '#E6B325' },
  punteria:   { label: 'Puntería',   icon: 'eye',    color: '#10b981' },
};
export const COMBAT_STATS = Object.keys(COMBAT_STAT_META);
export const COMBAT_STAT_DEFAULTS = { vida: 8, escudo: 4, defensa: 2, ataque: 2, movimiento: 2, iniciativa: 2, punteria: 2 };

/** Abre una ventana nueva e imprime `dataUrl` (PNG) al tamaño físico exacto de una carta Magic (63mm × 88mm). */
export function printCardImage(dataUrl, onBlocked) {
  const win = window.open('', '_blank', 'width=420,height=620');
  if (!win) { onBlocked?.(); return; }
  win.document.write(`<!doctype html><html><head><title>Carta imprimible</title>
    <style>
      @page { size: 63mm 88mm; margin: 0; }
      html, body { margin: 0; padding: 0; background: #fff; }
      img { width: 63mm; height: 88mm; display: block; }
    </style>
  </head><body><img src="${dataUrl}" /></body></html>`);
  win.document.close();
  // algunos navegadores no disparan onload del documento recién escrito con document.write
  setTimeout(() => { win.focus(); win.print(); }, 350);
}
