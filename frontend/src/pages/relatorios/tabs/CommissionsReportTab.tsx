import {
    BarChart, Bar, XAxis, YAxis, Tooltip,
    ResponsiveContainer, CartesianGrid, Legend,
} from 'recharts'
import { Award, DollarSign, Clock } from 'lucide-react'
import { KpiCardSpark } from '@/components/charts/KpiCardSpark'
import { ChartCard } from '@/components/charts/ChartCard'
import { DonutChart } from '@/components/charts/DonutChart'

const fmtBRL = (v: number) => (Number(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

const statusLabels: Record<string, string> = {
    pending: 'Pendente', approved: 'Aprovado', paid: 'Pago', reversed: 'Estornado',
}

interface Props { data: any }

export function CommissionsReportTab({ data }: Props) {
    const byTech = (data.by_technician ?? []).map((t: any) => ({
        name: t.name,
        Pendente: Number(t.pending ?? 0),
        Pago: Number(t.paid ?? 0),
        total: Number(t.total_commission ?? 0),
    })).sort((a: any, b: any) => b.total - a.total)

    const byStatus = (data.by_status ?? []).map((s: any) => ({
        name: statusLabels[s.status] ?? s.status,
        value: Number(s.total ?? 0),
    }))

    const totalComm = byTech.reduce((s: number, t: any) => s + t.total, 0)
    const totalPending = byTech.reduce((s: number, t: any) => s + t.Pendente, 0)
    const totalPaid = byTech.reduce((s: number, t: any) => s + t.Pago, 0)

    return (
        <div className="space-y-5">
            <div className="grid gap-3 sm:grid-cols-3">
                <KpiCardSpark
                    label="Total Comissões"
                    value={fmtBRL(totalComm)}
                    icon={<Award className="h-4 w-4" />}
                    sparkColor="#6366f1"
                />
                <KpiCardSpark
                    label="Pendente"
                    value={fmtBRL(totalPending)}
                    icon={<Clock className="h-4 w-4" />}
                    sparkColor="#f59e0b"
                    valueClassName="text-amber-600"
                />
                <KpiCardSpark
                    label="Pago"
                    value={fmtBRL(totalPaid)}
                    icon={<DollarSign className="h-4 w-4" />}
                    sparkColor="#22c55e"
                    valueClassName="text-emerald-600"
                />
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
                {byTech.length > 0 && (
                    <ChartCard title="Comissão por Técnico" icon={<Award className="h-4 w-4" />} height={Math.max(200, byTech.length * 50)}>
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={byTech} layout="vertical" margin={{ left: 10, right: 20 }}>
                                <CartesianGrid strokeDasharray="3 3" className="stroke-surface-200" />
                                <XAxis type="number" tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 11 }} />
                                <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 12 }} />
                                <Tooltip formatter={(v: any) => [fmtBRL(Number(v)), '']} />
                                <Legend />
                                <Bar dataKey="Pendente" stackId="a" fill="#f59e0b" animationDuration={800} />
                                <Bar dataKey="Pago" stackId="a" fill="#22c55e" radius={[0, 4, 4, 0]} animationDuration={800} />
                            </BarChart>
                        </ResponsiveContainer>
                    </ChartCard>
                )}

                {byStatus.length > 0 && (
                    <ChartCard title="Por Status" height={Math.max(200, byTech.length * 50)}>
                        <DonutChart
                            data={byStatus}
                            centerLabel="Total"
                            centerValue={fmtBRL(totalComm)}
                            formatValue={fmtBRL}
                            height={220}
                        />
                    </ChartCard>
                )}
            </div>
        </div>
    )
}
