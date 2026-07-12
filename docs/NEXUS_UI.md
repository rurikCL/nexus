# NÉXUS — Descripción Visual del Sistema UI

> Referencia de diseño para generar nuevas páginas y modificar las existentes.  
> Toda nueva pantalla debe seguir estas convenciones para mantener coherencia visual.

---

## 1. Concepto Visual

**Estética:** Sci-fi holográfico oscuro — inspirado en paneles de control de una nave espacial / academia Jedi.  
**Paleta base:** Espacio profundo (azul-negro) + líneas de acento cian holográfico + naranja combate + oro élite.  
**Efecto de fondo:** Gradiente radial azul en esquina superior derecha, naranja sutil en inferior izquierda, rejilla holográfica semitransparente, scanlines sutiles.

```
┌──────────────────────────────────────────────────────────────────┐
│  SIDEBAR (240px)  │           HEADER (sticky)                    │
│  ─────────────── │  ────────────────────────────────────────── │
│  Logo NÉXUS       │  [☰ mobile] Título página    [créditos][🔔] │
│                   │                                              │
│  ○ Comando        │  ┌─────────────────────────────────────────┐│
│  ○ Mi Personaje   │  │         ÁREA DE CONTENIDO               ││
│  ○ Entrenamiento  │  │         max-width: 1280px               ││
│  ○ Tareas         │  │         padding: 24px                   ││
│  ○ Eventos        │  │                                         ││
│  ○ Ranking        │  └─────────────────────────────────────────┘│
│  ○ Combates       │                                              │
│  ○ Combatientes   │                                              │
│                   │                                              │
│  [rol: pupilo]    │                                              │
│  ─────────────── │                                              │
│  Avatar + nombre  │                                              │
│  [Cerrar sesión]  │                                              │
└──────────────────────────────────────────────────────────────────┘
```

---

## 2. Tokens de Diseño

### Colores

```css
/* Fondo */
--space-900: #04070f          /* negro espacial */
--space-800: #07101f          /* fondo base del body */
--space-700: #0a1830
--space-600: #0e2245
--space-panel: rgba(12,30,64,0.55)   /* panel translúcido */
--space-panel-solid: #0b1a36         /* panel sólido */

/* Acento principal — cian holográfico */
--holo:       #38cdf0   (oklch 0.82 0.13 215)
--holo-dim:   más oscuro
--holo-faint: rgba con 18% opacidad   /* fondos de chips/inputs */
--holo-line:  rgba con 32% opacidad   /* bordes */

/* Marca Holocrón */
--holocron-naranja: #FF6B00   /* acción, combates, CTAs */
--holocron-oro:     #E6B325   /* élite, medallas, Gran Maestro */
--azul-glow:       #0047BA   /* botón primario */

/* Texto */
--txt:       #dbe6f5   /* texto principal */
--txt-dim:   #8aa0c0   /* texto secundario */
--txt-faint: #5b7398   /* texto terciario / placeholders */

/* Estado semántico */
--green-500: #10b981   /* éxito, Caballero */
red: #ff6b6b            /* destructivo */

/* Tiers (rangos de la Orden) */
--tier-iniciado:    #8aa0c0
--tier-padawan:     #38cdf0
--tier-caballero:   #10b981
--tier-maestro:     #FF6B00
--tier-granmaestro: #E6B325
```

### Tipografía

| Uso | Fuente | Peso | Característica |
|-----|--------|------|---------------|
| Títulos, números grandes | Orbitron | 800 | `.nx-display` `.nx-num` |
| Labels, códigos, datos | JetBrains Mono | 400–700 | `.nx-data` `.nx-kicker` |
| Cuerpo de texto, párrafos | Inter | 400–600 | `.nx-body` |

```css
/* Clases de tipografía */
.nx-display   /* Orbitron 800, letter-spacing 0.02em */
.nx-data      /* JetBrains Mono */
.nx-kicker    /* JetBrains Mono 11px, UPPERCASE, letter-spacing 0.28em, color: --holo */
.nx-num       /* Orbitron 800, tabular-nums */
.nx-label     /* JetBrains Mono 10px, UPPERCASE, letter-spacing 0.08em, color: --txt-dim */
```

### Espaciado y Radios

- Base grid: **4px**
- Border radius cards: `var(--radius-lg)` = 8px
- Border radius chips/badges: `var(--radius-sm)` = 4px
- Border radius botones: `var(--radius-md)` = 6px

### Animaciones disponibles

```css
.nx-fade       /* fade-up entrance, 300ms */
.nx-live-dot   /* punto rojo pulsante */
@keyframes nx-pulse   /* opacidad parpadeante */
@keyframes nx-sweep   /* barrido horizontal */
@keyframes nx-signal-bar  /* barras de señal */
```

---

## 3. Componentes UI (`components/ui.jsx`)

### `<Panel>` — Contenedor principal

Paneles con esquinas tipo bracket HUD en las esquinas sup-izq / inf-der.

```jsx
<Panel
  title="Título"          // texto en Orbitron
  kicker="KICKER"         // etiqueta pequeña cian sobre el título
  icon="command"          // ícono a la izquierda del título
  right={<Btn>acción</Btn>} // elemento a la derecha del header
  solid                   // fondo sólido (sin transparencia)
  glow                    // glow cian en el borde
  bodyStyle={{ gap: 12 }} // estilos del body interior
>
  contenido
</Panel>
```

**Aspecto:**
```
╔══════════════════════════════╗
║ ⚡ KICKER                    ║
║  Título                [btn] ║
╟──────────────────────────────╢
║  contenido del panel         ║
╚══════════════════════════╝
```
*(las esquinas son clips tipo bracket, no bordes completos)*

---

### `<Btn>` — Botones

```jsx
<Btn kind="ghost">Default</Btn>       // borde cian, fondo transparente
<Btn kind="accent">Combate</Btn>      // fondo naranja #FF6B00
<Btn kind="primary">Confirmar</Btn>   // fondo azul #0047BA
<Btn kind="gold">Élite</Btn>          // fondo oro #E6B325
<Btn icon="plus" kind="accent">Crear</Btn>   // con ícono izquierda
<Btn iconRight="arrow" kind="ghost">Ver</Btn> // con ícono derecha
<Btn sm>Pequeño</Btn>                 // padding reducido
```

Todos tienen: font JetBrains Mono, UPPERCASE, letter-spacing 0.12em.  
Hover: brillo glow del color del botón.

---

### `<Chip>` — Badges/etiquetas

```jsx
<Chip>default</Chip>          // borde/texto cian
<Chip tone="gold">Oro</Chip>  // amarillo dorado
<Chip tone="orange">Live</Chip> // naranja
<Chip tone="green">Activo</Chip> // verde
<Chip tone="red">Error</Chip>   // rojo
<Chip tone="dim">Inactivo</Chip> // gris apagado
<Chip icon="star">Con ícono</Chip>
```

---

### `<Avatar>` — Monograma de personaje

```jsx
<Avatar
  c={character}   // { initials, color, side: 'luminoso'|'oscuro' }
  size={40}       // px
  ring            // añade anillo brillante del color del personaje
/>
```

Muestra iniciales sobre fondo degradado del color del personaje.  
Si `side` está presente: superpone emblema luminoso/oscuro en esquina inferior derecha.

---

### `<TierBadge>` — Rango de la Orden

```jsx
<TierBadge tier="padawan" />     // dot + texto en color del tier
<TierBadge tier="maestro" sm />  // versión pequeña
```

Tiers disponibles: `iniciado` `padawan` `caballero` `maestro` `granmaestro`

---

### `<Stat>` — Barra de estadística

```jsx
<Stat
  label="Fuerza"
  value={75}
  max={100}
  color="var(--holocron-naranja)"  // opcional, default: cian
/>
```

Renderiza: `LABEL ████████░░ 75`

---

### `<MedalIcon>` — Medalla

```jsx
<MedalIcon id="firstblood" size={34} />
```

Círculo con gradiente radial y glow del tono de la medalla (gold/orange/holo/red).

---

### `<Modal>` — Diálogo

```jsx
<Modal
  open={showModal}
  onClose={() => setShowModal(false)}
  title="Título del modal"
  kicker="ACCIÓN"
  width={540}       // px, default 540
>
  contenido
</Modal>
```

Backdrop con blur. Panel sólido con glow. Cierra con Escape o clic fuera.

---

### `toast()` — Notificaciones temporales

```jsx
toast("Mensaje", {
  tone: 'success' | 'error' | 'warning' | 'info',
  icon: 'check',
  desc: "Descripción opcional",
  dur: 3400,   // ms
})
```

Aparece en esquina inferior derecha. Borde izquierdo de color según tono.

---

### `<ImageSlot>` — Subida de imagen

```jsx
<ImageSlot
  src={currentUrl}
  onUpload={(url) => setPhoto(url)}
  shape="circle" | "rounded" | "rect"
  placeholder="Sube tu retrato"
/>
```

Drag-and-drop o click. Sube a `/api/character/photo`. Muestra loader con `nx-live-dot`.

---

### `<Icon>` — Iconos SVG

```jsx
<Icon name="swords" size={18} stroke={1.8} />
```

**Íconos disponibles:**
`command` `user` `calendar` `tasks` `trophy` `swords` `roster` `coin` `bell` `plus` `x` `chevron` `chevdown` `shield` `ghost` `anvil` `eye` `flame` `sword` `crown` `medal` `check` `camera` `video` `target` `zap` `clock` `star` `arrow` `upload` `edit` `link` `fire` `filter` `dumbbell` `trending` `logout` `menu`

---

## 4. Clases CSS de Formularios

```jsx
// Input de texto
<input className="nx-input" placeholder="..." />

// Select
<select className="nx-select">
  <option>opción</option>
</select>

// Textarea
<textarea className="nx-textarea" />

// Label sobre un campo
<label className="nx-label">Campo</label>

// Divisor horizontal
<hr className="nx-divider" />
```

---

## 5. Layout y Grids

### Clases de grid responsivas

```jsx
// Grid 2 columnas → 1 col en mobile
<div className="nx-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>

// Grid personaje (sidebar + contenido) → 1 col en mobile
<div className="nx-personaje-grid" style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: 20 }}>
```

### Breakpoints

| Breakpoint | Comportamiento |
|-----------|----------------|
| `> 1024px` | Sidebar fijo 240px + contenido |
| `768–1024px` | Sidebar 200px, grid 2 cols |
| `< 768px` | Sidebar como drawer, todo 1 col |

---

## 6. Páginas Existentes

### `/comando` — Centro de Comando (Dashboard)

Vista general con KPIs, hero del personaje, próximo combate y actividad reciente.

**Layout:**
```
┌──────────────────────────────────────────────────┐
│  [Kicker: MI COMANDO]  Nombre del personaje      │
│  Tier badge · Clase · Sable                      │
├─────────────────────┬────────────────────────────┤
│  Panel: Tu Personaje│  Panel: Próximo Combate     │
│  Avatar hex grande  │  vs. [avatar oponente]      │
│  Barras de stats    │  Fecha / evento             │
├─────────────────────┴────────────────────────────┤
│  Panel: KPIs   [Victorias] [Derrotas] [Racha]    │
├───────────────────────────────────────────────────┤
│  Panel: Actividad reciente (lista de eventos)    │
└───────────────────────────────────────────────────┘
```

---

### `/personaje` — Mi Personaje

Creación y edición del personaje: lado, tier, clase de combate, sable, stats.

**Layout:**
```
┌──────────────────────────┬────────────────────────┐
│  Columna fija (300px)    │  Columna de config      │
│                          │                         │
│  ImageSlot (foto)        │  Nombre / Handle / Bio  │
│  Avatar hex grande       │  Selector de Lado       │
│  Nombre + handle         │  Selector de Clase      │
│  TierBadge               │  Selector de Sable      │
│  Barras de stats         │  Distribución de stats  │
│  Lista de medallas       │  [Guardar Personaje]    │
└──────────────────────────┴────────────────────────┘
```

El selector de sable cambia el color `--holo` globalmente via CSS variables.

---

### `/entrenamiento` — Entrenamiento

Calendario de asistencia + diario de entrenamiento diario.

**Layout:**
```
┌────────────────────────────────────────────────────┐
│  Panel: Calendario mensual (7 cols × N filas)      │
│  Días con log → iluminados con color del sable      │
│  Día hoy → borde cian                              │
├─────────────────────┬──────────────────────────────┤
│  Panel: Log del día │  Panel: Historial reciente   │
│  Foco / Esfuerzo   │  Lista de sesiones previas   │
│  Nota libre         │  con tags y créditos         │
│  Tags de entren.    │                              │
│  Media (foto/video) │                              │
│  [Registrar]        │                              │
└─────────────────────┴──────────────────────────────┘
```

---

### `/tareas` — Tareas

Sistema de tareas asignadas por tutor, completadas por pupilo.

**Layout (vista pupilo):**
```
┌────────────────────────────────────────────────────┐
│  Filtros: [Todas] [Pendientes] [Completadas]       │
├────────────────────────────────────────────────────┤
│  Lista de tareas:                                  │
│  ┌─────────────────────────────────────────────┐  │
│  │ ● Título de la tarea          [Completar]   │  │
│  │   Descripción · créditos · fecha límite     │  │
│  └─────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────┘
```

**Vista tutor:** añade botón `[+ Nueva Tarea]` y botón `[Aprobar]` en tareas entregadas.

---

### `/eventos` — Eventos

Registro de eventos (torneos, seminarios) con inscripción y estado.

**Layout:**
```
┌───────────────────────────────────────────────────┐
│  [+ Crear Evento]  (solo tutores)                 │
├───────────────────────────────────────────────────┤
│  Grid de cards de eventos:                        │
│  ┌─────────────────────┐  ┌────────────────────┐  │
│  │ Chip: PRÓXIMO       │  │ Chip: COMPLETADO   │  │
│  │ Nombre del evento   │  │ Nombre del evento  │  │
│  │ Fecha · Lugar       │  │ Fecha · Lugar      │  │
│  │ [Inscribirse]       │  │ [Reclamar créditos]│  │
│  └─────────────────────┘  └────────────────────┘  │
└───────────────────────────────────────────────────┘
```

---

### `/ranking` — Ranking

Tabla de clasificación ordenada por victorias y winrate.

**Layout:**
```
┌───────────────────────────────────────────────────┐
│  Panel: Ranking Oficial                           │
│  #  │  Combatiente           │  W   L   Winrate   │
│  ─────────────────────────────────────────────── │
│  1  │  [Avatar] Nombre       │  15  3   83%       │
│     │  TierBadge · Clase     │                    │
│  2  │  [Avatar] Nombre       │  12  5   70%       │
│  ...│                        │                    │
│  (fila propia resaltada con borde cian)           │
└───────────────────────────────────────────────────┘
```

---

### `/combates` — Combates

Vista de combates en vivo, próximos y pasados. Incluye apuestas y desafíos.

**Layout:**
```
┌──────────────────────────────┬────────────────────┐
│  Panel: Combate en VIVO      │  Panel: Mis Apuestas│
│  [LIVE dot] Evento           │  Lista de apuestas  │
│  [Avatar A]  vs  [Avatar B]  │  con resultado      │
│  Odds A · Odds B             │                     │
│  [Apostar A] [Apostar B]     │                     │
├──────────────────────────────┴────────────────────┤
│  Panel: Próximos combates                         │
│  Lista de cards con fecha, oponentes, odds        │
│  [Desafiar]                                       │
├───────────────────────────────────────────────────┤
│  Panel: Historial de combates                     │
│  Resultados pasados con ganador resaltado         │
└───────────────────────────────────────────────────┘
```

---

### `/combatientes` — Roster

Directorio de todos los combatientes con filtros por tier y lado.

**Layout:**
```
┌───────────────────────────────────────────────────┐
│  Filtros: [Todos los Tiers ▾]  [Lado ▾]  [Buscar]│
├───────────────────────────────────────────────────┤
│  Grid de combatant cards (3 cols desktop):        │
│  ┌──────────────┐  ┌──────────────┐               │
│  │ [Avatar]     │  │ [Avatar]     │               │
│  │ Nombre       │  │ Nombre       │               │
│  │ @handle      │  │ @handle      │               │
│  │ TierBadge    │  │ TierBadge    │               │
│  │ W/L/Winrate  │  │ W/L/Winrate  │               │
│  │ Bio (truncada│  │              │               │
│  └──────────────┘  └──────────────┘               │
└───────────────────────────────────────────────────┘
```

---

## 7. Patrones de Código Recurrentes

### Estructura de una vista nueva

```jsx
export default function NuevaVistaView({ user, character, combatants }) {
  const S = useStore();
  const [loading, setLoading] = useState(false);

  return (
    <div className="nx-fade">
      {/* Grid principal */}
      <div style={{ display: 'grid', gap: 20 }}>

        {/* Panel principal */}
        <Panel title="Título" kicker="SECCIÓN" icon="command">
          {/* contenido */}
        </Panel>

        {/* Grid 2 columnas */}
        <div className="nx-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <Panel title="Izquierda">...</Panel>
          <Panel title="Derecha">...</Panel>
        </div>

      </div>
    </div>
  );
}
```

### Formulario estándar

```jsx
<div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
  <div>
    <label className="nx-label">Nombre del campo</label>
    <input className="nx-input" value={val} onChange={e => setVal(e.target.value)} />
  </div>
  <div>
    <label className="nx-label">Selector</label>
    <select className="nx-select" value={sel} onChange={e => setSel(e.target.value)}>
      <option value="">Seleccionar</option>
    </select>
  </div>
  <Btn kind="accent" icon="check" onClick={handleSave} disabled={loading}>
    {loading ? 'Guardando...' : 'Guardar'}
  </Btn>
</div>
```

### Card de elemento en lista

```jsx
<div style={{
  display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px',
  borderBottom: '1px solid var(--holo-line)'
}}>
  <Avatar c={combatant} size={40} />
  <div style={{ flex: 1, minWidth: 0 }}>
    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--txt)' }}>{item.name}</div>
    <div style={{ fontSize: 11, color: 'var(--txt-dim)' }}>{item.subtitle}</div>
  </div>
  <TierBadge tier={item.tier} sm />
  <Btn kind="ghost" sm>Acción</Btn>
</div>
```

### KPI / Stat card

```jsx
<div style={{ textAlign: 'center', padding: '16px 0' }}>
  <div className="nx-num" style={{ fontSize: 32, color: 'var(--holocron-naranja)' }}>
    {valor}
  </div>
  <div className="nx-kicker" style={{ marginTop: 4 }}>
    ETIQUETA
  </div>
</div>
```

---

## 8. API y Estado

### Store (`useStore`)

```js
const S = useStore();

// Datos disponibles
S.credits           // número de créditos
S.character         // { name, handle, bio, cls, saber, side, stats, pool, photo }
S.training          // { logged: { [YYYY-MM-DD]: { focus, effort, note, tags } } }
S.tasks             // array
S.combats           // array
S.events            // array
S.combatants        // array (se reemplaza con datos de la API)
S.ranking           // array ordenado por wins/winrate
S.role              // 'pupilo' | 'tutor'

// Acciones
S.setCharacter(data)
S.saveCharacter()
S.logDay(date, data)
S.addTask(task)
S.updateTask(id, changes)
S.approveTask(id)
S.addEvent(event)
S.toggleEventReg(id)
S.claimEvent(id)
S.placeBet(combatId, side, amount)
S.resolveCombatWithWinner(combatId, winnerId)
S.createChallenge(opponentId)
S.setRole('tutor' | 'pupilo')
```

### Llamadas a la API

```js
import { api } from '../api/client.js';

// Patrones comunes
const { data } = await api.get('/combatants');
const { data } = await api.post('/training', payload);
const { data } = await api.put('/tasks/123', changes);
```

Token Bearer se inyecta automáticamente desde `localStorage.getItem('nx-token')`.

---

## 9. Convenciones de Nomenclatura

| Elemento | Convención | Ejemplo |
|----------|-----------|---------|
| Archivos de vista | PascalCase | `Combates.jsx` |
| Función de vista | `[Nombre]View` | `CombatesView` |
| Clases CSS custom | `nx-[componente]` | `nx-panel`, `nx-btn-accent` |
| Variables de color | `--[nombre]` | `--holo`, `--txt-dim` |
| IDs de usuario | `u{id}` o `'you'` | `u42`, `'you'` |
| IDs de entidades | prefijo + número | `t123` (task), `ev123` (evento) |

---

## 10. Checklist para una Página Nueva

Al crear una nueva vista, verificar:

- [ ] El componente se llama `[Nombre]View` y exporta default
- [ ] La raíz tiene `className="nx-fade"` (animación de entrada)
- [ ] Todo el contenido vive dentro de `<Panel>` con título y kicker
- [ ] Los textos de etiquetas usan `className="nx-kicker"` o `className="nx-label"`
- [ ] Los números grandes usan `className="nx-num"`
- [ ] Los grids tienen clase `nx-grid-2` o `nx-personaje-grid` para que colapsen en mobile
- [ ] Los inputs usan `className="nx-input"` / `nx-select` / `nx-textarea`
- [ ] Los botones usan `<Btn kind="...">` del sistema
- [ ] Los chips/badges usan `<Chip tone="...">` del sistema
- [ ] No se usan colores hardcoded — siempre variables CSS (`var(--holo)`, etc.)
- [ ] La ruta se registra en el array `NAV` de `App.jsx` con `id`, `label` e `icon`
- [ ] La vista se añade al `switch(section)` en `App.jsx`
