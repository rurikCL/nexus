import axios from 'axios';
window.axios = axios;

window.axios.defaults.headers.common['X-Requested-With'] = 'XMLHttpRequest';

// Inyecta el token Sanctum en cada request si existe
const token = localStorage.getItem('nx-token');
if (token) {
    window.axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
}

import Echo from 'laravel-echo';
import Pusher from 'pusher-js';

window.Pusher = Pusher;

// Usa authorizer dinámico para que el token siempre se lea desde localStorage
// en el momento en que se autentique el canal (importante para login post-init)
window.Echo = new Echo({
    broadcaster: 'pusher',
    key: import.meta.env.VITE_PUSHER_APP_KEY,
    cluster: import.meta.env.VITE_PUSHER_APP_CLUSTER,
    forceTLS: true,
    authorizer: (channel) => ({
        authorize: (socketId, callback) => {
            const currentToken = localStorage.getItem('nx-token');
            axios.post('/api/broadcasting/auth', {
                socket_id: socketId,
                channel_name: channel.name,
            }, {
                headers: { Authorization: currentToken ? `Bearer ${currentToken}` : '' },
            })
            .then(r => callback(false, r.data))
            .catch(e => callback(true, e));
        },
    }),
});
