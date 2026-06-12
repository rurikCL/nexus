import api from './client.js';

/*
  Contrato de la API NÉXUS ↔ Laravel.

  Estas funciones definen los endpoints que el frontend consume. Hoy NO se usan
  (useStore hidrata desde el mock src/data/seed.js para que la app corra sin
  backend). Para conectar el backend real: importa estas funciones en
  src/store/useStore.js y reemplaza la hidratación inicial + cada acción.

  Rutas Laravel sugeridas (routes/api.php), protegidas con Sanctum:

    GET    /api/me                         -> usuario + personaje + créditos + rol
    GET    /api/combatants                 -> listado (roster / ranking)
    GET    /api/combatants/{handle}        -> perfil público
    POST   /api/character                  -> crear/editar personaje
    GET    /api/training?month=YYYY-MM      -> días + bitácoras
    POST   /api/training                   -> marcar asistencia de un día (otorga créditos)
    PATCH  /api/training/{day}             -> editar bitácora
    POST   /api/training/{day}/media       -> subir foto/video (multipart)
    GET    /api/tasks                      -> tareas del usuario (o de pupilos si tutor)
    POST   /api/tasks                      -> tutor asigna tarea (dispara notificación)
    PATCH  /api/tasks/{id}                 -> avance del pupilo
    POST   /api/tasks/{id}/approve         -> tutor aprueba (abona recompensa)
    GET    /api/events                     -> eventos activos
    GET    /api/combats                    -> cartelera oficial con cuotas
    POST   /api/combats/{id}/resolve       -> resolver combate (solo backend/admin)
    POST   /api/bets                       -> apostar (descuenta créditos)
    GET    /api/bets                       -> apuestas del usuario
    POST   /api/challenges                 -> retar a un combatiente a duelo oficial
*/

export const NexusAPI = {
  me:                ()            => api.get('/me').then(r => r.data),
  combatants:        ()            => api.get('/combatants').then(r => r.data),
  publicProfile:     (handle)      => api.get(`/combatants/${handle}`).then(r => r.data),
  saveCharacter:     (payload)     => api.post('/character', payload).then(r => r.data),
  training:          (month)       => api.get('/training', { params: { month } }).then(r => r.data),
  logDay:            (day)         => api.post('/training', { day }).then(r => r.data),
  updateLog:         (day, patch)  => api.patch(`/training/${day}`, patch).then(r => r.data),
  uploadMedia:       (day, form)   => api.post(`/training/${day}/media`, form, { headers: { 'Content-Type': 'multipart/form-data' } }).then(r => r.data),
  tasks:             ()            => api.get('/tasks').then(r => r.data),
  addTask:           (payload)     => api.post('/tasks', payload).then(r => r.data),
  updateTask:        (id, patch)   => api.patch(`/tasks/${id}`, patch).then(r => r.data),
  approveTask:       (id)          => api.post(`/tasks/${id}/approve`).then(r => r.data),
  events:            ()            => api.get('/events').then(r => r.data),
  combats:           ()            => api.get('/combats').then(r => r.data),
  placeBet:          (payload)     => api.post('/bets', payload).then(r => r.data),
  bets:              ()            => api.get('/bets').then(r => r.data),
  createChallenge:   (payload)     => api.post('/challenges', payload).then(r => r.data),
};

export default NexusAPI;
