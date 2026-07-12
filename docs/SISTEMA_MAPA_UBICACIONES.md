# Sistema de Mapa y Ubicaciones — NÉXUS

Documentación técnica de la jerarquía galáctica (`Sistema → Planeta → Zona → Lugar → NPC`), de
cómo un personaje se mueve por ella, y de qué partes del diseño están declaradas en el esquema
pero todavía no están conectadas a ninguna regla de juego.

> Fuentes principales: `app/Http/Controllers/Api/MapController.php`, `app/Models/MapSistema.php`,
> `MapPlaneta.php`, `MapZona.php`, `MapLugar.php`, `MapNpc.php`, `MapNpcEspacio.php`, `MapNave.php`,
> `app/Models/Character.php`, `resources/js/sections/Mapa.jsx`, `resources/js/sections/Admin.jsx`,
> migraciones en `database/migrations/`.

---

## 0. Vista general

```
map_sistemas ──▶ map_planetas ──▶ map_zonas ──▶ map_lugares ──▶ map_npcs
                                                      │
                                                      └─ norte/sur/este/oeste (grafo caminable)

characters.map_sistema_id / map_planeta_id / map_zona_id / map_lugar_id
   = única fuente de verdad de "dónde está" un personaje, actualizada por
   POST /map/location (sin costo, sin validación de adyacencia)
```

Cuatro niveles jerárquicos estrictos (FK en cascada hacia abajo) más un quinto nivel de detalle
(los NPCs de un lugar) y un grafo de 4 direcciones **dentro** de una zona que conecta lugares
entre sí — es la única navegación "espacial" real; todo lo demás es drill-down jerárquico.

---

## 1. Esquema

### `map_sistemas`
```
nombre, rareza (comun|poco_comun|raro|epico|legendario),
hostilidad (seguro|bajo|medio|alto|extremo), faccion, color (hex, brillo del nodo en el mapa),
imagen, historia, costo_viaje (int, default 0), visible, timestamps, soft delete
```

### `map_planetas`  (FK `SistemaID`, cascade)
```
nombre, rareza, clima, hostilidad, faccion, imagen, historia,
eventos_importantes (texto libre — un evento por línea; los NPCs con IA
  pueden agregar entradas automáticamente, ver el Códice de Misiones y NPCs §5),
visible
```

### `map_zonas`  (FK `PlanetaID`, cascade)
```
nombre, rareza, faccion, hostilidad, estrato_social,
impuestos (decimal 10,2, default 0), imagen, historia, visible
```

### `map_lugares`  (FK `ZonaID`, cascade)
```
nombre, rareza, tipo (exterior|interior, default exterior),
pase (FK opcional → rol_objetos — objeto de inventario requerido para entrar),
lugarNorteID / lugarSurID / lugarEsteID / lugarOesteID
  (auto-FK → map_lugares, forman el grafo caminable de 4 direcciones),
imagen, historia, visible
```

### `map_npcs`  (FK `LugarID`, cascade)
Ya documentado en el Códice de Misiones y NPCs — columnas relevantes aquí:
`hito_requerimiento`, `fecha_inicio`, `fecha_fin` (gating de visibilidad),
`MisionID` (FK → `misiones`, legacy), `prompt` (IA), 7 stats de combate.

### `map_naves` — catálogo de naves (sin FK entrantes)
```
nombre, tipo, capacidad_carga, vida, escudo, velocidad, ataque, maniobrabilidad,
capacidad_salto, costo, costo_reparacion, rareza, imagen, descripcion
```

### `map_npcs_espacio` — encuentro espacial (paralelo, no conectado)
```
SistemaID (FK), nombre, tipo, NaveID (FK → map_naves, nullable),
NpcID (FK → map_npcs, nullable — reutiliza el registro de un NPC terrestre como "piloto"),
cargamento (texto), hostilidad, saludo, interaccion, MisionID (sin FK real), urlInteraccion, visible
```

### `characters` — posición
```
map_sistema_id, map_planeta_id, map_zona_id, map_lugar_id   (todos nullOnDelete)
```

---

## 2. Modelos y relaciones

```
MapSistema   ─hasMany─▶ MapPlaneta (SistemaID)
             ─hasMany─▶ MapNpcEspacio
             ─hasMany─▶ Character (map_sistema_id, "presentesPersonajes")

MapPlaneta   ─belongsTo─▶ MapSistema
             ─hasMany──▶ MapZona (PlanetaID)
             ─hasMany──▶ Character (map_planeta_id)

MapZona      ─belongsTo─▶ MapPlaneta
             ─hasMany──▶ MapLugar (ZonaID)
             ─hasMany──▶ Character (map_zona_id)

MapLugar     ─belongsTo─▶ MapZona
             ─belongsTo─▶ MapLugar × 4 (norte/sur/este/oeste — auto-referencia)
             ─hasMany──▶ MapNpc (LugarID)
             ─hasMany──▶ Character (map_lugar_id)

MapNpc       ─belongsTo─▶ MapLugar
             ─belongsTo─▶ Mision (MisionID, legacy)

MapNpcEspacio─belongsTo─▶ MapSistema, MapNave, MapNpc (como piloto)

Character    ─belongsTo─▶ MapSistema, MapPlaneta, MapZona, MapLugar
             ─hasMany──▶ CharacterHito
             ─belongsToMany─▶ RolObjeto (inventario — usado por el gate de "pase")
```

No hay atributos computados en ningún modelo del mapa — toda la lógica derivada (visibilidad de
NPC, chequeo de pase, filtrado de "presentes") vive en el controlador, no en Eloquent.

---

## 3. `MapController` — navegación y viaje

### 3.1 Endpoints (`routes/api.php`, todos bajo `auth:sanctum`, sin gate de tier)

| Verbo/Ruta | Método | Devuelve |
|---|---|---|
| GET `/map/sistemas` | `sistemas` | sistemas visibles + conteo de planetas + presentes |
| GET `/map/sistemas/{id}` | `sistema` | 1 sistema + sus planetas visibles + presentes en cada nivel |
| GET `/map/planetas/{id}` | `planeta` | 1 planeta + sistema + zonas visibles + presentes |
| GET `/map/zonas/{id}` | `zona` | 1 zona + planeta.sistema + lugares visibles + presentes |
| GET `/map/lugares/{id}` | `lugar` | 1 lugar + zona.planeta.sistema + 4 vecinos + NPCs filtrados + presentes |
| GET `/map/npcs/{id}` | `npc` | 1 NPC (re-valida gating; 404 si no debería ser visible) |
| POST `/map/location` | `updateLocation` | mueve al personaje — ver 3.2 |

Cualquier usuario autenticado puede navegar y moverse — no hay restricción por rango.

### 3.2 El endpoint de viaje — más simple de lo que parece

```php
$activeCombat = PvpCombat::where('status', 'active')
    ->where(fn($q) => $q->where('attacker_id', $user->id)->orWhere('defender_id', $user->id))
    ->exists();

if ($activeCombat) {
    return 422 { blocked: true, message: "No puedes moverte mientras tienes un combate activo." };
}

$character->update([
    'map_sistema_id' => sistema_id, 'map_planeta_id' => planeta_id,
    'map_zona_id'    => zona_id,    'map_lugar_id'   => lugar_id,
]);
```

**Hallazgos clave sobre el gating de viaje:**

- **Sin costo real**: `costo_viaje` (sistema) e `impuestos` (zona) se muestran en la UI (tooltip
  del nodo, formulario de admin) pero **nunca se descuentan ni se validan** en este endpoint —
  moverse es gratis del lado del servidor pese a que el dato existe.
- **Sin requisito de hito/facción** entre sistemas, planetas o zonas — el único chequeo de acceso
  real es el de la sección 3.3 (pase de inventario), y sólo aplica al entrar a un **lugar**.
- **Único gate real**: un `PvpCombat` en estado `active` que involucre al usuario bloquea
  cualquier actualización de posición.
- El cliente envía los 4 IDs que quiera; el backend **no valida** que el destino exista, que sea
  adyacente, ni que el personaje ya estuviera en la jerarquía correcta — confía por completo en
  el estado de navegación del frontend.
- **No hay encuentros aleatorios ligados al viaje.** El único tiro al azar del sistema
  (una emboscada 1d6 ≥ 4) ocurre **dentro** del diálogo con un NPC `hostil` — no al desplazarse
  entre sistemas/zonas/lugares (ver el Códice de Misiones y NPCs).

### 3.3 El único gate de acceso real: el "pase"

```php
if ($lugar->pase && (!$character || !$character->rolObjetos()->where('rol_objetos.id', $lugar->pase)->exists())) {
    return 403 { message: "...", required_pass_id: $lugar->pase };
}
```
Entrar a un lugar que exige un objeto de inventario específico (`map_lugares.pase`) y no
poseerlo devuelve 403 — es el único punto de todo el sistema de mapa donde el inventario
condiciona el movimiento.

### 3.4 `map_npcs_espacio` — declarado, no conectado

No existe ningún método de controlador, ninguna ruta ni ninguna entidad de administración para
`map_npcs_espacio`. Sólo existe el modelo Eloquent, su migración y la relación `npcsEspacio()` en
`MapSistema`. Es una funcionalidad de "encuentro espacial" diseñada en el esquema pero sin ningún
punto de entrada — hoy sólo se podría poblar por Tinker/DB directa.

---

## 4. Frontend — `Mapa.jsx` (navegación real del jugador)

- **Máquina de estados de nivel**: `MapaView` mantiene `nivel ∈ {galaxy, sistema, planeta, zona, lugar}`
  con los objetos correspondientes cargados; cada "bajar de nivel" llama a `updateLocation()`
  (POST fire-and-forget a `/map/location`) y persiste el breadcrumb hacia el componente padre
  para poder restaurar la posición al volver a montar la vista.
- **Visualización de la galaxia — no es canvas/WebGL**: es un starfield CSS/DOM. Las posiciones
  de los nodos-sistema se calculan con una función hash determinística (sin `Math.random()`) a
  partir del ID del sistema, así el layout no "salta" al recargar. Los planetas dentro de un
  sistema se renderizan como anillos orbitales, también con CSS puro.
- **Drill-down**: Galaxia → click en un sistema (animación de "salto a hiperespacio", ~1.8s) →
  lista de planetas → lista de zonas → lista de lugares → detalle del lugar con NPCs y salidas
  direccionales.
- **Breadcrumbs**: sólo etiquetas — el click-to-jump directo desde el breadcrumb fue removido a
  propósito (comentario en el código); volver de nivel usa el botón "← VOLVER".
- **Movimiento intra-lugar**: dentro de un lugar, moverse norte/sur/este/oeste usa una pila de
  navegación local (`navStack`) sin salir de la vista "lugar", con una animación de vehículo
  (~1.75s); viajar entre sistemas usa en cambio una animación de nave espacial.
- **Bloqueo de viaje en cliente**: si hay un PvP activo, el cliente ya impide iniciar la
  animación de viaje ("Debes resolver tu combate PvP antes de viajar") — refleja el mismo gate
  que aplica el servidor.
- **"Presentes aquí"**: cada nivel muestra chips de avatar (coloreados por `saber_color`) de los
  personajes actualmente ubicados ahí; en el lugar, estos avatares son clicables para chatear o
  retar a PvP.
- **Acceso denegado**: si `/map/lugares/{id}` devuelve 403 por falta de pase, la UI muestra una
  pantalla dedicada de "Puerta Cerrada" en vez del contenido del lugar.
- **`lugarRefreshKey`**: se incrementa cuando se completa una misión o se obtiene un hito dentro
  de un lugar (victoria contra NPC, cambio de estado de misión en el diálogo). Dispara un
  refetch silencioso de `/map/lugares/{id}` (sin spinner) para que NPCs/misiones recién
  desbloqueados aparezcan sin recargar la página completa.

---

## 5. Administración del mapa (`Admin.jsx`)

Grupo de entidades **"MAPA GALÁCTICO"**: `sistemas`, `planetas`, `zonas`, `lugares`, `npcs`,
`naves` — cada una con su formulario CRUD genérico (campos = columnas de la tabla; los FKs
(`SistemaID`, `PlanetaID`, `ZonaID`, `lugarNorteID`..., `pase`) se editan con un selector
relacional). **No existe entidad `npcs_espacio`** — confirma que ese subsistema no tiene ninguna
superficie de administración tampoco.

El acceso a todo el panel de administración (incluido el CRUD del mapa) se controla por un **rol**
plano (`administrador`), no por el rango RPG (`iniciado→...→granmaestro`) — cualquier
administrador puede editar cualquier entidad del mapa; no hay permisos separados por tabla.

---

## 6. Conexiones cruzadas

- **Posición del personaje**: los 4 FKs en `characters` son la única fuente de verdad; sólo
  `MapController::updateLocation` los escribe.
- **Snapshot de ubicación en combate PvP**: `pvp_combats` guarda su propia copia
  (`lugar_id/zona_id/planeta_id/sistema_id`), tomada de la ubicación del **defensor** en el
  momento de crear el reto — es una copia congelada, no una relación viva; y es la razón por la
  que un combate activo bloquea `updateLocation` (evita "teletransportarse" fuera de un duelo en
  curso).
- **Misiones/NPCs**: `map_npcs.MisionID → misiones.id` y el bridge `attachMisionInfo()` — ya
  documentado en el Códice de Misiones y NPCs; aquí sólo nace la ubicación (`LugarID`) de dónde
  vive ese NPC.
- **Inventario**: `map_lugares.pase → rol_objetos.id` es el único mecanismo donde el inventario
  condiciona el movimiento por el mapa.
- **Entrenamiento**: sin acoplamiento — las sesiones/módulos de entrenamiento no referencian
  ninguna columna de ubicación; son independientes de dónde esté el personaje en el mapa.

---

## 7. Piezas declaradas pero sin efecto — para tener en cuenta

| Campo | Dónde vive | Estado |
|---|---|---|
| `map_sistemas.costo_viaje` | Mostrado en tooltip/admin | Nunca se cobra ni se valida |
| `map_zonas.impuestos` | Mostrado en admin | Sin lógica de economía que lo consuma |
| `map_npcs_espacio` (tabla completa) | Modelo + migración + relación | Sin controlador, ruta ni admin — inaccesible salvo por DB directa |
| `map_planetas.eventos_importantes` | Texto libre | Se lee/escribe manualmente o vía la herramienta de IA `registrar_evento_planeta` (Códice de Misiones y NPCs §5); no dispara ningún efecto de juego por sí solo |

Estas cuatro piezas son el mismo patrón que ya se observó en otros sistemas de NÉXUS: el esquema
suele adelantarse al backend — el dato existe y la UI de administración lo expone, pero la regla
de juego que le daría efecto (cobrar el viaje, aplicar el impuesto, resolver un encuentro
espacial) todavía no está escrita.
