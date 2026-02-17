import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import api from '@/lib/api'
import { PageHeader } from '@/components/ui/pageheader'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
    Wallet, TrendingUp, TrendingDown, AlertTriangle, AlertCircle, CheckCircle2,
    Calendar, ArrowRight,
} from 'lucide-react'
import {
    LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    BarChart, Bar, Legend, ReferenceLine,
} from 'recharts'

const fmtBRL = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)

type DayRow = {
    date: string
    label: string
    inflows: number
    outflows: number
    obligations_total: number
    balance_projected: number
    alert: 'shortage' | 'tight' | 'ok'
    is_today: boolean
}

type ApiResponse = {
    data: {
        period: { from: string; to: string }
        initial_balance: number
        days: DayRow[]
        summary: {
            days_shortage: number
            days_tight: number
            min_balance: number
            min_balance_date: string | null
        }
    }
}

const alertConfig = {
    shortage: { label: 'Risco', variant: 'danger' as const, icon: AlertTriangle },
    tight: { label: 'Atenção', variant: 'warning' as const, icon: AlertCircle },
    ok: { label: 'Ok', variant: 'success' as const, icon: CheckCircle2 },
}

export function CashFlowWeeklyDashboardPage() {
    const [weeks, setWeeks] = useState(4)
    const [initialBalance, setInitialBalance] = useState('')

    const { data, isLoading, isError } = useQuery<ApiResponse>({
        queryKey: ['cash-flow-weekly', weeks, initialBalance],
        queryFn: async () => {
            const params: Record<string, string | number> = { weeks }
            if (initialBalance !== '' && !Number.isNaN(Number(initialBalance))) {
                params.initial_balance = Number(initialBalance)
            }
            const res = await api.get('/financial/cash-flow-weekly', { params })
            return res.data
        },
    })

    const days = data?.data?.days ?? []
    const summary = data?.data?.summary ?? { days_shortage: 0, days_tight: 0, min_balance: 0, min_balance_date: null }
    const period = data?.data?.period

    const chartData = days.map(d => ({
        ...d,
        balance: d.balance_projected,
        name: d.label,
    }))

    return (
        <div className="space-y-6">
            <PageHeader
                title="Fluxo de Caixa Semanal"
                subtitle="Projeção diária com indicadores de saúde do caixa"
                icon={<Wallet className="h-6 w-6" />}
            />

            <div className="flex flex-wrap items-center gap-4">
                <div className="flex items-center gap-2">
                    <label className="text-sm font-medium text-content-secondary">Período</label>
                    <select
                        aria-label="Período em semanas"
                        value={weeks}
                        onChange={e => setWeeks(Number(e.target.value))}
                        className="rounded-lg border border-default bg-surface-0 px-3 py-2 text-sm"
                    >
                        <option value={2}>2 semanas</option>
                        <option value={4}>4 semanas</option>
                        <option value={6}>6 semanas</option>
                        <option value={8}>8 semanas</option>
                        <option value={12}>12 semanas</option>
                    </select>
                </div>
                <div className="flex items-center gap-2">
                    <label className="text-sm font-medium text-content-secondary">Saldo inicial (opcional)</label>
                    <Input
                        type="number"
                        step="0.01"
                        placeholder="0"
                        value={initialBalance}
                        onChange={e => setInitialBalance(e.target.value)}
                        className="w-36"
                    />
                </div>
            </div>

            {isLoading ? (
                <div className="flex justify-center py-16">
                    <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-500 border-t-transparent" />
                </div>
            ) : isError ? (
                <Card className="p-8 text-center text-red-600">
                    Erro ao carregar projeção. Tente novamente.
                </Card>
            ) : (
                <>
                    <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                        <Card className="p-4">
                            <div className="flex items-center gap-2 text-sm text-content-secondary">
                                <AlertTriangle className="h-4 w-4 text-red-500" /> Dias em risco
                            </div>
                            <p className="mt-1 text-xl font-bold text-red-600">{summary.days_shortage}</p>
                        </Card>
                        <Card className="p-4">
                            <div className="flex items-center gap-2 text-sm text-content-secondary">
                                <AlertCircle className="h-4 w-4 text-amber-500" /> Dias de atenção
                            </div>
                            <p className="mt-1 text-xl font-bold text-amber-600">{summary.days_tight}</p>
                        </Card>
                        <Card className="p-4">
                            <div className="flex items-center gap-2 text-sm text-content-secondary">
                                <TrendingDown className="h-4 w-4 text-content-secondary" /> Menor saldo
                            </div>
                            <p className={`mt-1 text-xl font-bold ${summary.min_balance < 0 ? 'text-red-600' : 'text-content-primary'}`}>
                                {fmtBRL(summary.min_balance)}
                            </p>
                            {summary.min_balance_date && (
                                <p className="text-xs text-content-secondary">
                                    em {new Date(summary.min_balance_date + 'T12:00:00').toLocaleDateString('pt-BR')}
                                </p>
                            )}
                        </Card>
                        <Card className="p-4">
                            <div className="flex items-center gap-2 text-sm text-content-secondary">
                                <Calendar className="h-4 w-4" /> Período
                            </div>
                            <p className="mt-1 text-sm font-medium">
                                {period?.from && new Date(period.from + 'T12:00:00').toLocaleDateString('pt-BR')} –{' '}
                                {period?.to && new Date(period.to + 'T12:00:00').toLocaleDateString('pt-BR')}
                            </p>
                        </Card>
                    </div>

                    <Card className="p-5">
                        <h3 className="mb-4 text-sm font-semibold text-content-primary">Saldo projetado (R$)</h3>
                        <div className="h-80">
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={chartData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                                    <CartesianGrid strokeDasharray="3 3" className="stroke-surface-200" />
                                    <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                                    <YAxis tickFormatter={v => (v / 1000).toFixed(0) + 'k'} tick={{ fontSize: 11 }} />
                                    <Tooltip
                                        formatter={(value) => [fmtBRL(Number(value)), 'Saldo']}
                                        labelFormatter={label => `Dia ${label}`}
                                    />
                                    <ReferenceLine y={0} stroke="var(--color-content-secondary)" strokeDasharray="2 2" />
                                    <Line
                                        type="monotone"
                                        dataKey="balance"
                                        name="Saldo projetado"
                                        stroke="var(--color-brand-500)"
                                        strokeWidth={2}
                                        dot={{ r: 3 }}
                                        activeDot={{ r: 5 }}
                                    />
                                </LineChart>
                            </ResponsiveContainer>
                        </div>
                    </Card>

                    <Card className="p-5">
                        <h3 className="mb-4 text-sm font-semibold text-content-primary">Entradas x Saídas por dia</h3>
                        <div className="h-64">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={chartData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                                    <CartesianGrid strokeDasharray="3 3" className="stroke-surface-200" />
                                    <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                                    <YAxis tickFormatter={v => (v / 1000).toFixed(0) + 'k'} tick={{ fontSize: 11 }} />
                                    <Tooltip
                                        formatter={(value) => [fmtBRL(Number(value)), '']}
                                        labelFormatter={label => `Dia ${label}`}
                                    />
                                    <Legend />
                                    <Bar dataKey="inflows" name="Entradas" fill="var(--color-green-500)" radius={[2, 2, 0, 0]} />
                                    <Bar dataKey="outflows" name="Saídas" fill="var(--color-red-500)" radius={[2, 2, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </Card>

                    <Card className="overflow-hidden">
                        <div className="px-4 py-3 border-b border-subtle">
                            <h3 className="text-sm font-semibold text-content-primary">Detalhe por dia</h3>
                            <p className="text-xs text-content-secondary">
                                Vermelho = saldo insuficiente para obrigações do dia. Amarelo = margem &lt; 15%.
                            </p>
                        </div>
                        <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
                            <table className="w-full text-sm">
                                <thead className="sticky top-0 bg-surface-50 dark:bg-surface-800">
                                    <tr>
                                        <th className="px-4 py-2 text-left font-medium text-content-secondary">Data</th>
                                        <th className="px-4 py-2 text-right font-medium text-content-secondary">Entradas</th>
                                        <th className="px-4 py-2 text-right font-medium text-content-secondary">Saídas</th>
                                        <th className="px-4 py-2 text-right font-medium text-content-secondary">Saldo projetado</th>
                                        <th className="px-4 py-2 text-center font-medium text-content-secondary">Status</th>
                                        <th className="px-4 py-2 text-left font-medium text-content-secondary" />
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-subtle">
                                    {days.map((d) => {
                                        const config = alertConfig[d.alert]
                                        const Icon = config.icon
                                        return (
                                            <tr
                                                key={d.date}
                                                className={d.is_today ? 'bg-brand-50 dark:bg-brand-900/20' : ''}
                                            >
                                                <td className="px-4 py-2 font-medium">
                                                    {new Date(d.date + 'T12:00:00').toLocaleDateString('pt-BR', {
                                                        weekday: 'short',
                                                        day: '2-digit',
                                                        month: '2-digit',
                                                    })}
                                                    {d.is_today && (
                                                        <span className="ml-1 text-xs text-brand-600">(hoje)</span>
                                                    )}
                                                </td>
                                                <td className="px-4 py-2 text-right text-green-600">{fmtBRL(d.inflows)}</td>
                                                <td className="px-4 py-2 text-right text-red-600">{fmtBRL(d.outflows)}</td>
                                                <td className={`px-4 py-2 text-right font-medium ${d.balance_projected < 0 ? 'text-red-600' : ''}`}>
                                                    {fmtBRL(d.balance_projected)}
                                                </td>
                                                <td className="px-4 py-2 text-center">
                                                    <Badge variant={config.variant}>
                                                        <Icon className="mr-1 h-3 w-3" />
                                                        {config.label}
                                                    </Badge>
                                                </td>
                                                <td className="px-4 py-2">
                                                    <Link
                                                        to={`/financeiro/receber?due_date=${d.date}`}
                                                        className="text-xs text-brand-600 hover:underline"
                                                    >
                                                        Ver títulos
                                                    </Link>
                                                </td>
                                            </tr>
                                        )
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </Card>

                    <div className="flex gap-2">
                        <Link to="/financeiro">
                            <Button variant="outline" size="sm">
                                Voltar ao Financeiro
                            </Button>
                        </Link>
                        <Link to="/financeiro/fluxo-caixa">
                            <Button variant="outline" size="sm">
                                Fluxo de Caixa (mensal)
                            </Button>
                        </Link>
                    </div>
                </>
            )}
        </div>
    )
}
