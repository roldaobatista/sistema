import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import {
    FileText, DollarSign, TrendingUp, TrendingDown, ArrowUpRight, ArrowDownRight,
    Clock, CheckCircle2, Wallet, Receipt, AlertCircle, Scale, AlertTriangle, Package,
    Plus, Search, Users, Rocket, Bell, Star, MessageSquare,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/stores/auth-store'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/ui/emptystate'
import { getStatusEntry, workOrderStatus } from '@/lib/status-config'
import api from '@/lib/api'

const fmtBRL = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

function TrendBadge({ current, previous, invert = false }: {
    current: number
    previous: number
    invert?: boolean
}) {
    if (previous === 0 && current === 0) return null
    const pct = previous === 0 ? 100 : Math.round(((current - previous) / previous) * 100)
    if (pct === 0) return null

    const isPositive = invert ? pct < 0 : pct > 0
    const Icon = pct > 0 ? ArrowUpRight : ArrowDownRight

    return (
        <span className={cn(
            'inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-xs font-semibold tabular-nums',
            isPositive ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'
        )}>
            <Icon className="h-3 w-3" />
            {Math.abs(pct)}%
        </span>
    )
}

function KpiSkeleton() {
    return (
        <div className="rounded-xl border border-default bg-surface-0 p-5 animate-pulse">
            <div className="flex items-center justify-between mb-4">
                <div className="h-3 w-20 rounded bg-surface-200" />
                <div className="h-4 w-4 rounded bg-surface-200" />
            </div>
            <div className="h-7 w-24 rounded bg-surface-200" />
            <div className="h-3 w-16 rounded bg-surface-200 mt-2" />
        </div>
    )
}

function ChartSkeleton() {
    return (
        <div className="rounded-xl border border-default bg-surface-0 animate-pulse">
            <div className="px-5 py-4 border-b border-subtle">
                <div className="h-4 w-32 rounded bg-surface-200" />
            </div>
            <div className="p-5 h-40 flex items-end gap-2">
                {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="flex-1 rounded-sm bg-surface-100" style={{ height: `${30 + Math.random() * 60}%` }} />
                ))}
            </div>
        </div>
    )
}

export function DashboardPage() {
    const { hasPermission, user } = useAuthStore()
    const navigate = useNavigate()

    const { data: statsRes, isLoading, isError } = useQuery({
        queryKey: ['dashboard-stats'],
        queryFn: () => api.get('/dashboard-stats'),
        refetchInterval: 60_000,
    })

    const { data: alertsRes } = useQuery({
        queryKey: ['dashboard-alerts-summary'],
        queryFn: () => api.get('/alerts/summary').then(r => r.data).catch(() => null),
        refetchInterval: 120_000,
    })

    const { data: npsRes } = useQuery({
        queryKey: ['dashboard-nps'],
        queryFn: () => api.get('/dashboard-nps').then(r => r.data).catch(() => null),
        refetchInterval: 300_000,
    })

    const s = statsRes?.data ?? {}
    const recentOs = s.recent_os ?? []
    const topTechs = s.top_technicians ?? []
    const eqAlerts = s.eq_alerts ?? []
    const eqOverdue = s.eq_overdue ?? 0
    const eqDue7 = s.eq_due_7 ?? 0
    const isEmpty = !isLoading && (s.open_os ?? 0) === 0 && (s.completed_month ?? 0) === 0 && (s.revenue_month ?? 0) === 0

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-heading text-surface-900">Dashboard</h1>
                    <p className="mt-0.5 text-sm text-surface-500">
                        Olá, {user?.name ?? 'Usuário'}. Aqui está o resumo do dia.
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => navigate('/os/nova')}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3.5 py-2 text-sm font-medium text-white hover:bg-brand-500 transition-colors"
                    >
                        <Plus className="h-4 w-4" /> Nova OS
                    </button>
                    <button
                        onClick={() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true }))}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-default bg-surface-0 px-3 py-2 text-sm font-medium text-surface-600 hover:bg-surface-50 transition-colors"
                    >
                        <Search className="h-4 w-4" />
                        <span className="hidden sm:inline">Buscar</span>
                        <kbd className="ml-1 hidden rounded border border-surface-200 bg-surface-100 px-1.5 py-0.5 text-xs font-mono text-surface-400 sm:inline">
                            Ctrl+K
                        </kbd>
                    </button>
                </div>
            </div>

            {isEmpty && (
                <div className="rounded-xl border-2 border-dashed border-surface-200 bg-surface-50/50 p-10 text-center animate-fade-in">
                    <Rocket className="mx-auto h-10 w-10 text-brand-400 mb-3" />
                    <h2 className="text-subtitle text-surface-900">Bem-vindo ao Kalibrium!</h2>
                    <p className="mt-1 text-sm text-surface-500 max-w-md mx-auto">
                        Comece cadastrando seus clientes e criando sua primeira ordem de serviço.
                    </p>
                    <div className="mt-5 flex justify-center gap-3">
                        <button
                            onClick={() => navigate('/cadastros/clientes/novo')}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-surface-100 px-4 py-2.5 text-sm font-medium text-surface-700 hover:bg-surface-200 transition-colors"
                        >
                            <Users className="h-4 w-4" /> Cadastrar Cliente
                        </button>
                        <button
                            onClick={() => navigate('/os/nova')}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-500 transition-colors"
                        >
                            <Plus className="h-4 w-4" /> Criar OS
                        </button>
                    </div>
                </div>
            )}

            {isLoading ? (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    {Array.from({ length: 4 }).map((_, i) => <KpiSkeleton key={i} />)}
                </div>
            ) : (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <div className="sm:col-span-2 rounded-xl border border-brand-200/50 bg-gradient-to-br from-brand-50 to-surface-0 p-5 shadow-card animate-fade-in">
                        <div className="flex items-center justify-between mb-1">
                            <span className="text-label text-brand-600/70">Faturamento do Mês</span>
                            <DollarSign className="h-5 w-5 text-brand-400" />
                        </div>
                        <div className="flex items-end gap-3">
                            <p className="text-display-lg text-surface-900">
                                {fmtBRL(s.revenue_month ?? 0)}
                            </p>
                            <TrendBadge
                                current={s.revenue_month ?? 0}
                                previous={s.prev_revenue_month ?? s.revenue_month ?? 0}
                            />
                        </div>
                        <div className="mt-3 flex items-center gap-4 text-xs text-surface-500">
                            <span>Receita: <strong className="text-emerald-600">{fmtBRL(s.revenue_month ?? 0)}</strong></span>
                            <span>Despesa: <strong className="text-red-600">{fmtBRL(s.expenses_month ?? 0)}</strong></span>
                        </div>
                    </div>

                    <div className="rounded-xl border border-default bg-surface-0 p-5 shadow-card animate-fade-in stagger-1">
                        <div className="flex items-center justify-between mb-1">
                            <span className="text-label text-surface-400">OS Abertas</span>
                            <FileText className="h-4 w-4 text-surface-300" />
                        </div>
                        <div className="flex items-end gap-2">
                            <p className="text-display text-surface-900">{s.open_os ?? 0}</p>
                            <TrendBadge current={s.open_os ?? 0} previous={s.prev_open_os ?? s.open_os ?? 0} invert />
                        </div>
                        <div className="mt-3 flex gap-0.5">
                            <div className="h-1 flex-[3] rounded-l-full bg-emerald-400/60" />
                            <div className="h-1 flex-[1] bg-amber-400/60" />
                            <div className="h-1 flex-[1] rounded-r-full bg-red-400/60" />
                        </div>
                    </div>

                    <div className="rounded-xl border border-default bg-surface-0 p-5 shadow-card animate-fade-in stagger-2">
                        <div className="flex items-center justify-between mb-1">
                            <span className="text-label text-surface-400">Concluídas</span>
                            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                        </div>
                        <div className="flex items-end gap-2">
                            <p className="text-display text-surface-900">{s.completed_month ?? 0}</p>
                            <TrendBadge current={s.completed_month ?? 0} previous={s.prev_completed_month ?? s.completed_month ?? 0} />
                        </div>
                        <p className="mt-2 text-xs text-surface-400">este mês</p>
                    </div>
                </div>
            )}

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {[
                    { label: 'Em Andamento', value: s.in_progress_os ?? 0, icon: Clock, color: 'text-amber-500' },
                    { label: 'Comissões Pendentes', value: fmtBRL(s.pending_commissions ?? 0), icon: Wallet, color: 'text-sky-500' },
                    { label: 'Estoque Baixo', value: s.stock_low ?? 0, icon: Package, color: 'text-amber-500' },
                    { label: 'SLA Estourado', value: (s.sla_response_breached ?? 0) + (s.sla_resolution_breached ?? 0), icon: AlertTriangle, color: 'text-red-500' },
                ].map((stat, i) => (
                    <div key={stat.label} className={cn(
                        'flex items-center gap-3 rounded-lg border border-subtle bg-surface-0 px-4 py-3 animate-fade-in',
                        `stagger-${i + 3}`
                    )}>
                        <stat.icon className={cn('h-4 w-4 shrink-0', stat.color)} />
                        <div className="min-w-0 flex-1">
                            <p className="text-xs text-surface-400 truncate">{stat.label}</p>
                            <p className="text-sm font-semibold text-surface-900 tabular-nums">{isLoading ? '—' : stat.value}</p>
                        </div>
                    </div>
                ))}
            </div>

            {/* ─── Widgets de Alertas + NPS ─── */}
            <div className="grid gap-4 lg:grid-cols-2">
                {/* Alertas Ativos */}
                {alertsRes?.data && (
                    <div className="rounded-xl border border-default bg-surface-0 shadow-card animate-fade-in">
                        <div className="flex items-center justify-between px-5 py-3 border-b border-subtle">
                            <h3 className="flex items-center gap-2 text-sm font-semibold text-surface-900">
                                <Bell className="h-4 w-4 text-amber-500" /> Alertas do Sistema
                            </h3>
                            <button onClick={() => navigate('/alertas')} className="text-xs text-brand-600 hover:underline">
                                Ver todos
                            </button>
                        </div>
                        <div className="p-4">
                            <div className="grid grid-cols-3 gap-3 text-center">
                                <div className="rounded-lg bg-red-50 p-3 dark:bg-red-900/20">
                                    <div className="text-xl font-bold text-red-600">{alertsRes.data.critical ?? 0}</div>
                                    <div className="text-xs text-red-500">Críticos</div>
                                </div>
                                <div className="rounded-lg bg-amber-50 p-3 dark:bg-amber-900/20">
                                    <div className="text-xl font-bold text-amber-600">{alertsRes.data.high ?? 0}</div>
                                    <div className="text-xs text-amber-500">Alta</div>
                                </div>
                                <div className="rounded-lg bg-blue-50 p-3 dark:bg-blue-900/20">
                                    <div className="text-xl font-bold text-blue-600">{alertsRes.data.total_active ?? 0}</div>
                                    <div className="text-xs text-blue-500">Total Ativos</div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* NPS Score */}
                {npsRes?.data && (
                    <div className="rounded-xl border border-default bg-surface-0 shadow-card animate-fade-in">
                        <div className="flex items-center justify-between px-5 py-3 border-b border-subtle">
                            <h3 className="flex items-center gap-2 text-sm font-semibold text-surface-900">
                                <Star className="h-4 w-4 text-amber-400" /> Satisfação do Cliente
                            </h3>
                        </div>
                        <div className="p-4">
                            <div className="grid grid-cols-3 gap-3 text-center">
                                <div className="rounded-lg bg-surface-50 p-3">
                                    <div className="text-xl font-bold text-surface-900">{npsRes.data.nps_score ?? '—'}</div>
                                    <div className="text-xs text-surface-500">NPS Score</div>
                                </div>
                                <div className="rounded-lg bg-emerald-50 p-3 dark:bg-emerald-900/20">
                                    <div className="text-xl font-bold text-emerald-600">{npsRes.data.promoters ?? 0}%</div>
                                    <div className="text-xs text-emerald-500">Promotores</div>
                                </div>
                                <div className="rounded-lg bg-surface-50 p-3">
                                    <div className="text-xl font-bold text-surface-900">{npsRes.data.total_responses ?? 0}</div>
                                    <div className="text-xs text-surface-500">Respostas</div>
                                </div>
                            </div>
                            {npsRes.data.avg_rating && (
                                <div className="mt-3 flex items-center justify-center gap-1">
                                    {[1, 2, 3, 4, 5].map(i => (
                                        <Star key={i} className={cn(
                                            'h-4 w-4',
                                            i <= Math.round(npsRes.data.avg_rating)
                                                ? 'fill-amber-400 text-amber-400'
                                                : 'text-surface-200'
                                        )} />
                                    ))}
                                    <span className="ml-1 text-sm font-semibold text-surface-700">
                                        {Number(npsRes.data.avg_rating).toFixed(1)}
                                    </span>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {isLoading ? (
                <div className="grid gap-4 lg:grid-cols-3">
                    {Array.from({ length: 3 }).map((_, i) => <ChartSkeleton key={i} />)}
                </div>
            ) : (
                <div className="grid gap-4 lg:grid-cols-3">
                    <div className="rounded-xl border border-default bg-surface-0 shadow-card animate-fade-in">
                        <div className="px-5 py-4 border-b border-subtle">
                            <h3 className="text-sm font-semibold text-surface-900">Faturamento Mensal</h3>
                        </div>
                        <div className="p-5">
                            {(() => {
                                const monthly: { month: string; total: number }[] = s.monthly_revenue ?? []
                                const max = Math.max(...monthly.map(m => m.total), 1)
                                return monthly.length > 0 ? (
                                    <div className="flex items-end gap-2 h-36">
                                        {monthly.map((m, i) => (
                                            <div key={i} className="flex-1 flex flex-col items-center gap-1">
                                                <span className="text-xs text-surface-400 font-medium tabular-nums">
                                                    {fmtBRL(m.total).replace('R$\u00a0', '')}
                                                </span>
                                                <div
                                                    className="w-full rounded-t bg-brand-500/80 transition-all duration-700 ease-out"
                                                    style={{ height: `${Math.max((m.total / max) * 100, 4)}%`, minHeight: 4 }}
                                                />
                                                <span className="text-xs text-surface-400">{m.month}</span>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="text-center text-sm text-surface-400 py-8">Sem dados</p>
                                )
                            })()}
                        </div>
                    </div>

                    <div className="rounded-xl border border-default bg-surface-0 shadow-card animate-fade-in stagger-1">
                        <div className="px-5 py-4 border-b border-subtle">
                            <h3 className="text-sm font-semibold text-surface-900">OS por Status</h3>
                        </div>
                        <div className="p-5">
                            {(() => {
                                const data = [
                                    { key: 'open', label: 'Abertas', value: s.open_os ?? 0, color: 'oklch(0.55 0.18 245)' },
                                    { key: 'in_progress', label: 'Em Andamento', value: s.in_progress_os ?? 0, color: 'oklch(0.75 0.15 75)' },
                                    { key: 'completed', label: 'Concluídas', value: s.completed_month ?? 0, color: 'oklch(0.60 0.17 145)' },
                                ]
                                const total = data.reduce((a, d) => a + d.value, 0) || 1
                                let offset = 0
                                return (
                                    <div className="flex items-center gap-6">
                                        <svg viewBox="0 0 36 36" className="h-24 w-24 flex-shrink-0">
                                            {data.map(d => {
                                                const pct = (d.value / total) * 100
                                                const dash = `${pct} ${100 - pct}`
                                                const el = (
                                                    <circle key={d.key} cx="18" cy="18" r="15.9155" fill="transparent"
                                                        stroke={d.color} strokeWidth="3"
                                                        strokeDasharray={dash} strokeDashoffset={-offset}
                                                        className="transition-all duration-700" />
                                                )
                                                offset += pct
                                                return el
                                            })}
                                            <text x="18" y="19" textAnchor="middle" className="text-[5px] font-bold fill-surface-900">{total}</text>
                                            <text x="18" y="23" textAnchor="middle" className="text-[3px] fill-surface-400">total</text>
                                        </svg>
                                        <div className="space-y-2">
                                            {data.map(d => (
                                                <div key={d.key} className="flex items-center gap-2">
                                                    <div className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: d.color }} />
                                                    <span className="text-xs text-surface-500">{d.label}</span>
                                                    <span className="text-xs font-semibold text-surface-900 tabular-nums">{d.value}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )
                            })()}
                        </div>
                    </div>

                    <div className="rounded-xl border border-default bg-surface-0 shadow-card animate-fade-in stagger-2">
                        <div className="px-5 py-4 border-b border-subtle">
                            <h3 className="text-sm font-semibold text-surface-900">Receita vs Despesa</h3>
                        </div>
                        <div className="p-5">
                            {(() => {
                                const rev = s.revenue_month ?? 0
                                const exp = s.expenses_month ?? 0
                                const max = Math.max(rev, exp, 1)
                                const profit = rev - exp
                                return (
                                    <div className="space-y-4">
                                        <div className="flex items-center gap-3">
                                            <span className="text-xs text-surface-500 w-16">Receita</span>
                                            <div className="flex-1 h-5 bg-surface-100 rounded overflow-hidden">
                                                <div className="h-full bg-emerald-500/80 rounded transition-all duration-700"
                                                    style={{ width: `${(rev / max) * 100}%` }} />
                                            </div>
                                            <span className="text-xs font-semibold text-emerald-600 w-24 text-right tabular-nums">{fmtBRL(rev)}</span>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <span className="text-xs text-surface-500 w-16">Despesa</span>
                                            <div className="flex-1 h-5 bg-surface-100 rounded overflow-hidden">
                                                <div className="h-full bg-red-500/70 rounded transition-all duration-700"
                                                    style={{ width: `${(exp / max) * 100}%` }} />
                                            </div>
                                            <span className="text-xs font-semibold text-red-600 w-24 text-right tabular-nums">{fmtBRL(exp)}</span>
                                        </div>
                                        <div className="border-t border-subtle pt-3 flex items-center justify-between">
                                            <span className="text-xs font-medium text-surface-500">Lucro Líquido</span>
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
            )}

            <div className="grid gap-4 sm:grid-cols-3">
                <div className="flex items-center gap-3 rounded-xl border border-default bg-surface-0 p-4 shadow-card">
                    <TrendingUp className="h-4 w-4 shrink-0 text-emerald-400" />
                    <div className="min-w-0 flex-1">
                        <p className="text-xs text-surface-400">A Receber (pendente)</p>
                        <p className="text-sm font-semibold text-surface-900 tabular-nums">{isLoading ? '—' : fmtBRL(s.receivables_pending ?? 0)}</p>
                    </div>
                    {(s.receivables_overdue ?? 0) > 0 && (
                        <Badge variant="danger" size="xs">{fmtBRL(s.receivables_overdue)} vencido</Badge>
                    )}
                </div>
                <div className="flex items-center gap-3 rounded-xl border border-default bg-surface-0 p-4 shadow-card">
                    <Receipt className="h-4 w-4 shrink-0 text-red-400" />
                    <div className="min-w-0 flex-1">
                        <p className="text-xs text-surface-400">A Pagar (pendente)</p>
                        <p className="text-sm font-semibold text-surface-900 tabular-nums">{isLoading ? '—' : fmtBRL(s.payables_pending ?? 0)}</p>
                    </div>
                    {(s.payables_overdue ?? 0) > 0 && (
                        <Badge variant="danger" size="xs">{fmtBRL(s.payables_overdue)} vencido</Badge>
                    )}
                </div>
                <div className="flex items-center gap-3 rounded-xl border border-default bg-surface-0 p-4 shadow-card">
                    <Clock className="h-4 w-4 shrink-0 text-brand-400" />
                    <div className="min-w-0 flex-1">
                        <p className="text-xs text-surface-400">SLA — Tempo Médio OS</p>
                        <p className="text-sm font-semibold text-surface-900 tabular-nums">{isLoading ? '—' : `${s.avg_completion_hours ?? 0}h`}</p>
                    </div>
                </div>
            </div>

            {(eqOverdue > 0 || eqDue7 > 0 || eqAlerts.length > 0) && (
                <div className="rounded-xl border border-amber-200/50 bg-amber-50/30 shadow-card animate-fade-in">
                    <div className="flex items-center justify-between px-5 py-4 border-b border-amber-200/30">
                        <div className="flex items-center gap-2">
                            <Scale size={14} className="text-amber-600" />
                            <h2 className="text-sm font-semibold text-surface-900">Alertas de Calibração</h2>
                        </div>
                        <div className="flex gap-2">
                            {eqOverdue > 0 && <Badge variant="danger" dot>{eqOverdue} vencido{eqOverdue > 1 ? 's' : ''}</Badge>}
                            {eqDue7 > 0 && <Badge variant="warning" dot>{eqDue7} vence em 7d</Badge>}
                        </div>
                    </div>
                    <div className="divide-y divide-amber-200/20">
                        {eqAlerts.map((eq: any) => {
                            const d = new Date(eq.next_calibration_at)
                            const now = new Date()
                            const diff = Math.ceil((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
                            const isPast = diff < 0
                            return (
                                <div key={eq.id} className="flex items-center justify-between px-5 py-3">
                                    <div className="flex items-center gap-3">
                                        <span className="font-mono text-xs font-medium text-brand-600 tabular-nums">{eq.code}</span>
                                        <span className="text-sm text-surface-700">{eq.brand} {eq.model}</span>
                                        {eq.customer && <span className="text-xs text-surface-400">· {eq.customer.name}</span>}
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

            <div className="grid gap-4 lg:grid-cols-3">
                <div className="lg:col-span-2 rounded-xl border border-default bg-surface-0 shadow-card animate-fade-in">
                    <div className="flex items-center justify-between border-b border-subtle px-5 py-4">
                        <h2 className="text-sm font-semibold text-surface-900">Últimas Ordens de Serviço</h2>
                    </div>
                    <div className="divide-y divide-subtle">
                        {isLoading ? (
                            Array.from({ length: 5 }).map((_, i) => (
                                <div key={i} className="flex items-center gap-4 px-5 py-3 animate-pulse">
                                    <div className="h-4 w-16 rounded bg-surface-200" />
                                    <div className="h-4 w-32 rounded bg-surface-100" />
                                    <div className="flex-1" />
                                    <div className="h-5 w-20 rounded-full bg-surface-100" />
                                </div>
                            ))
                        ) : recentOs.length === 0 ? (
                            <EmptyState icon={AlertCircle} title="Nenhuma OS encontrada" compact />
                        ) : recentOs.map((os: any) => {
                            const st = getStatusEntry(workOrderStatus, os.status)
                            return (
                                <div
                                    key={os.id}
                                    className="flex items-center justify-between px-5 py-3 hover:bg-surface-50 transition-colors cursor-pointer"
                                    onClick={() => navigate(`/os/${os.id}`)}
                                >
                                    <div className="flex items-center gap-3 min-w-0">
                                        <span className="font-mono text-xs font-semibold text-brand-600 tabular-nums">{os.number}</span>
                                        <span className="text-sm text-surface-700 truncate max-w-[200px]">{os.customer?.name}</span>
                                    </div>
                                    <div className="flex items-center gap-3 shrink-0">
                                        <span className="text-xs text-surface-400 hidden sm:block">{os.assignee?.name}</span>
                                        <Badge variant={st.variant}>{st.label}</Badge>
                                        <span className="text-xs font-semibold text-surface-900 tabular-nums">{fmtBRL(parseFloat(os.total ?? '0'))}</span>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                </div>

                <div className="rounded-xl border border-default bg-surface-0 shadow-card animate-fade-in stagger-1">
                    <div className="border-b border-subtle px-5 py-4">
                        <h2 className="text-sm font-semibold text-surface-900">Top Técnicos (mês)</h2>
                    </div>
                    <div className="divide-y divide-subtle">
                        {isLoading ? (
                            Array.from({ length: 3 }).map((_, i) => (
                                <div key={i} className="flex items-center gap-3 px-5 py-3 animate-pulse">
                                    <div className="h-5 w-5 rounded bg-surface-200" />
                                    <div className="h-4 w-24 rounded bg-surface-100" />
                                </div>
                            ))
                        ) : topTechs.length === 0 ? (
                            <EmptyState title="Sem dados" compact />
                        ) : topTechs.map((t: any, i: number) => (
                            <div key={t.assignee_id} className="flex items-center justify-between px-5 py-3">
                                <div className="flex items-center gap-2.5">
                                    <span className={cn('flex h-5 w-5 items-center justify-center rounded text-xs font-bold',
                                        i === 0 ? 'bg-amber-100 text-amber-700' : 'bg-surface-100 text-surface-500')}>
                                        {i + 1}
                                    </span>
                                    <span className="text-sm font-medium text-surface-800">{t.assignee?.name}</span>
                                </div>
                                <div className="text-right">
                                    <p className="text-sm font-semibold text-surface-900 tabular-nums">{t.os_count} OS</p>
                                    <p className="text-xs text-surface-400 tabular-nums">{fmtBRL(parseFloat(t.total_revenue ?? '0'))}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    )
}
