/* NÉXUS — Referencia estática de Buffs/Debuffs de stat y Estados de combate.
   Espeja las reglas implementadas en app/Support/Combat/AplicaEstadosCombate.php
   (y su mirror en NpcCombatScreen.jsx). Solo texto de referencia para el
   Catálogo — no se usa en la resolución real del combate. */

export const CATEGORIA_ESTADO_LABEL = {
  control: 'Control',
  reaccion: 'Reacción',
  dot: 'Daño por turno',
  hot: 'Curación por turno',
  debuff: 'Debuff especial',
};

export const ESTADOS_COMBATE = [
  {
    id: 'paralizado', label: 'Paralizado', icon: 'clock', color: '#a78bfa', frame: 'purple',
    categoria: 'control', duracion: '1 turno + inmunidad', badge: '1T',
    resumen: 'Pierde su próximo turno por completo.',
    mecanica: 'Pierde por completo su siguiente turno: no ataca, no usa habilidad ni puede intentar huir. Al recuperarse, queda inmune a que lo vuelvan a paralizar en el intento inmediatamente siguiente.',
  },
  {
    id: 'aturdido', label: 'Aturdido', icon: 'zap', color: '#a78bfa', frame: 'purple',
    categoria: 'control', duracion: '1 turno', badge: '1T',
    resumen: 'Todas sus tiradas de dado se reducen a la mitad.',
    mecanica: 'Mientras dura, todas las tiradas de 1d20 que haga (ataque, defensa e iniciativa) se dividen a la mitad, redondeando hacia abajo.',
  },
  {
    id: 'confundido', label: 'Confundido', icon: 'ghost', color: '#a78bfa', frame: 'purple',
    categoria: 'control', duracion: '1 turno', badge: '1T',
    resumen: '50% de probabilidad de atacarse a sí mismo.',
    mecanica: 'En su próximo turno, tiene 50% de probabilidad de que su ataque se dirija hacia sí mismo en vez de hacia el objetivo previsto (igual tira los dados normalmente).',
  },
  {
    id: 'marcado', label: 'Marcado', icon: 'target', color: '#E6B325', frame: 'gold',
    categoria: 'reaccion', duracion: 'Hasta recibir el próximo ataque', badge: '∞',
    resumen: 'El próximo ataque recibido conecta automáticamente.',
    mecanica: 'El próximo ataque que reciba conecta automáticamente, sin comparar contra su defensa — salvo que el atacante saque un 1 natural, que falla igual. Se consume con ese primer ataque recibido, sin importar el resultado.',
  },
  {
    id: 'protegido', label: 'Protegido', icon: 'shield', color: '#E6B325', frame: 'gold',
    categoria: 'reaccion', duracion: 'Hasta recibir el próximo ataque', badge: '∞',
    resumen: 'El próximo ataque recibido falla automáticamente.',
    mecanica: 'El próximo ataque que reciba falla automáticamente, sin importar las tiradas de ambos bandos. Se consume con ese primer ataque recibido, sin importar el resultado.',
  },
  {
    id: 'sangrado', label: 'Sangrado', icon: 'sword', color: '#ff2d45', frame: 'danger',
    categoria: 'dot', duracion: '2 rondas', badge: '2R',
    resumen: 'Pierde 1 de vida al cierre de cada ronda.',
    mecanica: 'Al cierre de cada ronda pierde 1 punto de vida, durante 2 rondas.',
  },
  {
    id: 'envenenado', label: 'Envenenado', icon: 'flame', color: '#ff2d45', frame: 'danger',
    categoria: 'dot', duracion: '3 rondas', badge: '3R',
    resumen: 'Pierde 2 de vida al cierre de cada ronda.',
    mecanica: 'Al cierre de cada ronda pierde 2 puntos de vida, durante 3 rondas.',
  },
  {
    id: 'debilitado', label: 'Debilitado', icon: 'dumbbell', color: '#8aa0c0', frame: 'neutral',
    categoria: 'debuff', duracion: '2 rondas', badge: '2R',
    resumen: 'Su daño infligido se reduce a la mitad.',
    mecanica: 'Mientras dura, todo el daño que inflige (con ataque básico o habilidad) se reduce a la mitad, redondeando hacia abajo.',
  },
  {
    id: 'regeneracion', label: 'Regeneración', icon: 'trending', color: '#10b981', frame: 'ok',
    categoria: 'hot', duracion: '2 rondas', badge: '2R',
    resumen: 'Recupera 2 de vida al cierre de cada ronda.',
    mecanica: 'Al cierre de cada ronda recupera 2 puntos de vida (sin superar su vida máxima), durante 2 rondas.',
  },
];

/* Los 5 stats de combate que puede modificar un Buff (+1 por acumulación) o
   un Debuff (−1 por acumulación) de habilidad — ver getEffectiveStats() en
   PvpCombatController/RaidCombatController. Duración en rondas la define la
   habilidad que lo aplica (campo "duracion", 2 por defecto). */
export const STATS_COMBATE = [
  {
    id: 'ataque', label: 'Ataque', icon: 'sword', color: '#ff7043', frame: 'orange',
    resumen: 'Bono a la tirada de ataque cuerpo a cuerpo.',
    mecanica: 'Se suma al 1d20 en ataques cuerpo a cuerpo (básicos o de habilidad tipo melee). Buff: +1 por acumulación activa. Debuff: −1 por acumulación activa. Duración en rondas definida por la habilidad que lo aplica.',
  },
  {
    id: 'defensa', label: 'Defensa', icon: 'shield', color: '#38cdf0', frame: 'info',
    resumen: 'Bono a la tirada de defensa cuerpo a cuerpo.',
    mecanica: 'Se suma al 1d20 al defenderse de ataques cuerpo a cuerpo. Buff: +1 por acumulación activa. Debuff: −1 por acumulación activa. Duración en rondas definida por la habilidad que lo aplica.',
  },
  {
    id: 'punteria', label: 'Puntería', icon: 'eye', color: '#10b981', frame: 'ok',
    resumen: 'Bono a la tirada de ataque a distancia.',
    mecanica: 'Se suma al 1d20 en ataques a distancia (básicos o de habilidad tipo distancia). Buff: +1 por acumulación activa. Debuff: −1 por acumulación activa. Duración en rondas definida por la habilidad que lo aplica.',
  },
  {
    id: 'movimiento', label: 'Agilidad', icon: 'zap', color: '#a78bfa', frame: 'purple',
    resumen: 'Bono a la tirada de defensa a distancia.',
    mecanica: 'Se suma al 1d20 al defenderse (esquivar) ataques a distancia. Buff: +1 por acumulación activa. Debuff: −1 por acumulación activa. Duración en rondas definida por la habilidad que lo aplica.',
  },
  {
    id: 'iniciativa', label: 'Iniciativa', icon: 'star', color: '#E6B325', frame: 'gold',
    resumen: 'Bono a la tirada de iniciativa.',
    mecanica: 'Se suma al 1d20 de iniciativa, que decide quién actúa primero en cada ronda (y en el intento de huir). Buff: +1 por acumulación activa. Debuff: −1 por acumulación activa. Duración en rondas definida por la habilidad que lo aplica.',
  },
];
