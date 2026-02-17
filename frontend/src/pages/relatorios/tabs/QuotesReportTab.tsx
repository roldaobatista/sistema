import {
    BarChart, Bar, XAxis, YAxis, Tooltip,
    ResponsiveContainer, CartesianGrid, Legend,
} from 'recharts'
import { FileText, CheckCircle2, Percent, Users } from 'lucide-react'
import { KpiCardSpark } from '@/components/charts/KpiCardSpark'
import { ChartCard } from '@/components/charts/ChartCard'
import { FunnelChart } from '@/components/charts/FunnelChart'

const fmtBRL = (v: number) => (Number(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const statusLabels: Record<string, string> = {
    draft: 'Rascunho', pending_internal_approval: 'Aprov. Interna', internally_approved: 'Aprovado Int.',
    sent: 'Enviado', approved: 'Aprovado', rejected: 'Rejeitado', expired: 'Expirado',
    invoiced: 'Faturado', cancelled: 'Cancelado',
}

interface Props { data: any }

export function QuotesReportTab({ data }: Props) {
    const total = data.total ?? 0
    const approved = data.approved ?? 0
    const conversionRate = data.conversion_rate ?? 0

    const byStatus = (data.by_status ?? [])
    const bySeller = (data.by_seller ?? []).map((s: any) => ({
        name: s.name,
        count: Number(s.count),
        total: Number(s.total ?? 0),
    })).sort((a: any, b: any) => b.count - a.count)

    // Funil: Rascunho → Enviado → Aprovado → Faturado
    const getStatusCount = (status: string) => byStatus.find((s: any) => s.status === status)?.count ?? 0
    const funnelData = [
        { name: 'Criados', value: total },
        { name: 'Enviados', value: getStatusCount('sent') + getStatusCount('approved') + getStatusCount('invoiced') },
        { name: 'Aprovados', value: getStatusCount('approved') + getStatusCount('invoiced') },
        { name: 'Faturados', value: getStatusCount('invoiced') },
    ].filter(d => d.value > 0)

    return (
        <div className="space-y-5">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <KpiCardSpark
                    label="Total"
                    value={total}
                    icon={<FileText className="h-4 w-4" />}
                    sparkColor="#6366f1"
                />
                <KpiCardSpark
                    label="Aprovados"
                    value={approved}
                    icon={<CheckCircle2 className="h-4 w-4" />}
                    sparkColor="#22c55e"
                    valueClassName="text-emerald-600"
                />
                <KpiCardSpark
                    label="Conversão"
                    value={`${conversionRate}%`}
                    icon={<Percent className="h-4 w-4" />}
                    sparkColor={conversionRate >= 50 ? '#22c55e' : '#f59e0b'}
                />
                <KpiCardSpark
                    label="Vendedores"
                    value={bySeller.length}
                    icon={<Users className="h-4 w-4" />}
                    sparkColor="#06b6d4"
                />
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
                {funnelData.length > 0 && (
                    <ChartCard title="Funil de Conversão" icon={<FileText className="h-4 w-4" />}>
                        <FunnelChart data={funnelData} height="100%" />
                    </ChartCard>
                )}

                {bySeller.length > 0 && (
                    <ChartCard title="Por Vendedor" icon={<Users className="h-4 w-4" />}>
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={bySeller} layout="vertical" margin={{ left: 10, right: 30 }}>
                                <CartesianGrid strokeDasharray="3 3" className="stroke-surface-200" />
                                <XAxis type="number" tick={{ fontSize: 11 }} />
                                <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 12 }} />
                                <Tooltip formatter={(v: any, name: string) => name === 'Valor' ? [fmtBRL(Number(v)), name] : [v, name]} />
                                <Legend />
                                <Bar dataKey="count" name="Quantidade" fill="#6366f1" radius={[0, 4, 4, 0]} animationDuration={800} />
                            </BarChart>
                        </ResponsiveContainer>
                    </ChartCard>
                )}
            </div>
        </div>
    )
}
