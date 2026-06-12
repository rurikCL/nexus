<?php

use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\BetController;
use App\Http\Controllers\Api\CharacterController;
use App\Http\Controllers\Api\ChallengeController;
use App\Http\Controllers\Api\CombatantController;
use App\Http\Controllers\Api\CombatController;
use App\Http\Controllers\Api\EventController;
use App\Http\Controllers\Api\MeController;
use App\Http\Controllers\Api\NotificationController;
use App\Http\Controllers\Api\TaskController;
use App\Http\Controllers\Api\TrainingController;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Broadcast;
use Illuminate\Support\Facades\Route;

// Public auth routes
Route::post('/login',    [AuthController::class, 'login']);
Route::post('/register', [AuthController::class, 'register']);

// Broadcasting auth para SPAs con Sanctum (Bearer token en lugar de sesión web)
Route::post('/broadcasting/auth', function (Request $request) {
    return Broadcast::auth($request);
})->middleware('auth:sanctum');

Route::middleware('auth:sanctum')->group(function () {
    Route::post('/logout', [AuthController::class, 'logout']);
    Route::get('/me', [MeController::class, 'show']);

    Route::post('/character', [CharacterController::class, 'upsert']);

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
    Route::post('/events/{event}/register', [EventController::class, 'register']);
    Route::delete('/events/{event}/register', [EventController::class, 'unregister']);
    Route::post('/events/{event}/claim', [EventController::class, 'claim']);

    Route::get('/combats', [CombatController::class, 'index']);
    Route::post('/combats/{combat}/resolve', [CombatController::class, 'resolve']);

    Route::get('/bets', [BetController::class, 'index']);
    Route::post('/bets', [BetController::class, 'store']);

    Route::post('/challenges', [ChallengeController::class, 'store']);

    Route::get('/notifications', [NotificationController::class, 'index']);
    Route::post('/notifications/test', [NotificationController::class, 'test']);
    Route::post('/notifications/read-all', [NotificationController::class, 'markAllRead']);
    Route::post('/notifications/{id}/read', [NotificationController::class, 'markRead']);
    Route::delete('/notifications/{id}', [NotificationController::class, 'destroy']);
});
