import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
    TrendingUp, DollarSign, Target, AlertTriangle,
    ArrowRight, Scale, Handshake, XCircle,
    ArrowUpRight, BarChart3, Clock, MessageCircle, Mail, Send,
    RefreshCw,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { DEAL_STATUS } from '@/lib/constants'
import { Badge } from '@/components/ui/badge'
import { crmApi, type CrmDashboardData } from '@/lib/crm-api'
import { useAuthStore } from '@/stores/auth-store'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'

const fmtBRL = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

type PeriodKey = 'month' | 'quarter' | 'year'

export function CrmDashboardPage() {
    const { hasPermission } = useAuthStore()
    const [period, setPeriod] = useState<PeriodKey>('month')
    const [nowTs] = useState(() => Date.now())

    const { data, isLoading, isError, refetch } = useQuery({
        queryKey: ['crm', 'dashboard', period],
        queryFn: () => crmApi.getDashboard({ period }).then(r => r.data),
        refetchInterval: 60_000,
        meta: { errorMessage: 'Erro ao carregar dashboard CRM' },
    })

    const kpis = data?.kpis
    const prevPeriod = data?.previous_period
    const periodLabel = data?.period?.label ?? (period === 'month' ? 'Este mês' : period === 'quarter' ? 'Este trimestre' : 'Este ano')
    const msgStats = data?.messaging_stats
    const pipelines = data?.pipelines ?? []
    const recentDeals = data?.recent_deals ?? []
    const upcomingActivities = data?.upcoming_activities ?? []
    const topCustomers = data?.top_customers ?? []
    const calibrationAlerts = data?.calibration_alerts ?? []

    const kpiCards: { label: string; value: React.ReactNode; icon: React.ElementType; color: string; href?: string }[] = [
        { label: 'Deals Abertos', value: kpis?.open_deals ?? 0, icon: Target, color: 'text-blue-600 bg-blue-50', href: '/crm/pipeline' },
        { label: `Ganhos (${periodLabel})`, value: kpis?.won_month ?? 0, icon: Handshake, color: 'text-emerald-600 bg-emerald-50', href: '/crm/pipeline' },
        { label: `Perdidos (${periodLabel})`, value: kpis?.lost_month ?? 0, icon: XCircle, color: 'text-red-500 bg-red-50', href: '/crm/pipeline' },
        { label: 'Conversão', value: `${kpis?.conversion_rate ?? 0}%`, icon: TrendingUp, color: 'text-brand-600 bg-brand-50' },
    ]

    const kpiCards2: { label: string; value: React.ReactNode; icon: React.ElementType; color: string; href?: string }[] = [
        { label: 'Receita no Pipeline', value: fmtBRL(kpis?.revenue_in_pipeline ?? 0), icon: DollarSign, color: 'text-emerald-600 bg-emerald-50', href: '/crm/pipeline' },
        { label: `Receita Ganha (${periodLabel})`, value: fmtBRL(kpis?.won_revenue ?? 0), icon: ArrowUpRight, color: 'text-blue-600 bg-blue-50', href: '/crm/pipeline' },
        { label: 'Health Score Médio', value: kpis?.avg_health_score ?? 0, icon: BarChart3, color: 'text-amber-600 bg-amber-50' },
        { label: 'Sem Contato > 90d', value: kpis?.no_contact_90d ?? 0, icon: AlertTriangle, color: 'text-red-500 bg-red-50', href: '/crm/forgotten-clients' },
    ]

    if (isError) {
        return (
            <div className="flex flex-col items-center justify-center py-20 text-center">
                <AlertTriangle className="h-10 w-10 text-red-400 mb-3" />
                <p className="text-sm font-medium text-surface-700">Erro ao carregar o dashboard</p>
                <p className="text-xs text-surface-400 mt-1">Verifique sua conexão e tente novamente</p>
                <button onClick={() => refetch()} className="mt-4 flex items-center gap-2 rounded-lg border border-default px-4 py-2 text-sm font-medium text-surface-700 hover:bg-surface-50">
                    <RefreshCw className="h-4 w-4" /> Tentar novamente
                </button>
            </div>
        )
    }

    return (
        <div className="space-y-5">
            {/* Header */}
            <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                    <h1 className="text-lg font-semibold text-surface-900 tracking-tight">CRM</h1>
                    <p className="mt-0.5 text-sm text-surface-500">Pipeline de vendas e relacionamento com clientes</p>
                </div>
                <div className="flex items-center gap-2">
                    <Select value={period} onValueChange={(v) => setPeriod(v as PeriodKey)}>
                        <SelectTrigger className="w-[180px]">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="month">Este mês</SelectItem>
                            <SelectItem value="quarter">Este trimestre</SelectItem>
                            <SelectItem value="year">Este ano</SelectItem>
                        </SelectContent>
                    </Select>
                    {pipelines.map(p => (
                        <Link
                            key={p.id}
                            to={`/crm/pipeline/${p.id}`}
                            className="flex items-center gap-1.5 rounded-lg border border-default bg-surface-0 px-3 py-2 text-sm font-medium text-surface-700 hover:bg-surface-50 transition-colors duration-100 shadow-card"
                        >
                            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: p.color || '#94a3b8' }} />
                            {p.name}
                            <ArrowRight className="h-3.5 w-3.5 text-surface-400" />
                        </Link>
                    ))}
                </div>
            </div>

            {/* KPI Row 1 */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {kpiCards.map(card => {
                    const content = (
                        <div className="flex items-start justify-between">
                            <div>
                                <p className="text-xs font-medium text-surface-500 uppercase tracking-wider">{card.label}</p>
                                <p className="mt-2 text-lg font-semibold text-surface-900 tracking-tight">{isLoading ? '…' : card.value}</p>
                            </div>
                            <div className={cn('rounded-lg p-2.5', card.color)}>
                                <card.icon className="h-5 w-5" />
                            </div>
                        </div>
                    )
                    const className = "group rounded-xl border border-default bg-surface-0 p-5 shadow-card transition-all duration-200 hover:shadow-elevated hover:-translate-y-0.5"
                    return card.href ? (
                        <Link key={card.label} to={card.href} className={cn(className, 'block')}>
                            {content}
                        </Link>
                    ) : (
                        <div key={card.label} className={className}>{content}</div>
                    )
                })}
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {kpiCards2.map(card => {
                    const content = (
                        <div className="flex items-center gap-3">
                            <div className={cn('rounded-lg p-2.5', card.color)}>
                                <card.icon className="h-5 w-5" />
                            </div>
                            <div>
                                <p className="text-xs text-surface-500">{card.label}</p>
                                <p className="text-sm font-semibold tabular-nums text-surface-900">{isLoading ? '…' : card.value}</p>
                            </div>
                        </div>
                    )
                    const className = "rounded-xl border border-default bg-surface-0 p-4 shadow-card"
                    return card.href ? (
                        <Link key={card.label} to={card.href} className={cn(className, 'block hover:shadow-elevated transition-shadow')}>
                            {content}
                        </Link>
                    ) : (
                        <div key={card.label} className={className}>{content}</div>
                    )
                })}
            </div>

            {/* Pipeline Funnel Summary */}
            {pipelines.length > 0 && (
                <div className="rounded-xl border border-default bg-surface-0 shadow-card">
                    <div className="border-b border-subtle px-5 py-3">
                        <h2 className="text-sm font-semibold text-surface-900">Funil de Vendas</h2>
                    </div>
                    <div className="p-5 space-y-4">
                        {pipelines.map(pipeline => (
                            <div key={pipeline.id}>
                                <div className="flex items-center gap-2 mb-2">
                                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: pipeline.color || '#94a3b8' }} />
                                    <Link to={`/crm/pipeline/${pipeline.id}`} className="text-sm font-medium text-surface-800 hover:text-brand-600 transition-colors">
                                        {pipeline.name}
                                    </Link>
                                </div>
                                <div className="flex gap-1">
                                    {pipeline.stages.filter((s: any) => !s.is_won && !s.is_lost).map((stage: any) => {
                                        const count = stage.deals_count ?? 0
                                        const value = stage.deals_sum_value ?? 0
                                        return (
                                            <div key={stage.id} className="flex-1 group/stage">
                                                <div className="h-8 rounded-md flex items-center justify-center text-xs font-medium text-white relative overflow-hidden"
                                                    style={{ backgroundColor: stage.color || '#94a3b8' }}
                                                    title={`${stage.name}: ${count} deal(s) — ${fmtBRL(value)}`}>
                                                    <span className="relative z-10">{count > 0 ? count : ''}</span>
                                                </div>
                                                <p className="text-xs text-surface-400 mt-1 text-center truncate">{stage.name}</p>
                                            </div>
                                        )
                                    })}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Messaging Stats */}
            <div className="rounded-xl border border-default bg-surface-0 shadow-card">
                <div className="flex items-center justify-between border-b border-subtle px-5 py-3">
                    <h2 className="text-sm font-semibold text-surface-900">Mensageria (mês atual)</h2>
                    <Link to="/crm/templates" className="text-xs font-medium text-brand-600 hover:text-brand-700 flex items-center gap-1">
                        Templates <ArrowRight className="h-3 w-3" />
                    </Link>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 divide-x divide-subtle">
                    {[
                        { label: 'Enviadas', value: msgStats?.sent_month ?? 0, icon: Send, color: 'text-brand-600 bg-brand-50' },
                        { label: 'Recebidas', value: msgStats?.received_month ?? 0, icon: Mail, color: 'text-blue-600 bg-blue-50' },
                        { label: 'WhatsApp', value: msgStats?.whatsapp_sent ?? 0, icon: MessageCircle, color: 'text-green-600 bg-green-50' },
                        { label: 'E-mail', value: msgStats?.email_sent ?? 0, icon: Mail, color: 'text-sky-600 bg-sky-50' },
                        { label: 'Entregues', value: msgStats?.delivered ?? 0, icon: Handshake, color: 'text-emerald-600 bg-emerald-50' },
                        { label: 'Falharam', value: msgStats?.failed ?? 0, icon: XCircle, color: 'text-red-500 bg-red-50' },
                        { label: 'Tx Entrega', value: `${msgStats?.delivery_rate ?? 0}%`, icon: TrendingUp, color: 'text-amber-600 bg-amber-50' },
                    ].map(stat => (
                        <div key={stat.label} className="flex items-center gap-2.5 px-4 py-3">
                            <div className={cn('rounded-lg p-2', stat.color)}>
                                <stat.icon className="h-4 w-4" />
                            </div>
                            <div>
                                <p className="text-xs text-surface-400 uppercase tracking-wider">{stat.label}</p>
                                <p className="text-sm font-semibold tabular-nums text-surface-900">{isLoading ? '…' : stat.value}</p>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-3">
                <div className="lg:col-span-2 rounded-xl border border-default bg-surface-0 shadow-card">
                    <div className="flex items-center justify-between border-b border-subtle px-5 py-3">
                        <h2 className="text-sm font-semibold text-surface-900">Deals Recentes</h2>
                    </div>
                    <div className="divide-y divide-subtle">
                        {isLoading ? (
                            <p className="py-8 text-center text-sm text-surface-400">Carregando…</p>
                        ) : recentDeals.length === 0 ? (
                            <p className="py-8 text-center text-sm text-surface-400">Nenhum deal encontrado</p>
                        ) : recentDeals.map(deal => (
                            <div key={deal.id} className="flex items-center justify-between px-5 py-3 hover:bg-surface-50 transition-colors duration-100">
                                <div className="flex items-center gap-3 min-w-0">
                                    <div className="h-2 w-2 rounded-full shrink-0"
                                        style={{ backgroundColor: deal.stage?.color || '#94a3b8' }} />
                                    <div className="min-w-0">
                                        <p className="text-sm font-medium text-surface-800 truncate">{deal.title}</p>
                                        <p className="text-xs text-surface-400 truncate">{deal.customer?.name}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3 shrink-0">
                                    <Badge variant={deal.status === DEAL_STATUS.WON ? 'success' : deal.status === DEAL_STATUS.LOST ? 'danger' : 'info'}>
                                        {deal.stage?.name ?? deal.status}
                                    </Badge>
                                    <span className="text-sm font-bold text-surface-900">{fmtBRL(deal.value)}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="rounded-xl border border-default bg-surface-0 shadow-card">
                    <div className="border-b border-subtle px-5 py-3">
                        <h2 className="text-sm font-semibold text-surface-900">Próximas Atividades</h2>
                    </div>
                    <div className="divide-y divide-subtle">
                        {isLoading ? (
                            <p className="py-8 text-center text-sm text-surface-400">Carregando…</p>
                        ) : upcomingActivities.length === 0 ? (
                            <p className="py-8 text-center text-sm text-surface-400">Nenhuma atividade agendada</p>
                        ) : upcomingActivities.map(act => (
                            <div key={act.id} className="px-5 py-3 hover:bg-surface-50 transition-colors duration-100">
                                <p className="text-sm font-medium text-surface-800">{act.title}</p>
                                <div className="flex items-center gap-2 mt-1 text-xs text-surface-400">
                                    <Clock className="h-3 w-3" />
                                    {act.scheduled_at && new Date(act.scheduled_at).toLocaleDateString('pt-BR', {
                                        day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'
                                    })}
                                    {act.customer?.name && <span>• {act.customer.name}</span>}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
                <div className="rounded-xl border border-default bg-surface-0 shadow-card">
                    <div className="border-b border-subtle px-5 py-3">
                        <h2 className="text-sm font-semibold text-surface-900">Top Clientes (receita ganha)</h2>
                    </div>
                    <div className="divide-y divide-subtle">
                        {isLoading ? (
                            <p className="py-8 text-center text-sm text-surface-400">Carregando…</p>
                        ) : topCustomers.length === 0 ? (
                            <p className="py-8 text-center text-sm text-surface-400">Sem dados</p>
                        ) : topCustomers.map((row: any, i: number) => (
                            <div key={row.customer_id} className="flex items-center justify-between px-5 py-3">
                                <div className="flex items-center gap-3">
                                    <span className={cn('flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold',
                                        i === 0 ? 'bg-amber-100 text-amber-700' : 'bg-surface-100 text-surface-600')}>
                                        {i + 1}
                                    </span>
                                    <span className="text-sm font-medium text-surface-800">{row.customer?.name}</span>
                                </div>
                                <div className="text-right">
                                    <p className="text-sm font-bold text-surface-900">{fmtBRL(parseFloat(row.total_value))}</p>
                                    <p className="text-xs text-surface-400">{row.deal_count} deal(s)</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {calibrationAlerts.length > 0 && (
                    <div className="rounded-xl border border-amber-200 bg-amber-50/50 shadow-card">
                        <div className="flex items-center gap-2 border-b border-amber-200 px-5 py-3">
                            <Scale className="h-4 w-4 text-amber-600" />
                            <h2 className="text-sm font-semibold text-surface-900">Calibrações Vencendo (oportunidade)</h2>
                        </div>
                        <div className="divide-y divide-amber-100">
                            {calibrationAlerts.map((eq: any) => {
                                const d = new Date(eq.next_calibration_at)
                                const diff = Math.ceil((d.getTime() - nowTs) / (1000 * 60 * 60 * 24))
                                const isPast = diff < 0
                                return (
                                    <div key={eq.id} className="flex items-center justify-between px-5 py-2.5">
                                        <div className="flex items-center gap-3">
                                            <span className="font-mono text-xs font-medium text-brand-600">{eq.code}</span>
                                            <span className="text-sm text-surface-700">{eq.brand} {eq.model}</span>
                                            {eq.customer && <span className="text-xs text-surface-400">• {eq.customer.name}</span>}
                                        </div>
                                        <span className={cn('rounded-full px-2.5 py-0.5 text-xs font-semibold',
                                            isPast ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700')}>
                                            {isPast ? `Vencido ${Math.abs(diff)}d` : `${diff}d restantes`}
                                        </span>
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}
