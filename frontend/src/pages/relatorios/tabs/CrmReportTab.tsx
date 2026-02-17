import {
    BarChart, Bar, XAxis, YAxis, Tooltip,
    ResponsiveContainer, CartesianGrid, Legend,
} from 'recharts'
import { Target, DollarSign, Percent, Users } from 'lucide-react'
import { KpiCardSpark } from '@/components/charts/KpiCardSpark'
import { ChartCard } from '@/components/charts/ChartCard'
import { DonutChart } from '@/components/charts/DonutChart'
import { FunnelChart } from '@/components/charts/FunnelChart'

const fmtBRL = (v: number) => (Number(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const statusLabels: Record<string, string> = {
    lead: 'Lead', qualified: 'Qualificado', proposal: 'Proposta', negotiation: 'Negociação',
    won: 'Ganho', lost: 'Perdido',
}

interface Props { data: any }

export function CrmReportTab({ data }: Props) {
    const totalDeals = data.total_deals ?? 0
    const wonDeals = data.won_deals ?? 0
    const conversionRate = data.conversion_rate ?? 0
    const revenue = Number(data.revenue ?? 0)
    const avgDeal = Number(data.avg_deal_value ?? 0)

    const healthData = (data.health_distribution ?? []).map((h: any) => ({
        name: h.range,
        value: h.count,
        color: h.range === 'Saudavel' ? '#22c55e' : h.range === 'Risco' ? '#f59e0b' : '#ef4444',
    }))

    const dealsByStatus = (data.deals_by_status ?? [])
    const pipelineOrder = ['lead', 'qualified', 'proposal', 'negotiation', 'won']
    const funnelData = pipelineOrder
        .map(status => {
            const found = dealsByStatus.find((d: any) => d.status === status)
            return found ? { name: statusLabels[status] ?? status, value: Number(found.count ?? 0) } : null
        })
        .filter(Boolean) as { name: string; value: number }[]

    const sellerData = (data.deals_by_seller ?? []).map((s: any) => ({
        name: s.owner_name ?? 'Sem dono',
        count: Number(s.count),
        value: Number(s.value ?? 0),
    })).sort((a: any, b: any) => b.value - a.value)

    return (
        <div className="space-y-5">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <KpiCardSpark label="Deals" value={totalDeals} icon={<Target className="h-4 w-4" />} sparkColor="#6366f1" />
                <KpiCardSpark label="Receita Won" value={fmtBRL(revenue)} icon={<DollarSign className="h-4 w-4" />} sparkColor="#22c55e" valueClassName="text-emerald-600" />
                <KpiCardSpark label="Conversão" value={`${conversionRate}%`} icon={<Percent className="h-4 w-4" />} sparkColor={conversionRate >= 30 ? '#22c55e' : '#f59e0b'} />
                <KpiCardSpark label="Ticket Médio" value={fmtBRL(avgDeal)} icon={<DollarSign className="h-4 w-4" />} sparkColor="#06b6d4" />
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
                {funnelData.length > 0 && (
                    <ChartCard title="Pipeline CRM" icon={<Target className="h-4 w-4" />}>
                        <FunnelChart data={funnelData} height="100%" />
                    </ChartCard>
                )}

                <ChartCard title="Saúde dos Clientes" height={280}>
                    <DonutChart
                        data={healthData}
                        centerValue={healthData.reduce((s: number, d: any) => s + d.value, 0)}
                        centerLabel="Clientes"
                        height={240}
                    />
                </ChartCard>
            </div>

            {sellerData.length > 0 && (
                <ChartCard title="Deals por Vendedor" icon={<Users className="h-4 w-4" />} height={Math.max(200, sellerData.length * 50)}>
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={sellerData} layout="vertical" margin={{ left: 10, right: 30 }}>
                            <CartesianGrid strokeDasharray="3 3" className="stroke-surface-200" />
                            <XAxis type="number" tick={{ fontSize: 11 }} />
                            <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 12 }} />
                            <Tooltip formatter={(v: any, name: any) => (name === 'Valor' ? [fmtBRL(Number(v)), name] : [v, name]) as any} />
                            <Legend />
                            <Bar dataKey="count" name="Quantidade" fill="#6366f1" radius={[0, 4, 4, 0]} animationDuration={800} />
                        </BarChart>
                    </ResponsiveContainer>
                </ChartCard>
            )}
        </div>
    )
}
