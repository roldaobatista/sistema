import React, { useEffect, useState } from 'react';
import { toast } from 'sonner'
import { useQuery, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
    Users,
    Activity,
    MapPin,
    Truck,
    CheckCircle,
    Clock,
    AlertCircle,
    Wrench,
    WifiOff,
    PhoneCall,
    X,
    Maximize2,
} from 'lucide-react';
import WebRTCPlayer from '@/components/WebRTCPlayer';
import getEcho from '@/lib/echo';
import TvMapWidget from '@/components/TvMapWidget';

interface Camera {
    id: number;
    name: string;
    stream_url: string;
    location?: string;
}

interface Technician {
    id: number;
    name: string;
    status: 'working' | 'in_transit' | 'available' | 'offline';
    location_lat?: number;
    location_lng?: number;
    location_updated_at?: string;
    avatar_url?: string;
}

interface DashboardData {
    tenant_id: number;
    cameras: Camera[];
    operational: {
        technicians: Technician[];
        service_calls: any[];
        work_orders: any[];
        latest_work_orders: any[];
        kpis: {
            chamados_hoje: number;
            os_hoje: number;
            os_em_execucao: number;
            os_finalizadas: number;
            tecnicos_online: number;
            tecnicos_em_campo: number;
            tecnicos_total: number;
        };
    };
}

const TvDashboard = () => {
    const [currentTime, setCurrentTime] = useState(new Date());
    const [expandedCamera, setExpandedCamera] = useState<Camera | null>(null);
    const queryClient = useQueryClient();

    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    const { data: dashboardData, isLoading } = useQuery<DashboardData>({
        queryKey: ['tv-dashboard'],
        queryFn: async () => {
            const res = await api.get('/tv/dashboard');
            return res.data;
        },
        refetchInterval: 90000,
    });

    // WebSocket
    useEffect(() => {
        if (!dashboardData?.tenant_id) return;
        const echoInstance = getEcho();
        if (!echoInstance) return;

        const channel = echoInstance.channel(`dashboard.${dashboardData.tenant_id}`);
        channel.listen('.technician.location.updated', (e: { technician: Technician }) => {
            queryClient.setQueryData(['tv-dashboard'], (oldData: DashboardData | undefined) => {
                if (!oldData) return oldData;
                const updatedTechnicians = oldData.operational.technicians.map(tech =>
                    tech.id === e.technician.id ? { ...tech, ...e.technician } : tech
                );
                if (!oldData.operational.technicians.find(t => t.id === e.technician.id)) {
                    updatedTechnicians.push(e.technician);
                }
                return { ...oldData, operational: { ...oldData.operational, technicians: updatedTechnicians } };
            });
        });

        return () => { echoInstance.leave(`dashboard.${dashboardData.tenant_id}`); };
    }, [dashboardData?.tenant_id, queryClient]);

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-screen bg-neutral-950 text-white">
                <div className="text-2xl animate-pulse font-mono">CARREGANDO CENTRAL DE OPERAÇÕES...</div>
            </div>
        );
    }

    const { kpis, technicians, work_orders, latest_work_orders } = dashboardData?.operational || {};

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

    const cameras = dashboardData?.cameras ?? [];

    return (
        <div className="h-screen bg-neutral-950 text-neutral-50 flex flex-col overflow-hidden font-sans">
            {/* Header */}
            <div className="flex justify-between items-center px-5 py-3 border-b border-neutral-800 shrink-0">
                <div className="flex items-center gap-4">
                    <img src="/logo-white.png" alt="Logo" className="h-9 opacity-80" onError={(e) => (e.currentTarget.style.display = 'none')} />
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight text-blue-500 uppercase leading-none">War Room</h1>
                        <span className="text-[10px] text-neutral-500 tracking-widest uppercase">Central de Monitoramento</span>
                    </div>
                </div>
                <div className="flex items-center gap-6">
                    {/* Mini KPIs no header */}
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
                    </div>
                    <div className="text-right">
                        <div className="text-3xl font-mono font-bold text-yellow-400 leading-none">
                            {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                        <div className="text-[10px] text-neutral-500 uppercase font-medium">
                            {currentTime.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short' }).toUpperCase()}
                        </div>
                    </div>
                </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 grid grid-cols-12 gap-3 p-3 pb-14 overflow-hidden">

                {/* LEFT: 6 Cameras Grid (5 cols) */}
                <div className="col-span-5 grid grid-cols-3 grid-rows-2 gap-2 h-full">
                    {[0, 1, 2, 3, 4, 5].map(i => (
                        <div
                            key={i}
                            className="relative cursor-pointer group"
                            onClick={() => cameras[i] && setExpandedCamera(cameras[i])}
                        >
                            <WebRTCPlayer
                                url={cameras[i]?.stream_url}
                                label={cameras[i]?.name || `CAM 0${i + 1}`}
                                className="h-full"
                            />
                            {cameras[i] && (
                                <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity bg-black/60 rounded p-1">
                                    <Maximize2 className="h-3 w-3 text-white" />
                                </div>
                            )}
                        </div>
                    ))}
                </div>

                {/* RIGHT: Map + KPIs + Lists (7 cols) */}
                <div className="col-span-7 flex flex-col gap-3 h-full overflow-hidden">

                    {/* KPI Cards Row */}
                    <div className="grid grid-cols-5 gap-2 shrink-0">
                        {[
                            { label: 'OS HOJE', value: kpis?.os_hoje, color: 'text-white' },
                            { label: 'EM EXECUÇÃO', value: kpis?.os_em_execucao, color: 'text-orange-400 animate-pulse' },
                            { label: 'FINALIZADAS', value: kpis?.os_finalizadas, color: 'text-green-400' },
                            { label: 'CHAMADOS', value: kpis?.chamados_hoje, color: 'text-red-400' },
                            { label: 'EM CAMPO', value: kpis?.tecnicos_em_campo, color: 'text-blue-400' },
                        ].map(k => (
                            <Card key={k.label} className="bg-neutral-900 border-neutral-800">
                                <CardContent className="p-3 flex flex-col items-center justify-center">
                                    <span className="text-neutral-500 text-[9px] uppercase font-bold tracking-wider">{k.label}</span>
                                    <span className={`text-2xl font-bold ${k.color}`}>{k.value ?? 0}</span>
                                </CardContent>
                            </Card>
                        ))}
                    </div>

                    {/* Map */}
                    <div className="flex-1 min-h-0">
                        <TvMapWidget
                            technicians={technicians || []}
                            workOrders={work_orders || []}
                            serviceCalls={dashboardData?.operational?.service_calls || []}
                            className="h-full w-full shadow-lg shadow-black/50"
                        />
                    </div>

                    {/* Bottom: Technicians + Active OS side by side */}
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
                                    {work_orders?.map((os: any) => (
                                        <div key={os.id} className="px-3 py-2">
                                            <div className="flex justify-between items-center">
                                                <span className="text-orange-400 font-mono font-bold text-xs">#{os.os_number || os.id}</span>
                                                <span className="text-[9px] font-mono text-neutral-500">
                                                    {os.started_at ? new Date(os.started_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--'}
                                                </span>
                                            </div>
                                            <div className="text-xs font-semibold text-white truncate">{os.customer?.name}</div>
                                            <div className="text-[9px] text-neutral-500 flex items-center gap-1">
                                                <Users className="h-2.5 w-2.5" /> {os.technician?.name || '—'}
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
                </div>
            </div>

            {/* Footer Ticker */}
            <div className="fixed bottom-0 left-0 right-0 h-10 bg-neutral-900 border-t border-neutral-800 flex items-center px-4 overflow-hidden z-10">
                <div className="bg-blue-600 text-white text-[10px] font-bold px-2 py-0.5 rounded mr-4 shrink-0 uppercase tracking-widest">
                    ATIVIDADES
                </div>
                <div className="flex items-center gap-8 tv-ticker whitespace-nowrap">
                    {latest_work_orders?.map((os: any, idx: number) => (
                        <div key={idx} className="flex items-center gap-2 text-xs text-neutral-400">
                            <Clock className="h-3 w-3 text-neutral-600" />
                            <span className="font-mono text-blue-400">#{os.os_number || os.id}</span>
                            <span className="font-semibold text-neutral-300">{os.customer?.name}</span>
                            <span className="text-neutral-600 text-[10px]">({new Date(os.updated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})</span>
                            <span className="w-1 h-1 bg-neutral-700 rounded-full mx-1" />
                        </div>
                    ))}
                    <span className="text-[10px] text-neutral-600">Sistema Operacional Normal</span>
                </div>
            </div>

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
                @keyframes tv-scroll {
                    0% { transform: translateX(0); }
                    100% { transform: translateX(-50%); }
                }
                .tv-ticker {
                    animation: tv-scroll 30s linear infinite;
                }
                .tv-ticker:hover {
                    animation-play-state: paused;
                }
            `}</style>
        </div>
    );
};

export default TvDashboard;
