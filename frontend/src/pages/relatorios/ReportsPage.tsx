import React, { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
    ClipboardList, Users, DollarSign, Award, TrendingUp,
    Calendar, ArrowRight, FileText, Phone, Wallet, Target, Scale, Download,
} from 'lucide-react'
import api from '@/lib/api'
import { cn } from '@/lib/utils'
import { Input } from '@/components/ui/Input'
import { Badge } from '@/components/ui/Badge'

const fmtBRL = (val: number) => val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const fmtHours = (min: number) => `${Math.floor(min / 60)}h ${min % 60}m`

type Tab = 'os' | 'productivity' | 'financial' | 'commissions' | 'profitability' | 'quotes' | 'service_calls' | 'technician_cash' | 'crm' | 'equipments'

const tabs: { key: Tab; label: string; icon: any }[] = [
    { key: 'os', label: 'Ordens', icon: ClipboardList },
    { key: 'productivity', label: 'Produtividade', icon: Users },
    { key: 'financial', label: 'Financeiro', icon: DollarSign },
    { key: 'commissions', label: 'Comissões', icon: Award },
    { key: 'profitability', label: 'Margem', icon: TrendingUp },
    { key: 'quotes', label: 'Orçamentos', icon: FileText },
    { key: 'service_calls', label: 'Chamados', icon: Phone },
    { key: 'technician_cash', label: 'Caixa', icon: Wallet },
    { key: 'crm', label: 'CRM', icon: Target },
    { key: 'equipments', label: 'Equipamentos', icon: Scale },
]

const statusLabels: Record<string, string> = {
    open: 'Aberta', in_progress: 'Em Andamento', waiting_parts: 'Aguardando Peças',
    waiting_approval: 'Aguardando Aprovação', completed: 'Concluída', delivered: 'Entregue', cancelled: 'Cancelada',
    pending: 'Pendente', approved: 'Aprovado', paid: 'Pago', reversed: 'Estornado',
}

const priorityLabels: Record<string, string> = {
    low: 'Baixa', normal: 'Normal', high: 'Alta', urgent: 'Urgente',
}

export function ReportsPage() {
    const [tab, setTab] = useState<Tab>('os')
    const today = new Date().toISOString().split('T')[0]
    const monthStart = today.slice(0, 7) + '-01'
    const [from, setFrom] = useState(monthStart)
    const [to, setTo] = useState(today)

    const endpoint: Record<Tab, string> = {
        os: '/reports/work-orders',
        productivity: '/reports/productivity',
        financial: '/reports/financial',
        commissions: '/reports/commissions',
        profitability: '/reports/profitability',
        quotes: '/reports/quotes',
        service_calls: '/reports/service-calls',
        technician_cash: '/reports/technician-cash',
        crm: '/reports/crm',
        equipments: '/reports/equipments',
    }

    const { data: res, isLoading } = useQuery({
        queryKey: ['report', tab, from, to],
        queryFn: () => api.get(endpoint[tab], { params: { from, to } }),
    })
    const data = res?.data ?? {}

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold text-surface-900">Relatórios</h1>
                <p className="mt-1 text-sm text-surface-500">Análise de desempenho e resultados</p>
            </div>

            {/* Tabs */}
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex flex-wrap rounded-lg border border-surface-200 bg-surface-50 p-0.5">
                    {tabs.map(t => {
                        const Icon = t.icon
                        return (
                            <button key={t.key} onClick={() => setTab(t.key)}
                                className={cn('flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-all',
                                    tab === t.key ? 'bg-white text-brand-700 shadow-sm' : 'text-surface-500 hover:text-surface-700')}>
                                <Icon className="h-3.5 w-3.5" />{t.label}
                            </button>
                        )
                    })}
                </div>
                <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-surface-400" />
                    <input type="date" value={from} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFrom(e.target.value)} aria-label="Data início"
                        className="rounded-lg border border-surface-300 bg-white px-3 py-1.5 text-sm focus:border-brand-500 focus:outline-none" />
                    <ArrowRight className="h-3.5 w-3.5 text-surface-400" />
                    <input type="date" value={to} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTo(e.target.value)} aria-label="Data fim"
                        className="rounded-lg border border-surface-300 bg-white px-3 py-1.5 text-sm focus:border-brand-500 focus:outline-none" />
                    <button
                        onClick={() => window.open(`${api.defaults.baseURL}/reports/${tab}/export?from=${from}&to=${to}`, '_blank')}
                        title="Exportar CSV"
                        className="flex items-center gap-1.5 rounded-lg border border-surface-300 bg-white px-3 py-1.5 text-sm font-medium text-surface-600 hover:bg-surface-50 transition-colors"
                    >
                        <Download className="h-3.5 w-3.5" />
                        CSV
                    </button>
                </div>
            </div>

            {isLoading && <div className="py-12 text-center text-sm text-surface-500">Carregando relatório...</div>}

            {/* OS Report */}
            {tab === 'os' && !isLoading && (
                <div className="space-y-6">
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                        {(data.by_status ?? []).map((s: any) => (
                            <div key={s.status} className="rounded-xl border border-surface-200 bg-white p-4 shadow-card">
                                <span className="text-xs font-medium text-surface-500">{statusLabels[s.status] ?? s.status}</span>
                                <p className="text-2xl font-bold text-surface-900">{s.count}</p>
                                <p className="text-xs text-surface-400">{fmtBRL(Number(s.total ?? 0))}</p>
                            </div>
                        ))}
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                        <div className="rounded-xl border border-surface-200 bg-white p-5 shadow-card">
                            <h3 className="mb-3 text-sm font-semibold text-surface-700">Por Prioridade</h3>
                            <div className="space-y-2">
                                {(data.by_priority ?? []).map((p: any) => (
                                    <div key={p.priority} className="flex items-center justify-between">
                                        <span className="text-sm">{priorityLabels[p.priority] ?? p.priority}</span>
                                        <span className="text-sm font-bold">{p.count}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div className="rounded-xl border border-surface-200 bg-white p-5 shadow-card">
                            <h3 className="mb-3 text-sm font-semibold text-surface-700">Métricas</h3>
                            <div className="space-y-3">
                                <div>
                                    <span className="text-xs text-surface-500">Tempo médio de conclusão</span>
                                    <p className="text-lg font-bold text-surface-900">{data.avg_completion_hours ?? 0}h</p>
                                </div>
                            </div>
                        </div>
                    </div>
                    {(data.monthly ?? []).length > 0 && (
                        <div className="rounded-xl border border-surface-200 bg-white p-5 shadow-card">
                            <h3 className="mb-3 text-sm font-semibold text-surface-700">Evolução Mensal</h3>
                            <div className="space-y-2">
                                {data.monthly.map((m: any) => (
                                    <div key={m.period} className="flex items-center gap-3">
                                        <span className="w-16 text-xs font-medium text-surface-500">{m.period}</span>
                                        <div className="flex-1 rounded-full bg-surface-100 h-5">
                                            <div className="h-5 rounded-full bg-brand-500 flex items-center px-2"
                                                style={{ width: `${Math.min(100, (m.count / Math.max(...data.monthly.map((x: any) => x.count))) * 100)}%` }}>
                                                <span className="text-[10px] font-bold text-white">{m.count}</span>
                                            </div>
                                        </div>
                                        <span className="text-xs font-medium text-surface-600">{fmtBRL(Number(m.total))}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Productivity Report */}
            {tab === 'productivity' && !isLoading && (
                <div className="space-y-6">
                    <div className="overflow-hidden rounded-xl border border-surface-200 bg-white shadow-card">
                        <table className="w-full">
                            <thead>
                                <tr className="border-b border-surface-200 bg-surface-50">
                                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-surface-600">Técnico</th>
                                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-surface-600">Trabalho</th>
                                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-surface-600">Deslocamento</th>
                                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-surface-600">Espera</th>
                                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-surface-600">OS Atend.</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-surface-100">
                                {(data.technicians ?? []).length === 0 ? (
                                    <tr><td colSpan={5} className="px-4 py-8 text-center text-sm text-surface-500">Sem dados</td></tr>
                                ) : (data.technicians ?? []).map((t: any) => (
                                    <tr key={t.id} className="hover:bg-surface-50">
                                        <td className="px-4 py-3 text-sm font-medium text-surface-900">{t.name}</td>
                                        <td className="px-4 py-3 text-right text-sm text-emerald-600 font-semibold">{fmtHours(t.work_minutes ?? 0)}</td>
                                        <td className="px-4 py-3 text-right text-sm text-sky-600">{fmtHours(t.travel_minutes ?? 0)}</td>
                                        <td className="px-4 py-3 text-right text-sm text-amber-600">{fmtHours(t.waiting_minutes ?? 0)}</td>
                                        <td className="px-4 py-3 text-right text-sm font-bold">{t.os_count}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    {(data.completed_by_tech ?? []).length > 0 && (
                        <div className="rounded-xl border border-surface-200 bg-white p-5 shadow-card">
                            <h3 className="mb-3 text-sm font-semibold text-surface-700">OS Concluídas por Técnico</h3>
                            <div className="space-y-2">
                                {data.completed_by_tech.map((t: any) => (
                                    <div key={t.assignee_id} className="flex items-center justify-between rounded-lg bg-surface-50 p-3">
                                        <span className="text-sm font-medium">{t.assignee?.name ?? `#${t.assignee_id}`}</span>
                                        <div className="text-right">
                                            <span className="text-sm font-bold">{t.count} OS</span>
                                            <span className="ml-2 text-xs text-surface-500">{fmtBRL(Number(t.total))}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Financial Report */}
            {tab === 'financial' && !isLoading && (
                <div className="space-y-6">
                    <div className="grid gap-3 sm:grid-cols-2">
                        <div className="rounded-xl border border-surface-200 bg-white p-5 shadow-card">
                            <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-emerald-700">
                                <DollarSign className="h-4 w-4" /> Contas a Receber
                            </h3>
                            <div className="space-y-2">
                                <div className="flex justify-between"><span className="text-sm text-surface-500">Total</span><span className="text-sm font-bold">{fmtBRL(Number(data.receivable?.total ?? 0))}</span></div>
                                <div className="flex justify-between"><span className="text-sm text-surface-500">Recebido</span><span className="text-sm font-bold text-emerald-600">{fmtBRL(Number(data.receivable?.total_paid ?? 0))}</span></div>
                                <div className="flex justify-between"><span className="text-sm text-surface-500">Vencido</span><span className="text-sm font-bold text-red-600">{fmtBRL(Number(data.receivable?.overdue ?? 0))}</span></div>
                                <div className="flex justify-between"><span className="text-sm text-surface-500">Títulos</span><span className="text-sm font-bold">{data.receivable?.count ?? 0}</span></div>
                            </div>
                        </div>
                        <div className="rounded-xl border border-surface-200 bg-white p-5 shadow-card">
                            <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-red-700">
                                <DollarSign className="h-4 w-4" /> Contas a Pagar
                            </h3>
                            <div className="space-y-2">
                                <div className="flex justify-between"><span className="text-sm text-surface-500">Total</span><span className="text-sm font-bold">{fmtBRL(Number(data.payable?.total ?? 0))}</span></div>
                                <div className="flex justify-between"><span className="text-sm text-surface-500">Pago</span><span className="text-sm font-bold text-emerald-600">{fmtBRL(Number(data.payable?.total_paid ?? 0))}</span></div>
                                <div className="flex justify-between"><span className="text-sm text-surface-500">Contas</span><span className="text-sm font-bold">{data.payable?.count ?? 0}</span></div>
                            </div>
                        </div>
                    </div>
                    {(data.expenses_by_category ?? []).length > 0 && (
                        <div className="rounded-xl border border-surface-200 bg-white p-5 shadow-card">
                            <h3 className="mb-3 text-sm font-semibold text-surface-700">Despesas por Categoria</h3>
                            <div className="space-y-2">
                                {data.expenses_by_category.map((c: any, i: number) => (
                                    <div key={i} className="flex items-center justify-between rounded-lg bg-surface-50 p-3">
                                        <span className="text-sm font-medium">{c.category ?? 'Sem categoria'}</span>
                                        <span className="text-sm font-bold">{fmtBRL(Number(c.total))}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                    {(data.monthly_flow ?? []).length > 0 && (
                        <div className="rounded-xl border border-surface-200 bg-white p-5 shadow-card">
                            <h3 className="mb-3 text-sm font-semibold text-surface-700">Fluxo de Caixa Mensal</h3>
                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead>
                                        <tr className="text-xs text-surface-500">
                                            <th className="py-2 text-left">Período</th>
                                            <th className="py-2 text-right">Entradas</th>
                                            <th className="py-2 text-right">Saídas</th>
                                            <th className="py-2 text-right">Saldo</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-surface-100">
                                        {data.monthly_flow.map((m: any) => (
                                            <tr key={m.period}>
                                                <td className="py-2 text-sm font-medium">{m.period}</td>
                                                <td className="py-2 text-right text-sm text-emerald-600 font-semibold">{fmtBRL(Number(m.income))}</td>
                                                <td className="py-2 text-right text-sm text-red-600">{fmtBRL(Number(m.expense))}</td>
                                                <td className={cn('py-2 text-right text-sm font-bold', Number(m.balance) >= 0 ? 'text-emerald-600' : 'text-red-600')}>
                                                    {fmtBRL(Number(m.balance))}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Commissions Report */}
            {tab === 'commissions' && !isLoading && (
                <div className="space-y-6">
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                        {(data.by_status ?? []).map((s: any) => (
                            <div key={s.status} className="rounded-xl border border-surface-200 bg-white p-4 shadow-card">
                                <span className="text-xs font-medium text-surface-500">{statusLabels[s.status] ?? s.status}</span>
                                <p className="text-2xl font-bold text-surface-900">{s.count}</p>
                                <p className="text-xs text-surface-400">{fmtBRL(Number(s.total))}</p>
                            </div>
                        ))}
                    </div>
                    <div className="overflow-hidden rounded-xl border border-surface-200 bg-white shadow-card">
                        <table className="w-full">
                            <thead>
                                <tr className="border-b border-surface-200 bg-surface-50">
                                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-surface-600">Técnico</th>
                                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-surface-600">Eventos</th>
                                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-surface-600">Total</th>
                                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-surface-600">Pendente</th>
                                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-surface-600">Pago</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-surface-100">
                                {(data.by_technician ?? []).length === 0 ? (
                                    <tr><td colSpan={5} className="px-4 py-8 text-center text-sm text-surface-500">Sem dados</td></tr>
                                ) : (data.by_technician ?? []).map((t: any) => (
                                    <tr key={t.id} className="hover:bg-surface-50">
                                        <td className="px-4 py-3 text-sm font-medium text-surface-900">{t.name}</td>
                                        <td className="px-4 py-3 text-right text-sm">{t.events_count}</td>
                                        <td className="px-4 py-3 text-right text-sm font-bold">{fmtBRL(Number(t.total_commission))}</td>
                                        <td className="px-4 py-3 text-right text-sm text-amber-600">{fmtBRL(Number(t.pending))}</td>
                                        <td className="px-4 py-3 text-right text-sm text-emerald-600">{fmtBRL(Number(t.paid))}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Profitability Report */}
            {tab === 'profitability' && !isLoading && (
                <div className="space-y-6">
                    <div className="rounded-xl border border-surface-200 bg-white p-6 shadow-card">
                        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
                            <div>
                                <span className="text-xs font-medium text-surface-500">Receita</span>
                                <p className="text-2xl font-bold text-emerald-600">{fmtBRL(data.revenue ?? 0)}</p>
                            </div>
                            <div>
                                <span className="text-xs font-medium text-surface-500">Custos (AP)</span>
                                <p className="text-2xl font-bold text-red-600">{fmtBRL(data.costs ?? 0)}</p>
                            </div>
                            <div>
                                <span className="text-xs font-medium text-surface-500">Despesas</span>
                                <p className="text-2xl font-bold text-amber-600">{fmtBRL(data.expenses ?? 0)}</p>
                            </div>
                            <div>
                                <span className="text-xs font-medium text-surface-500">Comissões</span>
                                <p className="text-2xl font-bold text-sky-600">{fmtBRL(data.commissions ?? 0)}</p>
                            </div>
                        </div>

                        <div className="mt-6 border-t border-surface-200 pt-6">
                            <div className="grid gap-6 sm:grid-cols-3">
                                <div>
                                    <span className="text-xs font-medium text-surface-500">Total Custos</span>
                                    <p className="text-xl font-bold text-red-600">{fmtBRL(data.total_costs ?? 0)}</p>
                                </div>
                                <div>
                                    <span className="text-xs font-medium text-surface-500">Lucro</span>
                                    <p className={cn('text-xl font-bold', (data.profit ?? 0) >= 0 ? 'text-emerald-600' : 'text-red-600')}>
                                        {fmtBRL(data.profit ?? 0)}
                                    </p>
                                </div>
                                <div>
                                    <span className="text-xs font-medium text-surface-500">Margem</span>
                                    <p className={cn('text-3xl font-bold', (data.margin_pct ?? 0) >= 0 ? 'text-emerald-600' : 'text-red-600')}>
                                        {data.margin_pct ?? 0}%
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Visual breakdown bar */}
                    {(data.revenue ?? 0) > 0 && (
                        <div className="rounded-xl border border-surface-200 bg-white p-5 shadow-card">
                            <h3 className="mb-3 text-sm font-semibold text-surface-700">Composição dos Custos</h3>
                            <div className="flex h-8 overflow-hidden rounded-full bg-surface-100">
                                {data.costs > 0 && (
                                    <div className="flex items-center justify-center bg-red-500 text-[10px] font-bold text-white"
                                        style={{ width: `${(data.costs / data.total_costs) * 100}%` }}>AP</div>
                                )}
                                {data.expenses > 0 && (
                                    <div className="flex items-center justify-center bg-amber-500 text-[10px] font-bold text-white"
                                        style={{ width: `${(data.expenses / data.total_costs) * 100}%` }}>Desp</div>
                                )}
                                {data.commissions > 0 && (
                                    <div className="flex items-center justify-center bg-sky-500 text-[10px] font-bold text-white"
                                        style={{ width: `${(data.commissions / data.total_costs) * 100}%` }}>Com</div>
                                )}
                            </div>
                            <div className="mt-2 flex gap-4 text-xs text-surface-500">
                                <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-red-500" />AP {((data.costs / data.total_costs) * 100).toFixed(0)}%</span>
                                <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-amber-500" />Despesas {((data.expenses / data.total_costs) * 100).toFixed(0)}%</span>
                                <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-sky-500" />Comissões {((data.commissions / data.total_costs) * 100).toFixed(0)}%</span>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Quotes Report */}
            {tab === 'quotes' && !isLoading && (
                <div className="space-y-6">
                    <div className="grid gap-3 sm:grid-cols-3">
                        <div className="rounded-xl border border-surface-200 bg-white p-5 shadow-card text-center">
                            <span className="text-xs font-medium text-surface-500">Total</span>
                            <p className="text-3xl font-bold text-surface-900">{data.total ?? 0}</p>
                        </div>
                        <div className="rounded-xl border border-surface-200 bg-white p-5 shadow-card text-center">
                            <span className="text-xs font-medium text-surface-500">Aprovados</span>
                            <p className="text-3xl font-bold text-emerald-600">{data.approved ?? 0}</p>
                        </div>
                        <div className="rounded-xl border border-surface-200 bg-white p-5 shadow-card text-center">
                            <span className="text-xs font-medium text-surface-500">Taxa de Conversão</span>
                            <p className="text-3xl font-bold text-brand-600">{data.conversion_rate ?? 0}%</p>
                        </div>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                        <div className="rounded-xl border border-surface-200 bg-white p-5 shadow-card">
                            <h3 className="mb-3 text-sm font-semibold text-surface-700">Por Status</h3>
                            <div className="space-y-2">
                                {(data.by_status ?? []).map((s: any) => (
                                    <div key={s.status} className="flex items-center justify-between rounded-lg bg-surface-50 p-3">
                                        <span className="text-sm font-medium">{statusLabels[s.status] ?? s.status}</span>
                                        <div><span className="text-sm font-bold">{s.count}</span><span className="ml-2 text-xs text-surface-500">{fmtBRL(Number(s.total ?? 0))}</span></div>
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div className="rounded-xl border border-surface-200 bg-white p-5 shadow-card">
                            <h3 className="mb-3 text-sm font-semibold text-surface-700">Por Vendedor</h3>
                            <div className="space-y-2">
                                {(data.by_seller ?? []).map((s: any) => (
                                    <div key={s.id} className="flex items-center justify-between rounded-lg bg-surface-50 p-3">
                                        <span className="text-sm font-medium">{s.name}</span>
                                        <div><span className="text-sm font-bold">{s.count}</span><span className="ml-2 text-xs text-surface-500">{fmtBRL(Number(s.total ?? 0))}</span></div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Service Calls Report */}
            {tab === 'service_calls' && !isLoading && (
                <div className="space-y-6">
                    <div className="grid gap-3 sm:grid-cols-2">
                        <div className="rounded-xl border border-surface-200 bg-white p-5 shadow-card text-center">
                            <span className="text-xs font-medium text-surface-500">Total Chamados</span>
                            <p className="text-3xl font-bold text-surface-900">{data.total ?? 0}</p>
                        </div>
                        <div className="rounded-xl border border-surface-200 bg-white p-5 shadow-card text-center">
                            <span className="text-xs font-medium text-surface-500">Concluídos</span>
                            <p className="text-3xl font-bold text-emerald-600">{data.completed ?? 0}</p>
                        </div>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-3">
                        <div className="rounded-xl border border-surface-200 bg-white p-5 shadow-card">
                            <h3 className="mb-3 text-sm font-semibold text-surface-700">Por Status</h3>
                            <div className="space-y-2">
                                {(data.by_status ?? []).map((s: any) => (
                                    <div key={s.status} className="flex justify-between text-sm"><span>{statusLabels[s.status] ?? s.status}</span><span className="font-bold">{s.count}</span></div>
                                ))}
                            </div>
                        </div>
                        <div className="rounded-xl border border-surface-200 bg-white p-5 shadow-card">
                            <h3 className="mb-3 text-sm font-semibold text-surface-700">Por Prioridade</h3>
                            <div className="space-y-2">
                                {(data.by_priority ?? []).map((p: any) => (
                                    <div key={p.priority} className="flex justify-between text-sm"><span>{priorityLabels[p.priority] ?? p.priority}</span><span className="font-bold">{p.count}</span></div>
                                ))}
                            </div>
                        </div>
                        <div className="rounded-xl border border-surface-200 bg-white p-5 shadow-card">
                            <h3 className="mb-3 text-sm font-semibold text-surface-700">Por Técnico</h3>
                            <div className="space-y-2">
                                {(data.by_technician ?? []).map((t: any) => (
                                    <div key={t.id} className="flex justify-between text-sm"><span>{t.name}</span><span className="font-bold">{t.count}</span></div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Technician Cash Report */}
            {tab === 'technician_cash' && !isLoading && (
                <div className="space-y-6">
                    <div className="grid gap-3 sm:grid-cols-3">
                        <div className="rounded-xl border border-surface-200 bg-white p-5 shadow-card text-center">
                            <span className="text-xs font-medium text-surface-500">Saldo Total</span>
                            <p className="text-2xl font-bold text-surface-900">{fmtBRL(data.total_balance ?? 0)}</p>
                        </div>
                        <div className="rounded-xl border border-surface-200 bg-white p-5 shadow-card text-center">
                            <span className="text-xs font-medium text-surface-500">Créditos (período)</span>
                            <p className="text-2xl font-bold text-emerald-600">{fmtBRL(data.total_credits ?? 0)}</p>
                        </div>
                        <div className="rounded-xl border border-surface-200 bg-white p-5 shadow-card text-center">
                            <span className="text-xs font-medium text-surface-500">Débitos (período)</span>
                            <p className="text-2xl font-bold text-red-600">{fmtBRL(data.total_debits ?? 0)}</p>
                        </div>
                    </div>
                    <div className="overflow-hidden rounded-xl border border-surface-200 bg-white shadow-card">
                        <table className="w-full">
                            <thead>
                                <tr className="border-b border-surface-200 bg-surface-50">
                                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-surface-600">Técnico</th>
                                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-surface-600">Saldo</th>
                                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-surface-600">Créditos</th>
                                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-surface-600">Débitos</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-surface-100">
                                {(data.funds ?? []).length === 0 ? (
                                    <tr><td colSpan={4} className="px-4 py-8 text-center text-sm text-surface-500">Sem dados</td></tr>
                                ) : (data.funds ?? []).map((f: any) => (
                                    <tr key={f.user_id} className="hover:bg-surface-50">
                                        <td className="px-4 py-3 text-sm font-medium text-surface-900">{f.user_name}</td>
                                        <td className="px-4 py-3 text-right text-sm font-bold">{fmtBRL(f.balance)}</td>
                                        <td className="px-4 py-3 text-right text-sm text-emerald-600">{fmtBRL(f.credits_period)}</td>
                                        <td className="px-4 py-3 text-right text-sm text-red-600">{fmtBRL(f.debits_period)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* CRM Report */}
            {tab === 'crm' && !isLoading && (
                <div className="space-y-6">
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                        {(data.deals_by_status ?? []).map((s: any) => (
                            <div key={s.status} className="rounded-xl border border-surface-200 bg-white p-4 shadow-card">
                                <span className="text-xs font-medium text-surface-500 capitalize">{s.status}</span>
                                <p className="text-2xl font-bold text-surface-900">{s.count}</p>
                                <p className="text-xs text-surface-400">{fmtBRL(Number(s.value ?? 0))}</p>
                            </div>
                        ))}
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                        <div className="rounded-xl border border-surface-200 bg-white p-5 shadow-card">
                            <h3 className="mb-3 text-sm font-semibold text-surface-700">Por Vendedor</h3>
                            <div className="space-y-2">
                                {(data.deals_by_seller ?? []).map((s: any) => (
                                    <div key={s.owner_id} className="flex items-center justify-between rounded-lg bg-surface-50 p-3">
                                        <span className="text-sm font-medium">{s.owner_name ?? `#${s.owner_id}`}</span>
                                        <div><span className="text-sm font-bold">{s.count}</span><span className="ml-2 text-xs text-surface-500">{fmtBRL(Number(s.value ?? 0))}</span></div>
                                    </div>
                                ))}
                                {(data.deals_by_seller ?? []).length === 0 && <p className="py-4 text-center text-sm text-surface-400">Sem dados</p>}
                            </div>
                        </div>
                        <div className="rounded-xl border border-surface-200 bg-white p-5 shadow-card">
                            <h3 className="mb-3 text-sm font-semibold text-surface-700">Health Score</h3>
                            <div className="space-y-2">
                                {(data.health_distribution ?? []).map((h: any) => (
                                    <div key={h.range} className="flex items-center justify-between rounded-lg bg-surface-50 p-3">
                                        <span className="text-sm font-medium">{h.range}</span>
                                        <span className="text-sm font-bold">{h.count}</span>
                                    </div>
                                ))}
                                {(data.health_distribution ?? []).length === 0 && <p className="py-4 text-center text-sm text-surface-400">Sem dados</p>}
                            </div>
                        </div>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-3">
                        <div className="rounded-xl border border-surface-200 bg-white p-5 shadow-card text-center">
                            <span className="text-xs font-medium text-surface-500">Receita (Won)</span>
                            <p className="text-2xl font-bold text-emerald-600">{fmtBRL(data.revenue ?? 0)}</p>
                        </div>
                        <div className="rounded-xl border border-surface-200 bg-white p-5 shadow-card text-center">
                            <span className="text-xs font-medium text-surface-500">Taxa de Conversão</span>
                            <p className="text-2xl font-bold text-brand-600">{data.conversion_rate ?? 0}%</p>
                        </div>
                        <div className="rounded-xl border border-surface-200 bg-white p-5 shadow-card text-center">
                            <span className="text-xs font-medium text-surface-500">Ticket Médio</span>
                            <p className="text-2xl font-bold text-surface-900">{fmtBRL(data.avg_deal_value ?? 0)}</p>
                        </div>
                    </div>
                </div>
            )}

            {/* Equipments Report */}
            {tab === 'equipments' && !isLoading && (
                <div className="space-y-6">
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                        <div className="rounded-xl border border-surface-200 bg-white p-4 shadow-card">
                            <span className="text-xs font-medium text-surface-500">Ativos</span>
                            <p className="text-2xl font-bold text-emerald-600">{data.total_active ?? 0}</p>
                        </div>
                        <div className="rounded-xl border border-surface-200 bg-white p-4 shadow-card">
                            <span className="text-xs font-medium text-surface-500">Inativos</span>
                            <p className="text-2xl font-bold text-surface-400">{data.total_inactive ?? 0}</p>
                        </div>
                        <div className="rounded-xl border border-surface-200 bg-white p-4 shadow-card">
                            <span className="text-xs font-medium text-surface-500">Custo Calibrações</span>
                            <p className="text-2xl font-bold text-surface-900">{fmtBRL(data.total_calibration_cost ?? 0)}</p>
                        </div>
                        <div className="rounded-xl border border-surface-200 bg-white p-4 shadow-card">
                            <span className="text-xs font-medium text-surface-500">Alertas Vencidos</span>
                            <p className="text-2xl font-bold text-red-600">{data.overdue_calibrations ?? 0}</p>
                        </div>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                        <div className="rounded-xl border border-surface-200 bg-white p-5 shadow-card">
                            <h3 className="mb-3 text-sm font-semibold text-surface-700">Por Classe de Precisão</h3>
                            <div className="space-y-2">
                                {(data.by_class ?? []).map((c: any) => (
                                    <div key={c.precision_class} className="flex items-center justify-between rounded-lg bg-surface-50 p-3">
                                        <span className="text-sm font-medium capitalize">{c.precision_class ?? 'N/A'}</span>
                                        <span className="text-sm font-bold">{c.count}</span>
                                    </div>
                                ))}
                                {(data.by_class ?? []).length === 0 && <p className="py-4 text-center text-sm text-surface-400">Sem dados</p>}
                            </div>
                        </div>
                        <div className="rounded-xl border border-surface-200 bg-white p-5 shadow-card">
                            <h3 className="mb-3 text-sm font-semibold text-surface-700">Top Marcas</h3>
                            <div className="space-y-2">
                                {(data.top_brands ?? []).map((b: any, i: number) => (
                                    <div key={i} className="flex items-center justify-between rounded-lg bg-surface-50 p-3">
                                        <span className="text-sm font-medium">{b.brand ?? 'N/A'}</span>
                                        <span className="text-sm font-bold">{b.count}</span>
                                    </div>
                                ))}
                                {(data.top_brands ?? []).length === 0 && <p className="py-4 text-center text-sm text-surface-400">Sem dados</p>}
                            </div>
                        </div>
                    </div>
                    {(data.due_alerts ?? []).length > 0 && (
                        <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 shadow-card">
                            <h3 className="mb-3 text-sm font-semibold text-amber-800">⚠ Calibrações a Vencer (30 dias)</h3>
                            <div className="space-y-2">
                                {data.due_alerts.map((a: any) => (
                                    <div key={a.id} className="flex items-center justify-between text-sm">
                                        <span className="font-medium text-amber-900">{a.brand} {a.model} — {a.code}</span>
                                        <span className="text-amber-700">{a.next_calibration_at ? new Date(a.next_calibration_at).toLocaleDateString('pt-BR') : '—'}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}
