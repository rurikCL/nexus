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

/* ── Paleta de impresión ───────────────────────────────────────────────────
   Las cartas se generan para papel, no para pantalla: fondos claros (poca
   cobertura de tinta, sin negros saturados que la mayoría de las impresoras
   domésticas embarran) y tinta oscura para el texto. Todo color de texto,
   superficie o divisor de las cartas sale de acá — los acentos de color
   (frame.line, COMBAT_STAT_META…) son tonos vivos de rango medio, elegidos
   para tener contraste sobre papel blanco. */
export const INK = {
  paper:    '#ffffff',
  strong:   '#0f2036',                  // títulos y valores destacados
  body:     'rgba(17,36,56,0.86)',      // texto de datos
  muted:    'rgba(25,50,76,0.62)',      // etiquetas secundarias
  faint:    'rgba(30,56,84,0.58)',      // colofón / pies
  onAccent: '#ffffff',                  // texto sobre un relleno de acento
  surface1: 'rgba(255,255,255,0.82)',   // cajas internas (borde superior del degradé)
  surface2: 'rgba(255,255,255,0.52)',   // cajas internas (borde inferior)
  hair:     'rgba(15,32,54,0.20)',      // bordes y divisores
  hairSoft: 'rgba(15,32,54,0.10)',      // divisores de fila
};

export function mediaUrl(path) {
  if (!path) return null;
  if (/^(https?:)?\/\//.test(path) || path.startsWith('data:') || path.startsWith('blob:')) return path;
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  if (cleanPath.startsWith('/storage/')) return cleanPath;
  if (cleanPath.startsWith('/public/'))  return cleanPath.replace('/public/', '/storage/');
  if (cleanPath.startsWith('/assets/'))  return cleanPath;
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
export function drawImageRounded(ctx, img, x, y, w, h, radius, borderColor, borderWidth = 3, alignY = 'center', fit = 'contain', bgColor = INK.paper) {
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, radius);
  ctx.closePath();
  ctx.clip();
  ctx.fillStyle = bgColor;
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
  // sombra apenas marcada: el logo es dorado y sobre papel blanco necesita un
  // contorno mínimo, pero un halo negro como el de pantalla se imprime sucio.
  ctx.shadowColor = 'rgba(15,32,54,0.28)';
  ctx.shadowBlur = 3;
  ctx.drawImage(img, x, y, size, size);
  ctx.restore();
}

/** Igual que `paintCardLogo` pero centrado en (cx, cy) — para colocarlo en cualquier punto de la carta (p.ej. una columna central del pie). */
export async function paintLogoAt(ctx, cx, cy, size = 40) {
  if (!cardLogoPromise) cardLogoPromise = loadImage(CARD_LOGO_URL);
  const img = await cardLogoPromise;
  if (!img) return;
  ctx.save();
  ctx.shadowColor = 'rgba(15,32,54,0.28)';
  ctx.shadowBlur = 3;
  ctx.drawImage(img, cx - size / 2, cy - size / 2, size, size);
  ctx.restore();
}

/** Mezcla dos colores `#rrggbb` en proporción `t` (0 = a, 1 = b) y devuelve otro
    `#rrggbb` — canvas 2D no resuelve color-mix(), así que los tonos derivados de
    una paleta se calculan acá. Devuelve hex (no rgba) a propósito: el resto del
    módulo compone la opacidad concatenando el sufijo alfa (`${color}52`). */
export function mixHex(a, b, t) {
  const parse = (hex) => {
    const n = parseInt(hex.replace('#', ''), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  };
  const [r1, g1, b1] = parse(a);
  const [r2, g2, b2] = parse(b);
  const ch = (c1, c2) => Math.round(c1 + (c2 - c1) * t).toString(16).padStart(2, '0');
  return `#${ch(r1, r2)}${ch(g1, g2)}${ch(b1, b2)}`;
}

/** Tono de borde de la viñeta de una carta: el tinte del marco llevado hacia su
    acento, lo bastante oscuro para leerse como degradé sin volverse una mancha
    de tinta en la esquina. */
export const frameEdge = (frame) => mixHex(frame.bg1, frame.line, 0.62);

/** Fondo de carta con viñeta: centro claro y degradé hacia un tono más oscuro del
    acento en los bordes. El degradé es elíptico (se escala al alto/ancho de la
    carta) para que los cuatro bordes se oscurezcan por igual en vez de hacerlo
    solo las esquinas, como haría un radial circular sobre un rectángulo 5:7.
    `edgeColor` es el tono de borde ya resuelto por el llamador (ver `frameEdge`). */
export function paintVignetteBackground(ctx, x, y, w, h, radius, edgeColor) {
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, radius);
  ctx.clip();

  const cx = x + w / 2;
  const cy = y + h / 2;

  ctx.translate(cx, cy);
  ctx.scale(1, h / w);
  const r = w * 0.72;
  /* La rampa deja limpio el centro (donde van los textos que no llevan panel
     detrás: línea de tipo, colofón) y concentra la carga cerca del borde: ~20%
     en el medio de cada lado y ~72% en las esquinas. Subirla más se imprime como
     un bloque de tinta en vez de un degradé. */
  const shade = ctx.createRadialGradient(0, 0, r * 0.18, 0, 0, r);
  shade.addColorStop(0, `${edgeColor}00`);
  shade.addColorStop(0.45, `${edgeColor}0a`);
  shade.addColorStop(0.69, `${edgeColor}33`);
  shade.addColorStop(0.85, `${edgeColor}66`);
  shade.addColorStop(1, `${edgeColor}b8`);
  ctx.fillStyle = shade;
  ctx.fillRect(-w, -h, w * 2, h * 2);

  ctx.restore();
}

const SHIELD_PATH = 'M12 3l8 3v6c0 5-4 8-8 9-4-1-8-4-8-9V6z';

/** Dibuja un corazón relleno (pip de Vida) con esquina superior-izquierda en (x, y). */
function drawHeartPip(ctx, x, y, size, color) {
  const topCurveHeight = size * 0.3;
  ctx.save();
  ctx.fillStyle = color;
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
  ctx.fillStyle = `${color}30`;
  ctx.fill(path);
  ctx.lineWidth = 2;
  ctx.strokeStyle = color;
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
    ctx.fillStyle = INK.body;
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

/** Sombra exterior suave para un rectángulo redondeado (o un círculo, pasando
    `radius = w / 2`): dibuja SOLO la sombra, recortando la silueta del propio
    cuadro con regla evenodd. Así el panel de arriba puede seguir siendo
    translúcido — si se pintara un relleno opaco como proyector de sombra, las
    cajas taparían la rejilla del fondo y la marca de agua de las cartas de Jefe.
    Tono gris-azulado y desplazamiento corto: en papel una sombra negra amplia se
    imprime como una mancha, no como profundidad. */
export function paintDropShadow(ctx, x, y, w, h, radius = 10, { blur = 9, offsetY = 3, color = 'rgba(15,32,54,0.30)' } = {}) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, ctx.canvas.width, ctx.canvas.height);
  ctx.roundRect(x, y, w, h, radius);
  ctx.clip('evenodd');
  ctx.shadowColor = color;
  ctx.shadowBlur = blur;
  ctx.shadowOffsetY = offsetY;
  ctx.fillStyle = '#000';
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, radius);
  ctx.fill();
  ctx.restore();
}

/** Panel blanco con degradé semitransparente + borde sutil y sombra exterior,
    recortado a un rectángulo redondeado — aclara el tinte del marco para separar
    el contenido sin gastar tinta, y la sombra lo despega del fondo. */
export function paintBoxBg(ctx, x, y, w, h, radius = 10, borderWidth = 1) {
  paintDropShadow(ctx, x, y, w, h, radius);
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, radius);
  ctx.clip();
  const g = ctx.createLinearGradient(x, y, x, y + h);
  g.addColorStop(0, INK.surface1);
  g.addColorStop(1, INK.surface2);
  ctx.fillStyle = g;
  ctx.fillRect(x, y, w, h);
  ctx.restore();

  ctx.save();
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, radius);
  ctx.lineWidth = borderWidth;
  ctx.strokeStyle = INK.hair;
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
  ctx.fillStyle = INK.body;
  ctx.font = '600 16px "JetBrains Mono"';
  ctx.fillText(vidaMeta.label.toUpperCase(), leftX + 26, cy);

  drawIcon(escudoMeta.icon, rightX + 11, cy - 6, 20, escudoMeta.color, 2);
  ctx.fillStyle = INK.body;
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

  ctx.strokeStyle = INK.hair;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x + halfW, boxTop + 6);
  ctx.lineTo(x + halfW, boxBottom - 6);
  ctx.stroke();

  return boxBottom;
}

/* Metadatos de los 7 atributos de combate compartidos por personajes, NPCs,
   jefes y enemigos — mismos íconos y mismo lenguaje cromático que BONUS_FIELDS
   en ArmadoSable.jsx (ATQ naranja, DEF cian, PNT verde, AGI violeta, INI
   dorado...), pero un paso más oscuros: los tonos de pantalla (#26e3e3,
   #a78bfa, #E6B325…) son demasiado claros para leerse sobre papel blanco.
   Ver PRINT_ACCENT más abajo para los tonos de daño/bonos. */
export const COMBAT_STAT_META = {
  vida:       { label: 'Vida',       icon: 'zap',    color: '#d81b3c' },
  escudo:     { label: 'Escudo',     icon: 'shield', color: '#0891b2' },
  defensa:    { label: 'Defensa',    icon: 'shield', color: '#0a7ec2' },
  ataque:     { label: 'Ataque',     icon: 'sword',  color: '#e2650b' },
  movimiento: { label: 'Agilidad',   icon: 'zap',    color: '#7a35e0' },
  iniciativa: { label: 'Iniciativa', icon: 'star',   color: '#a9760a' },
  punteria:   { label: 'Puntería',   icon: 'eye',    color: '#0f9d63' },
};

/* Acentos de impresión para los valores que no son uno de los 7 atributos
   (daño, daño a escudo, daño perforante, fuerza, costo…). Mismo criterio:
   tonos vivos de rango medio, legibles sobre blanco. */
export const PRINT_ACCENT = {
  dano:           '#e2650b',
  danoEscudo:     '#0891b2',
  danoPerforante: '#5b7391',
  danoBonus:      '#dc4a10',
  fuerza:         '#16a34a',
  fuerzaGen:      '#5f9109',
  energia:        '#0a7ec2',
  cooldown:       '#0a7ec2',
  costo:          '#a9760a',
  buff:           '#0f9d63',
  debuff:         '#d81b3c',
};

/* Acento de cada Forma para impresión, indexado por `id` de NX.CLASSES — los
   `accent` del catálogo son tonos de pantalla (#ffb01f, #E6B325…) demasiado
   claros para leerse sobre papel blanco o llevar texto blanco encima; estos
   mantienen el matiz de cada forma un paso más oscuro. */
export const PRINT_FORMA_ACCENT = {
  forma1: '#c47f05', forma2: '#0a7ec2', forma3: '#0f9d63', forma4: '#e2650b',
  forma5: '#7a35e0', forma6: '#a9760a', forma7: '#d81b3c',
};
export const formaAccent = (classInfo) => PRINT_FORMA_ACCENT[classInfo?.id] ?? '#4b6a90';
export const COMBAT_STATS = Object.keys(COMBAT_STAT_META);
export const COMBAT_STAT_DEFAULTS = { vida: 8, escudo: 4, defensa: 2, ataque: 2, movimiento: 2, iniciativa: 2, punteria: 2 };

/** Abre una ventana nueva e imprime `dataUrl` (PNG) al tamaño físico exacto de una carta Magic (63mm × 88mm). */
export function printCardImage(dataUrl, onBlocked, { mmW = 63, mmH = 88 } = {}) {
  const win = window.open('', '_blank', 'width=420,height=620');
  if (!win) { onBlocked?.(); return; }
  win.document.write(`<!doctype html><html><head><title>Carta imprimible</title>
    <style>
      @page { size: ${mmW}mm ${mmH}mm; margin: 0; }
      html, body { margin: 0; padding: 0; background: #fff; }
      img { width: ${mmW}mm; height: ${mmH}mm; display: block; }
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
