function formatRewardLabel(reward) {
  if (!reward) return null;

  if (reward.tipo === 'creditos') {
    return reward.valor ? `${reward.valor} créditos` : 'Créditos';
  }

  if (reward.tipo === 'habilidad') {
    return reward.habilidad?.nombre ?? reward.nombre ?? 'Habilidad';
  }

  if (reward.tipo === 'titulo' || reward.tipo === 'insignia') {
    return reward.nombre ?? 'Título';
  }

  if (reward.tipo === 'objeto') {
    return reward.objeto?.nombre ?? reward.nombre ?? 'Objeto';
  }

  return reward.nombre ?? null;
}

function rewardLinesFromResponse(data) {
  const missionRewards = Array.isArray(data?.mision?.recompensas) ? data.mision.recompensas : [];
  const lines = [];

  missionRewards.forEach((reward) => {
    const label = formatRewardLabel(reward);
    if (!label) return;
    lines.push(label);
  });

  if (!lines.length) {
    if (Number(data?.creditos_otorgados) > 0) {
      lines.push(`${data.creditos_otorgados} créditos`);
    }

    (data?.titulos_otorgados ?? []).forEach((t) => {
      const label = t?.nombre ?? t?.tipo ?? null;
      if (label) lines.push(label);
    });

    if ((data?.habilidades_aprendidas ?? []).length > 0) {
      lines.push('Habilidad desbloqueada');
    }

    if ((data?.objetos_otorgados ?? []).length > 0) {
      lines.push('Objeto recibido');
    }
  }

  return lines.filter(Boolean);
}

export function buildMissionCompletionTransmision(data) {
  const rewardLines = rewardLinesFromResponse(data);
  if (!rewardLines.length) return null;

  return {
    tone: 'holo',
    icon: 'check',
    title: 'Misión completada',
    body: data?.mision?.nombre
      ? `${data.mision.nombre} ha sido completada. Recompensa recibida: ${rewardLines[0]}.`
      : `La misión fue completada con éxito. Recompensa recibida: ${rewardLines[0]}.`,
    reward_title: 'Recompensa recibida',
    reward_highlight: rewardLines[0],
    reward_summary: rewardLines.length > 1 ? rewardLines.slice(1).join(' · ') : null,
    reward_lines: rewardLines,
  };
}
