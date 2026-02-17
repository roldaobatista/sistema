import {
    BarChart, Bar, XAxis, YAxis, Tooltip,
    ResponsiveContainer, CartesianGrid,
} from 'recharts'
import { Truck, Users } from 'lucide-react'
import { KpiCardSpark } from '@/components/charts/KpiCardSpark'
import { ChartCard } from '@/components/charts/ChartCard'
import { DonutChart } from '@/components/charts/DonutChart'

const fmtBRL = (v: number) => (Number(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

interface Props { data: any }

export function SuppliersReportTab({ data }: Props) {
    const totalSuppliers = data.total_suppliers ?? 0
    const activeSuppliers = data.active_suppliers ?? 0

    const ranking = (data.ranking ?? []).map((s: any) => ({
        name: s.name,
        total: Number(s.total_amount ?? 0),
        orders: Number(s.orders_count ?? 0),
    }))

    const categoryData = (data.by_category ?? []).map((c: any) => ({
        name: c.category ?? 'Sem categoria',
        value: Number(c.count),
    }))

    return (
        <div className="space-y-5">
            <div className="grid gap-3 sm:grid-cols-2">
                <KpiCardSpark label="Total" value={totalSuppliers} icon={<Truck className="h-4 w-4" />} sparkColor="#6366f1" />
                <KpiCardSpark label="Ativos" value={activeSuppliers} icon={<Users className="h-4 w-4" />} sparkColor="#22c55e" />
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
                {ranking.length > 0 && (
                    <ChartCard title="Ranking por Volume" icon={<Truck className="h-4 w-4" />} height={Math.max(250, ranking.length * 40)}>
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={ranking.slice(0, 15)} layout="vertical" margin={{ left: 10, right: 30 }}>
                                <CartesianGrid strokeDasharray="3 3" className="stroke-surface-200" />
                                <XAxis type="number" tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 11 }} />
                                <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 11 }} />
                                <Tooltip formatter={(v: any) => [fmtBRL(Number(v)), 'Volume'] as any} />
                                <Bar dataKey="total" name="Volume" fill="#6366f1" radius={[0, 4, 4, 0]} animationDuration={800} />
                            </BarChart>
                        </ResponsiveContainer>
                    </ChartCard>
                )}

                {categoryData.length > 0 && (
                    <ChartCard title="Por Categoria" height={Math.max(250, ranking.length * 40)}>
                        <DonutChart data={categoryData} centerValue={totalSuppliers} centerLabel="Total" height={220} />
                    </ChartCard>
                )}
            </div>
        </div>
    )
}
