import { useState, useEffect, useRef } from 'react';
import { AlertTriangle, Bell, BellOff, X, ChevronDown, ChevronUp } from 'lucide-react';
import type { TvAlert } from '@/types/tv';
import { useTvStore } from '@/stores/tv-store';

interface TvAlertPanelProps {
    alerts: TvAlert[];
}

const alertSoundUrl = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAIA+AAACABAAZGFAAQ==';

export function TvAlertPanel({ alerts }: TvAlertPanelProps) {
    const { soundAlerts, showAlertPanel, setShowAlertPanel, setSoundAlerts } = useTvStore();
    const [collapsed, setCollapsed] = useState(false);
    const prevCountRef = useRef(alerts.length);
    const audioRef = useRef<HTMLAudioElement | null>(null);

    const criticalCount = alerts.filter(a => a.severity === 'critical').length;
    const warningCount = alerts.filter(a => a.severity === 'warning').length;

    useEffect(() => {
        if (soundAlerts && alerts.length > prevCountRef.current && criticalCount > 0) {
            try {
                if (!audioRef.current) {
                    audioRef.current = new Audio(alertSoundUrl);
                }
                audioRef.current.play().catch(() => {});
            } catch {
                // Audio not available
            }
        }
        prevCountRef.current = alerts.length;
    }, [alerts.length, criticalCount, soundAlerts]);

    if (!showAlertPanel) return null;

    return (
        <div className="absolute top-14 right-3 z-40 w-80 bg-neutral-900/95 backdrop-blur-sm border border-neutral-700 rounded-lg shadow-2xl shadow-black/50 overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-3 py-2 bg-neutral-800/60 border-b border-neutral-700">
                <div className="flex items-center gap-2">
                    <AlertTriangle className="h-3.5 w-3.5 text-yellow-500" />
                    <span className="text-xs font-bold text-neutral-200 uppercase tracking-wider">Alertas</span>
                    {criticalCount > 0 && (
                        <span className="bg-red-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full animate-pulse">
                            {criticalCount}
                        </span>
                    )}
                    {warningCount > 0 && (
                        <span className="bg-yellow-500 text-black text-[9px] font-bold px-1.5 py-0.5 rounded-full">
                            {warningCount}
                        </span>
                    )}
                </div>
                <div className="flex items-center gap-1">
                    <button
                        onClick={() => setSoundAlerts(!soundAlerts)}
                        className="p-1 rounded hover:bg-neutral-700 transition-colors"
                        title={soundAlerts ? 'Desativar som' : 'Ativar som'}
                    >
                        {soundAlerts ?
                            <Bell className="h-3 w-3 text-yellow-400" /> :
                            <BellOff className="h-3 w-3 text-neutral-500" />
                        }
                    </button>
                    <button
                        onClick={() => setCollapsed(!collapsed)}
                        className="p-1 rounded hover:bg-neutral-700 transition-colors"
                    >
                        {collapsed ?
                            <ChevronDown className="h-3 w-3 text-neutral-400" /> :
                            <ChevronUp className="h-3 w-3 text-neutral-400" />
                        }
                    </button>
                    <button
                        onClick={() => setShowAlertPanel(false)}
                        className="p-1 rounded hover:bg-neutral-700 transition-colors"
                    >
                        <X className="h-3 w-3 text-neutral-400" />
                    </button>
                </div>
            </div>

            {/* Alert List */}
            {!collapsed && (
                <div className="max-h-60 overflow-y-auto tv-scrollbar-hide">
                    {alerts.length === 0 ? (
                        <div className="p-4 text-center text-neutral-600 text-[10px] uppercase font-mono">
                            Nenhum alerta ativo
                        </div>
                    ) : (
                        <div className="divide-y divide-neutral-800/50">
                            {alerts.map((alert, idx) => (
                                <div
                                    key={idx}
                                    className={`px-3 py-2 text-xs ${
                                        alert.severity === 'critical' ? 'bg-red-950/30 border-l-2 border-l-red-500' : 'border-l-2 border-l-yellow-500/50'
                                    }`}
                                >
                                    <div className="text-neutral-200 leading-relaxed">{alert.message}</div>
                                    <div className="text-[9px] text-neutral-500 mt-1 font-mono">
                                        {new Date(alert.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
