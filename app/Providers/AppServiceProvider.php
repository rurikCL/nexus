<?php

namespace App\Providers;

use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Vite;
use Illuminate\Support\ServiceProvider;
use NotificationChannels\WebPush\Events\NotificationFailed;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        Vite::prefetch(concurrency: 3);

        // El paquete de webpush falla en silencio (evento sin listener por defecto) —
        // lo dejamos en el log para poder diagnosticar por qué un push no llegó.
        Event::listen(function (NotificationFailed $event) {
            Log::warning('Web push falló', [
                'endpoint' => $event->subscription->endpoint,
                'status_code' => $event->report->getResponse()?->getStatusCode(),
                'reason' => $event->report->getReason(),
                'expired' => $event->report->isSubscriptionExpired(),
            ]);
        });
    }
}
