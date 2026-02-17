import {
    BarChart, Bar, XAxis, YAxis, Tooltip,
    ResponsiveContainer, CartesianGrid,
} from 'recharts'
import { Scale, AlertTriangle, DollarSign, Activity } from 'lucide-react'
import { KpiCardSpark } from '@/components/charts/KpiCardSpark'
import { ChartCard } from '@/components/charts/ChartCard'
import { DonutChart } from '@/components/charts/DonutChart'

const fmtBRL = (v: number) => (Number(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

interface Props { data: any }

export function EquipmentsReportTab({ data }: Props) {
    const totalActive = data.total_active ?? 0
    const totalInactive = data.total_inactive ?? 0
    const calibrationCost = Number(data.total_calibration_cost ?? 0)
    const overdue = data.overdue_calibrations ?? data.calibration_overdue ?? 0

    const classData = (data.by_class ?? []).map((c: any) => ({
        name: c.precision_class ?? 'Sem classe',
        value: Number(c.count),
    }))

    const brandData = (data.top_brands ?? []).map((b: any) => ({
        name: b.brand ?? 'Sem marca',
        count: Number(b.count),
    }))

    const dueAlerts = data.due_alerts ?? []

    return (
        <div className="space-y-5">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <KpiCardSpark label="Ativos" value={totalActive} icon={<Scale className="h-4 w-4" />} sparkColor="#22c55e" />
                <KpiCardSpark label="Inativos" value={totalInactive} icon={<Scale className="h-4 w-4" />} sparkColor="#64748b" />
                <KpiCardSpark label="Custo Calibrações" value={fmtBRL(calibrationCost)} icon={<DollarSign className="h-4 w-4" />} sparkColor="#6366f1" />
                <KpiCardSpark
                    label="Calibração Vencida"
                    value={overdue}
                    icon={<AlertTriangle className="h-4 w-4" />}
                    sparkColor="#ef4444"
                    valueClassName={overdue > 0 ? 'text-red-600' : undefined}
                />
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
                {classData.length > 0 && (
                    <ChartCard title="Por Classe de Precisão" height={260}>
                        <DonutChart data={classData} centerValue={totalActive} centerLabel="Ativos" height={220} />
                    </ChartCard>
                )}

                {brandData.length > 0 && (
                    <ChartCard title="Top Marcas" icon={<Activity className="h-4 w-4" />} height={260}>
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={brandData} layout="vertical" margin={{ left: 10, right: 20 }}>
                                <CartesianGrid strokeDasharray="3 3" className="stroke-surface-200" />
                                <XAxis type="number" tick={{ fontSize: 11 }} />
                                <YAxis type="category" dataKey="name" width={80} tick={{ fontSize: 11 }} />
                                <Tooltip />
                                <Bar dataKey="count" name="Quantidade" fill="#06b6d4" radius={[0, 4, 4, 0]} animationDuration={800} />
                            </BarChart>
                        </ResponsiveContainer>
                    </ChartCard>
                )}
            </div>

            {dueAlerts.length > 0 && (
                <div className="rounded-xl border border-default bg-surface-0 shadow-card overflow-hidden">
                    <div className="px-5 pt-4 pb-2 flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4 text-amber-500" />
                        <h3 className="text-sm font-semibold text-surface-700">Calibrações a Vencer (30 dias)</h3>
                    </div>
                    <div className="overflow-x-auto max-h-[300px] overflow-y-auto">
                        <table className="w-full text-sm">
                            <thead className="sticky top-0 bg-surface-50">
                                <tr>
                                    <th className="px-4 py-2 text-left font-medium text-surface-500">Código</th>
                                    <th className="px-4 py-2 text-left font-medium text-surface-500">Marca/Modelo</th>
                                    <th className="px-4 py-2 text-left font-medium text-surface-500">Vencimento</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-subtle">
                                {dueAlerts.map((eq: any) => (
                                    <tr key={eq.id}>
                                        <td className="px-4 py-2 font-mono text-xs">{eq.code}</td>
                                        <td className="px-4 py-2">{eq.brand} {eq.model}</td>
                                        <td className="px-4 py-2 tabular-nums">
                                            {eq.next_calibration_at ? new Date(eq.next_calibration_at + 'T12:00:00').toLocaleDateString('pt-BR') : '—'}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    )
}
