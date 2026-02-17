import { TrendingUp, DollarSign, Percent, Package } from 'lucide-react'
import { KpiCardSpark } from '@/components/charts/KpiCardSpark'
import { ChartCard } from '@/components/charts/ChartCard'
import { GaugeChart } from '@/components/charts/GaugeChart'
import { StackedBar } from '@/components/charts/StackedBar'

const fmtBRL = (v: number) => (Number(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

interface Props { data: any }

export function ProfitabilityReportTab({ data }: Props) {
    const revenue = Number(data.revenue ?? 0)
    const totalCosts = Number(data.total_costs ?? 0)
    const profit = Number(data.profit ?? 0)
    const margin = Number(data.margin_pct ?? 0)

    const costBreakdown = [
        {
            name: 'Composição',
            AP: Number(data.costs ?? 0),
            Despesas: Number(data.expenses ?? 0),
            Comissões: Number(data.commissions ?? 0),
            Peças: Number(data.item_costs ?? 0),
        },
    ]

    return (
        <div className="space-y-5">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <KpiCardSpark
                    label="Receita"
                    value={fmtBRL(revenue)}
                    icon={<DollarSign className="h-4 w-4" />}
                    sparkColor="#22c55e"
                    valueClassName="text-emerald-600"
                />
                <KpiCardSpark
                    label="Custos Totais"
                    value={fmtBRL(totalCosts)}
                    icon={<Package className="h-4 w-4" />}
                    sparkColor="#ef4444"
                    valueClassName="text-red-600"
                />
                <KpiCardSpark
                    label="Lucro"
                    value={fmtBRL(profit)}
                    icon={<TrendingUp className="h-4 w-4" />}
                    sparkColor={profit >= 0 ? '#22c55e' : '#ef4444'}
                    valueClassName={profit >= 0 ? 'text-emerald-600' : 'text-red-600'}
                />
                <KpiCardSpark
                    label="Margem"
                    value={`${margin}%`}
                    icon={<Percent className="h-4 w-4" />}
                    sparkColor={margin >= 30 ? '#22c55e' : margin >= 15 ? '#f59e0b' : '#ef4444'}
                />
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
                <ChartCard title="Margem de Lucro" icon={<Percent className="h-4 w-4" />} height={240}>
                    <GaugeChart
                        value={margin}
                        max={100}
                        label="Margem"
                        suffix="%"
                        height={220}
                    />
                </ChartCard>

                <ChartCard title="Composição dos Custos" icon={<Package className="h-4 w-4" />} height={240}>
                    <StackedBar
                        data={costBreakdown}
                        xKey="name"
                        dataKeys={[
                            { key: 'AP', label: 'Contas a Pagar', color: '#ef4444' },
                            { key: 'Despesas', label: 'Despesas', color: '#f59e0b' },
                            { key: 'Comissões', label: 'Comissões', color: '#8b5cf6' },
                            { key: 'Peças', label: 'Peças', color: '#06b6d4' },
                        ]}
                        formatValue={fmtBRL}
                        height="100%"
                    />
                </ChartCard>
            </div>
        </div>
    )
}
