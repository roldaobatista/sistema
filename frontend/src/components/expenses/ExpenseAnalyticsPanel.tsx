import { BarChart3, ChevronDown } from 'lucide-react'
import { ColorDot } from '@/components/ui/color-dot'

interface AnalyticsData {
    by_category?: { category_id: number; category_name: string; category_color: string; total: string | number }[]
    by_month?: { month: string; total: string | number }[]
    top_creators?: { user_id: number; user_name: string; count: number; total: string | number }[]
    period?: { from: string; to: string }
}

interface ExpenseAnalyticsPanelProps {
    show: boolean
    onToggle: () => void
    analytics: AnalyticsData | null
    fmtBRL: (val: string | number) => string
}

export function ExpenseAnalyticsPanel({ show, onToggle, analytics, fmtBRL }: ExpenseAnalyticsPanelProps) {
    return (
        <div className="rounded-xl border border-default bg-surface-0 shadow-card">
            <button onClick={onToggle}
                className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-surface-50 transition-colors">
                <div className="flex items-center gap-2">
                    <BarChart3 className="h-4 w-4 text-brand-600" />
                    <span className="text-sm font-semibold text-surface-800">Analytics de Despesas</span>
                </div>
                <ChevronDown className={`h-4 w-4 text-surface-400 transition-transform duration-200 ${show ? 'rotate-180' : ''}`} />
            </button>

            {show && analytics && (
                <div className="border-t border-subtle px-4 pb-4 pt-3">
                    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                        {/* By Category */}
                        <div>
                            <h3 className="mb-3 text-xs font-semibold uppercase text-surface-500">Gastos por Categoria</h3>
                            <div className="space-y-2">
                                {(analytics.by_category ?? []).length === 0 ? (
                                    <p className="text-xs text-surface-400">Nenhum dado no período</p>
                                ) : (() => {
                                    const maxVal = Math.max(...(analytics.by_category ?? []).map(c => Number(c.total)), 1)
                                    return (analytics.by_category ?? []).map((cat) => (
                                        <div key={cat.category_id ?? 'none'} className="flex items-center gap-2">
                                            <ColorDot color={cat.category_color} size="md" className="shrink-0" />
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center justify-between mb-0.5">
                                                    <span className="truncate text-xs font-medium text-surface-700">{cat.category_name}</span>
                                                    <span className="ml-2 text-xs tabular-nums text-surface-500">{fmtBRL(cat.total)}</span>
                                                </div>
                                                <div className="h-1.5 w-full rounded-full bg-surface-100">
                                                    {/* eslint-disable-next-line react/forbid-dom-props -- dynamic width % */}
                                                    <div className="h-full rounded-full transition-all duration-300"
                                                        style={{ width: `${(Number(cat.total) / maxVal) * 100}%`, backgroundColor: cat.category_color }} />
                                                </div>
                                            </div>
                                        </div>
                                    ))
                                })()}
                            </div>
                        </div>

                        {/* Monthly Evolution */}
                        <div>
                            <h3 className="mb-3 text-xs font-semibold uppercase text-surface-500">Evolução Mensal (6 meses)</h3>
                            <div className="space-y-2">
                                {(analytics.by_month ?? []).length === 0 ? (
                                    <p className="text-xs text-surface-400">Nenhum dado</p>
                                ) : (() => {
                                    const maxMonth = Math.max(...(analytics.by_month ?? []).map(m => Number(m.total)), 1)
                                    return (analytics.by_month ?? []).map((m) => {
                                        const [year, month] = m.month.split('-')
                                        return (
                                            <div key={m.month} className="flex items-center gap-3">
                                                <span className="w-12 text-xs text-surface-500 tabular-nums">{month}/{year}</span>
                                                <div className="flex-1 h-1.5 rounded-full bg-surface-100">
                                                    {/* eslint-disable-next-line react/forbid-dom-props -- dynamic width % */}
                                                    <div className="h-full rounded-full bg-brand-500 transition-all duration-300"
                                                        style={{ width: `${(Number(m.total) / maxMonth) * 100}%` }} />
                                                </div>
                                                <span className="w-24 text-right text-xs text-surface-600 tabular-nums">{fmtBRL(m.total)}</span>
                                            </div>
                                        )
                                    })
                                })()}
                            </div>
                        </div>

                        {/* Top Creators */}
                        <div>
                            <h3 className="mb-3 text-xs font-semibold uppercase text-surface-500">Top Responsáveis</h3>
                            <div className="space-y-2">
                                {(analytics.top_creators ?? []).length === 0 ? (
                                    <p className="text-xs text-surface-400">Nenhum dado</p>
                                ) : (analytics.top_creators ?? []).map((cr, i) => (
                                    <div key={cr.user_id} className="flex items-center gap-2">
                                        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-surface-100 text-[10px] font-bold text-surface-500">{i + 1}</span>
                                        <span className="flex-1 truncate text-xs font-medium text-surface-700">{cr.user_name}</span>
                                        <span className="text-xs text-surface-400">{cr.count}x</span>
                                        <span className="text-xs font-medium tabular-nums text-surface-600">{fmtBRL(cr.total)}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    <p className="mt-3 text-xs text-surface-400">
                        Período: {analytics.period?.from} a {analytics.period?.to} · Exclui despesas rejeitadas
                    </p>
                </div>
            )}

            {show && !analytics && (
                <div className="border-t border-subtle px-4 py-6 text-center">
                    <div className="mx-auto h-4 w-32 animate-pulse rounded bg-surface-200" />
                </div>
            )}
        </div>
    )
}
