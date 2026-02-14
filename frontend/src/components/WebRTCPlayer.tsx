import React, { useEffect, useRef, useState } from 'react';
import { Activity, AlertCircle, Loader2 } from 'lucide-react';

interface WebRTCPlayerProps {
    url?: string;
    label?: string;
    className?: string;
}

/**
 * Componente para exibição de streams WebRTC (via go2rtc)
 * Atualmente implementado como um placeholder inteligente que aguarda o stream.
 */
const WebRTCPlayer: React.FC<WebRTCPlayerProps> = ({ url, label, className }) => {
    const [status, setStatus] = useState<'loading' | 'connected' | 'error' | 'idle'>('idle');
    const videoRef = useRef<HTMLVideoElement>(null);

    useEffect(() => {
        if (!url) {
            setStatus('idle');
            return;
        }

        setStatus('loading');
        // Simulação de conexão ou tentativa de carregar
        // Numa implementação real com go2rtc, aqui iria a lógica de instanciar o RTCPeerConnection
        // ou usar uma lib como webrtc-adapter

        // Placeholder logic: se tiver URL, assume que tentou conectar
        const timeout = setTimeout(() => {
            // Como não temos o servidor rodando, vamos mostrar 'idle' ou 'error' simulado
            // Mas para o War Room ficar bonito, vamos manter o placeholder visual
            setStatus('idle');
        }, 1000);

        return () => clearTimeout(timeout);
    }, [url]);

    return (
        <div className={`bg-neutral-900 rounded-lg border border-neutral-800 relative overflow-hidden group ${className}`}>
            {status === 'connected' ? (
                <video
                    ref={videoRef}
                    className="w-full h-full object-cover"
                    autoPlay
                    muted
                    playsInline
                />
            ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60">
                    {status === 'loading' && (
                        <Loader2 className="h-8 w-8 text-blue-500 animate-spin mb-2" />
                    )}

                    {status === 'error' && (
                        <AlertCircle className="h-8 w-8 text-red-500 mb-2" />
                    )}

                    {(status === 'idle' || status === 'loading') && (
                        <>
                            <Activity className={`h-8 w-8 text-neutral-700 animate-pulse mb-2 ${status === 'loading' ? 'hidden' : ''}`} />
                            <span className="text-neutral-500 font-mono text-xs uppercase text-center px-4">
                                {label || 'CÂMERA'}
                                {url ? ' - CONECTANDO...' : ' - AGUARDANDO SINAL'}
                            </span>
                        </>
                    )}
                </div>
            )}

            {/* Overlay com Nome da Câmera (só aparece se tiver label e não for erro critico) */}
            <div className="absolute top-2 left-2 bg-black/50 px-2 py-1 rounded text-[10px] font-mono text-white opacity-0 group-hover:opacity-100 transition-opacity">
                {label || 'CAM'}
            </div>
        </div>
    );
};

export default WebRTCPlayer;
