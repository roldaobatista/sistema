import { useState } from 'react'
import { toast } from 'sonner'
import { useQuery } from '@tanstack/react-query'
import {
    BarChart3, TrendingUp, Trophy, Award, Users, PieChart, ArrowUpRight, ArrowDownRight,
} from 'lucide-react'
import api from '@/lib/api'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { PageHeader } from '@/components/ui/pageheader'
import { useAuthStore } from '@/stores/auth-store'

const fmtBRL = (val: string | number) => Number(val).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

export function CommissionDashboardPage() {
  const { hasPermission } = useAuthStore()

    const [months, setMonths] = useState(6)

    const { data: overviewRes, isLoading: loadingOverview } = useQuery({ queryKey: ['commission-overview'], queryFn: () => api.get('/commission-dashboard/overview') })
    const overview = overviewRes?.data?.data ?? overviewRes?.data ?? {}

    const { data: rankingRes, isLoading: loadingRanking } = useQuery({ queryKey: ['commission-ranking'], queryFn: () => api.get('/commission-dashboard/ranking') })
    const ranking = rankingRes?.data?.data ?? rankingRes?.data ?? []

    const { data: evolutionRes, isLoading: loadingEvolution } = useQuery({ queryKey: ['commission-evolution', months], queryFn: () => api.get('/commission-dashboard/evolution', { params: { months } }) })
    const evolution = evolutionRes?.data?.data ?? evolutionRes?.data ?? []

    const { data: byRuleRes, isLoading: loadingByRule } = useQuery({ queryKey: ['commission-by-rule'], queryFn: () => api.get('/commission-dashboard/by-rule') })
    const byRule = byRuleRes?.data?.data ?? byRuleRes?.data ?? []

    const { data: byRoleRes, isLoading: loadingByRole } = useQuery({ queryKey: ['commission-by-role'], queryFn: () => api.get('/commission-dashboard/by-role') })
    const byRole = byRoleRes?.data?.data ?? byRoleRes?.data ?? []
    const isLoading = loadingOverview || loadingRanking || loadingEvolution || loadingByRule || loadingByRole

    const maxEvolution = Math.max(...(evolution as any[]).map((e: any) => e.total), 1)
    const maxByRule = Math.max(...(byRule as any[]).map((r: any) => r.total), 1)

    const calcTypeLabels: Record<string, string> = {
        percent_gross: '% Bruto', percent_net: '% Líquido', fixed_per_os: 'Fixo/OS',
        percent_services_only: '% Serviços', percent_products_only: '% Produtos',
        percent_profit: '% Lucro', percent_gross_minus_displacement: '% (Bâˆ’D)',
        percent_gross_minus_expenses: '% (Bâˆ’Desp)', tiered_gross: 'Escalonado', custom_formula: 'Fórmula',
    }
    const roleLabels: Record<string, string> = { technician: 'Técnico', seller: 'Vendedor', driver: 'Motorista' }
    const roleColor: Record<string, string> = { technician: '#3B82F6', seller: '#10B981', driver: '#F59E0B' }

    if (isLoading) {
        return (
            <div className="space-y-5">
                <PageHeader title="Dashboard de Comissões" subtitle="Visão analítica e KPIs de comissões" />
                <div className="rounded-xl border border-default bg-surface-0 p-5 shadow-card text-sm text-surface-500">
                    Carregando indicadores de comissão...
                </div>
            </div>
        )
    }
    return (
        <div className="space-y-5">
            {/* Header */}
            <PageHeader title="Dashboard de Comissões" subtitle="Visão analítica e KPIs de comissões" />

            {/* KPI Cards */}
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-xl border border-default bg-surface-0 p-5 shadow-card">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-amber-600"><BarChart3 className="h-5 w-5" /><span className="text-xs font-semibold uppercase tracking-wider">Pendente</span></div>
                    </div>
                    <p className="mt-3 text-lg font-semibold text-surface-900 tracking-tight">{fmtBRL(overview.pending ?? 0)}</p>
                    <p className="mt-1 text-xs text-surface-500">{overview.total_events ?? 0} eventos totais</p>
                </div>
                <div className="rounded-xl border border-default bg-surface-0 p-5 shadow-card">
                    <div className="flex items-center gap-2 text-sky-600"><Award className="h-5 w-5" /><span className="text-xs font-semibold uppercase tracking-wider">Aprovado</span></div>
                    <p className="mt-3 text-2xl font-bold text-sky-600">{fmtBRL(overview.approved ?? 0)}</p>
                    <p className="mt-1 text-xs text-surface-500">{overview.total_rules ?? 0} regras ativas</p>
                </div>
                <div className="rounded-xl border border-default bg-surface-0 p-5 shadow-card">
                    <div className="flex items-center gap-2 text-emerald-600"><TrendingUp className="h-5 w-5" /><span className="text-xs font-semibold uppercase tracking-wider">Pago (mês)</span></div>
                    <p className="mt-3 text-2xl font-bold text-emerald-600">{fmtBRL(overview.paid_this_month ?? 0)}</p>
                    <div className="mt-1 flex items-center gap-1 text-xs">
                        {overview.variation_pct != null ? (
                            <>
                                {overview.variation_pct >= 0
                                    ? <><ArrowUpRight className="h-3.5 w-3.5 text-emerald-500" /><span className="text-emerald-600">+{overview.variation_pct}%</span></>
                                    : <><ArrowDownRight className="h-3.5 w-3.5 text-red-500" /><span className="text-red-600">{overview.variation_pct}%</span></>
                                }
                                <span className="text-surface-400">vs. mês anterior</span>
                            </>
                        ) : (
                            <span className="text-surface-400">Sem dados do mês anterior</span>
                        )}
                    </div>
                </div>
                <div className="rounded-xl border border-default bg-surface-0 p-5 shadow-card">
                    <div className="flex items-center gap-2 text-surface-500"><PieChart className="h-5 w-5" /><span className="text-xs font-semibold uppercase tracking-wider">Mês Anterior</span></div>
                    <p className="mt-3 text-2xl font-bold text-surface-700">{fmtBRL(overview.paid_last_month ?? 0)}</p>
                </div>
            </div>

            {/* Evolution + Ranking */}
            <div className="grid gap-4 lg:grid-cols-3">
                {/* Evolution Chart */}
                <div className="lg:col-span-2 rounded-xl border border-default bg-surface-0 p-5 shadow-card">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-sm font-semibold text-surface-900">Evolução Mensal</h2>
                        <select value={months} onChange={e => setMonths(+e.target.value)}
                            className="rounded-lg border border-surface-300 px-2 py-1 text-xs">
                            <option value={3}>3 meses</option><option value={6}>6 meses</option><option value={12}>12 meses</option>
                        </select>
                    </div>
                    <div className="flex items-end gap-2" style={{ height: 200 }}>
                        {(evolution as any[]).map((e: any, i: number) => {
                            const h = maxEvolution > 0 ? (e.total / maxEvolution) * 180 : 0
                            return (
                                <div key={i} className="flex flex-1 flex-col items-center gap-1" title={fmtBRL(e.total)}>
                                    <span className="text-[10px] text-surface-500 font-medium">{fmtBRL(e.total).replace('R$\u00a0', '')}</span>
                                    <div className="w-full rounded-t-md bg-brand-500 transition-all hover:bg-brand-600"
                                        style={{ height: Math.max(h, 4) }} />
                                    <span className="text-[10px] text-surface-500">{e.label}</span>
                                </div>
                            )
                        })}
                        {(evolution as any[]).length === 0 && <p className="w-full text-center text-sm text-surface-400 self-center">Sem dados</p>}
                    </div>
                </div>

                {/* Ranking */}
                <div className="rounded-xl border border-default bg-surface-0 p-5 shadow-card">
                    <h2 className="mb-4 text-sm font-semibold text-surface-900 flex items-center gap-2"><Trophy className="h-4 w-4 text-amber-500" /> Ranking do Mês</h2>
                    <div className="space-y-2.5">
                        {(ranking as any[]).map((r: any) => (
                            <div key={r.id} className="flex items-center gap-3">
                                <span className="w-6 text-center text-lg">{r.medal || r.position}</span>
                                <div className="flex-1 min-w-0">
                                    <p className="text-[13px] font-medium text-surface-900 truncate">{r.name}</p>
                                    <p className="text-xs text-surface-500">{r.events_count} eventos</p>
                                </div>
                                <span className="text-sm font-bold text-surface-900">{fmtBRL(r.total)}</span>
                            </div>
                        ))}
                        {(ranking as any[]).length === 0 && <p className="text-sm text-surface-400 text-center py-4">Sem dados</p>}
                    </div>
                </div>
            </div>

            {/* By Rule + By Role */}
            <div className="grid gap-4 lg:grid-cols-2">
                {/* By Rule */}
                <div className="rounded-xl border border-default bg-surface-0 p-5 shadow-card">
                    <h2 className="mb-4 text-sm font-semibold text-surface-900">Por Tipo de Cálculo</h2>
                    <div className="space-y-3">
                        {(byRule as any[]).map((r: any, i: number) => {
                            const pct = maxByRule > 0 ? (r.total / maxByRule) * 100 : 0
                            const colors = ['bg-brand-500', 'bg-sky-500', 'bg-emerald-500', 'bg-amber-500', 'bg-rose-500']
                            return (
                                <div key={i}>
                                    <div className="flex justify-between text-xs mb-1">
                                        <span className="font-medium text-surface-700">{calcTypeLabels[r.calculation_type] ?? r.calculation_type}</span>
                                        <span className="text-surface-500">{fmtBRL(r.total)} ({r.count})</span>
                                    </div>
                                    <div className="h-2 rounded-full bg-surface-100">
                                        <div className={cn('h-full rounded-full transition-all', colors[i % colors.length])} style={{ width: `${Math.min(pct, 100)}%` }} />
                                    </div>
                                </div>
                            )
                        })}
                        {(byRule as any[]).length === 0 && <p className="text-sm text-surface-400 text-center py-4">Sem dados</p>}
                    </div>
                </div>

                {/* By Role */}
                <div className="rounded-xl border border-default bg-surface-0 p-5 shadow-card">
                    <h2 className="mb-4 text-sm font-semibold text-surface-900 flex items-center gap-2"><Users className="h-4 w-4 text-brand-500" /> Por Papel</h2>
                    <div className="flex items-center justify-center" style={{ height: 200 }}>
                        {(byRole as any[]).length > 0 ? (
                            <div className="flex items-end gap-6">
                                {(byRole as any[]).map((r: any, i: number) => {
                                    const maxRole = Math.max(...(byRole as any[]).map((x: any) => +x.total), 1)
                                    const h = (+r.total / maxRole) * 160
                                    return (
                                        <div key={i} className="flex flex-col items-center gap-2">
                                            <span className="text-xs font-bold text-surface-900">{fmtBRL(r.total)}</span>
                                            <div className="w-14 rounded-t-lg transition-all" style={{ height: Math.max(h, 8), backgroundColor: roleColor[r.role] ?? '#6B7280' }} />
                                            <div className="text-center">
                                                <p className="text-xs font-semibold" style={{ color: roleColor[r.role] ?? '#6B7280' }}>{roleLabels[r.role] ?? r.role}</p>
                                                <p className="text-[10px] text-surface-500">{r.count} eventos</p>
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        ) : <p className="text-sm text-surface-400">Sem dados</p>}
                    </div>
                </div>
            </div>
        </div>
    )
}

