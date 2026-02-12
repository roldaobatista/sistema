import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ArrowDownRight, ArrowRight, ArrowUpRight, DollarSign, TrendingDown, TrendingUp, Wallet } from 'lucide-react'
import api from '@/lib/api'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/Button'
import { useAuthStore } from '@/stores/auth-store'

type CashFlowRow = {
    month: string
    label: string
    receivables_total: number
    receivables_paid: number
    payables_total: number
    payables_paid: number
    expenses_total: number
    balance: number
    cash_balance?: number
}

type DrePayload = {
    period: { from: string; to: string; os_number: string | null }
    revenue: number
    costs: number
    expenses: number
    total_costs: number
    gross_profit: number
    net_balance: number
}

type DreComparativePayload = {
    current: { revenue: number; total_costs: number; gross_profit: number }
    previous: { revenue: number; total_costs: number; gross_profit: number }
    variation: { revenue: number; total_costs: number; gross_profit: number }
}

const fmtBRL = (value: number) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

export function CashFlowPage() {
    const { hasPermission, hasRole } = useAuthStore()
    const isSuperAdmin = hasRole('super_admin')
    const canViewDre = isSuperAdmin || hasPermission('finance.dre.view')

    const [osNumber, setOsNumber] = useState('')
    const [months, setMonths] = useState('12')
    const [dateFrom, setDateFrom] = useState('')
    const [dateTo, setDateTo] = useState('')

    const cashFlowQuery = useQuery({
        queryKey: ['cash-flow', months, osNumber],
        queryFn: async () => {
            const { data } = await api.get<CashFlowRow[]>('/cash-flow', {
                params: {
                    months: Number(months),
                    ...(osNumber.trim() ? { os_number: osNumber.trim() } : {}),
                },
            })
            return data
        },
    })

    const dreQuery = useQuery({
        queryKey: ['dre', osNumber, dateFrom, dateTo],
        queryFn: async () => {
            const { data } = await api.get<DrePayload>('/dre', {
                params: {
                    ...(osNumber.trim() ? { os_number: osNumber.trim() } : {}),
                    ...(dateFrom ? { date_from: dateFrom } : {}),
                    ...(dateTo ? { date_to: dateTo } : {}),
                },
            })
            return data
        },
        enabled: canViewDre,
    })

    const dreComparativeQuery = useQuery({
        queryKey: ['dre-comparativo', osNumber, dateFrom, dateTo],
        queryFn: async () => {
            const { data } = await api.get<DreComparativePayload>('/cash-flow/dre-comparativo', {
                params: {
                    ...(osNumber.trim() ? { os_number: osNumber.trim() } : {}),
                    ...(dateFrom ? { date_from: dateFrom } : {}),
                    ...(dateTo ? { date_to: dateTo } : {}),
                },
            })
            return data
        },
        enabled: canViewDre,
    })

    const cashFlow = cashFlowQuery.data ?? []
    const dre = dreQuery.data
    const dreComparative = dreComparativeQuery.data
    const isLoading = cashFlowQuery.isLoading || (canViewDre && dreQuery.isLoading)

    const resetFilters = () => {
        setOsNumber('')
        setMonths('12')
        setDateFrom('')
        setDateTo('')
    }

    return (
        <div className="space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <h1 className="text-lg font-semibold text-surface-900 tracking-tight">Fluxo de Caixa e DRE</h1>
            </div>

            <div className="flex flex-wrap items-end gap-3">
                <div className="space-y-1">
                    <label className="text-xs text-surface-500">OS</label>
                    <input
                        value={osNumber}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setOsNumber(e.target.value)}
                        placeholder="Filtrar por OS"
                        className="w-64 rounded-lg border border-default bg-surface-50 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
                    />
                </div>
                <div className="space-y-1">
                    <label className="text-xs text-surface-500">Meses</label>
                    <select
                        value={months}
                        onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setMonths(e.target.value)}
                        className="rounded-lg border border-default bg-surface-50 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
                    >
                        <option value="3">3</option>
                        <option value="6">6</option>
                        <option value="12">12</option>
                        <option value="24">24</option>
                        <option value="36">36</option>
                    </select>
                </div>
                <div className="space-y-1">
                    <label className="text-xs text-surface-500">Data inicial (DRE)</label>
                    <input
                        type="date"
                        value={dateFrom}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDateFrom(e.target.value)}
                        className="rounded-lg border border-default bg-surface-50 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
                    />
                </div>
                <div className="space-y-1">
                    <label className="text-xs text-surface-500">Data final (DRE)</label>
                    <input
                        type="date"
                        value={dateTo}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDateTo(e.target.value)}
                        className="rounded-lg border border-default bg-surface-50 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
                    />
                </div>
                <Button variant="outline" onClick={resetFilters}>Limpar filtros</Button>
            </div>

            {cashFlowQuery.error ? (
                <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    Erro ao carregar fluxo de caixa.
                </div>
            ) : null}

            {canViewDre && dreQuery.error ? (
                <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    Erro ao carregar DRE.
                </div>
            ) : null}

            {!canViewDre ? (
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
                    Sem permissao para visualizar DRE. O fluxo de caixa mensal permanece disponivel.
                </div>
            ) : null}

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-xl border border-default bg-surface-0 p-4 shadow-card">
                    <div className="flex items-center gap-3">
                        <div className="rounded-lg bg-emerald-50 p-2.5 text-emerald-600"><ArrowUpRight className="h-5 w-5" /></div>
                        <div>
                            <p className="text-xs text-surface-500">Receitas</p>
                            <p className="text-[15px] font-semibold tabular-nums text-surface-900">{isLoading || !canViewDre ? '-' : fmtBRL(dre?.revenue ?? 0)}</p>
                        </div>
                    </div>
                </div>
                <div className="rounded-xl border border-default bg-surface-0 p-4 shadow-card">
                    <div className="flex items-center gap-3">
                        <div className="rounded-lg bg-red-50 p-2.5 text-red-600"><ArrowDownRight className="h-5 w-5" /></div>
                        <div>
                            <p className="text-xs text-surface-500">Custos</p>
                            <p className="text-[15px] font-semibold tabular-nums text-surface-900">{isLoading || !canViewDre ? '-' : fmtBRL(dre?.costs ?? 0)}</p>
                        </div>
                    </div>
                </div>
                <div className="rounded-xl border border-default bg-surface-0 p-4 shadow-card">
                    <div className="flex items-center gap-3">
                        <div className="rounded-lg bg-blue-50 p-2.5 text-blue-600"><DollarSign className="h-5 w-5" /></div>
                        <div>
                            <p className="text-xs text-surface-500">Lucro bruto</p>
                            <p className={`text-[15px] font-semibold tabular-nums ${((dre?.gross_profit ?? 0) >= 0) ? 'text-emerald-600' : 'text-red-600'}`}>
                                {isLoading || !canViewDre ? '-' : fmtBRL(dre?.gross_profit ?? 0)}
                            </p>
                        </div>
                    </div>
                </div>
                <div className="rounded-xl border border-default bg-surface-0 p-4 shadow-card">
                    <div className="flex items-center gap-3">
                        <div className="rounded-lg bg-brand-50 p-2.5 text-brand-600"><Wallet className="h-5 w-5" /></div>
                        <div>
                            <p className="text-xs text-surface-500">Saldo liquido</p>
                            <p className={`text-[15px] font-semibold tabular-nums ${((dre?.net_balance ?? 0) >= 0) ? 'text-emerald-600' : 'text-red-600'}`}>
                                {isLoading || !canViewDre ? '-' : fmtBRL(dre?.net_balance ?? 0)}
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {canViewDre && dreComparative && !dreComparativeQuery.isLoading ? (
                <div className="overflow-hidden rounded-xl border border-default bg-surface-0 shadow-card">
                    <div className="border-b border-subtle px-5 py-4">
                        <h2 className="flex items-center gap-2 font-semibold text-surface-900">
                            <ArrowRight className="h-5 w-5 text-brand-600" />
                            DRE comparativo: periodo atual vs anterior
                        </h2>
                    </div>
                    <div className="grid divide-y divide-surface-100 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
                        {[
                            { label: 'Receita', cur: dreComparative.current?.revenue ?? 0, prev: dreComparative.previous?.revenue ?? 0, variation: dreComparative.variation?.revenue ?? 0 },
                            { label: 'Custos totais', cur: dreComparative.current?.total_costs ?? 0, prev: dreComparative.previous?.total_costs ?? 0, variation: dreComparative.variation?.total_costs ?? 0 },
                            { label: 'Lucro bruto', cur: dreComparative.current?.gross_profit ?? 0, prev: dreComparative.previous?.gross_profit ?? 0, variation: dreComparative.variation?.gross_profit ?? 0 },
                        ].map((item) => (
                            <div key={item.label} className="p-5">
                                <p className="mb-2 text-sm font-medium text-surface-500">{item.label}</p>
                                <p className="text-xl font-bold text-surface-900">{fmtBRL(item.cur)}</p>
                                <div className="mt-1 flex items-center gap-2">
                                    <span className="text-xs text-surface-400">Anterior: {fmtBRL(item.prev)}</span>
                                    <span className={cn(
                                        'inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-xs font-bold',
                                        item.label === 'Custos totais'
                                            ? item.variation <= 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
                                            : item.variation >= 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
                                    )}>
                                        {item.variation >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                                        {item.variation >= 0 ? '+' : ''}{item.variation}%
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            ) : null}

            {!isLoading && cashFlow.length > 0 ? (() => {
                const maxAbs = Math.max(...cashFlow.map((row) => Math.abs(row.cash_balance ?? row.balance)), 1)

                return (
                    <div className="rounded-xl border border-default bg-surface-0 p-5 shadow-card">
                        <h3 className="mb-4 text-sm font-semibold text-surface-900">Saldo de caixa mensal</h3>
                        <div className="flex h-32 items-end gap-2">
                            {cashFlow.map((row) => {
                                const value = row.cash_balance ?? row.balance
                                const positive = value >= 0
                                const pct = Math.max((Math.abs(value) / maxAbs) * 100, 4)

                                return (
                                    <div key={row.month} className="flex flex-1 flex-col items-center gap-1">
                                        <span className={cn('text-[10px] font-bold', positive ? 'text-emerald-600' : 'text-red-600')}>
                                            {fmtBRL(value).replace('R$\u00a0', '')}
                                        </span>
                                        <div
                                            className={cn(
                                                'w-full rounded-t-md transition-all duration-700',
                                                positive ? 'bg-gradient-to-t from-emerald-500 to-emerald-400' : 'bg-gradient-to-t from-red-500 to-red-400'
                                            )}
                                            style={{ height: `${pct}%`, minHeight: 4 }}
                                        />
                                        <span className="text-[10px] text-surface-500">{row.label?.slice(0, 3)}</span>
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                )
            })() : null}

            <div className="overflow-hidden rounded-xl border border-default bg-surface-0 shadow-card">
                <div className="border-b border-subtle px-5 py-4">
                    <h2 className="flex items-center gap-2 font-semibold text-surface-900">
                        <TrendingUp className="h-5 w-5 text-brand-600" />
                        Fluxo de caixa mensal
                    </h2>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead className="bg-surface-50 text-surface-600">
                            <tr>
                                <th className="px-3.5 py-2.5 text-left font-medium">Mes</th>
                                <th className="px-3.5 py-2.5 text-right font-medium">A receber</th>
                                <th className="px-3.5 py-2.5 text-right font-medium">Recebido</th>
                                <th className="px-3.5 py-2.5 text-right font-medium">A pagar</th>
                                <th className="px-3.5 py-2.5 text-right font-medium">Pago</th>
                                <th className="px-3.5 py-2.5 text-right font-medium">Despesas</th>
                                <th className="px-3.5 py-2.5 text-right font-medium">Saldo caixa</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-subtle">
                            {cashFlow.map((row) => {
                                const cashBalance = row.cash_balance ?? row.balance
                                return (
                                    <tr key={row.month} className="transition-colors duration-100 hover:bg-surface-50">
                                        <td className="px-4 py-3 font-medium text-surface-900">{row.label}</td>
                                        <td className="px-3.5 py-2.5 text-right text-emerald-600">{fmtBRL(row.receivables_total)}</td>
                                        <td className="px-3.5 py-2.5 text-right font-semibold text-emerald-700">{fmtBRL(row.receivables_paid)}</td>
                                        <td className="px-3.5 py-2.5 text-right text-red-500">{fmtBRL(row.payables_total)}</td>
                                        <td className="px-3.5 py-2.5 text-right font-semibold text-red-600">{fmtBRL(row.payables_paid)}</td>
                                        <td className="px-3.5 py-2.5 text-right text-red-600">{fmtBRL(row.expenses_total)}</td>
                                        <td className={`px-3.5 py-2.5 text-right font-bold ${cashBalance >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                                            {fmtBRL(cashBalance)}
                                        </td>
                                    </tr>
                                )
                            })}
                            {!isLoading && cashFlow.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="px-4 py-8 text-center text-surface-400">Sem dados no periodo</td>
                                </tr>
                            ) : null}
                            {isLoading ? (
                                <tr>
                                    <td colSpan={7} className="px-4 py-8 text-center text-surface-500">Carregando...</td>
                                </tr>
                            ) : null}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    )
}
