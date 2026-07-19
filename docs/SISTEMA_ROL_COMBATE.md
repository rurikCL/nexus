# Sistema de Rol y Combate — NÉXUS

Documentación técnica del sistema de personaje, entrenamiento, objetos/inventario y combate,
tal como está implementado hoy en el código. Incluye al final un análisis de viabilidad para
llevar el sistema a un juego de mesa.

> Fuentes principales: `app/Models/Character.php`, `app/Models/CharacterSable.php`,
> `app/Models/RolObjeto.php`, `app/Models/RolHabilidad.php`, `app/Models/MapNpc.php`,
> `app/Models/MapEnemigo.php`, `app/Models/MapLugar.php`, `app/Models/TorneoCombate.php`,
> `app/Support/Combat/AplicaEstadosCombate.php`,
> `app/Http/Controllers/Api/PvpCombatController.php`, `app/Http/Controllers/Api/RaidCombatController.php`,
> `app/Http/Controllers/Api/CombatController.php`, `app/Http/Controllers/Api/CombatantController.php`,
> `app/Http/Controllers/Api/TorneoController.php`, `app/Http/Controllers/Api/LugarEncuentroController.php`,
> `app/Http/Controllers/Api/CharacterController.php`, `app/Http/Controllers/Api/SableController.php`,
> `app/Http/Controllers/Api/ModuloEntrenamientoController.php`, `app/Http/Controllers/Api/SesionEntrenamientoController.php`,
> `resources/js/data/seed.js`, `resources/js/components/PvpCombatScreen.jsx`,
> `resources/js/components/RaidCombatScreen.jsx`, `resources/js/components/NpcCombatScreen.jsx`,
> `resources/js/sections/Combatientes.jsx`, `resources/js/sections/Admin.jsx`,
> migraciones en `database/migrations/`.

---

## 0. Vista general — cinco sistemas que conviene no confundir

1. **`Combat` ("Combates")** — enfrentamientos programados, evaluados manualmente por un tutor,
   con apuestas (`bets`) y una rúbrica de puntaje. No hay tiradas de dados; el resultado lo decide
   una persona. Ver sección 3.8.
2. **`PvpCombat` ("PvP")** — motor de duelo automático 1 contra 1 basado en tiradas de dado (1d20),
   con vida, escudo, formas/estilos de combate, habilidades y **estados de combate**. Servidor
   autoritativo. Documentado en detalle en la sección 3.
3. **`RaidCombat` ("Raid")** — motor grupal (2 a 4 jugadores) contra un NPC "jefe", servidor
   autoritativo, reutiliza el mismo motor de estados que el PvP. Sección 7.
4. **Combate NPC 1 contra 1 (client-side)** — enfrentamientos contra un `MapNpc` no-jefe o un
   `MapEnemigo` de encuentro aleatorio, resuelto **100% en el navegador** (sin servidor
   autoritativo), persistido en `localStorage`. Sección 6.
5. **`Torneo` (bracket)** — llaves de eliminación directa, inscripción propia, resultado de cada
   combate cargado a mano por un tutor (puntaje tipo esgrima, sin dados). Independiente de los
   otros cuatro sistemas. Sección 8.

Además existe un estado de mock en `resources/js/store/useStore.js` (localStorage `nx-state-v3`)
que simula créditos/combate en el cliente pero **no está conectado** a ninguna de las rutas reales
(`/api/pvp/*`, `/api/raids/*`, `/api/combats`, `/api/torneos/*`). Es scaffolding legado, no forma
parte del sistema real.

Los sistemas 2 y 3 (PvP y Raid) comparten el mismo motor de **estados de combate** (parálisis,
aturdimiento, sangrado, etc. — sección 4) a través del trait `AplicaEstadosCombate`, y el sistema 4
(NPC client-side) implementa una réplica en JavaScript del mismo trait para poder jugarse offline.

---

## 1. El personaje (Rol)

### 1.1 Estadísticas base

El personaje de combate se guarda directamente con 7 **estadísticas** en la tabla `characters`:

| Estadística | Campo | Rol |
|---|---|---|
| Vida | `vida` | Vida máxima / actual de combate |
| Escudo | `escudo` | Barrera antes de dañar vida |
| Defensa | `defensa` | Mitiga ataques cuerpo a cuerpo |
| Ataque | `ataque` | Potencia golpes cuerpo a cuerpo |
| Movimiento | `movimiento` | Esquiva y maniobra |
| Iniciativa | `iniciativa` | Orden de actuación |
| Puntería | `punteria` | Precisión a distancia |

En el alta del personaje estas stats quedan inicializadas con valores fijos de partida
(`vida=8, escudo=4, defensa=2, ataque=2, movimiento=2, iniciativa=2, punteria=2`),
y `puntos_libres` se reparte después desde la UI para subirlas manualmente.

No hay un modelo vigente de 5 atributos 0–100 que alimente el combate actual. Esa idea quedó
como texto legado en el formulario de perfil y no debe tomarse como la fuente de verdad del
sistema de combate.

### 1.2 Rango (tier), Grado y Clase

- **`tier`** (rango): `iniciado → padawan → caballero → maestro → granmaestro`. Es un campo
  administrado a mano, **no se calcula automáticamente** por victorias (existe una función
  legada `tierOf(wins)` en `seed.js` que no usa el backend). Solo un usuario cuyo propio `tier`
  ya sea `caballero|maestro|granmaestro` puede editar el rango de otro.
- **`grado`**: entero 1–5, sólo aplica si `tier === 'caballero'`.
- **`clase`**: `Sentinela | Guardian | Consul` (arquetipo dentro de la orden). `clase='Guardian'`
  además habilita revisar/aprobar módulos de entrenamiento.

### 1.3 Forma de combate (estilo de sable)

7 "Formas" clásicas de esgrima con sable (numeradas 1–7), definidas en `seed.js` como las
clases jugables:

| # | Forma | Nombre |
|---|---|---|
| 1 | Shii-Cho | forma básica |
| 2 | Makashi | duelista |
| 3 | Soresu | defensiva |
| 4 | Ataru | acrobática/agresiva |
| 5 | Shien/Djem So | intermedia ofensiva |
| 6 | Niman | híbrida |
| 7 | Juyo/Vaapad | agresiva avanzada |

Cada personaje tiene `current_forma` (la postura activa en combate) y un set de habilidades
equipadas **por forma** (`habilidades_por_forma`, JSON `{"1":[id,id,null,null], "2":[...], ...}`) —
hasta 4 habilidades por cada una de las 7 formas, gestionado vía `POST /api/character/habilidades`.
Cambiar de forma en combate consume el turno pero no cuesta Fuerza.

### 1.4 Puntos libres

`puntos_libres` (default 5, asignados sólo al crear el personaje; no se encontró ninguna fuente
que los repongan después) se gastan 1 a 1 desde la UI (`Comando.jsx`, `combatBump`) para subir
manualmente cualquiera de las 7 estadísticas de combate (`vida, escudo, ataque, defensa,
movimiento, iniciativa, punteria`).

### 1.5 Hitos (Milestones)

`CharacterHito` registra banderas de progreso — p. ej. `"{rival} derrotado"` al ganar un PvP.
Las misiones pueden exigir un hito para desbloquearse (`hito_requerimiento`) y otorgar uno nuevo
al completarse (`entregar_hito`). Es el mecanismo de "quests con prerequisitos".

---

## 2. Entrenamiento

Tres piezas separadas:

### 2.1 Módulos de entrenamiento (catálogo)

`modulos_entrenamiento`: contenido de referencia (no progreso por usuario). Campos relevantes:
`nombre, descripcion, objetivos[], foco (Técnica|Cardio|Sparring|Footwork|Fuerza|Estudio|Recuperación),
esfuerzo (1–10), forma (opcional, forma1..7), nivel_dificultad (basico|intermedio|avanzado|experto),
estado (pendiente|revision|confirmado), rango (opcional — a qué rango apunta el módulo)`.

Creación/edición restringida a `caballero|maestro|granmaestro`. La revisión/aprobación requiere
`clase='Guardian'` o `tier ∈ {maestro, granmaestro}`.

Los módulos pueden llevar fotos generadas por IA (Mistral, `mistral-medium-latest`, tool de
`image_generation`) vía `ModuloFotoController`, convertidas a WebP y asociadas al módulo.

**Importante:** los módulos son contenido de referencia — **no** modifican automáticamente
estadísticas ni otorgan puntos. La progresión de stats sigue siendo manual (`puntos_libres`).

### 2.2 Sesiones de entrenamiento (`Training` / asistencia)

Sesiones programadas (`Entrenamiento Oficial/Libre, Actividad, Taller, Reunión`), creadas sólo
por tutores (`caballero|maestro|granmaestro`), con nodos de plan (`TrainingPlanNode`) que
referencian módulos del catálogo o texto libre.

**Recompensa de asistencia:** marcar asistencia (`POST /sesiones/{id}/attend`) otorga
**+75 créditos** al personaje (`character->increment('credits', 75)`); des-marcar la revierte.
Es la única recompensa numérica automática ligada al entrenamiento.

Cerrar una sesión registra un debrief grupal (foco/esfuerzo/nota/tags) — informativo, no otorga
recompensas individuales.

---

## 3. Combate PvP — el motor de reglas

Toda la lógica vive en `PvpCombatController` (`app/Http/Controllers/Api/PvpCombatController.php`).

### 3.1 Estadísticas de combate

El combate usa directamente las 7 columnas del personaje, más los bonos del sable activo:

```php
vida       = (vida       ?? 8) + bonoSable.vida
escudo     = (escudo     ?? 4) + bonoSable.escudo
ataque     = (ataque     ?? 2) + bonoSable.ataque
defensa    = (defensa    ?? 2) + bonoSable.defensa
movimiento = (movimiento ?? 2) + bonoSable.movimiento
iniciativa = (iniciativa ?? 2) + bonoSable.iniciativa
punteria   = (punteria   ?? 2) + bonoSable.punteria
```

Después cada valor se recorta al rango activo del sistema (`1..cap_stats_items`), y el resultado
final es el que consume PvP / Raid / combate NPC. No interviene ninguna fórmula de 5 atributos
base en el motor actual.

### 3.2 Recurso "Fuerza" (Force Points)

```php
fuerzaMax = 10 + bonoSable.fuerza
fuerzaGen = 2  + bonoSable.generacion_fuerza   // regenerada cada vez que ese bando actúa
```

Se gasta al usar habilidades (`costo_fuerza` de cada `RolHabilidad`).

### 3.3 Ciclo de vida del combate

1. `POST /pvp/challenge` — valida que ambos tengan personaje y no estén ya en un combate
   `pending|active`; tira iniciativa; crea `PvpCombat` con `hp`/`escudo` = stats derivados.
2. `POST /pvp/{id}/accept|decline` — el retado debe aceptar antes de que pase a `active`.
3. `POST /pvp/{id}/action` — motor de turnos, body `{skill, forma?}`.

### 3.4 Iniciativa

```php
atkDado = 1d20;  defDado = 1d20;
atkTotal = atkDado + atacante.iniciativa;
defTotal = defDado + defensor.iniciativa;
ganaAtacante = atkTotal >= defTotal;   // empate favorece al retador
```

Se re-tira **al final de cada ronda completa** (cuando ambos ya actuaron); quien gana esa tirada
recibe también el tick de regeneración de Fuerza. Si un actor está **aturdido** (sección 4), su
tirada de iniciativa también se divide a la mitad antes de sumar el atributo (`rollIniciativa()`
acepta flags `$atkAturdido`/`$defAturdido`).

### 3.5 Acciones disponibles

| `skill` | Efecto |
|---|---|
| `"flee"` | Huir — termina el combate, el rival gana a efectos de hito |
| `"stance"` (+ `forma: 1-7`) | Cambia la forma activa, consume el turno, sin tirada |
| `"unarmed"` | Ataque básico con el **arma efectiva** (sable > arma clásica > manos) |
| `<id numérico>` | Usa una `RolHabilidad` equipada en la forma activa |

Si el actor está **paralizado** al empezar su turno, pierde el turno automáticamente sin importar
qué `skill` haya enviado el cliente (ver sección 4.4).

**Ataque básico:**

```php
atkVal = esDistancia ? atacante.punteria : atacante.ataque
defVal = esDistancia ? defensor.movimiento : defensor.defensa
atkRoll = 1d20 + atkVal;  defRoll = 1d20 + defVal
esCritico = atkDado >= (20 - critico)      // "critico" = bono del sable
si (esCritico || atkRoll > defRoll):
    dano = (arma.dano ?? 3) + (esCritico ? 1 : 0)
    aplicarDano(dano)
```

**Habilidades:** validan que estén equipadas en la forma actual, que no estén en cooldown y que
alcance la Fuerza (`costo_fuerza`). Objetivo `self` = buff sin tirada. Objetivo rival = tirada
opuesta (melee: ataque vs defensa · distancia: puntería vs movimiento); si acierta, aplica
`hab.damage` y — clave — **multiplica el daño ×1.5 si la Forma del atacante es efectiva contra la
última forma usada por el rival** (triángulo de formas, ver 3.6).

**Buff/debuff de una habilidad — dos caminos posibles.** El campo `buff`/`debuff` de una
`RolHabilidad` es un array libre de strings. Cada string se resuelve así:

- Si coincide con uno de los **9 nombres reservados de estado** (`paralizado, aturdido, marcado,
  protegido, sangrado, envenenado, debilitado, confundido, regeneracion` — ver sección 4), se
  aplica como **estado** al bando correspondiente vía `aplicarEstadoDeHabilidad()`.
- En cualquier otro caso, se trata como **modificador plano de stat** (`ataque, defensa,
  punteria, movimiento, iniciativa`): +1/-1 por 2 turnos, apilable hasta el tope de config
  `cap_stats_buff` (default 18).

Esta distinción la gestiona el mismo tutor que edita las habilidades: el panel de administración
(`Admin.jsx`) muestra dos grupos de checkboxes separados — stats planos vs. estados — para que
quede explícito cuál de los dos mecanismos activa cada buff/debuff.

### 3.6 Triángulo de efectividad de Formas

Matriz tipo piedra-papel-tijera sobre las 7 formas:

```
1 Shii-Cho     vence a  6 Niman
6 Niman        vence a  3 Soresu
3 Soresu       vence a  4 Ataru
4 Ataru        vence a  1 Shii-Cho
2 Makashi      vence a  1 Shii-Cho, 5 Shien
5 Shien/DjSo   vence a  4 Ataru
7 Juyo/Vaapad  vence a  5 Shien, 6 Niman
```

Ganar el matchup de forma da **×1.5 de daño** en el golpe de habilidad. Este triángulo es, en la
práctica, el corazón táctico del combate: elegir y cambiar de forma en el momento correcto pesa
tanto como los atributos.

### 3.7 Resolución de daño y de la partida

`applyDamage()` separa el daño de un golpe en hasta tres componentes:

- `dmg` — daño normal, absorbido primero por el escudo.
- `dmgEscudo` — daño extra que **sólo** puede consumir escudo (nunca pasa a vida por sí solo).
- `dmgPerforante` — daño perforante, siempre pega directo a la vida sin pasar por el escudo.

Si el escudo tiene puntos y `dmgEscudo` por sí solo no lo agota, el escudo absorbe `dmg + dmgEscudo`
por completo y sólo `dmgPerforante` llega a la vida. Si `dmgEscudo` agota el escudo, éste queda en 0
y el resto (`dmg + dmgPerforante`) pega directo a la vida.

`vida_atacante ≤ 0 → gana defensor`; `vida_defensor ≤ 0 → gana atacante` (una muerte por sangrado o
veneno al final de ronda también dispara esta resolución, ver 4.5). El ganador genera un
`CharacterHito` (`"{perdedor} derrotado"`), que puede desbloquear misiones futuras.

### 3.8 Combate evaluado ("Combates" con apuestas)

Sistema paralelo y desconectado del motor PvP: un tutor agenda el combate, lo juzga con una
rúbrica de 5 criterios (Flujo/Ritmo, Control de Fuerza, Control de Zona, Técnica y Forma,
Caracterización — cada uno 0/½/1/1½/2) más penalizaciones (leve 0.5 / grave 1 / muy_grave 2 /
descalificado), y resuelve manualmente el ganador. Esto actualiza `StatsTemporada` (victorias/
derrotas/racha **por usuario y por temporada**, no por personaje) y liquida apuestas
(`payout = monto × cuota`, acreditado en créditos del ganador). La notificación asociada
(`CombateResuelto`) está atada únicamente a este modelo `Combat` — no debe confundirse con la
notificación de PvP, que es una clase separada.

### 3.9 Extras del motor PvP

- **`GET /pvp/{id}/resumen-ia`** — genera una crónica narrativa del combate vía Mistral,
  cacheada una sola vez en la columna `resumen_ia`, con un límite duro de 55 palabras (reforzado
  tanto en el prompt como por una función de recorte de seguridad).
- **`POST /pvp/{id}/emoji`** — emotes cosméticos de una lista blanca fija en servidor (`EMOTES`);
  no consumen turno y pueden enviarse en cualquier momento mientras el combate esté `active`.
- **Modo naval** (`modo: 'normal'|'naval'`) — combate entre naves equipadas en vez de personajes:
  usa los stats de la nave y sus 4 slots de `habilidad_1..4` en vez de las Formas/habilidades del
  personaje. Es ortogonal al resto de las reglas (estados, triángulo de formas, etc. no aplican).

---

## 4. Estados de combate

Nueve estados compartidos entre `PvpCombatController` y `RaidCombatController` a través del trait
`AplicaEstadosCombate` (`app/Support/Combat/AplicaEstadosCombate.php`), y replicados en
JavaScript dentro de `NpcCombatScreen.jsx` (comentario explícito en el archivo: *"espejo de
AplicaEstadosCombate.php"*) para que el combate NPC 1v1 offline se comporte igual.

A diferencia de los buffs/debuffs planos de stat (+1/-1 por N turnos), un **estado** vive en un
array JSON aparte por bando (`{"tipo": <clave>, "turns": int|null, "valor"?: int}`) y afecta el
**flujo del turno**, las **tiradas**, o aplica **daño/curación directa** — no un stat.

### 4.1 Los 9 estados

| Estado | Duración por defecto | `valor` | Efecto |
|---|---|---|---|
| `paralizado` | 1 turno | — | Pierde el turno automáticamente; al consumirse otorga `inmune_paralisis` |
| `inmune_paralisis` | 1 turno | — | Bloquea un nuevo intento de `paralizado` mientras esté activo |
| `aturdido` | 1 turno | — | Toda tirada de d20 propia (ataque, defensa, iniciativa) se divide a la mitad (`intdiv`) |
| `marcado` | hasta consumirse (`turns=null`) | — | El próximo golpe recibido acierta automáticamente salvo que el atacante saque un natural 1 |
| `protegido` | hasta consumirse (`turns=null`) | — | El próximo golpe recibido falla automáticamente |
| `sangrado` | 2 turnos | 1 | Pierde `valor` de vida al final de cada ronda (DOT) |
| `envenenado` | 3 turnos | 2 | Pierde `valor` de vida al final de cada ronda (DOT) |
| `debilitado` | 2 turnos | — | El **daño que ese actor inflige** (no el que recibe) se divide a la mitad mientras dure |
| `confundido` | 1 turno | — | 50% de probabilidad de atacarse a sí mismo en vez de al rival |
| `regeneracion` | 2 turnos | 2 | Recupera `valor` de vida al final de cada ronda (HOT, tope = vida máxima) |

### 4.2 Cómo se aplica un estado

Un estado sólo llega desde el `buff`/`debuff` de una `RolHabilidad` cuyo string coincide con uno
de los 9 nombres reservados (`esTipoEstado()`); ver 3.5. `paralizado` es especial: respeta la
inmunidad post-parálisis (`intentarParalizar()` falla en silencio si el objetivo tiene
`inmune_paralisis` activa); el resto de los estados simplemente se agregan/refrescan con sus
valores por defecto (`agregarEstadoPorTipo()`), y si el estado ya estaba activo, `turns` se
extiende al máximo entre el actual y el nuevo en vez de reiniciarse.

### 4.3 Consumo en el momento del golpe

`protegido` y `marcado` no decrementan por ronda — se consumen (se eliminan) la primera vez que el
portador recibe un ataque, independientemente del resultado:

- `protegido` fuerza que el golpe **falle** (equivalente a un escudo de un solo uso contra el
  siguiente ataque).
- `marcado` fuerza que el golpe **acierte**, salvo que el atacante saque un natural 1 en su dado.

### 4.4 Resolución al inicio del turno

Antes de procesar cualquier `skill` enviado por el cliente, el controlador resuelve `paralizado`:
si el actor lo tiene, pierde el turno sin más, se le quita `paralizado` y se le otorga
`inmune_paralisis` para el intento siguiente (evita cadenas infinitas de parálisis).

### 4.5 Tick de fin de ronda

Cuando ambos bandos ya actuaron en la ronda (mismo punto donde hoy se tiquean los buffs/debuffs
planos), `tickEstadosRonda()`:

1. Aplica el daño de `sangrado`/`envenenado` o la curación de `regeneracion` sobre la vida actual
   (la curación respeta el tope de vida máxima).
2. Decrementa `turns` en 1 para todo estado con duración numérica y elimina los que llegan a 0.
   Los estados con `turns=null` (`marcado`, `protegido`) no se tocan aquí — sólo se consumen al
   recibir un golpe (4.3).

Un tick de sangrado/veneno puede terminar el combate (se revisa la condición de victoria
inmediatamente después del tick).

### 4.6 Interacción con `confundido`

Si `resolverConfundido()` dispara (50%), el atacante redirige su propio ataque contra sí mismo: los
stats "del rival" usados para la tirada opuesta pasan a ser los del propio atacante, y si el golpe
conecta, **el debuff de la habilidad no se aplica al rival** (porque el rival nunca fue el objetivo
real del golpe).

---

## 5. Enemigos de mundo — nivel de dificultad

Además de los personajes jugadores, el mundo tiene dos catálogos separados de enemigos, ambos con
la misma mecánica de escalado por nivel:

### 5.1 `MapNpc` vs. `MapEnemigo`

- **`MapNpc`** (`map_npcs`): NPCs fijos, atados a un `LugarID` concreto. Incluye tipos no
  hostiles (`aliado, neutral, entrenador, mercader, vendedor, vendedor_naves`) y el tipo
  `jefe`, que es el **único** utilizable en una Raid (`RaidCombatController::join()` rechaza
  cualquier NPC cuyo `tipo !== 'jefe'`).
- **`MapEnemigo`** (`map_enemigos`): catálogo separado de enemigos de **encuentro aleatorio**, no
  atado a un lugar fijo — se asocia a múltiples lugares vía la tabla pivote
  `map_lugar_enemigos` (`tasa_aparicion`, `nivel`). Se usa exclusivamente en el combate NPC 1v1
  client-side (sección 6), nunca en Raid.

### 5.2 Fórmula de escalado por nivel

Ambos modelos exponen los mismos tres métodos, con la misma fórmula:

```php
nivelDificultad(): int   // max(0, nivel ?? 1)  — el nivel "base" del enemigo
critThreshold(): int     // 21 - nivelDificultad()  — dado natural ≥ esto = crítico
nivelBonoCritico(): int  // floor(nivelDificultad() / 2)  — bono extra sólo en críticos
```

Ejemplo: nivel 4 → umbral de crítico 17 → crítico con un natural 17, 18, 19 o 20.

El escalado tiene **tres efectos**, aplicados en distintos puntos:

1. **+1 a los 7 atributos de combate por nivel** (`vida, escudo, ataque, defensa, movimiento,
   iniciativa, punteria`), sumado sobre el valor base del catálogo (o un valor de respaldo si la
   columna está vacía). Esto aplica siempre, tanto en Raid como en el combate NPC 1v1.
2. **Bono plano de +nivel al daño (o a la curación)** de cada golpe/habilidad que usa el enemigo:
   `dmgBase += dmgBase >= 0 ? nivel : -nivel` (si `dmgBase` es negativo, es decir una curación,
   sumar el nivel la hace más grande en magnitud).
3. **Bono extra de +floor(nivel/2) sólo en golpes críticos**, sumado encima del multiplicador de
   crítico.

**Importante — el efecto 2 y 3 son exclusivos de los jefes de Raid.** En el combate NPC 1v1
client-side, un `MapEnemigo` de encuentro aleatorio (`esEnemigo = true`) sólo recibe el efecto 1
(+1 a atributos) y el desplazamiento del umbral de crítico — el bono plano de daño/curación y el
bono extra de crítico quedan en 0 (`npcDanoNivel = esEnemigo ? 0 : nivel`, `npcCritBonus = esEnemigo
? 0 : floor(nivel/2)` en `NpcCombatScreen.jsx`). Un `MapNpc` de tipo `jefe` enfrentado fuera de Raid
(si aplicara) sí recibiría los tres efectos completos.

### 5.3 Override de nivel por lugar

La tabla pivote `map_lugar_enemigos` (columnas `lugar_id`, `enemigo_id`, `tasa_aparicion`
—peso relativo de aparición, default 1—, `nivel` —default 1—) permite que el **mismo**
`MapEnemigo` tenga un nivel distinto según en qué lugar aparezca. `LugarEncuentroController::check()`
resuelve el encuentro enteramente en servidor:

```php
chance = hostilidadNivel(zona.hostilidad) * 20%   // seguro=0, bajo=20, medio=40, alto=60, extremo=80 (tope 100)
si random(1,100) <= chance:
    elegido = enemigo del lugar, sorteado por peso `tasa_aparicion`
    elegido.nivel = elegido.pivot.nivel   // el nivel del lugar SOBRESCRIBE el nivel base del catálogo
```

El nivel que finalmente ve el cliente (y el que alimenta toda la sección 5.2) es siempre el del
lugar, no el del catálogo — así el mismo enemigo puede ser fácil en una zona seria y difícil en una
zona extrema sin duplicar el registro.

---

## 6. Combate NPC 1 contra 1 (client-side)

`resources/js/components/NpcCombatScreen.jsx` resuelve el combate **enteramente en el navegador**
— sin servidor autoritativo, persistido en `localStorage` (`nx-npc-combat`). Se usa tanto para
`MapNpc` no-jefe como para los encuentros aleatorios de `MapEnemigo` (sección 5.3), y también
soporta combate naval NPC (`naveMode`).

Reimplementa en JavaScript, con nombres y comportamiento equivalentes, todo el trait
`AplicaEstadosCombate` (sección 4) y el escalado por nivel (sección 5.2), incluyendo el flag
`esEnemigo` que apaga el bono de daño/crítico para encuentros aleatorios.

**Iconografía de estados en la UI** (duplicada también en `RaidCombatScreen.jsx` y en el editor de
habilidades de `Admin.jsx` — hoy son tres copias independientes, candidata a unificar):

| Estado | Icono |
|---|---|
| `paralizado` | 🔒 |
| `aturdido` | 💫 |
| `marcado` | 🎯 |
| `protegido` | 🛡️ |
| `sangrado` | 🩸 |
| `envenenado` | ☠️ |
| `debilitado` | ⬇️ |
| `confundido` | ❓ |
| `regeneracion` | 💚 |

Un estado con `turns=null` (`marcado`/`protegido`) se muestra en la UI como "∞ / hasta consumirse"
en vez de un contador de turnos.

---

## 7. Raid — combate grupal contra un jefe

`RaidCombatController` (`app/Http/Controllers/Api/RaidCombatController.php`) es un motor
**servidor-autoritativo**, deliberadamente separado del PvP 1v1 y del combate NPC client-side,
para enfrentar **2 a `MapNpc::raidCupos()` jugadores (default 4)** contra un único `MapNpc` de
tipo `jefe`. Comparte el mismo trait `AplicaEstadosCombate` que el PvP (sección 4) — la mecánica de
estados es idéntica en ambos motores.

### 7.1 Sala de espera y arranque

- `POST /raids/{npc}/join` — encola al jugador en una `RaidCombat` con `status='esperando'`
  (creándola si no existe una para ese jefe) y le asigna un `slot`. Sólo NPCs `tipo === 'jefe'`
  son válidos.
- `POST /raids/{id}/ready` — marca/desmarca listo. El combate arranca automáticamente
  (`startCombat()`) en cuanto hay `MIN_JUGADORES` (2) o más y **todos** los presentes están listos
  — no hace falta llenar los `raidCupos()` completos.

### 7.2 Rondas y orden de turno

- `startCombat()` → `beginRound()`: tira 1d20+iniciativa para cada jugador activo **y** para el
  jefe, ordena todo de mayor a menor en `turn_order` (`[{type, user_id}]`), reinicia `turn_index=0`.
- `POST /raids/{id}/action` valida que le toque el turno a quien llama (contra `turn_order[turn_index]`),
  resuelve la acción con la misma lógica de estados/ataque que el PvP, y avanza:
  `advanceIndex()` incrementa `turn_index`; al pasar del final de `turn_order`, tiquea
  buffs/debuffs/estados de **todos** (jugadores + jefe), revisa victoria/derrota, incrementa
  `ronda` y vuelve a llamar `beginRound()`.
- `settleFromCurrentPosition()` resuelve automáticamente el turno del jefe (`resolveNpcTurn()`) y
  salta jugadores muertos/inactivos hasta llegar al turno de un jugador vivo o terminar el combate
  — **una sola acción de un jugador puede encadenar varios turnos del jefe** sin intervención
  humana.
- `checkTurnTimeout()` (consultado en cada `show()`): si el jugador en turno no actúa dentro de
  `raid_max_wait` (config, default 30s), pierde el turno por tiempo.

### 7.3 IA del jefe

`resolveNpcTurn()`: el jefe apunta al jugador con más `dano_al_jefe` acumulado (amenaza/agro),
salvo que esté **confundido** (50% de probabilidad, sección 4.6), en cuyo caso elige un objetivo
al azar entre todos, incluyéndose a sí mismo. Usa una habilidad el 60% de las veces (si tiene
alguna sin cooldown); si no, un ataque básico de daño base `round(ataque * 0.3)`.

**Crítico del jefe = golpe en área.** A diferencia del PvP (crítico = golpe a un único objetivo),
cuando el jefe saca un crítico (dado ≥ `critThreshold()`, sección 5.2) golpea **a todos los
jugadores activos simultáneamente**: cada uno recibe `(efectivo ? dmgBase*1.5 : dmgBase) +
critBonus`, evaluando la efectividad de forma (sección 3.6) **individualmente** por objetivo. Un
golpe no crítico sólo impacta al objetivo elegido.

---

## 8. Torneos (bracket de eliminación directa)

`TorneoController` + `TorneoCombate` implementan un sistema de **llaves de eliminación directa**,
totalmente independiente tanto del PvP/Raid como del "Combate evaluado" de la sección 3.8 (la
notificación `CombateResuelto` sigue atada sólo a `App\Models\Combat`, no a `TorneoCombate`).

- Un `Torneo` tiene estados `inscripcion → en_curso → finalizado`. Crear/editar/eliminar está
  restringido a tutores; **inscribirse/retirarse** es autoservicio mientras esté en `inscripcion`,
  limitado por `cupos`.
- `iniciar()` genera la llave completa: calcula la potencia de 2 superior (`bracketSize`), rellena
  con "byes" (`null`) si faltan inscritos, baraja el orden de siembra, y construye las filas de
  `TorneoCombate` **de atrás hacia adelante** (primero la final) para poder enlazar
  `next_combate_id`/`next_slot` (`'a'`/`'b'`) hacia adelante. Los "byes" de primera ronda (un cupo
  vacío contra un inscrito) se resuelven y propagan automáticamente.
- **La resolución de cada combate NO es simulada por el motor** — `resolverCombate()` es una
  **planilla cargada a mano por un tutor**: `puntos_a/b`, `faltas_a/b`, `falta_grave_a/b` y un
  `ganador: 'a'|'b'` explícito. Es, en esencia, un puntaje de esgrima/juzgamiento físico — no hay
  dados, ni vida, ni estados, ni ningún uso de `AplicaEstadosCombate`.
- `propagarGanador()` escribe al ganador en el combate de la ronda siguiente enlazada.

En otras palabras: hoy conviven **tres** conceptos de "combate juzgado por una persona" en el
sistema — el `Combat` evaluado con apuestas (3.8), y el `TorneoCombate` de bracket — y **dos**
motores simulados por dados (`PvpCombat` y `RaidCombat`). Ninguno de los dos motores humanos
comparte tablas ni lógica entre sí.

---

## 9. Objetos e Inventario (`rol_objetos`)

### 9.1 Tipos de objeto

```
arma, nucleo_energia, cristal, lente_enfoque, emisor,
estabilizador, empunadura, modulo_activacion, accesorio
```

`arma` es un ítem de combate clásico independiente (usa `tipo_ataque` melee/distancia + `dano`,
sin bonos). Los otros 8 tipos son **piezas de ensamblaje de sable láser**.

### 9.2 Rareza

`comun → poco_comun → raro → epico → legendario`. El generador de piezas de sable escala rango de
bono `[1+tier, 3+tier*2]` y costo `(tier+1)*150` por rareza.

### 9.3 Los 9 bonos de combate de una pieza

```
bono_ataque, bono_defensa, bono_punteria, bono_movimiento, bono_iniciativa,
bono_vida, bono_escudo, bono_dano, bono_critico, bono_fuerza, bono_generacion_fuerza
```

### 9.4 Inventario — posesión simple, no stock

`rol_character_objeto` es un par único `(character_id, rol_objeto_id)` — **no hay cantidad**;
o se posee el objeto o no. Se obtiene por:

- **Recompensa de misión** (`Recompensa.tipo = objeto`): al completar la misión, el objeto se
  añade al inventario (`syncWithoutDetaching`). Las misiones también pueden entregar
  `habilidad` (aprendida por el usuario) o `creditos`.
- **Panel de administración**: los tutores pueden crear/editar objetos y asignarlos directamente.

### 9.5 Dos formas de equipar

1. **Arma clásica**: `POST /character/equipar-arma` fija `arma_equipada_id` (debe ser tipo
   `arma` y estar en inventario). Sin bonos, sólo daño/tipo de ataque.
2. **Ensamblaje de sable** (`CharacterSable`, gestionado en `ArmadoSable` / pestaña "Mi
   Personaje"):
   - 8 slots: `nucleo, cristal, lente, emisor, estabilizador, empunadura, modulo, accesorio`,
     cada uno exige el `tipo` correspondiente de `rol_objetos`.
   - Al armar, se valida que la energía total consumida (`consumo_energia` sumado) no supere la
     `energia_maxima` del núcleo elegido.
   - **Ensamblar consume el inventario**: las piezas usadas se `detach` del inventario general —
     quedan "instaladas", no duplicadas.
   - Sólo un sable puede estar `activo` por personaje; el color de hoja (`saber_color`) se toma
     del cristal instalado.
   - **Desarmar**: el cristal Kyber siempre se recupera; el jugador elige **una** pieza adicional
     para recuperar; el resto se pierde permanentemente.
   - Daño base de un sable armado = **6** (`CharacterSable::DANO_BASE`) + suma de `bono_dano` de
     sus piezas. El crítico funciona como umbral: "CRT 2 = crítico con 20, 19 o 18 natural".
   - `Character::sableBonos()` suma los 9 bonos de las piezas instaladas del sable activo y
     alimenta directamente `getCombatStats()` y la config de Fuerza del combate PvP.

---

## 10. Combatientes — directorio y perfil público

`CombatantController` (roster/leaderboard de sólo lectura, sin lógica de combate propia) alimenta
`resources/js/sections/Combatientes.jsx`: una grilla buscable/filtrable de todos los personajes
(nombre/handle/sector, filtro por rango), cada card con avatar, rango, clase, color de sable y
mini-stats de victorias/winrate/medallas. Al hacer clic se abre un perfil público a pantalla
completa (link copiable `/c/{handle}`), con récord, atributos de combate, medallas, entrenamientos
en curso y una "Cartelera" de combates próximos/recientes, más un botón "Retar a {nombre}" que
abre el mismo `ChallengeModal` de `Combates.jsx` para iniciar un reto PvP.

Es un sistema **nuevo** frente al `Combates.jsx` ya documentado (3.8): `Combatientes.jsx` es el
directorio/"quién es quién" y navegación de perfiles; `Combates.jsx` sigue siendo el
registro/scoreboard de combates evaluados. Ambos comparten únicamente el componente `ChallengeModal`.

---

## 11. Cómo se conectan los sistemas

```
Entrenamiento (asistencia) ──▶ +75 créditos
Misiones (completar)       ──▶ créditos | objeto → inventario | habilidad aprendida | hitos
Inventario (rol_objetos)   ──ensamblar──▶ CharacterSable (consume piezas) ──activo──▶ sableBonos()
                                                                                          │
puntos_libres (fijo, sin reposición) ────▶ characters.{vida,escudo,ataque,defensa,      +
                                            movimiento,iniciativa,punteria}      ────▶ stats de combate
                                                                                          │
habilidades_por_forma (aprendidas vía misiones, 4 equipadas por Forma) ─────────────────┤
                                                                                          │
                                              AplicaEstadosCombate (9 estados) ──────────┤
                                                                                          ▼
                            PvpCombatController::action()  ◀── mismo trait ──▶  RaidCombatController::action()
                             (duelo 1v1, servidor)                              (N jugadores vs jefe, servidor)
                                          │                                              │
                                          ▼                                              ▼
                                 CharacterHito                                  dano_al_jefe (agro)
                               ("X derrotado")                                  + gates de misiones
                                          │
                     NpcCombatScreen.jsx (réplica JS del trait, 100% client-side)
                     ──▶ MapNpc (no-jefe) | MapEnemigo (encuentro aleatorio, nivel override por lugar)

Combates evaluados (aparte) ──tutor resuelve──▶ StatsTemporada (W/L/racha por usuario/temporada)
                                              └──▶ liquida apuestas → créditos del ganador

Torneo (bracket, aparte) ──tutor carga planilla──▶ TorneoCombate.ganador ──propaga──▶ siguiente ronda

Combatientes.jsx (directorio) ──lee──▶ CombatantController (Character + StatsTemporada)
                               ──"Retar"──▶ ChallengeModal ──▶ PvpCombatController::challenge()
```

**Conclusiones clave:**

- La progresión **no** usa nivel/experiencia numérica para el jugador — todo el avance pasa por:
  créditos (entrenamiento/misiones), objetos/habilidades otorgados por misiones, puntos libres
  fijos (5, gastados una sola vez) y mejorar el sable con mejores piezas. El **nivel sí existe**,
  pero sólo del lado de los enemigos de mundo (`MapNpc`/`MapEnemigo`, sección 5), como escalado de
  dificultad, no como progresión del propio personaje.
- El combate mezcla **stats + dados + un triángulo táctico de Formas + estados de condición** — es,
  en esencia, un motor de rol de mesa (d20 opuesto) ya implementado en software, ahora con dos
  variantes (1v1 PvP y N-vs-1 Raid) que comparten el mismo motor de estados.
- El inventario es de posesión simple, y ensamblar el sable es una decisión de **crafteo con
  costos de oportunidad** (energía limitada, piezas se consumen/pierden al desarmar).
- Existen **dos** flujos de "combate resuelto por una persona" (evaluado con apuestas, y bracket de
  torneo) totalmente aparte de los motores simulados por dados — no comparten tablas ni lógica.

---

## 12. ¿Se puede llevar esto a un juego de mesa?

**Sí, y de hecho el sistema ya está diseñado de una forma muy cercana a un juego de mesa/rol de
mesa** — el motor usa 1d20 opuesto (como D&D/PbtA), un triángulo de tipo piedra-papel-tijera
(como muchos LCG/dueling games: *Star Wars Jedi Knights*, *Yomi*, *BattleCON*), fichas de
condición estilo wargame (los 9 estados de la sección 4), y un crafteo de equipo con slots fijos
(como *Gloomhaven*, *Descent*, o los juegos de "build your loadout"). Lo que hay que resolver es
sobre todo **fricción de cómputo** — todo lo demás traduce casi 1:1.

### 12.1 Qué traduce directo (bajo esfuerzo de adaptación)

| Sistema digital | Equivalente físico |
|---|---|
| 7 estadísticas de combate (`vida/escudo/defensa/ataque/movimiento/iniciativa/punteria`) | Hoja de personaje con 7 tracks |
| 7 Formas + matriz de counters | Rueda o carta de "piedra-papel-tijera" de 7 puntas (imprimible) |
| 1d20 + stat vs 1d20 + stat | Un d20 físico por jugador, tirado simultáneamente |
| Escudo absorbe antes que vida | Dos trackers de daño (escudo y vida) por ficha, o dial |
| 8 slots de sable + 9 bonos | Cartas de pieza (una por slot), con iconos de bono impresos |
| Rareza de objeto | Borde/color de carta (común→legendario), igual que cualquier TCG |
| Habilidades por Forma (4 equipadas) | Mano de hasta 4 cartas de "técnica" activas por Forma |
| Cooldown de habilidad | Ficha girada 90° o token puesto sobre la carta N turnos |
| Costo de Fuerza + regeneración | Track de "Fuerza" con marcador (pool compartido tipo maná) |
| 9 estados de combate | 9 fichas de condición físicas, cada una con su icono (sección 6) |
| Nivel de enemigo (+1 atributos, +daño, +crítico) | "Estrella de dificultad" en la carta del monstruo, igual que un bestiario de RPG de mesa |
| Raid (N jugadores vs 1 jefe, crítico = golpe en área) | Boss-battle cooperativo estilo *Gloomhaven*/*Sword & Sorcery*, con ficha de jefe grande y ataque en área marcado en su carta |

### 12.2 Qué hay que rediseñar (el sistema actual asume un servidor)

- **Iniciativa recalculada cada ronda con 1d20 por bando**: en mesa, esto es perfectamente
  jugable como "ambos tiran 1d20 + iniciativa al inicio de cada ronda, mayor actúa primero" — no
  requiere cambios, sólo dos dados y un vistazo a la hoja.
- **Efectividad de Forma basada en "última forma usada por el rival"**: en digital es invisible
  para el rival hasta que golpea; en mesa esto se resuelve mejor con **revelación simultánea**
  (ambos jugadores eligen su Forma en secreto, tipo piedra-papel-tijera, y la revelan a la vez) —
  de hecho esto mejora el juego de mesa respecto al original, porque introduce bluffeo real en vez
  de ser sólo un cálculo de backend.
- **Stats fijadas directamente en la hoja**: en mesa conviene llevar `vida, escudo, defensa, ataque,
  movimiento, iniciativa, punteria` como tracks explícitos, porque eso es lo que usa el combate
  real del sistema.
- **Buffs/debuffs "+1 por N turnos" y estados con `turns=null`**: se resuelven con fichas de
  condición físicas sobre la hoja, bajando un contador al final de cada ronda; `marcado`/
  `protegido` (duración "hasta consumirse") son simplemente fichas que se retiran al recibir el
  próximo golpe, sin contador — mecánica estándar de wargames/dungeon crawlers.
- **Orden de turno dinámico de una Raid** (varios jugadores + jefe intercalados por iniciativa):
  en mesa se resuelve con una fila de fichas de iniciativa ordenadas al inicio de cada ronda,
  igual que *Gloomhaven*— no requiere cómputo, sólo ordenar fichas sobre la mesa.

### 12.3 Propuesta de conversión — "Duelo de Formas" (boceto de reglas)

Un juego de **duelo 1 contra 1** (o por equipos, réplica de los combates evaluados), pensado como
mazo + hoja de personaje + dados, jugable en 15–25 min:

**Componentes:**
- 1 hoja de personaje por jugador (atributos, 7 stats de combate, casillas de vida/escudo/Fuerza).
- 1 "rueda de Formas" de 7 posiciones con el triángulo ya impreso (referencia rápida de counters).
- Mazo de cartas de Técnica (una por Forma, ~6–8 cartas por Forma) con costo de Fuerza, daño,
  objetivo (rival/self) y duración de efecto — incluyendo, cuando corresponda, uno de los 9
  estados en vez de un +1/-1 de stat.
- Mazo de cartas de Pieza de Sable (8 tipos × 5 rarezas) para el modo de "crafteo antes del duelo".
- 2 d20 (uno por jugador), fichas de daño/condición (9 tipos, iconos de la sección 6).

**Estructura de ronda:**
1. **Fase de Forma** — ambos jugadores eligen en secreto su Forma para la ronda (o "mantener" la
   actual) y revelan a la vez. Se resuelve el triángulo: quien tiene ventaja marca +50% daño en
   sus ataques esta ronda.
2. **Fase de Iniciativa** — ambos tiran 1d20 + iniciativa (dividido a la mitad si el jugador está
   "aturdido"); mayor actúa primero.
3. **Fase de Acción** (por orden de iniciativa) — cada jugador juega una carta de Técnica de su
   Forma actual (pagando Fuerza) o un "ataque básico" con su arma/sable equipado; tirada opuesta
   1d20+ataque vs 1d20+defensa (o puntería vs movimiento a distancia); "paralizado" hace perder el
   turno entero; "protegido"/"marcado" fuerzan fallo/acierto automático y se retiran del jugador;
   en empate o victoria del atacante, se aplica daño (crítico si el d20 del atacante iguala o
   supera el umbral de la pieza).
4. **Fase de Mantenimiento** — el escudo absorbe daño pendiente antes que la vida; se resuelven
   sangrado/veneno/regeneración; se bajan los contadores de condiciones activas; ambos regeneran
   Fuerza.
5. Fin del duelo cuando la vida de un jugador llega a 0.

**Modo "campaña" (opcional, cubre entrenamiento/misiones/inventario):**
- Entre duelos, los jugadores gastan "créditos" (ganados por completar retos/misiones narrativas
  del director de juego) para comprar cartas de Pieza y ensamblar su sable (respetando el límite
  de energía del núcleo, igual que en digital) o para desbloquear nuevas cartas de Técnica por
  Forma.
- Los "hitos" se representan como cartas de logro que desbloquean misiones/duelos siguientes —
  un sistema de campaña por capítulos, similar a *Gloomhaven*.

**Modo "Raid" (opcional, boss battle cooperativo):**
- 2 a 4 jugadores comparten una ficha de jefe con estrella de dificultad (nivel): +1 a todos sus
  stats por estrella, +1 punto de daño/curación plano por estrella, y +½ estrella (redondeo hacia
  abajo) extra en críticos.
- Se arma una fila de iniciativa mezclando jugadores y jefe al inicio de cada ronda (fichas
  numeradas sobre la mesa, no cálculo).
- Un crítico del jefe golpea **a todos los jugadores activos a la vez** — en mesa, esto se marca
  simplemente jugando la carta de ataque del jefe "boca arriba para todos" en vez de contra un
  único objetivo.

### 12.4 Nivel de esfuerzo estimado

- **Prototipo jugable en papel** (hoja de personaje + dados + reglas de la sección 12.3, sin
  cartas ilustradas): unas pocas horas — es básicamente transcribir las fórmulas ya existentes.
- **Set de cartas de Técnica y Piezas con arte**: el trabajo real está aquí — traducir cada
  `RolHabilidad` y cada tipo de pieza a una carta con texto de reglas claro, y equilibrar costos/
  daños a mano (los números actuales fueron pensados para resolverse por software, no para que un
  humano los calcule mentalmente en segundos — conviene redondear a valores más simples: dados,
  +X fijos, tablas de rareza más cortas).
- **Recomendación**: prototipar primero sólo el duelo 1v1 (sección 12.3, sin modo campaña ni raid)
  con fichas de cartulina y probarlo un par de partidas antes de invertir en arte o en el sistema
  de crafteo/campaña/raid completo.
