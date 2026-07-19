import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ICON_PATHS, toast } from './ui.jsx';
import { NX } from '../data/seed.js';
import {
  CARD_W, CARD_H, TOKEN_W, TOKEN_H, TOKEN_W_MM, TOKEN_H_MM, mediaUrl, loadImage, ensureFonts,
  drawIcon as drawIconRaw, drawImageRounded, fitText, wrapText, printCardImage, printTokenSheet, paintCardLogo, paintGridBackground, paintVidaEscudoBox, paintBoxBg,
  COMBAT_STAT_META,
} from '../utils/printableCard.js';

const drawIcon = (ctx, name, cx, cy, size, color, strokeWidth) =>
  drawIconRaw(ctx, ICON_PATHS, name, cx, cy, size, color, strokeWidth);

/* Paletas de marco reutilizadas por las 4 variantes de carta — mismo criterio
   que SIDE_FRAME en CharacterCard.jsx (canvas 2D no puede resolver var(--css)
   ni color-mix(), así que todo va en hex). */
const FRAME = {
  neutral: { bg1: '#111b2e', bg2: '#050a15', line: '#8aa0c0' },
  info:    { bg1: '#0a1a3a', bg2: '#040c1e', line: '#38cdf0' },
  ok:      { bg1: '#0a2a1c', bg2: '#03130b', line: '#10b981' },
  danger:  { bg1: '#2a0a0f', bg2: '#0f0304', line: '#ff2d45' },
  gold:    { bg1: '#2a2008', bg2: '#120e02', line: '#E6B325' },
  purple:  { bg1: '#1c0a2a', bg2: '#0a0312', line: '#b15cff' },
  orange:  { bg1: '#2a1608', bg2: '#120a03', line: '#FF6B00' },
  toxic:   { bg1: '#1c2a08', bg2: '#0a1203', line: '#84cc16' },
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

function paintStatPills(ctx, entries, x, y, maxWidth, emptyText, emptyColor) {
  if (!entries.length) {
    ctx.textAlign = 'left';
    ctx.fillStyle = emptyColor;
    ctx.font = '400 13px "JetBrains Mono"';
    ctx.fillText(emptyText, x, y + 2);
    return y + 18;
  }

  const gap = 6;
  const height = 22;
  let cx = x;
  let cy = y;

  for (const entry of entries) {
    const label = `${entry.label}${entry.count > 1 ? ` +${entry.count}` : ''}`;
    ctx.font = '700 11px "JetBrains Mono"';
    const textW = Math.ceil(ctx.measureText(label).width);
    const pillW = textW + 16;
    if (cx > x && cx + pillW > x + maxWidth) {
      cx = x;
      cy += height + 6;
    }

    ctx.beginPath();
    ctx.roundRect(cx, cy, pillW, height, 8);
    ctx.fillStyle = `${entry.color}18`;
    ctx.fill();
    ctx.lineWidth = 1;
    ctx.strokeStyle = `${entry.color}50`;
    ctx.stroke();

    ctx.fillStyle = entry.color;
    ctx.textAlign = 'center';
    ctx.fillText(label, cx + pillW / 2, cy + 14);
    cx += pillW + gap;
  }

  return cy + height;
}

/** Pinta el marco (fondo + borde) de la carta y devuelve las coordenadas internas útiles. */
function paintFrame(ctx, frame) {
  const pad = 22;
  ctx.fillStyle = frame.bg2;
  ctx.beginPath();
  ctx.roundRect(0, 0, CARD_W, CARD_H, 34);
  ctx.fill();

  const bg = ctx.createLinearGradient(0, 0, 0, CARD_H);
  bg.addColorStop(0, frame.bg1);
  bg.addColorStop(1, frame.bg2);
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
  ctx.strokeStyle = `${frame.line}aa`;
  ctx.stroke();
  ctx.restore();

  return { pad, innerX: pad + 22, innerRight: CARD_W - pad - 22 };
}

/** Encabezado común: nombre (arriba-izq.) + medallón circular (arriba-der.). */
function paintHeader(ctx, { title, pad, innerX, innerRight, badgeText, badgeColor }) {
  ctx.textAlign = 'left';
  const displayName = (title ?? '???').toUpperCase();
  fitText(ctx, displayName, innerRight - innerX - 66, '30px Orbitron');
  ctx.fillStyle = '#eaf2ff';
  ctx.fillText(displayName, innerX, pad + 54);

  if (badgeText !== null && badgeText !== undefined) {
    ctx.beginPath();
    ctx.arc(innerRight - 24, pad + 40, 23, 0, Math.PI * 2);
    ctx.fillStyle = badgeColor;
    ctx.fill();
    ctx.textAlign = 'center';
    ctx.fillStyle = '#04070f';
    ctx.font = '800 18px Orbitron';
    ctx.fillText(String(badgeText).slice(0, 3).toUpperCase(), innerRight - 24, pad + 47);
  }
}

/** Caja de arte: imagen (si hay) o gradiente + ícono de respaldo. */
async function paintArt(ctx, imgSrc, iconName, iconColor, innerX, artY, innerW, artH, borderColor) {
  const img = await loadImage(mediaUrl(imgSrc));
  if (img) {
    drawImageRounded(ctx, img, innerX, artY, innerW, artH, 16, `${borderColor}66`);
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
  g.addColorStop(0, `${iconColor}22`);
  g.addColorStop(1, '#04070f');
  ctx.fillStyle = g;
  ctx.fillRect(innerX, artY, innerW, artH);
  ctx.globalAlpha = 0.4;
  drawIcon(ctx, iconName, innerX + innerW / 2, artY + artH / 2, 150, iconColor, 1.6);
  ctx.globalAlpha = 1;
  ctx.restore();
  ctx.beginPath();
  ctx.roundRect(innerX, artY, innerW, artH, 16);
  ctx.lineWidth = 3;
  ctx.strokeStyle = `${borderColor}66`;
  ctx.stroke();
}

/** Línea de tipo centrada, con separadores horizontales (como la "type line" de una carta Magic). */
function paintTypeLine(ctx, label, typeY, innerX, innerRight) {
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(150,200,255,0.55)';
  ctx.font = '600 15px "JetBrains Mono"';
  ctx.fillText(label.toUpperCase(), CARD_W / 2, typeY);
  ctx.strokeStyle = 'rgba(255,255,255,0.12)';
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
    ctx.fillStyle = 'rgba(220,230,255,0.8)';
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

    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(innerX, rowY + 16);
    ctx.lineTo(innerRight, rowY + 16);
    ctx.stroke();
  });
  return startY + rows.length * rowH;
}

function paintColofon(ctx, text) {
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(120,150,190,0.55)';
  ctx.font = '400 12px "JetBrains Mono"';
  ctx.fillText(text, CARD_W / 2, CARD_H - 22 - 8);
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
  const badgeColor = classInfo?.accent ?? '#8aa0c0';

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
  ctx.fillStyle = 'rgba(220,230,255,0.7)';
  ctx.font = '600 14px "JetBrains Mono"';
  ctx.fillText(habilidad.objetivo === 'self' ? 'Sobre uno mismo' : 'Sobre el enemigo', innerRight - 6, pad + 96);

  const artY = pad + 118;
  const artH = 340;
  await paintArt(ctx, habilidad.icono_url ?? habilidad.icono, TIPO_HAB_ICON[habilidad.tipo] ?? 'zap', badgeColor, innerX, artY, innerW, artH, frame.line);

  const typeY = artY + artH + 36;
  paintTypeLine(ctx, classInfo ? `${classInfo.num} · ${classInfo.name}` : 'Habilidad Universal', typeY, innerX, innerRight);

  const rows = [];
  rows.push({ icon: 'zap', label: 'Costo Fuerza', color: '#E6B325', value: habilidad.costo_fuerza ?? 0 });
  if (habilidad.damage) rows.push({ icon: 'sword', label: 'Daño', color: '#ff7043', value: habilidad.damage });
  if (habilidad.damage_escudo) rows.push({ icon: 'shield', label: 'Daño a Escudo', color: '#26e3e3', value: habilidad.damage_escudo });
  if (habilidad.damage_perforante) rows.push({ icon: 'fire', label: 'Daño Perforante', color: '#8aa0c0', value: habilidad.damage_perforante });
  rows.push({
    icon: 'clock',
    label: 'Cooldown',
    color: '#38cdf0',
    value: habilidad.cooldown ?? 0,
    suffixIcon: 'arrow',
    suffixRotation: COOLDOWN_ARROW[habilidad.cooldown]?.rotation ?? 0,
  });

  const statsTop = typeY + 44;
  const rowsEndY = paintRows(ctx, rows, statsTop, innerX, innerRight, 42);

  const infoTop = rowsEndY + 18;
  const infoBottom = CARD_H - pad - 58;
  paintBoxBg(ctx, innerX, infoTop, innerW, infoBottom - infoTop, 12);

  let cursorY = infoTop + 18;
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(150,200,255,0.55)';
  ctx.font = '600 11px "JetBrains Mono"';
  ctx.fillText('EFECTO', CARD_W / 2, cursorY);
  cursorY += 20;

  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(220,230,255,0.82)';
  ctx.font = '400 17px "JetBrains Mono"';
  const rulesBottom = wrapText(ctx, habilidad.efecto || 'Sin descripción de efecto.', CARD_W / 2, cursorY, innerW - 16, 23, 4);

  const buffCounts = stackCounts(habilidad.buff);
  const debuffCounts = stackCounts(habilidad.debuff);
  const toEntries = (counts) => Object.entries(counts).map(([stat, count]) => ({
    stat,
    count,
    label: COMBAT_STAT_META[stat]?.label ?? stat.toUpperCase(),
    color: COMBAT_STAT_META[stat]?.color ?? '#cfe3ff',
  }));

  const buffStart = rulesBottom + 10;
  ctx.textAlign = 'left';
  ctx.fillStyle = 'rgba(16,185,129,0.95)';
  ctx.font = '700 11px "JetBrains Mono"';
  ctx.fillText('BUFF', innerX + 12, buffStart);
  const buffBottom = paintStatPills(ctx, toEntries(buffCounts), innerX + 12, buffStart + 10, innerW - 24, 'Sin Buff', 'rgba(220,230,255,0.55)');

  const debuffTitleY = buffBottom + 16;
  ctx.textAlign = 'left';
  ctx.fillStyle = 'rgba(255,93,117,0.95)';
  ctx.fillText('DEBUFF', innerX + 12, debuffTitleY);
  paintStatPills(ctx, toEntries(debuffCounts), innerX + 12, debuffTitleY + 10, innerW - 24, 'Sin Debuff', 'rgba(220,230,255,0.55)');

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
};
const TIPO_OBJ_ICON = {
  arma: 'sword', nucleo_energia: 'zap', cristal: 'star', lente_enfoque: 'eye', emisor: 'zap',
  estabilizador: 'shield', empunadura: 'anvil', modulo_activacion: 'settings', accesorio: 'box', mejora_nave: 'ship',
};
const BONUS_META = {
  bono_ataque:            { label: 'ATQ',  color: '#ff7043', icon: 'sword' },
  bono_defensa:           { label: 'DEF',  color: '#38cdf0', icon: 'shield' },
  bono_punteria:          { label: 'PNT',  color: '#10b981', icon: 'eye' },
  bono_movimiento:        { label: 'AGI',  color: '#a78bfa', icon: 'zap' },
  bono_iniciativa:        { label: 'INI',  color: '#E6B325', icon: 'star' },
  bono_vida:              { label: 'VID',  color: '#ff2d45', icon: 'zap' },
  bono_escudo:            { label: 'ESC',  color: '#26e3e3', icon: 'shield' },
  bono_dano:              { label: 'DMG',  color: '#ff5f2e', icon: 'flame' },
  bono_dano_perforante:   { label: 'DMGP', color: '#8aa0c0', icon: 'fire' },
  bono_critico:           { label: 'CRT',  color: '#f43f5e', icon: 'target' },
  bono_fuerza:            { label: 'FZ',   color: '#22c55e', icon: 'dumbbell' },
  bono_generacion_fuerza: { label: 'GEN',  color: '#84cc16', icon: 'trending' },
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
  ctx.fillStyle = 'rgba(220,230,255,0.7)';
  ctx.font = '600 14px "JetBrains Mono"';
  ctx.fillText(`₡ ${objeto.costo ?? 0}`, innerRight - 6, pad + 96);

  const artY = pad + 118;
  const artH = 340;
  await paintArt(ctx, objeto.imagen, TIPO_OBJ_ICON[objeto.tipo] ?? 'box', frame.line, innerX, artY, innerW, artH, frame.line);

  const typeY = artY + artH + 36;
  paintTypeLine(ctx, RAREZA_LABEL[objeto.rareza] ?? objeto.rareza ?? 'Objeto', typeY, innerX, innerRight);

  const rows = [];
  if (objeto.dano) rows.push({ icon: 'sword', label: objeto.tipo_ataque ? `Daño (${objeto.tipo_ataque})` : 'Daño', color: '#ff7043', value: objeto.dano });
  if (objeto.dano_perforante) rows.push({ icon: 'fire', label: 'Daño Perforante', color: '#8aa0c0', value: objeto.dano_perforante });
  if (objeto.energia_maxima) rows.push({ icon: 'zap', label: 'Energía Máxima', color: '#38cdf0', value: objeto.energia_maxima });
  for (const key of Object.keys(BONUS_META)) {
    const v = objeto[key];
    if (v) rows.push({ icon: BONUS_META[key].icon, label: `Bono ${BONUS_META[key].label}`, color: BONUS_META[key].color, value: v > 0 ? `+${v}` : v });
  }
  const visibleRows = rows.slice(0, 8);

  const statsTop = typeY + 44;
  const rowsEndY = paintRows(ctx, visibleRows, statsTop, innerX, innerRight, 42);

  const rulesY = rowsEndY + 26;
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(220,230,255,0.82)';
  ctx.font = '400 17px "JetBrains Mono"';
  const text = [objeto.descripcion, objeto.efecto].filter(Boolean).join(' — ') || 'Sin descripción.';
  wrapText(ctx, text, CARD_W / 2, rulesY, innerW - 8, 23, 4);

  if (objeto.color_hoja) {
    ctx.beginPath();
    ctx.arc(innerX + 16, CARD_H - pad - 46, 8, 0, Math.PI * 2);
    ctx.fillStyle = NX.SABERS[objeto.color_hoja] ?? '#38cdf0';
    ctx.fill();
  }

  paintColofon(ctx, objeto.activo === false ? 'Descontinuado · Catálogo NÉXUS' : 'Objetos · Catálogo NÉXUS');
  await paintCardLogo(ctx, innerRight, CARD_H - pad);
  return canvas;
}

/* ═══════════════════════════ NPC / JEFE / ENEMIGO ═══════════════════════════ */

const NPC_TIPO_FRAME = { aliado: 'info', neutral: 'neutral', hostil: 'danger', entrenador: 'ok', mercader: 'gold', mision: 'purple', jefe: 'orange' };
export const NPC_TIPO_LABEL = { aliado: 'Aliado', neutral: 'Neutral', hostil: 'Hostil', entrenador: 'Entrenador', mercader: 'Mercader', mision: 'Misión', jefe: 'Jefe de Asalto' };
const NPC_TIPO_ICON  = { aliado: 'user', neutral: 'user', hostil: 'flame', entrenador: 'shield', mercader: 'coin', mision: 'star', jefe: 'crown' };

async function drawNpcLikeCard(entity, { forcedFrameKey, kicker } = {}) {
  await ensureFonts();
  const frame = forcedFrameKey ? FRAME[forcedFrameKey] : (FRAME[NPC_TIPO_FRAME[entity.tipo]] ?? FRAME.danger);
  const nivel = entity.nivel ?? 1;

  const canvas = document.createElement('canvas');
  canvas.width = CARD_W;
  canvas.height = CARD_H;
  const ctx = canvas.getContext('2d');

  const { pad, innerX, innerRight } = paintFrame(ctx, frame);
  const innerW = innerRight - innerX;
  paintHeader(ctx, { title: entity.nombre, pad, innerX, innerRight, badgeText: `★${nivel}`, badgeColor: frame.line });

  ctx.textAlign = 'left';
  const icon = NPC_TIPO_ICON[entity.tipo] ?? 'user';
  drawIcon(ctx, icon, innerX + 11, pad + 90, 22, frame.line, 2.1);
  ctx.fillStyle = frame.line;
  ctx.font = '700 16px "JetBrains Mono"';
  ctx.fillText(kicker ?? NPC_TIPO_LABEL[entity.tipo] ?? entity.tipo ?? 'NPC', innerX + 30, pad + 96);
  const sub = [entity.profesion, entity.faccion].filter(Boolean).join(' · ');
  if (sub) {
    ctx.textAlign = 'right';
    ctx.fillStyle = 'rgba(220,230,255,0.7)';
    const size = fitText(ctx, sub, innerW - 160, '14px "JetBrains Mono"', 11);
    ctx.font = `${size}px "JetBrains Mono"`;
    ctx.fillText(sub, innerRight - 6, pad + 96);
  }

  const artY = pad + 118;
  const artH = 396;
  await paintArt(ctx, entity.imagen ?? entity.imagen_mini, icon, frame.line, innerX, artY, innerW, artH, frame.line);

  const typeY = artY + artH + 36;
  const typeLabel = entity.tipo === 'jefe'
    ? `Jefe de Asalto · ${Math.max(2, entity.raid_slots || 4)} cupos`
    : (kicker ?? NPC_TIPO_LABEL[entity.tipo] ?? entity.tipo ?? '');
  paintTypeLine(ctx, typeLabel, typeY, innerX, innerRight);

  let statsY = typeY + 30;
  statsY = paintVidaEscudoBox(ctx, {
    x: innerX, y: statsY, w: innerW,
    vidaVal: entity.vida ?? 0, escudoVal: entity.escudo ?? 0,
    vidaMeta: COMBAT_STAT_META.vida, escudoMeta: COMBAT_STAT_META.escudo,
    drawIcon: (name, cx, cy, size, color, strokeWidth) => drawIcon(ctx, name, cx, cy, size, color, strokeWidth),
  });
  statsY += 18;

  /* ── dos columnas: saludo inicial (izquierda) + atributos de combate (derecha) ── */
  const ATTR_ORDER = ['ataque', 'defensa', 'punteria', 'movimiento', 'iniciativa'];
  const rows = ATTR_ORDER.map((key) => ({
    icon: COMBAT_STAT_META[key].icon,
    label: COMBAT_STAT_META[key].label,
    color: COMBAT_STAT_META[key].color,
    value: entity[key] ?? 0,
  }));
  const statsTop = statsY;
  const rowH = 47;
  const sectionH = rows.length * rowH;
  const colGap = 22;
  const saludoColW = innerW * 0.42;
  const attrColX = innerX + saludoColW + colGap;
  const attrColW = innerW - saludoColW - colGap;

  const attrBoxPad = 6;
  const attrBoxTop = statsTop - 16 - attrBoxPad;
  const attrBoxBottom = statsTop + sectionH + 10 + attrBoxPad;
  paintBoxBg(ctx, innerX, attrBoxTop, innerW, attrBoxBottom - attrBoxTop, 10);

  ctx.textAlign = 'left';
  ctx.fillStyle = frame.line;
  ctx.font = '700 11px "JetBrains Mono"';
  ctx.fillText('SALUDO INICIAL', innerX + attrBoxPad, statsTop);
  ctx.fillStyle = 'rgba(220,230,255,0.78)';
  ctx.font = '400 15px "JetBrains Mono"';
  const saludoLineH = 20;
  const saludoMaxLines = Math.max(1, Math.floor((sectionH - 20) / saludoLineH));
  const saludoText = entity.saludo ? `“${entity.saludo}”` : 'Sin saludo registrado.';
  wrapText(ctx, saludoText, innerX + attrBoxPad, statsTop + 20, saludoColW - attrBoxPad, saludoLineH, saludoMaxLines);

  paintRows(ctx, rows, statsTop, attrColX, attrColX + attrColW, rowH);

  ctx.strokeStyle = 'rgba(255,255,255,0.14)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(innerX + saludoColW + colGap / 2, attrBoxTop + 6);
  ctx.lineTo(innerX + saludoColW + colGap / 2, attrBoxBottom - 6);
  ctx.stroke();

  const footY = statsTop + sectionH + 22;
  const habilidades = [entity.habilidad1, entity.habilidad2, entity.habilidad3, entity.habilidad4]
    .filter(Boolean).map(h => h.nombre).filter(Boolean);
  ctx.textAlign = 'center';
  if (habilidades.length) {
    ctx.fillStyle = 'rgba(150,200,255,0.55)';
    ctx.font = '600 12px "JetBrains Mono"';
    ctx.fillText('HABILIDADES', CARD_W / 2, footY);
    ctx.fillStyle = '#eaf2ff';
    ctx.font = '600 15px "JetBrains Mono"';
    const size = fitText(ctx, habilidades.join(' · '), innerW - 8, '15px "JetBrains Mono"', 11);
    ctx.font = `${size}px "JetBrains Mono"`;
    ctx.fillText(habilidades.join(' · '), CARD_W / 2, footY + 22);
  }

  await paintCardLogo(ctx, innerRight, CARD_H - pad);
  return canvas;
}

export async function drawNpcCard(npc) {
  const canvas = await drawNpcLikeCard(npc);
  const ctx = canvas.getContext('2d');
  paintColofon(ctx, npc.tipo === 'jefe' ? 'Jefes · Catálogo NÉXUS' : 'NPCs · Catálogo NÉXUS');
  return canvas;
}

export async function drawEnemigoCard(enemigo) {
  const canvas = await drawNpcLikeCard(enemigo, { forcedFrameKey: 'danger', kicker: 'Encuentro Salvaje' });
  const ctx = canvas.getContext('2d');
  paintColofon(ctx, 'Enemigos · Catálogo NÉXUS');
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
  ctx.strokeStyle = `${color}77`;
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
  ctx.strokeStyle = `${color}55`;
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
  ctx.strokeStyle = `${color}77`;
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
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, radius);
  ctx.clip();
  const cx = x + w / 2;
  const cy = y + h / 2;
  const g = ctx.createRadialGradient(cx, cy, 6, cx, cy, Math.max(w, h) * 0.7);
  g.addColorStop(0, `${frame.line}26`);
  g.addColorStop(1, frame.bg2);
  ctx.fillStyle = g;
  ctx.fillRect(x, y, w, h);
  const r = Math.min(w, h) / 2 - 8;
  if (motifFn) motifFn(ctx, cx, cy, r, frame.line);
  drawIcon(ctx, icon, cx, cy, r * 0.95, frame.line, 2.4);
  ctx.restore();
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, radius);
  ctx.lineWidth = 2;
  ctx.strokeStyle = `${frame.line}66`;
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

  ctx.save();
  ctx.beginPath();
  ctx.roundRect(pad, pad, TOKEN_W - pad * 2, TOKEN_H - pad * 2, radius - 6);
  ctx.lineWidth = 3;
  ctx.strokeStyle = `${frame.line}aa`;
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
  ctx.fillStyle = '#eaf2ff';
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
    ctx.fillStyle = 'rgba(220,230,255,0.86)';
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
  const [error, setError] = useState(false);
  const cancelledRef = useRef(false);
  const isToken = kind === 'estado' || kind === 'stat_combate';

  useEffect(() => {
    cancelledRef.current = false;
    const draw = DRAW_BY_KIND[kind];
    if (!draw) { setError(true); return; }
    draw(item)
      .then((canvas) => { if (!cancelledRef.current) setDataUrl(canvas.toDataURL('image/png')); })
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
      printCardImage(dataUrl, onBlocked);
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
            width: isToken ? 180 : 252, height: isToken ? 252 : 353, display: 'grid', placeItems: 'center',
            color: 'var(--holo)', fontFamily: 'var(--font-data)', fontSize: 11, letterSpacing: '0.14em',
          }}>
            {isToken ? 'GENERANDO TOKEN…' : 'GENERANDO CARTA…'}
          </div>
        ) : (
          <img src={dataUrl} alt={item?.nombre ?? 'Carta'} style={{
            width: isToken ? 180 : 252, height: isToken ? 252 : 353,
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
