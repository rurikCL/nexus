function summarize(items, limit = 3) {
  const list = (items ?? []).filter(Boolean);
  if (list.length === 0) return '';
  if (list.length <= limit) return list.join(' · ');
  return `${list.slice(0, limit).join(' · ')} +${list.length - limit}`;
}

function formatReward(reward) {
  if (!reward) return null;

  if (reward.tipo === 'creditos' || reward.tipo === 'créditos') {
    const valor = reward.valor ?? reward.amount ?? reward.cantidad ?? 0;
    return `💰 +${valor} créditos`;
  }

  if (reward.tipo === 'habilidad' && reward.habilidad?.nombre) {
    return `🎓 Habilidad: ${reward.habilidad.nombre}`;
  }

  if (reward.tipo === 'objeto' && reward.objeto?.nombre) {
    const qty = reward.valor > 1 ? ` ×${reward.valor}` : '';
    return `📦 Objeto: ${reward.objeto.nombre}${qty}`;
  }

  if (reward.nombre) {
    const qty = reward.valor > 0 ? ` ×${reward.valor}` : '';
    return `${reward.nombre}${qty}`;
  }

  return null;
}

export function buildMissionCompletionTransmission(mision, { hitosOtorgados = [] } = {}) {
  const objetivos = (mision?.objetivos ?? [])
    .filter(Boolean)
    .map((obj) => obj?.nombre ? `✓ ${obj.nombre}` : null)
    .filter(Boolean);

  const recompensas = (mision?.recompensas ?? [])
    .map(formatReward)
    .filter(Boolean);

  const titulo = mision?.nombre ?? 'Misión';
  const rewardHighlight = recompensas[0] ?? 'Recompensa registrada';
  const rewardSummary = summarize(recompensas.slice(1), 2);
  const objectivesSummary = summarize(objetivos, 3);

  return {
    tone: 'holo',
    icon: 'check',
    kicker: 'MISIÓN COMPLETADA',
    title: titulo,
    body: mision?.mision ?? mision?.descripcion ?? '',
    reward_title: recompensas.length ? 'RECOMPENSA A RECIBIR' : 'SIN RECOMPENSA DEFINIDA',
    reward_highlight: rewardHighlight,
    reward_summary: rewardSummary,
    reward_lines: recompensas,
    objectives_title: objetivos.length ? 'OBJETIVOS CUMPLIDOS' : 'OBJETIVOS',
    objectives_lines: objetivos,
    objectives_summary: objectivesSummary,
    hitos: hitosOtorgados,
  };
}

export function buildMissionReadyTransmission(mision) {
  const objetivos = (mision?.objetivos ?? [])
    .filter(Boolean)
    .map((obj) => obj?.nombre ? `• ${obj.nombre}` : null)
    .filter(Boolean);

  const recompensas = (mision?.recompensas ?? [])
    .map(formatReward)
    .filter(Boolean);

  return {
    tone: 'orange',
    icon: 'zap',
    kicker: 'MISIÓN LISTA PARA COMPLETAR',
    title: mision?.nombre ?? 'Misión',
    body: mision?.mision ?? mision?.descripcion ?? '',
    reward_title: recompensas.length ? 'RECOMPENSA ESPERANDO' : 'SIN RECOMPENSA DEFINIDA',
    reward_highlight: recompensas[0] ?? 'Sin recompensa visible',
    reward_summary: summarize(recompensas.slice(1), 2),
    reward_lines: recompensas,
    objectives_title: objetivos.length ? 'OBJETIVOS DISPONIBLES' : 'OBJETIVOS',
    objectives_lines: objetivos,
    objectives_summary: summarize(objetivos, 3),
  };
}
