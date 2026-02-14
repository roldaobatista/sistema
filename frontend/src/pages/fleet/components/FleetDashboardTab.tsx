import { useQuery } from '@tanstack/react-query'
import { Truck, Fuel, Gauge, AlertCircle, TrendingUp, DollarSign } from 'lucide-react'
import api from '@/lib/api'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'

export function FleetDashboardTab() {
    const { data: dashboard } = useQuery({
        queryKey: ['fleet-dashboard-advanced'],
        queryFn: () => api.get('/fleet/dashboard').then(r => r.data?.data)
    })

    if (!dashboard) return <div className="animate-pulse space-y-4">
        <div className="h-32 bg-surface-100 rounded-xl" />
        <div className="grid grid-cols-3 gap-4">
            <div className="h-40 bg-surface-100 rounded-xl" />
            <div className="h-40 bg-surface-100 rounded-xl" />
            <div className="h-40 bg-surface-100 rounded-xl" />
        </div>
    </div>

    return (
        <div className="space-y-6">
            {/* Principais KPIs */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <StatsCard
                    title="Custo Médio por KM"
                    value={`R$ ${Number(dashboard.avg_cost_per_km || 0).toFixed(2)}`}
                    icon={<DollarSign className="text-brand-600" />}
                    trend="+2.5% vs mês anterior"
                />
                <StatsCard
                    title="Consumo Médio (Diesel)"
                    value={`${Number(dashboard.avg_consumption_diesel || 0).toFixed(1)} km/L`}
                    icon={<Fuel className="text-brand-600" />}
                />
                <StatsCard
                    title="Disponibilidade"
                    value={`${dashboard.availability_rate || 0}%`}
                    icon={<Truck className="text-brand-600" />}
                />
                <StatsCard
                    title="Manutenções Próximas"
                    value={dashboard.upcoming_maintenances || 0}
                    icon={<AlertCircle className="text-amber-600" />}
                    variant="warning"
                />
            </div>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                {/* Alertas Críticos */}
                <Card>
                    <CardHeader>
                        <CardTitle className="text-sm font-medium">Alertas de Documentação</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {dashboard.alerts?.map((alert: any, i: number) => (
                            <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-surface-50 border border-default">
                                <div className="flex items-center gap-3">
                                    <div className={cn("p-2 rounded-full", alert.severity === 'critical' ? 'bg-red-100' : 'bg-amber-100')}>
                                        <AlertCircle size={16} className={alert.severity === 'critical' ? 'text-red-600' : 'text-amber-600'} />
                                    </div>
                                    <div>
                                        <p className="text-sm font-medium text-surface-900">{alert.title}</p>
                                        <p className="text-xs text-surface-500">{alert.description}</p>
                                    </div>
                                </div>
                                <Badge variant={alert.severity === 'critical' ? 'danger' : 'warning'}>{alert.days_left} dias</Badge>
                            </div>
                        ))}
                        {(!dashboard.alerts || dashboard.alerts.length === 0) && (
                            <p className="text-center text-sm text-surface-500 py-4">Nenhum alerta pendente</p>
                        )}
                    </CardContent>
                </Card>

                {/* Status da Frota */}
                <Card>
                    <CardHeader>
                        <CardTitle className="text-sm font-medium">Situação dos Veículos</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <StatusProgress label="Ativos" count={dashboard.active_count} total={dashboard.total_vehicles} color="bg-emerald-500" />
                        <StatusProgress label="Em Manutenção" count={dashboard.maintenance_count} total={dashboard.total_vehicles} color="bg-amber-500" />
                        <StatusProgress label="Aguardando Pool" count={dashboard.pool_waiting_count} total={dashboard.total_vehicles} color="bg-brand-500" />
                        <StatusProgress label="Em Sinistro" count={dashboard.accident_count} total={dashboard.total_vehicles} color="bg-red-500" />
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}

function StatsCard({ title, value, icon, trend, variant = 'default' }: any) {
    return (
        <Card className={cn(variant === 'warning' && 'border-amber-200 bg-amber-50/50')}>
            <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                    <div className="p-2 bg-white rounded-lg border border-default shadow-sm">{icon}</div>
                    {trend && <span className="text-[10px] font-medium text-surface-500 flex items-center gap-0.5"><TrendingUp size={10} /> {trend}</span>}
                </div>
                <div className="mt-4">
                    <p className="text-2xl font-bold text-surface-900">{value}</p>
                    <p className="text-xs text-surface-500 mt-1">{title}</p>
                </div>
            </CardContent>
        </Card>
    )
}

function StatusProgress({ label, count, total, color }: any) {
    const percent = total > 0 ? (count / total) * 100 : 0
    return (
        <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-surface-700">{label}</span>
                <span className="text-surface-500">{count} / {total}</span>
            </div>
            <div className="h-1.5 w-full bg-surface-100 rounded-full overflow-hidden">
                <div className={cn("h-full transition-all duration-500", color)} style={{ width: `${percent}%` }} />
            </div>
        </div>
    )
}

import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
