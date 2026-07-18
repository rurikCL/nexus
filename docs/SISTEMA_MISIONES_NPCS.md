# Sistema de Misiones y NPCs — NÉXUS

Documentación técnica del sistema de misiones, del sistema de NPCs (incluyendo el motor de
diálogo con IA) y, sobre todo, de la trama de conexión entre ambos — tal como está implementado
hoy en el código.

> Fuentes principales: `app/Http/Controllers/Api/MisionController.php`,
> `app/Http/Controllers/Api/MapController.php` (`npcCumpleRequisitos`, `attachMisionInfo`),
> `app/Http/Controllers/Api/CharacterController.php::npcVictory`,
> `app/Services/MisionProgresoService.php` (tracking automático de objetivos y notificación de
> "misión lista para completar"), `app/Notifications/MisionListaParaCompletar.php`,
> `app/Http/Controllers/Api/TituloController.php`, `app/Models/CharacterTitulo.php`,
> `app/Http/Controllers/Api/MisionController.php::menuVisit`,
> `app/Http/Controllers/Api/NpcChatController.php`, `app/Models/Mision.php`, `app/Models/MapNpc.php`,
> `app/Models/CharacterHito.php`, `resources/js/sections/Misiones.jsx`, `resources/js/sections/Mapa.jsx`,
> `resources/js/sections/Temporadas.jsx`, `resources/js/App.jsx` (cola de misiones, sync de hitos,
> popup de misiones globales), `resources/js/utils/missionTransmission.js`,
> `resources/js/components/NpcCombatScreen.jsx`, `docs/NPC_IA.md`, migraciones en
> `database/migrations/`.

---

## 0. Vista general

Las misiones y los NPCs son dos tablas separadas que se conectan por **una sola columna**
(`misiones.npc_id`) y por **un mecanismo de texto libre compartido**: los "hitos"
(`character_hitos.hito`), que ambos sistemas usan para condicionar qué se ve y qué se puede
completar. No hay un motor de quests con nodos ni máquina de estados — es deliberadamente simple:

```
NPC (quest-giver)  ──da──▶  Misión  ──recompensa──▶  objeto / habilidad / créditos / título / hito
     ▲                                                        │
     └──────── hito_requerimiento (string match) ◀────────────┘
     │
     └──derrota en combate──▶ hito "{npc} derrotado" ──▶ desbloquea otras misiones/NPCs
```

---

## 1. Misiones

### 1.1 Esquema

Tabla `misiones` (columnas efectivas tras todas las migraciones):

```
id, nombre, mision, descripcion, foto_mision,
tipo_mision (individual|comunidad|temporada|global, default individual),
temporada_id (FK opcional), npc_id (FK opcional → map_npcs),
puntos_requeridos (default 100), activa (bool, default true),
notificar (bool, default false — sólo tiene efecto en misiones `global`, ver §1.2), orden,
fecha_inicio, fecha_termino,
hito_requerimiento (texto, hitos separados por coma),
entregar_hito (texto, hitos separados por coma),
recompensa_id / objetivo_id (legacy, FK únicos — superados por las tablas hijas de abajo)
```

Dos tablas hijas (1 misión → N filas), normalizadas en `2026_06_30_230001_extend_misiones_sistema.php`:

- **`objetivos`**: `mision_id, nombre, descripcion, tipo (general|entrenamiento|combate|tarea|viaje|dialogo|menu|hito|automatico),
  meta, unidad, progreso_tipo (conteo|porcentaje)`.
- **`recompensas`**: `mision_id, nombre, descripcion, tipo (habilidad|objeto|creditos|titulo|insignia|hito),
  valor, imagen, habilidad_id, objeto_id, hito`.

Pivot de asignación **por usuario, no por personaje** — `mision_user`:
```
mision_id, user_id, status (pendiente|en-curso|completada), progreso (0-100),
progreso_json (mapa de progreso por objetivo)
```

### 1.2 Cuatro tipos de misión

| `tipo_mision` | Quién la asigna | Cómo se sigue el progreso |
|---|---|---|
| **individual** | Un NPC específico (`npc_id`) — sólo aparece al jugador si ya la aceptó desde el diálogo de ese NPC | `progreso_json` por objetivo |
| **comunidad** | Global, compartida por todos los que se unen | Suma de `progreso` de todos los participantes vs `puntos_requeridos` |
| **temporada** | Ligada a una `Temporada` | Igual que individual/comunidad, filtrada por `temporada_id` |
| **global** | Nadie en particular — visible para todos vía `GET /misiones/global`, el jugador la acepta explícitamente | `progreso_json` por objetivo, igual que individual |

**`global` es la única sin NPC ni temporada** — es la forma de dar una misión "de mundo" sin
atarla a un quest-giver. Tiene un campo propio, `notificar` (bool): si está en `true`, el cliente
(`App.jsx`) muestra un popup de misión (`enqueueMissionAlert`) apenas el jugador entra a una
sesión, siempre que aún no la haya aceptado (`!aceptada`), no esté `completada` y cumpla sus
`hito_requerimiento` (`cumple_hitos`). Es la única forma de "empujar" una misión al jugador sin que
tenga que visitar a un NPC o abrir el pase de temporada. El toggle vive en `Admin.jsx` como "¿Mostrar
popup al ingresar?".

### 1.3 Recompensas — lo que realmente otorga el backend

`MisionController::completar()` concede automáticamente los tipos con efecto real:

| `recompensa.tipo` | Efecto real |
|---|---|
| `habilidad` | `user->habilidadesAprendidas()->syncWithoutDetaching([habilidad_id])` |
| `objeto` | `character->rolObjetos()->syncWithoutDetaching([objeto_id])`, si hay espacio en el inventario (si no, queda en `objetos_sin_espacio` y no se entrega) |
| `creditos` | `character->increment('credits', valor)` |
| `titulo` / `insignia` | `character->titulos()->firstOrCreate(['nombre' => recompensa.nombre], ['tipo', 'mision_id'])` — se persiste en `character_titulos` (ver §1.3.1), ya no es sólo cosmético |
| `hito` | `CharacterHito::firstOrCreate(['character_id' => ..., 'hito' => recompensa.hito|nombre])`, y además dispara `MisionProgresoService::registrarHito()` (encadena objetivos `hito` de otras misiones, ver §1.5) |

### 1.3.1 Títulos e insignias — se ganan, se guardan y se equipan

Desde `2026_07_15_180000_create_character_titulos_table.php` existe `character_titulos`
(`character_id, nombre, tipo (titulo|insignia), mision_id (FK opcional a la misión que lo otorgó),
activo`, único por `(character_id, nombre)`). Cuando `completar()` otorga una recompensa
`titulo`/`insignia`, crea (o reutiliza si ya existía) una fila ahí — el personaje **acumula**
títulos e insignias como una colección, no como un solo valor.

De esa colección, a lo sumo **uno** puede estar `activo` a la vez — el que se muestra como badge
bajo el nombre del personaje (`Comando.jsx`, `Combatientes.jsx`, `PublicProfilePage.jsx`, la cabecera
de `App.jsx`). `TituloController` expone la gestión:

| Endpoint | Efecto |
|---|---|
| `GET /titulos` | Lista los títulos/insignias que el personaje ha ganado |
| `POST /titulos/{id}/activar` | Desactiva todos los demás y activa este — sólo puede haber uno visible |
| `POST /titulos/desactivar` | No mostrar ningún título |

`GET /api/me` incluye `character.titulos` (la colección completa) y `character.titulo_activo` (el
que está marcado, o `null`).

### 1.4 Gating de finalización — hitos **y** objetivos

`POST /misiones/{id}/completar` (`MisionController::completar`) valida dos cosas antes de marcar
la misión como completada — ambas son bloqueantes (HTTP 403 si fallan):

```php
// 1) Hitos requeridos (character_hitos, comparación de texto)
if ($mision->hito_requerimiento) {
    $requeridos = explode(',', $mision->hito_requerimiento);       // ej: "Sable robado recuperado, Kex derrotado"
    $tieneHitos = $character->hitos()->whereIn('hito', $requeridos)->pluck('hito');
    $faltantes  = array_diff($requeridos, $tieneHitos);
    if ($faltantes) return 403 "No cumples los hitos requeridos", faltantes;
}

// 2) Objetivos — progreso_json de mision_user vs meta de cada objetivo
if ($mision->objetivos->isNotEmpty()) {
    $progresoJson = json_decode($pivot->progreso_json, true) ?? [];
    $faltantes = $mision->objetivos->filter(fn ($o) => ($progresoJson[$o->id] ?? 0) < $o->meta);
    if ($faltantes->isNotEmpty()) return 403 "Aún no completas todos los objetivos", faltantes;
}

// marca completada, otorga recompensas...
if ($mision->entregar_hito) {
    foreach (explode(',', $mision->entregar_hito) as $hito) {
        CharacterHito::firstOrCreate([character_id, hito: trim($hito)]);
    }
}
```

Este mismo par de condiciones se expone también como `cumple_hitos` + `objetivos_completos` →
`puede_completar` en los endpoints de lectura (`attachMisionInfo` para el diálogo de NPC, ver §3;
`porTemporada` para el pase de batalla), para que el frontend deshabilite el botón "Completar"
antes de intentar la llamada. Pero la validación real y bloqueante vive en el servidor, en
`completar()` — el frontend no puede saltársela.

### 1.5 Tracking automático de objetivos — `MisionProgresoService`

Antes, nada en el juego escribía `progreso_json` — sólo existía `PATCH /misiones/{id}/progress`
para hacerlo a mano. Ahora `App\Services\MisionProgresoService::registrar($user, $tipo, $cantidad)`
se llama desde los puntos del código donde ocurre un evento de juego real:

1. Busca todas las misiones **activas** con al menos un objetivo de ese `tipo`.
2. Incrementa `progreso_json[objetivo_id]` en `$cantidad` para cada uno (tope: `meta` del objetivo).
3. Recalcula `progreso` (0-100) como el promedio de avance de **todos** los objetivos de la misión,
   no sólo los del tipo recién incrementado.
4. Sube `status` a `en-curso` si `progreso > 0` — **nunca** lo pone en `completada`; eso sigue
   siendo una acción explícita del jugador vía `POST /completar` (que es quien realmente entrega
   las recompensas).
5. Si el usuario no tenía fila en `mision_user` para esa misión, la crea — auto-inscripción al
   primer avance, no hace falta `POST /accept` antes de que el progreso empiece a contar.

Tipos de objetivo con tracking automático conectado hoy:

| `objetivo.tipo` | Se dispara desde | Cantidad |
|---|---|---|
| `combate` | `PvpCombatController::action()` — victoria PvP (al ganador) | +1 |
| `combate` | `CharacterController::npcVictory` / `npcEspacioVictory` | +1 |
| `entrenamiento` | `SesionEntrenamientoController::attend` / `attendScan` — cada asistente marcado (incluido el encargado) | +1 |
| `tarea` | `TaskController::approve` — el tutor aprueba la tarea del pupilo | +1 |
| `menu` | `POST /misiones/menu-visit` al visitar una vista del SPA | completa la meta del objetivo |
| `hito` | `MisionProgresoService::registrarHito()` al obtener el hito desde cualquier fuente | completa la meta del objetivo |
| `automatico` | `POST /misiones/{id}/accept` al aceptar la misión | completa la meta del objetivo |

**`general` sigue siendo manual** — es un tipo "cajón de sastre" (viajar, comprar, equipar, enviar
un mensaje, etc.) sin un único evento de juego al que engancharse; su progreso todavía depende de
`PATCH /misiones/{id}/progress`. Lo mismo aplica a `viaje`/`dialogo` si se usan — no tienen hook
automático hoy. `hito` depende de que el personaje adquiera un `character_hitos.hito` exacto.
`automatico` no depende de eventos externos: se marca al aceptar la misión.

### 1.5.1 Objetivos tipo `menu`

Los objetivos con `tipo = menu` usan `unidad` como el slug exacto de la vista que el jugador debe
visitar. El frontend dispara `POST /api/misiones/menu-visit` al cambiar de vista; el backend busca
objetivos activos con `tipo = menu` y `unidad = <slug>` y los marca como completos en el pivot de
misión.

Los objetivos con `tipo = hito` usan `unidad` como el nombre exacto del hito que debe existir en
`character_hitos`. No entregan un hito nuevo: son un requisito que se completa cuando ese hito ya
existe en el personaje. Cuando ese hito entra al personaje desde cualquier fuente, el sistema vuelve
a consultar `/api/me`, refresca la cola de misiones y marca ese objetivo como completado en vivo.

### 1.5.2 Notificación "misión lista para completar"

Cada punto donde `MisionProgresoService` escribe `progreso_json` (`registrar`, `registrarMenu`,
`registrarHito`) y también `MisionController::accept()` / `updateProgress()` terminan llamando a
`MisionProgresoService::notificarSiListaParaCompletar($user, $mision, $progresoAntes, $progresoDespues)`.
Es una notificación **de flanco**, no de nivel:

```php
if (! puedeCompletarCon($user, $mision, $progresoDespues)) return;   // sigue sin poder completarse: nada
if (puedeCompletarCon($user, $mision, $progresoAntes)) return;      // ya podía completarse antes: nada (evita spam)
$user->notify(new MisionListaParaCompletar($payload));              // pasó de "no completable" a "completable": notifica
```

`puedeCompletarCon()` (mismo servicio) es la lógica canónica y única de "¿puede completarse esta
misión?" — hitos requeridos cumplidos **y** todos los objetivos al 100%; es la misma condición que
alimenta `puede_completar` en todos los endpoints de lectura (§1.4).

`MisionListaParaCompletar` (`app/Notifications/`) se envía por `database`, `broadcast` (Pusher,
canal privado del usuario) y `WebPushChannel` — igual que el resto de notificaciones del sistema.
Su payload incluye nombre de la misión, hasta 2 objetivos y hasta 2 recompensas resumidas, y
`action_url: '/misiones'`. El cliente la reconoce por `type === 'mision_lista_para_completar'` y la
enruta al mismo `enqueueMissionAlert()` que usa el popup de misiones `global` (§1.2) — ambos casos
terminan mostrando la `TransmisionOverlay` con los datos de la misión ya resueltos contra
`GET /misiones/{global|individual|comunidad|temporada}` (`resolveMissionAlert` en `App.jsx`).

Slugs actuales documentados para configuración manual:

| Slug | Vista |
|---|---|
| `comando` | Centro de Comando |
| `personaje` | Mi Personaje |
| `sesiones` | Entrenamiento |
| `entrenamiento` | Bitácora |
| `modulos-entrenamiento` | Módulos de Entrenamiento |
| `tareas` | Tareas |
| `misiones` | Misiones |
| `eventos` | Eventos |
| `ranking` | Ranking |
| `combates` | Combates |
| `combatientes` | Usuarios |
| `competitivo` | Competitivo |
| `temporadas` | Temporadas |
| `mapa` | Mapa Galáctico |
| `instagram` | Instagram |
| `configuracion` | Configuración |
| `armado-sable` | Armado de Sable |

### 1.6 Ciclo de vida completo

```
1. Admin (tier caballero|maestro|granmaestro) crea la misión — POST /misiones
   → opcionalmente le asigna un npc_id, objetivos[], recompensas[], hito_requerimiento/entregar_hito
   → si tipo_mision = global, puede marcar notificar=true para que aparezca como popup al ingresar

2. El jugador se entera de que la misión existe
   → visita el lugar del NPC en el mapa: GET /map/lugar/{id} adjunta `mision_disponible` (ver §3)
   → o abre el pase de batalla en Temporadas: GET /misiones/temporada/{id}
   → o, si es `global` y `notificar=true`, recibe un popup automático al iniciar sesión
     (ver §1.2) sin visitar nada

3. El jugador acepta — POST /misiones/{id}/accept
   → upsert mision_user: status=pendiente, progreso=0
   (las misiones de temporada no requieren este paso: `completar` hace upsert igual si no existía;
   las de comunidad se aceptan uniéndose desde `Misiones.jsx`)

4. Progreso
   → automático para objetivos `combate`/`entrenamiento`/`tarea` — MisionProgresoService (§1.5)
   → automático para objetivos `menu` — POST /misiones/menu-visit (§1.5.1)
   → automático para objetivos `hito` — MisionProgresoService::registrarHito() (§1.5.1)
   → automático para objetivos `automatico` — POST /misiones/{id}/accept
   → manual para el resto — PATCH /misiones/{id}/progress (progreso, status, progreso_json)
   → cada actualización de progreso puede disparar la notificación "misión lista para
     completar" si recién se cumplieron todas las condiciones (§1.5.2)

5. Completar — POST /misiones/{id}/completar
   → valida hito_requerimiento Y que todos los objetivos estén al 100% (ver §1.4)
   → marca status=completada, progreso=100
   → otorga recompensas (habilidad/objeto/creditos/titulo/insignia/hito) — titulo/insignia y hito
     ahora se persisten (§1.3, §1.3.1)
   → escribe entregar_hito en character_hitos
```

### 1.7 Sin FK al mapa — la ubicación llega por el NPC

Las misiones **no** tienen columnas hacia `map_sistemas/map_planetas/map_zonas/map_lugares`. Toda
ubicación mostrada al jugador ("dada por {npc} en {lugar}") llega indirectamente:
`misiones.npc_id → map_npcs.LugarID → map_lugares`.

### 1.8 UI — `Misiones.jsx`, `Temporadas.jsx` y `Admin.jsx`

- `Misiones.jsx` (vista de jugador): tres secciones apiladas, no pestañas — **Global**
  (`GlobalSection`, sólo misiones donde `cumple_hitos || aceptada || completada_por_mi`, con botón
  para aceptarlas ahí mismo), **Comunidad** (barra de progreso global + participantes) e
  **Individual** (sólo misiones con NPC asignado que el jugador ya aceptó desde el diálogo),
  cada una separada en activas/completadas. No hay CRUD de misiones aquí.
- `Temporadas.jsx` → `MisionesTemporadaModal` (pase de batalla de la temporada activa): cada
  misión de la lista es clickeable y abre `MisionDetallePopup` (modal apilado) con foto,
  descripción, cada objetivo con su propia barra de progreso (`progreso_actual`/`meta`), hitos
  requeridos (resaltados en verde si ya se cumplen) y recompensas. Incluye el botón **"Completar
  misión"**, habilitado sólo cuando `puede_completar` es `true`, que llama al mismo
  `POST /misiones/{id}/completar` que usa el diálogo de NPC — es el mismo endpoint, tres puntos de
  entrada de UI distintos (diálogo de NPC, `Misiones.jsx`, pase de temporada).
- `Admin.jsx` → `MisionesAdmin`: formulario completo — selector de `tipo_mision` (incluye
  `global`), campos condicionales (`temporada_id` / `puntos_requeridos` / selector de NPC /
  toggle `notificar` para `global`), carga de `foto_mision`, tag-inputs para hitos, listas
  dinámicas de objetivos y recompensas.
- La cola lateral de misiones y los popups de disponibilidad se recalculan cuando cambian los
  hitos del personaje: además de refrescar `/api/me` tras cada acción del propio jugador, `App.jsx`
  hace **polling cada 15 segundos** a `/api/me` comparando una firma serializada de
  `character.hitos` — si cambió (p. ej. otro flujo del juego otorgó un hito, o un admin lo hizo a
  mano), llama a `onUserUpdate` y dispara `nx-mision-updated`, así no hace falta recargar la
  página ni que el propio jugador dispare la acción para ver objetivos `hito` o nuevas misiones
  desbloqueadas.

---

## 2. NPCs (`map_npcs`)

### 2.1 Esquema

```
id, LugarID (FK → map_lugares), nombre, tipo (aliado|hostil|entrenador|vacío=neutral),
profesion, faccion, imagen_mini, imagen, saludo, interaccion (diálogo estático),
prompt (persona de IA), MisionID (legacy FK, superada por misiones.npc_id),
urlInteraccion, visible (bool),
vida, escudo, defensa, ataque, movimiento, iniciativa, punteria,   ← stats de combate idénticos a Character
hito_requerimiento, fecha_inicio, fecha_fin   ← gating de visibilidad del propio NPC
```

Un NPC tiene, literalmente, **las mismas 7 estadísticas de combate que un personaje jugador**
(`vida/escudo/defensa/ataque/movimiento/iniciativa/punteria`) — se usan directo en el simulador
de combate del cliente (§4).

Existe también `MapNpcEspacio` (encuentros en `map_sistemas`, naves con hostilidad/cargamento) —
un subsistema paralelo con su propio `MisionID` legacy que **no está conectado** a
`MisionController` ni a ningún flujo real; parece quedar sin desarrollar.

### 2.2 Tipo de NPC (`tipo`) — determina combate y reputación

| `tipo` | ¿Atacable? | Efecto en reputación al ganar |
|---|---|---|
| `aliado` | No (sin botón ATACAR) | — |
| `hostil` | Sí — además puede **emboscar solo**: 1d6, ≥4 inicia combate automáticamente | +25 |
| `entrenador` | Sí | Sin efecto (dummy de entrenamiento) |
| *(vacío) = neutral* | Sí, pero atacarlo es una decisión — penaliza de inmediato | **−25** al atacar antes de iniciar combate |

### 2.3 Dos capas de gating independientes

1. **Visibilidad del NPC** (`MapController::npcCumpleRequisitos`) — controla si el NPC siquiera
   aparece en el lugar para ese personaje: `hito_requerimiento` del NPC (match contra
   `character_hitos`) + ventana `fecha_inicio`/`fecha_fin`.
2. **Completitud de la misión** (`MisionController::completar`) — controla si, ya visible y
   aceptada, la misión puede cerrarse: `hito_requerimiento` **de la misión** (mismo mecanismo,
   campo distinto).

Un mismo hito puede usarse para ambas capas a la vez — no están acopladas por diseño, sólo
comparten la tabla `character_hitos` como fuente de verdad.

---

## 3. El puente Misión ↔ NPC: `attachMisionInfo()`

Cada vez que el backend devuelve NPCs de un lugar (`MapController::lugar()` / `npc()`), por cada
NPC busca **la primera** misión activa donde `misiones.npc_id = npc.id`, cruza el `mision_user`
del usuario actual y sus hitos, y adjunta:

```php
npc.mision_disponible = {
  id, nombre, mision, descripcion, foto_mision,
  hito_requerimiento, entregar_hito,
  objetivos: [{ id, nombre, descripcion, tipo, meta, unidad, progreso_actual, completado }],
  recompensas[],
  estado,                      // el status del pivot mision_user, si existe
  puede_completar: pivot && pivot.status !== 'completada' && cumpleHitos && objetivosCompletos
}
```

`progreso_actual`/`completado` por objetivo salen de `progreso_json` del pivot del usuario —
alimentado por `MisionProgresoService` (§1.5) para los tipos con tracking automático, o por
`PATCH /misiones/{id}/progress` a mano para el resto. `porTemporada()` (usado por `Temporadas.jsx`) devuelve la
misma forma de `objetivos[]` y el mismo `puede_completar`, calculado con la lógica idéntica.

El frontend (`Mapa.jsx`) lee `npc.mision_disponible` directamente para:
- pintar el badge de "misión disponible" en la `NpcCard` de la grilla del lugar,
- habilitar el botón **"Consultar por misión"** dentro del modal de diálogo (`DialogoRPG`),
  que abre un popup con **Aceptar** (`POST /misiones/{id}/accept`) o **Completar**
  (`POST /misiones/{id}/completar`) según el estado.

**Diálogo estático con misión embebida:** cuando el NPC no usa IA, su campo `interaccion` es
texto con líneas `- palabra_clave[misionId]: respuesta` — elegir esa opción de diálogo dispara
directamente `POST /misiones/{misionId}/accept`, sin pasar por el popup dedicado.

---

## 4. Combate contra NPC — no es el motor PvP

A diferencia del duelo jugador-contra-jugador (`PvpCombat`, ver el Códice de Rol y Combate), el
combate contra NPC:

- **No tiene tabla propia** — se simula enteramente en `resources/js/components/NpcCombatScreen.jsx`,
  con estado persistido en `localStorage` (`nx-npc-combat`), no en la base de datos.
- Usa las mismas reglas conceptuales (iniciativa 1d20, ataque/puntería vs defensa/movimiento,
  escudo antes que vida, habilidades por Forma con costo de Fuerza y cooldown) pero calculadas
  en el cliente contra los stats fijos del NPC.
- Al terminar, sólo dos llamadas tocan el servidor:
  - **Reputación** (`±25` hostil ganado, `−50` neutral atacado) — se ajusta ya sea al iniciar
    (ataque a neutral) o al ganar (hostil).
  - **Victoria** — `POST /character/npc-victory`:
    ```php
    $hito = "{$npc->nombre} derrotado";
    CharacterHito::firstOrCreate(['character_id' => $character->id, 'hito' => $hito]);
    ```

Esta es la pieza clave de la interacción: **derrotar a un NPC siempre genera un hito con el
nombre exacto `"{NPC} derrotado"`**, sin ninguna tabla intermedia — es matching de texto puro. Un
diseñador de contenido gatilla una misión (o revela otro NPC) detrás de "hay que vencer a Kex"
simplemente escribiendo `Kex derrotado` en el campo `hito_requerimiento` correspondiente.

---

## 5. Diálogo con IA — cuando el NPC "piensa solo"

Si `map_npcs.prompt` tiene contenido, el diálogo estático se reemplaza por conversación libre con
**Mistral AI** (`open-mistral-nemo`, según `docs/NPC_IA.md`), con seis herramientas de function
calling que el modelo puede invocar contra la base de datos real del universo:

| Herramienta | Acceso |
|---|---|
| `buscar_personaje` | lectura — `characters` |
| `ficha_completa_personaje` | lectura — `characters, users, combats` (incluye últimos 5 combates) |
| `personajes_en_lugar` | lectura — personajes presentes en un lugar/planeta/sistema |
| `info_ubicacion` | lectura — `map_lugares` + NPCs visibles + personajes presentes |
| `consultar_eventos_planeta` | lectura — `map_planetas.eventos_importantes` |
| `registrar_evento_planeta` | **escritura** — agrega una línea `[fecha] descripción` al planeta |

Límites: 15 respuestas por usuario/NPC cada 5 minutos (configurable en la tabla
`configuraciones`), 8 mensajes de historial enviados, 220 tokens por respuesta. Todo se persiste
en `npc_chat_logs (user_id, npc_id, role, content)`.

**El chat con IA es ortogonal al sistema de misiones** — no existe ninguna herramienta tipo
`dar_mision` o `verificar_mision`; la disponibilidad de misión sigue mostrándose vía
`mision_disponible` como una capa de UI aparte, tanto si el NPC está en modo IA como si usa
diálogo estático. La única escritura que la IA puede hacer al mundo es el log de eventos del
planeta, no otorgar ni completar misiones.

---

## 6. Cómo se conecta todo

```
Admin crea misión ──(npc_id)──▶ NPC queda como "quest-giver"
                                        │
Jugador visita el lugar del NPC ──▶ attachMisionInfo() adjunta mision_disponible
                                    (cruza mision_user + hito_requerimiento del jugador)
                                        │
                          ┌─────────────┴─────────────┐
                          ▼                           ▼
              Diálogo estático [misionId]     "Consultar por misión" (IA o estático)
                          │                           │
                          └──────────POST /accept──────┘
                                        │
       ┌────────────────────────────────┴────────────────────────────────┐
       ▼                                                                 ▼
Evento de juego (combate ganado,                            POST /misiones/menu-visit
asistencia, tarea aprobada)                                  (objetivos `menu`)
       │
       ▼
MisionProgresoService::registrarMenu()
                                        │
                                        ├──────────────▶ progreso_json + progreso (sin marcar 'completada')
                                        │
Evento de juego (combate ganado,                           PATCH /misiones/{id}/progress
asistencia, tarea aprobada)                                (manual — resto de tipos)
       │
       ▼
MisionProgresoService::registrar()  ──▶  progreso_json + progreso (nunca 'completada')
                                        │
                    cada escritura de progreso ──▶ notificarSiListaParaCompletar()
                    (§1.5.2 — sólo notifica en el flanco "pasó a ser completable")
                                        │
                              POST /completar
              (revalida hito_requerimiento Y que los objetivos estén al 100%)
                                        │
        ┌───────────────┬──────────────┼──────────────────┬──────────────────┐
        ▼               ▼              ▼                  ▼                  ▼
  habilidad/objeto   créditos   character_hitos    character_titulos   registrarHito()
  (recompensa)       (recompensa) (entregar_hito +  (recompensa         (encadena objetivos
                                  recompensa hito)   titulo/insignia,    `hito` de otras
                                                      equipable vía      misiones — §1.5.1)
                                                      TituloController)
                                        │
                                        ▼
                    gatilla nuevas misiones / revela nuevos NPCs
                    (comparación de texto contra hito_requerimiento)
                                        ▲
                                        │
        Derrotar un NPC (NpcCombatScreen, cliente) ──POST /npc-victory──▶ hito "{npc} derrotado"
                                                                        ──▶ MisionProgresoService('combate')
        Atacar NPC hostil/neutral ──▶ ±reputación (independiente del sistema de misiones)

Misión `global` con notificar=true ──▶ popup al iniciar sesión (App.jsx), sin pasar por NPC ni mapa
```

**Conclusiones clave:**

- La conexión Misión↔NPC es **1 a 1 por diseño de UI** (`attachMisionInfo` sólo toma la primera
  misión activa por NPC), aunque el esquema permitiría varias.
- Todo el sistema de prerequisitos (misiones y NPCs) se resuelve por **comparación de strings**
  contra `character_hitos.hito` — no hay FKs ni enums; la disciplina de nombrado (p. ej. siempre
  `"{Nombre} derrotado"`) es una convención de contenido, no una restricción de esquema.
  El combate contra NPC es el único generador automático de hitos hoy; el resto de los hitos
  se otorgan manualmente vía `entregar_hito` al completar una misión.
- El progreso de objetivos `combate`/`entrenamiento`/`tarea` se registra automáticamente
  (`MisionProgresoService`, §1.5) desde eventos reales del juego; `menu` se registra al visitar
  una vista del SPA (`POST /misiones/menu-visit`, §1.5.1); `hito` se registra al obtener el hito
  desde cualquier fuente (`registrarHito()`, §1.5.1); el resto de los `tipo` (`general`, `viaje`,
  `dialogo`...) sigue dependiendo de `PATCH /misiones/{id}/progress` manual. `automatico` se
  completa al aceptar la misión.
- `completar()` ahora es un gate doble — hitos **y** objetivos — reforzado en el servidor, no sólo
  en la UI (el botón deshabilitado en el cliente es una comodidad, no la protección real).
- Las recompensas `titulo`/`insignia` y `hito` dejaron de ser cosméticas: `titulo`/`insignia` se
  acumulan en `character_titulos` con un mecanismo de "equipar" (§1.3.1) y `hito` escribe en
  `character_hitos` igual que `entregar_hito`, encadenando objetivos `hito` de otras misiones.
- El sistema notifica proactivamente cuando una misión pasa a ser completable
  (`MisionListaParaCompletar`, §1.5.2), y separadamente puede empujar misiones `global` como popup
  al iniciar sesión (`notificar`, §1.2) — dos mecanismos de notificación distintos, uno reactivo a
  progreso y otro basado en una bandera de configuración.
- El cliente sincroniza `character_hitos` con polling cada 15s a `GET /api/me` (además de tras cada
  acción propia) para detectar cambios en el mapa de hitos y refrescar la cola de misiones/paneles
  sin recargar la página.
- El diálogo con IA es una capa de presentación y de "world-building" (puede escribir eventos de
  lore) totalmente separada del pipeline de misiones — comparten el mismo NPC pero no se
  comunican entre sí en el backend.
