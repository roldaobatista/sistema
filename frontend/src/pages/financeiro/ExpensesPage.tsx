import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
    Receipt, Plus, Search, CheckCircle, XCircle,
    Clock, Eye, Trash2, Tag, RefreshCw,
} from 'lucide-react'
import api from '@/lib/api'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'

const statusConfig: Record<string, { label: string; variant: any }> = {
    pending: { label: 'Pendente', variant: 'warning' },
    approved: { label: 'Aprovado', variant: 'info' },
    rejected: { label: 'Rejeitado', variant: 'danger' },
    reimbursed: { label: 'Reembolsado', variant: 'success' },
}

const paymentMethods: Record<string, string> = {
    dinheiro: 'Dinheiro', pix: 'PIX', cartao_credito: 'Cartão Crédito',
    cartao_debito: 'Cartão Débito', boleto: 'Boleto', transferencia: 'Transferência',
}

interface Exp {
    id: number; description: string; amount: string
    expense_date: string; status: string; payment_method: string | null
    notes: string | null; receipt_path: string | null
    category: { id: number; name: string; color: string } | null
    creator: { id: number; name: string }
    work_order: { id: number; number: string } | null
    approver?: { id: number; name: string } | null
}

const fmtBRL = (val: string | number) => Number(val).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const fmtDate = (d: string) => new Date(d + 'T00:00:00').toLocaleDateString('pt-BR')

export function ExpensesPage() {
    const qc = useQueryClient()
    const [search, setSearch] = useState('')
    const [statusFilter, setStatusFilter] = useState('')
    const [catFilter, setCatFilter] = useState('')
    const [showForm, setShowForm] = useState(false)
    const [showDetail, setShowDetail] = useState<Exp | null>(null)
    const [showCatForm, setShowCatForm] = useState(false)
    const [catForm, setCatForm] = useState({ name: '', color: '#6b7280' })
    const [form, setForm] = useState({
        expense_category_id: '' as string | number, work_order_id: '' as string | number,
        description: '', amount: '', expense_date: '', payment_method: '', notes: '',
    })

    const { data: res, isLoading } = useQuery({
        queryKey: ['expenses', search, statusFilter, catFilter],
        queryFn: () => api.get('/expenses', {
            params: { search: search || undefined, status: statusFilter || undefined, expense_category_id: catFilter || undefined, per_page: 50 },
        }),
    })
    const records: Exp[] = res?.data?.data ?? []

    const { data: summaryRes } = useQuery({
        queryKey: ['expense-summary'],
        queryFn: () => api.get('/expense-summary'),
    })
    const summary = summaryRes?.data ?? {}

    const { data: catsRes } = useQuery({
        queryKey: ['expense-categories'],
        queryFn: () => api.get('/expense-categories'),
    })
    const categories = catsRes?.data ?? []

    const { data: wosRes } = useQuery({
        queryKey: ['work-orders-expense'],
        queryFn: () => api.get('/work-orders', { params: { per_page: 50 } }),
        enabled: showForm,
    })

    const saveMut = useMutation({
        mutationFn: (data: typeof form) => api.post('/expenses', data),
        onSuccess: () => { qc.invalidateQueries({ queryKey: ['expenses'] }); qc.invalidateQueries({ queryKey: ['expense-summary'] }); setShowForm(false) },
    })

    const statusMut = useMutation({
        mutationFn: ({ id, status }: { id: number; status: string }) => api.put(`/expenses/${id}/status`, { status }),
        onSuccess: () => { qc.invalidateQueries({ queryKey: ['expenses'] }); qc.invalidateQueries({ queryKey: ['expense-summary'] }) },
    })

    const delMut = useMutation({
        mutationFn: (id: number) => api.delete(`/expenses/${id}`),
        onSuccess: () => { qc.invalidateQueries({ queryKey: ['expenses'] }); qc.invalidateQueries({ queryKey: ['expense-summary'] }) },
    })

    const saveCatMut = useMutation({
        mutationFn: (data: typeof catForm) => api.post('/expense-categories', data),
        onSuccess: () => { qc.invalidateQueries({ queryKey: ['expense-categories'] }); setShowCatForm(false) },
    })

    const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm(p => ({ ...p, [k]: v }))

    const loadDetail = async (exp: Exp) => {
        const { data } = await api.get(`/expenses/${exp.id}`)
        setShowDetail(data)
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-surface-900">Despesas</h1>
                    <p className="mt-1 text-sm text-surface-500">Controle de despesas e aprovações</p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" icon={<Tag className="h-4 w-4" />} onClick={() => { setCatForm({ name: '', color: '#6b7280' }); setShowCatForm(true) }}>
                        Nova Categoria
                    </Button>
                    <Button icon={<Plus className="h-4 w-4" />} onClick={() => { setForm({ expense_category_id: '', work_order_id: '', description: '', amount: '', expense_date: '', payment_method: '', notes: '' }); setShowForm(true) }}>
                        Nova Despesa
                    </Button>
                </div>
            </div>

            {/* Summary Cards */}
            <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-xl border border-surface-200 bg-white p-4 shadow-card">
                    <div className="flex items-center gap-2 text-amber-600"><Clock className="h-4 w-4" /><span className="text-xs font-medium">Pendente Aprovação</span></div>
                    <p className="mt-1 text-xl font-bold text-surface-900">{fmtBRL(summary.pending ?? 0)}</p>
                </div>
                <div className="rounded-xl border border-surface-200 bg-white p-4 shadow-card">
                    <div className="flex items-center gap-2 text-sky-600"><CheckCircle className="h-4 w-4" /><span className="text-xs font-medium">Aprovado</span></div>
                    <p className="mt-1 text-xl font-bold text-sky-600">{fmtBRL(summary.approved ?? 0)}</p>
                </div>
                <div className="rounded-xl border border-surface-200 bg-white p-4 shadow-card">
                    <div className="flex items-center gap-2 text-surface-600"><Receipt className="h-4 w-4" /><span className="text-xs font-medium">Total do Mês</span></div>
                    <p className="mt-1 text-xl font-bold text-surface-900">{fmtBRL(summary.month_total ?? 0)}</p>
                </div>
            </div>

            {/* Filters */}
            <div className="flex flex-wrap gap-3">
                <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-surface-400" />
                    <input value={search} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearch(e.target.value)} placeholder="Buscar descrição"
                        className="w-full rounded-lg border border-surface-300 bg-white py-2.5 pl-10 pr-4 text-sm focus:border-brand-500 focus:outline-none" />
                </div>
                <select value={statusFilter} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setStatusFilter(e.target.value)}
                    className="rounded-lg border border-surface-300 bg-white px-3 py-2 text-sm focus:border-brand-500 focus:outline-none">
                    <option value="">Todos os status</option>
                    {Object.entries(statusConfig).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
                <select value={catFilter} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setCatFilter(e.target.value)}
                    className="rounded-lg border border-surface-300 bg-white px-3 py-2 text-sm focus:border-brand-500 focus:outline-none">
                    <option value="">Todas categorias</option>
                    {categories.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
            </div>

            {/* Table */}
            <div className="overflow-hidden rounded-xl border border-surface-200 bg-white shadow-card">
                <table className="w-full">
                    <thead>
                        <tr className="border-b border-surface-200 bg-surface-50">
                            <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-surface-600">Descrição</th>
                            <th className="hidden px-4 py-3 text-left text-xs font-semibold uppercase text-surface-600 sm:table-cell">Categoria</th>
                            <th className="hidden px-4 py-3 text-left text-xs font-semibold uppercase text-surface-600 md:table-cell">Responsável</th>
                            <th className="hidden px-4 py-3 text-left text-xs font-semibold uppercase text-surface-600 md:table-cell">Data</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-surface-600">Status</th>
                            <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-surface-600">Valor</th>
                            <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-surface-600">Ações</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-surface-100">
                        {isLoading ? (
                            <tr><td colSpan={7} className="px-4 py-12 text-center text-sm text-surface-500">Carregando...</td></tr>
                        ) : records.length === 0 ? (
                            <tr><td colSpan={7} className="px-4 py-12 text-center text-sm text-surface-500">Nenhuma despesa encontrada</td></tr>
                        ) : records.map(r => (
                            <tr key={r.id} className="hover:bg-surface-50 transition-colors">
                                <td className="px-4 py-3">
                                    <p className="text-sm font-medium text-surface-900">{r.description}</p>
                                    {r.work_order && <p className="text-xs text-brand-500">{r.work_order.number}</p>}
                                </td>
                                <td className="hidden px-4 py-3 sm:table-cell">
                                    {r.category ? (
                                        <span className="inline-flex items-center gap-1.5 text-xs font-medium">
                                            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: r.category.color }} />
                                            {r.category.name}
                                        </span>
                                    ) : '—'}
                                </td>
                                <td className="hidden px-4 py-3 text-sm text-surface-600 md:table-cell">{r.creator.name}</td>
                                <td className="hidden px-4 py-3 text-sm text-surface-500 md:table-cell">{fmtDate(r.expense_date)}</td>
                                <td className="px-4 py-3"><Badge variant={statusConfig[r.status]?.variant}>{statusConfig[r.status]?.label}</Badge></td>
                                <td className="px-4 py-3 text-right text-sm font-semibold text-surface-900">{fmtBRL(r.amount)}</td>
                                <td className="px-4 py-3">
                                    <div className="flex items-center justify-end gap-1">
                                        <Button variant="ghost" size="sm" onClick={() => loadDetail(r)}><Eye className="h-4 w-4" /></Button>
                                        {r.status === 'pending' && (
                                            <>
                                                <Button variant="ghost" size="sm" onClick={() => statusMut.mutate({ id: r.id, status: 'approved' })}>
                                                    <CheckCircle className="h-4 w-4 text-sky-500" />
                                                </Button>
                                                <Button variant="ghost" size="sm" onClick={() => statusMut.mutate({ id: r.id, status: 'rejected' })}>
                                                    <XCircle className="h-4 w-4 text-red-500" />
                                                </Button>
                                            </>
                                        )}
                                        {r.status === 'approved' && (
                                            <Button variant="ghost" size="sm" onClick={() => statusMut.mutate({ id: r.id, status: 'reimbursed' })}>
                                                <RefreshCw className="h-4 w-4 text-emerald-500" />
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

            {/* Create Expense Modal */}
            <Modal open={showForm} onOpenChange={setShowForm} title="Nova Despesa" size="lg">
                <form onSubmit={e => { e.preventDefault(); saveMut.mutate(form) }} className="space-y-4">
                    <Input label="Descrição" value={form.description} onChange={(e: React.ChangeEvent<HTMLInputElement>) => set('description', e.target.value)} required />
                    <div className="grid gap-4 sm:grid-cols-2">
                        <div>
                            <label className="mb-1.5 block text-sm font-medium text-surface-700">Categoria</label>
                            <select value={form.expense_category_id} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => set('expense_category_id', e.target.value)}
                                className="w-full rounded-lg border border-surface-300 bg-white px-3.5 py-2.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20">
                                <option value="">Sem categoria</option>
                                {categories.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="mb-1.5 block text-sm font-medium text-surface-700">Vinculada à OS</label>
                            <select value={form.work_order_id} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => set('work_order_id', e.target.value)}
                                className="w-full rounded-lg border border-surface-300 bg-white px-3.5 py-2.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20">
                                <option value="">Nenhuma</option>
                                {(wosRes?.data?.data ?? []).map((wo: any) => <option key={wo.id} value={wo.id}>{wo.number} — {wo.customer?.name}</option>)}
                            </select>
                        </div>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-3">
                        <Input label="Valor (R$)" type="number" step="0.01" value={form.amount} onChange={(e: React.ChangeEvent<HTMLInputElement>) => set('amount', e.target.value)} required />
                        <Input label="Data" type="date" value={form.expense_date} onChange={(e: React.ChangeEvent<HTMLInputElement>) => set('expense_date', e.target.value)} required />
                        <div>
                            <label className="mb-1.5 block text-sm font-medium text-surface-700">Forma Pgto</label>
                            <select value={form.payment_method} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => set('payment_method', e.target.value)}
                                className="w-full rounded-lg border border-surface-300 bg-white px-3.5 py-2.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20">
                                <option value="">Não definido</option>
                                {Object.entries(paymentMethods).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                            </select>
                        </div>
                    </div>
                    <div>
                        <label className="mb-1.5 block text-sm font-medium text-surface-700">Observações</label>
                        <textarea value={form.notes} onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => set('notes', e.target.value)} rows={2}
                            className="w-full rounded-lg border border-surface-300 bg-white px-3.5 py-2.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20" />
                    </div>
                    <div className="flex justify-end gap-2 border-t pt-4">
                        <Button variant="outline" type="button" onClick={() => setShowForm(false)}>Cancelar</Button>
                        <Button type="submit" loading={saveMut.isPending}>Criar</Button>
                    </div>
                </form>
            </Modal>

            {/* Category Modal */}
            <Modal open={showCatForm} onOpenChange={setShowCatForm} title="Nova Categoria de Despesa">
                <form onSubmit={e => { e.preventDefault(); saveCatMut.mutate(catForm) }} className="space-y-4">
                    <Input label="Nome" value={catForm.name} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCatForm(p => ({ ...p, name: e.target.value }))} required />
                    <div>
                        <label className="mb-1.5 block text-sm font-medium text-surface-700">Cor</label>
                        <div className="flex items-center gap-3">
                            <input type="color" value={catForm.color} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCatForm(p => ({ ...p, color: e.target.value }))}
                                className="h-10 w-14 cursor-pointer rounded-lg border border-surface-300" />
                            <span className="text-sm text-surface-500">{catForm.color}</span>
                        </div>
                    </div>
                    <div className="flex justify-end gap-2 border-t pt-4">
                        <Button variant="outline" type="button" onClick={() => setShowCatForm(false)}>Cancelar</Button>
                        <Button type="submit" loading={saveCatMut.isPending}>Criar</Button>
                    </div>
                </form>
            </Modal>

            {/* Detail Modal */}
            <Modal open={!!showDetail} onOpenChange={() => setShowDetail(null)} title="Detalhes da Despesa" size="lg">
                {showDetail && (
                    <div className="space-y-4">
                        <div className="grid gap-4 sm:grid-cols-2">
                            <div><span className="text-xs text-surface-500">Descrição</span><p className="text-sm font-medium">{showDetail.description}</p></div>
                            <div>
                                <span className="text-xs text-surface-500">Categoria</span>
                                {showDetail.category ? (
                                    <p className="flex items-center gap-1.5 text-sm font-medium">
                                        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: showDetail.category.color }} />
                                        {showDetail.category.name}
                                    </p>
                                ) : <p className="text-sm text-surface-400">Sem categoria</p>}
                            </div>
                            <div><span className="text-xs text-surface-500">Valor</span><p className="text-lg font-bold">{fmtBRL(showDetail.amount)}</p></div>
                            <div><span className="text-xs text-surface-500">Status</span><Badge variant={statusConfig[showDetail.status]?.variant}>{statusConfig[showDetail.status]?.label}</Badge></div>
                            <div><span className="text-xs text-surface-500">Responsável</span><p className="text-sm">{showDetail.creator.name}</p></div>
                            <div><span className="text-xs text-surface-500">Data</span><p className="text-sm">{fmtDate(showDetail.expense_date)}</p></div>
                            {showDetail.approver && <div><span className="text-xs text-surface-500">Aprovado por</span><p className="text-sm">{showDetail.approver.name}</p></div>}
                            {showDetail.work_order && <div><span className="text-xs text-surface-500">OS</span><p className="text-sm text-brand-600 font-medium">{showDetail.work_order.number}</p></div>}
                            {showDetail.notes && <div className="col-span-2"><span className="text-xs text-surface-500">Obs</span><p className="text-sm text-surface-600">{showDetail.notes}</p></div>}
                        </div>
                    </div>
                )}
            </Modal>
        </div>
    )
}
