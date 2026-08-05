/*
 * Tirada de cambio de estancia/forma para los combates que se resuelven en el cliente
 * (NpcCombatScreen, HordaCombatScreen). Espejo de App\Support\Combat\TiradaEstancia —
 * si cambia una fórmula, actualizar la otra.
 *
 * Al cambiar de forma se tira 2d6 y se suma la Iniciativa: si INI + 2d6 >= 10 el cambio NO
 * consume el turno y el jugador puede realizar otra acción. Si falla, la forma igual queda
 * cambiada (es la acción del turno) y el turno termina como siempre.
 *
 * Los topes de Iniciativa de esta mecánica son FIJOS, no salen de Configuracion: 4 por
 * asignación y 5 sumando equipo -eso ya viene resuelto por el backend en
 * `player.iniciativa_estancia`- más 7 como techo final con buffs, que se aplica acá.
 */
export const INI_ESTANCIA_CAP_BUFF = 7;
export const INI_ESTANCIA_OBJETIVO = 10;

const d6 = () => Math.floor(Math.random() * 6) + 1;

/**
 * @param {number} iniPreBuff  `player.iniciativa_estancia` (ya topado por equipo)
 * @param {number} deltaBuffs  +1 por buff de iniciativa, -1 por debuff
 */
export function tirarEstancia(iniPreBuff, deltaBuffs = 0) {
  const dado1 = d6();
  const dado2 = d6();
  const ini = Math.max(0, Math.min(INI_ESTANCIA_CAP_BUFF, (iniPreBuff ?? 0) + deltaBuffs));
  const total = dado1 + dado2 + ini;

  return { dado1, dado2, ini, total, exito: total >= INI_ESTANCIA_OBJETIVO };
}

/**
 * Solo se permite UNA tirada por turno: una tirada exitosa deja al jugador actuando de nuevo, y
 * sin este límite podría cambiar de estancia otra vez para re-tirar indefinidamente. El segundo
 * cambio del mismo turno no tira y consume el turno.
 */
export function mensajeSinTirada(nombre) {
  return `${nombre} ya cambió de estancia este turno: el cambio consume su turno`;
}

/** Línea de log con el formato 2d6(a+b)+INI=Total que ya colorea renderDiceText. */
export function mensajeEstancia(nombre, t) {
  const cierre = t.exito
    ? `¡Cambio ágil! ${nombre} conserva su turno`
    : `El cambio consume el turno de ${nombre}`;

  return `${nombre} cambia de estancia: 2d6(${t.dado1}+${t.dado2})+${t.ini}=${t.total} vs ${INI_ESTANCIA_OBJETIVO} — ${cierre}`;
}
