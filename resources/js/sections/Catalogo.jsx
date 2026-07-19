import { useState, useEffect, useMemo } from 'react';
import { Icon, Panel, Chip, toast } from '../components/ui.jsx';
import { NX } from '../data/seed.js';
import { mediaUrl } from '../utils/printableCard.js';
import EntityCardModal, { TIPO_HAB_LABEL, RAREZA_LABEL, NPC_TIPO_LABEL } from '../components/EntityCard.jsx';
import { Empty } from './Comando.jsx';

/* NÉXUS — Catálogo: archivo de referencia de habilidades, objetos, NPCs, jefes
   y enemigos. Cada entrada abre una carta imprimible tamaño Magic (63×88mm). */

function useWindowWidth() {
  const [w, setW] = useState(() => window.innerWidth);
  useEffect(() => {
    const fn = () => setW(window.innerWidth);
    window.addEventListener('resize', fn);
    return () => window.removeEventListener('resize', fn);
  }, []);
  return w;
}

const CATEGORIES = [
  {
    id: 'habilidades',
    label: 'Habilidades',
    icon: 'zap',
    kind: 'habilidad',
    filters: [
      { field: 'tipo', label: 'Tipo', labels: TIPO_HAB_LABEL },
      {
        field: 'forma',
        label: 'Forma',
        labels: Object.fromEntries([
          ['0', 'Universal'],
          ...NX.CLASSES.map((c, i) => [String(i + 1), c.num]),
        ]),
      },
    ],
  },
  { id: 'objetos', label: 'Objetos', icon: 'box', kind: 'objeto', filters: [{ field: 'rareza', label: 'Rareza', labels: RAREZA_LABEL }] },
  { id: 'npcs', label: 'NPCs', icon: 'user', kind: 'npc', filters: [{ field: 'tipo', label: 'Tipo', labels: NPC_TIPO_LABEL }] },
  { id: 'jefes', label: 'Jefes', icon: 'crown', kind: 'npc', filters: [] },
  { id: 'enemigos', label: 'Enemigos', icon: 'flame', kind: 'enemigo', filters: [{ field: 'tipo', label: 'Tipo', labels: NPC_TIPO_LABEL }] },
];

const STAT_META = {
  ataque: { label: 'Ataque', color: '#ff7043' },
  defensa: { label: 'Defensa', color: '#38cdf0' },
  punteria: { label: 'Puntería', color: '#10b981' },
  movimiento: { label: 'Agilidad', color: '#a78bfa' },
  iniciativa: { label: 'Iniciativa', color: '#E6B325' },
  escudo: { label: 'Escudo', color: '#26e3e3' },
  vida: { label: 'Vida', color: '#ff2d45' },
};

const groupStack = (stack) => {
  const counts = new Map();
  if (Array.isArray(stack)) {
    for (const stat of stack) {
      if (!stat) continue;
      counts.set(stat, (counts.get(stat) ?? 0) + 1);
    }
  } else if (stack && typeof stack === 'object') {
    Object.entries(stack).forEach(([stat, count]) => {
      const n = Number(count) || 0;
      if (n > 0) counts.set(stat, n);
    });
  } else {
    return [];
  }
  return [...counts.entries()].map(([stat, count]) => ({ stat, count }));
};

function EntityGridCard({ item, category, onClick }) {
  const thumb = mediaUrl(item.imagen ?? item.imagen_mini ?? item.icono_url ?? item.icono);
  const badge = category.id === 'jefes' || category.id === 'enemigos'
    ? `Nivel ${item.nivel ?? 1}`
    : (category.filters?.[0] ? (category.filters[0].labels[item[category.filters[0].field]] ?? item[category.filters[0].field]) : null);
  const isSkill = category.id === 'habilidades';
  const buffs = isSkill ? groupStack(item.buff) : [];
  const debuffs = isSkill ? groupStack(item.debuff) : [];

  return (
    <button
      onClick={onClick}
      className="nx-panel solid"
      style={{ padding: 12, textAlign: 'left', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 8 }}
    >
      <div style={{
        width: '100%', aspectRatio: '1', borderRadius: 8, overflow: 'hidden',
        background: 'rgba(255,255,255,.04)', display: 'grid', placeItems: 'center', color: 'var(--holo)',
      }}>
        {thumb
          ? <img src={thumb} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          : <Icon name={category.icon} size={26} />}
      </div>
      <div style={{
        border: '1px solid rgba(255,255,255,0.08)',
        background: 'rgba(255,255,255,0.03)',
        borderRadius: 8,
        padding: 10,
        display: 'grid',
        gap: 8,
      }}>
        <div style={{
          fontSize: 13, fontWeight: 700, color: 'var(--txt)',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {item.nombre}
        </div>
        {isSkill && (
          <>
            <div style={{ display: 'grid', gap: 4 }}>
              <div className="nx-data" style={{ fontSize: 10, color: 'var(--txt-faint)', letterSpacing: '0.08em' }}>Buff</div>
              {buffs.length > 0 ? (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                  {buffs.map(({ stat, count }) => {
                    const meta = STAT_META[stat] ?? { label: stat, color: 'var(--txt-dim)' };
                    return (
                      <Chip key={`buff-${stat}`} tone="dim" style={{ borderColor: `${meta.color}55`, color: meta.color }}>
                        {meta.label}{count > 1 ? ` +${count}` : ''}
                      </Chip>
                    );
                  })}
                </div>
              ) : (
                <div className="nx-data" style={{ fontSize: 11, color: 'var(--txt-faint)' }}>Sin Buff</div>
              )}
            </div>
            <div style={{ display: 'grid', gap: 4 }}>
              <div className="nx-data" style={{ fontSize: 10, color: 'var(--txt-faint)', letterSpacing: '0.08em' }}>Debuff</div>
              {debuffs.length > 0 ? (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                  {debuffs.map(({ stat, count }) => {
                    const meta = STAT_META[stat] ?? { label: stat, color: 'var(--txt-dim)' };
                    return (
                      <Chip key={`debuff-${stat}`} tone="dim" style={{ borderColor: `${meta.color}55`, color: meta.color }}>
                        {meta.label}{count > 1 ? ` ×${count}` : ''}
                      </Chip>
                    );
                  })}
                </div>
              ) : (
                <div className="nx-data" style={{ fontSize: 11, color: 'var(--txt-faint)' }}>Sin Debuff</div>
              )}
            </div>
          </>
        )}
      </div>
      {badge && <Chip tone="dim">{badge}</Chip>}
    </button>
  );
}

export function CatalogoView() {
  const isMobile = useWindowWidth() < 640;
  const [data, setData] = useState({ habilidades: [], objetos: [], npcs: [], jefes: [], enemigos: [] });
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState('habilidades');
  const [activeFilters, setActiveFilters] = useState({ tipo: 'todos', forma: 'todos', rareza: 'todos' });
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    const token = localStorage.getItem('nx-token');
    const headers = { Accept: 'application/json', Authorization: `Bearer ${token}` };
    Promise.all([
      fetch('/api/rol-habilidades', { headers }).then(r => r.ok ? r.json() : { habilidades: [] }),
      fetch('/api/catalogo/objetos', { headers }).then(r => r.ok ? r.json() : { objetos: [] }),
      fetch('/api/catalogo/npcs', { headers }).then(r => r.ok ? r.json() : { npcs: [] }),
      fetch('/api/catalogo/enemigos', { headers }).then(r => r.ok ? r.json() : { enemigos: [] }),
    ])
      .then(([hab, obj, npcRes, enemigoRes]) => {
        const allNpcs = npcRes.npcs ?? [];
        setData({
          habilidades: hab.habilidades ?? [],
          objetos: obj.objetos ?? [],
          npcs: allNpcs.filter(n => n.tipo !== 'jefe'),
          jefes: allNpcs.filter(n => n.tipo === 'jefe'),
          enemigos: enemigoRes.enemigos ?? [],
        });
      })
      .catch(() => toast('No se pudo cargar el catálogo', { tone: 'error', icon: 'x' }))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    setActiveFilters({ tipo: 'todos', forma: 'todos', rareza: 'todos' });
    setSearch('');
  }, [activeCategory]);

  const category = CATEGORIES.find(c => c.id === activeCategory);
  const rawList = data[activeCategory] ?? [];
  const filterDefs = category.filters ?? [];

  const filterOptions = useMemo(() => {
    return filterDefs.map(filter => ({
      ...filter,
      options: [...new Set(rawList
        .map(x => x[filter.field])
        .filter(v => v !== null && v !== undefined && v !== ''))],
    }));
  }, [rawList, filterDefs]);

  const list = useMemo(() => {
    let l = rawList;
    for (const filter of filterDefs) {
      const active = activeFilters[filter.field] ?? 'todos';
      if (active !== 'todos') l = l.filter(x => String(x[filter.field]) === String(active));
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      l = l.filter(x => (x.nombre ?? '').toLowerCase().includes(q));
    }
    return l;
  }, [rawList, filterDefs, activeFilters, search]);

  return (
    <div className="nx-fade" style={{ display: 'grid', gap: 18 }}>
      <section className="nx-panel" style={{ padding: isMobile ? 16 : 22 }}>
        <div className="nx-kicker">Archivo de la Academia</div>
        <h1 className="nx-display" style={{ fontSize: isMobile ? 20 : 26, margin: '4px 0 4px', color: 'var(--txt)' }}>Catálogo</h1>
        <div className="nx-data" style={{ fontSize: 12, color: 'var(--txt-faint)' }}>
          Habilidades, objetos, NPCs, jefes y enemigos — pulsa cualquier registro para ver su carta imprimible.
        </div>
      </section>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {CATEGORIES.map(c => (
          <button
            key={c.id}
            onClick={() => setActiveCategory(c.id)}
            className={`nx-chip ${activeCategory === c.id ? '' : 'dim'}`}
            style={{ cursor: 'pointer', gap: 6 }}
          >
            <Icon name={c.icon} size={13} />{c.label}
            <span className="nx-data" style={{ opacity: 0.6 }}>{(data[c.id] ?? []).length}</span>
          </button>
        ))}
      </div>

      <Panel title={category.label} kicker={`${list.length} de ${rawList.length} registros`} icon={category.icon}>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 14, alignItems: 'center' }}>
          <div style={{ position: 'relative', flex: '1 1 220px', minWidth: 180 }}>
            <Icon name="filter" size={13} style={{ position: 'absolute', left: 10, top: 10, opacity: 0.4 }} />
            <input
              className="nx-input"
              style={{ paddingLeft: 30, width: '100%' }}
              placeholder="Buscar por nombre..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          {filterOptions.length > 0 && (
            <div style={{ display: 'grid', gap: 8 }}>
              {filterOptions.map(filter => (
                <div key={filter.field} style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                  <span className="nx-data" style={{ fontSize: 10, color: 'var(--txt-faint)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                    {filter.label}
                  </span>
                  <button
                    onClick={() => setActiveFilters(prev => ({ ...prev, [filter.field]: 'todos' }))}
                    className={`nx-chip ${(activeFilters[filter.field] ?? 'todos') === 'todos' ? '' : 'dim'}`}
                    style={{ cursor: 'pointer' }}
                  >
                    Todos
                  </button>
                  {filter.options.map(opt => (
                    <button
                      key={String(opt)}
                      onClick={() => setActiveFilters(prev => ({ ...prev, [filter.field]: opt }))}
                      className={`nx-chip ${(activeFilters[filter.field] ?? 'todos') === opt ? '' : 'dim'}`}
                      style={{ cursor: 'pointer' }}
                    >
                      {filter.labels[String(opt)] ?? filter.labels[opt] ?? opt}
                    </button>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: 30, color: 'var(--txt-faint)' }} className="nx-data">Cargando catálogo…</div>
        ) : list.length === 0 ? (
          <Empty label="Sin resultados" />
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(190px,1fr))', gap: 12 }}>
            {list.map(item => (
              <EntityGridCard
                key={item.id}
                item={item}
                category={category}
                onClick={() => setSelected({ kind: category.kind, item })}
              />
            ))}
          </div>
        )}
      </Panel>

      {selected && (
        <EntityCardModal kind={selected.kind} item={selected.item} onClose={() => setSelected(null)} />
      )}
    </div>
  );
}
