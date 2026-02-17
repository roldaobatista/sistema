import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
    PieChart, Pie, Cell, BarChart, Bar, AreaChart, Area,
    XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import {
    ArrowDownRight,
    ArrowUpRight,
    BarChart3,
    CalendarDays,
    CheckCircle2,
    Clock,
    Filter,
    Percent,
    RefreshCw,
    TrendingUp,
    Zap,
} from 'lucide-react'
import api from '@/lib/api'
import { Button } from '@/components/ui/button'
import { useAuthStore } from '@/stores/auth-store'

// ─── Types ──────────────────────────────────────────

type KPIs = {
    total_entries: number
    pending: number
    matched: number
    ignored: number
    auto_matched: number
    total_credits: number
    total_debits: number
    reconciliation_rate: number
}

type StatusItem = { name: string; value: number; color: string }
type WeeklyItem = { week: string; credits: number; debits: number }
type DailyItem = { day: string; pending: number; matched: number; ignored: number }
type CategoryItem = { category: string; count: number; amount: number }
type UnreconciledItem = { id: number; date: string; description: string; amount: number; type: string }

type DashboardData = {
    kpis: KPIs
    status_distribution: StatusItem[]
    weekly_data: WeeklyItem[]
    daily_progress: DailyItem[]
    categories: CategoryItem[]
    top_unreconciled: UnreconciledItem[]
}

// ─── Helpers ────────────────────────────────────────

const fmtBRL = (v: number) =>
    v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

const fmtDate = (d: string) => {
    if (!d) return '—'
    return new Date(d + (d.length === 10 ? 'T12:00:00' : '')).toLocaleDateString('pt-BR')
}

const COLORS = ['#f59e0b', '#10b981', '#6b7280']

// ─── Component ──────────────────────────────────────

export function ReconciliationDashboardPage() {
  const { hasPermission } = useAuthStore()

    const [startDate, setStartDate] = useState(() => {
        const d = new Date()
        d.setDate(d.getDate() - 30)
        return d.toISOString().slice(0, 10)
    })
    const [endDate, setEndDate] = useState(() => new Date().toISOString().slice(0, 10))

    const dashboardQuery = useQuery<DashboardData>({
        queryKey: ['reconciliation-dashboard', startDate, endDate],
        queryFn: async () => {
            const { data } = await api.get('/bank-reconciliation/dashboard', {
                params: { start_date: startDate, end_date: endDate },
            })
            return data.data
        },
        refetchInterval: 30_000,
    })

    const data = dashboardQuery.data
    const kpis = data?.kpis

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-xl font-bold text-surface-900">Dashboard de Conciliação</h1>
                    <p className="text-sm text-surface-500">Visão analítica da conciliação bancária</p>
                </div>
                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2 rounded-lg border border-default bg-surface-0 px-3 py-1.5">
                        <CalendarDays className="h-4 w-4 text-surface-400" />
                        <label htmlFor="dash-start" className="sr-only">Data início</label>
                        <input
                            id="dash-start"
                            type="date"
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                            className="border-0 bg-transparent text-sm outline-none"
                        />
                        <span className="text-surface-400">→</span>
                        <label htmlFor="dash-end" className="sr-only">Data fim</label>
                        <input
                            id="dash-end"
                            type="date"
                            value={endDate}
                            onChange={(e) => setEndDate(e.target.value)}
                            className="border-0 bg-transparent text-sm outline-none"
                        />
                    </div>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => dashboardQuery.refetch()}
                        disabled={dashboardQuery.isFetching}
                    >
                        <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${dashboardQuery.isFetching ? 'animate-spin' : ''}`} />
                        Atualizar
                    </Button>
                </div>
            </div>

            {dashboardQuery.isLoading ? (
                <div className="flex items-center justify-center py-20">
                    <RefreshCw className="h-6 w-6 animate-spin text-brand-500" />
                </div>
            ) : dashboardQuery.isError ? (
                <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-center">
                    <p className="text-sm text-red-600">Erro ao carregar dados do dashboard.</p>
                    <Button variant="outline" size="sm" className="mt-3" onClick={() => dashboardQuery.refetch()}>
                        Tentar novamente
                    </Button>
                </div>
            ) : data ? (
                <>
                    <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                        <KpiCard
                            label="Taxa de Conciliação"
                            value={`${kpis?.reconciliation_rate ?? 0}%`}
                            icon={<Percent className="h-5 w-5" />}
                            color="emerald"
                            subtitle={`${kpis?.matched ?? 0} de ${kpis?.total_entries ?? 0}`}
                        />
                        <KpiCard
                            label="Pendentes"
                            value={String(kpis?.pending ?? 0)}
                            icon={<Clock className="h-5 w-5" />}
                            color="amber"
                            subtitle="aguardando conciliação"
                        />
                        <KpiCard
                            label="Auto Conciliados"
                            value={String(kpis?.auto_matched ?? 0)}
                            icon={<Zap className="h-5 w-5" />}
                            color="blue"
                            subtitle="regras + auto-match"
                        />
                        <KpiCard
                            label="Conciliados"
                            value={String(kpis?.matched ?? 0)}
                            icon={<CheckCircle2 className="h-5 w-5" />}
                            color="emerald"
                            subtitle="total conciliados"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="flex items-center gap-4 rounded-xl border border-default bg-surface-0 p-5 shadow-card">
                            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-50">
                                <ArrowUpRight className="h-6 w-6 text-emerald-600" />
                            </div>
                            <div>
                                <p className="text-xs font-medium text-surface-500">Total Créditos</p>
                                <p className="text-xl font-bold text-emerald-600">{fmtBRL(kpis?.total_credits ?? 0)}</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-4 rounded-xl border border-default bg-surface-0 p-5 shadow-card">
                            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-red-50">
                                <ArrowDownRight className="h-6 w-6 text-red-600" />
                            </div>
                            <div>
                                <p className="text-xs font-medium text-surface-500">Total Débitos</p>
                                <p className="text-xl font-bold text-red-600">{fmtBRL(kpis?.total_debits ?? 0)}</p>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                        <div className="rounded-xl border border-default bg-surface-0 p-5 shadow-card">
                            <h3 className="mb-4 text-sm font-semibold text-surface-900">Distribuição por Status</h3>
                            <ResponsiveContainer width="100%" height={260}>
                                <PieChart>
                                    <Pie
                                        data={data.status_distribution}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={60}
                                        outerRadius={100}
                                        paddingAngle={3}
                                        dataKey="value"
                                        nameKey="name"
                                        label={({ name, value }) => `${name}: ${value}`}
                                    >
                                        {data.status_distribution.map((entry, i) => (
                                            <Cell key={i} fill={entry.color || COLORS[i % COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <Tooltip formatter={(v: number | undefined) => [v ?? 0, 'Qtd']} />
                                    <Legend />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>

                        <div className="rounded-xl border border-default bg-surface-0 p-5 shadow-card">
                            <h3 className="mb-4 text-sm font-semibold text-surface-900">Créditos vs Débitos por Semana</h3>
                            <ResponsiveContainer width="100%" height={260}>
                                <BarChart data={data.weekly_data}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                                    <XAxis dataKey="week" tick={{ fontSize: 12 }} />
                                    <YAxis tickFormatter={(v) => fmtBRL(v)} tick={{ fontSize: 10 }} />
                                    <Tooltip formatter={(v: number | undefined) => fmtBRL(v ?? 0)} />
                                    <Legend />
                                    <Bar dataKey="credits" name="Créditos" fill="#10b981" radius={[4, 4, 0, 0]} />
                                    <Bar dataKey="debits" name="Débitos" fill="#ef4444" radius={[4, 4, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    <div className="rounded-xl border border-default bg-surface-0 p-5 shadow-card">
                        <h3 className="mb-4 text-sm font-semibold text-surface-900">
                            <TrendingUp className="mr-1.5 inline h-4 w-4" />
                            Progresso de Conciliação por Dia
                        </h3>
                        <ResponsiveContainer width="100%" height={280}>
                            <AreaChart data={data.daily_progress}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                                <XAxis dataKey="day" tickFormatter={(d) => fmtDate(d)} tick={{ fontSize: 10 }} />
                                <YAxis tick={{ fontSize: 12 }} />
                                <Tooltip labelFormatter={(d) => fmtDate(String(d))} />
                                <Legend />
                                <Area type="monotone" dataKey="matched" name="Conciliados" stackId="1" stroke="#10b981" fill="#10b98133" />
                                <Area type="monotone" dataKey="pending" name="Pendentes" stackId="1" stroke="#f59e0b" fill="#f59e0b33" />
                                <Area type="monotone" dataKey="ignored" name="Ignorados" stackId="1" stroke="#6b7280" fill="#6b728033" />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>

                    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                        <div className="rounded-xl border border-default bg-surface-0 p-5 shadow-card">
                            <h3 className="mb-4 text-sm font-semibold text-surface-900">
                                <Filter className="mr-1.5 inline h-4 w-4" />
                                Top Categorias
                            </h3>
                            {data.categories.length === 0 ? (
                                <p className="py-6 text-center text-sm text-surface-400">Nenhuma categoria registrada ainda.</p>
                            ) : (
                                <div className="space-y-2">
                                    {data.categories.map((cat) => (
                                        <div key={cat.category} className="flex items-center justify-between rounded-lg bg-surface-50 px-3 py-2">
                                            <div className="flex items-center gap-2">
                                                <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-purple-100 text-xs font-bold text-purple-700">
                                                    {cat.count}
                                                </span>
                                                <span className="text-sm font-medium text-surface-800">{cat.category}</span>
                                            </div>
                                            <span className="text-sm font-semibold text-surface-600">{fmtBRL(cat.amount)}</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div className="rounded-xl border border-default bg-surface-0 p-5 shadow-card">
                            <h3 className="mb-4 text-sm font-semibold text-surface-900">
                                <BarChart3 className="mr-1.5 inline h-4 w-4" />
                                Top 10 Pendentes (maior valor)
                            </h3>
                            {data.top_unreconciled.length === 0 ? (
                                <div className="py-6 text-center">
                                    <CheckCircle2 className="mx-auto mb-2 h-8 w-8 text-emerald-400" />
                                    <p className="text-sm text-surface-400">Nenhum lançamento pendente!</p>
                                </div>
                            ) : (
                                <div className="space-y-1.5">
                                    {data.top_unreconciled.map((item) => (
                                        <div key={item.id} className="flex items-center justify-between rounded-lg border border-default px-3 py-2">
                                            <div className="min-w-0 flex-1">
                                                <p className="truncate text-sm font-medium text-surface-800">{item.description}</p>
                                                <p className="text-xs text-surface-400">{fmtDate(item.date)}</p>
                                            </div>
                                            <span className={`ml-3 shrink-0 text-sm font-bold ${item.type === 'credit' ? 'text-emerald-600' : 'text-red-600'}`}>
                                                {fmtBRL(item.amount)}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </>
            ) : null}
        </div>
    )
}

// ─── Sub-components ─────────────────────────────────

function KpiCard({ label, value, icon, color, subtitle }: {
    label: string
    value: string
    icon: React.ReactNode
    color: 'emerald' | 'amber' | 'blue' | 'red'
    subtitle: string
}) {
    const colorMap = {
        emerald: { bg: 'bg-emerald-50', text: 'text-emerald-600', ring: 'ring-emerald-200' },
        amber: { bg: 'bg-amber-50', text: 'text-amber-600', ring: 'ring-amber-200' },
        blue: { bg: 'bg-blue-50', text: 'text-blue-600', ring: 'ring-blue-200' },
        red: { bg: 'bg-red-50', text: 'text-red-600', ring: 'ring-red-200' },
    }
    const c = colorMap[color]

    return (
        <div className="rounded-xl border border-default bg-surface-0 p-5 shadow-card">
            <div className="flex items-center justify-between">
                <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${c.bg} ${c.text} ring-1 ${c.ring}`}>
                    {icon}
                </div>
            </div>
            <p className="mt-3 text-2xl font-bold text-surface-900">{value}</p>
            <p className="text-xs font-medium text-surface-500">{label}</p>
            <p className="mt-0.5 text-xs text-surface-400">{subtitle}</p>
        </div>
    )
}
