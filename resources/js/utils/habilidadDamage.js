/*
 * Interpreta el campo de texto `rol_habilidades.damage`. Espejo de
 * App\Services\HabilidadDamageParser — si cambia una fórmula, actualizar la otra.
 * Usado por los combates que se resuelven enteramente en el cliente (NpcCombatScreen,
 * HordaCombatScreen); PvP y RAID resuelven el daño en el servidor y solo muestran
 * el texto crudo (ver SkillTooltip/Comando/EntityCard).
 *
 * Formatos admitidos:
 * - número plano ("30"): daño base fijo.
 * - dados ("1d3", "2d6", ...): tirada de N dados de M caras, sumados, como daño base.
 * - cura explícita ("C10"): cura esa cantidad de vida (self o target según `objetivo`).
 * - bono/penalización al arma ("+5", "-5"): se suma al daño base del arma equipada
 *   (objeto o sable láser) en vez de reemplazarlo.
 * - modificador de fuerza ("+F5", "-F5"): no aplica daño, solo suma/resta esa cantidad
 *   a la fuerza acumulada del objetivo (self o target según `objetivo`).
 */
export function rollDice(count, sides) {
  let total = 0;
  for (let i = 0; i < Math.max(1, count); i++) {
    total += Math.floor(Math.random() * Math.max(1, sides)) + 1;
  }
  return total;
}

export function parseHabilidadDamage(raw) {
  const str = String(raw ?? '0').trim() || '0';

  let m = str.match(/^[Cc](\d+)$/);
  if (m) return { kind: 'heal', value: parseInt(m[1], 10) };

  m = str.match(/^([+-])[Ff](\d+)$/);
  if (m) return { kind: 'force', value: (m[1] === '-' ? -1 : 1) * parseInt(m[2], 10) };

  m = str.match(/^([+-])(\d+)$/);
  if (m) return { kind: 'weapon', value: (m[1] === '-' ? -1 : 1) * parseInt(m[2], 10) };

  m = str.match(/^(\d+)[dD](\d+)$/);
  if (m) return { kind: 'dice', value: rollDice(parseInt(m[1], 10), parseInt(m[2], 10)) };

  if (/^\d+$/.test(str)) return { kind: 'flat', value: parseInt(str, 10) };

  return { kind: 'flat', value: 0 };
}

/**
 * Versión de solo lectura para UI (tooltips, fichas de impresión, previews): identifica el
 * formato y devuelve un texto corto listo para mostrar (p.ej. "2D6", "+5", "10") SIN tirar
 * dados — a diferencia de parseHabilidadDamage, que resuelve el valor final para aplicarlo
 * en combate. Cada consumidor antepone su propia etiqueta según `kind` (DMG/CURA/ARMA/FUERZA).
 */
export function describeHabilidadDamage(raw) {
  const str = String(raw ?? '0').trim() || '0';

  let m = str.match(/^[Cc](\d+)$/);
  if (m) return { kind: 'heal', display: m[1] };

  m = str.match(/^([+-])[Ff](\d+)$/);
  if (m) return { kind: 'force', display: `${m[1]}${m[2]}` };

  m = str.match(/^([+-])(\d+)$/);
  if (m) return { kind: 'weapon', display: `${m[1]}${m[2]}` };

  m = str.match(/^(\d+)[dD](\d+)$/);
  if (m) return { kind: 'dice', display: `${m[1]}D${m[2]}` };

  if (/^\d+$/.test(str)) return { kind: 'flat', display: str };

  return { kind: 'flat', display: '0' };
}
