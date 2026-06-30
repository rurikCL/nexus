<?php

use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\PvpCombatController;
use App\Http\Controllers\Api\AdminController;
use App\Http\Controllers\Api\MapController;
use App\Http\Controllers\Api\NpcChatController;
use App\Http\Controllers\Api\BetController;
use App\Http\Controllers\Api\CharacterController;
use App\Http\Controllers\Api\CharacterPhotoController;
use App\Http\Controllers\Api\ChallengeController;
use App\Http\Controllers\Api\CombatantController;
use App\Http\Controllers\Api\CombatController;
use App\Http\Controllers\Api\EventController;
use App\Http\Controllers\Api\MeController;
use App\Http\Controllers\Api\NotificationController;
use App\Http\Controllers\Api\TaskController;
use App\Http\Controllers\Api\TrainingController;
use App\Http\Controllers\Api\EmblemUploadController;
use App\Http\Controllers\Api\MisionController;
use App\Http\Controllers\Api\TemporadaController;
use App\Http\Controllers\Api\MessageController;
use App\Http\Controllers\Api\WidgetLayoutController;
use App\Http\Controllers\Api\ModuloEntrenamientoController;
use App\Http\Controllers\Api\InstagramController;
use App\Http\Controllers\Api\SesionEntrenamientoController;
use App\Http\Controllers\Api\RolHabilidadController;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Broadcast;
use Illuminate\Support\Facades\Route;

// Public auth routes
Route::post('/login',    [AuthController::class, 'login']);
Route::post('/register', [AuthController::class, 'register']);

// Instagram OAuth callback (pública — Meta redirige aquí sin Bearer token)
Route::get('/instagram/callback', [InstagramController::class, 'callback']);

// Broadcasting auth para SPAs con Sanctum (Bearer token en lugar de sesión web)
Route::post('/broadcasting/auth', function (Request $request) {
    return Broadcast::auth($request);
})->middleware('auth:sanctum');

Route::middleware('auth:sanctum')->group(function () {
    Route::post('/logout', [AuthController::class, 'logout']);
    Route::get('/me', [MeController::class, 'show']);

    Route::post('/character', [CharacterController::class, 'upsert']);
    Route::post('/character/photo', [CharacterPhotoController::class, 'store']);
    Route::post('/character/reputation', [CharacterController::class, 'updateReputation']);
    Route::post('/character/habilidades',        [CharacterController::class, 'updateHabilidades']);
    Route::post('/character/aprender-habilidad', [CharacterController::class, 'aprenderHabilidad']);
    Route::get('/rol-habilidades', [RolHabilidadController::class, 'index']);

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

    Route::get('/modulos-entrenamiento',                          [ModuloEntrenamientoController::class, 'index']);
    Route::post('/modulos-entrenamiento',                         [ModuloEntrenamientoController::class, 'store']);
    Route::get('/modulos-entrenamiento/revisores',                [ModuloEntrenamientoController::class, 'revisores']);
    Route::get('/modulos-entrenamiento/{moduloEntrenamiento}',    [ModuloEntrenamientoController::class, 'show']);
    Route::put('/modulos-entrenamiento/{moduloEntrenamiento}',    [ModuloEntrenamientoController::class, 'update']);
    Route::delete('/modulos-entrenamiento/{moduloEntrenamiento}', [ModuloEntrenamientoController::class, 'destroy']);

    Route::get('/misiones', [MisionController::class, 'index']);
    Route::post('/misiones', [MisionController::class, 'store']);
    Route::patch('/misiones/{mision}', [MisionController::class, 'update']);
    Route::delete('/misiones/{mision}', [MisionController::class, 'destroy']);
    Route::post('/misiones/{mision}/assign', [MisionController::class, 'assign']);
    Route::post('/misiones/{mision}/accept', [MisionController::class, 'accept']);
    Route::delete('/misiones/{mision}/users/{userId}', [MisionController::class, 'unassign']);
    Route::patch('/misiones/{mision}/progress', [MisionController::class, 'updateProgress']);

    Route::get('/notifications', [NotificationController::class, 'index']);
    Route::post('/notifications/test', [NotificationController::class, 'test']);
    Route::post('/notifications/read-all', [NotificationController::class, 'markAllRead']);
    Route::post('/notifications/{id}/read', [NotificationController::class, 'markRead']);
    Route::delete('/notifications/{id}', [NotificationController::class, 'destroy']);

    // Mensajes directos
    Route::get('/messages/unread',       [MessageController::class, 'unread']);
    Route::get('/messages/{userId}',     [MessageController::class, 'conversation']);
    Route::post('/messages',             [MessageController::class, 'send']);

    // Instagram
    Route::get('/instagram/redirect',    [InstagramController::class, 'redirect']);
    Route::get('/instagram/status',      [InstagramController::class, 'status']);
    Route::get('/instagram/posts',       [InstagramController::class, 'posts']);
    Route::post('/instagram/publish',    [InstagramController::class, 'publish']);
    Route::delete('/instagram/disconnect', [InstagramController::class, 'disconnect']);

    // Mapa galáctico
    Route::get('/map/sistemas',          [MapController::class, 'sistemas']);
    Route::get('/map/sistemas/{id}',     [MapController::class, 'sistema']);
    Route::get('/map/planetas/{id}',     [MapController::class, 'planeta']);
    Route::get('/map/zonas/{id}',        [MapController::class, 'zona']);
    Route::get('/map/lugares/{id}',      [MapController::class, 'lugar']);
    Route::get('/map/npcs/{id}',         [MapController::class, 'npc']);
    Route::post('/map/location',         [MapController::class, 'updateLocation']);

    // Sesiones de entrenamiento
    Route::get('/sesiones/disponibles',       [SesionEntrenamientoController::class, 'disponibles']);
    Route::get('/sesiones',                   [SesionEntrenamientoController::class, 'index']);
    Route::post('/sesiones',                  [SesionEntrenamientoController::class, 'store']);
    Route::get('/sesiones/{id}',              [SesionEntrenamientoController::class, 'show']);
    Route::post('/sesiones/{id}/plan',        [SesionEntrenamientoController::class, 'savePlan']);
    Route::post('/sesiones/{id}/attend',      [SesionEntrenamientoController::class, 'attend']);
    Route::delete('/sesiones/{id}/attend',    [SesionEntrenamientoController::class, 'unattend']);
    Route::post('/sesiones/{id}/close',       [SesionEntrenamientoController::class, 'close']);

    // Combate PvP
    Route::post('/pvp/challenge',      [PvpCombatController::class, 'challenge']);
    Route::get('/pvp/active',          [PvpCombatController::class, 'active']);
    Route::get('/pvp/{id}',            [PvpCombatController::class, 'show']);
    Route::post('/pvp/{id}/action',    [PvpCombatController::class, 'action']);
    Route::post('/pvp/{id}/accept',    [PvpCombatController::class, 'accept']);
    Route::post('/pvp/{id}/decline',   [PvpCombatController::class, 'decline']);

    // NPC AI chat
    Route::get('/npcs/{id}/chat/status', [NpcChatController::class, 'status']);
    Route::post('/npcs/{id}/chat',       [NpcChatController::class, 'chat']);

    // Admin CRUD
    Route::prefix('admin')->group(function () {
        Route::get('/{entity}/options',  [AdminController::class, 'options']);
        Route::get('/{entity}',          [AdminController::class, 'index']);
        Route::post('/{entity}',         [AdminController::class, 'store']);
        Route::patch('/{entity}/{id}',   [AdminController::class, 'update']);
        Route::delete('/{entity}/{id}',  [AdminController::class, 'destroy']);
    });
});
