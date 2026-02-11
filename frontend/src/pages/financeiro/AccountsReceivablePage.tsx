import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
    DollarSign, Plus, Search, ArrowDown, AlertTriangle,
    CheckCircle, Clock, Eye, Trash2, FileText,
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



interface AR {
    id: number; description: string; amount: string; amount_paid: string
    due_date: string; paid_at: string | null; status: string
    payment_method: string | null; notes: string | null
    customer: { id: number; name: string }
    work_order: { id: number; number: string; os_number?: string | null; business_number?: string | null } | null
    payments?: { id: number; amount: string; payment_method: string; payment_date: string; receiver: { name: string } }[]
}

const fmtBRL = (val: string | number) => Number(val).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const fmtDate = (d: string) => new Date(d + 'T00:00:00').toLocaleDateString('pt-BR')
const woIdentifier = (wo?: { number: string; os_number?: string | null; business_number?: string | null } | null) =>
    wo?.business_number ?? wo?.os_number ?? wo?.number ?? '—'

export function AccountsReceivablePage() {
    const qc = useQueryClient()
    const [search, setSearch] = useState('')
    const [statusFilter, setStatusFilter] = useState('')
    const [page, setPage] = useState(1)
    const [showForm, setShowForm] = useState(false)
    const [showPay, setShowPay] = useState<AR | null>(null)
    const [showDetail, setShowDetail] = useState<AR | null>(null)
    const [form, setForm] = useState({
        customer_id: '' as string | number, description: '', amount: '', due_date: '',
        payment_method: '', notes: '', work_order_id: '' as string | number,
    })
    const [payForm, setPayForm] = useState({ amount: '', payment_method: 'pix', payment_date: '', notes: '' })
    const [showGenOS, setShowGenOS] = useState(false)
    const [genForm, setGenForm] = useState({ work_order_id: '' as string | number, due_date: '', payment_method: '' })

    const { data: res, isLoading } = useQuery({
        queryKey: ['accounts-receivable', search, statusFilter, page],
        queryFn: () => api.get('/accounts-receivable', { params: { search: search || undefined, status: statusFilter || undefined, per_page: 50, page } }),
    })
    const records: AR[] = res?.data?.data ?? []
    const pagination = { currentPage: res?.data?.current_page ?? 1, lastPage: res?.data?.last_page ?? 1, total: res?.data?.total ?? 0 }

    const { data: summaryRes } = useQuery({
        queryKey: ['ar-summary'],
        queryFn: () => api.get('/accounts-receivable-summary'),
    })
    const summary = summaryRes?.data ?? {}

    const { data: custsRes } = useQuery({
        queryKey: ['customers-select'],
        queryFn: () => api.get('/customers', { params: { per_page: 100 } }),
        enabled: showForm,
    })

    const { data: wosRes } = useQuery({
        queryKey: ['work-orders-financial'],
        queryFn: () => api.get('/work-orders', { params: { per_page: 50 } }),
        enabled: showGenOS || showForm,
    })

    const { data: pmRes } = useQuery({
        queryKey: ['payment-methods'],
        queryFn: () => api.get('/payment-methods'),
    })
    const paymentMethods: { id: number; name: string; code: string }[] = pmRes?.data ?? []

    const saveMut = useMutation({
        mutationFn: (data: typeof form) => api.post('/accounts-receivable', data),
        onSuccess: () => { qc.invalidateQueries({ queryKey: ['accounts-receivable'] }); qc.invalidateQueries({ queryKey: ['ar-summary'] }); setShowForm(false) },
    })

    const payMut = useMutation({
        mutationFn: ({ id, data }: { id: number; data: typeof payForm }) => api.post(`/accounts-receivable/${id}/pay`, data),
        onSuccess: () => { qc.invalidateQueries({ queryKey: ['accounts-receivable'] }); qc.invalidateQueries({ queryKey: ['ar-summary'] }); setShowPay(null) },
    })

    const genMut = useMutation({
        mutationFn: (data: typeof genForm) => api.post('/accounts-receivable/generate-from-os', data),
        onSuccess: () => { qc.invalidateQueries({ queryKey: ['accounts-receivable'] }); qc.invalidateQueries({ queryKey: ['ar-summary'] }); setShowGenOS(false) },
    })

    const delMut = useMutation({
        mutationFn: (id: number) => api.delete(`/accounts-receivable/${id}`),
        onSuccess: () => { qc.invalidateQueries({ queryKey: ['accounts-receivable'] }); qc.invalidateQueries({ queryKey: ['ar-summary'] }) },
    })

    const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm(p => ({ ...p, [k]: v }))

    const loadDetail = async (ar: AR) => {
        const { data } = await api.get(`/accounts-receivable/${ar.id}`)
        setShowDetail(data)
    }

    return (
        <div className="space-y-5">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-lg font-semibold text-surface-900 tracking-tight">Contas a Receber</h1>
                    <p className="mt-0.5 text-[13px] text-surface-500">Títulos, recebimentos e cobranças</p>
                </div>
                <div className="flex gap-2">
                    <FinancialExportButtons type="receivable" />
                    <Button variant="outline" icon={<FileText className="h-4 w-4" />} onClick={() => { setGenForm({ work_order_id: '', due_date: '', payment_method: '' }); setShowGenOS(true) }}>
                        Gerar da OS
                    </Button>
                    <Button icon={<Plus className="h-4 w-4" />} onClick={() => { setForm({ customer_id: '', description: '', amount: '', due_date: '', payment_method: '', notes: '', work_order_id: '' }); setShowForm(true) }}>
                        Novo Título
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
                    <div className="flex items-center gap-2 text-blue-600"><FileText className="h-4 w-4" /><span className="text-xs font-medium">Faturado (mês)</span></div>
                    <p className="mt-1 text-xl font-bold text-blue-600">{fmtBRL(summary.billed_this_month ?? 0)}</p>
                </div>
                <div className="rounded-xl border border-default bg-surface-0 p-4 shadow-card">
                    <div className="flex items-center gap-2 text-emerald-600"><CheckCircle className="h-4 w-4" /><span className="text-xs font-medium">Recebido (mês)</span></div>
                    <p className="mt-1 text-xl font-bold text-emerald-600">{fmtBRL(summary.paid_this_month ?? 0)}</p>
                </div>
                <div className="rounded-xl border border-default bg-surface-0 p-4 shadow-card">
                    <div className="flex items-center gap-2 text-brand-600"><DollarSign className="h-4 w-4" /><span className="text-xs font-medium">Total em Aberto</span></div>
                    <p className="mt-1 text-xl font-bold text-surface-900">{fmtBRL(summary.total_open ?? summary.total ?? 0)}</p>
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
            <div className="flex gap-3">
                <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-surface-400" />
                    <input value={search} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearch(e.target.value)} placeholder="Buscar por descrição ou cliente"
                        className="w-full rounded-lg border border-default bg-surface-50 py-2.5 pl-10 pr-4 text-sm focus:border-brand-500 focus:outline-none" />
                </div>
                <select value={statusFilter} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setStatusFilter(e.target.value)}
                    className="rounded-lg border border-default bg-surface-50 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none">
                    <option value="">Todos os status</option>
                    {Object.entries(statusConfig).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
            </div>

            {/* Table */}
            <div className="overflow-hidden rounded-xl border border-default bg-surface-0 shadow-card">
                <table className="w-full">
                    <thead>
                        <tr className="border-b border-subtle bg-surface-50">
                            <th className="px-3.5 py-2.5 text-left text-xs font-semibold uppercase text-surface-600">Descrição</th>
                            <th className="px-3.5 py-2.5 text-left text-xs font-semibold uppercase text-surface-600">Cliente</th>
                            <th className="hidden px-3.5 py-2.5 text-left text-xs font-semibold uppercase text-surface-600 md:table-cell">Vencimento</th>
                            <th className="px-3.5 py-2.5 text-left text-xs font-semibold uppercase text-surface-600">Status</th>
                            <th className="px-3.5 py-2.5 text-right text-xs font-semibold uppercase text-surface-600">Valor</th>
                            <th className="px-3.5 py-2.5 text-right text-xs font-semibold uppercase text-surface-600">Pago</th>
                            <th className="px-3.5 py-2.5 text-right text-xs font-semibold uppercase text-surface-600">Ações</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-subtle">
                        {isLoading ? (
                            <tr><td colSpan={7} className="px-4 py-12 text-center text-[13px] text-surface-500">Carregando...</td></tr>
                        ) : records.length === 0 ? (
                            <tr><td colSpan={7} className="px-4 py-12 text-center text-[13px] text-surface-500">Nenhum título encontrado</td></tr>
                        ) : records.map(r => (
                            <tr key={r.id} className="hover:bg-surface-50 transition-colors duration-100">
                                <td className="px-4 py-3">
                                    <p className="text-[13px] font-medium text-surface-900">{r.description}</p>
                                    {r.work_order && <p className="text-xs text-brand-500">{woIdentifier(r.work_order)}</p>}
                                </td>
                                <td className="px-4 py-3 text-[13px] text-surface-600">{r.customer.name}</td>
                                <td className="hidden px-4 py-3 text-[13px] text-surface-500 md:table-cell">{fmtDate(r.due_date)}</td>
                                <td className="px-4 py-3"><Badge variant={statusConfig[r.status]?.variant}>{statusConfig[r.status]?.label}</Badge></td>
                                <td className="px-3.5 py-2.5 text-right text-sm font-semibold text-surface-900">{fmtBRL(r.amount)}</td>
                                <td className="px-3.5 py-2.5 text-right text-[13px] text-surface-600">{fmtBRL(r.amount_paid)}</td>
                                <td className="px-4 py-3">
                                    <div className="flex items-center justify-end gap-1">
                                        <Button variant="ghost" size="sm" onClick={() => loadDetail(r)}><Eye className="h-4 w-4" /></Button>
                                        {r.status !== FINANCIAL_STATUS.PAID && r.status !== FINANCIAL_STATUS.CANCELLED && (
                                            <Button variant="ghost" size="sm" onClick={() => {
                                                setShowPay(r)
                                                const remaining = Number(r.amount) - Number(r.amount_paid)
                                                setPayForm({ amount: remaining.toFixed(2), payment_method: 'pix', payment_date: new Date().toISOString().split('T')[0], notes: '' })
                                            }}>
                                                <ArrowDown className="h-4 w-4 text-emerald-600" />
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
            <Modal open={showForm} onOpenChange={setShowForm} title="Novo Título a Receber" size="lg">
                <form onSubmit={e => { e.preventDefault(); saveMut.mutate(form) }} className="space-y-4">
                    <div>
                        <label className="mb-1.5 block text-[13px] font-medium text-surface-700">Cliente *</label>
                        <select value={form.customer_id} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => set('customer_id', e.target.value)} required
                            className="w-full rounded-lg border border-default bg-surface-50 px-3.5 py-2.5 text-sm focus:border-brand-400 focus:bg-surface-0 focus:outline-none focus:ring-2 focus:ring-brand-500/15">
                            <option value="">Selecionar</option>
                            {(custsRes?.data?.data ?? []).map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
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
            <Modal open={!!showPay} onOpenChange={() => setShowPay(null)} title="Registrar Recebimento">
                {showPay && (
                    <form onSubmit={e => { e.preventDefault(); payMut.mutate({ id: showPay.id, data: payForm }) }} className="space-y-4">
                        <div className="rounded-lg bg-surface-50 p-3 text-sm">
                            <p className="font-medium">{showPay.description}</p>
                            <p className="text-surface-500">{showPay.customer.name}</p>
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
                            <Button type="submit" loading={payMut.isPending}>Baixar</Button>
                        </div>
                    </form>
                )}
            </Modal>

            {/* Generate from OS Modal */}
            <Modal open={showGenOS} onOpenChange={setShowGenOS} title="Gerar Título da OS">
                <form onSubmit={e => { e.preventDefault(); genMut.mutate(genForm) }} className="space-y-4">
                    <div>
                        <label className="mb-1.5 block text-[13px] font-medium text-surface-700">OS *</label>
                        <select value={genForm.work_order_id} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setGenForm(p => ({ ...p, work_order_id: e.target.value }))} required
                            className="w-full rounded-lg border border-default bg-surface-50 px-3.5 py-2.5 text-sm focus:border-brand-400 focus:bg-surface-0 focus:outline-none focus:ring-2 focus:ring-brand-500/15">
                            <option value="">Selecionar</option>
                            {(wosRes?.data?.data ?? []).map((wo: any) => <option key={wo.id} value={wo.id}>{wo.business_number ?? wo.os_number ?? wo.number} — {wo.customer?.name} — {fmtBRL(wo.total)}</option>)}
                        </select>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                        <Input label="Vencimento" type="date" value={genForm.due_date} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setGenForm(p => ({ ...p, due_date: e.target.value }))} required />
                        <div>
                            <label className="mb-1.5 block text-[13px] font-medium text-surface-700">Forma Pgto</label>
                            <select value={genForm.payment_method} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setGenForm(p => ({ ...p, payment_method: e.target.value }))}
                                className="w-full rounded-lg border border-default bg-surface-50 px-3.5 py-2.5 text-sm focus:border-brand-400 focus:bg-surface-0 focus:outline-none focus:ring-2 focus:ring-brand-500/15">
                                <option value="">Não definido</option>
                                {paymentMethods.map(m => <option key={m.code} value={m.code}>{m.name}</option>)}
                            </select>
                        </div>
                    </div>
                    <div className="flex justify-end gap-2 border-t pt-4">
                        <Button variant="outline" type="button" onClick={() => setShowGenOS(false)}>Cancelar</Button>
                        <Button type="submit" loading={genMut.isPending}>Gerar Título</Button>
                    </div>
                </form>
            </Modal>

            {/* Detail Modal */}
            <Modal open={!!showDetail} onOpenChange={() => setShowDetail(null)} title="Detalhes do Título" size="lg">
                {showDetail && (
                    <div className="space-y-4">
                        <div className="grid gap-4 sm:grid-cols-2">
                            <div><span className="text-xs text-surface-500">Descrição</span><p className="text-sm font-medium">{showDetail.description}</p></div>
                            <div><span className="text-xs text-surface-500">Cliente</span><p className="text-sm font-medium">{showDetail.customer.name}</p></div>
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

