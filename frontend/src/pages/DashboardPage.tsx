import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import {
    FileText, DollarSign, TrendingUp, TrendingDown, ArrowUpRight, ArrowDownRight,
    Clock, CheckCircle2, Wallet, Receipt, AlertCircle, Scale, AlertTriangle, Package,
    Plus, Search, Zap, Users, Rocket,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/stores/auth-store'
import { Badge } from '@/components/ui/badge'
import api from '@/lib/api'

const fmtBRL = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

function TrendBadge({ current, previous, suffix = '', invert = false }: {
    current: number
    previous: number
    suffix?: string
    invert?: boolean
}) {
    if (previous === 0 && current === 0) return null
    const pct = previous === 0 ? 100 : Math.round(((current - previous) / previous) * 100)
    if (pct === 0) return null

    const isPositive = invert ? pct < 0 : pct > 0
    const Icon = pct > 0 ? ArrowUpRight : ArrowDownRight

    return (
        <span className={cn(
            'inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular-nums',
            isPositive
                ? 'bg-emerald-50 text-emerald-600'
                : 'bg-red-50 text-red-600'
        )}>
            <Icon className="h-3 w-3" />
            {Math.abs(pct)}%{suffix}
        </span>
    )
}

const statusConfig: Record<string, { label: string; variant: any; color: string }> = {
    pending: { label: 'Pendente', variant: 'warning', color: 'text-amber-600' },
    in_progress: { label: 'Em Andamento', variant: 'info', color: 'text-sky-600' },
    completed: { label: 'Concluída', variant: 'success', color: 'text-emerald-600' },
    cancelled: { label: 'Cancelada', variant: 'danger', color: 'text-red-600' },
}

export function DashboardPage() {
    const { user } = useAuthStore()
    const navigate = useNavigate()

    const { data: statsRes, isLoading } = useQuery({
        queryKey: ['dashboard-stats'],
        queryFn: () => api.get('/dashboard-stats'),
        refetchInterval: 60_000,
    })

    const s = statsRes?.data ?? {}

    const recentOs = s.recent_os ?? []
    const topTechs = s.top_technicians ?? []
    const eqAlerts = s.eq_alerts ?? []
    const eqOverdue = s.eq_overdue ?? 0
    const eqDue7 = s.eq_due_7 ?? 0
    const isEmpty = !isLoading && (s.open_os ?? 0) === 0 && (s.completed_month ?? 0) === 0 && (s.revenue_month ?? 0) === 0

    const quickActions = [
        { label: 'Nova OS', icon: Plus, path: '/os/criar', color: 'bg-brand-500 text-white hover:bg-brand-600' },
        { label: 'Novo Orçamento', icon: FileText, path: '/orcamentos/criar', color: 'bg-surface-100 text-surface-700 hover:bg-surface-200' },
        { label: 'Novo Cliente', icon: Users, path: '/cadastros/clientes/novo', color: 'bg-surface-100 text-surface-700 hover:bg-surface-200' },
        { label: 'Buscar', icon: Search, path: '', color: 'bg-surface-100 text-surface-700 hover:bg-surface-200', kbd: 'Ctrl+K' },
    ]

    return (
        <div className="space-y-5">
            {/* Header */}
            <div>
                <h1 className="text-lg font-semibold text-surface-900 tracking-tight">Dashboard</h1>
                <p className="mt-0.5 text-[13px] text-surface-500">
                    Olá, {user?.name ?? 'Usuário'}. Aqui está o resumo do dia.
                </p>
            </div>

            {/* Onboarding empty state */}
            {isEmpty && (
                <div className="rounded-xl border-2 border-dashed border-surface-200 bg-surface-50/50 p-8 text-center">
                    <Rocket className="mx-auto h-10 w-10 text-brand-400 mb-3" />
                    <h2 className="text-[15px] font-semibold text-surface-900">Bem-vindo ao Kalibrium!</h2>
                    <p className="mt-1 text-[13px] text-surface-500 max-w-md mx-auto">
                        Comece cadastrando seus clientes e criando sua primeira ordem de serviço.
                    </p>
                    <div className="mt-4 flex justify-center gap-2">
                        <button
                            onClick={() => navigate('/cadastros/clientes/novo')}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-surface-100 px-3.5 py-2 text-[13px] font-medium text-surface-700 hover:bg-surface-200 transition-colors"
                        >
                            <Users className="h-4 w-4" /> Cadastrar Cliente
                        </button>
                        <button
                            onClick={() => navigate('/os/criar')}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-brand-500 px-3.5 py-2 text-[13px] font-medium text-white hover:bg-brand-600 transition-colors"
                        >
                            <Plus className="h-4 w-4" /> Criar OS
                        </button>
                    </div>
                </div>
            )}

            {/* Quick Actions */}
            <div className="flex flex-wrap gap-2">
                {quickActions.map(a => (
                    <button
                        key={a.label}
                        onClick={() => a.path ? navigate(a.path) : document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true }))}
                        className={cn(
                            'inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-medium transition-colors duration-100',
                            a.color
                        )}
                    >
                        <a.icon className="h-3.5 w-3.5" />
                        {a.label}
                        {a.kbd && <kbd className="ml-1 rounded bg-surface-200/60 px-1 py-0.5 text-[10px] font-mono text-surface-400">{a.kbd}</kbd>}
                    </button>
                ))}
            </div>

            {/* Hero KPIs — with trend indicators */}
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {/* Hero: OS Abertas */}
                <div className="rounded-xl border border-default bg-surface-0 p-4 shadow-card hover:shadow-md transition-shadow duration-200 cursor-default">
                    <div className="flex items-center justify-between mb-3">
                        <span className="text-[11px] font-medium text-surface-500 uppercase tracking-wider">OS Abertas</span>
                        <FileText className="h-4 w-4 text-brand-400" />
                    </div>
                    <div className="flex items-end gap-2">
                        <p className="text-3xl font-bold text-surface-900 tabular-nums tracking-tight">
                            {isLoading ? '—' : s.open_os ?? 0}
                        </p>
                        {!isLoading && (
                            <TrendBadge
                                current={s.open_os ?? 0}
                                previous={s.prev_open_os ?? s.open_os ?? 0}
                                invert
                            />
                        )}
                    </div>
                    {/* Tolerance bar */}
                    <div className="mt-3 flex gap-0.5">
                        <div className="h-1 flex-[3] rounded-l-full bg-emerald-400/70" />
                        <div className="h-1 flex-[1] bg-amber-400/70" />
                        <div className="h-1 flex-[1] rounded-r-full bg-red-400/70" />
                    </div>
                </div>

                {/* Em Andamento */}
                <div className="rounded-xl border border-default bg-surface-0 p-4 shadow-card hover:shadow-md transition-shadow duration-200 cursor-default">
                    <div className="flex items-center justify-between mb-3">
                        <span className="text-[11px] font-medium text-surface-500 uppercase tracking-wider">Em Andamento</span>
                        <Clock className="h-4 w-4 text-amber-400" />
                    </div>
                    <div className="flex items-end gap-2">
                        <p className="text-3xl font-bold text-surface-900 tabular-nums tracking-tight">
                            {isLoading ? '—' : s.in_progress_os ?? 0}
                        </p>
                        {!isLoading && (
                            <TrendBadge
                                current={s.in_progress_os ?? 0}
                                previous={s.prev_in_progress_os ?? s.in_progress_os ?? 0}
                            />
                        )}
                    </div>
                    <p className="mt-2 text-[11px] text-surface-400">ordens ativas</p>
                </div>

                {/* Concluídas */}
                <div className="rounded-xl border border-default bg-surface-0 p-4 shadow-card hover:shadow-md transition-shadow duration-200 cursor-default">
                    <div className="flex items-center justify-between mb-3">
                        <span className="text-[11px] font-medium text-surface-500 uppercase tracking-wider">Concluídas</span>
                        <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                    </div>
                    <div className="flex items-end gap-2">
                        <p className="text-3xl font-bold text-surface-900 tabular-nums tracking-tight">
                            {isLoading ? '—' : s.completed_month ?? 0}
                        </p>
                        {!isLoading && (
                            <TrendBadge
                                current={s.completed_month ?? 0}
                                previous={s.prev_completed_month ?? s.completed_month ?? 0}
                            />
                        )}
                    </div>
                    <p className="mt-2 text-[11px] text-surface-400">este mês</p>
                </div>

                {/* Faturamento */}
                <div className="rounded-xl border border-default bg-surface-0 p-4 shadow-card hover:shadow-md transition-shadow duration-200 cursor-default">
                    <div className="flex items-center justify-between mb-3">
                        <span className="text-[11px] font-medium text-surface-500 uppercase tracking-wider">Faturamento</span>
                        <DollarSign className="h-4 w-4 text-brand-400" />
                    </div>
                    <div className="flex items-end gap-2">
                        <p className="text-lg font-semibold text-surface-900 tracking-tight tabular-nums">
                            {isLoading ? '—' : fmtBRL(s.revenue_month ?? 0)}
                        </p>
                        {!isLoading && (
                            <TrendBadge
                                current={s.revenue_month ?? 0}
                                previous={s.prev_revenue_month ?? s.revenue_month ?? 0}
                            />
                        )}
                    </div>
                    <p className="mt-2 text-[11px] text-surface-400">receita mensal</p>
                </div>
            </div>

            {/* Secondary metrics — inline dense row */}
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {[
                    { label: 'Comissões Pendentes', value: fmtBRL(s.pending_commissions ?? 0), icon: Wallet, iconColor: 'text-sky-400' },
                    { label: 'Despesas (mês)', value: fmtBRL(s.expenses_month ?? 0), icon: Receipt, iconColor: 'text-red-400' },
                    { label: 'Estoque Baixo', value: s.stock_low ?? 0, icon: Package, iconColor: 'text-amber-400' },
                    { label: 'SLA Estourado', value: (s.sla_response_breached ?? 0) + (s.sla_resolution_breached ?? 0), icon: AlertTriangle, iconColor: 'text-red-400' },
                ].map((stat) => (
                    <div key={stat.label} className="flex items-center gap-3 rounded-lg border border-subtle bg-surface-0 px-3.5 py-2.5 hover:shadow-md transition-shadow duration-200 cursor-default">
                        <stat.icon className={cn('h-4 w-4 shrink-0', stat.iconColor)} />
                        <div className="min-w-0 flex-1">
                            <p className="text-[11px] text-surface-400 truncate">{stat.label}</p>
                            <p className="text-[15px] font-semibold text-surface-900 tabular-nums">{isLoading ? '—' : stat.value}</p>
                        </div>
                    </div>
                ))}
            </div>

            {/* Charts Row */}
            <div className="grid gap-3 lg:grid-cols-3">
                {/* Monthly Revenue Bar Chart */}
                <div className="rounded-xl border border-default bg-surface-0 shadow-card">
                    <div className="px-4 py-3 border-b border-subtle">
                        <h3 className="text-[13px] font-semibold text-surface-900">Faturamento Mensal</h3>
                    </div>
                    <div className="p-4">
                        {(() => {
                            const monthly: { month: string; total: number }[] = s.monthly_revenue ?? []
                            const max = Math.max(...monthly.map(m => m.total), 1)
                            return monthly.length > 0 ? (
                                <div className="flex items-end gap-1.5 h-32">
                                    {monthly.map((m, i) => (
                                        <div key={i} className="flex-1 flex flex-col items-center gap-1">
                                            <span className="text-[9px] text-surface-400 font-medium tabular-nums">
                                                {fmtBRL(m.total).replace('R$\u00a0', '')}
                                            </span>
                                            <div
                                                className="w-full rounded-sm bg-brand-500/80 transition-all duration-500"
                                                style={{ height: `${Math.max((m.total / max) * 100, 4)}%`, minHeight: 4 }}
                                            />
                                            <span className="text-[9px] text-surface-400">{m.month}</span>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-center text-[13px] text-surface-400 py-8">Sem dados</p>
                            )
                        })()}
                    </div>
                </div>

                {/* OS by Status Donut */}
                <div className="rounded-xl border border-default bg-surface-0 shadow-card">
                    <div className="px-4 py-3 border-b border-subtle">
                        <h3 className="text-[13px] font-semibold text-surface-900">OS por Status</h3>
                    </div>
                    <div className="p-4">
                        {(() => {
                            const data = [
                                { key: 'open', label: 'Abertas', value: s.open_os ?? 0, color: 'oklch(0.55 0.18 245)' },
                                { key: 'in_progress', label: 'Em Andamento', value: s.in_progress_os ?? 0, color: 'oklch(0.75 0.15 75)' },
                                { key: 'completed', label: 'Concluídas', value: s.completed_month ?? 0, color: 'oklch(0.60 0.17 145)' },
                            ]
                            const total = data.reduce((a, d) => a + d.value, 0) || 1
                            let offset = 0
                            return (
                                <div className="flex items-center gap-5">
                                    <svg viewBox="0 0 36 36" className="h-24 w-24 flex-shrink-0">
                                        {data.map(d => {
                                            const pct = (d.value / total) * 100
                                            const dash = `${pct} ${100 - pct}`
                                            const el = (
                                                <circle key={d.key} cx="18" cy="18" r="15.9155" fill="transparent"
                                                    stroke={d.color} strokeWidth="3"
                                                    strokeDasharray={dash} strokeDashoffset={-offset}
                                                    className="transition-all duration-500" />
                                            )
                                            offset += pct
                                            return el
                                        })}
                                        <text x="18" y="19" textAnchor="middle" className="text-[5px] font-bold fill-surface-900">
                                            {total}
                                        </text>
                                        <text x="18" y="23" textAnchor="middle" className="text-[3px] fill-surface-400">
                                            total
                                        </text>
                                    </svg>
                                    <div className="space-y-1.5">
                                        {data.map(d => (
                                            <div key={d.key} className="flex items-center gap-2">
                                                <div className="h-2 w-2 rounded-sm" style={{ backgroundColor: d.color }} />
                                                <span className="text-[12px] text-surface-500">{d.label}</span>
                                                <span className="text-[12px] font-semibold text-surface-900 tabular-nums">{d.value}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )
                        })()}
                    </div>
                </div>

                {/* Revenue vs Expenses */}
                <div className="rounded-xl border border-default bg-surface-0 shadow-card">
                    <div className="px-4 py-3 border-b border-subtle">
                        <h3 className="text-[13px] font-semibold text-surface-900">Receita vs Despesa</h3>
                    </div>
                    <div className="p-4">
                        {(() => {
                            const rev = s.revenue_month ?? 0
                            const exp = s.expenses_month ?? 0
                            const max = Math.max(rev, exp, 1)
                            const profit = rev - exp
                            return (
                                <div className="space-y-3">
                                    <div className="flex items-center gap-2.5">
                                        <span className="text-[11px] text-surface-500 w-14">Receita</span>
                                        <div className="flex-1 h-5 bg-surface-100 rounded-sm overflow-hidden">
                                            <div className="h-full bg-emerald-500/80 rounded-sm transition-all duration-500"
                                                style={{ width: `${(rev / max) * 100}%` }} />
                                        </div>
                                        <span className="text-[11px] font-semibold text-emerald-600 w-24 text-right tabular-nums">{fmtBRL(rev)}</span>
                                    </div>
                                    <div className="flex items-center gap-2.5">
                                        <span className="text-[11px] text-surface-500 w-14">Despesa</span>
                                        <div className="flex-1 h-5 bg-surface-100 rounded-sm overflow-hidden">
                                            <div className="h-full bg-red-500/70 rounded-sm transition-all duration-500"
                                                style={{ width: `${(exp / max) * 100}%` }} />
                                        </div>
                                        <span className="text-[11px] font-semibold text-red-600 w-24 text-right tabular-nums">{fmtBRL(exp)}</span>
                                    </div>
                                    <div className="border-t border-subtle pt-2.5 flex items-center justify-between">
                                        <span className="text-[11px] font-medium text-surface-500">Lucro Líquido</span>
                                        <span className={cn('text-base font-bold tabular-nums', profit >= 0 ? 'text-emerald-600' : 'text-red-600')}>
                                            {fmtBRL(profit)}
                                        </span>
                                    </div>
                                </div>
                            )
                        })()}
                    </div>
                </div>
            </div>

            {/* CRM Pipeline Widget */}
            <div className="rounded-xl border border-default bg-surface-0 shadow-card">
                <div className="px-4 py-3 border-b border-subtle">
                    <h3 className="text-[13px] font-semibold text-surface-900">Pipeline CRM</h3>
                </div>
                <div className="p-4 grid grid-cols-2 sm:grid-cols-4 gap-4">
                    {[
                        { label: 'Deals Abertos', value: s.crm_open_deals ?? 0, color: 'bg-sky-500' },
                        { label: 'Ganhos (mês)', value: s.crm_won_month ?? 0, color: 'bg-emerald-500' },
                        { label: 'Receita CRM', value: fmtBRL(s.crm_revenue_month ?? 0), color: 'bg-brand-500' },
                        { label: 'Follow-ups', value: s.crm_pending_followups ?? 0, color: 'bg-amber-500' },
                    ].map((item, i) => (
                        <div key={i} className="text-center">
                            <div className={cn('mx-auto h-1 w-full rounded-sm mb-2', item.color, 'opacity-15')} style={{ position: 'relative' }}>
                                <div className={cn('absolute inset-y-0 left-0 rounded-sm', item.color)} style={{ width: `${Math.min(100, typeof item.value === 'number' ? Math.max(10, item.value * 5) : 60)}%` }} />
                            </div>
                            <p className="text-base font-bold text-surface-900 tabular-nums">{item.value}</p>
                            <p className="text-[10px] text-surface-400 font-medium">{item.label}</p>
                        </div>
                    ))}
                </div>
            </div>

            {/* Financial + SLA cards */}
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <div className="flex items-center gap-3 rounded-xl border border-default bg-surface-0 p-3.5 shadow-card">
                    <TrendingUp className="h-4 w-4 shrink-0 text-emerald-400" />
                    <div className="min-w-0 flex-1">
                        <p className="text-[11px] text-surface-400">A Receber (pendente)</p>
                        <p className="text-[15px] font-semibold text-surface-900 tabular-nums">{isLoading ? '—' : fmtBRL(s.receivables_pending ?? 0)}</p>
                    </div>
                    {(s.receivables_overdue ?? 0) > 0 && (
                        <span className="text-[10px] font-semibold text-red-600 whitespace-nowrap">⚠ {fmtBRL(s.receivables_overdue)} vencido</span>
                    )}
                </div>
                <div className="flex items-center gap-3 rounded-xl border border-default bg-surface-0 p-3.5 shadow-card">
                    <Receipt className="h-4 w-4 shrink-0 text-red-400" />
                    <div className="min-w-0 flex-1">
                        <p className="text-[11px] text-surface-400">A Pagar (pendente)</p>
                        <p className="text-[15px] font-semibold text-surface-900 tabular-nums">{isLoading ? '—' : fmtBRL(s.payables_pending ?? 0)}</p>
                    </div>
                    {(s.payables_overdue ?? 0) > 0 && (
                        <span className="text-[10px] font-semibold text-red-600 whitespace-nowrap">⚠ {fmtBRL(s.payables_overdue)} vencido</span>
                    )}
                </div>
                <div className="flex items-center gap-3 rounded-xl border border-default bg-surface-0 p-3.5 shadow-card">
                    <Clock className="h-4 w-4 shrink-0 text-brand-400" />
                    <div className="min-w-0 flex-1">
                        <p className="text-[11px] text-surface-400">SLA — Tempo Médio OS</p>
                        <p className="text-[15px] font-semibold text-surface-900 tabular-nums">{isLoading ? '—' : `${s.avg_completion_hours ?? 0}h`}</p>
                    </div>
                </div>
            </div>

            {/* Equipment Alerts Widget */}
            {(eqOverdue > 0 || eqDue7 > 0 || eqAlerts.length > 0) && (
                <div className="rounded-xl border border-amber-200/50 bg-amber-50/30 shadow-card">
                    <div className="flex items-center justify-between px-4 py-3 border-b border-amber-200/30">
                        <div className="flex items-center gap-2">
                            <Scale size={14} className="text-amber-600" />
                            <h2 className="text-[13px] font-semibold text-surface-900">Alertas de Calibração</h2>
                        </div>
                        <div className="flex gap-2">
                            {eqOverdue > 0 && (
                                <Badge variant="danger" dot>
                                    {eqOverdue} vencido{eqOverdue > 1 ? 's' : ''}
                                </Badge>
                            )}
                            {eqDue7 > 0 && (
                                <Badge variant="warning" dot>
                                    {eqDue7} vence em 7d
                                </Badge>
                            )}
                        </div>
                    </div>
                    <div className="divide-y divide-amber-200/20">
                        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                        {eqAlerts.map((eq: any) => {
                            const d = new Date(eq.next_calibration_at)
                            const now = new Date()
                            const diff = Math.ceil((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
                            const isPast = diff < 0
                            return (
                                <div key={eq.id} className="flex items-center justify-between px-4 py-2.5">
                                    <div className="flex items-center gap-3">
                                        <span className="font-mono text-[11px] font-medium text-brand-600 tabular-nums">{eq.code}</span>
                                        <span className="text-[13px] text-surface-700">{eq.brand} {eq.model}</span>
                                        {eq.customer && <span className="text-[11px] text-surface-400">• {eq.customer.name}</span>}
                                    </div>
                                    <Badge variant={isPast ? 'danger' : diff <= 7 ? 'warning' : 'info'}>
                                        {isPast ? `Vencido ${Math.abs(diff)}d` : `${diff}d restantes`}
                                    </Badge>
                                </div>
                            )
                        })}
                    </div>
                </div>
            )}

            {/* Recent OS + Top Technicians */}
            <div className="grid gap-3 lg:grid-cols-3">
                {/* Recent OS — dense data table style */}
                <div className="lg:col-span-2 rounded-xl border border-default bg-surface-0 shadow-card">
                    <div className="flex items-center justify-between border-b border-subtle px-4 py-3">
                        <h2 className="text-[13px] font-semibold text-surface-900">Últimas Ordens de Serviço</h2>
                    </div>
                    <div className="divide-y divide-subtle">
                        {isLoading ? (
                            <p className="py-8 text-center text-[13px] text-surface-400">Carregando...</p>
                        ) : recentOs.length === 0 ? (
                            <div className="py-10 text-center">
                                <AlertCircle className="mx-auto h-6 w-6 text-surface-300" />
                                <p className="mt-1.5 text-[13px] text-surface-400">Nenhuma OS encontrada</p>
                            </div>
                        ) : recentOs.map((os: any) => (
                            <div key={os.id} className="flex items-center justify-between px-4 py-2.5 hover:bg-surface-50 transition-colors duration-100 duration-100">
                                <div className="flex items-center gap-3">
                                    <span className="font-mono text-[12px] font-semibold text-brand-600 tabular-nums">{os.number}</span>
                                    <span className="text-[13px] text-surface-700 truncate max-w-[200px]">{os.customer?.name}</span>
                                </div>
                                <div className="flex items-center gap-3">
                                    <span className="text-[12px] text-surface-400">{os.assignee?.name}</span>
                                    <Badge variant={statusConfig[os.status]?.variant ?? 'default'}>
                                        {statusConfig[os.status]?.label ?? os.status}
                                    </Badge>
                                    <span className="text-[12px] font-semibold text-surface-900 tabular-nums">{fmtBRL(parseFloat(os.total ?? '0'))}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Top Technicians */}
                <div className="rounded-xl border border-default bg-surface-0 shadow-card">
                    <div className="border-b border-subtle px-4 py-3">
                        <h2 className="text-[13px] font-semibold text-surface-900">Top Técnicos (mês)</h2>
                    </div>
                    <div className="divide-y divide-subtle">
                        {isLoading ? (
                            <p className="py-8 text-center text-[13px] text-surface-400">Carregando...</p>
                        ) : topTechs.length === 0 ? (
                            <p className="py-8 text-center text-[13px] text-surface-400">Sem dados</p>
                        ) : topTechs.map((t: any, i: number) => (
                            <div key={t.assignee_id} className="flex items-center justify-between px-4 py-2.5">
                                <div className="flex items-center gap-2.5">
                                    <span className={cn('flex h-5 w-5 items-center justify-center rounded text-[10px] font-bold',
                                        i === 0 ? 'bg-amber-100 text-amber-700' : 'bg-surface-100 text-surface-500')}>
                                        {i + 1}
                                    </span>
                                    <span className="text-[13px] font-medium text-surface-800">{t.assignee?.name}</span>
                                </div>
                                <div className="text-right">
                                    <p className="text-[13px] font-semibold text-surface-900 tabular-nums">{t.os_count} OS</p>
                                    <p className="text-[10px] text-surface-400 tabular-nums">{fmtBRL(parseFloat(t.total_revenue ?? '0'))}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    )
}
