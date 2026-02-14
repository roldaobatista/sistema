import React, { useEffect, useState } from 'react';
import { toast } from 'sonner'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
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
    WifiOff
} from 'lucide-react';
import WebRTCPlayer from '@/components/WebRTCPlayer';
import getEcho from '@/lib/echo';

import TvMapWidget from '@/components/TvMapWidget';
import { useAuthStore } from '@/stores/auth-store'

interface Camera {
    id: number;
    name: string;
    stream_url: string;
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
        work_orders: any[]; // Active
        latest_work_orders: any[]; // Ticker
        kpis: {
            chamados_hoje: number;
            os_hoje: number;
            os_em_execucao: number;
            tecnicos_online: number;
            tecnicos_em_campo: number;
        };
    };
}

const TvDashboard = () => {
    const [currentTime, setCurrentTime] = useState(new Date());
    const [searchTerm, setSearchTerm] = useState('');
    const queryClient = useQueryClient();
    const { user } = useAuthStore()
    const hasPermission = (p: string) => user?.all_permissions?.includes(p) ?? false

    // MVP: Mutation para ações administrativas do dashboard
    const actionMutation = useMutation({
        mutationFn: (data: { action: string }) => api.post('/tv/actions', data),
        onSuccess: () => { toast.success('Ação realizada com sucesso'); queryClient.invalidateQueries({ queryKey: ['tv-dashboard'] }) },
        onError: (err: any) => { toast.error(err?.response?.data?.message || 'Erro na operação') },
    })
    const handleAction = (action: string) => { if (window.confirm('Confirmar ação?')) actionMutation.mutate({ action }) }

    // Timer para relógio
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
        refetchInterval: 60000, // Fallback polling (menos frequente agora que temos WS)
    });

    // Configuração de WebSocket
    useEffect(() => {
        if (!dashboardData?.tenant_id) return;

        const echoInstance = getEcho();
        if (!echoInstance) return; // WebSocket não configurado

        const channel = echoInstance.channel(`dashboard.${dashboardData.tenant_id}`);

        console.log(`📡 Conectado ao canal dashboard.${dashboardData.tenant_id}`);

        channel.listen('.technician.location.updated', (e: { technician: Technician }) => {
            console.log('📍 Atualização de técnico recebida:', e.technician);

            // Atualizar cache do React Query instantaneamente
            queryClient.setQueryData(['tv-dashboard'], (oldData: DashboardData | undefined) => {
                if (!oldData) return oldData;

                const updatedTechnicians = oldData.operational.technicians.map(tech =>
                    tech.id === e.technician.id ? { ...tech, ...e.technician } : tech
                );

                // Se o técnico não estava na lista (ex: acabou de logar), adiciona
                if (!oldData.operational.technicians.find(t => t.id === e.technician.id)) {
                    updatedTechnicians.push(e.technician);
                }

                return {
                    ...oldData,
                    operational: {
                        ...oldData.operational,
                        technicians: updatedTechnicians
                    }
                };
            });
        });

        return () => {
            console.log('🔌 Desconectando do canal...');
            echoInstance.leave(`dashboard.${dashboardData.tenant_id}`);
        };
    }, [dashboardData?.tenant_id, queryClient]);

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-screen bg-neutral-950 text-white">
                <div className="text-2xl animate-pulse font-mono">CARREGANDO CENTRAL DE OPERAÇÕES...</div>
            </div>
        );
    }

    const { kpis, technicians, work_orders, latest_work_orders } = dashboardData?.operational || {};

    // Função para calcular status real (considerando offline time)
    const getRealStatus = (tech: Technician) => {
        if (!tech.location_updated_at) return tech.status;

        const lastUpdate = new Date(tech.location_updated_at);
        const diffInMinutes = (new Date().getTime() - lastUpdate.getTime()) / 60000;

        if (diffInMinutes > 10) return 'offline'; // Override status se > 10 min sem sinal
        return tech.status;
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'working': return 'bg-orange-500 animate-pulse';
            case 'in_transit': return 'bg-blue-500';
            case 'available': return 'bg-green-500';
            case 'offline': return 'bg-neutral-600';
            default: return 'bg-neutral-600';
        }
    };

    const getStatusLabel = (status: string) => {
        switch (status) {
            case 'working': return <><Wrench className="h-3 w-3" /> EM ATENDIMENTO</>;
            case 'in_transit': return <><Truck className="h-3 w-3" /> EM DESLOCAMENTO</>;
            case 'available': return <><CheckCircle className="h-3 w-3" /> DISPONÍVEL</>;
            case 'offline': return <><WifiOff className="h-3 w-3" /> SEM SINAL</>;
            default: return 'DESCONHECIDO';
        }
    };

    return (
        <div className="min-h-screen bg-neutral-950 text-neutral-50 p-4 flex flex-col overflow-hidden font-sans">
            {/* Header */}
            <div className="flex justify-between items-center mb-6 border-b border-neutral-800 pb-2 shrink-0">
                <div className="flex items-center gap-4">
                    <img src="/logo-white.png" alt="Logo" className="h-10 opacity-80" onError={(e) => e.currentTarget.style.display = 'none'} />
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight text-blue-500 uppercase">War Room</h1>
                        <span className="text-xs text-neutral-500 tracking-widest uppercase">Central de Monitoramento Integrado</span>
                    </div>
                </div>
                <div className="text-right">
                    <div className="text-4xl font-mono font-bold text-yellow-400 leading-none">
                        {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                    <div className="text-sm text-neutral-400 uppercase font-medium mt-1">
                        {currentTime.toLocaleDateString([], { weekday: 'long', day: '2-digit', month: 'long' }).toUpperCase()}
                    </div>
                </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 grid grid-cols-12 gap-4 h-full overflow-hidden pb-16">

                {/* Left Column: Staff & Stats (3 Cols) */}
                <div className="col-span-3 flex flex-col gap-4 h-full">
                    {/* KPI Cards */}
                    <div className="grid grid-cols-2 gap-3">
                        <Card className="bg-neutral-900 border-neutral-800">
                            <CardContent className="p-4 flex flex-col items-center justify-center">
                                <span className="text-neutral-500 text-[10px] uppercase font-bold tracking-wider">OS HOJE</span>
                                <span className="text-3xl font-bold text-white">{kpis?.os_hoje}</span>
                            </CardContent>
                        </Card>
                        <Card className="bg-neutral-900 border-neutral-800">
                            <CardContent className="p-4 flex flex-col items-center justify-center">
                                <span className="text-neutral-500 text-[10px] uppercase font-bold tracking-wider">EM EXECUÇÃO</span>
                                <span className="text-3xl font-bold text-green-500 animate-pulse">{kpis?.os_em_execucao}</span>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Technicians List */}
                    <Card className="bg-neutral-900 border-neutral-800 flex-1 flex flex-col overflow-hidden">
                        <CardHeader className="bg-neutral-800/40 py-2 px-4 border-b border-neutral-800">
                            <CardTitle className="text-sm uppercase tracking-wider flex items-center gap-2 text-blue-400">
                                <Users className="h-4 w-4" />
                                Equipe em Campo
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-0 overflow-y-auto flex-1 scrollbar-hide">
                            <div className="divide-y divide-neutral-800">
                                {technicians?.map((tech: Technician) => {
                                    const realStatus = getRealStatus(tech);
                                    return (
                                        <div key={tech.id} className="p-3 flex items-center justify-between hover:bg-neutral-800/30 transition-colors">
                                            <div className="flex items-center gap-3">
                                                <div className={`w-2 h-2 rounded-full ${getStatusColor(realStatus)}`} />
                                                <div>
                                                    <div className={`font-bold text-sm ${realStatus === 'offline' ? 'text-neutral-500' : 'text-neutral-200'}`}>
                                                        {tech.name}
                                                    </div>
                                                    <div className="text-[10px] text-neutral-500 uppercase flex items-center gap-1">
                                                        {getStatusLabel(realStatus)}
                                                    </div>
                                                </div>
                                            </div>
                                            {tech.location_updated_at && (
                                                <div className="text-[10px] text-neutral-600 flex flex-col items-end">
                                                    <MapPin className="h-3 w-3 mb-0.5" />
                                                    {realStatus === 'offline' ? (
                                                        <span className="text-red-900/50">sinal perdido</span>
                                                    ) : (
                                                        <span>{new Date(tech.location_updated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                                {technicians?.length === 0 && (
                                    <div className="p-4 text-center text-neutral-600 text-xs uppercase">Nenhum técnico encontrado</div>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                </div>



                {/* Middle Column: Map & Active Work Orders (5 Cols) */}
                <div className="col-span-5 flex flex-col gap-4 h-full">

                    {/* Map Widget (Top 55%) */}
                    <div className="basis-[55%] relative">
                        <TvMapWidget
                            technicians={technicians || []}
                            workOrders={work_orders || []}
                            serviceCalls={dashboardData?.operational?.service_calls || []}
                            className="h-full w-full shadow-lg shadow-black/50"
                        />
                    </div>

                    {/* Active Work Orders List (Bottom 45%) */}
                    <Card className="bg-neutral-900 border-neutral-800 flex-1 flex flex-col overflow-hidden basis-[45%]">
                        <CardHeader className="bg-neutral-800/40 py-2 px-4 border-b border-neutral-800 shrink-0">
                            <CardTitle className="text-sm uppercase tracking-wider flex items-center gap-2 text-orange-400">
                                <Activity className="h-4 w-4" />
                                Ordens em Execução
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-0 overflow-y-auto flex-1 scrollbar-hide">
                            <div className="divide-y divide-neutral-800">
                                {work_orders?.map((os: any) => (
                                    <div key={os.id} className="p-4 hover:bg-neutral-800/30 transition-colors border-l-2 border-transparent hover:border-orange-500">
                                        <div className="flex justify-between items-start mb-2">
                                            <div className="flex flex-col">
                                                <span className="text-orange-400 font-mono font-bold text-sm">#{os.os_number || os.id}</span>
                                                <span className="font-bold text-white text-lg leading-tight">{os.customer?.name}</span>
                                            </div>
                                            <div className="px-2 py-1 bg-neutral-950 rounded text-xs font-mono text-neutral-300 border border-neutral-800">
                                                {os.started_at ? new Date(os.started_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--'}
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-4 text-xs text-neutral-400 mt-2">
                                            <div className="flex items-center gap-1">
                                                <Users className="h-3 w-3" />
                                                {os.technician?.name || 'Não atribuído'}
                                            </div>
                                            <div className="flex items-center gap-1">
                                                <AlertCircle className="h-3 w-3" />
                                                {os.service_call ? 'Chamado' : 'Preventiva'}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                                {work_orders?.length === 0 && (
                                    <div className="flex flex-col items-center justify-center h-full text-neutral-600 gap-2">
                                        <CheckCircle className="h-8 w-8 opacity-20" />
                                        <span className="text-xs uppercase">Nenhuma OS em execução no momento</span>
                                    </div>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Right Column: Cameras (4 Cols) */}
                <div className="col-span-4 flex flex-col gap-4 h-full">
                    <div className="grid grid-cols-1 grid-rows-3 gap-4 h-full">
                        {/* Main Camera */}
                        <WebRTCPlayer
                            url={dashboardData?.cameras?.[0]?.stream_url}
                            label={dashboardData?.cameras?.[0]?.name || "CÂMERA PRINCIPAL"}
                            className="row-span-1"
                        />

                        {/* Smaller Cameras */}
                        <div className="row-span-2 grid grid-cols-1 gap-4">
                            {[1, 2].map((i) => (
                                <WebRTCPlayer
                                    key={i}
                                    url={dashboardData?.cameras?.[i]?.stream_url}
                                    label={dashboardData?.cameras?.[i]?.name || `CAM 0${i + 1}`}
                                />
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* Footer Ticker */}
            <div className="fixed bottom-0 left-0 right-0 h-12 bg-neutral-900 border-t border-neutral-800 flex items-center px-4 overflow-hidden">
                <div className="bg-blue-600 text-white text-xs font-bold px-3 py-1 rounded mr-4 shrink-0 uppercase tracking-widest">
                    ÚLTIMAS ATIVIDADES
                </div>
                <div className="flex items-center gap-8 animate-marquee whitespace-nowrap">
                    {latest_work_orders?.map((os: any, idx) => (
                        <div key={idx} className="flex items-center gap-2 text-sm text-neutral-300 opacity-80">
                            <Clock className="h-3 w-3 text-neutral-500" />
                            <span className="font-mono text-blue-400">#{os.os_number || os.id}</span>
                            <span className="font-bold">{os.customer?.name}</span>
                            <span className="text-neutral-500 text-xs">({new Date(os.updated_at).toLocaleTimeString()})</span>
                            <span className="w-1 h-1 bg-neutral-600 rounded-full mx-2"></span>
                        </div>
                    ))}
                    <div className="flex items-center gap-2 text-sm text-neutral-300 opacity-80">
                        <span>Sistema Operacional Normal - Monitoramento Ativo</span>
                    </div>
                </div>
            </div>

            <style>{`
                .scrollbar-hide::-webkit-scrollbar {
                    display: none;
                }
                .scrollbar-hide {
                    -ms-overflow-style: none;
                    scrollbar-width: none;
                }
            `}</style>
        </div>
    );
};

export default TvDashboard;
