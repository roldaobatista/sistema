import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { TrendingUp, TrendingDown, DollarSign, ArrowDownRight, ArrowUpRight, Wallet, ArrowRight } from 'lucide-react'
import api from '@/lib/api'
import { cn } from '@/lib/utils'

const fmtBRL = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

export function CashFlowPage() {
    const [osNumber, setOsNumber] = useState('')

    const { data: cashFlowRes, isLoading: cfLoading } = useQuery({
        queryKey: ['cash-flow', osNumber],
        queryFn: () => api.get('/cash-flow', { params: { ...(osNumber.trim() ? { os_number: osNumber.trim() } : {}) } }),
    })

    const { data: dreRes, isLoading: dreLoading } = useQuery({
        queryKey: ['dre', osNumber],
        queryFn: () => api.get('/dre', { params: { ...(osNumber.trim() ? { os_number: osNumber.trim() } : {}) } }),
    })

    const { data: dreCompRes, isLoading: compLoading } = useQuery({
        queryKey: ['dre-comparativo', osNumber],
        queryFn: () => api.get('/cash-flow/dre-comparativo', { params: { ...(osNumber.trim() ? { os_number: osNumber.trim() } : {}) } }),
    })

    const cashFlow = cashFlowRes?.data ?? []
    const dre = dreRes?.data ?? {}
    const dreComp = dreCompRes?.data
    const isLoading = cfLoading || dreLoading

    return (
        <div className="space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <h1 className="text-lg font-semibold text-surface-900 tracking-tight">Fluxo de Caixa & DRE</h1>
                <input
                    value={osNumber}
                    onChange={(e) => setOsNumber(e.target.value)}
                    placeholder="Filtrar por OS física (os_number)"
                    className="w-72 rounded-lg border border-default bg-surface-50 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
                />
            </div>

            {/* DRE Cards */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-xl border border-default bg-surface-0 p-4 shadow-card">
                    <div className="flex items-center gap-3">
                        <div className="rounded-lg p-2.5 text-emerald-600 bg-emerald-50"><ArrowUpRight className="h-5 w-5" /></div>
                        <div>
                            <p className="text-xs text-surface-500">Receitas (pago)</p>
                            <p className="text-[15px] font-semibold tabular-nums text-surface-900">{isLoading ? '…' : fmtBRL(dre.revenue ?? 0)}</p>
                        </div>
                    </div>
                </div>
                <div className="rounded-xl border border-default bg-surface-0 p-4 shadow-card">
                    <div className="flex items-center gap-3">
                        <div className="rounded-lg p-2.5 text-red-600 bg-red-50"><ArrowDownRight className="h-5 w-5" /></div>
                        <div>
                            <p className="text-xs text-surface-500">Custos (pago)</p>
                            <p className="text-[15px] font-semibold tabular-nums text-surface-900">{isLoading ? '…' : fmtBRL(dre.costs ?? 0)}</p>
                        </div>
                    </div>
                </div>
                <div className="rounded-xl border border-default bg-surface-0 p-4 shadow-card">
                    <div className="flex items-center gap-3">
                        <div className="rounded-lg p-2.5 text-blue-600 bg-blue-50"><DollarSign className="h-5 w-5" /></div>
                        <div>
                            <p className="text-xs text-surface-500">Lucro Bruto</p>
                            <p className={`text-[15px] font-semibold tabular-nums ${(dre.gross_profit ?? 0) >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                                {isLoading ? '…' : fmtBRL(dre.gross_profit ?? 0)}
                            </p>
                        </div>
                    </div>
                </div>
                <div className="rounded-xl border border-default bg-surface-0 p-4 shadow-card">
                    <div className="flex items-center gap-3">
                        <div className="rounded-lg p-2.5 text-brand-600 bg-brand-50"><Wallet className="h-5 w-5" /></div>
                        <div>
                            <p className="text-xs text-surface-500">Saldo Líquido</p>
                            <p className={`text-[15px] font-semibold tabular-nums ${(dre.net_balance ?? 0) >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                                {isLoading ? '…' : fmtBRL(dre.net_balance ?? 0)}
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* DRE Comparativo */}
            {dreComp && !compLoading && (
                <div className="rounded-xl border border-default bg-surface-0 shadow-card overflow-hidden">
                    <div className="px-5 py-4 border-b border-subtle">
                        <h2 className="font-semibold text-surface-900 flex items-center gap-2">
                            <ArrowRight className="h-5 w-5 text-brand-600" />
                            DRE Comparativo — Período Atual vs Anterior
                        </h2>
                    </div>
                    <div className="grid sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-surface-100">
                        {[
                            { label: 'Receita', cur: dreComp.current?.revenue ?? 0, prev: dreComp.previous?.revenue ?? 0, var: dreComp.variation?.revenue ?? 0 },
                            { label: 'Custos Totais', cur: dreComp.current?.total_costs ?? 0, prev: dreComp.previous?.total_costs ?? 0, var: dreComp.variation?.total_costs ?? 0 },
                            { label: 'Lucro Bruto', cur: dreComp.current?.gross_profit ?? 0, prev: dreComp.previous?.gross_profit ?? 0, var: dreComp.variation?.gross_profit ?? 0 },
                        ].map(item => (
                            <div key={item.label} className="p-5">
                                <p className="text-sm font-medium text-surface-500 mb-2">{item.label}</p>
                                <p className="text-xl font-bold text-surface-900">{fmtBRL(item.cur)}</p>
                                <div className="flex items-center gap-2 mt-1">
                                    <span className="text-xs text-surface-400">Anterior: {fmtBRL(item.prev)}</span>
                                    <span className={cn('inline-flex items-center gap-0.5 text-xs font-bold rounded-full px-2 py-0.5',
                                        item.label === 'Custos Totais'
                                            ? item.var <= 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
                                            : item.var >= 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
                                    )}>
                                        {item.var >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                                        {item.var >= 0 ? '+' : ''}{item.var}%
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Cash Flow Bar Chart */}
            {!isLoading && cashFlow.length > 0 && (() => {
                const maxAbs = Math.max(...cashFlow.map((r: any) => Math.abs(r.balance)), 1)
                return (
                    <div className="rounded-xl border border-default bg-surface-0 p-5 shadow-card">
                        <h3 className="text-sm font-semibold text-surface-900 mb-4">Saldo Mensal</h3>
                        <div className="flex items-end gap-2 h-32">
                            {cashFlow.map((r: any) => {
                                const isPositive = r.balance >= 0
                                const pct = Math.max((Math.abs(r.balance) / maxAbs) * 100, 4)
                                return (
                                    <div key={r.month} className="flex-1 flex flex-col items-center gap-1">
                                        <span className={cn('text-[10px] font-bold', isPositive ? 'text-emerald-600' : 'text-red-600')}>
                                            {fmtBRL(r.balance).replace('R$\u00a0', '')}
                                        </span>
                                        <div
                                            className={cn(
                                                'w-full rounded-t-md transition-all duration-700',
                                                isPositive ? 'bg-gradient-to-t from-emerald-500 to-emerald-400' : 'bg-gradient-to-t from-red-500 to-red-400'
                                            )}
                                            style={{ height: `${pct}%`, minHeight: 4 }}
                                        />
                                        <span className="text-[10px] text-surface-500">{r.label?.slice(0, 3)}</span>
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                )
            })()}
            {/* Cash Flow Table */}
            <div className="rounded-xl border border-default bg-surface-0 shadow-card overflow-hidden">
                <div className="px-5 py-4 border-b border-subtle">
                    <h2 className="font-semibold text-surface-900 flex items-center gap-2">
                        <TrendingUp className="h-5 w-5 text-brand-600" />
                        Fluxo de Caixa Mensal
                    </h2>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead className="bg-surface-50 text-surface-600">
                            <tr>
                                <th className="px-3.5 py-2.5 text-left font-medium">Mês</th>
                                <th className="px-3.5 py-2.5 text-right font-medium">A Receber</th>
                                <th className="px-3.5 py-2.5 text-right font-medium">Recebido</th>
                                <th className="px-3.5 py-2.5 text-right font-medium">A Pagar</th>
                                <th className="px-3.5 py-2.5 text-right font-medium">Pago</th>
                                <th className="px-3.5 py-2.5 text-right font-medium">Saldo</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-subtle">
                            {cashFlow.map((row: any) => (
                                <tr key={row.month} className="hover:bg-surface-50 transition-colors duration-100">
                                    <td className="px-4 py-3 font-medium text-surface-900">{row.label}</td>
                                    <td className="px-3.5 py-2.5 text-right text-emerald-600">{fmtBRL(row.receivables_total)}</td>
                                    <td className="px-3.5 py-2.5 text-right text-emerald-700 font-semibold">{fmtBRL(row.receivables_paid)}</td>
                                    <td className="px-3.5 py-2.5 text-right text-red-500">{fmtBRL(row.payables_total)}</td>
                                    <td className="px-3.5 py-2.5 text-right text-red-600 font-semibold">{fmtBRL(row.payables_paid)}</td>
                                    <td className={`px-3.5 py-2.5 text-right font-bold ${row.balance >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
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
