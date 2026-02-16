import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Loader2, AlertCircle, VideoOff } from 'lucide-react';

interface WebRTCPlayerProps {
    url?: string;
    label?: string;
    className?: string;
}

const MAX_RETRIES = 5;
const RETRY_DELAYS = [3000, 5000, 10000, 20000, 30000];

const WebRTCPlayer: React.FC<WebRTCPlayerProps> = ({ url, label, className }) => {
    const [status, setStatus] = useState<'loading' | 'connected' | 'error' | 'idle'>('idle');
    const videoRef = useRef<HTMLVideoElement>(null);
    const retryCount = useRef(0);
    const retryTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
    const mounted = useRef(true);
    const scheduleRetryRef = useRef<() => void>(() => {});

    const connect = useCallback(() => {
        if (!url || !mounted.current) return;

        setStatus('loading');
        const go2rtcBase = (window as Window & { __GO2RTC_URL?: string }).__GO2RTC_URL || '';

        if (!go2rtcBase || !url.startsWith('rtsp://')) {
            const timeout = setTimeout(() => {
                if (mounted.current) setStatus('idle');
            }, 800);
            return () => clearTimeout(timeout);
        }

        const streamUrl = `${go2rtcBase}/api/stream.mp4?src=${encodeURIComponent(url)}`;
        const video = videoRef.current;
        if (!video) return;

        video.src = streamUrl;
        video.play()
            .then(() => {
                if (mounted.current) {
                    setStatus('connected');
                    retryCount.current = 0;
                }
            })
            .catch(() => {
                if (mounted.current) scheduleRetryRef.current();
            });
    }, [url]);

    const scheduleRetry = useCallback(() => {
        if (retryCount.current >= MAX_RETRIES) {
            setStatus('error');
            return;
        }

        const delay = RETRY_DELAYS[Math.min(retryCount.current, RETRY_DELAYS.length - 1)];
        setStatus('loading');
        retryCount.current += 1;

        retryTimer.current = setTimeout(() => {
            if (mounted.current) connect();
        }, delay);
    }, [connect]);

    useEffect(() => {
        scheduleRetryRef.current = scheduleRetry;
    }, [scheduleRetry]);

    useEffect(() => {
        mounted.current = true;
        retryCount.current = 0;
        connect();

        return () => {
            mounted.current = false;
            if (retryTimer.current) clearTimeout(retryTimer.current);
            if (videoRef.current) {
                videoRef.current.src = '';
                videoRef.current.load();
            }
        };
    }, [connect]);

    const handleVideoError = useCallback(() => {
        if (mounted.current && status === 'connected') {
            scheduleRetry();
        }
    }, [status, scheduleRetry]);

    const handleManualRetry = () => {
        retryCount.current = 0;
        connect();
    };

    return (
        <div className={`bg-neutral-900 rounded-lg border border-neutral-800 relative overflow-hidden group ${className || ''}`}>
            <video
                ref={videoRef}
                className={`w-full h-full object-cover ${status === 'connected' ? 'block' : 'hidden'}`}
                autoPlay
                muted
                playsInline
                loop
                onError={handleVideoError}
            />

            {status !== 'connected' && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-neutral-900">
                    {status === 'loading' && (
                        <>
                            <Loader2 className="h-6 w-6 text-blue-500 animate-spin mb-2" />
                            {retryCount.current > 0 && (
                                <span className="text-neutral-600 font-mono text-[8px]">
                                    RECONECTANDO ({retryCount.current}/{MAX_RETRIES})
                                </span>
                            )}
                        </>
                    )}
                    {status === 'error' && (
                        <>
                            <AlertCircle className="h-6 w-6 text-red-500 mb-2" />
                            <span className="text-red-400 font-mono text-[10px]">ERRO DE CONEXÃO</span>
                            <button
                                onClick={handleManualRetry}
                                className="mt-2 text-[9px] text-blue-400 hover:text-blue-300 font-mono uppercase transition-colors"
                            >
                                Tentar novamente
                            </button>
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
