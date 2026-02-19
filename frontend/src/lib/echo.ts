import type EchoType from 'laravel-echo';

let echoInstance: EchoType<'reverb'> | null = null;
let initAttempted = false;

/**
 * Retorna instância singleton do Laravel Echo (WebSocket).
 * - Se VITE_REVERB_APP_KEY não está definida → retorna null (sem tentar conectar)
 * - Se falhar ao conectar → retorna null com warning único no console
 * - Se já conectado → retorna instância existente
 */
async function initEcho(): Promise<EchoType<'reverb'> | null> {
    if (echoInstance) return echoInstance;
    if (initAttempted) return null;

    const key = (import.meta.env.VITE_REVERB_APP_KEY || '').trim();
    if (!key) {
        initAttempted = true;
        if (!import.meta.env.PROD) {
            console.info('[Echo] VITE_REVERB_APP_KEY não configurada — WebSocket desabilitado.');
        }
        return null;
    }

    try {
        // Dynamic import — Pusher e Echo só entram no bundle se realmente usar
        const [{ default: Pusher }, { default: Echo }] = await Promise.all([
            import('pusher-js'),
            import('laravel-echo'),
        ]);

        // Desabilita logs automáticos do Pusher no console
        Pusher.logToConsole = false;

        // Expõe Pusher no window (requerido pelo Laravel Echo)
        (window as any).Pusher = Pusher;

        // Quando host vazio, usa mesma origem da página (IP ou domínio)
        const wsHost = (import.meta.env.VITE_REVERB_HOST || '').trim()
            || window.location.hostname;
        const wsPort = (import.meta.env.VITE_REVERB_PORT || '').trim()
            || window.location.port
            || (window.location.protocol === 'https:' ? '443' : '80');
        const useTls = (import.meta.env.VITE_REVERB_SCHEME || '').trim()
            ? import.meta.env.VITE_REVERB_SCHEME === 'https'
            : window.location.protocol === 'https:';

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
    } catch (err) {
        initAttempted = true;
        console.warn('[Echo] Falha ao inicializar WebSocket — tempo real desabilitado.', err);
        return null;
    }
}

// Cache síncrono para acesso rápido após inicialização
function getEchoSync(): EchoType<'reverb'> | null {
    return echoInstance;
}

export { initEcho, getEchoSync };
export default initEcho;
