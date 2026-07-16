const STAT_LABEL = { ataque: 'Ataque', defensa: 'Defensa', punteria: 'Puntería', movimiento: 'Movimiento', iniciativa: 'Iniciativa' };
const formaLabel = (f) => ['―', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII'][f] ?? String(f);

const Chip = ({ color = 'rgba(200,225,255,0.7)', children }) => (
  <span style={{
    display: 'inline-flex', alignItems: 'center', fontSize: 8.5, fontFamily: 'var(--font-data)',
    padding: '2px 6px', borderRadius: 4, background: `${color}18`, border: `1px solid ${color}45`, color,
    whiteSpace: 'nowrap',
  }}>{children}</span>
);

/** Tooltip con el detalle de una habilidad de combate (daño, costo, cooldown, buff/debuff, efecto). */
export function SkillTooltip({ hab }) {
  const habBuff   = Array.isArray(hab.buff)   ? hab.buff   : [];
  const habDebuff = Array.isArray(hab.debuff) ? hab.debuff : [];
  const isSelf    = hab.objetivo === 'self';
  const rondas    = hab.duracion ?? 2;
  const rondaTxt  = `${rondas} ronda${rondas === 1 ? '' : 's'}`;

  return (
    <div style={{
      position: 'absolute', bottom: 'calc(100% + 9px)', left: '50%', transform: 'translateX(-50%)',
      width: 210, zIndex: 40, pointerEvents: 'none',
      background: 'rgba(6,12,26,0.97)', backdropFilter: 'blur(8px)',
      border: '1px solid rgba(56,205,240,0.35)', borderRadius: 10,
      padding: '10px 12px', boxShadow: '0 10px 28px rgba(0,0,0,0.55)',
      animation: 'nx-fade-up 0.15s ease both', textAlign: 'left',
    }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: '#fff', marginBottom: 6, letterSpacing: '0.02em' }}>{hab.nombre}</div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 7 }}>
        <Chip color="#a78bfa">{hab.tipo === 'melee' ? '⚔ Cuerpo a cuerpo' : hab.tipo === 'nave' ? '🚀 Naval' : '◎ A distancia'}</Chip>
        {hab.forma > 0 && <Chip color="#a78bfa">Forma {formaLabel(hab.forma)}</Chip>}
        <Chip color="#38cdf0">⚡ {hab.costo_fuerza}</Chip>
        {hab.cooldown > 0 && <Chip color="#E6B325">CD {hab.cooldown}t</Chip>}
        {!isSelf && <Chip color="#ff7043">DMG {hab.damage}</Chip>}
        {!!hab.damage_escudo && (
          hab.damage_escudo > 0
            ? <Chip color="#ff7043">DMG ESC +{hab.damage_escudo}</Chip>
            : <Chip color="#38cdf0">CURA ESC +{-hab.damage_escudo}</Chip>
        )}
        {!!hab.damage_perforante && <Chip color="#8aa0c0">DMG PERF +{hab.damage_perforante}</Chip>}
      </div>

      {hab.efecto && (
        <div style={{
          fontSize: 9.5, color: 'rgba(200,225,255,0.8)', lineHeight: 1.45,
          marginBottom: (habBuff.length || habDebuff.length) ? 7 : 0,
        }}>{hab.efecto}</div>
      )}

      {habBuff.length > 0 && (
        <div style={{ fontSize: 9, color: '#10b981', lineHeight: 1.5 }}>
          ▲ Buff a ti ({rondaTxt}): {habBuff.map(s => STAT_LABEL[s] ?? s).join(', ')}
        </div>
      )}
      {habDebuff.length > 0 && (
        <div style={{ fontSize: 9, color: '#ff6b6b', lineHeight: 1.5 }}>
          ▼ Debuff al objetivo si impacta ({rondaTxt}): {habDebuff.map(s => STAT_LABEL[s] ?? s).join(', ')}
        </div>
      )}

      {/* Flecha apuntando al botón */}
      <div style={{
        position: 'absolute', top: '100%', left: '50%', transform: 'translateX(-50%)',
        width: 0, height: 0,
        borderLeft: '6px solid transparent', borderRight: '6px solid transparent',
        borderTop: '6px solid rgba(56,205,240,0.35)',
      }} />
      <div style={{
        position: 'absolute', top: 'calc(100% - 1.5px)', left: '50%', transform: 'translateX(-50%)',
        width: 0, height: 0,
        borderLeft: '5px solid transparent', borderRight: '5px solid transparent',
        borderTop: '5px solid rgba(6,12,26,0.97)',
      }} />
    </div>
  );
}
