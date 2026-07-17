import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ICON_PATHS } from './ui.jsx';

/* Duplicado liviano de resources/js/components/PvpCombatScreen.jsx#mediaUrl —
   se mantiene local para no acoplar este módulo (uso puntual, sin estado) al
   componente de la pantalla de combate. */
function mediaUrl(path) {
  if (!path) return null;
  if (/^(https?:)?\/\//.test(path) || path.startsWith('data:') || path.startsWith('blob:')) return path;
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  if (cleanPath.startsWith('/storage/')) return cleanPath;
  if (cleanPath.startsWith('/admin/'))   return `/storage${cleanPath}`;
  if (cleanPath.startsWith('/public/'))  return cleanPath.replace('/public/', '/storage/');
  return `/storage${cleanPath}`;
}

/** Suma daño infligido, curación, críticos, bloqueos y daño por habilidad/ataque, por bando, a partir del log del combate. */
export function summarizeCombat(combat) {
  const log = combat.log ?? [];
  const mk = () => ({ dmgDealt: 0, healDone: 0, crits: 0, blocks: 0, actionDmg: {} });
  const totals = { [combat.attacker.id]: mk(), [combat.defender.id]: mk() };

  for (const entry of log) {
    const side = totals[entry.actor_id];
    if (!side) continue; // entrada inicial de iniciativa (ronda 1), sin actor

    const msgs = entry.messages ?? [];
    const actionMsg = msgs.find(m => / ataca (con|desarmado)| usa /.test(m));
    const actionName = actionMsg
      ? (actionMsg.match(/ usa (.+?):/)?.[1]
        ?? actionMsg.match(/ ataca con (.+?):/)?.[1]
        ?? (/ ataca desarmado/.test(actionMsg) ? 'Ataque desarmado' : null))
      : null;

    let entryDmg = 0;
    let blocked = false;
    for (const m of msgs) {
      // Un mismo mensaje puede reportar dos cifras de daño (p. ej. "−2 daño al
      // escudo — ¡escudo perforado! −3 daño a la vida") — se suman todas.
      for (const dmgMatch of m.matchAll(/−(\d+) daño/g)) {
        entryDmg += Number(dmgMatch[1]);
        side.dmgDealt += Number(dmgMatch[1]);
      }
      if (/¡CRÍTICO!/.test(m)) side.crits += 1;
      const healMatch = m.match(/\+(\d+) (?:vida|escudo)/);
      if (healMatch) side.healDone += Number(healMatch[1]);
      if (/falla el (golpe|ataque)/.test(m)) blocked = true;
    }

    if (actionName && entryDmg > 0) {
      side.actionDmg[actionName] = (side.actionDmg[actionName] ?? 0) + entryDmg;
    }
    if (blocked) {
      // el ataque del actor falló: el oponente bloqueó/esquivó
      const opponentId = Object.keys(totals).find(uid => Number(uid) !== entry.actor_id);
      if (opponentId) totals[opponentId].blocks += 1;
    }
  }

  const topAction = (side) => {
    const entries = Object.entries(side.actionDmg);
    if (!entries.length) return null;
    entries.sort((a, b) => b[1] - a[1]);
    return { name: entries[0][0], dmg: entries[0][1] };
  };

  const attacker = totals[combat.attacker.id];
  const defender = totals[combat.defender.id];

  return {
    rounds: combat.ronda ?? 1,
    attacker: { ...attacker, topAction: topAction(attacker) },
    defender: { ...defender, topAction: topAction(defender) },
  };
}

/** Igual que summarizeCombat pero para el log plano (un mensaje por entrada) de NpcCombatScreen. */
export function summarizeNpcLog(log = []) {
  const mk = () => ({ dmgDealt: 0, healDone: 0, crits: 0 });
  const totals = { player: mk(), npc: mk() };
  let rounds = 1;
  for (const entry of log) {
    rounds = Math.max(rounds, entry.ronda ?? 1);
    const side = totals[entry.actor];
    if (!side) continue; // entradas 'system' (iniciativa, cambio de estancia, etc.)
    // Un mismo mensaje puede reportar dos cifras de daño (p. ej. escudo perforado) — se suman todas.
    for (const dmgMatch of entry.text.matchAll(/−(\d+) daño/g)) {
      side.dmgDealt += Number(dmgMatch[1]);
    }
    if (/¡CRÍTICO!/.test(entry.text)) side.crits += 1;
    const healMatch = entry.text.match(/\+(\d+) (?:vida|escudo)/);
    if (healMatch) side.healDone += Number(healMatch[1]);
  }
  return { rounds, player: totals.player, npc: totals.npc };
}

function loadImage(src) {
  return new Promise((resolve) => {
    if (!src) { resolve(null); return; }
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

async function ensureFonts() {
  if (!document.fonts) return;
  try {
    await document.fonts.ready;
    await Promise.all([
      document.fonts.load('800 64px Orbitron'),
      document.fonts.load('800 34px Orbitron'),
      document.fonts.load('700 26px Orbitron'),
      document.fonts.load('600 22px "JetBrains Mono"'),
      document.fonts.load('400 20px "JetBrains Mono"'),
    ]);
  } catch { /* si las fuentes no cargan a tiempo, se usa el fallback del sistema */ }
}

async function loadRaidLocation(lugarId) {
  if (!lugarId) return null;
  const token = localStorage.getItem('nx-token');
  try {
    const res = await fetch(`/api/map/lugares/${lugarId}`, {
      headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    const data = await res.json();
    const lugar = data?.lugar ?? null;
    const planeta = lugar?.zona?.planeta ?? null;
    if (!lugar || !planeta) return null;
    return {
      planeta: planeta.nombre ?? null,
      lugar: lugar.nombre ?? null,
      planetaImg: mediaUrl(planeta.imagen),
      lugarImg: mediaUrl(lugar.imagen),
    };
  } catch {
    return null;
  }
}

/** Dibuja un ícono de resources/js/components/ui.jsx (viewBox 24x24) centrado en (cx, cy) con tamaño `size`. */
function drawIcon(ctx, name, cx, cy, size, color, strokeWidth = 1.8) {
  const d = ICON_PATHS[name];
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

function drawAvatar(ctx, img, cx, cy, r, ringColor, isNave) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.closePath();
  ctx.clip();
  ctx.fillStyle = '#0a1428';
  ctx.fill();
  if (img) {
    const scale = Math.max((r * 2) / img.width, (r * 2) / img.height);
    const w = img.width * scale;
    const h = img.height * scale;
    ctx.drawImage(img, cx - w / 2, cy - h / 2, w, h);
  }
  ctx.restore();

  ctx.save();
  ctx.shadowColor = ringColor;
  ctx.shadowBlur = 26;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.lineWidth = 6;
  ctx.strokeStyle = ringColor;
  ctx.stroke();
  ctx.restore();

  if (!img) {
    drawIcon(ctx, isNave ? 'ship' : 'user', cx, cy, r * 0.9, 'rgba(150,200,255,0.5)', 2.2);
  }
}

/** Dibuja una imagen centrada en (cx, cy) ajustada dentro de w×h sin recortar ni rellenar fondo — para planetas (fondo transparente, sin borde). */
function drawImagePlain(ctx, img, cx, cy, w, h) {
  if (!img) return;
  const scale = Math.min(w / img.width, h / img.height);
  const dw = img.width * scale;
  const dh = img.height * scale;
  ctx.drawImage(img, cx - dw / 2, cy - dh / 2, dw, dh);
}

/** Dibuja una imagen recortada dentro de un rectángulo de esquinas semiredondeadas, con borde — para el lugar. */
function drawImageRounded(ctx, img, cx, cy, w, h, radius, borderColor) {
  const x = cx - w / 2;
  const y = cy - h / 2;
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
    ctx.drawImage(img, cx - dw / 2, cy - dh / 2, dw, dh);
  }
  ctx.restore();

  ctx.save();
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, radius);
  ctx.lineWidth = 3;
  ctx.strokeStyle = borderColor;
  ctx.stroke();
  ctx.restore();

  if (!img) {
    drawIcon(ctx, 'target', cx, cy, Math.min(w, h) * 0.4, 'rgba(150,200,255,0.5)', 2.2);
  }
}

function fitText(ctx, text, maxWidth, baseFont, minFont = 18) {
  let size = parseInt(baseFont, 10);
  const rest = baseFont.replace(/^\d+px\s*/, '');
  while (size > minFont) {
    ctx.font = `${size}px ${rest}`;
    if (ctx.measureText(text).width <= maxWidth) break;
    size -= 2;
  }
  ctx.font = `${size}px ${rest}`;
  return size;
}

/** Envuelve `text` en líneas de máximo `maxWidth` px (con `ctx.font` ya seteado) y las dibuja centradas desde (cx, y), separadas por `lineHeight`. Devuelve el Y final. */
function wrapText(ctx, text, cx, y, maxWidth, lineHeight) {
  const words = text.split(/\s+/).filter(Boolean);
  let line = '';
  let cy = y;
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      ctx.fillText(line, cx, cy);
      line = word;
      cy += lineHeight;
    } else {
      line = test;
    }
  }
  if (line) { ctx.fillText(line, cx, cy); cy += lineHeight; }
  return cy;
}

/** Dibuja la tarjeta de resolución de combate y devuelve el canvas listo para exportar. */
async function renderResultCard({ winner, loser, rounds, subtitle, rows, resumenIA, winnerHighlights, location }) {
  await ensureFonts();

  const W = 1080;
  const H = 1350 + (winnerHighlights ? 300 : 0) + (resumenIA ? 270 : 0) + (location ? 360 : 0);
  const DPR = 2;
  const canvas = document.createElement('canvas');
  canvas.width = W * DPR;
  canvas.height = H * DPR;
  const ctx = canvas.getContext('2d');
  ctx.scale(DPR, DPR);

  const [winnerImg, loserImg, planetaImg, lugarImg] = await Promise.all([
    loadImage(winner.imageSrc),
    loadImage(loser.imageSrc),
    loadImage(location?.planetaImg),
    loadImage(location?.lugarImg),
  ]);

  /* ── fondo ── */
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#070d1c');
  bg.addColorStop(1, '#01030a');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  ctx.save();
  ctx.filter = 'blur(70px)';
  const glow = ctx.createRadialGradient(W / 2, 480, 40, W / 2, 480, 420);
  glow.addColorStop(0, 'rgba(56,205,240,0.16)');
  glow.addColorStop(1, 'rgba(56,205,240,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);
  ctx.restore();

  ctx.strokeStyle = 'rgba(56,205,240,0.06)';
  ctx.lineWidth = 1;
  for (let y = 0; y < H; y += 60) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
  for (let x = 0; x < W; x += 60) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }

  ctx.strokeStyle = 'rgba(56,205,240,0.35)';
  ctx.lineWidth = 2;
  ctx.strokeRect(16, 16, W - 32, H - 32);

  /* ── encabezado ── */
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(150,200,255,0.6)';
  ctx.font = '600 24px "JetBrains Mono"';
  ctx.fillText('N É X U S   ·   R E G I S T R O   D E   C O M B A T E', W / 2, 100);

  const headlineColor = '#E6B325';
  const headline = `🏆 ${winner.name.toUpperCase()}`;
  fitText(ctx, headline, W - 160, '62px Orbitron');
  ctx.fillStyle = headlineColor;
  ctx.fillText(headline, W / 2, 200);

  ctx.fillStyle = 'rgba(220,230,255,0.75)';
  ctx.font = '400 28px "JetBrains Mono"';
  ctx.fillText(subtitle, W / 2, 245);

  /* ── avatares — el ganador siempre a la izquierda ── */
  const cy = 480;
  const r = 150;
  const winnerX = 300;
  const loserX = 780;

  drawIcon(ctx, 'crown', winnerX, cy - r - 45, 56, headlineColor, 2.4);
  drawAvatar(ctx, winnerImg, winnerX, cy, r, headlineColor, winner.isNave);
  drawAvatar(ctx, loserImg, loserX, cy, r, 'rgba(150,170,210,0.45)', loser.isNave);

  ctx.fillStyle = 'rgba(230,240,255,0.9)';
  ctx.font = '800 40px Orbitron';
  ctx.fillText('VS', W / 2, cy + 15);

  const drawNameplate = (combatant, x, color) => {
    ctx.fillStyle = color;
    const nameSize = fitText(ctx, combatant.name, 260, '32px Orbitron');
    ctx.font = `800 ${nameSize}px Orbitron`;
    ctx.fillText(combatant.name, x, cy + r + 55);
    if (combatant.handle) {
      ctx.fillStyle = 'rgba(160,190,230,0.55)';
      ctx.font = '400 22px "JetBrains Mono"';
      ctx.fillText(`@${combatant.handle}`, x, cy + r + 85);
    }
  };
  drawNameplate(winner, winnerX, headlineColor);
  drawNameplate(loser, loserX, 'rgba(220,230,255,0.85)');

  /* ── rondas ── */
  const roundsY = 720;
  ctx.fillStyle = 'rgba(150,200,255,0.55)';
  ctx.font = '600 22px "JetBrains Mono"';
  ctx.fillText('RONDAS DISPUTADAS', W / 2, roundsY);
  ctx.fillStyle = '#38cdf0';
  ctx.font = '800 54px Orbitron';
  ctx.fillText(String(rounds), W / 2, roundsY + 55);

  /* ── tabla comparativa ── */
  let rowY = 850;
  const rowH = 100;
  ctx.strokeStyle = 'rgba(56,205,240,0.14)';
  ctx.lineWidth = 1;
  for (const row of rows) {
    ctx.beginPath();
    ctx.moveTo(90, rowY - rowH / 2 + 10);
    ctx.lineTo(W - 90, rowY - rowH / 2 + 10);
    ctx.stroke();

    ctx.textAlign = 'center';
    ctx.font = '800 44px Orbitron';
    ctx.fillStyle = headlineColor;
    ctx.fillText(String(row.left), winnerX, rowY + 16);
    ctx.fillStyle = 'rgba(220,230,255,0.85)';
    ctx.fillText(String(row.right), loserX, rowY + 16);

    drawIcon(ctx, row.icon, W / 2, rowY - 22, 30, row.color, 2.2);
    ctx.fillStyle = 'rgba(160,190,230,0.6)';
    ctx.font = '600 18px "JetBrains Mono"';
    ctx.fillText(row.label, W / 2, rowY + 26);

    rowY += rowH;
  }

  /* ── destacados del ganador (horizontal) ── */
  if (winnerHighlights) {
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(150,200,255,0.55)';
    ctx.font = '600 22px "JetBrains Mono"';
    ctx.fillText('DESTACADOS DEL GANADOR', W / 2, rowY + 30);

    const colY = rowY + 160;
    const colXs = [W * 0.2, W / 2, W * 0.8];
    const cols = [
      {
        icon: 'sword', color: '#ff7043',
        value: winnerHighlights.topAction ? String(winnerHighlights.topAction.dmg) : '0',
        label: 'MAYOR DAÑO',
        detail: winnerHighlights.topAction?.name ?? 'Sin golpes efectivos',
      },
      {
        icon: 'shield', color: '#38cdf0',
        value: String(winnerHighlights.blocks),
        label: 'GOLPES BLOQUEADOS',
        detail: null,
      },
      {
        icon: 'plus', color: '#10b981',
        value: `${winnerHighlights.hp}/${winnerHighlights.maxHp}`,
        label: 'VIDA FINAL',
        detail: null,
      },
    ];

    cols.forEach((col, i) => {
      const x = colXs[i];
      drawIcon(ctx, col.icon, x, colY - 68, 30, col.color, 2.2);
      ctx.fillStyle = col.color;
      ctx.font = '800 54px Orbitron';
      ctx.fillText(col.value, x, colY);
      ctx.fillStyle = 'rgba(160,190,230,0.7)';
      ctx.font = '600 21px "JetBrains Mono"';
      ctx.fillText(col.label, x, colY + 36);
      if (col.detail) {
        ctx.fillStyle = 'rgba(160,190,230,0.45)';
        const size = fitText(ctx, col.detail, 260, '17px "JetBrains Mono"', 13);
        ctx.font = `400 ${size}px "JetBrains Mono"`;
        ctx.fillText(col.detail, x, colY + 62);
      }
    });

    rowY = colY + 100;
  }

  /* ── ubicación del encuentro (planeta / lugar) ── */
  if (location) {
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(150,200,255,0.55)';
    ctx.font = '600 22px "JetBrains Mono"';
    ctx.fillText('UBICACIÓN DEL ENCUENTRO', W / 2, rowY + 30);

    const locCols = [
      { label: 'PLANETA', value: location.planeta, img: planetaImg, rounded: false },
      { label: 'LUGAR', value: location.lugar, img: lugarImg, rounded: true },
    ].filter(c => c.value);
    const locXs = locCols.length === 1 ? [W / 2] : [W * 0.3, W * 0.7];
    const imgSize = 200;
    const imgY = rowY + 65 + imgSize / 2;

    locCols.forEach((col, i) => {
      const x = locXs[i];
      if (col.rounded) {
        drawImageRounded(ctx, col.img, x, imgY, imgSize, imgSize, 16, 'rgba(56,205,240,0.5)');
      } else {
        drawImagePlain(ctx, col.img, x, imgY, imgSize, imgSize);
      }

      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(160,190,230,0.6)';
      ctx.font = '600 14px "JetBrains Mono"';
      ctx.fillText(col.label, x, imgY + imgSize / 2 + 28);
      ctx.fillStyle = 'rgba(220,230,255,0.85)';
      const size = fitText(ctx, col.value, 320, '26px Orbitron', 14);
      ctx.font = `800 ${size}px Orbitron`;
      ctx.fillText(col.value, x, imgY + imgSize / 2 + 58);
    });

    rowY = imgY + imgSize / 2 + 80;
  }

  /* ── crónica del duelo (IA) — aislada por ahora, no se invoca desde CombatCardModal ── */
  if (resumenIA) {
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(150,200,255,0.55)';
    ctx.font = '600 22px "JetBrains Mono"';
    ctx.fillText('CRÓNICA DEL DUELO', W / 2, rowY + 30);

    ctx.fillStyle = 'rgba(220,230,255,0.82)';
    ctx.font = '400 27px "JetBrains Mono"';
    wrapText(ctx, resumenIA, W / 2, rowY + 80, W - 200, 38);
  }

  /* ── pie ── */
  const dateStr = new Date().toLocaleDateString('es-CL', { day: '2-digit', month: 'long', year: 'numeric' });
  ctx.fillStyle = 'rgba(120,150,190,0.5)';
  ctx.font = '400 20px "JetBrains Mono"';
  ctx.fillText(`Generado en NÉXUS — ${dateStr}`, W / 2, H - 50);

  return canvas;
}

const STAT_ROWS = (leftVal, rightVal) => [
  { icon: 'sword', label: 'DAÑO INFLIGIDO', color: '#ff7043', left: leftVal.dmgDealt, right: rightVal.dmgDealt },
  { icon: 'plus', label: 'CURACIÓN TOTAL', color: '#10b981', left: leftVal.healDone, right: rightVal.healDone },
  { icon: 'zap', label: 'GOLPES CRÍTICOS', color: '#E6B325', left: leftVal.crits, right: rightVal.crits },
];

/** Dibuja la tarjeta de resolución de un combate PvP y devuelve el canvas listo para exportar. */
export async function drawCombatCard(combat, resumenIA) {
  const summary = summarizeCombat(combat);
  const isFled = combat.status === 'fled_attacker' || combat.status === 'fled_defender';
  const winnerSide = combat.status === 'attacker_won' || combat.status === 'fled_defender' ? 'attacker' : 'defender';
  const loserSide = winnerSide === 'attacker' ? 'defender' : 'attacker';
  const winnerData = combat[winnerSide];
  const loserData = combat[loserSide];

  const winner = {
    name: winnerData.name, handle: winnerData.handle, isNave: winnerData.es_nave,
    imageSrc: mediaUrl(winnerData.es_nave ? winnerData.nave_imagen : winnerData.photo_url),
  };
  const loser = {
    name: loserData.name, handle: loserData.handle, isNave: loserData.es_nave,
    imageSrc: mediaUrl(loserData.es_nave ? loserData.nave_imagen : loserData.photo_url),
  };
  const subtitle = isFled
    ? `${loser.name} huyó del combate`
    : `vence a ${loser.name} en un duelo por turnos`;

  const winnerSummary = summary[winnerSide];
  const winnerHighlights = {
    topAction: winnerSummary.topAction,
    blocks: winnerSummary.blocks,
    hp: combat[`${winnerSide}_hp`],
    maxHp: winnerData.vida_max ?? winnerData.stats?.vida ?? combat[`${winnerSide}_hp`],
  };

  return renderResultCard({
    winner, loser, rounds: summary.rounds, subtitle,
    rows: STAT_ROWS(summary[winnerSide], summary[loserSide]),
    resumenIA, winnerHighlights,
  });
}

/** Dibuja la tarjeta de resolución de un combate contra NPC (o encuentro naval) y devuelve el canvas. */
export async function drawNpcCombatCard({ phase, player, npc, log, ronda, naveMode, planetaNombre, lugarNombre, planetaImagen, lugarImagen }) {
  const summary = summarizeNpcLog(log);
  const playerWon = phase === 'victory';

  const playerCombatant = {
    name: player.nombre, handle: null, isNave: naveMode,
    imageSrc: mediaUrl(player.photo),
  };
  const npcCombatant = {
    name: npc.nombre, handle: null, isNave: naveMode,
    imageSrc: mediaUrl(npc.imagen_mini) || mediaUrl(npc.imagen),
  };
  const winner = playerWon ? playerCombatant : npcCombatant;
  const loser = playerWon ? npcCombatant : playerCombatant;
  const subtitle = `vence a ${loser.name} en ${naveMode ? 'combate espacial' : 'combate'}`;
  const location = (planetaNombre || lugarNombre)
    ? {
        planeta: planetaNombre, lugar: lugarNombre,
        planetaImg: mediaUrl(planetaImagen), lugarImg: mediaUrl(lugarImagen),
      }
    : null;

  return renderResultCard({
    winner, loser, rounds: summary.rounds ?? ronda, subtitle,
    rows: STAT_ROWS(playerWon ? summary.player : summary.npc, playerWon ? summary.npc : summary.player),
    location,
  });
}

const RAID_STATUS_LABEL = { activo: 'SOBREVIVIÓ', huido: 'HUYÓ', derrotado: 'CAYÓ' };
const RAID_STATUS_COLOR = { activo: '#10b981', huido: '#E6B325', derrotado: '#ff6b6b' };

/** Dibuja la tarjeta de resolución de un combate RAID (grupo vs jefe) y devuelve el canvas listo para exportar. */
export async function drawRaidCombatCard(raid) {
  await ensureFonts();

  const won = raid.status === 'ganado';
  const players = [...raid.jugadores].sort((a, b) => b.dano_al_jefe - a.dano_al_jefe);

  const W = 1080;
  const rowH = 118;
  const rosterTop = 900;
  const H = rosterTop + 70 + players.length * rowH + 110;
  const DPR = 2;
  const canvas = document.createElement('canvas');
  canvas.width = W * DPR;
  canvas.height = H * DPR;
  const ctx = canvas.getContext('2d');
  ctx.scale(DPR, DPR);

  const [npcImg, ...playerImgs] = await Promise.all([
    loadImage(mediaUrl(raid.npc.imagen_mini) || mediaUrl(raid.npc.imagen)),
    ...players.map(p => loadImage(mediaUrl(p.photo_url))),
  ]);
  const location = await loadRaidLocation(raid.lugar_id);
  const [planetaImg, lugarImg] = location
    ? await Promise.all([
        loadImage(location.planetaImg),
        loadImage(location.lugarImg),
      ])
    : [null, null];

  /* ── fondo ── */
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#070d1c');
  bg.addColorStop(1, '#01030a');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  ctx.save();
  ctx.filter = 'blur(70px)';
  const glow = ctx.createRadialGradient(W / 2, 480, 40, W / 2, 480, 420);
  glow.addColorStop(0, won ? 'rgba(56,205,240,0.16)' : 'rgba(255,45,69,0.14)');
  glow.addColorStop(1, 'rgba(56,205,240,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);
  ctx.restore();

  ctx.strokeStyle = 'rgba(56,205,240,0.06)';
  ctx.lineWidth = 1;
  for (let y = 0; y < H; y += 60) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
  for (let x = 0; x < W; x += 60) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }

  ctx.strokeStyle = 'rgba(56,205,240,0.35)';
  ctx.lineWidth = 2;
  ctx.strokeRect(16, 16, W - 32, H - 32);

  /* ── encabezado ── */
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(150,200,255,0.6)';
  ctx.font = '600 24px "JetBrains Mono"';
  ctx.fillText('N É X U S   ·   R E G I S T R O   D E   A S A L T O', W / 2, 100);

  const headlineColor = won ? '#E6B325' : '#ff6b6b';
  const headline = won ? '🏆 ¡JEFE DERROTADO!' : '☠ ASALTO FALLIDO';
  fitText(ctx, headline, W - 160, '62px Orbitron');
  ctx.fillStyle = headlineColor;
  ctx.fillText(headline, W / 2, 200);

  ctx.fillStyle = 'rgba(220,230,255,0.75)';
  ctx.font = '400 28px "JetBrains Mono"';
  ctx.fillText(won ? `El grupo vence a ${raid.npc.nombre}` : `El grupo cae ante ${raid.npc.nombre}`, W / 2, 245);

  /* ── jefe ── */
  const cy = 460;
  const r = 130;
  if (won) drawIcon(ctx, 'crown', W / 2, cy - r - 45, 56, headlineColor, 2.4);
  drawAvatar(ctx, npcImg, W / 2, cy, r, won ? 'rgba(150,170,210,0.45)' : '#ff2d45', false);

  if (location) {
    const sideY = cy - 18;
    const locGap = 250;
    const planetX = W / 2 - locGap;
    const placeX = W / 2 + locGap;
    const left = [
      { label: 'PLANETA', value: location.planeta, img: planetaImg, rounded: false, x: planetX },
      { label: 'LUGAR', value: location.lugar, img: lugarImg, rounded: true, x: placeX },
    ].filter((col) => col.value);

    left.forEach((col) => {
      const isLeft = col.label === 'PLANETA';
      const imgSize = 84;
      const imgCx = isLeft ? planetX : placeX;
      const imgCy = sideY - 2;

      if (col.rounded) {
        drawImageRounded(ctx, col.img, imgCx, imgCy, imgSize, imgSize, 14, 'rgba(56,205,240,0.5)');
      } else {
        drawImagePlain(ctx, col.img, imgCx, imgCy, imgSize, imgSize);
      }

      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(160,190,230,0.6)';
      ctx.font = '600 12px "JetBrains Mono"';
      ctx.fillText(col.label, imgCx, imgCy + 76);
      ctx.fillStyle = 'rgba(220,230,255,0.9)';
      const size = fitText(ctx, col.value, 170, '20px Orbitron', 11);
      ctx.font = `800 ${size}px Orbitron`;
      ctx.fillText(col.value, imgCx, imgCy + 100);
    });
  }

  ctx.fillStyle = 'rgba(230,240,255,0.9)';
  const bossNameSize = fitText(ctx, raid.npc.nombre, 500, '32px Orbitron');
  ctx.font = `800 ${bossNameSize}px Orbitron`;
  ctx.fillText(raid.npc.nombre, W / 2, cy + r + 55);

  ctx.fillStyle = 'rgba(160,190,230,0.55)';
  ctx.font = '400 22px "JetBrains Mono"';
  ctx.fillText(`${Math.max(0, raid.npc.hp)}/${raid.npc.max_hp} VIDA`, W / 2, cy + r + 85);

  /* ── rondas ── */
  const roundsY = 720;
  ctx.fillStyle = 'rgba(150,200,255,0.55)';
  ctx.font = '600 22px "JetBrains Mono"';
  ctx.fillText('RONDAS DISPUTADAS', W / 2, roundsY);
  ctx.fillStyle = '#38cdf0';
  ctx.font = '800 54px Orbitron';
  ctx.fillText(String(raid.ronda ?? 1), W / 2, roundsY + 55);

  /* ── roster de combatientes (ordenado por daño infligido al jefe) ── */
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(150,200,255,0.55)';
  ctx.font = '600 22px "JetBrains Mono"';
  ctx.fillText('COMBATIENTES', W / 2, rosterTop);

  let rowY = rosterTop + 50;
  players.forEach((p, i) => {
    const rowCy = rowY + rowH / 2 - 20;
    const topDamage = i === 0 && p.dano_al_jefe > 0;

    drawAvatar(ctx, playerImgs[i], 130, rowCy, 46, topDamage ? headlineColor : 'rgba(150,170,210,0.4)', false);
    if (topDamage) drawIcon(ctx, 'crown', 130, rowCy - 46 - 26, 26, headlineColor, 2);

    ctx.textAlign = 'left';
    ctx.fillStyle = 'rgba(230,240,255,0.92)';
    const nameSize = fitText(ctx, p.name, 320, '28px Orbitron');
    ctx.font = `800 ${nameSize}px Orbitron`;
    ctx.fillText(p.name, 200, rowCy - 8);

    ctx.fillStyle = RAID_STATUS_COLOR[p.status] ?? 'rgba(160,190,230,0.6)';
    ctx.font = '600 16px "JetBrains Mono"';
    ctx.fillText(RAID_STATUS_LABEL[p.status] ?? p.status.toUpperCase(), 200, rowCy + 22);

    ctx.textAlign = 'center';
    drawIcon(ctx, 'sword', 700, rowCy - 16, 26, '#ff7043', 2.2);
    ctx.fillStyle = '#ff7043';
    ctx.font = '800 32px Orbitron';
    ctx.fillText(String(p.dano_al_jefe), 700, rowCy + 20);
    ctx.fillStyle = 'rgba(160,190,230,0.55)';
    ctx.font = '600 14px "JetBrains Mono"';
    ctx.fillText('DAÑO AL JEFE', 700, rowCy + 42);

    const alive = p.hp > 0 && p.status !== 'derrotado';
    drawIcon(ctx, 'plus', 900, rowCy - 16, 26, alive ? '#10b981' : '#ff6b6b', 2.2);
    ctx.fillStyle = alive ? '#10b981' : '#ff6b6b';
    ctx.font = '800 28px Orbitron';
    ctx.fillText(`${Math.max(0, p.hp)}/${p.max_hp}`, 900, rowCy + 20);
    ctx.fillStyle = 'rgba(160,190,230,0.55)';
    ctx.font = '600 14px "JetBrains Mono"';
    ctx.fillText('VIDA FINAL', 900, rowCy + 42);

    ctx.strokeStyle = 'rgba(56,205,240,0.14)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(90, rowY + rowH - 8);
    ctx.lineTo(W - 90, rowY + rowH - 8);
    ctx.stroke();

    rowY += rowH;
  });

  /* ── pie ── */
  const dateStr = new Date().toLocaleDateString('es-CL', { day: '2-digit', month: 'long', year: 'numeric' });
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(120,150,190,0.5)';
  ctx.font = '400 20px "JetBrains Mono"';
  ctx.fillText(`Generado en NÉXUS — ${dateStr}`, W / 2, H - 50);

  return canvas;
}

/**
 * Panel compartido: genera y muestra la imagen resultante de `generate()` al
 * montarse, con opciones para descargarla o compartirla directamente (Web
 * Share API, disponible en navegadores móviles — cae al link de descarga si
 * no aplica). `generate` es una función sin argumentos que devuelve el canvas
 * (así el mismo panel sirve tanto para combates PvP como contra NPC).
 */
function ResultCardModal({ generate, fileName, onClose }) {
  const [dataUrl, setDataUrl] = useState(null);
  const [error, setError] = useState(false);
  const cancelledRef = useRef(false);

  useEffect(() => {
    cancelledRef.current = false;
    generate()
      .then((canvas) => { if (!cancelledRef.current) setDataUrl(canvas.toDataURL('image/png')); })
      .catch(() => { if (!cancelledRef.current) setError(true); });
    return () => { cancelledRef.current = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const download = () => {
    if (!dataUrl) return;
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = fileName;
    a.click();
  };

  const share = async () => {
    if (!dataUrl) return;
    try {
      const blob = await (await fetch(dataUrl)).blob();
      const file = new File([blob], fileName, { type: 'image/png' });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: 'Combate NÉXUS' });
        return;
      }
    } catch { /* cancelado por el usuario o no soportado — cae a descarga */ }
    download();
  };

  const canShareFiles = typeof navigator !== 'undefined' && !!navigator.share;
  const showClose = !!dataUrl;
  const showFallbackClose = error;

  return createPortal(
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9500, display: 'flex',
      alignItems: 'center', justifyContent: 'center', padding: 20,
      background: 'rgba(2,6,16,0.88)', backdropFilter: 'blur(6px)',
    }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, maxHeight: '94vh' }}>
        {error ? (
          <div style={{ color: '#ff6b6b', fontFamily: 'var(--font-data)', fontSize: 12 }}>
            No se pudo generar la tarjeta.
          </div>
        ) : !dataUrl ? (
          <div style={{
            width: 260, height: 325, display: 'grid', placeItems: 'center',
            color: 'var(--holo)', fontFamily: 'var(--font-data)', fontSize: 11, letterSpacing: '0.14em',
          }}>
            GENERANDO TARJETA…
          </div>
        ) : (
          <img src={dataUrl} alt="Tarjeta de resolución de combate" style={{
            maxWidth: 'min(86vw, 360px)', maxHeight: '72vh', borderRadius: 14,
            boxShadow: '0 0 40px rgba(56,205,240,0.25)', display: 'block',
          }} />
        )}
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
          {(showClose || showFallbackClose) && (
            <button className="nx-btn nx-btn-ghost" onClick={onClose}>Cerrar</button>
          )}
          {dataUrl && (
            <>
              <button className="nx-btn nx-btn-accent" onClick={download}>⬇ Descargar</button>
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

/**
 * Pide la crónica del duelo generada por IA (cacheada en el backend tras la
 * primera llamada). Aislada por ahora — no la invoca `CombatCardModal`; el
 * texto generado no convenció y se reemplazó por los destacados del ganador
 * (ver `winnerHighlights` en `drawCombatCard`). Se deja lista por si se
 * retoma a futuro: `drawCombatCard(combat, resumen)` ya soporta pintarla.
 */
function fetchResumenIA(combatId) {
  const token = localStorage.getItem('nx-token');
  return fetch(`/api/pvp/${combatId}/resumen-ia`, {
    method: 'POST',
    headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
  })
    .then((r) => (r.ok ? r.json() : null))
    .then((d) => d?.resumen ?? null)
    .catch(() => null);
}
// eslint-disable-next-line no-unused-vars -- ver comentario arriba, uso diferido
void fetchResumenIA;

/** Tarjeta de resolución para un combate PvP (ver PvpCombatScreen.jsx). */
export default function CombatCardModal({ combat, onClose }) {
  return (
    <ResultCardModal
      generate={() => drawCombatCard(combat)}
      fileName={`nexus-combate-${combat.id}.png`}
      onClose={onClose}
    />
  );
}

/** Tarjeta de resolución para un combate contra NPC / encuentro naval (ver NpcCombatScreen.jsx). */
export function NpcCombatCardModal({ phase, player, npc, log, ronda, naveMode, planetaNombre, lugarNombre, planetaImagen, lugarImagen, onClose }) {
  return (
    <ResultCardModal
      generate={() => drawNpcCombatCard({ phase, player, npc, log, ronda, naveMode, planetaNombre, lugarNombre, planetaImagen, lugarImagen })}
      fileName={`nexus-combate-${(npc?.nombre ?? 'npc').toLowerCase().replace(/\s+/g, '-')}.png`}
      onClose={onClose}
    />
  );
}

/** Tarjeta de resolución para un combate RAID (grupo vs jefe) — ver RaidCombatScreen.jsx. */
export function RaidCombatCardModal({ raid, onClose }) {
  return (
    <ResultCardModal
      generate={() => drawRaidCombatCard(raid)}
      fileName={`nexus-raid-${(raid?.npc?.nombre ?? 'jefe').toLowerCase().replace(/\s+/g, '-')}.png`}
      onClose={onClose}
    />
  );
}
