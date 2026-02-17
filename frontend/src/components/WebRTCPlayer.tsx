import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Loader2, AlertCircle, VideoOff, RefreshCw } from 'lucide-react';

interface WebRTCPlayerProps {
    url?: string;
    label?: string;
    className?: string;
    onStatusChange?: (status: PlayerStatus) => void;
}

export type PlayerStatus = 'loading' | 'connected' | 'reconnecting' | 'error' | 'idle';

const BACKOFF_BASE = 3000;
const BACKOFF_MAX = 60000;

function getBackoffDelay(attempt: number): number {
    return Math.min(BACKOFF_BASE * Math.pow(2, attempt), BACKOFF_MAX);
}

const WebRTCPlayer: React.FC<WebRTCPlayerProps> = ({ url, label, className, onStatusChange }) => {
    const [status, setStatus] = useState<PlayerStatus>('idle');
    const [retryAttempt, setRetryAttempt] = useState(0);
    const [nextRetryIn, setNextRetryIn] = useState(0);
    const videoRef = useRef<HTMLVideoElement>(null);
    const retryCount = useRef(0);
    const retryTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
    const countdownTimer = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
    const mounted = useRef(true);
    const scheduleRetryRef = useRef<() => void>(() => {});
    const statusRef = useRef<PlayerStatus>('idle');

    const updateStatus = useCallback((s: PlayerStatus) => {
        statusRef.current = s;
        setStatus(s);
        onStatusChange?.(s);
    }, [onStatusChange]);

    const connect = useCallback(() => {
        if (!url || !mounted.current) return;

        updateStatus('loading');
        const go2rtcBase = (window as Window & { __GO2RTC_URL?: string }).__GO2RTC_URL || '';

        if (!go2rtcBase || !url.startsWith('rtsp://')) {
            const timeout = setTimeout(() => {
                if (mounted.current) updateStatus('idle');
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
                    updateStatus('connected');
                    retryCount.current = 0;
                    setRetryAttempt(0);
                    setNextRetryIn(0);
                }
            })
            .catch(() => {
                if (mounted.current) scheduleRetryRef.current();
            });
    }, [url, updateStatus]);

    const scheduleRetry = useCallback(() => {
        const delay = getBackoffDelay(retryCount.current);
        updateStatus('reconnecting');
        retryCount.current += 1;
        setRetryAttempt(retryCount.current);
        setNextRetryIn(Math.ceil(delay / 1000));

        if (countdownTimer.current) clearInterval(countdownTimer.current);
        countdownTimer.current = setInterval(() => {
            setNextRetryIn(prev => {
                if (prev <= 1) {
                    if (countdownTimer.current) clearInterval(countdownTimer.current);
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);

        retryTimer.current = setTimeout(() => {
            if (mounted.current) connect();
        }, delay);
    }, [connect, updateStatus]);

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
            if (countdownTimer.current) clearInterval(countdownTimer.current);
            if (videoRef.current) {
                videoRef.current.src = '';
                videoRef.current.load();
            }
        };
    }, [connect]);

    // Page Visibility API: reconnect when tab becomes visible
    useEffect(() => {
        const handleVisibility = () => {
            if (document.visibilityState === 'visible' && statusRef.current !== 'connected' && url) {
                retryCount.current = 0;
                setRetryAttempt(0);
                if (retryTimer.current) clearTimeout(retryTimer.current);
                if (countdownTimer.current) clearInterval(countdownTimer.current);
                connect();
            }
        };
        document.addEventListener('visibilitychange', handleVisibility);
        return () => document.removeEventListener('visibilitychange', handleVisibility);
    }, [connect, url]);

    const handleVideoError = useCallback(() => {
        if (mounted.current && statusRef.current === 'connected') {
            scheduleRetry();
        }
    }, [scheduleRetry]);

    const handleManualRetry = () => {
        retryCount.current = 0;
        setRetryAttempt(0);
        setNextRetryIn(0);
        if (retryTimer.current) clearTimeout(retryTimer.current);
        if (countdownTimer.current) clearInterval(countdownTimer.current);
        connect();
    };

    const statusIndicator = status === 'connected'
        ? 'bg-green-500'
        : status === 'reconnecting' || status === 'loading'
            ? 'bg-yellow-500 animate-pulse'
            : status === 'error'
                ? 'bg-red-500'
                : 'bg-neutral-600';

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
                    {(status === 'loading' || status === 'reconnecting') && (
                        <>
                            <Loader2 className="h-6 w-6 text-blue-500 animate-spin mb-2" />
                            {retryAttempt > 0 && (
                                <span className="text-neutral-500 font-mono text-[8px]">
                                    RECONECTANDO ({retryAttempt})
                                </span>
                            )}
                            {nextRetryIn > 0 && (
                                <span className="text-neutral-600 font-mono text-[8px] mt-0.5">
                                    Próxima tentativa em {nextRetryIn}s
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
                                className="mt-2 flex items-center gap-1 text-[9px] text-blue-400 hover:text-blue-300 font-mono uppercase transition-colors"
                            >
                                <RefreshCw className="h-3 w-3" /> Tentar novamente
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

            {/* Bottom bar with label and status */}
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent px-2 py-1.5 flex items-center justify-between">
                <span className="text-[9px] font-mono text-white/80 uppercase tracking-wider">
                    {label || 'CAM'}
                </span>
                <div className="flex items-center gap-1.5">
                    {status === 'connected' && (
                        <span className="text-[7px] font-mono text-red-400 uppercase tracking-widest font-bold">AO VIVO</span>
                    )}
                    <span className={`w-1.5 h-1.5 rounded-full ${statusIndicator}`} />
                </div>
            </div>
        </div>
    );
};

export default WebRTCPlayer;
