import {
    BarChart, Bar, XAxis, YAxis, Tooltip,
    ResponsiveContainer, CartesianGrid, Cell,
} from 'recharts'
import { UserCheck, Users, DollarSign } from 'lucide-react'
import { KpiCardSpark } from '@/components/charts/KpiCardSpark'
import { ChartCard } from '@/components/charts/ChartCard'
import { DonutChart } from '@/components/charts/DonutChart'

const fmtBRL = (v: number) => (Number(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const COLORS = ['#6366f1', '#06b6d4', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316', '#64748b']

interface Props { data: any }

export function CustomersReportTab({ data }: Props) {
    const totalActive = data.total_active ?? 0
    const newInPeriod = data.new_in_period ?? 0

    const topRevenue = (data.top_by_revenue ?? []).map((c: any) => ({
        name: (c.name ?? 'Cliente').substring(0, 25),
        revenue: Number(c.total_revenue ?? 0),
        os_count: Number(c.os_count ?? 0),
    }))

    const segments = (data.by_segment ?? []).map((s: any) => ({
        name: s.segment ?? 'Sem segmento',
        value: Number(s.count),
    }))

    return (
        <div className="space-y-5">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <KpiCardSpark label="Ativos" value={totalActive} icon={<UserCheck className="h-4 w-4" />} sparkColor="#22c55e" />
                <KpiCardSpark label="Novos no Período" value={newInPeriod} icon={<Users className="h-4 w-4" />} sparkColor="#6366f1" />
                <KpiCardSpark
                    label="Receita Top 20"
                    value={fmtBRL(topRevenue.reduce((s: number, c: any) => s + c.revenue, 0))}
                    icon={<DollarSign className="h-4 w-4" />}
                    sparkColor="#f59e0b"
                />
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
                {topRevenue.length > 0 && (
                    <ChartCard title="Top 20 Clientes por Faturamento" icon={<UserCheck className="h-4 w-4" />} height={Math.max(300, topRevenue.length * 30)}>
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={topRevenue} layout="vertical" margin={{ left: 10, right: 30 }}>
                                <CartesianGrid strokeDasharray="3 3" className="stroke-surface-200" />
                                <XAxis type="number" tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 11 }} />
                                <YAxis type="category" dataKey="name" width={150} tick={{ fontSize: 11 }} />
                                <Tooltip formatter={(v: any) => [fmtBRL(Number(v)), 'Receita']} />
                                <Bar dataKey="revenue" name="Receita" radius={[0, 4, 4, 0]} animationDuration={800}>
                                    {topRevenue.map((_: any, i: number) => (
                                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </ChartCard>
                )}

                {segments.length > 0 && (
                    <ChartCard title="Por Segmento" height={Math.max(300, topRevenue.length * 30)}>
                        <DonutChart data={segments} centerValue={totalActive} centerLabel="Ativos" height={260} />
                    </ChartCard>
                )}
            </div>
        </div>
    )
}
