<?php

use App\Http\Controllers\Api\AdminController;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\BetController;
use App\Http\Controllers\Api\ChallengeController;
use App\Http\Controllers\Api\CharacterController;
use App\Http\Controllers\Api\CharacterPhotoController;
use App\Http\Controllers\Api\CombatantController;
use App\Http\Controllers\Api\CombatController;
use App\Http\Controllers\Api\EmblemUploadController;
use App\Http\Controllers\Api\EventController;
use App\Http\Controllers\Api\InstagramController;
use App\Http\Controllers\Api\MapController;
use App\Http\Controllers\Api\MeController;
use App\Http\Controllers\Api\MessageController;
use App\Http\Controllers\Api\MisionController;
use App\Http\Controllers\Api\ModuloEntrenamientoController;
use App\Http\Controllers\Api\ModuloFotoController;
use App\Http\Controllers\Api\NaveController;
use App\Http\Controllers\Api\NotificationController;
use App\Http\Controllers\Api\NpcChatController;
use App\Http\Controllers\Api\NpcVendedorController;
use App\Http\Controllers\Api\PirataEncuentroController;
use App\Http\Controllers\Api\PushSubscriptionController;
use App\Http\Controllers\Api\PvpCombatController;
use App\Http\Controllers\Api\RaidCombatController;
use App\Http\Controllers\Api\RolHabilidadController;
use App\Http\Controllers\Api\SableController;
use App\Http\Controllers\Api\SesionEntrenamientoController;
use App\Http\Controllers\Api\TaskController;
use App\Http\Controllers\Api\TemporadaController;
use App\Http\Controllers\Api\TituloController;
use App\Http\Controllers\Api\TorneoController;
use App\Http\Controllers\Api\TradeController;
use App\Http\Controllers\Api\TrainingController;
use App\Http\Controllers\Api\WidgetLayoutController;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Broadcast;
use Illuminate\Support\Facades\Route;

// Public auth routes
Route::post('/login', [AuthController::class, 'login']);
Route::post('/register', [AuthController::class, 'register']);
Route::get('/public/sedes', [AuthController::class, 'sedes']);

// Instagram OAuth callback (pública — Meta redirige aquí sin Bearer token)
Route::get('/instagram/callback', [InstagramController::class, 'callback']);

// Perfil público de combatiente (pública — usada por la vista /c/{handle} y el QR de Comando)
Route::get('/public/combatants/{handle}', [CombatantController::class, 'showPublic']);

// Broadcasting auth para SPAs con Sanctum (Bearer token en lugar de sesión web)
Route::post('/broadcasting/auth', function (Request $request) {
    return Broadcast::auth($request);
})->middleware('auth:sanctum');

Route::middleware('auth:sanctum')->group(function () {
    Route::post('/logout', [AuthController::class, 'logout']);
    Route::get('/me', [MeController::class, 'show']);
    Route::patch('/me/sede', [MeController::class, 'updateSede']);

    Route::post('/character', [CharacterController::class, 'upsert']);
    Route::post('/character/photo', [CharacterPhotoController::class, 'store']);
    Route::post('/character/reputation', [CharacterController::class, 'updateReputation']);
    Route::post('/character/npc-victory', [CharacterController::class, 'npcVictory']);
    Route::post('/character/npc-espacio-victory', [CharacterController::class, 'npcEspacioVictory']);
    Route::post('/character/habilidades', [CharacterController::class, 'updateHabilidades']);
    Route::post('/character/equipar-arma', [CharacterController::class, 'equiparArma']);
    Route::post('/character/aprender-habilidad', [CharacterController::class, 'aprenderHabilidad']);
    Route::get('/rol-habilidades', [RolHabilidadController::class, 'index']);

    // Armado de sable de luz
    Route::get('/sable/sables', [SableController::class, 'index']);
    Route::post('/sable/sables', [SableController::class, 'store']);
    Route::patch('/sable/sables/{sable}', [SableController::class, 'update']);
    Route::delete('/sable/sables/{sable}', [SableController::class, 'destroy']);
    Route::post('/sable/sables/{sable}/activar', [SableController::class, 'activar']);

    // Títulos e insignias
    Route::get('/titulos', [TituloController::class, 'index']);
    Route::post('/titulos/{titulo}/activar', [TituloController::class, 'activar']);
    Route::post('/titulos/desactivar', [TituloController::class, 'desactivar']);

    Route::get('/combatants', [CombatantController::class, 'index']);
    Route::get('/combatants/{handle}', [CombatantController::class, 'show']);

    Route::get('/training', [TrainingController::class, 'index']);
    Route::post('/training', [TrainingController::class, 'store']);
    Route::patch('/training/{day}', [TrainingController::class, 'update']);

    Route::get('/tasks', [TaskController::class, 'index']);
    Route::post('/tasks', [TaskController::class, 'store']);
    Route::patch('/tasks/{task}', [TaskController::class, 'update']);
    Route::post('/tasks/{task}/approve', [TaskController::class, 'approve']);

    Route::get('/events', [EventController::class, 'index']);
    Route::post('/events', [EventController::class, 'store']);
    Route::post('/events/{event}/register', [EventController::class, 'register']);
    Route::delete('/events/{event}/register', [EventController::class, 'unregister']);
    Route::post('/events/{event}/claim', [EventController::class, 'claim']);

    Route::get('/combats', [CombatController::class, 'index']);
    Route::post('/combats/{combat}/resolve', [CombatController::class, 'resolve']);

    Route::get('/bets', [BetController::class, 'index']);
    Route::post('/bets', [BetController::class, 'store']);

    Route::get('/challenges', [ChallengeController::class, 'index']);
    Route::post('/challenges', [ChallengeController::class, 'store']);
    Route::post('/challenges/{challenge}/accept', [ChallengeController::class, 'accept']);
    Route::post('/challenges/{challenge}/reject', [ChallengeController::class, 'reject']);

    Route::get('/layout/{section}', [WidgetLayoutController::class, 'show']);
    Route::put('/layout/{section}', [WidgetLayoutController::class, 'update']);

    Route::get('/temporadas', [TemporadaController::class, 'index']);
    Route::post('/temporadas', [TemporadaController::class, 'store']);
    Route::get('/temporadas/{temporada}', [TemporadaController::class, 'show']);
    Route::put('/temporadas/{temporada}', [TemporadaController::class, 'update']);

    Route::post('/upload/emblema', [EmblemUploadController::class, 'store']);

    Route::get('/modulos-entrenamiento', [ModuloEntrenamientoController::class, 'index']);
    Route::post('/modulos-entrenamiento', [ModuloEntrenamientoController::class, 'store']);
    Route::get('/modulos-entrenamiento/revisores', [ModuloEntrenamientoController::class, 'revisores']);
    Route::post('/modulos-entrenamiento/fotos/generar', [ModuloFotoController::class, 'store']);
    Route::get('/modulos-entrenamiento/{moduloEntrenamiento}', [ModuloEntrenamientoController::class, 'show']);
    Route::put('/modulos-entrenamiento/{moduloEntrenamiento}', [ModuloEntrenamientoController::class, 'update']);
    Route::delete('/modulos-entrenamiento/{moduloEntrenamiento}', [ModuloEntrenamientoController::class, 'destroy']);

    Route::get('/misiones', [MisionController::class, 'index']);
    Route::post('/misiones', [MisionController::class, 'store']);
    // Static sub-routes MUST come before {mision} wildcard routes
    Route::get('/misiones/comunidad', [MisionController::class, 'comunidad']);
    Route::get('/misiones/individual', [MisionController::class, 'individual']);
    Route::get('/misiones/global', [MisionController::class, 'global']);
    Route::get('/misiones/temporada/{temporadaId}', [MisionController::class, 'porTemporada']);
    Route::get('/misiones/npcs-mision', [MisionController::class, 'npcsMision']);
    Route::patch('/misiones/{mision}', [MisionController::class, 'update']);
    Route::delete('/misiones/{mision}', [MisionController::class, 'destroy']);
    Route::post('/misiones/{mision}/assign', [MisionController::class, 'assign']);
    Route::post('/misiones/{mision}/accept', [MisionController::class, 'accept']);
    Route::post('/misiones/{mision}/completar', [MisionController::class, 'completar']);
    Route::delete('/misiones/{mision}/users/{userId}', [MisionController::class, 'unassign']);
    Route::patch('/misiones/{mision}/progress', [MisionController::class, 'updateProgress']);
    Route::post('/misiones/menu-visit', [MisionController::class, 'menuVisit']);

    Route::get('/torneos', [TorneoController::class, 'index']);
    Route::post('/torneos', [TorneoController::class, 'store']);
    Route::get('/torneos/{torneo}', [TorneoController::class, 'show']);
    Route::patch('/torneos/{torneo}', [TorneoController::class, 'update']);
    Route::delete('/torneos/{torneo}', [TorneoController::class, 'destroy']);
    Route::post('/torneos/{torneo}/inscribir', [TorneoController::class, 'inscribir']);
    Route::delete('/torneos/{torneo}/inscribir', [TorneoController::class, 'retirar']);
    Route::post('/torneos/{torneo}/iniciar', [TorneoController::class, 'iniciar']);
    Route::post('/torneos/{torneo}/combates/{combate}/resolver', [TorneoController::class, 'resolverCombate']);

    Route::get('/notifications', [NotificationController::class, 'index']);
    Route::post('/notifications/test', [NotificationController::class, 'test']);
    Route::post('/notifications/read-all', [NotificationController::class, 'markAllRead']);
    Route::post('/notifications/{id}/read', [NotificationController::class, 'markRead']);
    Route::delete('/notifications/{id}', [NotificationController::class, 'destroy']);

    // Web Push
    Route::get('/push/vapid-public-key', [PushSubscriptionController::class, 'vapidPublicKey']);
    Route::post('/push/subscribe', [PushSubscriptionController::class, 'store']);
    Route::post('/push/unsubscribe', [PushSubscriptionController::class, 'destroy']);

    // Mensajes directos
    Route::get('/messages/unread', [MessageController::class, 'unread']);
    Route::get('/messages/{userId}', [MessageController::class, 'conversation']);
    Route::post('/messages', [MessageController::class, 'send']);

    // Instagram
    Route::get('/instagram/redirect', [InstagramController::class, 'redirect']);
    Route::get('/instagram/status', [InstagramController::class, 'status']);
    Route::get('/instagram/posts', [InstagramController::class, 'posts']);
    Route::post('/instagram/publish', [InstagramController::class, 'publish']);
    Route::delete('/instagram/disconnect', [InstagramController::class, 'disconnect']);

    // Mapa galáctico
    Route::get('/map/sistemas', [MapController::class, 'sistemas']);
    Route::get('/map/sistemas/{id}', [MapController::class, 'sistema']);
    Route::get('/map/planetas/{id}', [MapController::class, 'planeta']);
    Route::get('/map/zonas/{id}', [MapController::class, 'zona']);
    Route::get('/map/lugares/{id}', [MapController::class, 'lugar']);
    Route::get('/map/npcs/{id}', [MapController::class, 'npc']);
    Route::get('/map/npcs-espacio/{id}', [MapController::class, 'naveEspacio']);
    Route::post('/map/planetas/{planetaId}/pirata-encuentro', [PirataEncuentroController::class, 'check']);
    Route::post('/pirata-encuentros/{encuentroId}/victoria', [PirataEncuentroController::class, 'victoria']);
    Route::post('/map/location', [MapController::class, 'updateLocation']);

    // Naves
    Route::get('/naves', [NaveController::class, 'catalogo']);
    Route::get('/naves/mias', [NaveController::class, 'mias']);
    Route::post('/naves/desequipar', [NaveController::class, 'desequipar']);
    Route::post('/naves/{ownedId}/equipar', [NaveController::class, 'equipar']);
    Route::post('/naves/{ownedId}/reabastecer', [NaveController::class, 'reabastecer']);
    Route::post('/naves/{ownedId}/reparar', [NaveController::class, 'reparar']);
    Route::post('/naves/{ownedId}/registrar-dano', [NaveController::class, 'registrarDano']);
    Route::get('/naves/{ownedId}/mejoras-options', [NaveController::class, 'mejorasOptions']);
    Route::post('/naves/{ownedId}/mejoras/{slot}', [NaveController::class, 'equiparMejora']);

    // Sesiones de entrenamiento
    Route::get('/sesiones/disponibles', [SesionEntrenamientoController::class, 'disponibles']);
    Route::get('/sesiones', [SesionEntrenamientoController::class, 'index']);
    Route::post('/sesiones', [SesionEntrenamientoController::class, 'store']);
    Route::get('/sesiones/{id}', [SesionEntrenamientoController::class, 'show']);
    Route::post('/sesiones/{id}/plan', [SesionEntrenamientoController::class, 'savePlan']);
    Route::post('/sesiones/{id}/plan/adicional', [SesionEntrenamientoController::class, 'addAdicional']);
    Route::delete('/sesiones/{id}/plan/adicional/{nodeId}', [SesionEntrenamientoController::class, 'removeAdicional']);
    Route::post('/sesiones/{id}/attend', [SesionEntrenamientoController::class, 'attend']);
    Route::delete('/sesiones/{id}/attend', [SesionEntrenamientoController::class, 'unattend']);
    Route::post('/sesiones/{id}/attend-scan', [SesionEntrenamientoController::class, 'attendScan']);
    Route::post('/sesiones/{id}/close', [SesionEntrenamientoController::class, 'close']);

    // Combate PvP
    Route::post('/pvp/challenge', [PvpCombatController::class, 'challenge']);
    Route::get('/pvp/active', [PvpCombatController::class, 'active']);
    Route::get('/pvp/{id}', [PvpCombatController::class, 'show']);
    Route::post('/pvp/{id}/resumen-ia', [PvpCombatController::class, 'resumenIA']);
    Route::post('/pvp/{id}/action', [PvpCombatController::class, 'action']);
    Route::post('/pvp/{id}/emoji', [PvpCombatController::class, 'emoji']);
    Route::post('/pvp/{id}/accept', [PvpCombatController::class, 'accept']);
    Route::post('/pvp/{id}/decline', [PvpCombatController::class, 'decline']);
    Route::post('/pvp/{id}/cancel', [PvpCombatController::class, 'cancel']);

    // Combate RAID (N jugadores vs 1 NPC jefe, cupos configurables en el NPC)
    Route::post('/raid/join/{npcId}', [RaidCombatController::class, 'join']);
    Route::get('/raid/active', [RaidCombatController::class, 'active']);
    Route::get('/raid/{id}', [RaidCombatController::class, 'show']);
    Route::post('/raid/{id}/ready', [RaidCombatController::class, 'ready']);
    Route::post('/raid/{id}/action', [RaidCombatController::class, 'action']);
    Route::post('/raid/{id}/emoji', [RaidCombatController::class, 'emoji']);
    Route::post('/raid/{id}/leave', [RaidCombatController::class, 'leave']);

    Route::post('/trades/propose', [TradeController::class, 'propose']);
    Route::get('/trades/active', [TradeController::class, 'active']);
    Route::get('/trades/{id}', [TradeController::class, 'show']);
    Route::post('/trades/{id}/accept', [TradeController::class, 'accept']);
    Route::post('/trades/{id}/decline', [TradeController::class, 'decline']);
    Route::post('/trades/{id}/cancel', [TradeController::class, 'cancel']);

    // NPC AI chat
    Route::get('/npcs/refs', [NpcChatController::class, 'refs']);
    Route::get('/npcs/{id}/chat/status', [NpcChatController::class, 'status']);
    Route::post('/npcs/{id}/chat', [NpcChatController::class, 'chat']);

    // Tiendas de NPCs vendedores (naves y objetos con interés aplicado)
    Route::get('/npcs/{npcId}/tienda-naves', [NpcVendedorController::class, 'tiendaNaves']);
    Route::post('/npcs/{npcId}/naves/{naveId}/comprar', [NpcVendedorController::class, 'comprarNave']);
    Route::get('/npcs/{npcId}/tienda-objetos', [NpcVendedorController::class, 'tiendaObjetos']);
    Route::post('/npcs/{npcId}/objetos/{objetoId}/comprar', [NpcVendedorController::class, 'comprarObjeto']);

    // Admin CRUD
    Route::prefix('admin')->group(function () {
        Route::post('/rol_habilidades/{habilidadId}/asignar', [AdminController::class, 'asignarHabilidad']);
        Route::post('/rol_objetos/{objetoId}/asignar', [AdminController::class, 'asignarObjeto']);
        Route::get('/{entity}/options', [AdminController::class, 'options']);
        Route::get('/{entity}', [AdminController::class, 'index']);
        Route::post('/{entity}', [AdminController::class, 'store']);
        Route::patch('/{entity}/{id}', [AdminController::class, 'update']);
        Route::delete('/{entity}/{id}', [AdminController::class, 'destroy']);
    });
});
