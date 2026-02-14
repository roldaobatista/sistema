import Echo from 'laravel-echo';
import Pusher from 'pusher-js';

// Expose Pusher to window object as Laravel Echo expects it
(window as any).Pusher = Pusher;

let echoInstance: Echo<'reverb'> | null = null;

function getEcho(): Echo<'reverb'> | null {
    if (echoInstance) return echoInstance;

    const key = import.meta.env.VITE_REVERB_APP_KEY;
    if (!key) {
        console.warn('[Echo] VITE_REVERB_APP_KEY não configurada — WebSocket desabilitado.');
        return null;
    }

    echoInstance = new Echo({
        broadcaster: 'reverb',
        key,
        wsHost: import.meta.env.VITE_REVERB_HOST,
        wsPort: import.meta.env.VITE_REVERB_PORT,
        wssPort: import.meta.env.VITE_REVERB_PORT,
        forceTLS: (import.meta.env.VITE_REVERB_SCHEME ?? 'https') === 'https',
        enabledTransports: ['ws', 'wss'],
    });

    return echoInstance;
}

export default getEcho;
