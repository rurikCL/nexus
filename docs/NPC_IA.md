# NPC · Sistema de Conversación con IA

Cada NPC puede tener una personalidad definida en el campo **Prompt IA**. Cuando ese campo está activo, el diálogo cambia de opciones estáticas a conversación libre impulsada por Mistral AI, con acceso a la base de datos del universo NEXUS.

---

## Configuración

| Parámetro | Valor |
|---|---|
| Modelo | `open-mistral-nemo` (12B, gratuito) |
| Límite por ventana | 5 respuestas por usuario por NPC |
| Ventana de tiempo | 5 minutos |
| Historial enviado | Últimos 8 mensajes (4 intercambios) |
| Tokens por respuesta | 220 máx. |

El campo **Prompt IA** se configura desde **Admin → NPCs**. Si está vacío, el NPC usa el sistema estático de palabras clave (`interaccion`). Si tiene contenido, activa el modo IA.

---

## Skills disponibles (Function Calling)

El modelo invoca estas funciones automáticamente cuando el contexto lo justifica. No requieren instrucción explícita en el prompt, aunque mencionarlas mejora la tasa de activación.

### `buscar_personaje`
**Tipo:** Lectura · tabla `characters`

Recupera la ficha completa de un combatiente registrado en la Orden.

| Parámetro | Tipo | Descripción |
|---|---|---|
| `nombre` | `string` **(requerido)** | Nombre completo o handle (ej: `"V-SOTO"`, `"Valentina Soto"`) |

**Devuelve:** nombre, handle, clase, color de sable, victorias, derrotas, racha, sector de origen, bio, ubicación actual (lugar / planeta / sistema).

---

### `ficha_completa_personaje`
**Tipo:** Lectura · tablas `characters`, `users`, `combats`

Devuelve la ficha completa de un personaje. Usar cuando se necesite información profunda: historia, lore, rango, estilo de combate, estadísticas detalladas y últimos combates.

| Parámetro | Tipo | Descripción |
|---|---|---|
| `nombre` | `string` **(requerido)** | Nombre completo o handle del personaje |

**Devuelve:** identidad completa, tier/grado, color de sable, bio, lore, récord (victorias/derrotas/racha), winrate, estadísticas físicas (fuerza, velocidad, técnica, defensa, foco), descripción del estilo de combate derivada de stats y clase, últimos 5 combates resueltos con resultado, créditos y ubicación actual.

---

### `personajes_en_lugar`
**Tipo:** Lectura · tabla `characters`

Lista todos los personajes presentes actualmente en un lugar del mapa galáctico.

| Parámetro | Tipo | Descripción |
|---|---|---|
| `lugar` | `string` **(requerido)** | Nombre del lugar, zona, planeta o sistema |

**Devuelve:** total de personajes presentes y ficha resumida de cada uno (nombre, handle, clase, sable, lugar exacto, planeta).

---

### `info_ubicacion`
**Tipo:** Lectura · tablas `map_lugares`, `characters`

Devuelve datos completos de un lugar del mapa.

| Parámetro | Tipo | Descripción |
|---|---|---|
| `lugar` | `string` **(requerido)** | Nombre del lugar a consultar |

**Devuelve:** nombre, descripción, tipo, zona, planeta, sistema, NPCs visibles en ese lugar, personajes presentes.

---

### `consultar_eventos_planeta`
**Tipo:** Lectura · tabla `map_planetas`

Lee el registro de eventos importantes de un planeta.

| Parámetro | Tipo | Descripción |
|---|---|---|
| `planeta` | `string` **(requerido)** | Nombre del planeta a consultar |

**Devuelve:** nombre del planeta y el campo `eventos_importantes` completo (texto libre, una entrada por línea).

---

### `registrar_evento_planeta`
**Tipo:** ⚠️ Escritura · tabla `map_planetas`

Agrega una nueva entrada al registro de eventos de un planeta. Se guarda con fecha automática en formato `[YYYY-MM-DD] descripción`.

| Parámetro | Tipo | Descripción |
|---|---|---|
| `planeta` | `string` **(requerido)** | Nombre del planeta donde ocurrió el evento |
| `descripcion` | `string` **(requerido)** | Descripción breve del evento (máx. 200 caracteres) |

**Devuelve:** confirmación y la línea exacta que se escribió en la BD.

---

## Flujo de una respuesta

```
Usuario envía mensaje
        │
        ▼
POST /api/npcs/{id}/chat
        │
        ▼
Mistral (1ª llamada) ── sin skill ──────────────────▶ Respuesta final
        │
        │ con skill (tool_calls)
        ▼
Backend ejecuta query en BD
        │
        ▼
Mistral (2ª llamada) con resultado de la BD
        │
        ▼
Respuesta final  →  guardada en npc_chat_logs
```

---

## Prompt de ejemplo anotado

```
# [A] Identidad
Eres Kael-9, un informante androide que opera en la Cantina Oscura de Estación Kepler.
Hablas de forma directa, con un tono frío y transaccional. Usas pocas palabras.
Tienes acceso a registros de la Orden y a rumores del sector.

# [B] Restricciones
Nunca revelas tus fuentes ni a quién le vendes información.
No discutes política imperial. Si alguien presiona ese tema, desvía.
No sabes nada sobre eventos anteriores al Año 2 de la Orden.

# [C] Uso de skills
Si alguien pregunta por un personaje, consulta buscar_personaje antes de responder.
Si alguien pregunta quién está en un lugar, usa personajes_en_lugar.
Si alguien te cuenta algo relevante sobre un planeta (avistamientos, conflictos,
movimientos de tropas), regístralo con registrar_evento_planeta y confírmalo.
Si preguntan sobre historia reciente de un planeta, consulta consultar_eventos_planeta.

# [D] Formato
Responde siempre en 2 oraciones máximo. Sin listas. Sin saludos.
Si no tienes información sobre algo, di "No tengo datos sobre eso."
```

### Por qué cada sección

| Sección | Propósito |
|---|---|
| **A · Identidad** | Nombre, lugar físico, rol y tono. El modelo ancla el personaje en coordenadas concretas del universo. |
| **B · Restricciones** | Sin esto, el modelo puede inventar datos fuera de la BD. Acota el dominio de conocimiento del NPC. |
| **C · Skills** | Instrucciones condicionales en lenguaje natural que activan las tools en los momentos correctos. |
| **D · Formato** | Longitud máxima y estructura. Crucial para mantener el ritmo narrativo del RPG. |

---

## Ejemplos de conversación

**Consulta de personaje:**
```
Jugador:  "¿Sabes algo de Valentina Soto?"

→ NPC invoca: buscar_personaje({ nombre: "Valentina Soto" })
← BD devuelve: clase vanguardia, sable azul, 34V-11D, racha 4, ubicación Domo Central

NPC:  "V-SOTO. Vanguardia, sable azul. 34-11, racha de 4.
       Ahora está en el Domo Central. No subestimes su velocidad de cierre."
```

**Registro de evento:**
```
Jugador:  "Anoche vi naves imperiales sobrevolando Korriban."

→ NPC invoca: registrar_evento_planeta({ planeta: "Korriban",
              descripcion: "Naves imperiales vistas sobrevolando el planeta" })
← BD escribe: [2026-06-29] Naves imperiales vistas sobrevolando el planeta

NPC:  "Anotado. No eres el primero que me dice algo así esta semana."
```

---

## Buenas prácticas

- **Limita la longitud de respuesta.** Siempre incluye una instrucción de formato. "Máximo 2 oraciones" evita respuestas largas que rompen el ritmo del RPG.
- **Ancla al mapa galáctico.** Menciona el lugar físico del NPC. El modelo responde más en personaje cuando tiene coordenadas concretas.
- **Define qué no sabe.** Sin restricciones, el modelo puede inventar datos. Acota el dominio de conocimiento explícitamente.
- **Usa `registrar_evento` con criterio.** Indica qué tipo de información merece archivarse; sin guía, puede registrar cosas triviales.
- **El historial persiste entre sesiones.** Los últimos 8 mensajes se envían siempre como contexto — el NPC recuerda conversaciones anteriores del mismo jugador.
- **Las skills no requieren mención directa.** El modelo las invoca si el contexto lo justifica; mencionarlas en el prompt solo mejora la tasa de activación.

---

## Estructura de BD

```
npc_chat_logs
├── user_id      FK → users
├── npc_id       FK → map_npcs
├── role         enum: user | assistant
├── content      text
└── created_at

map_planetas
└── eventos_importantes   text nullable
    Formato: una entrada por línea → "[YYYY-MM-DD] descripción"
```
