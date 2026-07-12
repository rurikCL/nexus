# Sistema de Rol y Combate — NÉXUS

Documentación técnica del sistema de personaje, entrenamiento, objetos/inventario y combate,
tal como está implementado hoy en el código. Incluye al final un análisis de viabilidad para
llevar el sistema a un juego de mesa.

> Fuentes principales: `app/Models/Character.php`, `app/Models/CharacterSable.php`,
> `app/Models/RolObjeto.php`, `app/Http/Controllers/Api/PvpCombatController.php`,
> `app/Http/Controllers/Api/CombatController.php`, `app/Http/Controllers/Api/CharacterController.php`,
> `app/Http/Controllers/Api/SableController.php`, `app/Http/Controllers/Api/ModuloEntrenamientoController.php`,
> `app/Http/Controllers/Api/SesionEntrenamientoController.php`, `resources/js/data/seed.js`,
> migraciones en `database/migrations/`.

---

## 0. Vista general — dos sistemas de combate distintos

El código contiene **dos sistemas de combate separados** que conviene no confundir:

1. **`Combat` ("Combates")** — enfrentamientos programados, evaluados manualmente por un tutor,
   con apuestas (`bets`) y una rúbrica de puntaje. No hay tiradas de dados; el resultado lo decide
   una persona.
2. **`PvpCombat` ("PvP")** — motor de duelo automático basado en tiradas de dado (1d20), con vida,
   escudo, formas/estilos de combate y habilidades. **Este es el motor de reglas real** que
   documentamos en detalle en la sección 3.

Además existe un estado de mock en `resources/js/store/useStore.js` (localStorage `nx-state-v3`)
que simula créditos/combate en el cliente pero **no está conectado** a las rutas reales
`/api/pvp/*` ni `/api/combats`. Es scaffolding legado, no forma parte del sistema real.

---

## 1. El personaje (Rol)

### 1.1 Atributos base

Al crear el personaje (`CharacterController::upsert`) se definen 5 **atributos** (0–100, default 50):

| Atributo | Campo | Rol |
|---|---|---|
| Fuerza | `fuerza` | Empuja vida y ataque |
| Velocidad | `velocidad` | Empuja movimiento e iniciativa |
| Técnica | `tecnica` | Empuja escudo y puntería |
| Defensa | `defensa` | Empuja defensa de combate |
| Foco | `foco` | Empuja iniciativa y puntería |

Estos atributos son la **entrada** de una fórmula de derivación (sección 3.1), pero en la
práctica un personaje recién creado recibe estadísticas de combate fijas de partida
(`vida=8, escudo=4, defensa=2, ataque=2, movimiento=2, iniciativa=2, punteria=2, puntos_libres=5`),
y la fórmula derivada de los atributos sólo actúa como *fallback* para personajes/NPCs antiguos
que no tienen estas columnas explícitas seteadas.

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

### 3.1 Estadísticas de combate derivadas

```php
vida       = (vida       ?? 30 + round(fuerza * 1.5))                + bonoSable.vida
escudo     = (escudo     ?? 10 + round(tecnica * 0.4))                + bonoSable.escudo
ataque     = (ataque     ?? round(fuerza * 0.8))                      + bonoSable.ataque
defensa    = (defensa    ?? round(defensa_attr * 0.8))                + bonoSable.defensa
movimiento = (movimiento ?? round(velocidad * 0.8))                   + bonoSable.movimiento
iniciativa = (iniciativa ?? round((velocidad+foco)/2 * 0.5))          + bonoSable.iniciativa
punteria   = (punteria   ?? round((tecnica+foco)/2 * 0.5))            + bonoSable.punteria
```

Es decir: las columnas explícitas en `characters` (fijadas al crear el personaje + `puntos_libres`
gastados) tienen prioridad; la fórmula de atributos sólo es *fallback*. A todo se le suman los
bonos del sable activo (sección 4).

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
recibe también el tick de regeneración de Fuerza.

### 3.5 Acciones disponibles

| `skill` | Efecto |
|---|---|
| `"flee"` | Huir — termina el combate, el rival gana a efectos de hito |
| `"stance"` (+ `forma: 1-7`) | Cambia la forma activa, consume el turno, sin tirada |
| `"unarmed"` | Ataque básico con el **arma efectiva** (sable > arma clásica > manos) |
| `<id numérico>` | Usa una `RolHabilidad` equipada en la forma activa |

**Ataque básico:**

```php
atkVal = esDistancia ? atacante.punteria : atacante.ataque
defVal = esDistancia ? defensor.movimiento : defensor.defensa
atkRoll = 1d20 + atkVal;  defRoll = 1d20 + defVal
esCritico = atkDado >= (20 - critico)      // "critico" = bono del sable
si (esCritico || atkRoll > defRoll):
    dano = (arma.dano ?? 3) + (esCritico ? 1 : 0)
    aplicarDano(dano)   // escudo absorbe 1:1 primero, el resto pega a la vida
```

**Habilidades:** validan que estén equipadas en la forma actual, que no estén en cooldown y que
alcance la Fuerza (`costo_fuerza`). Objetivo `self` = buff sin tirada. Objetivo rival = tirada
opuesta (melee: ataque vs defensa · distancia: puntería vs movimiento); si acierta, aplica
`hab.damage` y — clave — **multiplica el daño ×1.5 si la Forma del atacante es efectiva contra la
última forma usada por el rival** (triángulo de formas, ver 3.6). Buffs/debuffs duran 2 turnos y
suman/restan **+1 plano** al stat afectado mientras estén activos.

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

### 3.7 Resolución

`vida_atacante ≤ 0 → gana defensor`; `vida_defensor ≤ 0 → gana atacante`. El ganador genera un
`CharacterHito` (`"{perdedor} derrotado"`), que puede desbloquear misiones futuras.

### 3.8 Combate evaluado ("Combates" con apuestas)

Sistema paralelo y desconectado del motor PvP: un tutor agenda el combate, lo juzga con una
rúbrica de 5 criterios (Flujo/Ritmo, Control de Fuerza, Control de Zona, Técnica y Forma,
Caracterización — cada uno 0/½/1/1½/2) más penalizaciones (leve 0.5 / grave 1 / muy_grave 2 /
descalificado), y resuelve manualmente el ganador. Esto actualiza `StatsTemporada` (victorias/
derrotas/racha **por usuario y por temporada**, no por personaje) y liquida apuestas
(`payout = monto × cuota`, acreditado en créditos del ganador).

---

## 4. Objetos e Inventario (`rol_objetos`)

### 4.1 Tipos de objeto

```
arma, nucleo_energia, cristal, lente_enfoque, emisor,
estabilizador, empunadura, modulo_activacion, accesorio
```

`arma` es un ítem de combate clásico independiente (usa `tipo_ataque` melee/distancia + `dano`,
sin bonos). Los otros 8 tipos son **piezas de ensamblaje de sable láser**.

### 4.2 Rareza

`comun → poco_comun → raro → epico → legendario`. El generador de piezas de sable escala rango de
bono `[1+tier, 3+tier*2]` y costo `(tier+1)*150` por rareza.

### 4.3 Los 9 bonos de combate de una pieza

```
bono_ataque, bono_defensa, bono_punteria, bono_movimiento, bono_iniciativa,
bono_vida, bono_escudo, bono_dano, bono_critico, bono_fuerza, bono_generacion_fuerza
```

### 4.4 Inventario — posesión simple, no stock

`rol_character_objeto` es un par único `(character_id, rol_objeto_id)` — **no hay cantidad**;
o se posee el objeto o no. Se obtiene por:

- **Recompensa de misión** (`Recompensa.tipo = objeto`): al completar la misión, el objeto se
  añade al inventario (`syncWithoutDetaching`). Las misiones también pueden entregar
  `habilidad` (aprendida por el usuario) o `creditos`.
- **Panel de administración**: los tutores pueden crear/editar objetos y asignarlos directamente.

### 4.5 Dos formas de equipar

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

## 5. Cómo se conectan los sistemas

```
Entrenamiento (asistencia) ──▶ +75 créditos
Misiones (completar)       ──▶ créditos | objeto → inventario | habilidad aprendida | hitos
Inventario (rol_objetos)   ──ensamblar──▶ CharacterSable (consume piezas) ──activo──▶ sableBonos()
                                                                                          │
puntos_libres (fijo, sin reposición) ────▶ characters.{vida,escudo,ataque,defensa,      +
                                            movimiento,iniciativa,punteria}      ────▶ stats de combate
                                                                                          │
habilidades_por_forma (aprendidas vía misiones, 4 equipadas por Forma) ─────────────────┘
                                                                                          │
                                                                                          ▼
                                        PvpCombatController::action()  (duelo con dados)
                                                                                          │
                                                                          ▼               ▼
                                                            CharacterHito          (gates misiones)
                                                          ("X derrotado")

Combates evaluados (aparte) ──tutor resuelve──▶ StatsTemporada (W/L/racha por usuario/temporada)
                                              └──▶ liquida apuestas → créditos del ganador
```

**Conclusiones clave:**

- La progresión **no** usa nivel/experiencia numérica — todo el avance pasa por: créditos
  (entrenamiento/misiones), objetos/habilidades otorgados por misiones, puntos libres fijos
  (5, gastados una sola vez) y mejorar el sable con mejores piezas.
- El combate mezcla **stats + dados + un triángulo táctico de Formas** — es, en esencia, un motor
  de rol de mesa (d20 opuesto) ya implementado en software.
- El inventario es de posesión simple, y ensamblar el sable es una decisión de **crafteo con
  costos de oportunidad** (energía limitada, piezas se consumen/pierden al desarmar).

---

## 6. ¿Se puede llevar esto a un juego de mesa?

**Sí, y de hecho el sistema ya está diseñado de una forma muy cercana a un juego de mesa/rol de
mesa** — el motor usa 1d20 opuesto (como D&D/PbtA), un triángulo de tipo piedra-papel-tijera
(como muchos LCG/dueling games: *Star Wars Jedi Knights*, *Yomi*, *BattleCON*), y un
crafteo de equipo con slots fijos (como *Gloomhaven*, *Descent*, o los juegos de "build your
loadout"). Lo que hay que resolver es sobre todo **fricción de cómputo** — todo lo demás traduce
casi 1:1.

### 6.1 Qué traduce directo (bajo esfuerzo de adaptación)

| Sistema digital | Equivalente físico |
|---|---|
| Atributos (fuerza/velocidad/tecnica/defensa/foco) | Hoja de personaje con 5 tracks |
| 7 Formas + matriz de counters | Rueda o carta de "piedra-papel-tijera" de 7 puntas (imprimible) |
| 1d20 + stat vs 1d20 + stat | Un d20 físico por jugador, tirado simultáneamente |
| Escudo absorbe antes que vida | Dos trackers de daño (escudo y vida) por ficha, o dial |
| 8 slots de sable + 9 bonos | Cartas de pieza (una por slot), con iconos de bono impresos |
| Rareza de objeto | Borde/color de carta (común→legendario), igual que cualquier TCG |
| Habilidades por Forma (4 equipadas) | Mano de hasta 4 cartas de "técnica" activas por Forma |
| Cooldown de habilidad | Ficha girada 90° o token puesto sobre la carta N turnos |
| Costo de Fuerza + regeneración | Track de "Fuerza" con marcador (pool compartido tipo maná) |

### 6.2 Qué hay que rediseñar (el sistema actual asume un servidor)

- **Iniciativa recalculada cada ronda con 1d20 por bando**: en mesa, esto es perfectamente
  jugable como "ambos tiran 1d20 + iniciativa al inicio de cada ronda, mayor actúa primero" — no
  requiere cambios, sólo dos dados y un vistazo a la hoja.
- **Efectividad de Forma basada en "última forma usada por el rival"**: en digital es invisible
  para el rival hasta que golpea; en mesa esto se resuelve mejor con **revelación simultánea**
  (ambos jugadores eligen su Forma en secreto, tipo piedra-papel-tijera, y la revelan a la vez) —
  de hecho esto mejora el juego de mesa respecto al original, porque introduce bluffeo real en vez
  de ser sólo un cálculo de backend.
- **Cálculo automático de stats derivados de atributos**: en mesa conviene fijar los 7 stats de
  combate directamente en la hoja de personaje (como ya hace el sistema para personajes de
  jugador) y saltarse la fórmula de fallback — es puramente una comodidad de software para NPCs.
- **Buffs/debuffs "+1 por N turnos"**: se resuelve con fichas de condición físicas sobre la hoja,
  bajando un contador al final de cada ronda — mecánica estándar de wargames/dungeon crawlers.

### 6.3 Propuesta de conversión — "Duelo de Formas" (boceto de reglas)

Un juego de **duelo 1 contra 1** (o por equipos, réplica de los combates evaluados), pensado como
mazo + hoja de personaje + dados, jugable en 15–25 min:

**Componentes:**
- 1 hoja de personaje por jugador (atributos, 7 stats de combate, casillas de vida/escudo/Fuerza).
- 1 "rueda de Formas" de 7 posiciones con el triángulo ya impreso (referencia rápida de counters).
- Mazo de cartas de Técnica (una por Forma, ~6–8 cartas por Forma) con costo de Fuerza, daño,
  objetivo (rival/self) y duración de efecto.
- Mazo de cartas de Pieza de Sable (8 tipos × 5 rarezas) para el modo de "crafteo antes del duelo".
- 2 d20 (uno por jugador), fichas de daño/condición.

**Estructura de ronda:**
1. **Fase de Forma** — ambos jugadores eligen en secreto su Forma para la ronda (o "mantener" la
   actual) y revelan a la vez. Se resuelve el triángulo: quien tiene ventaja marca +50% daño en
   sus ataques esta ronda.
2. **Fase de Iniciativa** — ambos tiran 1d20 + iniciativa; mayor actúa primero.
3. **Fase de Acción** (por orden de iniciativa) — cada jugador juega una carta de Técnica de su
   Forma actual (pagando Fuerza) o un "ataque básico" con su arma/sable equipado; tirada opuesta
   1d20+ataque vs 1d20+defensa (o puntería vs movimiento a distancia); en empate o victoria del
   atacante, se aplica daño (crítico si el d20 del atacante iguala o supera el umbral de la pieza).
4. **Fase de Mantenimiento** — el escudo absorbe daño pendiente antes que la vida; se bajan los
   contadores de condiciones activas; ambos regeneran Fuerza.
5. Fin del duelo cuando la vida de un jugador llega a 0.

**Modo "campaña" (opcional, cubre entrenamiento/misiones/inventario):**
- Entre duelos, los jugadores gastan "créditos" (ganados por completar retos/misiones narrativas
  del director de juego) para comprar cartas de Pieza y ensamblar su sable (respetando el límite
  de energía del núcleo, igual que en digital) o para desbloquear nuevas cartas de Técnica por
  Forma.
- Los "hitos" se representan como cartas de logro que desbloquean misiones/duelos siguientes —
  un sistema de campaña por capítulos, similar a *Gloomhaven*.

### 6.4 Nivel de esfuerzo estimado

- **Prototipo jugable en papel** (hoja de personaje + dados + reglas de la sección 6.3, sin
  cartas ilustradas): unas pocas horas — es básicamente transcribir las fórmulas ya existentes.
- **Set de cartas de Técnica y Piezas con arte**: el trabajo real está aquí — traducir cada
  `RolHabilidad` y cada tipo de pieza a una carta con texto de reglas claro, y equilibrar costos/
  daños a mano (los números actuales fueron pensados para resolverse por software, no para que un
  humano los calcule mentalmente en segundos — conviene redondear a valores más simples: dados,
  +X fijos, tablas de rareza más cortas).
- **Recomendación**: prototipar primero sólo el duelo 1v1 (sección 6.3, sin modo campaña) con
  fichas de cartulina y probarlo un par de partidas antes de invertir en arte o en el sistema de
  crafteo/campaña completo.
