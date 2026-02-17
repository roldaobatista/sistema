import { DollarSign, TrendingUp, TrendingDown, AlertTriangle } from 'lucide-react'
import { KpiCardSpark } from '@/components/charts/KpiCardSpark'
import { ChartCard } from '@/components/charts/ChartCard'
import { DonutChart } from '@/components/charts/DonutChart'
import { TrendAreaChart } from '@/components/charts/TrendAreaChart'

const fmtBRL = (v: number) => (Number(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

interface Props { data: any }

export function FinancialReportTab({ data }: Props) {
    const ar = data.receivable ?? {}
    const ap = data.payable ?? {}

    const expenseData = (data.expenses_by_category ?? []).map((e: any) => ({
        name: e.category ?? 'Sem categoria',
        value: Number(e.total ?? 0),
    }))

    const monthlyFlow = (data.monthly_flow ?? []).map((m: any) => ({
        period: m.period,
        receita: Number(m.income ?? 0),
        despesa: Number(m.expense ?? 0),
        saldo: Number(m.balance ?? 0),
    }))

    const sparkReceita = monthlyFlow.map((m: any) => m.receita)
    const sparkDespesa = monthlyFlow.map((m: any) => m.despesa)

    return (
        <div className="space-y-5">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <KpiCardSpark
                    label="Receita"
                    value={fmtBRL(Number(ar.total ?? 0))}
                    icon={<TrendingUp className="h-4 w-4" />}
                    sparkData={sparkReceita}
                    sparkColor="#22c55e"
                    valueClassName="text-emerald-600"
                />
                <KpiCardSpark
                    label="Recebido"
                    value={fmtBRL(Number(ar.total_paid ?? 0))}
                    icon={<DollarSign className="h-4 w-4" />}
                    sparkColor="#6366f1"
                />
                <KpiCardSpark
                    label="Despesas (AP)"
                    value={fmtBRL(Number(ap.total ?? 0))}
                    icon={<TrendingDown className="h-4 w-4" />}
                    sparkData={sparkDespesa}
                    sparkColor="#ef4444"
                    valueClassName="text-red-600"
                />
                <KpiCardSpark
                    label="Inadimplência"
                    value={fmtBRL(Number(ar.overdue ?? 0))}
                    icon={<AlertTriangle className="h-4 w-4" />}
                    sparkColor="#f59e0b"
                    valueClassName={Number(ar.overdue ?? 0) > 0 ? 'text-amber-600' : undefined}
                />
            </div>

            {monthlyFlow.length > 0 && (
                <ChartCard title="Receita x Despesa (Mensal)" icon={<DollarSign className="h-4 w-4" />}>
                    <TrendAreaChart
                        data={monthlyFlow}
                        xKey="period"
                        series={[
                            { key: 'receita', label: 'Receita', color: '#22c55e' },
                            { key: 'despesa', label: 'Despesa', color: '#ef4444' },
                            { key: 'saldo', label: 'Saldo', color: '#6366f1', dashed: true },
                        ]}
                        formatValue={fmtBRL}
                        yTickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
                        height="100%"
                    />
                </ChartCard>
            )}

            {expenseData.length > 0 && (
                <ChartCard title="Despesas por Categoria" height={280}>
                    <DonutChart
                        data={expenseData}
                        centerLabel="Total"
                        centerValue={fmtBRL(expenseData.reduce((s: number, d: any) => s + d.value, 0))}
                        height={240}
                        formatValue={fmtBRL}
                    />
                </ChartCard>
            )}
        </div>
    )
}
