import { useState, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, Bell, BellOff, X, ChevronDown, ChevronUp, History, Clock } from 'lucide-react';
import type { TvAlert, TvAlertHistoryEntry } from '@/types/tv';
import { useTvStore } from '@/stores/tv-store';
import api from '@/lib/api';

interface TvAlertPanelProps {
    alerts: TvAlert[];
}

const alertSoundUrl = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAIA+AAACABAAZGFAAQ==';

type Tab = 'active' | 'history';

export function TvAlertPanel({ alerts }: TvAlertPanelProps) {
    const { soundAlerts, showAlertPanel, setShowAlertPanel, setSoundAlerts } = useTvStore();
    const [collapsed, setCollapsed] = useState(false);
    const [tab, setTab] = useState<Tab>('active');
    const prevCountRef = useRef(alerts.length);
    const audioRef = useRef<HTMLAudioElement | null>(null);

    const criticalCount = alerts.filter(a => a.severity === 'critical').length;
    const warningCount = alerts.filter(a => a.severity === 'warning').length;

    const { data: history = [] } = useQuery<TvAlertHistoryEntry[]>({
        queryKey: ['tv', 'alerts', 'history'],
        queryFn: async () => {
            const res = await api.get('/tv/alerts/history');
            return res.data.history ?? [];
        },
        refetchInterval: 120_000,
        enabled: showAlertPanel && tab === 'history',
    });

    useEffect(() => {
        if (soundAlerts && alerts.length > prevCountRef.current && criticalCount > 0) {
            try {
                if (!audioRef.current) {
                    audioRef.current = new Audio(alertSoundUrl);
                }
                audioRef.current.play().catch(() => { });
            } catch {
                // Audio not available
            }
        }
        prevCountRef.current = alerts.length;
    }, [alerts.length, criticalCount, soundAlerts]);

    if (!showAlertPanel) return null;

    const renderAlertItem = (alert: TvAlert | TvAlertHistoryEntry, idx: number) => {
        const isResolved = 'resolved' in alert && alert.resolved;
        return (
            <div
                key={idx}
                className={`px-3 py-2 text-xs ${isResolved
                        ? 'opacity-50 border-l-2 border-l-green-500/50'
                        : alert.severity === 'critical'
                            ? 'bg-red-950/30 border-l-2 border-l-red-500'
                            : 'border-l-2 border-l-yellow-500/50'
                    }`}
            >
                <div className="text-neutral-200 leading-relaxed">
                    {isResolved && <span className="text-green-400 text-[9px] mr-1">✓</span>}
                    {alert.message}
                </div>
                <div className="text-[9px] text-neutral-500 mt-1 font-mono flex items-center gap-1">
                    <Clock className="h-2 w-2" />
                    {new Date(alert.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
            </div>
        );
    };

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
                        title={collapsed ? 'Expandir' : 'Recolher'}
                    >
                        {collapsed ?
                            <ChevronDown className="h-3 w-3 text-neutral-400" /> :
                            <ChevronUp className="h-3 w-3 text-neutral-400" />
                        }
                    </button>
                    <button
                        onClick={() => setShowAlertPanel(false)}
                        className="p-1 rounded hover:bg-neutral-700 transition-colors"
                        title="Fechar"
                    >
                        <X className="h-3 w-3 text-neutral-400" />
                    </button>
                </div>
            </div>

            {/* Tabs */}
            {!collapsed && (
                <div className="flex border-b border-neutral-800">
                    <button
                        onClick={() => setTab('active')}
                        className={`flex-1 py-1.5 text-[10px] uppercase font-bold tracking-wider transition-colors ${tab === 'active'
                                ? 'text-yellow-400 border-b-2 border-yellow-400 bg-neutral-800/30'
                                : 'text-neutral-500 hover:text-neutral-300'
                            }`}
                    >
                        Ativos ({alerts.length})
                    </button>
                    <button
                        onClick={() => setTab('history')}
                        className={`flex-1 py-1.5 text-[10px] uppercase font-bold tracking-wider flex items-center justify-center gap-1 transition-colors ${tab === 'history'
                                ? 'text-blue-400 border-b-2 border-blue-400 bg-neutral-800/30'
                                : 'text-neutral-500 hover:text-neutral-300'
                            }`}
                    >
                        <History className="h-2.5 w-2.5" />
                        Histórico
                    </button>
                </div>
            )}

            {/* Content */}
            {!collapsed && (
                <div className="max-h-60 overflow-y-auto tv-scrollbar-hide">
                    {tab === 'active' ? (
                        alerts.length === 0 ? (
                            <div className="p-4 text-center text-neutral-600 text-[10px] uppercase font-mono">
                                Nenhum alerta ativo
                            </div>
                        ) : (
                            <div className="divide-y divide-neutral-800/50">
                                {alerts.map((alert, idx) => renderAlertItem(alert, idx))}
                            </div>
                        )
                    ) : (
                        history.length === 0 ? (
                            <div className="p-4 text-center text-neutral-600 text-[10px] uppercase font-mono">
                                Nenhum alerta nas últimas 24h
                            </div>
                        ) : (
                            <div className="divide-y divide-neutral-800/50">
                                {history.map((entry, idx) => renderAlertItem(entry, idx))}
                            </div>
                        )
                    )}
                </div>
            )}
        </div>
    );
}
