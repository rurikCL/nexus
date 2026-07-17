import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ICON_PATHS, toast } from './ui.jsx';
import { NX } from '../data/seed.js';
import {
  CARD_W, CARD_H, mediaUrl, loadImage, ensureFonts,
  drawIcon as drawIconRaw, drawImageRounded, fitText, wrapText, printCardImage, paintCardLogo,
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
};

const asObj = (v) => (v && typeof v === 'object' && !Array.isArray(v)) ? v : {};

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
    ctx.fillText(String(r.value), innerRight - 6, rowY + 3);

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

/* ═══════════════════════════ HABILIDAD ═══════════════════════════ */

const TIPO_HAB_FRAME = { melee: 'orange', distancia: 'info', nave: 'purple' };
export const TIPO_HAB_LABEL = { melee: 'Cuerpo a cuerpo', distancia: 'A distancia', nave: 'Nave' };
const TIPO_HAB_ICON  = { melee: 'sword', distancia: 'target', nave: 'ship' };

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
  await paintCardLogo(ctx, innerX + innerW, artY + artH);

  const typeY = artY + artH + 36;
  paintTypeLine(ctx, classInfo ? `${classInfo.num} · ${classInfo.name}` : 'Habilidad Universal', typeY, innerX, innerRight);

  const rows = [];
  rows.push({ icon: 'zap', label: 'Costo Fuerza', color: '#E6B325', value: habilidad.costo_fuerza ?? 0 });
  if (habilidad.damage) rows.push({ icon: 'sword', label: 'Daño', color: '#ff7043', value: habilidad.damage });
  if (habilidad.damage_escudo) rows.push({ icon: 'shield', label: 'Daño a Escudo', color: '#26e3e3', value: habilidad.damage_escudo });
  if (habilidad.damage_perforante) rows.push({ icon: 'fire', label: 'Daño Perforante', color: '#8aa0c0', value: habilidad.damage_perforante });
  rows.push({ icon: 'clock', label: 'Cooldown', color: '#38cdf0', value: `${habilidad.cooldown ?? 0}t` });

  const statsTop = typeY + 44;
  const rowsEndY = paintRows(ctx, rows, statsTop, innerX, innerRight, 42);

  const rulesY = rowsEndY + 26;
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(220,230,255,0.82)';
  ctx.font = '400 17px "JetBrains Mono"';
  const rulesBottom = wrapText(ctx, habilidad.efecto || 'Sin descripción de efecto.', CARD_W / 2, rulesY, innerW - 8, 23, 4);

  const buffs = asObj(habilidad.buff);
  const debuffs = asObj(habilidad.debuff);
  const buffEntries = [
    ...Object.entries(buffs).map(([k, v]) => ({ k, v, sign: '+', color: '#10b981' })),
    ...Object.entries(debuffs).map(([k, v]) => ({ k, v, sign: '−', color: '#ff2d45' })),
  ];
  if (buffEntries.length) {
    ctx.textAlign = 'center';
    ctx.font = '700 14px "JetBrains Mono"';
    const text = buffEntries
      .map(({ k, v, sign, }) => `${sign}${v} ${COMBAT_STAT_META[k]?.label ?? k.toUpperCase()}`)
      .join('   ');
    ctx.fillStyle = '#eaf2ff';
    ctx.fillText(text, CARD_W / 2, Math.max(rulesBottom + 8, CARD_H - 70), );
  }

  paintColofon(ctx, `Habilidades · Catálogo NÉXUS`);
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
  await paintCardLogo(ctx, innerX + innerW, artY + artH);

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
    ctx.arc(innerRight - 16, CARD_H - pad - 46, 8, 0, Math.PI * 2);
    ctx.fillStyle = NX.SABERS[objeto.color_hoja] ?? '#38cdf0';
    ctx.fill();
  }

  paintColofon(ctx, objeto.activo === false ? 'Descontinuado · Catálogo NÉXUS' : 'Objetos · Catálogo NÉXUS');
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
  await paintCardLogo(ctx, innerX + innerW, artY + artH);

  const typeY = artY + artH + 36;
  const typeLabel = entity.tipo === 'jefe'
    ? `Jefe de Asalto · ${Math.max(2, entity.raid_slots || 4)} cupos`
    : (kicker ?? NPC_TIPO_LABEL[entity.tipo] ?? entity.tipo ?? '');
  paintTypeLine(ctx, typeLabel, typeY, innerX, innerRight);

  const rows = Object.keys(COMBAT_STAT_META).map((key) => ({
    icon: COMBAT_STAT_META[key].icon,
    label: COMBAT_STAT_META[key].label,
    color: COMBAT_STAT_META[key].color,
    value: entity[key] ?? 0,
  }));
  const statsTop = typeY + 46;
  const rowH = 47;
  paintRows(ctx, rows, statsTop, innerX, innerRight, rowH);

  const footY = statsTop + rows.length * rowH + 22;
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
  } else if (entity.saludo) {
    ctx.fillStyle = 'rgba(220,230,255,0.7)';
    ctx.font = '400 15px "JetBrains Mono"';
    const size = fitText(ctx, `“${entity.saludo}”`, innerW - 8, '15px "JetBrains Mono"', 11);
    ctx.font = `${size}px "JetBrains Mono"`;
    ctx.fillText(`“${entity.saludo}”`, CARD_W / 2, footY + 10);
  }

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

/* ═══════════════════════════ MODAL GENÉRICO ═══════════════════════════ */

const DRAW_BY_KIND = {
  habilidad: drawHabilidadCard,
  objeto: drawObjetoCard,
  npc: drawNpcCard,
  enemigo: drawEnemigoCard,
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

  const fileName = `nexus-${kind}-${(item?.nombre ?? 'carta').toLowerCase().replace(/\s+/g, '-')}.png`;

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
          <img src={dataUrl} alt={item?.nombre ?? 'Carta'} style={{
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
