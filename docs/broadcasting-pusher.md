# Broadcasting con Pusher

## Qué se instaló y por qué

Laravel 12 no trae Pusher preinstalado. Para habilitarlo se necesitan tres piezas:

| Pieza | Paquete | Rol |
|---|---|---|
| Backend PHP | `pusher/pusher-php-server` | Publica eventos desde el servidor Laravel |
| Frontend JS | `laravel-echo` | API unificada para escuchar canales en el navegador |
| Frontend JS | `pusher-js` | Transporte WebSocket que usa Echo internamente |

```bash
composer require pusher/pusher-php-server
npm install --save-dev laravel-echo pusher-js
```

---

## Archivos modificados

### `.env`

```env
BROADCAST_CONNECTION=pusher

PUSHER_APP_ID=2165731
PUSHER_APP_KEY=5f08ab892305b77936b2
PUSHER_APP_SECRET=725cb2bec0a11cc1d52e
PUSHER_APP_CLUSTER=sa1
PUSHER_HOST=
PUSHER_PORT=443
PUSHER_SCHEME=https

VITE_PUSHER_APP_KEY="${PUSHER_APP_KEY}"
VITE_PUSHER_APP_CLUSTER="${PUSHER_APP_CLUSTER}"
```

Las variables `VITE_*` son necesarias para que Vite las exponga al frontend en tiempo de build. Las variables sin prefijo las usa el backend PHP.

### `config/broadcasting.php` _(creado manualmente)_

Laravel 11+ no publica este archivo por defecto. Se creó en `config/broadcasting.php` con el driver `pusher` apuntando al cluster `sa1` (Sudamérica).

El fragmento relevante:

```php
'pusher' => [
    'driver' => 'pusher',
    'key'    => env('PUSHER_APP_KEY'),
    'secret' => env('PUSHER_APP_SECRET'),
    'app_id' => env('PUSHER_APP_ID'),
    'options' => [
        'cluster' => env('PUSHER_APP_CLUSTER'),
        'host'    => 'api-sa1.pusher.com',
        'port'    => 443,
        'scheme'  => 'https',
        'useTLS'  => true,
    ],
],
```

### `resources/js/bootstrap.js`

Inicializa `window.Echo` con el transporte Pusher usando las variables de entorno de Vite:

```js
import Echo from 'laravel-echo';
import Pusher from 'pusher-js';

window.Pusher = Pusher;

window.Echo = new Echo({
    broadcaster: 'pusher',
    key: import.meta.env.VITE_PUSHER_APP_KEY,
    cluster: import.meta.env.VITE_PUSHER_APP_CLUSTER,
    forceTLS: true,
});
```

### `resources/js/app.jsx`

Se agregó `import './bootstrap.js'` como primera línea para que Vite incluya Echo y Pusher en el bundle. Sin este import, las librerías no se empaquetan.

---

## Cómo usar Broadcasting

### 1. Crear un evento broadcastable

```bash
php artisan make:event NuevoCombate
```

```php
// app/Events/NuevoCombate.php
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Broadcasting\Channel;

class NuevoCombate implements ShouldBroadcast
{
    public function __construct(public array $combate) {}

    public function broadcastOn(): Channel
    {
        return new Channel('combates');
    }
}
```

### 2. Disparar el evento desde el backend

```php
broadcast(new NuevoCombate($combate));
// o solo a otros (no al que lo disparó):
broadcast(new NuevoCombate($combate))->toOthers();
```

### 3. Escuchar en el frontend

```js
window.Echo.channel('combates')
    .listen('NuevoCombate', (data) => {
        console.log('Nuevo combate:', data.combate);
    });
```

### Canales privados (requieren autenticación)

```js
window.Echo.private(`combatiente.${userId}`)
    .listen('DesafioRecibido', (data) => { ... });
```

Para canales privados Laravel valida la suscripción en `routes/channels.php`:

```php
Broadcast::channel('combatiente.{id}', function ($user, $id) {
    return (int) $user->id === (int) $id;
});
```

---

## Verificar que funciona

```bash
# Limpiar caché de config tras cambios en .env
php artisan config:clear

# Ver la config activa de broadcasting
php artisan config:show broadcasting
```

El cluster `sa1` corresponde a la región **South America (São Paulo)**. Para producción se reutilizan las mismas credenciales cambiando `APP_ENV=production` y asegurando que `PUSHER_SCHEME=https`.
