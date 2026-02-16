import { useEffect, useMemo, useCallback, useState } from 'react';
import {
    Users,
    Activity,
    Truck,
    CheckCircle,
    Wrench,
    WifiOff,
    PhoneCall,
    X,
    Maximize2,
    Settings2,
    Monitor,
    LayoutGrid,
    Map as MapIcon,
    AlertTriangle,
    Bell,
    Clock,
    TrendingUp,
    TrendingDown,
    Timer,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import WebRTCPlayer from '@/components/WebRTCPlayer';
import TvMapWidget from '@/components/TvMapWidget';
import { TvSectionBoundary } from '@/components/tv/TvSectionBoundary';
import { TvTicker } from '@/components/tv/TvTicker';
import { TvAlertPanel } from '@/components/tv/TvAlertPanel';
import { useTvDashboard } from '@/hooks/useTvDashboard';
import { useTvClock } from '@/hooks/useTvClock';
import { useTvStore, camerasPerLayout } from '@/stores/tv-store';
import type { Camera, Technician, TvLayout } from '@/types/tv';

// --- Layout Selector ---
function TvLayoutSelector({ onClose }: { onClose: () => void }) {
    const { layout, setLayout, autoRotateCameras, setAutoRotate, rotationInterval, setRotationInterval, soundAlerts, setSoundAlerts } = useTvStore();

    const layouts: { id: TvLayout; label: string; icon: typeof LayoutGrid }[] = [
        { id: '3x2', label: '3×2 Câmeras', icon: LayoutGrid },
        { id: '2x2', label: '2×2 Câmeras', icon: LayoutGrid },
        { id: '1+list', label: '1 Câmera + Lista', icon: Monitor },
        { id: 'map-full', label: 'Mapa Expandido', icon: MapIcon },
    ];

    return (
        <div className="absolute top-14 left-3 z-40 w-64 bg-neutral-900/95 backdrop-blur-sm border border-neutral-700 rounded-lg shadow-2xl shadow-black/50 p-3" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-3">
                <span className="text-xs font-bold text-neutral-300 uppercase tracking-wider">Configurações</span>
                <button onClick={onClose} className="p-1 rounded hover:bg-neutral-700"><X className="h-3 w-3 text-neutral-400" /></button>
            </div>

            <div className="space-y-3">
                <div>
                    <span className="text-[10px] text-neutral-500 uppercase tracking-wider block mb-1.5">Layout</span>
                    <div className="grid grid-cols-2 gap-1.5">
                        {layouts.map(l => (
                            <button
                                key={l.id}
                                onClick={() => setLayout(l.id)}
                                className={`flex items-center gap-1.5 px-2 py-1.5 rounded text-[10px] font-medium transition-all ${
                                    layout === l.id ? 'bg-blue-600 text-white' : 'bg-neutral-800 text-neutral-400 hover:text-white hover:bg-neutral-700'
                                }`}
                            >
                                <l.icon className="h-3 w-3" /> {l.label}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="border-t border-neutral-800 pt-3">
                    <label className="flex items-center justify-between cursor-pointer">
                        <span className="text-[10px] text-neutral-400">Auto-rotação de câmeras</span>
                        <input
                            type="checkbox"
                            checked={autoRotateCameras}
                            onChange={e => setAutoRotate(e.target.checked)}
                            className="rounded border-neutral-600 bg-neutral-800 text-blue-500"
                        />
                    </label>
                    {autoRotateCameras && (
                        <div className="mt-1.5 flex items-center gap-2">
                            <span className="text-[9px] text-neutral-500">Intervalo:</span>
                            <select
                                value={rotationInterval}
                                onChange={e => setRotationInterval(Number(e.target.value))}
                                className="text-[10px] bg-neutral-800 border border-neutral-700 rounded px-1.5 py-0.5 text-neutral-300"
                            >
                                {[10, 15, 20, 30, 60].map(s => (
                                    <option key={s} value={s}>{s}s</option>
                                ))}
                            </select>
                        </div>
                    )}
                </div>

                <div className="border-t border-neutral-800 pt-3">
                    <label className="flex items-center justify-between cursor-pointer">
                        <span className="text-[10px] text-neutral-400">Sons de alerta</span>
                        <input
                            type="checkbox"
                            checked={soundAlerts}
                            onChange={e => setSoundAlerts(e.target.checked)}
                            className="rounded border-neutral-600 bg-neutral-800 text-blue-500"
                        />
                    </label>
                </div>
            </div>
        </div>
    );
}

// --- KPI Card with Comparison ---
function KpiCard({ label, value, previousValue, color, icon: Icon, suffix }: {
    label: string; value: number; previousValue?: number; color: string; icon?: typeof Activity; suffix?: string;
}) {
    const diff = previousValue != null ? value - previousValue : null;

    return (
        <Card className="bg-neutral-900 border-neutral-800">
            <CardContent className="p-3 flex flex-col items-center justify-center">
                <span className="text-neutral-500 text-[9px] uppercase font-bold tracking-wider">{label}</span>
                <div className="flex items-baseline gap-1">
                    <span className={`text-2xl font-bold ${color}`}>{value ?? 0}</span>
                    {suffix && <span className="text-[9px] text-neutral-500">{suffix}</span>}
                </div>
                {diff != null && diff !== 0 && (
                    <div className={`flex items-center gap-0.5 text-[9px] mt-0.5 ${diff > 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {diff > 0 ? <TrendingUp className="h-2.5 w-2.5" /> : <TrendingDown className="h-2.5 w-2.5" />}
                        <span>{diff > 0 ? '+' : ''}{diff} vs ontem</span>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

// --- Freshness Indicator ---
function FreshnessIndicator({ updatedAt }: { updatedAt: number }) {
    const [, setTick] = useState(0);

    useEffect(() => {
        const interval = setInterval(() => setTick(t => t + 1), 5000);
        return () => clearInterval(interval);
    }, []);

    if (!updatedAt) return null;

    const ageSec = Math.floor((Date.now() - updatedAt) / 1000);
    const stale = ageSec > 120;
    const label = ageSec < 60 ? `${ageSec}s atrás` : `${Math.floor(ageSec / 60)}min atrás`;

    return (
        <div className={`flex items-center gap-1.5 text-[9px] font-mono ${stale ? 'text-red-400' : 'text-neutral-500'}`}>
            <div className={`w-1.5 h-1.5 rounded-full ${stale ? 'bg-red-500 animate-pulse' : 'bg-green-500'}`} />
            <span>{label}</span>
        </div>
    );
}

// --- Status helpers ---
const getRealStatus = (tech: Technician) => {
    if (!tech.location_updated_at) return tech.status;
    const diffMin = (Date.now() - new Date(tech.location_updated_at).getTime()) / 60000;
    if (diffMin > 10) return 'offline';
    return tech.status;
};

const getStatusColor = (s: string) => {
    if (s === 'working') return 'bg-orange-500 animate-pulse';
    if (s === 'in_transit') return 'bg-blue-500';
    if (s === 'available') return 'bg-green-500';
    return 'bg-neutral-600';
};

const getStatusLabel = (s: string) => {
    if (s === 'working') return <><Wrench className="h-3 w-3" /> EM ATENDIMENTO</>;
    if (s === 'in_transit') return <><Truck className="h-3 w-3" /> EM DESLOCAMENTO</>;
    if (s === 'available') return <><CheckCircle className="h-3 w-3" /> DISPONÍVEL</>;
    return <><WifiOff className="h-3 w-3" /> SEM SINAL</>;
};

// --- Main Dashboard ---
const TvDashboard = () => {
    const { data: dashboardData, isLoading, dataUpdatedAt, alerts } = useTvDashboard();
    const { timeStr, secondsStr, dateStr } = useTvClock();
    const store = useTvStore();
    const { layout, autoRotateCameras, rotationInterval, cameraPage, nextCameraPage, isKiosk, setKiosk, showAlertPanel, setShowAlertPanel } = store;

    const [expandedCamera, setExpandedCamera] = useState<Camera | null>(null);
    const [showSettings, setShowSettings] = useState(false);

    const cameras = dashboardData?.cameras ?? [];
    const { kpis, technicians, work_orders, latest_work_orders, service_calls } = dashboardData?.operational || {};

    const perPage = camerasPerLayout[layout] || 6;
    const visibleCameras = useMemo(() => {
        if (perPage === 0) return [];
        const start = cameraPage * perPage;
        return cameras.slice(start, start + perPage);
    }, [cameras, cameraPage, perPage]);

    const totalPages = perPage > 0 ? Math.ceil(cameras.length / perPage) : 0;

    // Auto-rotation
    useEffect(() => {
        if (!autoRotateCameras || cameras.length <= perPage || perPage === 0) return;
        const timer = setInterval(() => nextCameraPage(cameras.length), rotationInterval * 1000);
        return () => clearInterval(timer);
    }, [autoRotateCameras, cameras.length, perPage, rotationInterval, nextCameraPage]);

    // Kiosk mode
    const toggleKiosk = useCallback(() => {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen?.().catch(() => {});
            setKiosk(true);
        } else {
            document.exitFullscreen?.().catch(() => {});
            setKiosk(false);
        }
    }, [setKiosk]);

    useEffect(() => {
        const handler = () => {
            if (!document.fullscreenElement) setKiosk(false);
        };
        document.addEventListener('fullscreenchange', handler);
        return () => document.removeEventListener('fullscreenchange', handler);
    }, [setKiosk]);

    // Auto-hide cursor in kiosk mode
    useEffect(() => {
        if (!isKiosk) return;
        let timer: ReturnType<typeof setTimeout>;
        const hide = () => { document.body.style.cursor = 'none'; };
        const show = () => {
            document.body.style.cursor = 'default';
            clearTimeout(timer);
            timer = setTimeout(hide, 5000);
        };
        document.addEventListener('mousemove', show);
        timer = setTimeout(hide, 5000);
        return () => {
            document.removeEventListener('mousemove', show);
            clearTimeout(timer);
            document.body.style.cursor = 'default';
        };
    }, [isKiosk]);

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-screen bg-neutral-950 text-white">
                <div className="text-2xl animate-pulse font-mono">CARREGANDO CENTRAL DE OPERAÇÕES...</div>
            </div>
        );
    }

    const criticalAlerts = alerts.filter(a => a.severity === 'critical').length;

    // --- Camera grid renderers per layout ---
    const renderCameraGrid = () => {
        if (layout === 'map-full') return null;

        const gridClass =
            layout === '3x2' ? 'col-span-5 grid grid-cols-3 grid-rows-2 gap-2 h-full' :
            layout === '2x2' ? 'col-span-5 grid grid-cols-2 grid-rows-2 gap-2 h-full' :
            'col-span-3 flex flex-col gap-2 h-full';

        const slots = layout === '1+list' ? 1 : (layout === '2x2' ? 4 : 6);

        return (
            <TvSectionBoundary section="Câmeras">
                <div className={`${gridClass} relative`}>
                    {Array.from({ length: slots }).map((_, i) => (
                        <div
                            key={i}
                            className="relative cursor-pointer group"
                            onClick={() => visibleCameras[i] && setExpandedCamera(visibleCameras[i])}
                        >
                            <WebRTCPlayer
                                url={visibleCameras[i]?.stream_url}
                                label={visibleCameras[i]?.name || `CAM ${cameraPage * perPage + i + 1}`}
                                className="h-full"
                            />
                            {visibleCameras[i] && (
                                <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity bg-black/60 rounded p-1">
                                    <Maximize2 className="h-3 w-3 text-white" />
                                </div>
                            )}
                        </div>
                    ))}
                    {totalPages > 1 && (
                        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex items-center gap-1.5 bg-black/60 rounded-full px-2 py-1 z-10 pointer-events-auto">
                            {Array.from({ length: totalPages }).map((_, i) => (
                                <button
                                    key={i}
                                    type="button"
                                    onClick={(e) => { e.stopPropagation(); store.setCameraPage(i); }}
                                    className={`w-1.5 h-1.5 rounded-full transition-colors ${i === cameraPage ? 'bg-blue-400' : 'bg-neutral-600 hover:bg-neutral-400'}`}
                                    aria-label={`Página ${i + 1}`}
                                />
                            ))}
                        </div>
                    )}
                </div>
            </TvSectionBoundary>
        );
    };

    const rightColSpan = layout === 'map-full' ? 'col-span-12' : layout === '1+list' ? 'col-span-9' : 'col-span-7';

    return (
        <div className="h-screen bg-neutral-950 text-neutral-50 flex flex-col overflow-hidden font-sans">
            {/* Header */}
            <div className="flex justify-between items-center px-5 py-3 border-b border-neutral-800 shrink-0 relative">
                <div className="flex items-center gap-4">
                    <img src="/logo-white.png" alt="Logo" className="h-9 opacity-80" onError={e => (e.currentTarget.style.display = 'none')} />
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight text-blue-500 uppercase leading-none">War Room</h1>
                        <span className="text-[10px] text-neutral-500 tracking-widest uppercase">Central de Monitoramento</span>
                    </div>
                </div>

                <div className="flex items-center gap-5">
                    <FreshnessIndicator updatedAt={dataUpdatedAt} />

                    <div className="hidden xl:flex items-center gap-4">
                        <div className="flex items-center gap-2 text-xs">
                            <div className="w-2 h-2 rounded-full bg-green-500" />
                            <span className="text-neutral-400">Online:</span>
                            <span className="font-bold text-white">{kpis?.tecnicos_online ?? 0}/{kpis?.tecnicos_total ?? 0}</span>
                        </div>
                        <div className="flex items-center gap-2 text-xs">
                            <PhoneCall className="h-3 w-3 text-red-400" />
                            <span className="text-neutral-400">Chamados:</span>
                            <span className="font-bold text-white">{kpis?.chamados_hoje ?? 0}</span>
                        </div>
                        {kpis?.tempo_medio_resposta_min != null && (
                            <div className="flex items-center gap-2 text-xs">
                                <Timer className="h-3 w-3 text-yellow-400" />
                                <span className="text-neutral-400">Resp:</span>
                                <span className="font-bold text-white">{kpis.tempo_medio_resposta_min}min</span>
                            </div>
                        )}
                    </div>

                    {/* Action buttons */}
                    <div className="flex items-center gap-1">
                        <button
                            onClick={() => setShowAlertPanel(!showAlertPanel)}
                            className="relative p-1.5 rounded hover:bg-neutral-800 transition-colors"
                            title="Alertas"
                        >
                            <AlertTriangle className="h-4 w-4 text-neutral-400" />
                            {criticalAlerts > 0 && (
                                <span className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 bg-red-500 rounded-full text-[8px] font-bold flex items-center justify-center animate-pulse">
                                    {criticalAlerts}
                                </span>
                            )}
                        </button>
                        <button
                            onClick={() => setShowSettings(!showSettings)}
                            className="p-1.5 rounded hover:bg-neutral-800 transition-colors"
                            title="Configurações"
                        >
                            <Settings2 className="h-4 w-4 text-neutral-400" />
                        </button>
                        <button
                            onClick={toggleKiosk}
                            className="p-1.5 rounded hover:bg-neutral-800 transition-colors"
                            title={isKiosk ? 'Sair do modo TV' : 'Modo TV (Fullscreen)'}
                        >
                            <Monitor className="h-4 w-4 text-neutral-400" />
                        </button>
                    </div>

                    {/* Clock */}
                    <div className="text-right">
                        <div className="text-3xl font-mono font-bold text-yellow-400 leading-none">
                            {timeStr}
                            <span className="text-lg text-yellow-400/50">:{secondsStr}</span>
                        </div>
                        <div className="text-[10px] text-neutral-500 uppercase font-medium">{dateStr}</div>
                    </div>
                </div>

                {/* Panels */}
                {showSettings && <TvLayoutSelector onClose={() => setShowSettings(false)} />}
                <TvAlertPanel alerts={alerts} />
            </div>

            {/* Main Content */}
            <div className="flex-1 grid grid-cols-12 gap-3 p-3 pb-14 overflow-hidden">
                {renderCameraGrid()}

                {/* Right side: KPIs + Map + Lists */}
                <div className={`${rightColSpan} flex flex-col gap-3 h-full overflow-hidden`}>

                    {/* KPI Cards */}
                    <TvSectionBoundary section="KPIs">
                        <div className={`grid ${layout === 'map-full' ? 'grid-cols-7' : 'grid-cols-5'} gap-2 shrink-0`}>
                            <KpiCard label="OS HOJE" value={kpis?.os_hoje ?? 0} previousValue={kpis?.os_ontem} color="text-white" />
                            <KpiCard label="EM EXECUÇÃO" value={kpis?.os_em_execucao ?? 0} color="text-orange-400" />
                            <KpiCard label="FINALIZADAS" value={kpis?.os_finalizadas ?? 0} previousValue={kpis?.os_finalizadas_ontem} color="text-green-400" />
                            <KpiCard label="CHAMADOS" value={kpis?.chamados_hoje ?? 0} previousValue={kpis?.chamados_ontem} color="text-red-400" />
                            <KpiCard label="EM CAMPO" value={kpis?.tecnicos_em_campo ?? 0} color="text-blue-400" />
                            {layout === 'map-full' && kpis?.tempo_medio_resposta_min != null && (
                                <KpiCard label="TMP RESPOSTA" value={kpis.tempo_medio_resposta_min} color="text-yellow-400" suffix="min" />
                            )}
                            {layout === 'map-full' && kpis?.tempo_medio_execucao_min != null && (
                                <KpiCard label="TMP EXECUÇÃO" value={kpis.tempo_medio_execucao_min} color="text-purple-400" suffix="min" />
                            )}
                        </div>
                    </TvSectionBoundary>

                    {/* Map */}
                    <TvSectionBoundary section="Mapa">
                        <div className="flex-1 min-h-0">
                            <TvMapWidget
                                technicians={technicians || []}
                                workOrders={work_orders || []}
                                serviceCalls={service_calls || []}
                                className="h-full w-full shadow-lg shadow-black/50"
                            />
                        </div>
                    </TvSectionBoundary>

                    {/* Bottom: Technicians + Active OS */}
                    <TvSectionBoundary section="Listas">
                        <div className="grid grid-cols-2 gap-2 shrink-0" style={{ maxHeight: '30%' }}>
                            {/* Technicians */}
                            <Card className="bg-neutral-900 border-neutral-800 flex flex-col overflow-hidden">
                                <CardHeader className="bg-neutral-800/40 py-1.5 px-3 border-b border-neutral-800 shrink-0">
                                    <CardTitle className="text-xs uppercase tracking-wider flex items-center gap-2 text-blue-400">
                                        <Users className="h-3 w-3" /> Equipe ({technicians?.length ?? 0})
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="p-0 overflow-y-auto flex-1 tv-scrollbar-hide">
                                    <div className="divide-y divide-neutral-800/50">
                                        {technicians?.map((tech: Technician) => {
                                            const rs = getRealStatus(tech);
                                            return (
                                                <div key={tech.id} className="px-3 py-2 flex items-center justify-between">
                                                    <div className="flex items-center gap-2">
                                                        <div className={`w-2 h-2 rounded-full shrink-0 ${getStatusColor(rs)}`} />
                                                        <div>
                                                            <div className={`font-semibold text-xs ${rs === 'offline' ? 'text-neutral-500' : 'text-neutral-200'}`}>
                                                                {tech.name}
                                                            </div>
                                                            <div className="text-[9px] text-neutral-500 uppercase flex items-center gap-1">
                                                                {getStatusLabel(rs)}
                                                            </div>
                                                        </div>
                                                    </div>
                                                    {tech.location_updated_at && rs !== 'offline' && (
                                                        <span className="text-[9px] text-neutral-600 font-mono">
                                                            {new Date(tech.location_updated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                        </span>
                                                    )}
                                                </div>
                                            );
                                        })}
                                        {(!technicians || technicians.length === 0) && (
                                            <div className="p-3 text-center text-neutral-600 text-[10px]">Nenhum técnico</div>
                                        )}
                                    </div>
                                </CardContent>
                            </Card>

                            {/* Active Work Orders */}
                            <Card className="bg-neutral-900 border-neutral-800 flex flex-col overflow-hidden">
                                <CardHeader className="bg-neutral-800/40 py-1.5 px-3 border-b border-neutral-800 shrink-0">
                                    <CardTitle className="text-xs uppercase tracking-wider flex items-center gap-2 text-orange-400">
                                        <Activity className="h-3 w-3" /> OS em Execução ({work_orders?.length ?? 0})
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="p-0 overflow-y-auto flex-1 tv-scrollbar-hide">
                                    <div className="divide-y divide-neutral-800/50">
                                        {work_orders?.map((os) => (
                                            <div key={os.id} className="px-3 py-2">
                                                <div className="flex justify-between items-center">
                                                    <span className="text-orange-400 font-mono font-bold text-xs">#{os.os_number || os.id}</span>
                                                    <span className="text-[9px] font-mono text-neutral-500">
                                                        {os.started_at ? new Date(os.started_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--'}
                                                    </span>
                                                </div>
                                                <div className="text-xs font-semibold text-white truncate">{os.customer?.name}</div>
                                                <div className="text-[9px] text-neutral-500 flex items-center gap-1">
                                                    <Users className="h-2.5 w-2.5" /> {(os.technician ?? os.assignee)?.name || '—'}
                                                </div>
                                            </div>
                                        ))}
                                        {(!work_orders || work_orders.length === 0) && (
                                            <div className="p-3 text-center text-neutral-600 text-[10px]">Nenhuma OS em execução</div>
                                        )}
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                    </TvSectionBoundary>
                </div>
            </div>

            {/* Footer Ticker */}
            <TvTicker items={latest_work_orders || []} />

            {/* Expanded Camera Modal */}
            {expandedCamera && (
                <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-8" onClick={() => setExpandedCamera(null)}>
                    <div className="relative w-full h-full max-w-5xl max-h-[80vh]" onClick={e => e.stopPropagation()}>
                        <WebRTCPlayer
                            url={expandedCamera.stream_url}
                            label={expandedCamera.name}
                            className="h-full w-full"
                        />
                        <button
                            onClick={() => setExpandedCamera(null)}
                            className="absolute top-3 right-3 bg-black/70 hover:bg-black rounded-full p-2 text-white transition-colors"
                        >
                            <X className="h-5 w-5" />
                        </button>
                        <div className="absolute bottom-3 left-3 bg-black/70 rounded px-3 py-1.5 text-sm font-mono text-white">
                            {expandedCamera.name} {expandedCamera.location ? `— ${expandedCamera.location}` : ''}
                        </div>
                    </div>
                </div>
            )}

            <style>{`
                .tv-scrollbar-hide::-webkit-scrollbar { display: none; }
                .tv-scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
            `}</style>
        </div>
    );
};

export default TvDashboard;
