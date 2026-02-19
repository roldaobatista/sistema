import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
    TrendingUp, TrendingDown, DollarSign, Target, AlertTriangle,
    ArrowRight, Scale, Handshake, XCircle,
    ArrowUpRight, BarChart3, Clock, MessageCircle, Mail, Send,
    RefreshCw, Minus,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import {
    BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, CartesianGrid,
    FunnelChart, Funnel, LabelList,
} from 'recharts'
import { cn, formatCurrency } from '@/lib/utils'
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

type PeriodKey = 'month' | 'quarter' | 'year'

function ChangeIndicator({ current, previous, isCurrency = false }: { current: number; previous: number; isCurrency?: boolean }) {
    if (previous === 0 && current === 0) return null
    const diff = current - previous
    const pct = previous > 0 ? Math.round((diff / previous) * 100) : (current > 0 ? 100 : 0)

    if (diff === 0) {
        return (
            <span className="flex items-center gap-0.5 text-[10px] font-medium text-surface-400">
                <Minus className="h-3 w-3" /> 0%
            </span>
        )
    }

    const isPositive = diff > 0
    return (
        <span className={cn(
            'flex items-center gap-0.5 text-[10px] font-semibold',
            isPositive ? 'text-emerald-600' : 'text-red-500',
        )}>
            {isPositive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
            {isPositive ? '+' : ''}{pct}%
        </span>
    )
}

const FUNNEL_COLORS = [
    '#3b82f6', '#6366f1', '#8b5cf6', '#a855f7',
    '#d946ef', '#ec4899', '#f43f5e', '#ef4444',
]

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

    // Funnel data for chart
    const funnelData = useMemo(() => {
        if (pipelines.length === 0) return []
        const mainPipeline = pipelines[0]
        return (mainPipeline.stages ?? [])
            .filter((s: any) => !s.is_won && !s.is_lost)
            .map((stage: any, i: number) => ({
                name: stage.name,
                value: stage.deals_count ?? 0,
                revenue: stage.deals_sum_value ?? 0,
                fill: stage.color || FUNNEL_COLORS[i % FUNNEL_COLORS.length],
            }))
    }, [pipelines])

    // Top customers chart data
    const topCustomersChartData = useMemo(() =>
        topCustomers.slice(0, 8).map((row: any) => ({
            name: (row.customer?.name ?? '').length > 15
                ? (row.customer?.name ?? '').slice(0, 15) + '…'
                : (row.customer?.name ?? ''),
            value: parseFloat(row.total_value) || 0,
            deals: row.deal_count,
            fullName: row.customer?.name ?? '',
        })),
        [topCustomers],
    )

    const kpiCards: { label: string; value: React.ReactNode; icon: React.ElementType; color: string; href?: string; change?: React.ReactNode }[] = [
        {
            label: 'Deals Abertos', value: kpis?.open_deals ?? 0,
            icon: Target, color: 'text-blue-600 bg-blue-50', href: '/crm/pipeline',
        },
        {
            label: `Ganhos (${periodLabel})`, value: kpis?.won_month ?? 0,
            icon: Handshake, color: 'text-emerald-600 bg-emerald-50', href: '/crm/pipeline',
            change: prevPeriod ? <ChangeIndicator current={kpis?.won_month ?? 0} previous={prevPeriod.won_month ?? 0} /> : null,
        },
        {
            label: `Perdidos (${periodLabel})`, value: kpis?.lost_month ?? 0,
            icon: XCircle, color: 'text-red-500 bg-red-50', href: '/crm/pipeline',
            change: prevPeriod ? <ChangeIndicator current={kpis?.lost_month ?? 0} previous={prevPeriod.lost_month ?? 0} /> : null,
        },
        {
            label: 'Conversão', value: `${kpis?.conversion_rate ?? 0}%`,
            icon: TrendingUp, color: 'text-brand-600 bg-brand-50',
        },
    ]

    const kpiCards2: { label: string; value: React.ReactNode; icon: React.ElementType; color: string; href?: string; change?: React.ReactNode }[] = [
        {
            label: 'Receita no Pipeline', value: formatCurrency(kpis?.revenue_in_pipeline ?? 0),
            icon: DollarSign, color: 'text-emerald-600 bg-emerald-50', href: '/crm/pipeline',
        },
        {
            label: `Receita Ganha (${periodLabel})`, value: formatCurrency(kpis?.won_revenue ?? 0),
            icon: ArrowUpRight, color: 'text-blue-600 bg-blue-50', href: '/crm/pipeline',
            change: prevPeriod ? <ChangeIndicator current={kpis?.won_revenue ?? 0} previous={prevPeriod.won_revenue ?? 0} isCurrency /> : null,
        },
        {
            label: 'Health Score Médio', value: kpis?.avg_health_score ?? 0,
            icon: BarChart3, color: 'text-amber-600 bg-amber-50',
        },
        {
            label: 'Sem Contato > 90d', value: kpis?.no_contact_90d ?? 0,
            icon: AlertTriangle, color: 'text-red-500 bg-red-50', href: '/crm/forgotten-clients',
        },
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
                    {pipelines.map((p: any) => (
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
                                {card.change && <div className="mt-1">{card.change}</div>}
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
                                {card.change && <div className="mt-0.5">{card.change}</div>}
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

            {/* Funnel Chart + Pipeline Breakdown */}
            {pipelines.length > 0 && (
                <div className="grid gap-4 lg:grid-cols-2">
                    {/* Interactive Funnel Chart */}
                    <div className="rounded-xl border border-default bg-surface-0 shadow-card">
                        <div className="border-b border-subtle px-5 py-3">
                            <h2 className="text-sm font-semibold text-surface-900">Funil de Vendas</h2>
                        </div>
                        <div className="p-4">
                            {funnelData.length > 0 ? (
                                <ResponsiveContainer width="100%" height={300}>
                                    <BarChart data={funnelData} layout="vertical" margin={{ left: 0, right: 20, top: 5, bottom: 5 }}>
                                        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--color-border-subtle, #e5e7eb)" />
                                        <XAxis type="number" tick={{ fontSize: 11, fill: 'var(--color-text-muted, #9ca3af)' }} />
                                        <YAxis
                                            type="category"
                                            dataKey="name"
                                            width={100}
                                            tick={{ fontSize: 11, fill: 'var(--color-text-secondary, #6b7280)' }}
                                        />
                                        <Tooltip
                                            contentStyle={{
                                                borderRadius: 8,
                                                border: '1px solid var(--color-border-default, #e5e7eb)',
                                                boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                                                fontSize: 12,
                                            }}
                                            formatter={(value: number, name: string, props: any) => [
                                                `${value} deal(s) — ${formatCurrency(props.payload.revenue)}`,
                                                'Quantidade',
                                            ]}
                                        />
                                        <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={24}>
                                            {funnelData.map((entry: any, i: number) => (
                                                <Cell key={i} fill={entry.fill} />
                                            ))}
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                            ) : (
                                <p className="py-12 text-center text-sm text-surface-400">Sem dados de funil</p>
                            )}
                        </div>
                    </div>

                    {/* Pipeline Stage Breakdown */}
                    <div className="rounded-xl border border-default bg-surface-0 shadow-card">
                        <div className="border-b border-subtle px-5 py-3">
                            <h2 className="text-sm font-semibold text-surface-900">Detalhamento por Etapa</h2>
                        </div>
                        <div className="p-5 space-y-4 max-h-[340px] overflow-y-auto">
                            {pipelines.map((pipeline: any) => (
                                <div key={pipeline.id}>
                                    <div className="flex items-center gap-2 mb-2">
                                        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: pipeline.color || '#94a3b8' }} />
                                        <Link to={`/crm/pipeline/${pipeline.id}`} className="text-sm font-medium text-surface-800 hover:text-brand-600 transition-colors">
                                            {pipeline.name}
                                        </Link>
                                    </div>
                                    <div className="space-y-1.5">
                                        {pipeline.stages.filter((s: any) => !s.is_won && !s.is_lost).map((stage: any) => {
                                            const count = stage.deals_count ?? 0
                                            const value = stage.deals_sum_value ?? 0
                                            const maxCount = Math.max(...pipeline.stages.filter((s: any) => !s.is_won && !s.is_lost).map((s: any) => s.deals_count ?? 0), 1)
                                            const pct = Math.max((count / maxCount) * 100, 4)
                                            return (
                                                <div key={stage.id} className="flex items-center gap-3">
                                                    <span className="text-xs text-surface-500 w-20 truncate" title={stage.name}>{stage.name}</span>
                                                    <div className="flex-1 h-5 bg-surface-100 rounded-md overflow-hidden">
                                                        <div
                                                            className="h-full rounded-md flex items-center pl-2 text-[10px] font-semibold text-white transition-all duration-500"
                                                            style={{ width: `${pct}%`, backgroundColor: stage.color || '#94a3b8' }}
                                                        >
                                                            {count > 0 && count}
                                                        </div>
                                                    </div>
                                                    <span className="text-xs font-medium text-surface-600 w-24 text-right tabular-nums">{formatCurrency(value)}</span>
                                                </div>
                                            )
                                        })}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* Messaging Stats */}
            <div className="rounded-xl border border-default bg-surface-0 shadow-card">
                <div className="flex items-center justify-between border-b border-subtle px-5 py-3">
                    <h2 className="text-sm font-semibold text-surface-900">Mensageria ({periodLabel})</h2>
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
                        ) : recentDeals.map((deal: any) => (
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
                                    <span className="text-sm font-bold text-surface-900">{formatCurrency(deal.value)}</span>
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
                        ) : upcomingActivities.map((act: any) => (
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
                {/* Top Customers Chart */}
                <div className="rounded-xl border border-default bg-surface-0 shadow-card">
                    <div className="border-b border-subtle px-5 py-3">
                        <h2 className="text-sm font-semibold text-surface-900">Top Clientes (receita ganha)</h2>
                    </div>
                    {isLoading ? (
                        <p className="py-8 text-center text-sm text-surface-400">Carregando…</p>
                    ) : topCustomersChartData.length === 0 ? (
                        <p className="py-8 text-center text-sm text-surface-400">Sem dados</p>
                    ) : (
                        <div className="p-4">
                            <ResponsiveContainer width="100%" height={Math.max(topCustomersChartData.length * 36, 160)}>
                                <BarChart data={topCustomersChartData} layout="vertical" margin={{ left: 0, right: 10, top: 5, bottom: 5 }}>
                                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--color-border-subtle, #e5e7eb)" />
                                    <XAxis type="number" tick={{ fontSize: 10, fill: '#9ca3af' }} tickFormatter={(v) => formatCurrency(v)} />
                                    <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 11, fill: '#6b7280' }} />
                                    <Tooltip
                                        contentStyle={{ borderRadius: 8, border: '1px solid #e5e7eb', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', fontSize: 12 }}
                                        formatter={(value: number, name: string, props: any) => [
                                            `${formatCurrency(value)} (${props.payload.deals} deal(s))`,
                                            props.payload.fullName,
                                        ]}
                                    />
                                    <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={20}>
                                        {topCustomersChartData.map((_: any, i: number) => (
                                            <Cell key={i} fill={i === 0 ? '#f59e0b' : i < 3 ? '#3b82f6' : '#94a3b8'} />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    )}
                </div>

                {/* Email Tracking Metrics (#5) */}
                <div className="rounded-xl border border-default bg-surface-0 shadow-card">
                    <div className="flex items-center gap-2 border-b border-subtle px-5 py-3">
                        <Mail className="h-4 w-4 text-brand-600" />
                        <h2 className="text-sm font-semibold text-surface-900">Métricas de E-mail</h2>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-px bg-muted">
                        {(() => {
                            const emailData = data?.email_tracking ?? { total_sent: 0, opened: 0, clicked: 0, replied: 0, bounced: 0 }
                            const total = emailData.total_sent || 1
                            const openRate = Math.round((emailData.opened / total) * 100)
                            const clickRate = Math.round((emailData.clicked / total) * 100)
                            const replyRate = Math.round((emailData.replied / total) * 100)
                            const items = [
                                { label: 'Enviados', value: emailData.total_sent, icon: Send, color: 'text-blue-600' },
                                { label: 'Abertos', value: emailData.opened, icon: Mail, color: 'text-green-600', sub: `${openRate}%` },
                                { label: 'Clicados', value: emailData.clicked, icon: ArrowUpRight, color: 'text-brand-600', sub: `${clickRate}%` },
                                { label: 'Respondidos', value: emailData.replied, icon: MessageCircle, color: 'text-teal-600', sub: `${replyRate}%` },
                                { label: 'Bounced', value: emailData.bounced, icon: XCircle, color: 'text-red-500' },
                                { label: 'Taxa Abertura', value: `${openRate}%`, icon: BarChart3, color: 'text-amber-600' },
                            ]
                            return items.map(item => (
                                <div key={item.label} className="bg-surface-0 p-4 text-center">
                                    <item.icon className={cn('h-4 w-4 mx-auto mb-1', item.color)} />
                                    <p className="text-lg font-bold tabular-nums text-surface-900">{isLoading ? '…' : item.value}</p>
                                    <p className="text-[10px] font-medium text-surface-500">{item.label}</p>
                                    {item.sub && <p className="text-[10px] text-surface-400">{item.sub}</p>}
                                </div>
                            ))
                        })()}
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
