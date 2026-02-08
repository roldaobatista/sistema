import { useQuery } from '@tanstack/react-query'
import { TrendingUp, TrendingDown, DollarSign, ArrowDownRight, ArrowUpRight, Wallet } from 'lucide-react'
import api from '@/lib/api'

const fmtBRL = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

export function CashFlowPage() {
    const { data: cashFlowRes, isLoading: cfLoading } = useQuery({
        queryKey: ['cash-flow'],
        queryFn: () => api.get('/cash-flow'),
    })

    const { data: dreRes, isLoading: dreLoading } = useQuery({
        queryKey: ['dre'],
        queryFn: () => api.get('/dre'),
    })

    const cashFlow = cashFlowRes?.data ?? []
    const dre = dreRes?.data ?? {}
    const isLoading = cfLoading || dreLoading

    return (
        <div className="space-y-6">
            <h1 className="text-2xl font-bold text-surface-900">Fluxo de Caixa & DRE</h1>

            {/* DRE Cards */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-xl border border-surface-200 bg-white p-4 shadow-card">
                    <div className="flex items-center gap-3">
                        <div className="rounded-lg p-2.5 text-emerald-600 bg-emerald-50"><ArrowUpRight className="h-5 w-5" /></div>
                        <div>
                            <p className="text-xs text-surface-500">Receitas (pago)</p>
                            <p className="text-lg font-bold text-surface-900">{isLoading ? '…' : fmtBRL(dre.revenue ?? 0)}</p>
                        </div>
                    </div>
                </div>
                <div className="rounded-xl border border-surface-200 bg-white p-4 shadow-card">
                    <div className="flex items-center gap-3">
                        <div className="rounded-lg p-2.5 text-red-600 bg-red-50"><ArrowDownRight className="h-5 w-5" /></div>
                        <div>
                            <p className="text-xs text-surface-500">Custos (pago)</p>
                            <p className="text-lg font-bold text-surface-900">{isLoading ? '…' : fmtBRL(dre.costs ?? 0)}</p>
                        </div>
                    </div>
                </div>
                <div className="rounded-xl border border-surface-200 bg-white p-4 shadow-card">
                    <div className="flex items-center gap-3">
                        <div className="rounded-lg p-2.5 text-blue-600 bg-blue-50"><DollarSign className="h-5 w-5" /></div>
                        <div>
                            <p className="text-xs text-surface-500">Lucro Bruto</p>
                            <p className={`text-lg font-bold ${(dre.gross_profit ?? 0) >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                                {isLoading ? '…' : fmtBRL(dre.gross_profit ?? 0)}
                            </p>
                        </div>
                    </div>
                </div>
                <div className="rounded-xl border border-surface-200 bg-white p-4 shadow-card">
                    <div className="flex items-center gap-3">
                        <div className="rounded-lg p-2.5 text-brand-600 bg-brand-50"><Wallet className="h-5 w-5" /></div>
                        <div>
                            <p className="text-xs text-surface-500">Saldo Líquido</p>
                            <p className={`text-lg font-bold ${(dre.net_balance ?? 0) >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                                {isLoading ? '…' : fmtBRL(dre.net_balance ?? 0)}
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Cash Flow Table */}
            <div className="rounded-xl border border-surface-200 bg-white shadow-card overflow-hidden">
                <div className="px-5 py-4 border-b border-surface-200">
                    <h2 className="font-semibold text-surface-900 flex items-center gap-2">
                        <TrendingUp className="h-5 w-5 text-brand-600" />
                        Fluxo de Caixa Mensal
                    </h2>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead className="bg-surface-50 text-surface-600">
                            <tr>
                                <th className="px-4 py-3 text-left font-medium">Mês</th>
                                <th className="px-4 py-3 text-right font-medium">A Receber</th>
                                <th className="px-4 py-3 text-right font-medium">Recebido</th>
                                <th className="px-4 py-3 text-right font-medium">A Pagar</th>
                                <th className="px-4 py-3 text-right font-medium">Pago</th>
                                <th className="px-4 py-3 text-right font-medium">Saldo</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-surface-100">
                            {cashFlow.map((row: any) => (
                                <tr key={row.month} className="hover:bg-surface-50 transition-colors">
                                    <td className="px-4 py-3 font-medium text-surface-900">{row.label}</td>
                                    <td className="px-4 py-3 text-right text-emerald-600">{fmtBRL(row.receivables_total)}</td>
                                    <td className="px-4 py-3 text-right text-emerald-700 font-semibold">{fmtBRL(row.receivables_paid)}</td>
                                    <td className="px-4 py-3 text-right text-red-500">{fmtBRL(row.payables_total)}</td>
                                    <td className="px-4 py-3 text-right text-red-600 font-semibold">{fmtBRL(row.payables_paid)}</td>
                                    <td className={`px-4 py-3 text-right font-bold ${row.balance >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                                        {fmtBRL(row.balance)}
                                    </td>
                                </tr>
                            ))}
                            {!isLoading && cashFlow.length === 0 && (
                                <tr><td colSpan={6} className="px-4 py-8 text-center text-surface-400">Sem dados no período</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    )
}
