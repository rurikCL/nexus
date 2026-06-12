import { useState, useEffect } from 'react';
import { NX } from '../data/seed.js';
import { toast } from '../components/ui.jsx';

/*
  useStore — estado global de la app (Context-free, se inyecta como prop `S`).

  MOCK: hoy hidrata desde src/data/seed.js y persiste en localStorage.
  PRODUCCIÓN (React + Laravel): reemplazar la hidratación inicial por una
  llamada a la API (ver src/api/endpoints.js) y cada acción (logDay, addTask,
  placeBet, etc.) por su request correspondiente. La forma del estado y de las
  acciones está pensada para mapear 1:1 con los endpoints REST.
*/

const NX_LS = 'nx-state-v2';

function loadState() {
  try { return JSON.parse(localStorage.getItem(NX_LS)) || {}; } catch (e) { return {}; }
}
function saveState(s) {
  try {
    localStorage.setItem(NX_LS, JSON.stringify({
      credits: s.credits, character: s.character, logged: s.training.logged,
      tasks: s.tasks, bets: s.bets, combats: s.combats, events: s.events, role: s.role,
    }));
  } catch (e) {}
}

export function useStore() {
  const saved = loadState();
  const me = NX.byId('you');
  const [credits, setCredits] = useState(saved.credits ?? me.credits);
  const savedChar = saved.character ?? {
    name: me.name, handle: me.handle, bio: me.bio, cls: me.cls, stats: { ...me.stats }, pool: 6,
  };
  if (!savedChar.saber) savedChar.saber = me.saberName;
  const [character, setCharacter] = useState(savedChar);
  const [logged, setLogged] = useState(saved.logged ?? NX.training.logged);
  const [tasks, setTasks] = useState(saved.tasks ?? NX.tasks);
  const [bets, setBets] = useState(saved.bets ?? []);
  const [combats, setCombats] = useState(saved.combats ?? NX.combats);
  const [events, setEvents] = useState(saved.events ?? NX.events);
  const canTutor = ['caballero', 'maestro', 'granmaestro'].includes(me.tier);
  const [role, setRole] = useState(canTutor ? (saved.role ?? 'pupilo') : 'pupilo');
  const [combatants, setCombatants] = useState(NX.combatants);

  const training = { ...NX.training, logged };
  const ranking = [...combatants].sort((a, b) => b.wins - a.wins || b.winrate - a.winrate);

  const S = {
    credits, character, training, tasks, bets, combats, role, ranking, events,
    combatants, setCombatants,
    setRole, setCredits,
    setCharacter,
    // POST /api/character
    saveCharacter: () => {},
    // POST /api/events
    addEvent: (e) => setEvents(p => [{ ...e, id: 'ev' + Date.now(), registered: 0, mine: false, claimed: false }, ...p]),
    // POST/DELETE /api/events/{id}/register
    toggleEventReg: (id) => setEvents(p => p.map(e => e.id === id ? { ...e, mine: !e.mine, registered: e.registered + (e.mine ? -1 : 1) } : e)),
    // POST /api/events/{id}/claim
    claimEvent: (id) => setEvents(p => p.map(e => {
      if (e.id !== id || e.claimed || !e.mine) return e;
      setCredits(c => c + e.reward);
      return { ...e, claimed: true };
    })),
    // POST /api/training/{day}
    logDay: (d) => {
      setLogged(p => ({ ...p, [d]: { focus: 'Técnica', effort: 6, note: '', tags: [], media: 0, tasks: [] } }));
      setCredits(c => c + NX.training.creditsPerSession);
    },
    // PATCH /api/training/{day}
    updateLog: (d, patch) => setLogged(p => ({ ...p, [d]: { ...p[d], ...patch } })),
    // PATCH /api/tasks/{id}
    updateTask: (id, patch) => setTasks(p => p.map(t => t.id === id ? { ...t, ...patch } : t)),
    // POST /api/tasks/{id}/approve
    approveTask: (id) => setTasks(p => p.map(t => {
      if (t.id !== id) return t;
      if (t.pupil === 'you') setCredits(c => c + t.reward);
      return { ...t, status: 'completada', progress: 100 };
    })),
    // POST /api/tasks
    addTask: (t) => setTasks(p => [...p, { ...t, id: 't' + Date.now(), created: '11/06' }]),
    // POST /api/bets
    placeBet: (b) => { setCredits(c => c - b.amount); setBets(p => [...p, { ...b, id: 'b' + Date.now(), status: 'abierta' }]); },
    // POST /api/combats/{id}/resolve (demo cliente; en prod lo resuelve el backend)
    resolveCombat: (id) => {
      setCombats(prev => prev.map(m => {
        if (m.id !== id || m.resolved) return m;
        const pA = m.oddsB / (m.oddsA + m.oddsB);
        const winner = Math.random() < pA ? 'a' : 'b';
        setBets(bp => bp.map(b => {
          if (b.combatId !== id || b.status !== 'abierta') return b;
          if (b.pick === winner) { setCredits(c => c + Math.round(b.amount * b.odds)); return { ...b, status: 'ganada' }; }
          return { ...b, status: 'perdida' };
        }));
        const wName = NX.byId(winner === 'a' ? m.a : m.b).name;
        setTimeout(() => toast('Combate resuelto', { tone: 'info', icon: 'trophy', desc: `Ganó ${wName}` }), 50);
        return { ...m, resolved: true, winner, live: false };
      }));
    },
    // POST /api/challenges
    createChallenge: (oppId, stake) => {
      setCombats(prev => [{ id: 'm' + Date.now(), a: 'you', b: oppId, oddsA: 1.9, oddsB: 1.9, when: 'POR AGENDAR', live: false, event: 'Duelo Oficial', round: `Apuesta ${stake}` }, ...prev]);
    },
  };

  useEffect(() => { saveState(S); }, [credits, character, logged, tasks, bets, combats, events, role]);
  return S;
}
