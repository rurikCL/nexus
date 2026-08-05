import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import QRCode from 'qrcode';
import { ICON_PATHS, toast } from './ui.jsx';
import { NX } from '../data/seed.js';
import {
  CARD_W, CARD_H, mediaUrl, loadImage, ensureFonts,
  drawIcon as drawIconRaw, drawImageRounded, fitText, printCardImage, paintLogoAt, paintVignetteBackground, paintBoxBg,
  COMBAT_STAT_META as STAT_META, COMBAT_STAT_DEFAULTS as COMBAT_DEFAULTS,
  INK, PRINT_ACCENT, formaAccent, paintDropShadow, frameEdge, drawHeartPip, drawShieldPip,
} from '../utils/printableCard.js';

const drawIcon = (ctx, name, cx, cy, size, color, strokeWidth) =>
  drawIconRaw(ctx, ICON_PATHS, name, cx, cy, size, color, strokeWidth);

/* Colores planos por tier/tono — los de NX.TIERS/NX.MEDALS son var(--css) y
   canvas 2D no puede resolverlos, así que se duplican en hex (mismo criterio
   que TIER_COLOR en Comando.jsx), un paso más oscuros que los de pantalla para
   que se lean sobre el fondo claro de la carta impresa. */
const TIER_COLOR = {
  iniciado: '#4b6a90', padawan: '#0a7ec2', caballero: '#0f9d63',
  maestro: '#e2650b', granmaestro: '#c08a06',
};
/* Mismos assets que RANGOS_JEDI en Comando.jsx (apartado "Rango" de Mi Personaje). */
const TIER_RANGO_IMG = {
  iniciado:    '/assets/INITIATE.webp',
  padawan:     '/assets/PADAWAN.webp',
  caballero:   '/assets/KNIGHT.webp',
  maestro:     '/assets/MASTER.webp',
  granmaestro: '/assets/GRANDMASTER.webp',
};

/* Igual criterio que FRAME en EntityCard.jsx: tintes claros para papel + acento
   vivo en el borde (los fondos casi negros de pantalla se imprimen embarrados). */
const SIDE_FRAME = {
  luminoso: { bg1: '#d9e8fb', bg2: '#f1f7fe', line: '#1668c9' },
  oscuro:   { bg1: '#ffdfe3', bg2: '#fff1f3', line: '#e01f3d' },
};

/** Dibuja un sable de luz vertical (hoja + puño) — misma composición visual que SaberBlade en Comando.jsx. */
function drawSaberBlade(ctx, x, y, w, h, color) {
  const hiltH = Math.min(64, h * 0.24);
  const bladeGap = 6;
  const bladeH = h - hiltH - bladeGap;
  const bladeW = Math.max(7, Math.min(14, w * 0.42));
  const bladeX = x + (w - bladeW) / 2;

  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.roundRect(bladeX, y, bladeW, bladeH, bladeW / 2);
  ctx.fill();
  /* contorno fino en vez del halo de pantalla: sobre papel claro las hojas
     claras (blanco, ámbar, cian) desaparecerían sin un borde que las defina. */
  ctx.lineWidth = 1.2;
  ctx.strokeStyle = INK.hair;
  ctx.stroke();

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

  ctx.fillStyle = color;
  ctx.fillRect(hiltX + 2, hiltY + hiltH * 0.42, hiltW - 4, hiltH * 0.1);

  ctx.fillStyle = '#161d29';
  ctx.fillRect(hiltX + 2, hiltY + hiltH * 0.66, hiltW - 4, hiltH * 0.12);
}

/** Ícono místico de La Fuerza: anillo con un destello de cuatro puntas en el centro —
    evoca un aura/energía en vez de fuerza física (por eso no se usa 'dumbbell'). */
function drawForceIcon(ctx, cx, cy, size, color) {
  const r = size / 2;
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.6;
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

/* Mismos tonos que MEDALLA_RAREZA_COLOR en ui.jsx (canvas 2D no puede resolver
   var(--css)), en la variante oscurecida para impresión. */
const MEDALLA_RAREZA_COLOR = {
  basica: '#4b6a90', rara: '#0a7ec2', epica: '#7a35e0', legendaria: '#c08a06',
};

/** Medalla activa del personaje, en un círculo enmarcado por el color de su rareza. */
function drawMedallaBadge(ctx, img, rareza, cx, cy, size) {
  const r = size / 2;
  const color = MEDALLA_RAREZA_COLOR[rareza] ?? MEDALLA_RAREZA_COLOR.basica;

  paintDropShadow(ctx, cx - r, cy - r, size, size, r, { blur: 7, offsetY: 2 });
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.clip();
  ctx.fillStyle = INK.paper;
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
    loadImage(mediaUrl(character.imagen_rpg ?? character.imagen_rpg_url ?? character.photo ?? character.photo_url)),
    handle
      ? QRCode.toDataURL(publicUrl, { width: 160, margin: 0, color: { dark: '#12283cee', light: '#00000000' } }).catch(() => null)
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

  const artX = pad;
  const artY = pad;
  const artW = CARD_W - pad * 2;
  const artH = CARD_H - pad * 2;
  const classAccent = formaAccent(classInfo);

  const bg = ctx.createLinearGradient(0, 0, 0, CARD_H);
  bg.addColorStop(0, side.bg1);
  bg.addColorStop(1, side.bg2);
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(artX, artY, artW, artH, 22);
  ctx.clip();
  ctx.fillStyle = bg;
  ctx.fillRect(artX, artY, artW, artH);
  ctx.restore();

  paintVignetteBackground(ctx, artX, artY, artW, artH, 22, frameEdge(side));

  /* ── arte: la foto del personaje ocupa TODA la carta como fondo ──────────────
     Encima va un velo blanco: la paleta de la carta es de papel (texto oscuro sobre
     superficies blancas translúcidas, ver INK), así que sin aclarar el arte los cuadros
     de datos pierden contraste sobre un retrato oscuro. */
  if (photoImg) {
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(artX, artY, artW, artH, 22);
    ctx.clip();

    const scale = Math.max(artW / photoImg.width, artH / photoImg.height);
    const dw = photoImg.width * scale;
    const dh = photoImg.height * scale;
    /* Anclado arriba: en un retrato la cabeza es lo que no se puede recortar. */
    ctx.drawImage(photoImg, artX + (artW - dw) / 2, artY, dw, dh);

    ctx.fillStyle = 'rgba(255,255,255,0.34)';
    ctx.fillRect(artX, artY, artW, artH);
    ctx.restore();
  } else {
    /* Sin foto: degradé radial con el acento de la forma, como antes. */
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(artX, artY, artW, artH, 22);
    ctx.clip();
    const artBg = ctx.createRadialGradient(
      artX + artW / 2, artY + artH / 2, 20,
      artX + artW / 2, artY + artH / 2, artW / 1.1,
    );
    artBg.addColorStop(0, `${classAccent}2e`);
    artBg.addColorStop(1, INK.paper);
    ctx.fillStyle = artBg;
    ctx.fillRect(artX, artY, artW, artH);
    ctx.globalAlpha = 0.4;
    drawIcon(ctx, classInfo.icon, artX + artW / 2, artY + artH / 2, 220, classAccent, 1.6);
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  ctx.save();
  ctx.beginPath();
  ctx.roundRect(pad, pad, CARD_W - pad * 2, CARD_H - pad * 2, 22);
  ctx.lineWidth = 3;
  ctx.strokeStyle = side.line;
  ctx.stroke();
  ctx.restore();

  /* ── cabecera ────────────────────────────────────────────────────────────────
     Dos columnas sobre el arte, al estilo de las cartas de juego: a la izquierda una
     pila de fichas (rango → vida → escudo), a la derecha el título asignado, el nombre
     en grande y el grito de guerra. */
  const vidaVal = Math.max(0, Math.round(Number(baseCombat.vida ?? character.vida ?? COMBAT_DEFAULTS.vida) || 0));
  const escudoVal = Math.max(0, Math.round(Number(baseCombat.escudo ?? character.escudo ?? COMBAT_DEFAULTS.escudo) || 0));

  const headerPad = 16;
  const headerTop = pad + 12;
  const pipR = 24;                       // radio de cada ficha de la columna izquierda
  const pipGapY = 9;
  const pipColH = pipR * 2 * 3 + pipGapY * 2;
  const headerH = pipColH + headerPad * 2;
  const headerBottom = headerTop + headerH;
  /* Sin caja: la cabecera va directo sobre el arte. Como el texto es oscuro y el arte puede
     ser cualquier cosa, cada texto se dibuja con un halo blanco (ver conHalo) que cumple el
     papel de separación que antes hacía el cuadro. */

  /* Envuelve un dibujo de texto con un halo blanco, para que se lea sobre cualquier arte. */
  const conHalo = (dibujar, blur = 10) => {
    ctx.save();
    ctx.shadowColor = 'rgba(255,255,255,0.95)';
    ctx.shadowBlur = blur;
    dibujar();
    dibujar();   // dos pasadas: un solo shadowBlur queda muy tenue bajo texto grande
    ctx.restore();
  };

  /* Columna izquierda: ficha circular con el ícono + el total al lado. */
  const pipCx = innerX + headerPad + pipR;
  const pipValueX = pipCx + pipR + 9;
  const leftLabelW = 96;                 // espacio para "GRANMAESTRO" y para los totales
  /* `dibujarForma` recibe (x, y, size) con la esquina superior-izquierda: se usan las mismas
     siluetas de corazón/escudo que ya tenía la carta (drawHeartPip/drawShieldPip), no ICON_PATHS
     —ahí no hay un corazón, y STAT_META.vida trae un rayo—. */
  const drawStatPip = (cy, dibujarForma, color, value) => {
    ctx.beginPath();
    ctx.arc(pipCx, cy, pipR, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.72)';
    ctx.fill();
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = color;
    ctx.stroke();
    const formaSize = 28;   // ícono dentro de la ficha
    dibujarForma(pipCx - formaSize / 2, cy - formaSize / 2, formaSize);

    ctx.textAlign = 'left';
    ctx.fillStyle = color;
    ctx.font = '800 30px Orbitron';
    conHalo(() => ctx.fillText(String(value), pipValueX, cy + 11), 8);
  };

  const rankCy = headerTop + headerPad + pipR;
  const vidaCy = rankCy + pipR * 2 + pipGapY;
  const escudoCy = vidaCy + pipR * 2 + pipGapY;

  /* Ficha de rango: la imagen del tier recortada en el círculo, con aro del color del tier. */
  if (rankImg) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(pipCx, rankCy, pipR, 0, Math.PI * 2);
    ctx.clip();
    ctx.fillStyle = INK.paper;
    ctx.fillRect(pipCx - pipR, rankCy - pipR, pipR * 2, pipR * 2);
    const rs = Math.max((pipR * 2) / rankImg.width, (pipR * 2) / rankImg.height);
    ctx.drawImage(rankImg, pipCx - (rankImg.width * rs) / 2, rankCy - (rankImg.height * rs) / 2, rankImg.width * rs, rankImg.height * rs);
    ctx.restore();
  } else {
    ctx.beginPath();
    ctx.arc(pipCx, rankCy, pipR, 0, Math.PI * 2);
    ctx.fillStyle = tierColor;
    ctx.fill();
    ctx.textAlign = 'center';
    ctx.fillStyle = INK.onAccent;
    ctx.font = '800 22px Orbitron';
    ctx.fillText(tierLabel.charAt(0), pipCx, rankCy + 8);
  }
  ctx.beginPath();
  ctx.arc(pipCx, rankCy, pipR, 0, Math.PI * 2);
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = tierColor;
  ctx.stroke();

  ctx.textAlign = 'left';
  ctx.fillStyle = tierColor;
  /* Ancho reservado a la etiqueta del rango: define dónde arranca el bloque de texto de la
     derecha, así no se pisan (con "GRANMAESTRO", el más largo, entra justo). */
  const tierMaxW = leftLabelW;
  const tierSize = fitText(ctx, tierLabel.toUpperCase(), tierMaxW, '13px "JetBrains Mono"', 9);
  ctx.font = `700 ${tierSize}px "JetBrains Mono"`;
  conHalo(() => ctx.fillText(tierLabel.toUpperCase(), pipValueX, rankCy + 5), 7);

  drawStatPip(vidaCy, (x, y, s) => drawHeartPip(ctx, x, y, s, STAT_META.vida.color), STAT_META.vida.color, vidaVal);
  drawStatPip(escudoCy, (x, y, s) => drawShieldPip(ctx, x, y, s, STAT_META.escudo.color), STAT_META.escudo.color, escudoVal);

  /* Columna derecha: título asignado → nombre → grito de guerra, alineados a la derecha. */
  const textRight = innerX + innerW - headerPad;
  const textLeft = pipValueX + leftLabelW + 16;
  const textMaxW = textRight - textLeft;
  const bio = character.bio ?? '';
  const tituloText = (character.titulo_activo?.nombre ?? '').toUpperCase();

  ctx.textAlign = 'right';
  if (tituloText) {
    const tSize = fitText(ctx, tituloText, textMaxW, '15px "JetBrains Mono"', 9);
    ctx.font = `700 ${tSize}px "JetBrains Mono"`;
    ctx.fillStyle = INK.muted;
    conHalo(() => ctx.fillText(tituloText, textRight, headerTop + headerPad + 13), 7);
  }

  const nameText = (character.name ?? '???').toUpperCase();
  const nameSize = fitText(ctx, nameText, textMaxW, '58px Orbitron', 24);
  ctx.font = `800 ${nameSize}px Orbitron`;
  ctx.fillStyle = INK.strong;
  conHalo(() => ctx.fillText(nameText, textRight, headerTop + headerPad + 24 + nameSize * 0.74), 14);

  if (bio) {
    const cryText = `“${bio}”`;
    const cSize = fitText(ctx, cryText, textMaxW, '15px "JetBrains Mono"', 9);
    ctx.font = `italic ${cSize}px "JetBrains Mono"`;
    ctx.fillStyle = INK.muted;
    conHalo(() => ctx.fillText(cryText, textRight, headerTop + headerPad + pipColH - 2), 7);
  }

  /* ── cuadro grande: forma del usuario | sable equipado | bonos del sable | valores finales (base + bonos) ──
     Los tres bloques de datos se anclan al PIE de la carta: entre la cabecera y ellos queda la
     ventana donde se ve el arte de fondo. */
  const ATTR_ORDER = ['ataque', 'defensa', 'punteria', 'movimiento', 'iniciativa'];
  const bonusRowH = 30;
  const boxPad2 = 14;
  const headerLabelH = 22;
  const totalRows = ATTR_ORDER.length;
  const rightColContentH = headerLabelH + totalRows * bonusRowH;
  const footH = 60;
  const footY = CARD_H - pad - 16 - footH;
  const extraBoxH = 76;
  const extraBoxTopAnchored = footY - 16 - extraBoxH;
  const saberBoxTop = extraBoxTopAnchored - 14 - (boxPad2 * 2 + rightColContentH);

  /* ── medalla activa: esquina inferior izquierda de la ventana de arte ── */
  if (medallaActiva) {
    const medallaSize = 60;
    drawMedallaBadge(
      ctx, medallaImg, medallaActiva.rareza,
      innerX + 12 + medallaSize / 2, saberBoxTop - 16 - medallaSize / 2,
      medallaSize,
    );
  }
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
    /* Sin borde, a pedido: el estandarte de la forma va limpio contra el cuadro. */
    /* Sin fondo ni borde: el bgColor por defecto de drawImageRounded es INK.paper (blanco),
       así que se pasa transparente para que el estandarte quede calado sobre el arte. */
    drawImageRounded(ctx, formaImg, formaBoxX, formaBoxY, formaBoxW, formaBoxH, 10, null, 3, 'center', 'contain', 'rgba(0,0,0,0)');
  } else {
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(formaBoxX, formaBoxY, formaBoxW, formaBoxH, 10);
    ctx.clip();
    ctx.fillStyle = INK.paper;
    ctx.fillRect(formaBoxX, formaBoxY, formaBoxW, formaBoxH);
    drawIcon(ctx, classInfo.icon, formaBoxX + formaBoxW / 2, formaBoxY + formaBoxH / 2, 40, classAccent, 1.8);
    ctx.restore();
    ctx.beginPath();
    ctx.roundRect(formaBoxX, formaBoxY, formaBoxW, formaBoxH, 10);
    ctx.lineWidth = 2;
    ctx.strokeStyle = `${classAccent}99`;
    ctx.stroke();
  }

  /* El rótulo va con halo en vez de una franja blanca de fondo (ver conHalo). */
  ctx.textAlign = 'center';
  ctx.fillStyle = INK.muted;
  ctx.font = '700 9px "JetBrains Mono"';
  conHalo(() => ctx.fillText(classInfo.num.toUpperCase(), formaBoxX + formaBoxW / 2, formaBoxY + formaBoxH - 26), 6);

  let formaNameSize = 15;
  ctx.font = `800 ${formaNameSize}px Orbitron`;
  while (formaNameSize > 10 && ctx.measureText(classInfo.name).width > formaBoxW - 10) {
    formaNameSize -= 1;
    ctx.font = `800 ${formaNameSize}px Orbitron`;
  }
  ctx.fillStyle = INK.strong;
  conHalo(() => ctx.fillText(classInfo.name, formaBoxX + formaBoxW / 2, formaBoxY + formaBoxH - 10), 8);

  drawSaberBlade(
    ctx,
    saberX + boxPad2 / 2, saberBoxTop + boxPad2,
    saberColW - boxPad2, rightColContentH,
    equippedSaberColor,
  );

  const saberIconSize = 13;
  drawIcon(ctx, 'sword', bonosColX + saberIconSize / 2, saberBoxTop + boxPad2 + 4, saberIconSize, PRINT_ACCENT.energia, 2);

  ctx.textAlign = 'left';
  ctx.fillStyle = PRINT_ACCENT.energia;
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
  ctx.fillStyle = PRINT_ACCENT.energia;
  ctx.font = '700 11px "JetBrains Mono"';
  ctx.fillText('FINAL', finalColX + finalColW - finalPad, saberBoxTop + boxPad2 + 8);

  const rowsStartY = saberBoxTop + boxPad2 + headerLabelH + 10;
  const drawBonusRow = (i, icon, color, label, value) => {
    const rowY = rowsStartY + i * bonusRowH;
    drawIcon(ctx, icon, bonosColX + 9, rowY - 5, 16, color, 2);
    ctx.textAlign = 'left';
    ctx.fillStyle = INK.body;
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

  ctx.strokeStyle = INK.hair;
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
    { label: 'Daño', color: PRINT_ACCENT.danoBonus, icon: 'flame', value: sableDano },
    { label: 'Daño Perforante', color: PRINT_ACCENT.danoPerforante, icon: 'fire', value: sableDanoPerforante },
    { label: 'Bono Fuerza', color: PRINT_ACCENT.fuerza, icon: 'force', value: saberBonos.fuerza ?? 0 },
    { label: 'Regen. Fuerza', color: PRINT_ACCENT.fuerzaGen, icon: 'trending', value: saberBonos.generacion_fuerza ?? 0 },
  ];
  const extraBoxTop = extraBoxTopAnchored;
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
    ctx.fillStyle = INK.muted;
    ctx.fillText(label, cx, extraBoxTop + 64);

    if (i > 0) {
      ctx.strokeStyle = INK.hair;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(innerX + cellW * i, extraBoxTop + 8);
      ctx.lineTo(innerX + cellW * i, extraBoxBottom - 8);
      ctx.stroke();
    }
  });

  /* ── pie: 3 columnas — QR + alias | logo de esgrima | ID de personaje ── */
  /* footY/footH se calcularon con el anclaje al pie, más arriba. */
  const qrSize = 48;
  /* Pie sin cuadro: cada texto se sostiene con su halo (ver conHalo). */
  if (qrImg) {
    drawImageRounded(ctx, qrImg, innerX, footY + (footH - qrSize) / 2, qrSize, qrSize, 8, null);
  }
  ctx.textAlign = 'left';
  ctx.fillStyle = INK.muted;
  ctx.font = '400 10px "JetBrains Mono"';
  const aliasX = innerX + (qrImg ? qrSize + 12 : 0);
  conHalo(() => ctx.fillText('ALIAS', aliasX, footY + footH / 2 - 10), 6);
  ctx.fillStyle = INK.strong;
  ctx.font = '700 17px Orbitron';
  conHalo(() => ctx.fillText(`@${handle.toUpperCase()}`, aliasX, footY + footH / 2 + 10), 8);

  await paintLogoAt(ctx, innerX + innerW / 2, footY + footH / 2, 44);

  const idStr = `EJC-${String(user?.id ?? character.id ?? 0).padStart(3, '0')}`;
  ctx.textAlign = 'right';
  ctx.fillStyle = INK.muted;
  ctx.font = '400 10px "JetBrains Mono"';
  conHalo(() => ctx.fillText('ID PERSONAJE', innerRight, footY + footH / 2 - 10), 6);
  ctx.fillStyle = INK.strong;
  ctx.font = '700 17px Orbitron';
  conHalo(() => ctx.fillText(idStr, innerRight, footY + footH / 2 + 10), 8);

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
