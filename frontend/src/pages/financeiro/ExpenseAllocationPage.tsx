import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { BarChart3, TrendingUp, TrendingDown, FileText } from 'lucide-react'
import api from '@/lib/api'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { PageHeader } from '@/components/ui/pageheader'
import { EmptyState } from '@/components/ui/emptystate'

const fmtBRL = (val: number) => val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

const todayStr = () => new Date().toISOString().slice(0, 10)
const monthStart = () => new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10)

interface Allocation {
    work_order_id: number; os_number: string; customer_name: string
    expense_count: number; total_expenses: number; work_order_total: number; net_margin: number | null
}

interface Summary { total_expenses_allocated: number; total_os_count: number; average_margin: number | null }

export function ExpenseAllocationPage() {
    const [from, setFrom] = useState(monthStart())
    const [to, setTo] = useState(todayStr())

    const { data: res, isLoading, isError, refetch } = useQuery({
        queryKey: ['expense-allocation', from, to],
        queryFn: () => api.get('/financial/expense-allocation', { params: { from, to } }),
    })
    const records: Allocation[] = res?.data?.data ?? []
    const summary: Summary | null = res?.data?.summary ?? null

    return (
        <div className="space-y-5">
            <PageHeader title="Alocação de Despesas por OS" subtitle="Despesas vinculadas a ordens de serviço e margem líquida" />

            <div className="flex flex-wrap gap-3 items-end">
                <Input label="De" type="date" value={from} onChange={e => setFrom(e.target.value)} className="w-44" />
                <Input label="Até" type="date" value={to} onChange={e => setTo(e.target.value)} className="w-44" />
            </div>

            {summary && (
                <div className="grid gap-4 sm:grid-cols-3">
                    <div className="rounded-xl border border-default bg-surface-0 p-4 shadow-card">
                        <p className="text-xs font-medium uppercase text-surface-500">OS com Despesas</p>
                        <p className="mt-1 text-2xl font-bold text-surface-900">{summary.total_os_count}</p>
                    </div>
                    <div className="rounded-xl border border-default bg-surface-0 p-4 shadow-card">
                        <p className="text-xs font-medium uppercase text-surface-500">Total Alocado</p>
                        <p className="mt-1 text-2xl font-bold text-red-600">{fmtBRL(summary.total_expenses_allocated)}</p>
                    </div>
                    <div className="rounded-xl border border-default bg-surface-0 p-4 shadow-card">
                        <p className="text-xs font-medium uppercase text-surface-500">Margem Média</p>
                        <p className={`mt-1 text-2xl font-bold ${(summary.average_margin ?? 0) >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                            {summary.average_margin != null ? `${summary.average_margin.toFixed(1)}%` : '—'}
                        </p>
                    </div>
                </div>
            )}

            <div className="overflow-hidden rounded-xl border border-default bg-surface-0 shadow-card">
                <table className="w-full">
                    <thead>
                        <tr className="border-b border-subtle bg-surface-50">
                            <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase text-surface-600">Nº OS</th>
                            <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase text-surface-600">Cliente</th>
                            <th className="px-4 py-2.5 text-right text-xs font-semibold uppercase text-surface-600">Despesas</th>
                            <th className="px-4 py-2.5 text-right text-xs font-semibold uppercase text-surface-600">Total Despesas</th>
                            <th className="px-4 py-2.5 text-right text-xs font-semibold uppercase text-surface-600">Valor OS</th>
                            <th className="px-4 py-2.5 text-right text-xs font-semibold uppercase text-surface-600">Margem</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-subtle">
                        {isLoading ? (
                            <tr><td colSpan={6} className="px-4 py-12 text-center text-sm text-surface-500">Carregando...</td></tr>
                        ) : isError ? (
                            <tr><td colSpan={6} className="px-4 py-12 text-center text-sm text-red-600">Erro ao carregar. <button className="underline" onClick={() => refetch()}>Tentar novamente</button></td></tr>
                        ) : records.length === 0 ? (
                            <tr><td colSpan={6} className="px-4 py-2"><EmptyState icon={<BarChart3 className="h-5 w-5 text-surface-300" />} message="Nenhuma alocação de despesa encontrada no período" compact /></td></tr>
                        ) : records.map(r => (
                            <tr key={r.work_order_id} className="hover:bg-surface-50 transition-colors">
                                <td className="px-4 py-3 text-sm font-medium text-surface-900">{r.os_number}</td>
                                <td className="px-4 py-3 text-sm text-surface-600">{r.customer_name ?? '—'}</td>
                                <td className="px-4 py-3 text-sm text-right text-surface-600">{r.expense_count}</td>
                                <td className="px-4 py-3 text-sm text-right text-red-600 font-medium">{fmtBRL(r.total_expenses)}</td>
                                <td className="px-4 py-3 text-sm text-right text-surface-900">{fmtBRL(r.work_order_total)}</td>
                                <td className="px-4 py-3 text-right">
                                    {r.net_margin != null ? (
                                        <Badge variant={r.net_margin >= 30 ? 'success' : r.net_margin >= 10 ? 'warning' : 'danger'}>
                                            {r.net_margin >= 0
                                                ? <TrendingUp className="inline h-3 w-3 mr-0.5" />
                                                : <TrendingDown className="inline h-3 w-3 mr-0.5" />
                                            }
                                            {r.net_margin.toFixed(1)}%
                                        </Badge>
                                    ) : <span className="text-surface-400">—</span>}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    )
}
