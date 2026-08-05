import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ICON_PATHS, toast } from './ui.jsx';
import { NX } from '../data/seed.js';
import {
  CARD_W, CARD_H, TOKEN_W, TOKEN_H, TOKEN_W_MM, TOKEN_H_MM, mediaUrl, loadImage, ensureFonts,
  drawIcon as drawIconRaw, drawImageRounded, fitText, wrapText, printCardImage, printTokenSheet, paintCardLogo, paintVignetteBackground, paintEdgeFade, paintBoxBg,
  COMBAT_STAT_META, PRINT_ACCENT, INK, formaAccent, paintDropShadow, frameEdge, drawHeartPip, drawShieldPip,
} from '../utils/printableCard.js';

const drawIcon = (ctx, name, cx, cy, size, color, strokeWidth) =>
  drawIconRaw(ctx, ICON_PATHS, name, cx, cy, size, color, strokeWidth);

/* Paletas de marco reutilizadas por las 4 variantes de carta — mismo criterio
   que SIDE_FRAME en CharacterCard.jsx (canvas 2D no puede resolver var(--css)
   ni color-mix(), así que todo va en hex).
   Están pensadas para papel, no para pantalla: `bg1`/`bg2` son tintes claros
   del acento (poca cobertura de tinta, sin negros que la mayoría de las
   impresoras domésticas embarran) y `line` es el acento vivo que da identidad
   al marco y tiene contraste sobre ese fondo. */
const FRAME = {
  neutral: { bg1: '#e4ebf5', bg2: '#f4f7fb', line: '#4b6a90' },
  info:    { bg1: '#d5ecfa', bg2: '#eff8fe', line: '#0a7ec2' },
  ok:      { bg1: '#d6f2e4', bg2: '#eefaf4', line: '#0f9d63' },
  danger:  { bg1: '#ffdfe3', bg2: '#fff1f3', line: '#e01f3d' },
  gold:    { bg1: '#fdeec6', bg2: '#fff9e9', line: '#c08a06' },
  purple:  { bg1: '#e9defd', bg2: '#f6f1fe', line: '#7a35e0' },
  orange:  { bg1: '#ffe3cd', bg2: '#fff4ea', line: '#e2650b' },
  toxic:   { bg1: '#e9f5c8', bg2: '#f6fce8', line: '#5f9109' },
};

const stackCounts = (value) => {
  const counts = {};
  if (Array.isArray(value)) {
    for (const stat of value) {
      if (!stat) continue;
      counts[stat] = (counts[stat] ?? 0) + 1;
    }
    return counts;
  }
  if (value && typeof value === 'object') {
    for (const [stat, raw] of Object.entries(value)) {
      const n = Number(raw) || 0;
      if (n > 0) counts[stat] = n;
    }
  }
  return counts;
};

const STAT_PILL_ICON_SIZE = 12;
const STAT_PILL_ICON_GAP = 4;
const STAT_PILL_H = 22;
const STAT_PILL_GAP = 6;

/** Ancho de una píldora de stat (ícono + etiqueta + contador), usado tanto para medir como para dibujar. */
function statPillWidth(ctx, entry) {
  const label = `${entry.label}${entry.count > 1 ? ` +${entry.count}` : ''}`;
  ctx.font = '700 11px "JetBrains Mono"';
  const textW = Math.ceil(ctx.measureText(label).width);
  return { label, pillW: textW + STAT_PILL_ICON_SIZE + STAT_PILL_ICON_GAP + 16 };
}

/** Alto total que ocuparía `paintStatPills` sin dibujar nada — para reservar el alto de una caja
 * de fondo ANTES de pintar su contenido encima (mismo criterio que pipRowHeight en printableCard.js). */
function measureStatPillsHeight(ctx, entries, maxWidth) {
  if (!entries.length) return 18;
  let cx = 0;
  let cy = 0;
  for (const entry of entries) {
    const { pillW } = statPillWidth(ctx, entry);
    if (cx > 0 && cx + pillW > maxWidth) {
      cx = 0;
      cy += STAT_PILL_H + STAT_PILL_GAP;
    }
    cx += pillW + STAT_PILL_GAP;
  }
  return cy + STAT_PILL_H;
}

/** Píldoras de stat (ícono + etiqueta + contador) que envuelven si no caben en `maxWidth` —
 * mismo ícono/color que su fila equivalente en COMBAT_STAT_META (ver toEntries en drawHabilidadCard),
 * para que un Buff/Debuff se reconozca con el mismo lenguaje visual que el resto del catálogo. */
function paintStatPills(ctx, entries, x, y, maxWidth, emptyText, emptyColor) {
  if (!entries.length) {
    ctx.textAlign = 'left';
    ctx.fillStyle = emptyColor;
    ctx.font = '400 13px "JetBrains Mono"';
    ctx.fillText(emptyText, x, y + 2);
    return y + 18;
  }

  let cx = x;
  let cy = y;

  for (const entry of entries) {
    const { label, pillW } = statPillWidth(ctx, entry);
    if (cx > x && cx + pillW > x + maxWidth) {
      cx = x;
      cy += STAT_PILL_H + STAT_PILL_GAP;
    }

    ctx.beginPath();
    ctx.roundRect(cx, cy, pillW, STAT_PILL_H, 8);
    ctx.fillStyle = `${entry.color}1f`;
    ctx.fill();
    ctx.lineWidth = 1;
    ctx.strokeStyle = `${entry.color}80`;
    ctx.stroke();

    drawIcon(ctx, entry.icon ?? 'zap', cx + 8 + STAT_PILL_ICON_SIZE / 2, cy + STAT_PILL_H / 2, STAT_PILL_ICON_SIZE, entry.color, 1.8);
    ctx.fillStyle = entry.color;
    ctx.textAlign = 'left';
    ctx.fillText(label, cx + 8 + STAT_PILL_ICON_SIZE + STAT_PILL_ICON_GAP, cy + 14);
    cx += pillW + STAT_PILL_GAP;
  }

  return cy + STAT_PILL_H;
}

/** Envuelve un dibujo con un halo blanco doble-pasada — mismo criterio que `conHalo` en
 * CharacterCard.jsx, para que el texto/ícono se lea sobre cualquier arte de fondo. */
function withHalo(ctx, draw, blur = 10) {
  ctx.save();
  ctx.shadowColor = 'rgba(255,255,255,0.95)';
  ctx.shadowBlur = blur;
  draw();
  draw();
  ctx.restore();
}

function getNpcLikeLocation(entity) {
  const lugar = entity?.lugar ?? entity?.lugares?.[0] ?? null;
  const planeta = lugar?.zona?.planeta ?? null;

  return {
    planeta: planeta ? { nombre: planeta.nombre ?? null, imagen: planeta.imagen ?? null } : null,
    lugar: lugar ? { nombre: lugar.nombre ?? null, imagen: lugar.imagen ?? null } : null,
  };
}

async function paintHeaderLocationCards(ctx, items, right, y, maxWidth, accentColor) {
  const visibleItems = items.filter((item) => item?.value);
  if (!visibleItems.length) return 0;

  const gap = 8;
  const chipH = 36;
  const count = visibleItems.length;
  const chipW = count === 1
    ? Math.min(190, Math.max(118, maxWidth))
    : Math.max(108, Math.min(144, (maxWidth - gap) / 2));
  const totalW = chipW * count + gap * (count - 1);
  let x = right - totalW;

  for (const item of visibleItems) {
    ctx.beginPath();
    ctx.roundRect(x, y, chipW, chipH, 8);
    ctx.fillStyle = 'rgba(7, 12, 24, 0.58)';
    ctx.fill();
    ctx.lineWidth = 1.2;
    ctx.strokeStyle = `${accentColor}aa`;
    ctx.stroke();

    const imgSize = 24;
    const imgX = x + 6;
    const imgY = y + (chipH - imgSize) / 2;
    const img = item.img ? await loadImage(mediaUrl(item.img)) : null;
    if (img) {
      drawImageRounded(ctx, img, imgX, imgY, imgSize, imgSize, 6, null, 0, 'center', 'cover', 'rgba(0,0,0,0)');
    } else {
      ctx.beginPath();
      ctx.roundRect(imgX, imgY, imgSize, imgSize, 6);
      ctx.fillStyle = 'rgba(255,255,255,0.08)';
      ctx.fill();
      ctx.lineWidth = 1;
      ctx.strokeStyle = `${accentColor}88`;
      ctx.stroke();
      ctx.fillStyle = accentColor;
      ctx.font = '700 11px "JetBrains Mono"';
      ctx.textAlign = 'center';
      ctx.fillText('•', imgX + imgSize / 2, imgY + 16);
    }

    ctx.textAlign = 'left';
    ctx.fillStyle = '#c6d4eb';
    ctx.font = '700 7px "JetBrains Mono"';
    ctx.fillText(item.label, imgX + imgSize + 6, y + 11);

    const valueMaxW = chipW - (imgSize + 20);
    const valueSize = fitText(ctx, item.value, valueMaxW, '700 12px "JetBrains Mono"', 8);
    ctx.fillStyle = '#ffffff';
    ctx.font = `700 ${valueSize}px "JetBrains Mono"`;
    ctx.fillText(item.value, imgX + imgSize + 6, y + 25);

    x += chipW + gap;
  }

  return chipH;
}

/** Fondo de arte a sangre para las cartas de NPC/Jefe/Enemigo — la imagen de la entidad ocupa
 * toda la carta (mismo criterio que la foto de personaje en CharacterCard.jsx): recorte
 * "cover" anclado arriba, velo blanco encima para que las cajas de datos mantengan contraste,
 * y el borde del marco se repinta después porque la imagen lo tapa. Sin imagen, cae a un
 * degradé radial con el ícono del tipo como marca de agua, igual que el resto del catálogo. */
function paintEntityBackgroundArt(ctx, img, iconName, pad, cardH, frame, {
  borderWidth = 3,
  edgeFadeColor = '#070f1d',
  edgeFadeBand,
  edgeFadeAlpha = 0.7,
} = {}) {
  const x = pad, y = pad, w = CARD_W - pad * 2, h = cardH - pad * 2;
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 22);
  ctx.clip();

  if (img) {
    const scale = Math.max(w / img.width, h / img.height);
    const dw = img.width * scale;
    const dh = img.height * scale;
    ctx.drawImage(img, x + (w - dw) / 2, y, dw, dh);
  } else {
    const g = ctx.createRadialGradient(x + w / 2, y + h / 2, 20, x + w / 2, y + h / 2, w / 1.1);
    g.addColorStop(0, `${frame.line}2e`);
    g.addColorStop(1, INK.paper);
    ctx.fillStyle = g;
    ctx.fillRect(x, y, w, h);
    ctx.globalAlpha = 0.4;
    drawIcon(ctx, iconName, x + w / 2, y + h / 2, 220, frame.line, 1.6);
    ctx.globalAlpha = 1;
  }
  ctx.restore();

  /* Degradado oscuro parejo desde cada borde hacia adentro, para mantener el color
     original del arte en el centro y oscurecer el perímetro de toda la carta. */
  paintEdgeFade(ctx, x, y, w, h, 22, edgeFadeColor, { band: edgeFadeBand, alpha: edgeFadeAlpha });

  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 22);
  ctx.lineWidth = borderWidth;
  ctx.strokeStyle = frame.line;
  ctx.stroke();
}

/** Pinta el marco (fondo + borde) de la carta y devuelve las coordenadas internas útiles. */
function paintFrame(ctx, frame, cardH = CARD_H, { borderWidth = 3 } = {}) {
  const pad = 22;
  ctx.fillStyle = frame.bg2;
  ctx.beginPath();
  ctx.roundRect(0, 0, CARD_W, cardH, 34);
  ctx.fill();

  const bg = ctx.createLinearGradient(0, 0, 0, cardH);
  bg.addColorStop(0, frame.bg1);
  bg.addColorStop(1, frame.bg2);
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(pad, pad, CARD_W - pad * 2, cardH - pad * 2, 22);
  ctx.clip();
  ctx.fillStyle = bg;
  ctx.fillRect(pad, pad, CARD_W - pad * 2, cardH - pad * 2);
  ctx.restore();

  paintVignetteBackground(ctx, pad, pad, CARD_W - pad * 2, cardH - pad * 2, 22, frameEdge(frame));

  ctx.save();
  ctx.beginPath();
  ctx.roundRect(pad, pad, CARD_W - pad * 2, cardH - pad * 2, 22);
  ctx.lineWidth = borderWidth;
  ctx.strokeStyle = frame.line;
  ctx.stroke();
  ctx.restore();

  return { pad, innerX: pad + 22, innerRight: CARD_W - pad - 22 };
}

/** Encabezado común: nombre (arriba-izq.) + medallón circular (arriba-der.). */
function paintHeader(ctx, { title, pad, innerX, innerRight, badgeText, badgeColor, halo = false, titleColor = INK.strong, padX = 0 }) {
  const x = innerX + padX;
  const right = innerRight - padX;
  ctx.textAlign = 'left';
  const displayName = (title ?? '???').toUpperCase();
  fitText(ctx, displayName, right - x - 66, '30px Orbitron');
  ctx.fillStyle = titleColor;
  const drawTitle = () => ctx.fillText(displayName, x, pad + 54);
  if (halo) withHalo(ctx, drawTitle, 12); else drawTitle();

  if (badgeText !== null && badgeText !== undefined) {
    paintDropShadow(ctx, right - 47, pad + 17, 46, 46, 23, { blur: 7, offsetY: 2 });
    ctx.beginPath();
    ctx.arc(right - 24, pad + 40, 23, 0, Math.PI * 2);
    ctx.fillStyle = badgeColor;
    ctx.fill();
    ctx.textAlign = 'center';
    ctx.fillStyle = INK.onAccent;
    ctx.font = '800 18px Orbitron';
    ctx.fillText(String(badgeText).slice(0, 3).toUpperCase(), right - 24, pad + 47);
  }
}

/** Caja de arte: imagen (si hay) o gradiente + ícono de respaldo. */
async function paintArt(ctx, imgSrc, iconName, iconColor, innerX, artY, innerW, artH, borderColor, bgColor) {
  const img = await loadImage(mediaUrl(imgSrc));
  paintDropShadow(ctx, innerX, artY, innerW, artH, 16);
  if (img) {
    drawImageRounded(ctx, img, innerX, artY, innerW, artH, 16, `${borderColor}99`, 3, 'center', 'contain', bgColor ?? INK.paper);
    return;
  }
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(innerX, artY, innerW, artH, 16);
  ctx.clip();
  const g = ctx.createRadialGradient(
    innerX + innerW / 2, artY + artH / 2, 20,
    innerX + innerW / 2, artY + artH / 2, innerW / 1.3,
  );
  g.addColorStop(0, `${iconColor}2e`);
  g.addColorStop(1, INK.paper);
  ctx.fillStyle = g;
  ctx.fillRect(innerX, artY, innerW, artH);
  ctx.globalAlpha = 0.55;
  drawIcon(ctx, iconName, innerX + innerW / 2, artY + artH / 2, 150, iconColor, 1.6);
  ctx.globalAlpha = 1;
  ctx.restore();
  ctx.beginPath();
  ctx.roundRect(innerX, artY, innerW, artH, 16);
  ctx.lineWidth = 3;
  ctx.strokeStyle = `${borderColor}99`;
  ctx.stroke();
}

/** Línea de tipo centrada, con separadores horizontales (como la "type line" de una carta Magic). */
function paintTypeLine(ctx, label, typeY, innerX, innerRight, { halo = false } = {}) {
  /* va directo sobre el fondo (sin panel detrás), donde la viñeta ya suma tono:
     usa la tinta de cuerpo, no la secundaria, para no perderse. */
  ctx.textAlign = 'center';
  ctx.fillStyle = INK.body;
  ctx.font = '600 15px "JetBrains Mono"';
  const drawLabel = () => ctx.fillText(label.toUpperCase(), CARD_W / 2, typeY);
  if (halo) withHalo(ctx, drawLabel, 8); else drawLabel();
  ctx.strokeStyle = INK.hair;
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(innerX, typeY - 22); ctx.lineTo(innerRight, typeY - 22); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(innerX, typeY + 12); ctx.lineTo(innerRight, typeY + 12); ctx.stroke();
}

/** Filas de atributos (ícono + etiqueta + valor), con divisor — devuelve el Y final. */
function paintRows(ctx, rows, startY, innerX, innerRight, rowH = 47) {
  rows.forEach((r, i) => {
    const rowY = startY + i * rowH;
    drawIcon(ctx, r.icon, innerX + 13, rowY - 6, 22, r.color, 2);
    ctx.textAlign = 'left';
    ctx.fillStyle = INK.body;
    ctx.font = '600 16px "JetBrains Mono"';
    ctx.fillText(r.label.toUpperCase(), innerX + 34, rowY);

    ctx.textAlign = 'right';
    ctx.fillStyle = r.color;
    ctx.font = '800 22px Orbitron';
    const valueText = String(r.value);
    const valueX = r.suffixIcon ? innerRight - 34 : innerRight - 6;
    ctx.fillText(valueText, valueX, rowY + 3);
    if (r.suffixIcon) {
      ctx.save();
      ctx.translate(innerRight - 14, rowY);
      ctx.rotate(r.suffixRotation ?? 0);
      drawIcon(ctx, r.suffixIcon, -8, -8, 16, r.color, 2);
      ctx.restore();
    }

    ctx.strokeStyle = INK.hairSoft;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(innerX, rowY + 16);
    ctx.lineTo(innerRight, rowY + 16);
    ctx.stroke();
  });
  return startY + rows.length * rowH;
}

/** Fila de cuadros iguales lado a lado (ícono + valor + etiqueta, centrados), tipo stat-tile —
 * a diferencia de `paintRows` (lista vertical), esta se usa para agrupar valores relacionados
 * de forma horizontal (p.ej. daño / daño a escudo / daño perforante). Devuelve el Y final. */
function paintStatBoxes(ctx, entries, x, y, w, h, gap = 10) {
  const n = entries.length;
  const boxW = (w - gap * (n - 1)) / n;
  entries.forEach((e, i) => {
    const bx = x + i * (boxW + gap);
    paintBoxBg(ctx, bx, y, boxW, h, 10);
    ctx.textAlign = 'center';
    drawIcon(ctx, e.icon, bx + boxW / 2, y + 22, 18, e.color, 2);
    ctx.fillStyle = e.color;
    ctx.font = '800 20px Orbitron';
    ctx.fillText(String(e.value), bx + boxW / 2, y + h - 20);
    ctx.fillStyle = INK.muted;
    ctx.font = '600 10px "JetBrains Mono"';
    ctx.fillText(e.label.toUpperCase(), bx + boxW / 2, y + h - 7);
  });
  return y + h;
}

/** Marca de agua tenue detrás de todo el contenido — una corona gigante, apenas visible, que se
 * asoma por los huecos entre el arte y las cajas translúcidas. Exclusivo de las cartas de Jefe,
 * para darles más presencia física como carta "final boss" frente a un NPC/enemigo normal. */
function paintJefeWatermark(ctx, cardH, color) {
  const size = CARD_W * 0.72;
  ctx.save();
  ctx.globalAlpha = 0.18;
  drawIcon(ctx, 'crown', CARD_W / 2, cardH * 0.46, size, color, (4 * 24) / size);
  ctx.globalAlpha = 1;
  ctx.restore();
}

/** Marco doble + esquinas ornamentadas (bracket en L + gema) — refuerzo visual exclusivo de
 * las cartas de Jefe, para que se note físicamente como una carta distinta a un NPC/enemigo
 * normal incluso antes de leer el texto. */
function paintJefeAdornments(ctx, pad, cardH, color) {
  const innerPad = pad + 6;
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(innerPad, innerPad, CARD_W - innerPad * 2, cardH - innerPad * 2, 26);
  ctx.lineWidth = 2.4;
  ctx.strokeStyle = `${color}cc`;
  ctx.stroke();
  ctx.restore();

  const inset = 14;
  const armLen = 16;
  const corners = [
    { ax: pad + inset, ay: pad + inset, dx: 1, dy: 1 },
    { ax: CARD_W - pad - inset, ay: pad + inset, dx: -1, dy: 1 },
    { ax: CARD_W - pad - inset, ay: cardH - pad - inset, dx: -1, dy: -1 },
    { ax: pad + inset, ay: cardH - pad - inset, dx: 1, dy: -1 },
  ];
  corners.forEach(({ ax, ay, dx, dy }) => {
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = 3.1;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(ax + dx * armLen, ay);
    ctx.lineTo(ax, ay);
    ctx.lineTo(ax, ay + dy * armLen);
    ctx.stroke();
    ctx.restore();

    ctx.save();
    ctx.translate(ax, ay);
    ctx.rotate(Math.PI / 4);
    ctx.fillStyle = color;
    ctx.fillRect(-4, -4, 8, 8);
    ctx.restore();
  });
}

function paintColofon(ctx, text, cardH = CARD_H, { halo = false } = {}) {
  ctx.textAlign = 'center';
  ctx.fillStyle = INK.muted;
  ctx.font = '400 12px "JetBrains Mono"';
  const draw = () => ctx.fillText(text, CARD_W / 2, cardH - 22 - 8);
  if (halo) withHalo(ctx, draw, 6); else draw();
}

/** Ícono de reloj de arena, dibujado centrado en (cx, cy) — usado en los marcadores de cooldown del borde. */
function drawHourglassIcon(ctx, cx, cy, size, color) {
  const hw = size * 0.42;
  const hh = size * 0.46;
  const nw = size * 0.08;
  ctx.save();
  ctx.fillStyle = color;
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(1, size * 0.1);
  ctx.beginPath();
  ctx.moveTo(cx - hw, cy - hh);
  ctx.lineTo(cx + hw, cy - hh);
  ctx.lineTo(cx + nw, cy);
  ctx.lineTo(cx + hw, cy + hh);
  ctx.lineTo(cx - hw, cy + hh);
  ctx.lineTo(cx - nw, cy);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(cx - hw - 2, cy - hh);
  ctx.lineTo(cx + hw + 2, cy - hh);
  ctx.moveTo(cx - hw - 2, cy + hh);
  ctx.lineTo(cx + hw + 2, cy + hh);
  ctx.stroke();
  ctx.restore();
}

/**
 * Marcadores de cooldown "rotables" impresos en los 4 bordes de la carta — mecánica física de
 * mesa: al usar la habilidad se deja la carta boca arriba sin girar (1 reloj arriba). Cada ronda
 * siguiente se gira la carta 90° a la izquierda sobre la mesa, revelando el siguiente borde con
 * un reloj de arena más (2 a la derecha, 3 abajo, 4 a la izquierda), siempre orientado hacia el
 * jugador una vez girado. Cada marcador se imprime pre-rotado en sentido contrario al giro físico
 * acumulado (0°, 90°, 180°, 270°) para que, tras N giros a la izquierda, quede derecho — soporta
 * hasta 4 turnos de cooldown con un único diseño de carta.
 */
function paintCooldownBorderMarkers(ctx, pad, color) {
  const bandC = pad / 2;
  const iconSize = 18;
  const spacing = 24;
  const draw = (cx, cy, angle, count) => {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(angle);
    const totalW = (count - 1) * spacing;
    for (let i = 0; i < count; i++) {
      drawHourglassIcon(ctx, -totalW / 2 + i * spacing, 0, iconSize, color);
    }
    ctx.restore();
  };
  draw(CARD_W / 2, bandC, 0, 1);
  draw(CARD_W - bandC, CARD_H / 2, Math.PI / 2, 2);
  draw(CARD_W / 2, CARD_H - bandC, Math.PI, 3);
  draw(bandC, CARD_H / 2, -Math.PI / 2, 4);
}

/* ═══════════════════════════ HABILIDAD ═══════════════════════════ */

const TIPO_HAB_FRAME = { melee: 'orange', distancia: 'info', nave: 'purple' };
export const TIPO_HAB_LABEL = { melee: 'Cuerpo a cuerpo', distancia: 'A distancia', nave: 'Nave' };
const TIPO_HAB_ICON  = { melee: 'sword', distancia: 'target', nave: 'ship' };
const COOLDOWN_ARROW = {
  1: { rotation: Math.PI, label: '←' },
  2: { rotation: Math.PI / 2, label: '↓' },
  3: { rotation: 0, label: '→' },
  4: { rotation: -Math.PI / 2, label: '↑' },
};

export async function drawHabilidadCard(habilidad) {
  await ensureFonts();
  const forma = Number(habilidad.forma) || 0;
  const classInfo = forma >= 1 ? NX.CLASSES[forma - 1] : null;
  const frame = FRAME[TIPO_HAB_FRAME[habilidad.tipo]] ?? FRAME.neutral;
  const badgeColor = formaAccent(classInfo);

  const canvas = document.createElement('canvas');
  canvas.width = CARD_W;
  canvas.height = CARD_H;
  const ctx = canvas.getContext('2d');

  const { pad, innerX, innerRight } = paintFrame(ctx, frame);
  const innerW = innerRight - innerX;
  paintCooldownBorderMarkers(ctx, pad, frame.line);
  paintHeader(ctx, {
    title: habilidad.nombre, pad, innerX, innerRight,
    badgeText: classInfo ? classInfo.num.replace('Forma ', '') : 'U',
    badgeColor,
  });

  ctx.textAlign = 'left';
  drawIcon(ctx, TIPO_HAB_ICON[habilidad.tipo] ?? 'zap', innerX + 11, pad + 90, 22, frame.line, 2.1);
  ctx.fillStyle = frame.line;
  ctx.font = '700 16px "JetBrains Mono"';
  ctx.fillText(TIPO_HAB_LABEL[habilidad.tipo] ?? habilidad.tipo ?? '', innerX + 30, pad + 96);
  ctx.textAlign = 'right';
  ctx.fillStyle = INK.body;
  ctx.font = '600 14px "JetBrains Mono"';
  ctx.fillText(habilidad.objetivo === 'self' ? 'Sobre uno mismo' : 'Sobre el enemigo', innerRight - 6, pad + 96);

  const artY = pad + 118;
  const artH = 340;
  if (classInfo?.img) {
    const formaGap = 12;
    const formaW = 96;
    const mainW = innerW - formaW - formaGap;
    await paintArt(ctx, habilidad.icono_url ?? habilidad.icono, TIPO_HAB_ICON[habilidad.tipo] ?? 'zap', badgeColor, innerX, artY, mainW, artH, frame.line);
    await paintArt(ctx, classInfo.img, classInfo.icon ?? 'sword', badgeColor, innerX + mainW + formaGap, artY, formaW, artH, frame.line);
  } else {
    await paintArt(ctx, habilidad.icono_url ?? habilidad.icono, TIPO_HAB_ICON[habilidad.tipo] ?? 'zap', badgeColor, innerX, artY, innerW, artH, frame.line);
  }

  const typeY = artY + artH + 36;
  paintTypeLine(ctx, classInfo ? `${classInfo.num} · ${classInfo.name}` : 'Habilidad Universal', typeY, innerX, innerRight);

  const rows = [];
  rows.push({ icon: 'zap', label: 'Costo Fuerza', color: PRINT_ACCENT.costo, value: habilidad.costo_fuerza ?? 0 });
  if (habilidad.damage) rows.push({ icon: 'sword', label: 'Daño', color: PRINT_ACCENT.dano, value: habilidad.damage });
  if (habilidad.damage_escudo) rows.push({ icon: 'shield', label: 'Daño a Escudo', color: PRINT_ACCENT.danoEscudo, value: habilidad.damage_escudo });
  if (habilidad.damage_perforante) rows.push({ icon: 'fire', label: 'Daño Perforante', color: PRINT_ACCENT.danoPerforante, value: habilidad.damage_perforante });
  rows.push({
    icon: 'clock',
    label: 'Cooldown',
    color: PRINT_ACCENT.cooldown,
    value: habilidad.cooldown ?? 0,
    suffixIcon: 'arrow',
    suffixRotation: COOLDOWN_ARROW[habilidad.cooldown]?.rotation ?? 0,
  });

  const statsTop = typeY + 44;
  const rowsEndY = paintRows(ctx, rows, statsTop, innerX, innerRight, 42);

  /* ── caja de dos columnas: BUFF (izquierda) / DEBUFF (derecha), antes del cuadro de efecto —
     íconos y colores de COMBAT_STAT_META, igual que las filas de atributos de arriba. ── */
  const buffCounts = stackCounts(habilidad.buff);
  const debuffCounts = stackCounts(habilidad.debuff);
  const toEntries = (counts) => Object.entries(counts).map(([stat, count]) => ({
    stat,
    count,
    label: COMBAT_STAT_META[stat]?.label ?? stat.toUpperCase(),
    color: COMBAT_STAT_META[stat]?.color ?? INK.strong,
    icon: COMBAT_STAT_META[stat]?.icon ?? 'zap',
  }));
  const buffEntries = toEntries(buffCounts);
  const debuffEntries = toEntries(debuffCounts);

  const bdColGap = 22;
  const bdColW = (innerW - bdColGap) / 2;
  const bdColPad = 12;
  const bdPillsMaxW = bdColW - bdColPad * 2;
  const bdTitleH = 24;
  const bdBoxPad = 14;
  const bdContentH = Math.max(
    measureStatPillsHeight(ctx, buffEntries, bdPillsMaxW),
    measureStatPillsHeight(ctx, debuffEntries, bdPillsMaxW),
  );
  const bdBoxH = bdBoxPad + bdTitleH + bdContentH + bdBoxPad;
  const bdTop = rowsEndY + 18;
  const bdRightX = innerX + bdColW + bdColGap;
  paintBoxBg(ctx, innerX, bdTop, innerW, bdBoxH, 12);

  ctx.textAlign = 'left';
  ctx.fillStyle = PRINT_ACCENT.buff;
  ctx.font = '700 11px "JetBrains Mono"';
  ctx.fillText('BUFF', innerX + bdColPad, bdTop + bdBoxPad + 4);
  paintStatPills(ctx, buffEntries, innerX + bdColPad, bdTop + bdBoxPad + bdTitleH, bdPillsMaxW, 'Sin Buff', INK.muted);

  ctx.textAlign = 'left';
  ctx.fillStyle = PRINT_ACCENT.debuff;
  ctx.font = '700 11px "JetBrains Mono"';
  ctx.fillText('DEBUFF', bdRightX + bdColPad, bdTop + bdBoxPad + 4);
  paintStatPills(ctx, debuffEntries, bdRightX + bdColPad, bdTop + bdBoxPad + bdTitleH, bdPillsMaxW, 'Sin Debuff', INK.muted);

  ctx.strokeStyle = INK.hair;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(innerX + bdColW + bdColGap / 2, bdTop + 6);
  ctx.lineTo(innerX + bdColW + bdColGap / 2, bdTop + bdBoxH - 6);
  ctx.stroke();

  const infoTop = bdTop + bdBoxH + 18;
  const infoBottom = CARD_H - pad - 58;
  paintBoxBg(ctx, innerX, infoTop, innerW, infoBottom - infoTop, 12);

  let cursorY = infoTop + 18;
  ctx.textAlign = 'center';
  ctx.fillStyle = INK.muted;
  ctx.font = '600 11px "JetBrains Mono"';
  ctx.fillText('EFECTO', CARD_W / 2, cursorY);
  cursorY += 20;

  ctx.textAlign = 'center';
  ctx.fillStyle = INK.body;
  ctx.font = '400 17px "JetBrains Mono"';
  wrapText(ctx, habilidad.efecto || 'Sin descripción de efecto.', CARD_W / 2, cursorY, innerW - 16, 23, 4);

  paintColofon(ctx, `Habilidades · Catálogo NÉXUS`);
  await paintCardLogo(ctx, innerRight, CARD_H - pad);
  return canvas;
}

/* ═══════════════════════════ OBJETO ═══════════════════════════ */

const RAREZA_FRAME = { comun: 'neutral', poco_comun: 'ok', raro: 'info', epico: 'purple', legendario: 'gold' };
export const RAREZA_LABEL = { comun: 'Común', poco_comun: 'Poco común', raro: 'Raro', epico: 'Épico', legendario: 'Legendario' };
export const TIPO_OBJ_LABEL = {
  arma: 'Arma', nucleo_energia: 'Núcleo de energía', cristal: 'Cristal', lente_enfoque: 'Lente de enfoque',
  emisor: 'Emisor', estabilizador: 'Estabilizador', empunadura: 'Empuñadura', modulo_activacion: 'Módulo de activación',
  accesorio: 'Accesorio', mejora_nave: 'Mejora de nave',
  armadura: 'Armadura', mejora_armadura: 'Mejora de armadura',
};
const TIPO_OBJ_ICON = {
  arma: 'sword', nucleo_energia: 'zap', cristal: 'star', lente_enfoque: 'eye', emisor: 'zap',
  estabilizador: 'shield', empunadura: 'anvil', modulo_activacion: 'settings', accesorio: 'box', mejora_nave: 'ship',
  armadura: 'shield', mejora_armadura: 'settings',
};
/* Bonos de objeto — mismos matices que COMBAT_STAT_META/PRINT_ACCENT, en versión papel. */
const BONUS_META = {
  bono_ataque:            { label: 'ATQ',  color: COMBAT_STAT_META.ataque.color,     icon: 'sword' },
  bono_defensa:           { label: 'DEF',  color: COMBAT_STAT_META.defensa.color,    icon: 'shield' },
  bono_punteria:          { label: 'PNT',  color: COMBAT_STAT_META.punteria.color,   icon: 'eye' },
  bono_movimiento:        { label: 'AGI',  color: COMBAT_STAT_META.movimiento.color, icon: 'zap' },
  bono_iniciativa:        { label: 'INI',  color: COMBAT_STAT_META.iniciativa.color, icon: 'star' },
  bono_vida:              { label: 'VID',  color: COMBAT_STAT_META.vida.color,       icon: 'zap' },
  bono_escudo:            { label: 'ESC',  color: COMBAT_STAT_META.escudo.color,     icon: 'shield' },
  bono_dano:              { label: 'DMG',  color: PRINT_ACCENT.danoBonus,            icon: 'flame' },
  bono_dano_perforante:   { label: 'DMGP', color: PRINT_ACCENT.danoPerforante,       icon: 'fire' },
  bono_critico:           { label: 'CRT',  color: '#c81e4a',                         icon: 'target' },
  bono_fuerza:            { label: 'FZ',   color: PRINT_ACCENT.fuerza,               icon: 'dumbbell' },
  bono_generacion_fuerza: { label: 'GEN',  color: PRINT_ACCENT.fuerzaGen,            icon: 'trending' },
};

export async function drawObjetoCard(objeto) {
  await ensureFonts();
  const frame = FRAME[RAREZA_FRAME[objeto.rareza]] ?? FRAME.neutral;

  const canvas = document.createElement('canvas');
  canvas.width = CARD_W;
  canvas.height = CARD_H;
  const ctx = canvas.getContext('2d');

  const { pad, innerX, innerRight } = paintFrame(ctx, frame);
  const innerW = innerRight - innerX;
  paintHeader(ctx, {
    title: objeto.nombre, pad, innerX, innerRight,
    badgeText: (RAREZA_LABEL[objeto.rareza] ?? '?').charAt(0),
    badgeColor: frame.line,
  });

  ctx.textAlign = 'left';
  drawIcon(ctx, TIPO_OBJ_ICON[objeto.tipo] ?? 'box', innerX + 11, pad + 90, 22, frame.line, 2.1);
  ctx.fillStyle = frame.line;
  ctx.font = '700 16px "JetBrains Mono"';
  ctx.fillText(TIPO_OBJ_LABEL[objeto.tipo] ?? objeto.tipo ?? '', innerX + 30, pad + 96);
  ctx.textAlign = 'right';
  ctx.fillStyle = INK.body;
  ctx.font = '600 14px "JetBrains Mono"';
  ctx.fillText(`₡ ${objeto.costo ?? 0}`, innerRight - 6, pad + 96);

  const artY = pad + 118;
  const artH = 340;
  await paintArt(ctx, objeto.imagen, TIPO_OBJ_ICON[objeto.tipo] ?? 'box', frame.line, innerX, artY, innerW, artH, frame.line);

  const typeY = artY + artH + 36;
  paintTypeLine(ctx, RAREZA_LABEL[objeto.rareza] ?? objeto.rareza ?? 'Objeto', typeY, innerX, innerRight);

  const rows = [];
  if (objeto.dano) rows.push({ icon: 'sword', label: objeto.tipo_ataque ? `Daño (${objeto.tipo_ataque})` : 'Daño', color: PRINT_ACCENT.dano, value: objeto.dano });
  if (objeto.dano_perforante) rows.push({ icon: 'fire', label: 'Daño Perforante', color: PRINT_ACCENT.danoPerforante, value: objeto.dano_perforante });
  if (objeto.energia_maxima) rows.push({ icon: 'zap', label: 'Energía Máxima', color: PRINT_ACCENT.energia, value: objeto.energia_maxima });
  for (const key of Object.keys(BONUS_META)) {
    const v = objeto[key];
    if (v) rows.push({ icon: BONUS_META[key].icon, label: `Bono ${BONUS_META[key].label}`, color: BONUS_META[key].color, value: v > 0 ? `+${v}` : v });
  }
  const visibleRows = rows.slice(0, 8);

  const statsTop = typeY + 44;
  const rowsEndY = paintRows(ctx, visibleRows, statsTop, innerX, innerRight, 42);

  const rulesY = rowsEndY + 26;
  ctx.textAlign = 'center';
  ctx.fillStyle = INK.body;
  ctx.font = '400 17px "JetBrains Mono"';
  const text = [objeto.descripcion, objeto.efecto].filter(Boolean).join(' — ') || 'Sin descripción.';
  wrapText(ctx, text, CARD_W / 2, rulesY, innerW - 8, 23, 4);

  if (objeto.color_hoja) {
    /* el punto de color de hoja lleva contorno: los sables claros (blanco, ámbar)
       serían invisibles impresos sobre el fondo claro de la carta. */
    ctx.beginPath();
    ctx.arc(innerX + 16, CARD_H - pad - 46, 8, 0, Math.PI * 2);
    ctx.fillStyle = NX.SABERS[objeto.color_hoja] ?? PRINT_ACCENT.energia;
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = 'rgba(15,32,54,0.5)';
    ctx.stroke();
  }

  paintColofon(ctx, objeto.activo === false ? 'Descontinuado · Catálogo NÉXUS' : 'Objetos · Catálogo NÉXUS');
  await paintCardLogo(ctx, innerRight, CARD_H - pad);
  return canvas;
}

/* ═══════════════════════════ NPC / JEFE / ENEMIGO ═══════════════════════════ */

const NPC_TIPO_FRAME = { aliado: 'info', neutral: 'neutral', hostil: 'danger', entrenador: 'ok', mercader: 'gold', mision: 'purple', jefe: 'gold' };
export const NPC_TIPO_LABEL = { aliado: 'Aliado', neutral: 'Neutral', hostil: 'Hostil', entrenador: 'Entrenador', mercader: 'Mercader', mision: 'Misión', jefe: 'Jefe de Asalto' };
const NPC_TIPO_ICON  = { aliado: 'user', neutral: 'user', hostil: 'flame', entrenador: 'shield', mercader: 'coin', mision: 'star', jefe: 'crown' };

/** Una celda de la grilla de habilidades del NPC/jefe: ícono cuadrado (imagen si existe, si no
 * un ícono de respaldo según su tipo) con borde, igual criterio visual que `paintArt` pero a
 * tamaño de miniatura. */
async function paintHabilidadIconCell(ctx, hab, x, y, size, borderColor) {
  const iconName = TIPO_HAB_ICON[hab?.tipo] ?? 'zap';
  const iconColor = FRAME[TIPO_HAB_FRAME[hab?.tipo] ?? 'info']?.line ?? PRINT_ACCENT.energia;
  const img = await loadImage(mediaUrl(hab?.icono_url ?? hab?.icono));

  paintDropShadow(ctx, x, y, size, size, 14, { blur: 7, offsetY: 2 });
  if (img) {
    drawImageRounded(ctx, img, x, y, size, size, 14, `${borderColor}99`, 2.4, 'center', 'cover');
    return;
  }

  ctx.save();
  ctx.beginPath();
  ctx.roundRect(x, y, size, size, 14);
  ctx.clip();
  const g = ctx.createRadialGradient(x + size / 2, y + size / 2, size * 0.12, x + size / 2, y + size / 2, size * 0.75);
  g.addColorStop(0, `${iconColor}2e`);
  g.addColorStop(1, INK.paper);
  ctx.fillStyle = g;
  ctx.fillRect(x, y, size, size);
  ctx.globalAlpha = 0.7;
  drawIcon(ctx, iconName, x + size / 2, y + size / 2, size * 0.46, iconColor, 1.8);
  ctx.globalAlpha = 1;
  ctx.restore();
  ctx.beginPath();
  ctx.roundRect(x, y, size, size, 14);
  ctx.lineWidth = 2.4;
  ctx.strokeStyle = `${borderColor}99`;
  ctx.stroke();
}

/** Grilla 2×2 de las hasta 4 habilidades del NPC/jefe (habilidad1..4), imagen + nombre debajo
 * de cada una — centrada en el ancho disponible. Los cupos sin habilidad quedan vacíos
 * (recuadro punteado) para no romper la simetría 2×2. Devuelve el alto total ocupado. */
async function paintHabilidadesGrid(ctx, habilidades, x, w, y, borderColor, cellSize = 108, labelH = 20, rowGap = 20, colGap = 22) {
  const rowH = cellSize + labelH;
  const gridW = cellSize * 2 + colGap;
  const gridX = x + (w - gridW) / 2;

  for (let i = 0; i < 4; i++) {
    const hab = habilidades[i];
    const col = i % 2;
    const row = Math.floor(i / 2);
    const cx = gridX + col * (cellSize + colGap);
    const cy = y + row * (rowH + rowGap);

    if (!hab) {
      ctx.save();
      ctx.setLineDash([6, 6]);
      ctx.strokeStyle = INK.hair;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(cx, cy, cellSize, cellSize, 14);
      ctx.stroke();
      ctx.restore();
      continue;
    }

    await paintHabilidadIconCell(ctx, hab, cx, cy, cellSize, borderColor);
    ctx.textAlign = 'center';
    ctx.fillStyle = INK.strong;
    const size = fitText(ctx, hab.nombre ?? '', cellSize + 10, '11px "JetBrains Mono"', 8);
    ctx.font = `600 ${size}px "JetBrains Mono"`;
    ctx.fillText(hab.nombre ?? '', cx + cellSize / 2, cy + cellSize + labelH - 5);
  }

  return rowH * 2 + rowGap;
}

async function drawNpcLikeCard(entity, { forcedFrameKey, kicker } = {}) {
  await ensureFonts();
  const frame = forcedFrameKey ? FRAME[forcedFrameKey] : (FRAME[NPC_TIPO_FRAME[entity.tipo]] ?? FRAME.danger);
  const nivel = entity.nivel ?? 1;

  const cardH = CARD_H;

  const canvas = document.createElement('canvas');
  canvas.width = CARD_W;
  canvas.height = cardH;
  const ctx = canvas.getContext('2d');

  const icon = NPC_TIPO_ICON[entity.tipo] ?? 'user';
  const artImg = await loadImage(mediaUrl(entity.imagen ?? entity.imagen_mini));

  const npcBorderWidth = 4.8;
  const { pad, innerX, innerRight } = paintFrame(ctx, frame, cardH, { borderWidth: npcBorderWidth });
  const innerW = innerRight - innerX;

  /* La imagen de la entidad ocupa toda la carta como fondo, igual que la foto de
     personaje en CharacterCard.jsx — el marco/borde en degradé se mantiene igual. */
  paintEntityBackgroundArt(ctx, artImg, icon, pad, cardH, frame, {
    borderWidth: npcBorderWidth,
    edgeFadeBand: 64,
    edgeFadeAlpha: 0.78,
  });

  if (entity.tipo === 'jefe') {
    paintJefeWatermark(ctx, cardH, frame.line);
    paintJefeAdornments(ctx, pad, cardH, frame.line);
  }

  const forma = Number(entity.forma) || 0;
  const formaInfo = forma >= 1 ? NX.CLASSES[forma - 1] : null;
  const formaImg = formaInfo?.img ? await loadImage(formaInfo.img) : null;

  /* Cabecera estilo carta de personaje: columna de fichas a la izquierda y bloque
     tipográfico a la derecha, todo sobre el arte con halo para mantener legibilidad. */
  const headerTop = pad + 8;
  const headerPad = 10;
  const rankPipR = 17;
  const statPipR = 21;
  const maxPipR = Math.max(rankPipR, statPipR);
  const pipGapY = 6;
  const pipColH = rankPipR * 2 + statPipR * 4 + pipGapY * 2;
  const baseHeaderBottom = headerTop + pipColH + headerPad * 2;

  const pipCx = innerX + headerPad + maxPipR;
  const pipValueX = pipCx + maxPipR + 8;
  const leftLabelW = 86;

  const withInkShadow = (draw, blur = 8) => {
    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.92)';
    ctx.shadowBlur = blur;
    ctx.shadowOffsetY = 1;
    draw();
    ctx.restore();
  };

  const textRight = innerRight - headerPad;
  const textLeft = pipValueX + leftLabelW + 12;
  const textMaxW = textRight - textLeft;
  const leftColRight = textLeft - 12;
  const locationInfo = getNpcLikeLocation(entity);
  const hasLocation = Boolean(locationInfo.planeta || locationInfo.lugar);

  const formaBadgeGap = formaInfo?.img ? 10 : 0;
  const formaBadgeH = formaInfo?.img ? 82 : 0;
  const headerBottom = Math.max(
    baseHeaderBottom + (hasLocation ? 32 : 0),
    baseHeaderBottom + formaBadgeGap + formaBadgeH,
  );

  /* Placa translúcida detrás del bloque tipográfico para mejorar lectura del texto
     sin perder la imagen de fondo. */
  const textPlateY = headerTop + headerPad - 7;
  const textPlateH = pipColH + 14 + (hasLocation ? 32 : 0);
  const textPlateGrad = ctx.createLinearGradient(0, textPlateY, 0, textPlateY + textPlateH);
  textPlateGrad.addColorStop(0, 'rgba(5, 9, 18, 0.58)');
  textPlateGrad.addColorStop(1, 'rgba(5, 9, 18, 0.42)');
  ctx.beginPath();
  ctx.roundRect(textLeft - 8, textPlateY, textMaxW + 14, textPlateH, 12);
  ctx.fillStyle = textPlateGrad;
  ctx.fill();
  ctx.lineWidth = 1.2;
  ctx.strokeStyle = 'rgba(255,255,255,0.22)';
  ctx.stroke();

  const drawStatPip = (cy, iconName, color, value, label, pipR, { valueSize = 21, labelSize = 9, shape = 'icon' } = {}) => {
    ctx.beginPath();
    ctx.arc(pipCx, cy, pipR, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.72)';
    ctx.fill();
    ctx.lineWidth = 2.1;
    ctx.strokeStyle = color;
    ctx.stroke();

    const iconSize = Math.round(pipR * 1.05);
    if (shape === 'heart') {
      drawHeartPip(ctx, pipCx - iconSize / 2, cy - iconSize / 2, iconSize, color);
    } else if (shape === 'shield') {
      drawShieldPip(ctx, pipCx - iconSize / 2, cy - iconSize / 2, iconSize, color);
    } else {
      drawIcon(ctx, iconName, pipCx, cy, iconSize, color, 2);
    }

    ctx.textAlign = 'left';
    ctx.fillStyle = color;
    ctx.font = `800 ${valueSize}px Orbitron`;
    withInkShadow(() => ctx.fillText(String(value), pipValueX, cy + valueSize * 0.35), 7);

    ctx.fillStyle = '#e7edf8';
    ctx.font = `700 ${labelSize}px "JetBrains Mono"`;
    withInkShadow(() => ctx.fillText(label, pipValueX + 36, cy + 4), 5);
  };

  const rankCy = headerTop + headerPad + rankPipR;
  const vidaCy = rankCy + rankPipR + pipGapY + statPipR;
  const escudoCy = vidaCy + statPipR + pipGapY + statPipR;

  drawStatPip(rankCy, 'star', '#c08a06', nivel, 'NIVEL', rankPipR, { valueSize: 20, labelSize: 9 });
  drawStatPip(vidaCy, 'heart', COMBAT_STAT_META.vida.color, entity.vida ?? 0, 'VIDA', statPipR, { valueSize: 27, labelSize: 10, shape: 'heart' });
  drawStatPip(escudoCy, 'shield', COMBAT_STAT_META.escudo.color, entity.escudo ?? 0, 'ESCUDO', statPipR, { valueSize: 27, labelSize: 10, shape: 'shield' });

  const sub = [entity.profesion, entity.faccion].filter(Boolean).join(' · ');

  ctx.textAlign = 'right';
  const kickerText = (kicker ?? NPC_TIPO_LABEL[entity.tipo] ?? entity.tipo ?? 'NPC').toUpperCase();
  const kickerSize = fitText(ctx, kickerText, textMaxW, '14px "JetBrains Mono"', 10);
  ctx.fillStyle = '#d7e5ff';
  ctx.font = `700 ${kickerSize}px "JetBrains Mono"`;
  withInkShadow(() => ctx.fillText(kickerText, textRight, headerTop + headerPad + 11), 8);

  const nameText = (entity.nombre ?? '???').toUpperCase();
  const nameSize = fitText(ctx, nameText, textMaxW, '46px Orbitron', 24);
  ctx.fillStyle = '#ffffff';
  ctx.font = `800 ${nameSize}px Orbitron`;
  const nameY = headerTop + headerPad + 20 + nameSize * 0.74;
  withInkShadow(() => ctx.fillText(nameText, textRight, nameY), 12);

  if (hasLocation) {
    await paintHeaderLocationCards(ctx, [
      { label: 'PLANETA', value: locationInfo.planeta?.nombre, img: locationInfo.planeta?.imagen },
      { label: 'LUGAR', value: locationInfo.lugar?.nombre, img: locationInfo.lugar?.imagen },
    ], textRight, nameY + 10, textMaxW, frame.line);
  }

  if (sub) {
    const subSize = fitText(ctx, sub, textMaxW, '14px "JetBrains Mono"', 10);
    ctx.fillStyle = '#e8eef9';
    ctx.font = `italic ${subSize}px "JetBrains Mono"`;
    withInkShadow(() => ctx.fillText(sub, textRight, headerTop + headerPad + pipColH - 1 + (hasLocation ? 30 : 0)), 7);
  }

  if (formaInfo?.img) {
    /* La forma vive ahora en la columna izquierda, debajo de los stats, limpia y sin
       marco, alineada al mismo eje vertical de los pips de stats. */
    const badgeW = Math.max(78, leftColRight - innerX - 8);
    const badgeX = pipCx - badgeW / 2;
    const badgeY = baseHeaderBottom + formaBadgeGap;
    if (formaImg) {
      drawImageRounded(ctx, formaImg, badgeX, badgeY, badgeW, formaBadgeH, 10, null, 0, 'center', 'contain', 'rgba(0,0,0,0)');
    } else {
      ctx.save();
      ctx.globalAlpha = 0.85;
      drawIcon(ctx, formaInfo.icon ?? 'sword', pipCx, badgeY + formaBadgeH / 2, 40, frame.line, 2.2);
      ctx.restore();
    }
  }

  const artY = headerBottom + 10;
  const artH = Math.max(162, 260 - (headerBottom - baseHeaderBottom));
  const typeY = artY + artH + 36;
  const typeLabel = entity.tipo === 'jefe'
    ? `Jefe de Asalto · ${Math.max(2, entity.raid_slots || 4)} cupos`
    : (kicker ?? NPC_TIPO_LABEL[entity.tipo] ?? entity.tipo ?? '');
  paintTypeLine(ctx, typeLabel, typeY, innerX, innerRight, { halo: true });

  const statsY = typeY + 32;

  /* ── dos columnas: izquierda = saludo inicial + habilidades (apiladas), derecha = atributos de combate ── */
  const ATTR_ORDER = ['ataque', 'defensa', 'punteria', 'movimiento', 'iniciativa'];
  const rows = ATTR_ORDER.map((key) => ({
    icon: COMBAT_STAT_META[key].icon,
    label: COMBAT_STAT_META[key].label,
    color: COMBAT_STAT_META[key].color,
    value: entity[key] ?? 0,
  }));
  const danoEntries = [
    { icon: 'sword', label: 'Daño', color: PRINT_ACCENT.dano, value: entity.dano ?? 0 },
    { icon: 'shield', label: 'Daño Escudo', color: PRINT_ACCENT.danoEscudo, value: entity.dano_escudo ?? 0 },
    { icon: 'fire', label: 'Daño Perforante', color: PRINT_ACCENT.danoPerforante, value: entity.dano_perforante ?? 0 },
  ];

  const statsTop = statsY;
  const rowH = 40;
  const danoGap = 14;
  const danoBoxH = 90;
  const attrSectionH = rows.length * rowH + danoGap + danoBoxH;
  const colGap = 22;
  const saludoColW = innerW * 0.42;
  const attrColX = innerX + saludoColW + colGap;
  const attrColW = innerW - saludoColW - colGap;

  const habilidades = [entity.habilidad1, entity.habilidad2, entity.habilidad3, entity.habilidad4];
  const hasHabilidades = habilidades.some(Boolean);

  const saludoLineH = 20;
  const saludoMaxLines = 3;
  const saludoBlockH = 20 + saludoMaxLines * saludoLineH;
  const habCellSize = 76;
  const habLabelH = 16;
  const habRowGap = 24;
  const habColGap = 28;
  const habGridH = (habCellSize + habLabelH) * 2 + habRowGap; // grilla 2×2 de paintHabilidadesGrid (celda + etiqueta, ×2 filas + separación)
  const habilidadesBlockH = hasHabilidades ? 22 + 20 + habGridH : 0;
  const leftColH = saludoBlockH + habilidadesBlockH;
  const sectionH = Math.max(attrSectionH, leftColH);

  const attrBoxPad = 12;
  const attrBoxTop = statsTop - 16 - attrBoxPad;
  const attrBoxBottom = statsTop + sectionH + 10 + attrBoxPad;
  paintBoxBg(ctx, innerX, attrBoxTop, innerW, attrBoxBottom - attrBoxTop, 10);

  ctx.textAlign = 'left';
  ctx.fillStyle = frame.line;
  ctx.font = '700 11px "JetBrains Mono"';
  ctx.fillText('SALUDO INICIAL', innerX + attrBoxPad, statsTop);
  ctx.fillStyle = INK.body;
  ctx.font = '400 15px "JetBrains Mono"';
  const saludoText = entity.saludo ? `“${entity.saludo}”` : 'Sin saludo registrado.';
  wrapText(ctx, saludoText, innerX + attrBoxPad, statsTop + 20, saludoColW - attrBoxPad, saludoLineH, saludoMaxLines);

  if (hasHabilidades) {
    const habLabelY = statsTop + saludoBlockH + 22;
    ctx.textAlign = 'center';
    ctx.fillStyle = INK.muted;
    ctx.font = '600 12px "JetBrains Mono"';
    ctx.fillText('HABILIDADES', innerX + saludoColW / 2, habLabelY);
    await paintHabilidadesGrid(ctx, habilidades, innerX, saludoColW, habLabelY + 20, frame.line, habCellSize, habLabelH, habRowGap, habColGap);
  }

  const attrRowsEndY = paintRows(ctx, rows, statsTop, attrColX + attrBoxPad, attrColX + attrColW - attrBoxPad, rowH);
  paintStatBoxes(ctx, danoEntries, attrColX + attrBoxPad, attrRowsEndY + danoGap, attrColW - attrBoxPad * 2, danoBoxH);

  ctx.strokeStyle = INK.hair;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(innerX + saludoColW + colGap / 2, attrBoxTop + 6);
  ctx.lineTo(innerX + saludoColW + colGap / 2, attrBoxBottom - 6);
  ctx.stroke();

  await paintCardLogo(ctx, innerRight, cardH - pad);
  return canvas;
}

/**
 * Recalcula los atributos de un NPC/jefe/enemigo "como si se enfrentara" a `nivel` — misma
 * fórmula que usa el combate real: +1 a todos los atributos por nivel (RaidCombatController::
 * getNpcStats en el servidor para jefes en RAID; el mismo cálculo inline en NpcCombatScreen.jsx
 * para enemigos/NPCs fuera de RAID). Solo los Jefes reciben el bono plano de nivel en `dano`
 * (daño/curación base) — `dano_escudo`/`dano_perforante` nunca escalan por nivel en ningún caso.
 * `punteria` en 0 es un flag de "sin ataque a distancia" y se mantiene en 0 aunque suba el nivel.
 */
export function applyNivelACombate(entity, nivel, esJefe) {
  const n = Math.max(0, Number(nivel) || 0);
  const danoBase = entity.dano ?? 0;
  return {
    ...entity,
    nivel: n,
    vida: Math.max(entity.vida ?? 1, 1) + n,
    escudo: (entity.escudo ?? 0) + n,
    ataque: Math.max(entity.ataque ?? 1, 1) + n,
    defensa: Math.max(entity.defensa ?? 1, 1) + n,
    movimiento: Math.max(entity.movimiento ?? 1, 1) + n,
    iniciativa: Math.max(entity.iniciativa ?? 1, 1) + n,
    punteria: (entity.punteria ?? 0) > 0 ? entity.punteria + n : 0,
    dano: esJefe ? danoBase + (danoBase >= 0 ? n : -n) : danoBase,
  };
}

export async function drawNpcCard(npc) {
  const canvas = await drawNpcLikeCard(npc);
  const ctx = canvas.getContext('2d');
  paintColofon(ctx, npc.tipo === 'jefe' ? 'Jefes · Catálogo NÉXUS' : 'NPCs · Catálogo NÉXUS', canvas.height, { halo: true });
  return canvas;
}

export async function drawEnemigoCard(enemigo) {
  const canvas = await drawNpcLikeCard(enemigo, { forcedFrameKey: 'danger', kicker: 'Encuentro Salvaje' });
  const ctx = canvas.getContext('2d');
  paintColofon(ctx, 'Enemigos · Catálogo NÉXUS', canvas.height, { halo: true });
  return canvas;
}

/* ═══════════════ TOKENS DE ESTADO / STAT (marcadores físicos) ═══════════════
   Las entradas de Buffs y Estados no se imprimen como carta completa: son
   marcadores rectangulares pequeños (mini-carta) pensados para imprimir varias
   copias, cortar y colocar sobre la miniatura/hoja de personaje mientras dura
   el efecto en mesa. Usan la misma mecánica física de rotación que las cartas
   de habilidad (paintCooldownBorderMarkers): un reloj de arena arriba, dos a
   la derecha, tres abajo y cuatro a la izquierda — se gira la carta 90° cada
   ronda para llevar la cuenta de los turnos restantes. Documentan las reglas
   de app/Support/Combat/AplicaEstadosCombate.php. */

/** Igual mecánica que `paintCooldownBorderMarkers` pero parametrizada en
 * ancho/alto/pad/tamaño de ícono (esa función solo sirve para CARD_W×CARD_H)
 * y limitada a `maxTurns` bandas — un estado con duración fija de 2 rondas
 * solo imprime 1 arriba y 2 a la derecha, nunca las bandas de 3 o 4 que jamás
 * usaría. `maxTurns` null/0 no imprime ninguna banda (estados sin duración
 * en rondas, como Marcado/Protegido, que se consumen al recibir un ataque). */
function paintTurnBorderMarkers(ctx, w, h, pad, color, maxTurns) {
  if (!maxTurns) return;
  const bandC = pad / 2;
  const iconSize = pad * 0.55;
  const spacing = iconSize * 1.3;
  const draw = (cx, cy, angle, count) => {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(angle);
    const totalW = (count - 1) * spacing;
    for (let i = 0; i < count; i++) {
      drawHourglassIcon(ctx, -totalW / 2 + i * spacing, 0, iconSize, color);
    }
    ctx.restore();
  };
  const bands = [
    { cx: w / 2, cy: bandC, angle: 0, count: 1 },
    { cx: w - bandC, cy: h / 2, angle: Math.PI / 2, count: 2 },
    { cx: w / 2, cy: h - bandC, angle: Math.PI, count: 3 },
    { cx: bandC, cy: h / 2, angle: -Math.PI / 2, count: 4 },
  ];
  bands.filter(b => b.count <= Math.min(maxTurns, 4)).forEach(b => draw(b.cx, b.cy, b.angle, b.count));
}

/* ── "Arte" del token: composiciones vectoriales (ícono grande + un motivo de
   acento) dibujadas 100% en canvas — no hay assets externos, así que cada
   estado/stat tiene su propia mini-ilustración generada por código. */
function motifBurstLines(ctx, cx, cy, r, color, count = 8) {
  ctx.save();
  ctx.strokeStyle = `${color}8c`;
  ctx.lineWidth = 3;
  for (let i = 0; i < count; i++) {
    const a = (Math.PI * 2 * i) / count;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * r * 0.78, cy + Math.sin(a) * r * 0.78);
    ctx.lineTo(cx + Math.cos(a) * r * 1.08, cy + Math.sin(a) * r * 1.08);
    ctx.stroke();
  }
  ctx.restore();
}
function motifRings(ctx, cx, cy, r, color, count = 3) {
  ctx.save();
  ctx.strokeStyle = `${color}70`;
  ctx.lineWidth = 2;
  for (let i = 1; i <= count; i++) {
    ctx.beginPath();
    ctx.arc(cx, cy, (r * i) / count, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}
function motifOrbitDots(ctx, cx, cy, r, color, count = 6) {
  ctx.save();
  ctx.fillStyle = color;
  for (let i = 0; i < count; i++) {
    const a = (Math.PI * 2 * i) / count;
    ctx.globalAlpha = 0.35 + 0.4 * (i % 2);
    ctx.beginPath();
    ctx.arc(cx + Math.cos(a) * r * 0.98, cy + Math.sin(a) * r * 0.98, r * 0.06, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}
function motifDrips(ctx, cx, cy, r, color, count = 4) {
  ctx.save();
  ctx.fillStyle = `${color}99`;
  for (let i = 0; i < count; i++) {
    const dx = cx + (i - (count - 1) / 2) * r * 0.5;
    const dy = cy + r * 0.82;
    const s = r * 0.16;
    ctx.beginPath();
    ctx.moveTo(dx, dy - s);
    ctx.quadraticCurveTo(dx + s * 0.8, dy + s * 0.3, dx, dy + s);
    ctx.quadraticCurveTo(dx - s * 0.8, dy + s * 0.3, dx, dy - s);
    ctx.fill();
  }
  ctx.restore();
}
function motifArrowDown(ctx, cx, cy, r, color) {
  ctx.save();
  ctx.strokeStyle = `${color}88`;
  ctx.lineWidth = 4;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(cx, cy - r * 0.9);
  ctx.lineTo(cx, cy + r * 0.6);
  ctx.moveTo(cx - r * 0.35, cy + r * 0.25);
  ctx.lineTo(cx, cy + r * 0.6);
  ctx.lineTo(cx + r * 0.35, cy + r * 0.25);
  ctx.stroke();
  ctx.restore();
}
function motifCrossPulse(ctx, cx, cy, r, color, count = 3) {
  ctx.save();
  for (let i = 0; i < count; i++) {
    const dy = cy + r * 0.7 - i * r * 0.6;
    const s = r * 0.16;
    ctx.globalAlpha = 0.9 - i * 0.25;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.rect(cx - s / 4, dy - s, s / 2, s * 2);
    ctx.rect(cx - s, dy - s / 4, s * 2, s / 2);
    ctx.fill();
  }
  ctx.restore();
}
function motifStreaks(ctx, cx, cy, r, color, count = 4) {
  ctx.save();
  ctx.strokeStyle = `${color}8c`;
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  for (let i = 0; i < count; i++) {
    const off = (i - (count - 1) / 2) * r * 0.32;
    ctx.beginPath();
    ctx.moveTo(cx - r * 0.8 + off, cy + r * 0.5);
    ctx.lineTo(cx + r * 0.3 + off, cy - r * 0.5);
    ctx.stroke();
  }
  ctx.restore();
}

/* Motivo de acento por estado/stat (clave = id sin el prefijo `estado-`/`stat-`
   que le agrega Catalogo.jsx) — null significa "solo brillo + ícono, sin acento". */
const ART_MOTIF = {
  paralizado: motifRings,
  aturdido: motifBurstLines,
  confundido: motifOrbitDots,
  marcado: motifRings,
  protegido: null,
  sangrado: motifDrips,
  envenenado: motifDrips,
  debilitado: motifArrowDown,
  regeneracion: motifCrossPulse,
  ataque: motifBurstLines,
  defensa: motifRings,
  punteria: motifRings,
  movimiento: motifStreaks,
  iniciativa: motifBurstLines,
};

/** Caja de "arte" del token: fondo con resplandor radial, motivo de acento
 * (si tiene) detrás y el ícono principal encima, todo recortado a un
 * rectángulo redondeado con borde — el reemplazo, 100% vectorial, de una
 * imagen ilustrada por ítem. */
function paintArtBox(ctx, x, y, w, h, frame, icon, motifFn) {
  const radius = 12;
  paintDropShadow(ctx, x, y, w, h, radius, { blur: 7, offsetY: 2 });
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, radius);
  ctx.clip();
  const cx = x + w / 2;
  const cy = y + h / 2;
  const g = ctx.createRadialGradient(cx, cy, 6, cx, cy, Math.max(w, h) * 0.7);
  g.addColorStop(0, INK.paper);
  g.addColorStop(1, `${frame.line}26`);
  ctx.fillStyle = g;
  ctx.fillRect(x, y, w, h);
  const r = Math.min(w, h) / 2 - 8;
  if (motifFn) motifFn(ctx, cx, cy, r, frame.line);
  drawIcon(ctx, icon, cx, cy, r * 0.95, frame.line, 2.4);
  ctx.restore();
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, radius);
  ctx.lineWidth = 2;
  ctx.strokeStyle = `${frame.line}99`;
  ctx.stroke();
}

/** Token rectangular: caja de arte, etiqueta y una franja inferior — "+1"
 * grande para stats (`bottom.type === 'big'`) o un cuadro negro semi-
 * transparente con la descripción para estados (`bottom.type === 'desc'`,
 * reutiliza `paintBoxBg`). Los marcadores de turno de `paintTurnBorderMarkers`
 * van en los 4 bordes cuando `maxTurns` tiene valor. Todo dentro de
 * TOKEN_W×TOKEN_H. */
async function drawTokenCard({ id, label, icon, frame, maxTurns, bottom }) {
  await ensureFonts();
  const canvas = document.createElement('canvas');
  canvas.width = TOKEN_W;
  canvas.height = TOKEN_H;
  const ctx = canvas.getContext('2d');

  const pad = 20;
  const radius = 16;

  ctx.fillStyle = frame.bg2;
  ctx.beginPath();
  ctx.roundRect(0, 0, TOKEN_W, TOKEN_H, radius);
  ctx.fill();

  const bg = ctx.createLinearGradient(0, 0, 0, TOKEN_H);
  bg.addColorStop(0, frame.bg1);
  bg.addColorStop(1, frame.bg2);
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(pad, pad, TOKEN_W - pad * 2, TOKEN_H - pad * 2, radius - 6);
  ctx.clip();
  ctx.fillStyle = bg;
  ctx.fillRect(pad, pad, TOKEN_W - pad * 2, TOKEN_H - pad * 2);
  ctx.restore();

  paintVignetteBackground(ctx, pad, pad, TOKEN_W - pad * 2, TOKEN_H - pad * 2, radius - 6, frameEdge(frame));

  ctx.save();
  ctx.beginPath();
  ctx.roundRect(pad, pad, TOKEN_W - pad * 2, TOKEN_H - pad * 2, radius - 6);
  ctx.lineWidth = 3;
  ctx.strokeStyle = frame.line;
  ctx.stroke();
  ctx.restore();

  paintTurnBorderMarkers(ctx, TOKEN_W, TOKEN_H, pad, frame.line, maxTurns);

  const artX = pad + 14;
  const artY = pad + 16;
  const artW = TOKEN_W - artX * 2;
  const artH = TOKEN_H * 0.42;
  paintArtBox(ctx, artX, artY, artW, artH, frame, icon, ART_MOTIF[id]);

  const cx = TOKEN_W / 2;
  const labelY = artY + artH + 40;
  ctx.textAlign = 'center';
  ctx.fillStyle = INK.strong;
  const fontSize = fitText(ctx, label.toUpperCase(), TOKEN_W - pad * 4, '30px Orbitron', 14);
  ctx.font = `800 ${fontSize}px Orbitron`;
  ctx.fillText(label.toUpperCase(), cx, labelY);

  const bottomX = artX;
  const bottomW = artW;
  const bottomY = labelY + 24;
  const bottomBottom = TOKEN_H - pad - 12;

  if (bottom.type === 'big') {
    const baseSize = Math.round((bottomBottom - bottomY) * 0.8);
    const bigSize = fitText(ctx, bottom.text, bottomW - 10, `${baseSize}px Orbitron`, 40);
    ctx.textAlign = 'center';
    ctx.fillStyle = frame.line;
    ctx.font = `800 ${bigSize}px Orbitron`;
    ctx.fillText(bottom.text, cx, (bottomY + bottomBottom) / 2 + bigSize * 0.32);
  } else if (bottom.type === 'desc') {
    paintBoxBg(ctx, bottomX, bottomY, bottomW, bottomBottom - bottomY, 10);
    ctx.textAlign = 'center';
    ctx.fillStyle = INK.body;
    ctx.font = '400 15px "JetBrains Mono"';
    wrapText(ctx, bottom.text, cx, bottomY + 20, bottomW - 16, 19, 7);
  }

  return canvas;
}

export async function drawEstadoCard(estado) {
  const frame = FRAME[estado.frame] ?? FRAME.neutral;
  const motifKey = estado.id.replace(/^estado-/, '');
  return drawTokenCard({
    id: motifKey,
    label: estado.label,
    icon: estado.icon,
    frame,
    maxTurns: estado.turnsMax,
    bottom: { type: 'desc', text: estado.mecanica },
  });
}

export async function drawStatCombateCard(stat) {
  const frame = FRAME[stat.frame] ?? FRAME.neutral;
  const motifKey = stat.id.replace(/^stat-/, '');
  return drawTokenCard({
    id: motifKey,
    label: stat.label,
    icon: stat.icon,
    frame,
    maxTurns: 4,
    bottom: { type: 'big', text: '+1' },
  });
}

/* ═══════════════════════════ MODAL GENÉRICO ═══════════════════════════ */

const DRAW_BY_KIND = {
  habilidad: drawHabilidadCard,
  objeto: drawObjetoCard,
  npc: drawNpcCard,
  enemigo: drawEnemigoCard,
  estado: drawEstadoCard,
  stat_combate: drawStatCombateCard,
};

/**
 * Modal que genera la carta imprimible de un ítem de Catálogo (habilidad,
 * objeto, npc/jefe o enemigo) al montarse. Mismo flujo de descarga/impresión/
 * compartir que CharacterCardModal.
 */
export default function EntityCardModal({ kind, item, onClose }) {
  const [dataUrl, setDataUrl] = useState(null);
  const [dims, setDims] = useState(null); // { w, h } del canvas real — algunas cartas (npc/jefe) son más altas que el resto
  const [error, setError] = useState(false);
  const cancelledRef = useRef(false);
  const isToken = kind === 'estado' || kind === 'stat_combate';

  useEffect(() => {
    cancelledRef.current = false;
    const draw = DRAW_BY_KIND[kind];
    if (!draw) { setError(true); return; }
    draw(item)
      .then((canvas) => {
        if (cancelledRef.current) return;
        setDataUrl(canvas.toDataURL('image/png'));
        setDims({ w: canvas.width, h: canvas.height });
      })
      .catch(() => { if (!cancelledRef.current) setError(true); });
    return () => { cancelledRef.current = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind, item?.id]);

  const fileName = `nexus-${isToken ? 'token' : kind}-${(item?.nombre ?? 'carta').toLowerCase().replace(/\s+/g, '-')}.png`;

  const download = () => {
    if (!dataUrl) return;
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = fileName;
    a.click();
  };

  const printCard = () => {
    if (!dataUrl) return;
    const onBlocked = () => toast('El navegador bloqueó la ventana de impresión', { tone: 'error', icon: 'x' });
    if (isToken) {
      printTokenSheet(dataUrl, { mmW: TOKEN_W_MM, mmH: TOKEN_H_MM, copies: 8 }, onBlocked);
    } else {
      const mmW = 63;
      const mmH = dims ? Math.round((mmW * dims.h / dims.w) * 10) / 10 : 88;
      printCardImage(dataUrl, onBlocked, { mmW, mmH });
    }
  };

  const share = async () => {
    if (!dataUrl) return;
    try {
      const blob = await (await fetch(dataUrl)).blob();
      const file = new File([blob], fileName, { type: 'image/png' });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: item?.nombre ?? 'Carta NÉXUS' });
        return;
      }
    } catch { /* cancelado por el usuario o no soportado — cae a descarga */ }
    download();
  };

  const canShareFiles = typeof navigator !== 'undefined' && !!navigator.share;

  /* Ancho fijo (igual para todos los tipos) con alto derivado de la proporción real del
     canvas — algunas cartas (npc/jefe, con la grilla de habilidades) son más altas que
     el resto y no pueden asumir el 5:7 estándar. */
  const previewW = isToken ? 180 : 252;
  const previewH = dims ? Math.round(previewW * dims.h / dims.w) : (isToken ? 252 : 353);

  return createPortal(
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9500, display: 'flex',
      alignItems: 'center', justifyContent: 'center', padding: 20,
      background: 'rgba(2,6,16,0.88)', backdropFilter: 'blur(6px)',
    }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, maxHeight: '94vh' }}>
        {error ? (
          <div style={{ color: '#ff6b6b', fontFamily: 'var(--font-data)', fontSize: 12 }}>
            No se pudo generar {isToken ? 'el token' : 'la carta'}.
          </div>
        ) : !dataUrl ? (
          <div style={{
            width: previewW, height: previewH, display: 'grid', placeItems: 'center',
            color: 'var(--holo)', fontFamily: 'var(--font-data)', fontSize: 11, letterSpacing: '0.14em',
          }}>
            {isToken ? 'GENERANDO TOKEN…' : 'GENERANDO CARTA…'}
          </div>
        ) : (
          <img src={dataUrl} alt={item?.nombre ?? 'Carta'} style={{
            width: previewW, height: previewH,
            borderRadius: 14,
            boxShadow: '0 0 40px rgba(56,205,240,0.25)', display: 'block',
          }} />
        )}
        {isToken && dataUrl && (
          <div className="nx-data" style={{ fontSize: 10, color: 'var(--txt-faint)', letterSpacing: '0.06em', textAlign: 'center' }}>
            Marcador de mesa · {TOKEN_W_MM}×{TOKEN_H_MM}mm · "Imprimir" genera una hoja con 8 copias para cortar
          </div>
        )}
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
          <button className="nx-btn nx-btn-ghost" onClick={onClose}>Cerrar</button>
          {dataUrl && (
            <>
              <button className="nx-btn nx-btn-accent" onClick={download}>⬇ Descargar</button>
              <button className="nx-btn nx-btn-accent" onClick={printCard}>🖨 {isToken ? 'Imprimir hoja' : 'Imprimir'}</button>
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
