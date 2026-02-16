import { useQuery } from '@tanstack/react-query'
import { DollarSign, TrendingDown, Users, BarChart3, ArrowUpRight, ArrowDownRight } from 'lucide-react'
import { crmFeaturesApi } from '@/lib/crm-features-api'
import type { CrmRevenueIntelligence } from '@/lib/crm-features-api'
import { PageHeader } from '@/components/ui/pageheader'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/ui/emptystate'

const fmtBRL = (v: number | string) => Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const fmtCompact = (v: number) => {
    if (v >= 1_000_000) return `R$ ${(v / 1_000_000).toFixed(1)}M`
    if (v >= 1_000) return `R$ ${(v / 1_000).toFixed(1)}K`
    return fmtBRL(v)
}

export function CrmRevenueIntelligencePage() {
    const { data: res, isLoading } = useQuery({
        queryKey: ['crm-revenue-intelligence'],
        queryFn: () => crmFeaturesApi.getRevenueIntelligence(),
    })
    const data: CrmRevenueIntelligence | null = res?.data ?? null

    if (isLoading) {
        return (
            <div className='space-y-6'>
                <PageHeader title='Inteligência de Receita' subtitle='Dashboard executivo de métricas de receita.' icon={BarChart3} />
                <div className='grid gap-4 md:grid-cols-2 lg:grid-cols-4'>
                    {Array.from({ length: 4 }).map((_, i) => (
                        <div key={i} className='rounded-xl border border-default bg-surface-0 p-6 shadow-card animate-pulse'>
                            <div className='h-4 bg-surface-100 rounded w-1/2 mb-3' />
                            <div className='h-8 bg-surface-100 rounded w-3/4' />
                        </div>
                    ))}
                </div>
            </div>
        )
    }

    if (!data) {
        return (
            <div className='space-y-6'>
                <PageHeader title='Inteligência de Receita' subtitle='Dashboard executivo de métricas de receita.' icon={BarChart3} />
                <EmptyState icon={BarChart3} title='Sem dados disponíveis' message='Não há dados de receita para exibir no momento.' />
            </div>
        )
    }

    const monthlyMax = Math.max(...(data.monthly_revenue?.map((m) => m.revenue) ?? []), 1)
    const segmentMax = Math.max(...(data.by_segment?.map((s) => s.revenue) ?? []), 1)

    return (
        <div className='space-y-6'>
            <PageHeader
                title='Inteligência de Receita'
                subtitle='Dashboard executivo com métricas de receita, churn e LTV.'
                icon={BarChart3}
            />

            <div className='grid gap-4 md:grid-cols-2 lg:grid-cols-4'>
                <KpiCard
                    icon={DollarSign}
                    iconColor='emerald'
                    label='MRR (Receita Recorrente)'
                    value={fmtCompact(data.mrr)}
                    subtitle={`${data.contract_customers} clientes com contrato`}
                />
                <KpiCard
                    icon={TrendingDown}
                    iconColor='red'
                    label='Taxa de Churn'
                    value={`${data.churn_rate.toFixed(1)}%`}
                    subtitle={data.churn_rate > 5 ? 'Acima do ideal' : 'Saudável'}
                    subtitleColor={data.churn_rate > 5 ? 'text-red-600' : 'text-emerald-600'}
                    trend={data.churn_rate > 5 ? 'down' : 'up'}
                />
                <KpiCard
                    icon={Users}
                    iconColor='violet'
                    label='LTV Médio'
                    value={fmtCompact(data.ltv)}
                    subtitle='Valor vitalício do cliente'
                />
                <KpiCard
                    icon={BarChart3}
                    iconColor='sky'
                    label='Ticket Médio'
                    value={fmtBRL(data.avg_deal_value)}
                    subtitle='Valor médio por negócio'
                />
            </div>

            <div className='grid gap-4 lg:grid-cols-2'>
                <div className='rounded-xl border border-default bg-surface-0 p-6 shadow-card'>
                    <h3 className='font-semibold text-surface-900 mb-1'>Receita Mensal</h3>
                    <p className='text-xs text-surface-500 mb-4'>Evolução da receita nos últimos meses</p>

                    {(!data.monthly_revenue || data.monthly_revenue.length === 0) ? (
                        <div className='text-center py-8'>
                            <BarChart3 className='h-8 w-8 mx-auto text-surface-300 mb-2' />
                            <p className='text-surface-500 text-sm'>Sem dados de receita mensal.</p>
                        </div>
                    ) : (
                        <div className='flex items-end gap-2 h-52'>
                            {data.monthly_revenue.map((m) => (
                                <div key={m.month} className='flex-1 flex flex-col items-center gap-1 min-w-0'>
                                    <span className='text-xs font-medium text-surface-600 truncate w-full text-center'>
                                        {fmtCompact(m.revenue)}
                                    </span>
                                    <div
                                        className='w-full bg-brand-500 rounded-t-md transition-all hover:bg-brand-600'
                                        style={{ height: `${Math.max((m.revenue / monthlyMax) * 100, 4)}%` }}
                                        title={`${m.month}: ${fmtBRL(m.revenue)} — ${m.deals} negócios`}
                                    />
                                    <span className='text-xs text-surface-500 truncate w-full text-center'>
                                        {m.month.slice(5)}
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div className='rounded-xl border border-default bg-surface-0 p-6 shadow-card'>
                    <h3 className='font-semibold text-surface-900 mb-1'>Receita por Segmento</h3>
                    <p className='text-xs text-surface-500 mb-4'>Distribuição por segmento de cliente</p>

                    {(!data.by_segment || data.by_segment.length === 0) ? (
                        <div className='text-center py-8'>
                            <Users className='h-8 w-8 mx-auto text-surface-300 mb-2' />
                            <p className='text-surface-500 text-sm'>Sem dados de segmentação.</p>
                        </div>
                    ) : (
                        <div className='space-y-3'>
                            {data.by_segment.map((seg) => (
                                <div key={seg.segment}>
                                    <div className='flex justify-between text-xs mb-1'>
                                        <span className='font-medium text-surface-700'>{seg.segment || 'Sem segmento'}</span>
                                        <span className='text-surface-500'>
                                            {seg.deals} negócios — {fmtBRL(seg.revenue)}
                                        </span>
                                    </div>
                                    <div className='h-2.5 rounded-full bg-surface-100'>
                                        <div
                                            className='h-full rounded-full bg-brand-500 transition-all'
                                            style={{ width: `${(seg.revenue / segmentMax) * 100}%` }}
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {data.by_segment && data.by_segment.length > 0 && (
                <div className='bg-surface-0 border border-default rounded-xl overflow-hidden shadow-card'>
                    <div className='p-4 border-b border-default'>
                        <h3 className='font-semibold text-surface-900'>Detalhamento por Segmento</h3>
                    </div>
                    <div className='overflow-x-auto'>
                        <table className='w-full text-sm'>
                            <thead className='bg-surface-50 text-surface-500 border-b border-default'>
                                <tr>
                                    <th className='px-4 py-3 text-left font-medium'>Segmento</th>
                                    <th className='px-4 py-3 text-right font-medium'>Receita</th>
                                    <th className='px-4 py-3 text-right font-medium'>Negócios</th>
                                    <th className='px-4 py-3 text-right font-medium'>Ticket Médio</th>
                                    <th className='px-4 py-3 text-right font-medium'>% do Total</th>
                                </tr>
                            </thead>
                            <tbody className='divide-y divide-subtle'>
                                {data.by_segment.map((seg) => {
                                    const totalRevenue = data.by_segment.reduce((sum, s) => sum + s.revenue, 0)
                                    const pct = totalRevenue > 0 ? ((seg.revenue / totalRevenue) * 100).toFixed(1) : '0'
                                    const avgTicket = seg.deals > 0 ? seg.revenue / seg.deals : 0
                                    return (
                                        <tr key={seg.segment} className='hover:bg-surface-50 transition-colors'>
                                            <td className='px-4 py-3 font-medium text-surface-900'>
                                                {seg.segment || 'Sem segmento'}
                                            </td>
                                            <td className='px-4 py-3 text-right font-semibold text-emerald-600 tabular-nums'>
                                                {fmtBRL(seg.revenue)}
                                            </td>
                                            <td className='px-4 py-3 text-right text-surface-600 tabular-nums'>
                                                {seg.deals}
                                            </td>
                                            <td className='px-4 py-3 text-right text-surface-600 tabular-nums'>
                                                {fmtBRL(avgTicket)}
                                            </td>
                                            <td className='px-4 py-3 text-right'>
                                                <Badge variant='outline'>{pct}%</Badge>
                                            </td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            <div className='grid gap-4 md:grid-cols-2'>
                <div className='rounded-xl border border-default bg-surface-0 p-6 shadow-card'>
                    <h3 className='font-semibold text-surface-900 mb-3'>Resumo</h3>
                    <div className='space-y-2 text-sm'>
                        <div className='flex justify-between'>
                            <span className='text-surface-500'>Receita Recorrente (MRR)</span>
                            <span className='font-semibold text-surface-900'>{fmtBRL(data.mrr)}</span>
                        </div>
                        <div className='flex justify-between'>
                            <span className='text-surface-500'>Receita Pontual</span>
                            <span className='font-semibold text-surface-900'>{fmtBRL(data.one_time_revenue)}</span>
                        </div>
                        <div className='flex justify-between border-t border-surface-100 pt-2'>
                            <span className='text-surface-500 font-medium'>Receita Total Estimada</span>
                            <span className='font-bold text-brand-600'>{fmtBRL(data.mrr + data.one_time_revenue)}</span>
                        </div>
                    </div>
                </div>
                <div className='rounded-xl border border-default bg-surface-0 p-6 shadow-card'>
                    <h3 className='font-semibold text-surface-900 mb-3'>Métricas de Saúde</h3>
                    <div className='space-y-3'>
                        <MetricRow
                            label='Taxa de Churn'
                            value={`${data.churn_rate.toFixed(1)}%`}
                            status={data.churn_rate <= 3 ? 'good' : data.churn_rate <= 7 ? 'warning' : 'danger'}
                        />
                        <MetricRow
                            label='LTV / Ticket Médio'
                            value={data.avg_deal_value > 0 ? `${(data.ltv / data.avg_deal_value).toFixed(1)}x` : '—'}
                            status={(data.ltv / (data.avg_deal_value || 1)) >= 3 ? 'good' : 'warning'}
                        />
                        <MetricRow
                            label='Clientes com Contrato'
                            value={String(data.contract_customers)}
                            status={data.contract_customers > 0 ? 'good' : 'warning'}
                        />
                    </div>
                </div>
            </div>
        </div>
    )
}

function KpiCard({
    icon: Icon,
    iconColor,
    label,
    value,
    subtitle,
    subtitleColor,
    trend,
}: {
    icon: React.ComponentType<{ className?: string }>
    iconColor: string
    label: string
    value: string
    subtitle?: string
    subtitleColor?: string
    trend?: 'up' | 'down'
}) {
    return (
        <div className='rounded-xl border border-default bg-surface-0 p-6 shadow-card'>
            <div className='flex items-center gap-4'>
                <div className={`h-12 w-12 rounded-full bg-${iconColor}-100 flex items-center justify-center text-${iconColor}-600`}>
                    <Icon className='h-6 w-6' />
                </div>
                <div>
                    <p className='text-sm font-medium text-surface-500'>{label}</p>
                    <h3 className='text-2xl font-bold text-surface-900 flex items-center gap-1'>
                        {value}
                        {trend === 'up' && <ArrowUpRight className='h-4 w-4 text-emerald-500' />}
                        {trend === 'down' && <ArrowDownRight className='h-4 w-4 text-red-500' />}
                    </h3>
                    {subtitle && (
                        <span className={`text-xs font-medium ${subtitleColor ?? 'text-surface-400'}`}>
                            {subtitle}
                        </span>
                    )}
                </div>
            </div>
        </div>
    )
}

function MetricRow({ label, value, status }: { label: string; value: string; status: 'good' | 'warning' | 'danger' }) {
    const colors = {
        good: 'text-emerald-600 bg-emerald-50 border-emerald-200',
        warning: 'text-amber-600 bg-amber-50 border-amber-200',
        danger: 'text-red-600 bg-red-50 border-red-200',
    }
    return (
        <div className='flex items-center justify-between'>
            <span className='text-sm text-surface-600'>{label}</span>
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${colors[status]}`}>
                {value}
            </span>
        </div>
    )
}
