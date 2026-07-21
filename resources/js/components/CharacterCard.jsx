import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import QRCode from 'qrcode';
import { ICON_PATHS, toast } from './ui.jsx';
import { NX } from '../data/seed.js';
import {
  CARD_W, CARD_H, mediaUrl, loadImage, ensureFonts,
  drawIcon as drawIconRaw, drawImageRounded, fitText, printCardImage, paintLogoAt, paintGridBackground, paintVidaEscudoBox, paintBoxBg,
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

/** Ícono místico de La Fuerza: anillo con un destello de cuatro puntas en el centro —
    evoca un aura/energía en vez de fuerza física (por eso no se usa 'dumbbell'). */
function drawForceIcon(ctx, cx, cy, size, color) {
  const r = size / 2;
  ctx.save();
  ctx.shadowColor = color;
  ctx.shadowBlur = 5;
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.stroke();

  const sr = r * 0.62;
  ctx.beginPath();
  ctx.moveTo(cx, cy - sr);
  ctx.quadraticCurveTo(cx, cy, cx + sr, cy);
  ctx.quadraticCurveTo(cx, cy, cx, cy + sr);
  ctx.quadraticCurveTo(cx, cy, cx - sr, cy);
  ctx.quadraticCurveTo(cx, cy, cx, cy - sr);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
  ctx.restore();
}

/** Degradé oscuro sobre los bordes de la foto — mantiene el centro limpio y oscurece hacia las esquinas. */
function paintPhotoVignette(ctx, x, y, w, h, radius) {
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, radius);
  ctx.clip();
  const cx = x + w / 2;
  const cy = y + h / 2;
  const r = Math.max(w, h) * 0.75;
  const g = ctx.createRadialGradient(cx, cy, r * 0.35, cx, cy, r);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(1, 'rgba(0,0,0,0.78)');
  ctx.fillStyle = g;
  ctx.fillRect(x, y, w, h);
  ctx.restore();
}

/* Mismos tonos que MEDALLA_RAREZA_COLOR en ui.jsx (canvas 2D no puede resolver var(--css)). */
const MEDALLA_RAREZA_COLOR = {
  basica: '#8aa0c0', rara: '#38cdf0', epica: '#8b5cf6', legendaria: '#E6B325',
};

/** Medalla activa del personaje, en un círculo enmarcado por el color de su rareza. */
function drawMedallaBadge(ctx, img, rareza, cx, cy, size) {
  const r = size / 2;
  const color = MEDALLA_RAREZA_COLOR[rareza] ?? MEDALLA_RAREZA_COLOR.basica;

  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.clip();
  ctx.fillStyle = '#04070f';
  ctx.fillRect(cx - r, cy - r, size, size);
  if (img) {
    const scale = Math.max(size / img.width, size / img.height);
    const dw = img.width * scale;
    const dh = img.height * scale;
    ctx.drawImage(img, cx - dw / 2, cy - dh / 2, dw, dh);
  }
  ctx.restore();

  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.shadowColor = color;
  ctx.shadowBlur = 10;
  ctx.lineWidth = 3;
  ctx.strokeStyle = color;
  ctx.stroke();
  ctx.restore();
}

/** Dibuja la carta imprimible del personaje y devuelve el canvas listo para exportar. */
export async function drawCharacterCard(character, user) {
  await ensureFonts();

  const side = SIDE_FRAME[character.side] ?? SIDE_FRAME.luminoso;
  const saberColor = NX.SABERS[character.saber_color] ?? NX.SABERS.azul;
  const classInfo = NX.CLASSES.find(c => c.id === character.cls) ?? NX.CLASSES[0];
  const equippedSaberColor = NX.SABERS[character.sable_activo?.color_hoja] ?? saberColor;
  const tierKey = user?.tier ?? character.tier ?? 'iniciado';
  const tierLabel = NX.TIERS[tierKey]?.label ?? 'Iniciado';
  const tierColor = TIER_COLOR[tierKey] ?? TIER_COLOR.iniciado;
  const handle = character.handle ?? '';
  const publicUrl = `${window.location.origin}/c/${encodeURIComponent(handle)}`;
  const baseCombat = character.combat_base_stats ?? {};
  const saberBonos = character.sable_bonos ?? {};
  const combatStats = character.combat_stats ?? {};
  const sableDano = character.sable_activo?.dano ?? 0;
  const sableDanoPerforante = character.sable_activo?.dano_perforante ?? 0;
  const sableNombre = (character.sable_activo?.nombre ?? '').toUpperCase() || 'BONOS DEL SABLE';

  const medallaActiva = character.medalla_activa?.medalla ?? null;

  const [photoImg, qrDataUrl, rankImg, formaImg, medallaImg] = await Promise.all([
    loadImage(mediaUrl(character.photo ?? character.photo_url)),
    handle
      ? QRCode.toDataURL(publicUrl, { width: 160, margin: 0, color: { dark: '#eaf9ffcc', light: '#00000000' } }).catch(() => null)
      : Promise.resolve(null),
    loadImage(TIER_RANGO_IMG[tierKey] ?? TIER_RANGO_IMG.iniciado),
    loadImage(classInfo.img),
    medallaActiva ? loadImage(mediaUrl(medallaActiva.imagen)) : Promise.resolve(null),
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

  /* ── cabecera: fondo negro semitransparente, borde 2px redondeado, padding 14, margen superior 12 ── */
  const headerPad = 14;
  const logoR = 30;
  const headerMarginTop = 12;
  const headerTop = pad + headerMarginTop;
  const headerH = Math.max(logoR * 2 + headerPad * 2, 64);
  const headerBottom = headerTop + headerH;
  paintBoxBg(ctx, innerX, headerTop, innerW, headerH, 10, 2);

  const logoCx = innerX + innerW - headerPad - logoR;
  const logoCy = headerTop + headerH / 2;
  const nameMaxW = logoCx - logoR - 14 - (innerX + headerPad);

  ctx.textAlign = 'left';
  const nameText = `${tierLabel} ${character.name ?? '???'}`;
  fitText(ctx, nameText, nameMaxW, '26px Orbitron');
  ctx.fillStyle = '#eaf2ff';
  const nameY = headerTop + headerPad + 26;
  ctx.fillText(nameText, innerX + headerPad, nameY);

  /* ── sub-línea: título activo (izq., dorado) + grito de guerra (der., en cursiva/cita) ── */
  const bio = character.bio ?? '';
  const tituloText = (character.titulo_activo?.nombre ?? '').toUpperCase();
  if (tituloText || bio) {
    const subY = nameY + 20;
    const subGap = 14;
    const subColW = (nameMaxW - subGap) / 2;

    if (tituloText) {
      ctx.textAlign = 'left';
      const tituloSize = fitText(ctx, tituloText, subColW, '13px "JetBrains Mono"', 9);
      ctx.font = `700 ${tituloSize}px "JetBrains Mono"`;
      ctx.fillStyle = '#E6B325';
      ctx.fillText(tituloText, innerX + headerPad, subY);
    }

    if (bio) {
      const cryText = `“${bio}”`;
      const cryColX = innerX + headerPad + nameMaxW;
      ctx.textAlign = 'right';
      const crySize = fitText(ctx, cryText, subColW, '13px "JetBrains Mono"', 9);
      ctx.font = `${crySize}px "JetBrains Mono"`;
      ctx.fillStyle = 'rgba(220,230,255,0.6)';
      ctx.fillText(cryText, cryColX, subY);
    }
  }

  if (rankImg) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(logoCx, logoCy, logoR, 0, Math.PI * 2);
    ctx.clip();
    ctx.fillStyle = '#04070f';
    ctx.fillRect(logoCx - logoR, logoCy - logoR, logoR * 2, logoR * 2);
    const scale = Math.max((logoR * 2) / rankImg.width, (logoR * 2) / rankImg.height);
    const dw = rankImg.width * scale;
    const dh = rankImg.height * scale;
    ctx.drawImage(rankImg, logoCx - dw / 2, logoCy - dh / 2, dw, dh);
    ctx.restore();
    ctx.beginPath();
    ctx.arc(logoCx, logoCy, logoR, 0, Math.PI * 2);
    ctx.save();
    ctx.shadowColor = tierColor;
    ctx.shadowBlur = 8;
    ctx.lineWidth = 3;
    ctx.strokeStyle = tierColor;
    ctx.stroke();
    ctx.restore();
  } else {
    ctx.beginPath();
    ctx.arc(logoCx, logoCy, logoR, 0, Math.PI * 2);
    ctx.fillStyle = tierColor;
    ctx.fill();
    ctx.textAlign = 'center';
    ctx.fillStyle = '#04070f';
    ctx.font = '800 26px Orbitron';
    ctx.fillText(tierLabel.charAt(0), logoCx, logoCy + 9);
  }

  /* ── foto de personaje, con degradé oscuro en los bordes ── */
  const photoTop = headerBottom + 14;
  const photoH = 400;
  if (photoImg) {
    drawImageRounded(ctx, photoImg, innerX, photoTop, innerW, photoH, 16, `${side.line}66`, 3, 'top', 'cover');
  } else {
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(innerX, photoTop, innerW, photoH, 16);
    ctx.clip();
    const artBg = ctx.createRadialGradient(
      innerX + innerW / 2, photoTop + photoH / 2, 20,
      innerX + innerW / 2, photoTop + photoH / 2, innerW / 1.3,
    );
    artBg.addColorStop(0, `${classInfo.accent}22`);
    artBg.addColorStop(1, '#04070f');
    ctx.fillStyle = artBg;
    ctx.fillRect(innerX, photoTop, innerW, photoH);
    ctx.globalAlpha = 0.4;
    drawIcon(ctx, classInfo.icon, innerX + innerW / 2, photoTop + photoH / 2, 150, classInfo.accent, 1.6);
    ctx.globalAlpha = 1;
    ctx.restore();
    ctx.beginPath();
    ctx.roundRect(innerX, photoTop, innerW, photoH, 16);
    ctx.lineWidth = 3;
    ctx.strokeStyle = `${side.line}66`;
    ctx.stroke();
  }
  paintPhotoVignette(ctx, innerX, photoTop, innerW, photoH, 16);

  /* ── medalla activa: esquina inferior izquierda de la foto ── */
  if (medallaActiva) {
    const medallaSize = 56;
    const medallaMargin = 12;
    drawMedallaBadge(
      ctx, medallaImg, medallaActiva.rareza,
      innerX + medallaMargin + medallaSize / 2, photoTop + photoH - medallaMargin - medallaSize / 2,
      medallaSize,
    );
  }

  /* ── vida (corazones) y escudo (energía) ── */
  const vidaVal = Math.max(0, Math.round(Number(baseCombat.vida ?? character.vida ?? COMBAT_DEFAULTS.vida) || 0));
  const escudoVal = Math.max(0, Math.round(Number(baseCombat.escudo ?? character.escudo ?? COMBAT_DEFAULTS.escudo) || 0));

  let y = photoTop + photoH + 14;
  y = paintVidaEscudoBox(ctx, {
    x: innerX, y, w: innerW, vidaVal, escudoVal,
    vidaMeta: STAT_META.vida, escudoMeta: STAT_META.escudo,
    drawIcon: (name, cx, cy, size, color, strokeWidth) => drawIcon(ctx, name, cx, cy, size, color, strokeWidth),
  });
  y += 14;

  /* ── cuadro grande: forma del usuario | sable equipado | bonos del sable | valores finales (base + bonos) ── */
  const ATTR_ORDER = ['ataque', 'defensa', 'punteria', 'movimiento', 'iniciativa'];
  const bonusRowH = 30;
  const boxPad2 = 14;
  const headerLabelH = 22;
  const totalRows = ATTR_ORDER.length;
  const rightColContentH = headerLabelH + totalRows * bonusRowH;
  const saberBoxTop = y;
  const saberBoxH = boxPad2 * 2 + rightColContentH;
  const saberBoxBottom = saberBoxTop + saberBoxH;
  paintBoxBg(ctx, innerX, saberBoxTop, innerW, saberBoxH, 10);

  const colGap2 = 14;
  const formaColW = innerW * 0.22;
  const saberColW = innerW * 0.18;
  const finalColW = innerW * 0.16;
  const formaX = innerX;
  const saberX = formaX + formaColW + colGap2;
  const bonosColX = saberX + saberColW + colGap2;
  const bonosColW = innerW - formaColW - saberColW - finalColW - colGap2 * 3;
  const finalColX = bonosColX + bonosColW + colGap2;

  /* columna de la forma: imagen a todo el alto del cuadro + rótulo con el nombre */
  const formaBoxX = formaX + boxPad2 / 2;
  const formaBoxY = saberBoxTop + boxPad2;
  const formaBoxW = formaColW - boxPad2;
  const formaBoxH = rightColContentH;
  if (formaImg) {
    drawImageRounded(ctx, formaImg, formaBoxX, formaBoxY, formaBoxW, formaBoxH, 10, `${classInfo.accent}66`);
  } else {
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(formaBoxX, formaBoxY, formaBoxW, formaBoxH, 10);
    ctx.clip();
    ctx.fillStyle = '#04070f';
    ctx.fillRect(formaBoxX, formaBoxY, formaBoxW, formaBoxH);
    drawIcon(ctx, classInfo.icon, formaBoxX + formaBoxW / 2, formaBoxY + formaBoxH / 2, 40, classInfo.accent, 1.8);
    ctx.restore();
    ctx.beginPath();
    ctx.roundRect(formaBoxX, formaBoxY, formaBoxW, formaBoxH, 10);
    ctx.lineWidth = 2;
    ctx.strokeStyle = `${classInfo.accent}66`;
    ctx.stroke();
  }

  ctx.save();
  ctx.beginPath();
  ctx.roundRect(formaBoxX, formaBoxY, formaBoxW, formaBoxH, 10);
  ctx.clip();
  const capH = 44;
  const capY = formaBoxY + formaBoxH - capH;
  const capGrad = ctx.createLinearGradient(0, capY, 0, formaBoxY + formaBoxH);
  capGrad.addColorStop(0, 'rgba(0,0,0,0)');
  capGrad.addColorStop(1, 'rgba(0,0,0,0.85)');
  ctx.fillStyle = capGrad;
  ctx.fillRect(formaBoxX, capY, formaBoxW, capH);
  ctx.restore();

  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(220,230,255,0.7)';
  ctx.font = '700 9px "JetBrains Mono"';
  ctx.fillText(classInfo.num.toUpperCase(), formaBoxX + formaBoxW / 2, formaBoxY + formaBoxH - 26);

  let formaNameSize = 15;
  ctx.font = `800 ${formaNameSize}px Orbitron`;
  while (formaNameSize > 10 && ctx.measureText(classInfo.name).width > formaBoxW - 10) {
    formaNameSize -= 1;
    ctx.font = `800 ${formaNameSize}px Orbitron`;
  }
  ctx.fillStyle = '#eaf2ff';
  ctx.fillText(classInfo.name, formaBoxX + formaBoxW / 2, formaBoxY + formaBoxH - 10);

  drawSaberBlade(
    ctx,
    saberX + boxPad2 / 2, saberBoxTop + boxPad2,
    saberColW - boxPad2, rightColContentH,
    equippedSaberColor,
  );

  const saberIconSize = 13;
  drawIcon(ctx, 'sword', bonosColX + saberIconSize / 2, saberBoxTop + boxPad2 + 4, saberIconSize, '#38cdf0', 2);

  ctx.textAlign = 'left';
  ctx.fillStyle = '#38cdf0';
  let saberNameSize = 11;
  const saberNameX = bonosColX + saberIconSize + 6;
  const saberNameMaxW = bonosColW - saberIconSize - 6 - 8;
  ctx.font = `700 ${saberNameSize}px "JetBrains Mono"`;
  while (saberNameSize > 8 && ctx.measureText(sableNombre).width > saberNameMaxW) {
    saberNameSize -= 1;
    ctx.font = `700 ${saberNameSize}px "JetBrains Mono"`;
  }
  ctx.fillText(sableNombre, saberNameX, saberBoxTop + boxPad2 + 8);

  const finalPad = 14;
  ctx.textAlign = 'right';
  ctx.fillStyle = '#38cdf0';
  ctx.font = '700 11px "JetBrains Mono"';
  ctx.fillText('FINAL', finalColX + finalColW - finalPad, saberBoxTop + boxPad2 + 8);

  const rowsStartY = saberBoxTop + boxPad2 + headerLabelH + 10;
  const drawBonusRow = (i, icon, color, label, value) => {
    const rowY = rowsStartY + i * bonusRowH;
    drawIcon(ctx, icon, bonosColX + 9, rowY - 5, 16, color, 2);
    ctx.textAlign = 'left';
    ctx.fillStyle = 'rgba(220,230,255,0.8)';
    ctx.font = '600 13px "JetBrains Mono"';
    ctx.fillText(label.toUpperCase(), bonosColX + 22, rowY);

    ctx.textAlign = 'right';
    ctx.fillStyle = color;
    ctx.font = '800 16px Orbitron';
    const sign = value > 0 ? '+' : '';
    ctx.fillText(`${sign}${value}`, bonosColX + bonosColW - 4, rowY + 2);
  };

  const drawFinalValue = (i, color, value) => {
    const rowY = rowsStartY + i * bonusRowH;
    ctx.textAlign = 'right';
    ctx.fillStyle = color;
    ctx.font = '800 16px Orbitron';
    ctx.fillText(`${value}`, finalColX + finalColW - finalPad, rowY + 2);
  };

  ATTR_ORDER.forEach((key, i) => {
    const meta = STAT_META[key];
    const bono = saberBonos[key] ?? 0;
    drawBonusRow(i, meta.icon, meta.color, meta.label, bono);
    const finalValue = combatStats[key] ?? ((baseCombat[key] ?? COMBAT_DEFAULTS[key] ?? 0) + bono);
    drawFinalValue(i, meta.color, finalValue);
  });

  ctx.strokeStyle = 'rgba(255,255,255,0.14)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(formaX + formaColW + colGap2 / 2, saberBoxTop + 8);
  ctx.lineTo(formaX + formaColW + colGap2 / 2, saberBoxBottom - 8);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(saberX + saberColW + colGap2 / 2, saberBoxTop + 8);
  ctx.lineTo(saberX + saberColW + colGap2 / 2, saberBoxBottom - 8);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(bonosColX + bonosColW + colGap2 / 2, saberBoxTop + 8);
  ctx.lineTo(bonosColX + bonosColW + colGap2 / 2, saberBoxBottom - 8);
  ctx.stroke();

  /* ── cuadro horizontal: daño, daño perforante, bono fuerza y regen. fuerza ── */
  const EXTRA_ORDER = [
    { label: 'Daño', color: '#ff5f2e', icon: 'flame', value: sableDano },
    { label: 'Daño Perforante', color: '#8aa0c0', icon: 'fire', value: sableDanoPerforante },
    { label: 'Bono Fuerza', color: '#22c55e', icon: 'force', value: saberBonos.fuerza ?? 0 },
    { label: 'Regen. Fuerza', color: '#84cc16', icon: 'trending', value: saberBonos.generacion_fuerza ?? 0 },
  ];
  const extraBoxTop = saberBoxBottom + 14;
  const extraBoxH = 76;
  const extraBoxBottom = extraBoxTop + extraBoxH;
  paintBoxBg(ctx, innerX, extraBoxTop, innerW, extraBoxH, 10);

  const cellW = innerW / EXTRA_ORDER.length;
  EXTRA_ORDER.forEach((item, i) => {
    const cx = innerX + cellW * i + cellW / 2;
    if (item.icon === 'force') {
      drawForceIcon(ctx, cx, extraBoxTop + 24, 18, item.color);
    } else {
      drawIcon(ctx, item.icon, cx, extraBoxTop + 24, 18, item.color, 2);
    }

    ctx.textAlign = 'center';
    ctx.fillStyle = item.color;
    ctx.font = '800 20px Orbitron';
    const sign = item.value > 0 ? '+' : '';
    ctx.fillText(`${sign}${item.value}`, cx, extraBoxTop + 50);

    let labelSize = 10;
    const label = item.label.toUpperCase();
    ctx.font = `600 ${labelSize}px "JetBrains Mono"`;
    while (labelSize > 7 && ctx.measureText(label).width > cellW - 10) {
      labelSize -= 1;
      ctx.font = `600 ${labelSize}px "JetBrains Mono"`;
    }
    ctx.fillStyle = 'rgba(220,230,255,0.7)';
    ctx.fillText(label, cx, extraBoxTop + 64);

    if (i > 0) {
      ctx.strokeStyle = 'rgba(255,255,255,0.14)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(innerX + cellW * i, extraBoxTop + 8);
      ctx.lineTo(innerX + cellW * i, extraBoxBottom - 8);
      ctx.stroke();
    }
  });

  /* ── pie: 3 columnas — QR + alias | logo de esgrima | ID de personaje ── */
  const footY = extraBoxBottom + 16;
  const footH = 60;
  const qrSize = 48;
  if (qrImg) {
    drawImageRounded(ctx, qrImg, innerX, footY + (footH - qrSize) / 2, qrSize, qrSize, 8, null);
  }
  ctx.textAlign = 'left';
  ctx.fillStyle = 'rgba(150,200,255,0.5)';
  ctx.font = '400 10px "JetBrains Mono"';
  const aliasX = innerX + (qrImg ? qrSize + 12 : 0);
  ctx.fillText('ALIAS', aliasX, footY + footH / 2 - 10);
  ctx.fillStyle = '#eaf2ff';
  ctx.font = '700 17px Orbitron';
  ctx.fillText(`@${handle.toUpperCase()}`, aliasX, footY + footH / 2 + 10);

  await paintLogoAt(ctx, innerX + innerW / 2, footY + footH / 2, 44);

  const idStr = `EJC-${String(user?.id ?? character.id ?? 0).padStart(3, '0')}`;
  ctx.textAlign = 'right';
  ctx.fillStyle = 'rgba(150,200,255,0.5)';
  ctx.font = '400 10px "JetBrains Mono"';
  ctx.fillText('ID PERSONAJE', innerRight, footY + footH / 2 - 10);
  ctx.fillStyle = '#eaf2ff';
  ctx.font = '700 17px Orbitron';
  ctx.fillText(idStr, innerRight, footY + footH / 2 + 10);

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
