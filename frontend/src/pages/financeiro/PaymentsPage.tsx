import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Search, DollarSign, ArrowUpCircle, ArrowDownCircle, Calendar } from 'lucide-react'
import api from '@/lib/api'
import { Badge } from '@/components/ui/Badge'

interface Payment {
    id: number; payable_type: string; payable_id: number
    amount: string; payment_method: string | null; payment_date: string
    notes: string | null; created_at: string
}

interface PaymentSummary {
    total_received: number; total_paid: number; net: number; count: number
}

export function PaymentsPage() {
    const [type, setType] = useState<string>('')
    const [method, setMethod] = useState('')
    const [dateFrom, setDateFrom] = useState('')
    const [dateTo, setDateTo] = useState('')

    const { data: res, isLoading } = useQuery({
        queryKey: ['payments', type, method, dateFrom, dateTo],
        queryFn: () => api.get('/payments', {
            params: {
                type: type || undefined,
                payment_method: method || undefined,
                date_from: dateFrom || undefined,
                date_to: dateTo || undefined,
                per_page: 50,
            },
        }),
    })
    const payments: Payment[] = res?.data?.data ?? []

    const { data: summaryRes } = useQuery({
        queryKey: ['payments-summary', type, method, dateFrom, dateTo],
        queryFn: () => api.get('/payments-summary', {
            params: {
                type: type || undefined,
                payment_method: method || undefined,
                date_from: dateFrom || undefined,
                date_to: dateTo || undefined,
            },
        }),
    })
    const summary: PaymentSummary = summaryRes?.data ?? { total_received: 0, total_paid: 0, net: 0, count: 0 }

    const { data: methodsRes } = useQuery({
        queryKey: ['payment-methods'],
        queryFn: () => api.get('/payment-methods'),
    })
    const methods = methodsRes?.data ?? []

    const formatBRL = (v: number | string) => {
        const n = typeof v === 'string' ? parseFloat(v) : v
        return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
    }

    const formatDate = (d: string) => new Date(d).toLocaleDateString('pt-BR')

    const getTypeLabel = (t: string) => {
        if (t.includes('AccountReceivable')) return 'Recebimento'
        if (t.includes('AccountPayable')) return 'Pagamento'
        return t.split('\\').pop() ?? t
    }

    return (
        <div className="space-y-5">
            <div>
                <h1 className="text-lg font-semibold text-surface-900 tracking-tight">Pagamentos</h1>
                <p className="mt-0.5 text-[13px] text-surface-500">Histórico consolidado de todos os pagamentos</p>
            </div>

            {/* Summary Cards */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-xl border border-default bg-surface-0 p-4 shadow-card">
                    <div className="flex items-center gap-2 text-[13px] text-surface-500"><DollarSign className="h-4 w-4" /> Movimentações</div>
                    <p className="mt-1 text-lg font-semibold text-surface-900 tracking-tight">{summary.count}</p>
                </div>
                <div className="rounded-xl border border-default bg-surface-0 p-4 shadow-card">
                    <div className="flex items-center gap-2 text-sm text-emerald-600"><ArrowDownCircle className="h-4 w-4" /> Recebido</div>
                    <p className="mt-1 text-2xl font-bold text-emerald-700">{formatBRL(summary.total_received)}</p>
                </div>
                <div className="rounded-xl border border-default bg-surface-0 p-4 shadow-card">
                    <div className="flex items-center gap-2 text-sm text-red-600"><ArrowUpCircle className="h-4 w-4" /> Pago</div>
                    <p className="mt-1 text-2xl font-bold text-red-700">{formatBRL(summary.total_paid)}</p>
                </div>
                <div className="rounded-xl border border-default bg-surface-0 p-4 shadow-card">
                    <div className="flex items-center gap-2 text-[13px] text-surface-500"><DollarSign className="h-4 w-4" /> Saldo</div>
                    <p className={`mt-1 text-2xl font-bold ${summary.net >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                        {formatBRL(summary.net)}
                    </p>
                </div>
            </div>

            {/* Filters */}
            <div className="flex flex-wrap gap-3">
                <select value={type} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setType(e.target.value)}
                    className="rounded-lg border border-default bg-surface-50 px-3.5 py-2.5 text-sm focus:border-brand-400 focus:bg-surface-0 focus:outline-none focus:ring-2 focus:ring-brand-500/15">
                    <option value="">Todos os tipos</option>
                    <option value="receivable">Recebimentos</option>
                    <option value="payable">Pagamentos</option>
                </select>
                <select value={method} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setMethod(e.target.value)}
                    className="rounded-lg border border-default bg-surface-50 px-3.5 py-2.5 text-sm focus:border-brand-400 focus:bg-surface-0 focus:outline-none focus:ring-2 focus:ring-brand-500/15">
                    <option value="">Todos os métodos</option>
                    {methods.map((m: any) => <option key={m.id} value={m.code}>{m.name}</option>)}
                </select>
                <div className="flex items-center gap-1.5">
                    <Calendar className="h-4 w-4 text-surface-400" />
                    <input type="date" value={dateFrom} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDateFrom(e.target.value)}
                        className="rounded-lg border border-default bg-surface-50 px-3 py-2 text-sm focus:border-brand-400 focus:bg-surface-0 focus:outline-none focus:ring-2 focus:ring-brand-500/15" />
                    <span className="text-surface-400">—</span>
                    <input type="date" value={dateTo} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDateTo(e.target.value)}
                        className="rounded-lg border border-default bg-surface-50 px-3 py-2 text-sm focus:border-brand-400 focus:bg-surface-0 focus:outline-none focus:ring-2 focus:ring-brand-500/15" />
                </div>
            </div>

            {/* Table */}
            <div className="overflow-hidden rounded-xl border border-default bg-surface-0 shadow-card">
                <table className="w-full">
                    <thead>
                        <tr className="border-b border-subtle bg-surface-50">
                            <th className="px-3.5 py-2.5 text-left text-[11px] font-medium uppercase tracking-wider text-surface-500">Data</th>
                            <th className="px-3.5 py-2.5 text-left text-[11px] font-medium uppercase tracking-wider text-surface-500">Tipo</th>
                            <th className="hidden px-3.5 py-2.5 text-left text-[11px] font-medium uppercase tracking-wider text-surface-500 md:table-cell">Método</th>
                            <th className="px-3.5 py-2.5 text-right text-[11px] font-medium uppercase tracking-wider text-surface-500">Valor</th>
                            <th className="hidden px-3.5 py-2.5 text-left text-[11px] font-medium uppercase tracking-wider text-surface-500 lg:table-cell">Observações</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-subtle">
                        {isLoading ? (
                            <tr><td colSpan={5} className="px-4 py-12 text-center text-[13px] text-surface-500">Carregando...</td></tr>
                        ) : payments.length === 0 ? (
                            <tr><td colSpan={5} className="px-4 py-12 text-center text-[13px] text-surface-500">Nenhum pagamento encontrado</td></tr>
                        ) : payments.map(p => {
                            const isReceivable = p.payable_type.includes('AccountReceivable')
                            return (
                                <tr key={p.id} className="hover:bg-surface-50 transition-colors duration-100">
                                    <td className="px-4 py-3 text-sm text-surface-700">{formatDate(p.payment_date)}</td>
                                    <td className="px-4 py-3">
                                        <Badge variant={isReceivable ? 'success' : 'danger'}>
                                            {isReceivable ? '↓ Recebimento' : '↑ Pagamento'}
                                        </Badge>
                                    </td>
                                    <td className="hidden px-4 py-3 text-[13px] text-surface-600 md:table-cell">
                                        {p.payment_method || '—'}
                                    </td>
                                    <td className={`px-3.5 py-2.5 text-right text-sm font-semibold ${isReceivable ? 'text-emerald-700' : 'text-red-700'}`}>
                                        {isReceivable ? '+' : '-'}{formatBRL(p.amount)}
                                    </td>
                                    <td className="hidden max-w-xs truncate px-4 py-3 text-[13px] text-surface-500 lg:table-cell">
                                        {p.notes || '—'}
                                    </td>
                                </tr>
                            )
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    )
}
