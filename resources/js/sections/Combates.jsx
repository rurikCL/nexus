import { useState, useEffect, useRef } from 'react';
import { NX } from '../data/seed.js';
import { Icon, Panel, Btn, Chip, Avatar, TierBadge, Stat, MedalIcon, Modal, toast, ImageSlot } from '../components/ui.jsx';

/* NÉXUS — Ranking + Combates (eventos, apuestas, retar) */

/* ===================== RANKING ===================== */
export function RankingView({ S }) {
  const rk = S.ranking;
  const podium = rk.slice(0, 3);
  const rest = rk.slice(3);
  const order = [1, 0, 2]; // visual: 2º, 1º, 3º

  return (
    <div className="nx-fade" style={{ display: 'grid', gap: 18 }}>
      <Panel kicker="Temporada 3 · Liga Orbital" title="Escalera de Combate" icon="trophy"
        right={<div style={{ display: 'flex', gap: 6 }}>{Object.keys(NX.TIERS).map(k => <TierBadge key={k} tier={k} sm />)}</div>}>
        {/* Podio */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14, alignItems: 'end', marginBottom: 20 }}>
          {order.map((idx) => {
            const c = podium[idx]; if (!c) return <div key={idx} />;
            const place = idx + 1;
            const h = place === 1 ? 168 : place === 2 ? 138 : 116;
            const medal = place === 1 ? 'var(--pompeyo-oro)' : place === 2 ? '#cbd5e1' : '#cd7f32';
            return (
              <div key={c.id} className="nx-panel solid" style={{ padding: 16, textAlign: 'center', height: h, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', position: 'relative', borderColor: place === 1 ? 'var(--pompeyo-oro)' : undefined, boxShadow: place === 1 ? '0 0 30px -10px var(--pompeyo-oro)' : undefined }}>
                <div className="nx-num" style={{ position: 'absolute', top: 10, left: 0, right: 0, fontSize: place === 1 ? 30 : 22, color: medal }}>#{place}</div>
                <Avatar c={c} size={place === 1 ? 56 : 46} ring style={{ margin: '0 auto 8px' }} />
                <div style={{ fontWeight: 700, fontSize: place === 1 ? 15 : 13, color: c.id === 'you' ? 'var(--pompeyo-naranja)' : 'var(--txt)' }}>{c.name}</div>
                <div className="nx-num" style={{ fontSize: 13, color: medal, marginTop: 2 }}>{c.wins}W · {c.winrate}%</div>
              </div>
            );
          })}
        </div>

        {/* Tabla resto */}
        <div style={{ display: 'grid', gap: 6 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '36px 1fr 110px 70px 70px 90px', gap: 10, padding: '0 12px' }}>
            {['#', 'Combatiente', 'Tier', 'Récord', 'Efic.', 'Créditos'].map((h, i) => (
              <div key={h} className="nx-kicker" style={{ fontSize: 9, textAlign: i >= 3 ? 'right' : 'left' }}>{h}</div>
            ))}
          </div>
          {rest.map((c, i) => {
            const isYou = c.id === 'you';
            return (
              <div key={c.id} className="nx-panel solid" style={{ display: 'grid', gridTemplateColumns: '36px 1fr 110px 70px 70px 90px', gap: 10, padding: '10px 12px', alignItems: 'center', borderColor: isYou ? 'var(--pompeyo-naranja)' : undefined, background: isYou ? 'color-mix(in srgb, var(--pompeyo-naranja) 8%, var(--space-panel-solid))' : undefined }}>
                <span className="nx-num" style={{ fontSize: 15, color: 'var(--txt-faint)' }}>{i + 4}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                  <Avatar c={c} size={30} />
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: isYou ? 700 : 500, color: isYou ? 'var(--pompeyo-naranja)' : 'var(--txt)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.name}</div>
                    <div className="nx-data" style={{ fontSize: 10, color: 'var(--txt-faint)' }}>@{c.handle}</div>
                  </div>
                </div>
                <TierBadge tier={c.tier} sm />
                <span className="nx-num" style={{ fontSize: 13, textAlign: 'right' }}>{c.wins}-{c.losses}</span>
                <span className="nx-num" style={{ fontSize: 13, textAlign: 'right', color: 'var(--holo)' }}>{c.winrate}%</span>
                <span className="nx-num" style={{ fontSize: 13, textAlign: 'right', color: 'var(--pompeyo-oro)' }}>{(c.credits / 1000).toFixed(1)}k</span>
              </div>
            );
          })}
        </div>
      </Panel>
    </div>
  );
}

/* ===================== COMBATES ===================== */
export function CombatesView({ S }) {
  const [bet, setBet] = useState(null);     // {combat, pick}
  const [challenge, setChallenge] = useState(false);

  return (
    <div className="nx-fade" style={{ display: 'grid', gap: 18 }}>
      {/* Header acción */}
      <div className="nx-panel" style={{ padding: 16, display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
        <span style={{ color: 'var(--pompeyo-naranja)' }}><Icon name="swords" size={22} /></span>
        <div style={{ flex: 1, minWidth: 200 }}>
          <div className="nx-display" style={{ fontSize: 15 }}>Arena Orbital</div>
          <div style={{ fontSize: 12, color: 'var(--txt-dim)' }}>Apuesta con tus créditos o reta a un combatiente a un duelo oficial.</div>
        </div>
        <div className="nx-panel solid" style={{ padding: '8px 14px', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ color: 'var(--pompeyo-oro)' }}><Icon name="coin" size={16} /></span>
          <span className="nx-num" style={{ fontSize: 18, color: 'var(--pompeyo-oro)' }}>{NX.fmtCLP(S.credits)}</span>
        </div>
        <Btn kind="accent" icon="swords" onClick={() => setChallenge(true)}>Retar combate</Btn>
      </div>

      {/* Combates oficiales + apuestas */}
      <Panel kicker="Cartelera oficial" title="Combates y Apuestas" icon="target"
        right={<Chip tone="dim" icon="coin">{S.bets.length} apuestas activas</Chip>}>
        <div style={{ display: 'grid', gap: 14 }}>
          {S.combats.map((m) => <CombatCard key={m.id} m={m} S={S} onBet={(pick) => setBet({ combat: m, pick })} />)}
        </div>
      </Panel>

      {/* Mis apuestas */}
      {S.bets.length > 0 && (
        <Panel kicker="Tu cartera" title="Mis Apuestas" icon="coin">
          <div style={{ display: 'grid', gap: 10 }}>
            {S.bets.map((b) => {
              const m = S.combats.find(x => x.id === b.combatId);
              const fighter = NX.byId(b.pick === 'a' ? m.a : m.b);
              const settled = b.status !== 'abierta';
              return (
                <div key={b.id} className="nx-panel solid" style={{ padding: 12, display: 'flex', alignItems: 'center', gap: 12 }}>
                  <Avatar c={fighter} size={34} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{fighter.name}</div>
                    <div className="nx-data" style={{ fontSize: 11, color: 'var(--txt-faint)' }}>{m.event} · cuota {b.odds}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div className="nx-num" style={{ fontSize: 14, color: 'var(--pompeyo-oro)' }}>{NX.fmtCLP(b.amount)}</div>
                    <Chip tone={b.status === 'ganada' ? 'green' : b.status === 'perdida' ? 'red' : 'dim'} style={{ marginTop: 4 }}>
                      {b.status === 'abierta' ? `posible +${NX.fmtCLP(Math.round(b.amount * b.odds))}` : b.status === 'ganada' ? `ganaste +${NX.fmtCLP(Math.round(b.amount * b.odds))}` : 'perdida'}
                    </Chip>
                  </div>
                </div>
              );
            })}
          </div>
        </Panel>
      )}

      <BetModal data={bet} onClose={() => setBet(null)} S={S} />
      <ChallengeModal open={challenge} onClose={() => setChallenge(false)} S={S} />
    </div>
  );
}

export function CombatCard({ m, S, onBet }) {
  const a = NX.byId(m.a), b = NX.byId(m.b);
  const myBet = S.bets.find(x => x.combatId === m.id);
  const Fighter = ({ c, side, odds }) => (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, textAlign: 'center' }}>
      <Avatar c={c} size={52} ring />
      <div>
        <div style={{ fontWeight: 700, fontSize: 14 }}>{c.name}</div>
        <div className="nx-data" style={{ fontSize: 11, color: 'var(--txt-faint)' }}>{c.wins}W-{c.losses}L</div>
      </div>
      <button disabled={m.resolved || (myBet && myBet.pick !== side)} onClick={() => onBet(side)}
        className="nx-btn" style={{
          width: '100%', justifyContent: 'center', flexDirection: 'column', gap: 2, padding: '8px',
          borderColor: myBet && myBet.pick === side ? 'var(--pompeyo-oro)' : undefined,
          background: myBet && myBet.pick === side ? 'color-mix(in srgb, var(--pompeyo-oro) 16%, transparent)' : undefined }}>
        <span style={{ fontSize: 9, color: 'var(--txt-dim)' }}>CUOTA</span>
        <span className="nx-num" style={{ fontSize: 18, color: 'var(--holo)' }}>{odds.toFixed(2)}</span>
      </button>
    </div>
  );
  return (
    <div className="nx-panel solid" style={{ padding: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <Chip tone="dim">{m.event} · {m.round}</Chip>
        <span className="nx-data" style={{ fontSize: 11, color: m.live ? '#ff6b6b' : 'var(--txt-faint)', display: 'flex', alignItems: 'center', gap: 6 }}>
          {m.live && <span className="nx-live-dot" style={{ width: 6, height: 6 }} />}{m.live ? 'EN VIVO' : m.when}
        </span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <Fighter c={a} side="a" odds={m.oddsA} />
        <div className="nx-display" style={{ fontSize: 20, color: 'var(--pompeyo-naranja)', opacity: 0.8 }}>VS</div>
        <Fighter c={b} side="b" odds={m.oddsB} />
      </div>
      {!m.resolved ? (
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: 14 }}>
          <Btn sm kind="ghost" icon="zap" onClick={() => S.resolveCombat(m.id)}>Simular resultado</Btn>
        </div>
      ) : (
        <div style={{ textAlign: 'center', marginTop: 14, color: 'var(--green-500)' }}>
          <Chip tone="green" icon="trophy">Ganó {NX.byId(m.winner === 'a' ? m.a : m.b).name}</Chip>
        </div>
      )}
    </div>
  );
}

export function BetModal({ data, onClose, S }) {
  const [amt, setAmt] = useState(200);
  useEffect(() => { if (data) setAmt(200); }, [data]);
  if (!data) return null;
  const { combat, pick } = data;
  const fighter = NX.byId(pick === 'a' ? combat.a : combat.b);
  const odds = pick === 'a' ? combat.oddsA : combat.oddsB;
  const payout = Math.round(amt * odds);
  const QUICK = [100, 250, 500, 1000];
  const place = () => {
    if (amt > S.credits) { toast('Créditos insuficientes', { tone: 'error', icon: 'x' }); return; }
    if (amt <= 0) return;
    S.placeBet({ combatId: combat.id, pick, amount: amt, odds });
    onClose();
    toast('Apuesta registrada', { tone: 'success', icon: 'coin', desc: `${NX.fmtCLP(amt)} a ${fighter.name} · posible ${NX.fmtCLP(payout)}` });
  };
  return (
    <Modal open={!!data} onClose={onClose} kicker={`${combat.event} · cuota ${odds.toFixed(2)}`} title={`Apostar a ${fighter.name}`} width={460}>
      <div style={{ display: 'grid', gap: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, justifyContent: 'center' }}>
          <Avatar c={fighter} size={56} ring />
          <div><div style={{ fontWeight: 700, fontSize: 16 }}>{fighter.name}</div><TierBadge tier={fighter.tier} sm /></div>
        </div>
        <div>
          <label className="nx-label">Monto a apostar</label>
          <input className="nx-input nx-data" type="number" value={amt} onChange={(e) => setAmt(+e.target.value)} style={{ fontSize: 18 }} />
          <div style={{ display: 'flex', gap: 7, marginTop: 9 }}>
            {QUICK.map(q => <button key={q} className="nx-chip dim" style={{ cursor: 'pointer', flex: 1, justifyContent: 'center' }} onClick={() => setAmt(q)}>{q}</button>)}
            <button className="nx-chip dim" style={{ cursor: 'pointer', flex: 1, justifyContent: 'center' }} onClick={() => setAmt(S.credits)}>MAX</button>
          </div>
        </div>
        <div className="nx-panel" style={{ padding: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div><div className="nx-kicker">Ganancia potencial</div><div className="nx-num" style={{ fontSize: 24, color: 'var(--pompeyo-oro)' }}>{NX.fmtCLP(payout)}</div></div>
          <div style={{ textAlign: 'right' }}><div className="nx-kicker">Tu saldo</div><div className="nx-num" style={{ fontSize: 16, color: amt > S.credits ? '#ff6b6b' : 'var(--txt)' }}>{NX.fmtCLP(S.credits)}</div></div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <Btn onClick={onClose}>Cancelar</Btn>
          <Btn kind="gold" icon="coin" onClick={place} disabled={amt > S.credits || amt <= 0}>Confirmar apuesta</Btn>
        </div>
      </div>
    </Modal>
  );
}

export function ChallengeModal({ open, onClose, S }) {
  const opponents = NX.combatants.filter(c => c.id !== 'you');
  const [oppId, setOppId] = useState(opponents[0].id);
  const [stake, setStake] = useState(300);
  const [msg, setMsg] = useState('');
  useEffect(() => { if (open) { setOppId(opponents[0].id); setStake(300); setMsg(''); } }, [open]);
  if (!open) return null;
  const opp = NX.byId(oppId);
  const submit = () => {
    if (stake > S.credits) { toast('No tienes créditos para esa apuesta', { tone: 'error', icon: 'x' }); return; }
    S.createChallenge(oppId, stake);
    onClose();
    toast(`Desafío enviado a ${opp.name}`, { tone: 'success', icon: 'swords', desc: 'Combate oficial pendiente de aceptación' });
  };
  return (
    <Modal open={open} onClose={onClose} kicker="Duelo oficial" title="Retar a Combate" width={480}>
      <div style={{ display: 'grid', gap: 16 }}>
        <div>
          <label className="nx-label">Oponente</label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px,1fr))', gap: 8, maxHeight: 200, overflow: 'auto', paddingRight: 4 }}>
            {opponents.map(c => (
              <button key={c.id} onClick={() => setOppId(c.id)} className="nx-panel solid" style={{ padding: 10, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, borderColor: oppId === c.id ? 'var(--pompeyo-naranja)' : undefined, background: oppId === c.id ? 'color-mix(in srgb, var(--pompeyo-naranja) 12%, var(--space-panel-solid))' : undefined }}>
                <Avatar c={c} size={30} />
                <div style={{ minWidth: 0, textAlign: 'left' }}>
                  <div style={{ fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.name}</div>
                  <div className="nx-data" style={{ fontSize: 9, color: 'var(--txt-faint)' }}>{c.wins}W-{c.losses}L</div>
                </div>
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="nx-label">Apuesta del duelo (créditos)</label>
          <input className="nx-input nx-data" type="number" value={stake} onChange={(e) => setStake(+e.target.value)} style={{ fontSize: 16 }} />
        </div>
        <div>
          <label className="nx-label">Mensaje (opcional)</label>
          <input className="nx-input" value={msg} onChange={(e) => setMsg(e.target.value)} placeholder="Te espero en la arena..." />
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <Btn onClick={onClose}>Cancelar</Btn>
          <Btn kind="accent" icon="swords" onClick={submit} disabled={stake > S.credits}>Enviar desafío</Btn>
        </div>
      </div>
    </Modal>
  );
}

