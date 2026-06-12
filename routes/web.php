<?php

use Illuminate\Support\Facades\Route;

// SPA catch-all — React Router maneja la navegación del lado del cliente
Route::get('/{any}', function () {
    return view('app');
})->where('any', '.*');
