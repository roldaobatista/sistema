import { useEffect, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import initEcho from '@/lib/echo';
import type { TvDashboardData, TvKpis, TvAlert, Technician, TvWorkOrder, TvServiceCall } from '@/types/tv';

export function useTvDashboard() {
    const queryClient = useQueryClient();

    const { data, isLoading, dataUpdatedAt } = useQuery<TvDashboardData>({
        queryKey: ['tv-dashboard'],
        queryFn: async () => {
            const res = await api.get('/tv/dashboard');
            return res.data;
        },
        refetchInterval: 90_000,
    });

    const { data: alertsData } = useQuery<{ alerts: TvAlert[] }>({
        queryKey: ['tv-alerts'],
        queryFn: async () => {
            const res = await api.get('/tv/alerts');
            return res.data;
        },
        refetchInterval: 60_000,
    });

    const refreshKpis = useCallback(async () => {
        try {
            const res = await api.get('/tv/kpis');
            queryClient.setQueryData(['tv-dashboard'], (old: TvDashboardData | undefined) => {
                if (!old) return old;
                return { ...old, operational: { ...old.operational, kpis: res.data } };
            });
        } catch {
            // silently fail — main dashboard query will refresh
        }
    }, [queryClient]);

    // WebSocket listeners
    useEffect(() => {
        if (!data?.tenant_id) return;

        let cancelled = false;
        let channelName = `dashboard.${data.tenant_id}`;

        initEcho().then((echoInstance) => {
            if (cancelled || !echoInstance) return;

            const channel = echoInstance.channel(channelName);

            channel.listen('.technician.location.updated', (e: { technician: Technician }) => {
                queryClient.setQueryData(['tv-dashboard'], (old: TvDashboardData | undefined) => {
                    if (!old) return old;
                    const techs = old.operational.technicians.map(t =>
                        t.id === e.technician.id ? { ...t, ...e.technician } : t
                    );
                    if (!old.operational.technicians.find(t => t.id === e.technician.id)) {
                        techs.push(e.technician);
                    }
                    return { ...old, operational: { ...old.operational, technicians: techs } };
                });
            });

            channel.listen('.work_order.status.changed', (e: { workOrder: TvWorkOrder }) => {
                queryClient.invalidateQueries({ queryKey: ['tv-dashboard'] });
                queryClient.invalidateQueries({ queryKey: ['tv-alerts'] });
            });

            channel.listen('.service_call.status.changed', (e: { serviceCall: TvServiceCall }) => {
                queryClient.invalidateQueries({ queryKey: ['tv-dashboard'] });
                queryClient.invalidateQueries({ queryKey: ['tv-alerts'] });
            });
        });

        return () => {
            cancelled = true;
            // Tenta limpar canal se Echo já foi inicializado
            import('@/lib/echo').then(({ getEchoSync }) => {
                const instance = getEchoSync();
                if (instance) {
                    instance.leave(channelName);
                }
            });
        };
    }, [data?.tenant_id, queryClient]);

    // Refresh KPIs more frequently via separate endpoint
    useEffect(() => {
        const interval = setInterval(refreshKpis, 30_000);
        return () => clearInterval(interval);
    }, [refreshKpis]);

    return {
        data,
        isLoading,
        dataUpdatedAt,
        alerts: alertsData?.alerts ?? [],
    };
}
