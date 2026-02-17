import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { BarChart3, TrendingUp, TrendingDown, ArrowRight } from 'lucide-react'
import api from '@/lib/api'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { PageHeader } from '@/components/ui/pageheader'

const fmtBRL = (val: number) => val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const fmtPct = (val: number) => `${val.toFixed(1)}%`

const todayStr = () => new Date().toISOString().slice(0, 10)
const monthStart = () => new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10)

interface DREData {
    period: { from: string; to: string }
    revenue: number
    cogs: number
    gross_profit: number
    gross_margin: number
    operating_expenses: number
    operating_profit: number
    operating_margin: number
    expenses_by_category: Array<{ category: string; total: number }>
}

export function DrePage() {
    const [from, setFrom] = useState(monthStart())
    const [to, setTo] = useState(todayStr())

    const { data: res, isLoading, isError, refetch } = useQuery({
        queryKey: ['financial-dre', from, to],
        queryFn: () => api.get('/financial/dre', { params: { from, to } }),
    })
    const dre: DREData | null = res?.data?.data ?? null

    return (
        <div className="space-y-5">
            <PageHeader title="DRE — Demonstrativo de Resultado" subtitle="Visão gerencial de receitas, custos e despesas" />

            <div className="flex flex-wrap gap-3 items-end">
                <Input label="De" type="date" value={from} onChange={e => setFrom(e.target.value)} className="w-44" />
                <Input label="Até" type="date" value={to} onChange={e => setTo(e.target.value)} className="w-44" />
            </div>

            {isLoading ? (
                <div className="text-center py-12 text-surface-500">Carregando...</div>
            ) : isError ? (
                <div className="text-center py-12 text-red-600">Erro ao carregar. <button className="underline" onClick={() => refetch()}>Tentar novamente</button></div>
            ) : dre ? (
                <div className="space-y-5">
                    {/* Summary Cards */}
                    <div className="grid gap-4 sm:grid-cols-4">
                        <SummaryCard label="Receita Bruta" value={dre.revenue} color="emerald" />
                        <SummaryCard label="Lucro Bruto" value={dre.gross_profit} margin={dre.gross_margin} color={dre.gross_profit >= 0 ? 'emerald' : 'red'} />
                        <SummaryCard label="Despesas Operacionais" value={dre.operating_expenses} color="red" />
                        <SummaryCard label="Resultado Operacional" value={dre.operating_profit} margin={dre.operating_margin} color={dre.operating_profit >= 0 ? 'emerald' : 'red'} />
                    </div>

                    {/* DRE Table */}
                    <div className="overflow-hidden rounded-xl border border-default bg-surface-0 shadow-card">
                        <table className="w-full">
                            <thead>
                                <tr className="border-b border-subtle bg-surface-50">
                                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase text-surface-600">Conta</th>
                                    <th className="px-5 py-3 text-right text-xs font-semibold uppercase text-surface-600">Valor</th>
                                    <th className="px-5 py-3 text-right text-xs font-semibold uppercase text-surface-600">% Receita</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-subtle">
                                <DreRow label="(+) Receita Bruta" value={dre.revenue} revenue={dre.revenue} bold highlight="green" />
                                <DreRow label="(−) Custo dos Serviços (CMV)" value={-dre.cogs} revenue={dre.revenue} />
                                <DreRow label="(=) LUCRO BRUTO" value={dre.gross_profit} revenue={dre.revenue} bold highlight={dre.gross_profit >= 0 ? 'green' : 'red'} />
                                <DreRow label="(−) Despesas Operacionais" value={-dre.operating_expenses} revenue={dre.revenue} />

                                {/* Category breakdown */}
                                {dre.expenses_by_category.map(cat => (
                                    <tr key={cat.category} className="hover:bg-surface-50/50 transition-colors">
                                        <td className="px-5 py-2.5 pl-10 text-sm text-surface-500">
                                            <ArrowRight className="inline h-3 w-3 mr-1 text-surface-300" />
                                            {cat.category || 'Sem categoria'}
                                        </td>
                                        <td className="px-5 py-2.5 text-right text-sm text-surface-500">{fmtBRL(-Number(cat.total))}</td>
                                        <td className="px-5 py-2.5 text-right text-xs text-surface-400">
                                            {dre.revenue > 0 ? fmtPct((Number(cat.total) / dre.revenue) * 100) : '—'}
                                        </td>
                                    </tr>
                                ))}

                                <DreRow label="(=) RESULTADO OPERACIONAL" value={dre.operating_profit} revenue={dre.revenue} bold highlight={dre.operating_profit >= 0 ? 'green' : 'red'} />
                            </tbody>
                        </table>
                    </div>
                </div>
            ) : null}
        </div>
    )
}

function SummaryCard({ label, value, margin, color }: { label: string; value: number; margin?: number; color: 'emerald' | 'red' }) {
    return (
        <div className="rounded-xl border border-default bg-surface-0 p-4 shadow-card">
            <p className="text-xs font-medium uppercase text-surface-500">{label}</p>
            <p className={`mt-1 text-2xl font-bold ${color === 'emerald' ? 'text-emerald-600' : 'text-red-600'}`}>{fmtBRL(value)}</p>
            {margin !== undefined && (
                <p className="text-xs text-surface-400 mt-0.5">
                    {margin >= 0 ? <TrendingUp className="inline h-3 w-3 mr-0.5" /> : <TrendingDown className="inline h-3 w-3 mr-0.5" />}
                    Margem: {fmtPct(margin)}
                </p>
            )}
        </div>
    )
}

function DreRow({ label, value, revenue, bold, highlight }: { label: string; value: number; revenue: number; bold?: boolean; highlight?: 'green' | 'red' }) {
    const pctOfRevenue = revenue > 0 ? (Math.abs(value) / revenue) * 100 : 0
    const bgClass = highlight === 'green' ? 'bg-emerald-50/60 dark:bg-emerald-950/20' : highlight === 'red' ? 'bg-red-50/60 dark:bg-red-950/20' : ''
    const txtClass = highlight === 'green' ? 'text-emerald-700' : highlight === 'red' ? 'text-red-700' : value < 0 ? 'text-red-600' : 'text-surface-900'

    return (
        <tr className={`hover:bg-surface-50 transition-colors ${bgClass}`}>
            <td className={`px-5 py-3 text-sm ${bold ? 'font-bold' : 'font-medium'} ${txtClass}`}>{label}</td>
            <td className={`px-5 py-3 text-right text-sm ${bold ? 'font-bold' : ''} ${txtClass}`}>{fmtBRL(value)}</td>
            <td className="px-5 py-3 text-right text-xs text-surface-400">{fmtPct(pctOfRevenue)}</td>
        </tr>
    )
}
