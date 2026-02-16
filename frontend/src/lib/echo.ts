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

    // Quando host vazio, usa mesma origem da página (IP ou domínio)
    const wsHost = (import.meta.env.VITE_REVERB_HOST || '').trim()
        || (typeof window !== 'undefined' ? window.location.hostname : 'localhost');
    const wsPort = (import.meta.env.VITE_REVERB_PORT || '').trim()
        || (typeof window !== 'undefined'
            ? (window.location.port || (window.location.protocol === 'https:' ? '443' : '80'))
            : '80');
    const useTls = (import.meta.env.VITE_REVERB_SCHEME || '').trim()
        ? (import.meta.env.VITE_REVERB_SCHEME ?? 'https') === 'https'
        : (typeof window !== 'undefined' ? window.location.protocol === 'https:' : false);

    echoInstance = new Echo({
        broadcaster: 'reverb',
        key,
        wsHost,
        wsPort: parseInt(wsPort, 10) || 80,
        wssPort: parseInt(wsPort, 10) || 443,
        forceTLS: useTls,
        enabledTransports: ['ws', 'wss'],
    });

    return echoInstance;
}

export default getEcho;
