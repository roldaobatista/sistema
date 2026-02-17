import {
    BarChart, Bar, XAxis, YAxis, Tooltip,
    ResponsiveContainer, CartesianGrid,
} from 'recharts'
import { Phone, CheckCircle2, AlertTriangle } from 'lucide-react'
import { KpiCardSpark } from '@/components/charts/KpiCardSpark'
import { ChartCard } from '@/components/charts/ChartCard'
import { DonutChart } from '@/components/charts/DonutChart'

const statusLabels: Record<string, string> = {
    scheduled: 'Agendado', in_progress: 'Em Andamento', in_transit: 'Em Trânsito',
    completed: 'Concluído', cancelled: 'Cancelado',
}
const statusColors: Record<string, string> = {
    scheduled: '#6366f1', in_progress: '#f59e0b', in_transit: '#06b6d4',
    completed: '#22c55e', cancelled: '#ef4444',
}
const priorityLabels: Record<string, string> = { low: 'Baixa', normal: 'Normal', high: 'Alta', urgent: 'Urgente' }

interface Props { data: any }

export function ServiceCallsReportTab({ data }: Props) {
    const total = data.total ?? 0
    const completed = data.completed ?? 0
    const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0

    const statusData = (data.by_status ?? []).map((s: any) => ({
        name: statusLabels[s.status] ?? s.status,
        value: Number(s.count),
        color: statusColors[s.status],
    }))

    const techData = (data.by_technician ?? []).map((t: any) => ({
        name: t.name,
        count: Number(t.count),
    })).sort((a: any, b: any) => b.count - a.count)

    const priorityData = (data.by_priority ?? []).map((p: any) => ({
        name: priorityLabels[p.priority] ?? p.priority,
        count: Number(p.count),
    }))

    return (
        <div className="space-y-5">
            <div className="grid gap-3 sm:grid-cols-3">
                <KpiCardSpark label="Total" value={total} icon={<Phone className="h-4 w-4" />} sparkColor="#6366f1" />
                <KpiCardSpark label="Concluídos" value={completed} icon={<CheckCircle2 className="h-4 w-4" />} sparkColor="#22c55e" valueClassName="text-emerald-600" />
                <KpiCardSpark label="Taxa Conclusão" value={`${completionRate}%`} icon={<AlertTriangle className="h-4 w-4" />} sparkColor={completionRate >= 70 ? '#22c55e' : '#f59e0b'} />
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
                <ChartCard title="Por Status" height={260}>
                    <DonutChart data={statusData} centerValue={total} centerLabel="Total" height={220} />
                </ChartCard>

                {priorityData.length > 0 && (
                    <ChartCard title="Por Prioridade" height={260}>
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={priorityData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" className="stroke-surface-200" />
                                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                                <YAxis tick={{ fontSize: 11 }} />
                                <Tooltip />
                                <Bar dataKey="count" name="Quantidade" fill="#6366f1" radius={[4, 4, 0, 0]} animationDuration={800} />
                            </BarChart>
                        </ResponsiveContainer>
                    </ChartCard>
                )}
            </div>

            {techData.length > 0 && (
                <ChartCard title="Por Técnico" icon={<Phone className="h-4 w-4" />} height={Math.max(200, techData.length * 45)}>
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={techData} layout="vertical" margin={{ left: 10, right: 30 }}>
                            <CartesianGrid strokeDasharray="3 3" className="stroke-surface-200" />
                            <XAxis type="number" tick={{ fontSize: 11 }} />
                            <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 12 }} />
                            <Tooltip />
                            <Bar dataKey="count" name="Chamados" fill="#06b6d4" radius={[0, 4, 4, 0]} animationDuration={800} />
                        </BarChart>
                    </ResponsiveContainer>
                </ChartCard>
            )}
        </div>
    )
}
