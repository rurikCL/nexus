/* NÉXUS — utilidades compartidas para tarjetas imprimibles con Canvas 2D
   (tamaño físico de una carta tipo Magic: 63mm × 88mm ≈ 2.5in × 3.5in @300dpi).
   Usado por resources/js/components/CharacterCard.jsx y EntityCard.jsx. */

export const CARD_W = 750;
export const CARD_H = 1050;

/* Tokens rectangulares (marcadores de Buff/Debuff/Estado): mini-carta con la
   misma proporción 5:7 y el mismo px/mm que la carta completa (CARD_W/63 ≈
   11.9 px/mm), pero a tamaño de ficha de mesa en vez de carta jugable. */
export const TOKEN_W = 380;
export const TOKEN_H = 532;
export const TOKEN_W_MM = Math.round(TOKEN_W * 63 / CARD_W); // ≈ 32mm
export const TOKEN_H_MM = Math.round(TOKEN_H * 88 / CARD_H); // ≈ 45mm

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

/** Dibuja una imagen dentro de un rectángulo de esquinas redondeadas, con borde opcional.
    `fit: 'contain'` (por defecto) muestra la imagen completa sin recortarla, dejando franjas
    del fondo donde no cubre; `fit: 'cover'` la recorta para llenar todo el rectángulo.
    `alignY: 'top'` ancla la imagen a la parte superior del rectángulo (centrada en horizontal)
    en vez de centrarla también verticalmente — útil para retratos donde la cara suele quedar arriba. */
export function drawImageRounded(ctx, img, x, y, w, h, radius, borderColor, borderWidth = 3, alignY = 'center', fit = 'contain') {
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, radius);
  ctx.closePath();
  ctx.clip();
  ctx.fillStyle = '#0a1428';
  ctx.fill();
  if (img) {
    const scale = fit === 'cover'
      ? Math.max(w / img.width, h / img.height)
      : Math.min(w / img.width, h / img.height);
    const dw = img.width * scale;
    const dh = img.height * scale;
    const dy = alignY === 'top' ? y : y + h / 2 - dh / 2;
    ctx.drawImage(img, x + w / 2 - dw / 2, dy, dw, dh);
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

/** Sello del logo de esgrima en la esquina inferior derecha de la carta completa — carga la imagen una sola vez y la cachea entre llamadas. */
export async function paintCardLogo(ctx, boxRight, boxBottom, size = 34, margin = 8) {
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

/** Igual que `paintCardLogo` pero centrado en (cx, cy) — para colocarlo en cualquier punto de la carta (p.ej. una columna central del pie). */
export async function paintLogoAt(ctx, cx, cy, size = 40) {
  if (!cardLogoPromise) cardLogoPromise = loadImage(CARD_LOGO_URL);
  const img = await cardLogoPromise;
  if (!img) return;
  ctx.save();
  ctx.globalAlpha = 0.92;
  ctx.shadowColor = 'rgba(0,0,0,0.7)';
  ctx.shadowBlur = 6;
  ctx.drawImage(img, cx - size / 2, cy - size / 2, size, size);
  ctx.restore();
}

/** Fondo cuadriculado con degradé — mismo criterio visual que las tarjetas de zona/planeta
    del Mapa Estelar (Mapa.jsx): resplandor radial cian de fondo + rejilla de líneas finas
    de 48px encima, recortado al rectángulo (x, y, w, h). */
export function paintGridBackground(ctx, x, y, w, h, radius = 0, spacing = 48) {
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, radius);
  ctx.clip();

  const glow = ctx.createRadialGradient(x + w * 0.6, y + h * 0.4, 0, x + w * 0.6, y + h * 0.4, Math.max(w, h) * 0.75);
  glow.addColorStop(0, 'rgba(56,205,240,0.14)');
  glow.addColorStop(0.7, 'rgba(4,10,30,0.45)');
  glow.addColorStop(1, 'rgba(4,10,30,0.45)');
  ctx.fillStyle = glow;
  ctx.fillRect(x, y, w, h);

  ctx.strokeStyle = 'rgba(56,205,240,0.16)';
  ctx.lineWidth = 1;
  for (let gx = x; gx <= x + w; gx += spacing) {
    ctx.beginPath();
    ctx.moveTo(gx + 0.5, y);
    ctx.lineTo(gx + 0.5, y + h);
    ctx.stroke();
  }
  for (let gy = y; gy <= y + h; gy += spacing) {
    ctx.beginPath();
    ctx.moveTo(x, gy + 0.5);
    ctx.lineTo(x + w, gy + 0.5);
    ctx.stroke();
  }

  ctx.restore();
}

const SHIELD_PATH = 'M12 3l8 3v6c0 5-4 8-8 9-4-1-8-4-8-9V6z';

/** Dibuja un corazón relleno (pip de Vida) con esquina superior-izquierda en (x, y). */
function drawHeartPip(ctx, x, y, size, color) {
  const topCurveHeight = size * 0.3;
  ctx.save();
  ctx.fillStyle = color;
  ctx.shadowColor = color;
  ctx.shadowBlur = 4;
  ctx.beginPath();
  ctx.moveTo(x + size / 2, y + topCurveHeight);
  ctx.bezierCurveTo(x + size / 2, y, x, y, x, y + topCurveHeight);
  ctx.bezierCurveTo(x, y + (size + topCurveHeight) / 2, x + size / 2, y + (size + topCurveHeight) / 2, x + size / 2, y + size);
  ctx.bezierCurveTo(x + size / 2, y + (size + topCurveHeight) / 2, x + size, y + (size + topCurveHeight) / 2, x + size, y + topCurveHeight);
  ctx.bezierCurveTo(x + size, y, x + size / 2, y, x + size / 2, y + topCurveHeight);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

/** Dibuja un escudo de energía (pip de Escudo) con esquina superior-izquierda en (x, y). */
function drawShieldPip(ctx, x, y, size, color) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(size / 24, size / 24);
  const path = new Path2D(SHIELD_PATH);
  ctx.fillStyle = `${color}33`;
  ctx.fill(path);
  ctx.lineWidth = 1.8;
  ctx.strokeStyle = color;
  ctx.shadowColor = color;
  ctx.shadowBlur = 3;
  ctx.stroke(path);
  ctx.restore();
}

/** Dibuja una fila de pips (corazones/escudos) que se envuelve si no caben en `maxWidth`; devuelve el Y final. */
function drawPipRow(ctx, { count, draw, x, maxWidth, y, size = 20, gap = 6, maxPips = 30 }) {
  const shown = Math.min(count, maxPips);
  const perRow = Math.max(1, Math.floor((maxWidth + gap) / (size + gap)));
  const rows = Math.max(1, Math.ceil(shown / perRow));
  for (let i = 0; i < shown; i++) {
    const row = Math.floor(i / perRow);
    const col = i % perRow;
    draw(x + col * (size + gap), y + row * (size + gap), size);
  }
  let bottomY = y + rows * (size + gap) - gap;
  if (count > maxPips) {
    ctx.textAlign = 'left';
    ctx.fillStyle = 'rgba(220,230,255,0.75)';
    ctx.font = '700 13px "JetBrains Mono"';
    ctx.fillText(`+${count - maxPips}`, x, bottomY + 13);
    bottomY += 16;
  }
  return bottomY;
}

/** Misma cuenta de `drawPipRow` pero sin dibujar — permite reservar el alto de la caja de fondo antes de pintar el contenido encima. */
function pipRowHeight(count, maxWidth, size, gap, maxPips = 30) {
  const shown = Math.min(count, maxPips);
  const perRow = Math.max(1, Math.floor((maxWidth + gap) / (size + gap)));
  const rows = Math.max(1, Math.ceil(shown / perRow));
  let h = rows * (size + gap) - gap;
  if (count > maxPips) h += 16;
  return h;
}

/** Fondo negro con degradé semitransparente + borde sutil, recortado a un rectángulo redondeado. */
export function paintBoxBg(ctx, x, y, w, h, radius = 10, borderWidth = 1) {
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, radius);
  ctx.clip();
  const g = ctx.createLinearGradient(x, y, x, y + h);
  g.addColorStop(0, 'rgba(0,0,0,0.55)');
  g.addColorStop(1, 'rgba(0,0,0,0.22)');
  ctx.fillStyle = g;
  ctx.fillRect(x, y, w, h);
  ctx.restore();

  ctx.save();
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, radius);
  ctx.lineWidth = borderWidth;
  ctx.strokeStyle = 'rgba(255,255,255,0.12)';
  ctx.stroke();
  ctx.restore();
}

/** Cuadro de Vida/Escudo en dos columnas divididas por una línea vertical — etiqueta+ícono
    arriba de cada columna y una fila de pips (corazones/escudos) debajo. `drawIcon` recibe
    (name, cx, cy, size, color, strokeWidth) — ya resuelto por el llamador (necesita ICON_PATHS
    de ui.jsx, que este módulo no importa). Devuelve el Y inferior del cuadro. */
export function paintVidaEscudoBox(ctx, {
  x, y, w, vidaVal, escudoVal, vidaMeta, escudoMeta, drawIcon,
  pipSize = 18, pipGap = 5, boxPad = 14, colGap = 16,
}) {
  const halfW = w / 2;
  const leftX = x + boxPad;
  const leftW = halfW - boxPad - colGap / 2;
  const rightX = x + halfW + colGap / 2;
  const rightW = halfW - boxPad - colGap / 2;

  const boxTop = y;
  const cy = boxTop + boxPad + 12;
  const pipY = cy + 12;

  const vidaH = pipRowHeight(vidaVal, leftW, pipSize, pipGap);
  const escudoH = pipRowHeight(escudoVal, rightW, pipSize, pipGap);
  const boxBottom = pipY + Math.max(vidaH, escudoH) + boxPad;

  paintBoxBg(ctx, x, boxTop, w, boxBottom - boxTop, 10);

  ctx.textAlign = 'left';
  drawIcon(vidaMeta.icon, leftX + 11, cy - 6, 20, vidaMeta.color, 2);
  ctx.fillStyle = 'rgba(220,230,255,0.8)';
  ctx.font = '600 16px "JetBrains Mono"';
  ctx.fillText(vidaMeta.label.toUpperCase(), leftX + 26, cy);

  drawIcon(escudoMeta.icon, rightX + 11, cy - 6, 20, escudoMeta.color, 2);
  ctx.fillStyle = 'rgba(220,230,255,0.8)';
  ctx.font = '600 16px "JetBrains Mono"';
  ctx.fillText(escudoMeta.label.toUpperCase(), rightX + 26, cy);

  drawPipRow(ctx, {
    count: vidaVal, x: leftX, maxWidth: leftW, y: pipY, size: pipSize, gap: pipGap,
    draw: (px, py, s) => drawHeartPip(ctx, px, py, s, vidaMeta.color),
  });
  drawPipRow(ctx, {
    count: escudoVal, x: rightX, maxWidth: rightW, y: pipY, size: pipSize, gap: pipGap,
    draw: (px, py, s) => drawShieldPip(ctx, px, py, s, escudoMeta.color),
  });

  ctx.strokeStyle = 'rgba(255,255,255,0.14)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x + halfW, boxTop + 6);
  ctx.lineTo(x + halfW, boxBottom - 6);
  ctx.stroke();

  return boxBottom;
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

/** Imprime una hoja con varias copias de un token rectangular pequeño (`dataUrl`),
    pensada para cortar como marcador físico de estado/buff en mesa. A diferencia
    de `printCardImage`, no fija un tamaño de página propio: se imprime sobre el
    papel que ya tenga cargado el usuario, repitiendo el token `copies` veces
    (el navegador pagina solo si no caben todas en una hoja). */
export function printTokenSheet(dataUrl, { mmW = TOKEN_W_MM, mmH = TOKEN_H_MM, copies = 8 } = {}, onBlocked) {
  const win = window.open('', '_blank', 'width=480,height=640');
  if (!win) { onBlocked?.(); return; }
  const cells = Array.from({ length: copies }, () => `<div class="token"><img src="${dataUrl}" /></div>`).join('');
  win.document.write(`<!doctype html><html><head><title>Marcadores imprimibles</title>
    <style>
      @page { margin: 10mm; }
      html, body { margin: 0; padding: 0; background: #fff; }
      .sheet { display: flex; flex-wrap: wrap; gap: 4mm; }
      .token { width: ${mmW}mm; height: ${mmH}mm; border: 1px dashed #999; border-radius: 3mm; overflow: hidden; }
      .token img { width: 100%; height: 100%; display: block; }
    </style>
  </head><body><div class="sheet">${cells}</div></body></html>`);
  win.document.close();
  setTimeout(() => { win.focus(); win.print(); }, 350);
}
