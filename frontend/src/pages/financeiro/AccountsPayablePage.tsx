import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
    DollarSign, Plus, Search, ArrowUp, AlertTriangle,
    CheckCircle, Clock, Eye, Trash2,
} from 'lucide-react'
import api from '@/lib/api'
import { cn } from '@/lib/utils'
import { FINANCIAL_STATUS } from '@/lib/constants'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { FinancialExportButtons } from '@/components/financial/FinancialExportButtons'

const statusConfig: Record<string, { label: string; variant: any }> = {
    [FINANCIAL_STATUS.PENDING]: { label: 'Pendente', variant: 'warning' },
    [FINANCIAL_STATUS.PARTIAL]: { label: 'Parcial', variant: 'info' },
    [FINANCIAL_STATUS.PAID]: { label: 'Pago', variant: 'success' },
    [FINANCIAL_STATUS.OVERDUE]: { label: 'Vencido', variant: 'danger' },
    [FINANCIAL_STATUS.CANCELLED]: { label: 'Cancelado', variant: 'default' },
}




interface AP {
    id: number; supplier_id: number | null; category_id: number | null
    supplier_relation?: { id: number; name: string } | null
    category_relation?: { id: number; name: string; color?: string } | null
    description: string; amount: string; amount_paid: string
    due_date: string; paid_at: string | null; status: string
    payment_method: string | null; notes: string | null
    payments?: { id: number; amount: string; payment_method: string; payment_date: string; receiver: { name: string } }[]
}

const fmtBRL = (val: string | number) => Number(val).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const fmtDate = (d: string) => new Date(d + 'T00:00:00').toLocaleDateString('pt-BR')

export function AccountsPayablePage() {
    const qc = useQueryClient()
    const [search, setSearch] = useState('')
    const [statusFilter, setStatusFilter] = useState('')
    const [catFilter, setCatFilter] = useState('')
    const [page, setPage] = useState(1)
    const [showForm, setShowForm] = useState(false)
    const [showPay, setShowPay] = useState<AP | null>(null)
    const [showDetail, setShowDetail] = useState<AP | null>(null)
    const [form, setForm] = useState({
        supplier_id: '', category_id: '', description: '', amount: '', due_date: '', payment_method: '', notes: '',
    })
    const [payForm, setPayForm] = useState({ amount: '', payment_method: 'pix', payment_date: '', notes: '' })

    const { data: res, isLoading } = useQuery({
        queryKey: ['accounts-payable', search, statusFilter, catFilter, page],
        queryFn: () => api.get('/accounts-payable', {
            params: { search: search || undefined, status: statusFilter || undefined, category: catFilter || undefined, per_page: 50, page },
        }),
    })
    const records: AP[] = res?.data?.data ?? []
    const pagination = { currentPage: res?.data?.current_page ?? 1, lastPage: res?.data?.last_page ?? 1, total: res?.data?.total ?? 0 }

    const { data: summaryRes } = useQuery({
        queryKey: ['ap-summary'],
        queryFn: () => api.get('/accounts-payable-summary'),
    })
    const summary = summaryRes?.data ?? {}

    const { data: catRes } = useQuery({
        queryKey: ['ap-categories'],
        queryFn: () => api.get('/account-payable-categories'),
    })
    const categories: { id: number; name: string }[] = catRes?.data ?? []

    const { data: suppRes } = useQuery({
        queryKey: ['suppliers-select'],
        queryFn: () => api.get('/suppliers', { params: { per_page: 200 } }),
    })
    const suppliers: { id: number; name: string }[] = suppRes?.data?.data ?? suppRes?.data ?? []

    const { data: pmRes } = useQuery({
        queryKey: ['payment-methods'],
        queryFn: () => api.get('/payment-methods'),
    })
    const paymentMethods: { id: number; name: string; code: string }[] = pmRes?.data ?? []

    const saveMut = useMutation({
        mutationFn: (data: typeof form) => api.post('/accounts-payable', data),
        onSuccess: () => { qc.invalidateQueries({ queryKey: ['accounts-payable'] }); qc.invalidateQueries({ queryKey: ['ap-summary'] }); setShowForm(false) },
    })

    const payMut = useMutation({
        mutationFn: ({ id, data }: { id: number; data: typeof payForm }) => api.post(`/accounts-payable/${id}/pay`, data),
        onSuccess: () => { qc.invalidateQueries({ queryKey: ['accounts-payable'] }); qc.invalidateQueries({ queryKey: ['ap-summary'] }); setShowPay(null) },
    })

    const delMut = useMutation({
        mutationFn: (id: number) => api.delete(`/accounts-payable/${id}`),
        onSuccess: () => { qc.invalidateQueries({ queryKey: ['accounts-payable'] }); qc.invalidateQueries({ queryKey: ['ap-summary'] }) },
    })

    const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm(p => ({ ...p, [k]: v }))

    const loadDetail = async (ap: AP) => {
        const { data } = await api.get(`/accounts-payable/${ap.id}`)
        setShowDetail(data)
    }

    return (
        <div className="space-y-5">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-lg font-semibold text-surface-900 tracking-tight">Contas a Pagar</h1>
                    <p className="mt-0.5 text-[13px] text-surface-500">Despesas, fornecedores e pagamentos</p>
                </div>
                <div className="flex gap-2">
                    <FinancialExportButtons type="payable" />
                    <Button icon={<Plus className="h-4 w-4" />} onClick={() => { setForm({ supplier_id: '', category_id: '', description: '', amount: '', due_date: '', payment_method: '', notes: '' }); setShowForm(true) }}>
                        Nova Conta
                    </Button>
                </div>
            </div>

            {/* Summary Cards */}
            <div className="grid gap-3 sm:grid-cols-5">
                <div className="rounded-xl border border-default bg-surface-0 p-4 shadow-card">
                    <div className="flex items-center gap-2 text-amber-600"><Clock className="h-4 w-4" /><span className="text-xs font-medium">Pendente</span></div>
                    <p className="mt-1 text-xl font-bold text-surface-900">{fmtBRL(summary.pending ?? 0)}</p>
                </div>
                <div className="rounded-xl border border-default bg-surface-0 p-4 shadow-card">
                    <div className="flex items-center gap-2 text-red-600"><AlertTriangle className="h-4 w-4" /><span className="text-xs font-medium">Vencido</span></div>
                    <p className="mt-1 text-xl font-bold text-red-600">{fmtBRL(summary.overdue ?? 0)}</p>
                </div>
                <div className="rounded-xl border border-default bg-surface-0 p-4 shadow-card">
                    <div className="flex items-center gap-2 text-blue-600"><Clock className="h-4 w-4" /><span className="text-xs font-medium">Lançado (mês)</span></div>
                    <p className="mt-1 text-xl font-bold text-blue-600">{fmtBRL(summary.recorded_this_month ?? 0)}</p>
                </div>
                <div className="rounded-xl border border-default bg-surface-0 p-4 shadow-card">
                    <div className="flex items-center gap-2 text-emerald-600"><CheckCircle className="h-4 w-4" /><span className="text-xs font-medium">Pago (mês)</span></div>
                    <p className="mt-1 text-xl font-bold text-emerald-600">{fmtBRL(summary.paid_this_month ?? 0)}</p>
                </div>
                <div className="rounded-xl border border-default bg-surface-0 p-4 shadow-card">
                    <div className="flex items-center gap-2 text-brand-600"><DollarSign className="h-4 w-4" /><span className="text-xs font-medium">Total em Aberto</span></div>
                    <p className="mt-1 text-xl font-bold text-surface-900">{fmtBRL(summary.total_open ?? 0)}</p>
                </div>
            </div>

            {/* Aging bar */}
            {records.length > 0 && (() => {
                const groups = [
                    { key: FINANCIAL_STATUS.PAID, label: 'Pago', color: 'bg-emerald-500', count: records.filter(r => r.status === FINANCIAL_STATUS.PAID).length },
                    { key: FINANCIAL_STATUS.PENDING, label: 'Pendente', color: 'bg-amber-500', count: records.filter(r => r.status === FINANCIAL_STATUS.PENDING).length },
                    { key: FINANCIAL_STATUS.PARTIAL, label: 'Parcial', color: 'bg-blue-500', count: records.filter(r => r.status === FINANCIAL_STATUS.PARTIAL).length },
                    { key: FINANCIAL_STATUS.OVERDUE, label: 'Vencido', color: 'bg-red-500', count: records.filter(r => r.status === FINANCIAL_STATUS.OVERDUE).length },
                    { key: FINANCIAL_STATUS.CANCELLED, label: 'Cancelado', color: 'bg-surface-300', count: records.filter(r => r.status === FINANCIAL_STATUS.CANCELLED).length },
                ].filter(g => g.count > 0)
                const total = groups.reduce((s, g) => s + g.count, 0)
                return (
                    <div className="rounded-xl border border-default bg-surface-0 p-4 shadow-card">
                        <div className="flex h-5 overflow-hidden rounded-full">
                            {groups.map(g => (
                                <div key={g.key} className={cn('transition-all', g.color)} style={{ width: `${(g.count / total) * 100}%` }} />
                            ))}
                        </div>
                        <div className="mt-2 flex flex-wrap gap-3">
                            {groups.map(g => (
                                <span key={g.key} className="flex items-center gap-1 text-xs text-surface-600">
                                    <span className={cn('h-2 w-2 rounded-full', g.color)} />
                                    {g.label}: <strong>{g.count}</strong> ({Math.round((g.count / total) * 100)}%)
                                </span>
                            ))}
                        </div>
                    </div>
                )
            })()}

            {/* Filters */}
            <div className="flex flex-wrap gap-3">
                <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-surface-400" />
                    <input value={search} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearch(e.target.value)} placeholder="Buscar descrição ou fornecedor"
                        className="w-full rounded-lg border border-default bg-surface-50 py-2.5 pl-10 pr-4 text-sm focus:border-brand-500 focus:outline-none" />
                </div>
                <select value={statusFilter} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setStatusFilter(e.target.value)}
                    className="rounded-lg border border-default bg-surface-50 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none">
                    <option value="">Todos os status</option>
                    {Object.entries(statusConfig).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
                <select value={catFilter} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setCatFilter(e.target.value)}
                    className="rounded-lg border border-default bg-surface-50 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none">
                    <option value="">Todas categorias</option>
                    {categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                </select>
            </div>

            {/* Table */}
            <div className="overflow-hidden rounded-xl border border-default bg-surface-0 shadow-card">
                <table className="w-full">
                    <thead>
                        <tr className="border-b border-subtle bg-surface-50">
                            <th className="px-3.5 py-2.5 text-left text-xs font-semibold uppercase text-surface-600">Descrição</th>
                            <th className="hidden px-3.5 py-2.5 text-left text-xs font-semibold uppercase text-surface-600 md:table-cell">Fornecedor</th>
                            <th className="hidden px-3.5 py-2.5 text-left text-xs font-semibold uppercase text-surface-600 sm:table-cell">Categoria</th>
                            <th className="hidden px-3.5 py-2.5 text-left text-xs font-semibold uppercase text-surface-600 md:table-cell">Vencimento</th>
                            <th className="px-3.5 py-2.5 text-left text-xs font-semibold uppercase text-surface-600">Status</th>
                            <th className="px-3.5 py-2.5 text-right text-xs font-semibold uppercase text-surface-600">Valor</th>
                            <th className="px-3.5 py-2.5 text-right text-xs font-semibold uppercase text-surface-600">Ações</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-subtle">
                        {isLoading ? (
                            <tr><td colSpan={7} className="px-4 py-12 text-center text-[13px] text-surface-500">Carregando...</td></tr>
                        ) : records.length === 0 ? (
                            <tr><td colSpan={7} className="px-4 py-12 text-center text-[13px] text-surface-500">Nenhuma conta encontrada</td></tr>
                        ) : records.map(r => (
                            <tr key={r.id} className="hover:bg-surface-50 transition-colors duration-100">
                                <td className="px-4 py-3 text-[13px] font-medium text-surface-900">{r.description}</td>
                                <td className="hidden px-4 py-3 text-[13px] text-surface-600 md:table-cell">{r.supplier_relation?.name ?? '—'}</td>
                                <td className="hidden px-4 py-3 sm:table-cell">
                                    {r.category_relation ? <Badge variant="default">{r.category_relation.name}</Badge> : '—'}
                                </td>
                                <td className="hidden px-4 py-3 text-[13px] text-surface-500 md:table-cell">{fmtDate(r.due_date)}</td>
                                <td className="px-4 py-3"><Badge variant={statusConfig[r.status]?.variant}>{statusConfig[r.status]?.label}</Badge></td>
                                <td className="px-3.5 py-2.5 text-right text-sm font-semibold text-surface-900">{fmtBRL(r.amount)}</td>
                                <td className="px-4 py-3">
                                    <div className="flex items-center justify-end gap-1">
                                        <Button variant="ghost" size="sm" onClick={() => loadDetail(r)}><Eye className="h-4 w-4" /></Button>
                                        {r.status !== FINANCIAL_STATUS.PAID && r.status !== FINANCIAL_STATUS.CANCELLED && (
                                            <Button variant="ghost" size="sm" onClick={() => {
                                                setShowPay(r)
                                                const remaining = Number(r.amount) - Number(r.amount_paid)
                                                setPayForm({ amount: remaining.toFixed(2), payment_method: 'pix', payment_date: new Date().toISOString().split('T')[0], notes: '' })
                                            }}>
                                                <ArrowUp className="h-4 w-4 text-emerald-600" />
                                            </Button>
                                        )}
                                        <Button variant="ghost" size="sm" onClick={() => { if (confirm('Excluir?')) delMut.mutate(r.id) }}>
                                            <Trash2 className="h-4 w-4 text-red-500" />
                                        </Button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Pagination */}
            {pagination.lastPage > 1 && (
                <div className="flex items-center justify-between rounded-xl border border-default bg-surface-0 px-4 py-3 shadow-card">
                    <span className="text-[13px] text-surface-500">{pagination.total} registro(s)</span>
                    <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm" disabled={pagination.currentPage <= 1} onClick={() => setPage(p => p - 1)}>Anterior</Button>
                        <span className="text-sm text-surface-700">Página {pagination.currentPage} de {pagination.lastPage}</span>
                        <Button variant="outline" size="sm" disabled={pagination.currentPage >= pagination.lastPage} onClick={() => setPage(p => p + 1)}>Próxima</Button>
                    </div>
                </div>
            )}

            {/* Create Modal */}
            <Modal open={showForm} onOpenChange={setShowForm} title="Nova Conta a Pagar" size="lg">
                <form onSubmit={e => { e.preventDefault(); saveMut.mutate(form) }} className="space-y-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                        <div>
                            <label className="mb-1.5 block text-[13px] font-medium text-surface-700">Fornecedor</label>
                            <select value={form.supplier_id} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => set('supplier_id', e.target.value)}
                                className="w-full rounded-lg border border-default bg-surface-50 px-3.5 py-2.5 text-sm focus:border-brand-400 focus:bg-surface-0 focus:outline-none focus:ring-2 focus:ring-brand-500/15">
                                <option value="">Selecionar</option>
                                {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="mb-1.5 block text-[13px] font-medium text-surface-700">Categoria</label>
                            <select value={form.category_id} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => set('category_id', e.target.value)}
                                className="w-full rounded-lg border border-default bg-surface-50 px-3.5 py-2.5 text-sm focus:border-brand-400 focus:bg-surface-0 focus:outline-none focus:ring-2 focus:ring-brand-500/15">
                                <option value="">Selecionar</option>
                                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                            </select>
                        </div>
                    </div>
                    <Input label="Descrição" value={form.description} onChange={(e: React.ChangeEvent<HTMLInputElement>) => set('description', e.target.value)} required />
                    <div className="grid gap-4 sm:grid-cols-3">
                        <Input label="Valor (R$)" type="number" step="0.01" value={form.amount} onChange={(e: React.ChangeEvent<HTMLInputElement>) => set('amount', e.target.value)} required />
                        <Input label="Vencimento" type="date" value={form.due_date} onChange={(e: React.ChangeEvent<HTMLInputElement>) => set('due_date', e.target.value)} required />
                        <div>
                            <label className="mb-1.5 block text-[13px] font-medium text-surface-700">Forma Pgto</label>
                            <select value={form.payment_method} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => set('payment_method', e.target.value)}
                                className="w-full rounded-lg border border-default bg-surface-50 px-3.5 py-2.5 text-sm focus:border-brand-400 focus:bg-surface-0 focus:outline-none focus:ring-2 focus:ring-brand-500/15">
                                <option value="">Não definido</option>
                                {paymentMethods.map(m => <option key={m.code} value={m.code}>{m.name}</option>)}
                            </select>
                        </div>
                    </div>
                    <div>
                        <label className="mb-1.5 block text-[13px] font-medium text-surface-700">Observações</label>
                        <textarea value={form.notes} onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => set('notes', e.target.value)} rows={2}
                            className="w-full rounded-lg border border-default bg-surface-50 px-3.5 py-2.5 text-sm focus:border-brand-400 focus:bg-surface-0 focus:outline-none focus:ring-2 focus:ring-brand-500/15" />
                    </div>
                    <div className="flex justify-end gap-2 border-t pt-4">
                        <Button variant="outline" type="button" onClick={() => setShowForm(false)}>Cancelar</Button>
                        <Button type="submit" loading={saveMut.isPending}>Criar</Button>
                    </div>
                </form>
            </Modal>

            {/* Pay Modal */}
            <Modal open={!!showPay} onOpenChange={() => setShowPay(null)} title="Registrar Pagamento">
                {showPay && (
                    <form onSubmit={e => { e.preventDefault(); payMut.mutate({ id: showPay.id, data: payForm }) }} className="space-y-4">
                        <div className="rounded-lg bg-surface-50 p-3 text-sm">
                            <p className="font-medium">{showPay.description}</p>
                            <p className="text-surface-500">{showPay.supplier ?? 'Sem fornecedor'}</p>
                            <p className="mt-1">Valor: <strong>{fmtBRL(showPay.amount)}</strong> | Pago: <strong>{fmtBRL(showPay.amount_paid)}</strong> | Restante: <strong className="text-emerald-600">{fmtBRL(Number(showPay.amount) - Number(showPay.amount_paid))}</strong></p>
                        </div>
                        <div className="grid gap-4 sm:grid-cols-3">
                            <Input label="Valor" type="number" step="0.01" value={payForm.amount}
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPayForm(p => ({ ...p, amount: e.target.value }))} required />
                            <div>
                                <label className="mb-1.5 block text-[13px] font-medium text-surface-700">Forma Pgto *</label>
                                <select value={payForm.payment_method} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setPayForm(p => ({ ...p, payment_method: e.target.value }))} required
                                    className="w-full rounded-lg border border-default bg-surface-50 px-3.5 py-2.5 text-sm focus:border-brand-400 focus:bg-surface-0 focus:outline-none focus:ring-2 focus:ring-brand-500/15">
                                    {paymentMethods.map(m => <option key={m.code} value={m.code}>{m.name}</option>)}
                                </select>
                            </div>
                            <Input label="Data" type="date" value={payForm.payment_date}
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPayForm(p => ({ ...p, payment_date: e.target.value }))} required />
                        </div>
                        <div className="flex justify-end gap-2 border-t pt-4">
                            <Button variant="outline" type="button" onClick={() => setShowPay(null)}>Cancelar</Button>
                            <Button type="submit" loading={payMut.isPending}>Pagar</Button>
                        </div>
                    </form>
                )}
            </Modal>

            {/* Detail Modal */}
            <Modal open={!!showDetail} onOpenChange={() => setShowDetail(null)} title="Detalhes da Conta" size="lg">
                {showDetail && (
                    <div className="space-y-4">
                        <div className="grid gap-4 sm:grid-cols-2">
                            <div><span className="text-xs text-surface-500">Descrição</span><p className="text-sm font-medium">{showDetail.description}</p></div>
                            <div><span className="text-xs text-surface-500">Fornecedor</span><p className="text-sm font-medium">{showDetail.supplier ?? '—'}</p></div>
                            <div><span className="text-xs text-surface-500">Valor</span><p className="text-[15px] font-semibold tabular-nums">{fmtBRL(showDetail.amount)}</p></div>
                            <div><span className="text-xs text-surface-500">Pago</span><p className="text-[15px] font-semibold tabular-nums text-emerald-600">{fmtBRL(showDetail.amount_paid)}</p></div>
                            <div><span className="text-xs text-surface-500">Vencimento</span><p className="text-sm">{fmtDate(showDetail.due_date)}</p></div>
                            <div><span className="text-xs text-surface-500">Status</span><Badge variant={statusConfig[showDetail.status]?.variant}>{statusConfig[showDetail.status]?.label}</Badge></div>
                        </div>
                        {showDetail.payments && showDetail.payments.length > 0 && (
                            <div>
                                <h4 className="mb-2 text-sm font-semibold text-surface-700">Pagamentos</h4>
                                <div className="space-y-2">
                                    {showDetail.payments.map((p: any) => (
                                        <div key={p.id} className="flex items-center justify-between rounded-lg bg-surface-50 p-3">
                                            <div>
                                                <p className="text-sm font-medium">{fmtBRL(p.amount)} — {paymentMethods.find(m => m.code === p.payment_method)?.name ?? p.payment_method}</p>
                                                <p className="text-xs text-surface-500">{fmtDate(p.payment_date)} por {p.receiver?.name}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </Modal>
        </div>
    )
}
