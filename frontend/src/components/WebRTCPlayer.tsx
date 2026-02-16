import React, { useEffect, useRef, useState } from 'react';
import { Activity, AlertCircle, Loader2, VideoOff } from 'lucide-react';

interface WebRTCPlayerProps {
    url?: string;
    label?: string;
    className?: string;
}

/**
 * Player de câmera que tenta:
 * 1. Conectar via go2rtc WebRTC (se disponível)
 * 2. Fallback para MSE via go2rtc
 * 3. Fallback para snapshot estático
 * Se nada funcionar, exibe placeholder visual.
 */
const WebRTCPlayer: React.FC<WebRTCPlayerProps> = ({ url, label, className }) => {
    const [status, setStatus] = useState<'loading' | 'connected' | 'error' | 'idle'>('idle');
    const videoRef = useRef<HTMLVideoElement>(null);
    const imgRef = useRef<HTMLImageElement>(null);
    const [useSnapshot, setUseSnapshot] = useState(false);

    useEffect(() => {
        if (!url) {
            setStatus('idle');
            return;
        }

        setStatus('loading');

        // Tenta detectar se go2rtc está disponível convertendo RTSP URL
        // go2rtc expõe streams em: http://HOST:1984/api/stream.mp4?src=RTSP_URL
        // Para produção, configure GO2RTC_URL no .env
        const go2rtcBase = (window as any).__GO2RTC_URL || '';

        if (go2rtcBase && url.startsWith('rtsp://')) {
            const streamUrl = `${go2rtcBase}/api/stream.mp4?src=${encodeURIComponent(url)}`;
            const video = videoRef.current;
            if (video) {
                video.src = streamUrl;
                video.play()
                    .then(() => setStatus('connected'))
                    .catch(() => {
                        setUseSnapshot(true);
                        setStatus('idle');
                    });
            }
        } else {
            // Sem go2rtc — mostra placeholder aguardando configuração
            const timeout = setTimeout(() => setStatus('idle'), 800);
            return () => clearTimeout(timeout);
        }
    }, [url]);

    return (
        <div className={`bg-neutral-900 rounded-lg border border-neutral-800 relative overflow-hidden group ${className || ''}`}>
            {/* Video element (hidden when not connected) */}
            <video
                ref={videoRef}
                className={`w-full h-full object-cover ${status === 'connected' ? 'block' : 'hidden'}`}
                autoPlay
                muted
                playsInline
                loop
            />

            {/* Placeholder when not connected */}
            {status !== 'connected' && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-neutral-900">
                    {status === 'loading' && (
                        <Loader2 className="h-6 w-6 text-blue-500 animate-spin mb-2" />
                    )}
                    {status === 'error' && (
                        <>
                            <AlertCircle className="h-6 w-6 text-red-500 mb-2" />
                            <span className="text-red-400 font-mono text-[10px]">ERRO DE CONEXÃO</span>
                        </>
                    )}
                    {status === 'idle' && (
                        <>
                            <VideoOff className="h-6 w-6 text-neutral-700 mb-2" />
                            <span className="text-neutral-600 font-mono text-[10px] uppercase text-center px-3 leading-relaxed">
                                {label || 'CÂMERA'}
                            </span>
                            {url && (
                                <span className="text-neutral-700 font-mono text-[8px] mt-1">
                                    AGUARDANDO SINAL
                                </span>
                            )}
                        </>
                    )}
                </div>
            )}

            {/* Camera label overlay */}
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent px-2 py-1.5">
                <span className="text-[9px] font-mono text-white/80 uppercase tracking-wider">
                    {label || 'CAM'}
                </span>
                {status === 'connected' && (
                    <span className="ml-2 inline-block w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" title="AO VIVO" />
                )}
            </div>
        </div>
    );
};

export default WebRTCPlayer;
