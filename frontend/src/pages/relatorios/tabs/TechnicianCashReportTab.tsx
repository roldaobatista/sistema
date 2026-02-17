import {
    BarChart, Bar, XAxis, YAxis, Tooltip,
    ResponsiveContainer, CartesianGrid, Legend,
} from 'recharts'
import { Wallet, TrendingUp, TrendingDown } from 'lucide-react'
import { KpiCardSpark } from '@/components/charts/KpiCardSpark'
import { ChartCard } from '@/components/charts/ChartCard'

const fmtBRL = (v: number) => (Number(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

interface Props { data: any }

export function TechnicianCashReportTab({ data }: Props) {
    const totalBalance = Number(data.total_balance ?? 0)
    const totalCredits = Number(data.total_credits ?? 0)
    const totalDebits = Number(data.total_debits ?? 0)

    const techData = (data.funds ?? []).map((f: any) => ({
        name: f.user_name ?? 'Sem nome',
        Créditos: Number(f.credits_period ?? 0),
        Débitos: Number(f.debits_period ?? 0),
        saldo: Number(f.balance ?? 0),
    })).sort((a: any, b: any) => b.saldo - a.saldo)

    return (
        <div className="space-y-5">
            <div className="grid gap-3 sm:grid-cols-3">
                <KpiCardSpark
                    label="Saldo Total"
                    value={fmtBRL(totalBalance)}
                    icon={<Wallet className="h-4 w-4" />}
                    sparkColor="#6366f1"
                    valueClassName={totalBalance >= 0 ? 'text-emerald-600' : 'text-red-600'}
                />
                <KpiCardSpark
                    label="Créditos"
                    value={fmtBRL(totalCredits)}
                    icon={<TrendingUp className="h-4 w-4" />}
                    sparkColor="#22c55e"
                    valueClassName="text-emerald-600"
                />
                <KpiCardSpark
                    label="Débitos"
                    value={fmtBRL(totalDebits)}
                    icon={<TrendingDown className="h-4 w-4" />}
                    sparkColor="#ef4444"
                    valueClassName="text-red-600"
                />
            </div>

            {techData.length > 0 && (
                <ChartCard title="Créditos x Débitos por Técnico" icon={<Wallet className="h-4 w-4" />} height={Math.max(250, techData.length * 50)}>
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={techData} layout="vertical" margin={{ left: 10, right: 30 }}>
                            <CartesianGrid strokeDasharray="3 3" className="stroke-surface-200" />
                            <XAxis type="number" tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 11 }} />
                            <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 12 }} />
                            <Tooltip formatter={(v: any) => [fmtBRL(Number(v)), '']} />
                            <Legend />
                            <Bar dataKey="Créditos" fill="#22c55e" animationDuration={800} />
                            <Bar dataKey="Débitos" fill="#ef4444" animationDuration={800} />
                        </BarChart>
                    </ResponsiveContainer>
                </ChartCard>
            )}
        </div>
    )
}
