import { useState, useEffect } from 'react';
import { NX } from '../data/seed.js';
import { toast } from '../components/ui.jsx';

const NX_LS = 'nx-state-v3';

function loadState() {
  try { return JSON.parse(localStorage.getItem(NX_LS)) || {}; } catch { return {}; }
}
function saveState(s) {
  try {
    const localCombats = s.combats.filter(c => typeof c.id === 'string');
    localStorage.setItem(NX_LS, JSON.stringify({
      credits: s.credits,
      character: s.character,
      logged: s.training.logged,
      tasks: s.tasks,
      bets: s.bets,
      combats: localCombats,
      events: s.events,
      role: s.role,
    }));
  } catch {}
}

const DEFAULT_CHAR = {
  name: '', handle: '', bio: '', cls: 'forma1', saber: 'azul', side: 'luminoso',
  stats: { fuerza: 50, velocidad: 50, tecnica: 50, defensa: 50, foco: 50 }, pool: 6,
};

export function useStore() {
  const saved = loadState();
  const [credits,    setCredits]    = useState(saved.credits ?? 0);
  const [character,  setCharacter]  = useState(saved.character ?? DEFAULT_CHAR);
  const [logged,     setLogged]     = useState(saved.logged ?? {});
  const [tasks,      setTasks]      = useState(saved.tasks ?? []);
  const [bets,       setBets]       = useState(saved.bets ?? []);
  const [combats,    setCombats]    = useState(saved.combats ?? []);
  const [events,     setEvents]     = useState(saved.events ?? []);
  const [combatants, setCombatants] = useState([]);
  const [role,       setRole]       = useState(saved.role ?? 'pupilo');

  const training = { logged, creditsPerSession: 75 };
  const ranking  = [...combatants].sort((a, b) => b.wins - a.wins || b.winrate - a.winrate);

  const S = {
    credits, character, training, tasks, bets, combats, role, ranking, events, combatants,
    setCombatants, setCombats, setRole, setCredits, setCharacter,

    byId: (id) => combatants.find(c => c.id === id) ?? null,

    saveCharacter: () => {},

    addEvent: (e) => setEvents(p => [{ ...e, id: 'ev' + Date.now(), registered: 0, mine: false, claimed: false }, ...p]),

    toggleEventReg: (id) => setEvents(p => p.map(e =>
      e.id === id ? { ...e, mine: !e.mine, registered: e.registered + (e.mine ? -1 : 1) } : e
    )),

    claimEvent: (id) => setEvents(p => p.map(e => {
      if (e.id !== id || e.claimed || !e.mine) return e;
      setCredits(c => c + e.reward);
      return { ...e, claimed: true };
    })),

    logDay: (d) => {
      setLogged(p => ({ ...p, [d]: { focus: 'Técnica', effort: 6, note: '', tags: [], media: 0, tasks: [] } }));
      setCredits(c => c + 75);
    },

    updateLog: (d, patch) => setLogged(p => ({ ...p, [d]: { ...p[d], ...patch } })),

    updateTask: (id, patch) => setTasks(p => p.map(t => t.id === id ? { ...t, ...patch } : t)),

    approveTask: (id) => setTasks(p => p.map(t => {
      if (t.id !== id) return t;
      if (t.pupil === 'you') setCredits(c => c + t.reward);
      return { ...t, status: 'completada', progress: 100 };
    })),

    addTask: (t) => setTasks(p => [...p, { ...t, id: 't' + Date.now(), created: '11/06' }]),

    placeBet: (b) => {
      setCredits(c => c - b.amount);
      setBets(p => [...p, { ...b, id: 'b' + Date.now(), status: 'abierta' }]);
    },

    resolveCombatWithWinner: (id, winner, scoreData) => {
      setCombats(prev => prev.map(m => {
        if (m.id !== id || m.resolved) return m;
        setBets(bp => bp.map(b => {
          if (b.combatId !== id || b.status !== 'abierta') return b;
          if (b.pick === winner) { setCredits(c => c + Math.round(b.amount * b.odds)); return { ...b, status: 'ganada' }; }
          return { ...b, status: 'perdida' };
        }));
        return { ...m, resolved: true, winner, live: false, scoreData: scoreData ?? null };
      }));
    },

    createChallenge: (oppId, stake) => {
      setCombats(prev => [{
        id: 'm' + Date.now(), a: 'you', b: oppId,
        oddsA: 1.9, oddsB: 1.9, when: 'POR AGENDAR',
        live: false, event: 'Duelo Oficial', round: `Apuesta ${stake}`,
      }, ...prev]);
    },
  };

  useEffect(() => { saveState(S); }, [credits, character, logged, tasks, bets, combats, events, role]);
  return S;
}
