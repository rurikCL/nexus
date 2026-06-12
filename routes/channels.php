<?php

use Illuminate\Support\Facades\Broadcast;

// Canal privado por usuario — usado por el sistema de notificaciones de Laravel
// Laravel resuelve automáticamente App.Models.User.{id} para notificaciones broadcast
Broadcast::channel('App.Models.User.{id}', function ($user, $id) {
    return (int) $user->id === (int) $id;
});
