import { useState, useEffect, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
    Receipt, Plus, Search, CheckCircle, XCircle,
    Clock, Eye, Trash2, Tag, RefreshCw, Pencil, RotateCcw, Settings,
} from 'lucide-react'
import api from '@/lib/api'
import { EXPENSE_STATUS } from '@/lib/constants'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { useAuthStore } from '@/stores/auth-store'

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
    rejection_reason?: string | null
    affects_technician_cash?: boolean
    category: { id: number; name: string; color: string } | null
    creator: { id: number; name: string }
    work_order: { id: number; number: string; os_number?: string | null; business_number?: string | null } | null
    approver?: { id: number; name: string } | null
}

const fmtBRL = (val: string | number) => Number(val).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const fmtDate = (d: string) => new Date(d + 'T00:00:00').toLocaleDateString('pt-BR')
const woIdentifier = (wo?: { number: string; os_number?: string | null; business_number?: string | null } | null) =>
    wo?.business_number ?? wo?.os_number ?? wo?.number ?? '—'

export function ExpensesPage() {
    const qc = useQueryClient()
    const { hasPermission } = useAuthStore()

    const canCreate = hasPermission('expenses.expense.create')
    const canUpdate = hasPermission('expenses.expense.update')
    const canApprove = hasPermission('expenses.expense.approve')
    const canDelete = hasPermission('expenses.expense.delete')

    const [search, setSearch] = useState('')
    const [statusFilter, setStatusFilter] = useState('')
    const [catFilter, setCatFilter] = useState('')
    const [page, setPage] = useState(1)
    const [showForm, setShowForm] = useState(false)
    const [showDetail, setShowDetail] = useState<Exp | null>(null)
    const [showCatForm, setShowCatForm] = useState(false)
    const [showCatManager, setShowCatManager] = useState(false)
    const [catForm, setCatForm] = useState({ name: '', color: '#6b7280' })
    const [editingCatId, setEditingCatId] = useState<number | null>(null)
    const [deleteCatTarget, setDeleteCatTarget] = useState<number | null>(null)
    const [editingId, setEditingId] = useState<number | null>(null)
    const [rejectTarget, setRejectTarget] = useState<number | null>(null)
    const [rejectReason, setRejectReason] = useState('')
    const [deleteTarget, setDeleteTarget] = useState<number | null>(null)
    const [dateFrom, setDateFrom] = useState('')
    const [dateTo, setDateTo] = useState('')
    const [debouncedSearch, setDebouncedSearch] = useState('')
    const [actionFeedback, setActionFeedback] = useState<string | null>(null)
    const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({})
    const searchTimer = useRef<ReturnType<typeof setTimeout>>(undefined)
    const emptyForm = {
        expense_category_id: '' as string | number, work_order_id: '' as string | number,
        description: '', amount: '', expense_date: '', payment_method: '', notes: '',
        affects_technician_cash: false, receipt: null as File | null,
    }
    const [form, setForm] = useState(emptyForm)

    useEffect(() => {
        clearTimeout(searchTimer.current)
        searchTimer.current = setTimeout(() => setDebouncedSearch(search), 300)
        return () => clearTimeout(searchTimer.current)
    }, [search])

    // Reset page when filters change
    useEffect(() => { setPage(1) }, [debouncedSearch, statusFilter, catFilter, dateFrom, dateTo])

    const { data: res, isLoading } = useQuery({
        queryKey: ['expenses', debouncedSearch, statusFilter, catFilter, dateFrom, dateTo, page],
        queryFn: () => api.get('/expenses', {
            params: {
                search: debouncedSearch || undefined,
                status: statusFilter || undefined,
                expense_category_id: catFilter || undefined,
                date_from: dateFrom || undefined,
                date_to: dateTo || undefined,
                per_page: 50,
                page
            },
        }),
    })
    const records: Exp[] = res?.data?.data ?? []
    const pagination = res?.data ? { current: res.data.current_page, last: res.data.last_page, total: res.data.total } : null

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
        mutationFn: (data: typeof form) => {
            const formData = new FormData()
            if (data.expense_category_id) formData.append('expense_category_id', String(data.expense_category_id))
            if (data.work_order_id) formData.append('work_order_id', String(data.work_order_id))
            formData.append('description', data.description)
            formData.append('amount', data.amount)
            formData.append('expense_date', data.expense_date)
            if (data.payment_method) formData.append('payment_method', data.payment_method)
            if (data.notes) formData.append('notes', data.notes)
            formData.append('affects_technician_cash', data.affects_technician_cash ? '1' : '0')
            if (data.receipt) formData.append('receipt', data.receipt)

            if (editingId) {
                formData.append('_method', 'PUT')
                return api.post(`/expenses/${editingId}`, formData, {
                    headers: { 'Content-Type': 'multipart/form-data' }
                })
            }
            return api.post('/expenses', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            })
        },
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['expenses'] })
            qc.invalidateQueries({ queryKey: ['expense-summary'] })
            setShowForm(false)
            setEditingId(null)
            setForm(emptyForm)
            setFieldErrors({})
            showFeedback(editingId ? 'Despesa atualizada com sucesso' : 'Despesa criada com sucesso')
        },
        onError: (err: any) => {
            if (err?.response?.status === 422 && err?.response?.data?.errors) {
                setFieldErrors(err.response.data.errors)
            } else if (err?.response?.status === 403) {
                showFeedback('Você não tem permissão para esta ação')
            } else {
                showFeedback(err?.response?.data?.message ?? 'Erro ao salvar despesa')
            }
        },
    })

    const showFeedback = (msg: string) => { setActionFeedback(msg); setTimeout(() => setActionFeedback(null), 3000) }

    const statusMut = useMutation({
        mutationFn: ({ id, status, rejection_reason }: { id: number; status: string; rejection_reason?: string }) =>
            api.put(`/expenses/${id}/status`, { status, rejection_reason }),
        onSuccess: (_d, vars) => {
            qc.invalidateQueries({ queryKey: ['expenses'] })
            qc.invalidateQueries({ queryKey: ['expense-summary'] })
            setRejectTarget(null)
            showFeedback(`Despesa ${statusConfig[vars.status]?.label?.toLowerCase() ?? vars.status} com sucesso`)
        },
        onError: (err: any) => {
            setRejectTarget(null)
            if (err?.response?.status === 403) {
                showFeedback(err?.response?.data?.message ?? 'Você não tem permissão para esta ação')
            } else {
                showFeedback(err?.response?.data?.message ?? 'Erro ao atualizar status')
            }
        },
    })

    const delMut = useMutation({
        mutationFn: (id: number) => api.delete(`/expenses/${id}`),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['expenses'] })
            qc.invalidateQueries({ queryKey: ['expense-summary'] })
            setDeleteTarget(null)
            showFeedback('Despesa excluída com sucesso')
        },
        onError: (err: any) => {
            setDeleteTarget(null)
            if (err?.response?.status === 403) {
                showFeedback('Você não tem permissão para excluir')
            } else {
                showFeedback(err?.response?.data?.message ?? 'Erro ao excluir despesa')
            }
        },
    })

    const saveCatMut = useMutation({
        mutationFn: (data: typeof catForm) => {
            if (editingCatId) return api.put(`/expense-categories/${editingCatId}`, data)
            return api.post('/expense-categories', data)
        },
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['expense-categories'] })
            setShowCatForm(false)
            setEditingCatId(null)
            showFeedback(editingCatId ? 'Categoria atualizada com sucesso' : 'Categoria criada com sucesso')
        },
        onError: (err: any) => {
            if (err?.response?.status === 403) {
                showFeedback('Você não tem permissão para esta ação')
            } else {
                showFeedback(err?.response?.data?.message ?? 'Erro ao salvar categoria')
            }
        },
    })

    const delCatMut = useMutation({
        mutationFn: (id: number) => api.delete(`/expense-categories/${id}`),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['expense-categories'] })
            qc.invalidateQueries({ queryKey: ['expenses'] })
            setDeleteCatTarget(null)
            showFeedback('Categoria excluída com sucesso')
        },
        onError: (err: any) => {
            setDeleteCatTarget(null)
            showFeedback(err?.response?.data?.message ?? 'Erro ao excluir categoria')
        },
    })

    const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => {
        setForm(p => ({ ...p, [k]: v }))
        // Clear field error when user changes value
        if (fieldErrors[k]) {
            setFieldErrors(prev => {
                const next = { ...prev }
                delete next[k]
                return next
            })
        }
    }

    const loadDetail = async (exp: Exp) => {
        try {
            const { data } = await api.get(`/expenses/${exp.id}`)
            setShowDetail(data)
        } catch (err: any) {
            if (err?.response?.status === 403) {
                showFeedback('Você não tem permissão para ver esta despesa')
            } else {
                showFeedback(err?.response?.data?.message ?? 'Erro ao carregar detalhes da despesa')
            }
        }
    }

    const openEdit = (exp: Exp) => {
        if (![EXPENSE_STATUS.PENDING, EXPENSE_STATUS.REJECTED].includes(exp.status)) return
        setEditingId(exp.id)
        setFieldErrors({})
        setForm({
            expense_category_id: exp.category?.id ?? '',
            work_order_id: exp.work_order?.id ?? '',
            description: exp.description,
            amount: exp.amount,
            expense_date: exp.expense_date,
            payment_method: exp.payment_method ?? '',
            notes: exp.notes ?? '',
            affects_technician_cash: !!exp.affects_technician_cash,
            receipt: null,
        })
        setShowForm(true)
    }

    return (
        <div className="space-y-5">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-lg font-semibold text-surface-900 tracking-tight">
                        Despesas
                        {pagination && <span className="ml-2 text-sm font-normal text-surface-400">({pagination.total})</span>}
                    </h1>
                    <p className="mt-0.5 text-[13px] text-surface-500">Controle de despesas e aprovações</p>
                </div>
                <div className="flex gap-2">
                    {canCreate && (
                        <Button variant="outline" icon={<Settings className="h-4 w-4" />} onClick={() => setShowCatManager(true)}>
                            Categorias
                        </Button>
                    )}
                    {canCreate && (
                        <Button icon={<Plus className="h-4 w-4" />} onClick={() => { setEditingId(null); setForm(emptyForm); setFieldErrors({}); setShowForm(true) }}>
                            Nova Despesa
                        </Button>
                    )}
                </div>
            </div>

            {actionFeedback && (
                <div className="fixed bottom-6 right-6 z-50 rounded-lg bg-surface-900 px-4 py-2.5 text-sm text-white shadow-lg animate-in fade-in slide-in-from-bottom-2 duration-200">
                    {actionFeedback}
                </div>
            )}

            {/* Summary Cards */}
            <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-xl border border-default bg-surface-0 p-4 shadow-card">
                    <div className="flex items-center gap-2 text-amber-600"><Clock className="h-4 w-4" /><span className="text-xs font-medium">Pendente Aprovação</span></div>
                    <p className="mt-1 text-xl font-bold text-surface-900">{fmtBRL(summary.pending ?? 0)}</p>
                </div>
                <div className="rounded-xl border border-default bg-surface-0 p-4 shadow-card">
                    <div className="flex items-center gap-2 text-sky-600"><CheckCircle className="h-4 w-4" /><span className="text-xs font-medium">Aprovado</span></div>
                    <p className="mt-1 text-xl font-bold text-sky-600">{fmtBRL(summary.approved ?? 0)}</p>
                </div>
                <div className="rounded-xl border border-default bg-surface-0 p-4 shadow-card">
                    <div className="flex items-center gap-2 text-surface-600"><Receipt className="h-4 w-4" /><span className="text-xs font-medium">Total do Mês</span></div>
                    <p className="mt-1 text-xl font-bold text-surface-900">{fmtBRL(summary.month_total ?? 0)}</p>
                </div>
            </div>

            {/* Filters */}
            <div className="flex flex-wrap gap-3">
                <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-surface-400" />
                    <input value={search} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearch(e.target.value)} placeholder="Buscar descrição"
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
                    {categories.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
            </div>
            {/* Filters Row 2 */}
            <div className="flex flex-wrap gap-3">
                <Input type="date" value={dateFrom} onChange={(e: any) => setDateFrom(e.target.value)} className="w-40" placeholder="De" />
                <Input type="date" value={dateTo} onChange={(e: any) => setDateTo(e.target.value)} className="w-40" placeholder="Até" />
            </div>

            {/* Table */}
            <div className="overflow-hidden rounded-xl border border-default bg-surface-0 shadow-card">
                <table className="w-full">
                    <thead>
                        <tr className="border-b border-subtle bg-surface-50">
                            <th className="px-3.5 py-2.5 text-left text-xs font-semibold uppercase text-surface-600">Descrição</th>
                            <th className="hidden px-3.5 py-2.5 text-left text-xs font-semibold uppercase text-surface-600 sm:table-cell">Categoria</th>
                            <th className="hidden px-3.5 py-2.5 text-left text-xs font-semibold uppercase text-surface-600 md:table-cell">Responsável</th>
                            <th className="hidden px-3.5 py-2.5 text-left text-xs font-semibold uppercase text-surface-600 md:table-cell">Data</th>
                            <th className="px-3.5 py-2.5 text-left text-xs font-semibold uppercase text-surface-600">Status</th>
                            <th className="px-3.5 py-2.5 text-right text-xs font-semibold uppercase text-surface-600">Valor</th>
                            <th className="px-3.5 py-2.5 text-right text-xs font-semibold uppercase text-surface-600">Ações</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-subtle">
                        {isLoading ? (
                            <tr><td colSpan={7} className="px-4 py-12 text-center text-[13px] text-surface-500">Carregando...</td></tr>
                        ) : records.length === 0 ? (
                            <tr><td colSpan={7} className="px-4 py-16 text-center">
                                <Receipt className="mx-auto h-10 w-10 text-surface-300" />
                                <p className="mt-3 text-sm font-medium text-surface-600">Nenhuma despesa encontrada</p>
                                <p className="mt-1 text-xs text-surface-400">Crie uma nova despesa para começar</p>
                                {canCreate && (
                                    <Button className="mt-4" size="sm" icon={<Plus className="h-4 w-4" />}
                                        onClick={() => { setEditingId(null); setForm(emptyForm); setFieldErrors({}); setShowForm(true) }}>
                                        Nova Despesa
                                    </Button>
                                )}
                            </td></tr>
                        ) : records.map(r => (
                            <tr key={r.id} className="hover:bg-surface-50 transition-colors duration-100">
                                <td className="px-4 py-3">
                                    <p className="text-[13px] font-medium text-surface-900">{r.description}</p>
                                    {r.work_order && <p className="text-xs text-brand-500">{woIdentifier(r.work_order)}</p>}
                                </td>
                                <td className="hidden px-4 py-3 sm:table-cell">
                                    {r.category ? (
                                        <span className="inline-flex items-center gap-1.5 text-xs font-medium">
                                            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: r.category.color }} />
                                            {r.category.name}
                                        </span>
                                    ) : '—'}
                                </td>
                                <td className="hidden px-4 py-3 text-[13px] text-surface-600 md:table-cell">{r.creator.name}</td>
                                <td className="hidden px-4 py-3 text-[13px] text-surface-500 md:table-cell">{fmtDate(r.expense_date)}</td>
                                <td className="px-4 py-3"><Badge variant={statusConfig[r.status]?.variant}>{statusConfig[r.status]?.label}</Badge></td>
                                <td className="px-3.5 py-2.5 text-right text-sm font-semibold text-surface-900">{fmtBRL(r.amount)}</td>
                                <td className="px-4 py-3">
                                    <div className="flex items-center justify-end gap-1">
                                        <Button variant="ghost" size="sm" onClick={() => loadDetail(r)}><Eye className="h-4 w-4" /></Button>
                                        {canUpdate && [EXPENSE_STATUS.PENDING, EXPENSE_STATUS.REJECTED].includes(r.status) && (
                                            <Button variant="ghost" size="sm" onClick={() => openEdit(r)}>
                                                <Pencil className="h-4 w-4 text-surface-500" />
                                            </Button>
                                        )}
                                        {canApprove && r.status === EXPENSE_STATUS.PENDING && (
                                            <>
                                                <Button variant="ghost" size="sm" onClick={() => statusMut.mutate({ id: r.id, status: EXPENSE_STATUS.APPROVED })}>
                                                    <CheckCircle className="h-4 w-4 text-sky-500" />
                                                </Button>
                                                <Button variant="ghost" size="sm" onClick={() => {
                                                    setRejectTarget(r.id)
                                                    setRejectReason('')
                                                }}>
                                                    <XCircle className="h-4 w-4 text-red-500" />
                                                </Button>
                                            </>
                                        )}
                                        {canApprove && r.status === EXPENSE_STATUS.APPROVED && (
                                            <Button variant="ghost" size="sm" onClick={() => statusMut.mutate({ id: r.id, status: EXPENSE_STATUS.REIMBURSED })}>
                                                <RefreshCw className="h-4 w-4 text-emerald-500" />
                                            </Button>
                                        )}
                                        {r.status === EXPENSE_STATUS.REJECTED && (canUpdate || canApprove) && (
                                            <Button variant="ghost" size="sm" title="Resubmeter como pendente" onClick={() => statusMut.mutate({ id: r.id, status: EXPENSE_STATUS.PENDING })}>
                                                <RotateCcw className="h-4 w-4 text-amber-500" />
                                            </Button>
                                        )}
                                        {canDelete && [EXPENSE_STATUS.PENDING, EXPENSE_STATUS.REJECTED].includes(r.status) && (
                                            <Button variant="ghost" size="sm" onClick={() => setDeleteTarget(r.id)}>
                                                <Trash2 className="h-4 w-4 text-red-500" />
                                            </Button>
                                        )}
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            {pagination && pagination.last > 1 && (
                <div className="flex items-center justify-between px-4 py-3">
                    <span className="text-xs text-surface-500">{pagination.total} despesa(s) — Página {pagination.current} de {pagination.last}</span>
                    <div className="flex gap-1">
                        <Button variant="outline" size="sm" disabled={pagination.current <= 1} onClick={() => setPage(p => Math.max(1, p - 1))}>Anterior</Button>
                        <Button variant="outline" size="sm" disabled={pagination.current >= pagination.last} onClick={() => setPage(p => p + 1)}>Próxima</Button>
                    </div>
                </div>
            )}

            {/* Create Expense Modal */}
            <Modal open={showForm} onOpenChange={(v) => { setShowForm(v); if (!v) { setEditingId(null); setFieldErrors({}) } }} title={editingId ? 'Editar Despesa' : 'Nova Despesa'} size="lg">
                <form onSubmit={e => { e.preventDefault(); saveMut.mutate(form) }} className="space-y-4">
                    <div>
                        <Input label="Descrição *" value={form.description} onChange={(e: React.ChangeEvent<HTMLInputElement>) => set('description', e.target.value)} required />
                        {fieldErrors.description && <p className="mt-1 text-xs text-red-500">{fieldErrors.description[0]}</p>}
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                        <div>
                            <label className="mb-1.5 block text-[13px] font-medium text-surface-700">Categoria</label>
                            <select value={form.expense_category_id} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => set('expense_category_id', e.target.value)}
                                className="w-full rounded-lg border border-default bg-surface-50 px-3.5 py-2.5 text-sm focus:border-brand-400 focus:bg-surface-0 focus:outline-none focus:ring-2 focus:ring-brand-500/15">
                                <option value="">Sem categoria</option>
                                {categories.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                            </select>
                            {fieldErrors.expense_category_id && <p className="mt-1 text-xs text-red-500">{fieldErrors.expense_category_id[0]}</p>}
                        </div>
                        <div>
                            <label className="mb-1.5 block text-[13px] font-medium text-surface-700">Vinculada à OS</label>
                            <select value={form.work_order_id} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => set('work_order_id', e.target.value)}
                                className="w-full rounded-lg border border-default bg-surface-50 px-3.5 py-2.5 text-sm focus:border-brand-400 focus:bg-surface-0 focus:outline-none focus:ring-2 focus:ring-brand-500/15">
                                <option value="">Nenhuma</option>
                                {(wosRes?.data?.data ?? []).map((wo: any) => <option key={wo.id} value={wo.id}>{wo.business_number ?? wo.os_number ?? wo.number} — {wo.customer?.name}</option>)}
                            </select>
                        </div>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-3">
                        <div>
                            <Input label="Valor (R$) *" type="number" step="0.01" value={form.amount} onChange={(e: React.ChangeEvent<HTMLInputElement>) => set('amount', e.target.value)} required />
                            {fieldErrors.amount && <p className="mt-1 text-xs text-red-500">{fieldErrors.amount[0]}</p>}
                        </div>
                        <div>
                            <Input label="Data *" type="date" value={form.expense_date} onChange={(e: React.ChangeEvent<HTMLInputElement>) => set('expense_date', e.target.value)} required />
                            {fieldErrors.expense_date && <p className="mt-1 text-xs text-red-500">{fieldErrors.expense_date[0]}</p>}
                        </div>
                        <div>
                            <label className="mb-1.5 block text-[13px] font-medium text-surface-700">Forma Pgto</label>
                            <select value={form.payment_method} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => set('payment_method', e.target.value)}
                                className="w-full rounded-lg border border-default bg-surface-50 px-3.5 py-2.5 text-sm focus:border-brand-400 focus:bg-surface-0 focus:outline-none focus:ring-2 focus:ring-brand-500/15">
                                <option value="">Não definido</option>
                                {Object.entries(paymentMethods).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                            </select>
                        </div>
                    </div>
                    <div>
                        <label className="mb-1.5 block text-[13px] font-medium text-surface-700">Observações</label>
                        <textarea value={form.notes} onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => set('notes', e.target.value)} rows={2}
                            className="w-full rounded-lg border border-default bg-surface-50 px-3.5 py-2.5 text-sm focus:border-brand-400 focus:bg-surface-0 focus:outline-none focus:ring-2 focus:ring-brand-500/15" />
                    </div>
                    <div className="flex items-center gap-2">
                        <input type="checkbox" id="affects_cash" checked={form.affects_technician_cash}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => set('affects_technician_cash', e.target.checked as any)}
                            className="h-4 w-4 rounded border-surface-300 text-brand-600 focus:ring-brand-500" />
                        <label htmlFor="affects_cash" className="text-[13px] font-medium text-surface-700">Impacta caixa do técnico</label>
                    </div>
                    <div>
                        <label className="mb-1.5 block text-[13px] font-medium text-surface-700">Comprovante</label>
                        <input type="file" accept="image/*,.pdf" onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                            if (e.target.files?.[0]) set('receipt', e.target.files[0])
                        }} className="w-full text-sm text-surface-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-brand-50 file:text-brand-700 hover:file:bg-brand-100" />
                        {editingId && !form.receipt && (
                            <p className="mt-1 text-xs text-surface-500">Deixe vazio para manter o comprovante atual (se houver).</p>
                        )}
                        {fieldErrors.receipt && <p className="mt-1 text-xs text-red-500">{fieldErrors.receipt[0]}</p>}
                    </div>
                    <div className="flex justify-end gap-2 border-t pt-4">
                        <Button variant="outline" type="button" onClick={() => { setShowForm(false); setEditingId(null); setFieldErrors({}) }}>Cancelar</Button>
                        <Button type="submit" loading={saveMut.isPending} disabled={saveMut.isPending}>{editingId ? 'Salvar' : 'Criar'}</Button>
                    </div>
                </form>
            </Modal>

            {/* Category Manager Modal */}
            <Modal open={showCatManager} onOpenChange={setShowCatManager} title="Gerenciar Categorias" size="lg">
                <div className="space-y-4">
                    <div className="flex justify-end">
                        <Button size="sm" icon={<Plus className="h-3.5 w-3.5" />} onClick={() => { setEditingCatId(null); setCatForm({ name: '', color: '#6b7280' }); setShowCatForm(true) }}>Nova Categoria</Button>
                    </div>
                    {categories.length === 0 ? (
                        <div className="py-8 text-center">
                            <Tag className="mx-auto h-8 w-8 text-surface-300" />
                            <p className="mt-2 text-sm text-surface-500">Nenhuma categoria criada</p>
                        </div>
                    ) : (
                        <div className="divide-y divide-subtle rounded-lg border border-default">
                            {categories.map((c: any) => (
                                <div key={c.id} className="flex items-center justify-between px-4 py-3">
                                    <div className="flex items-center gap-2.5">
                                        <span className="h-3 w-3 rounded-full" style={{ backgroundColor: c.color }} />
                                        <span className="text-sm font-medium text-surface-800">{c.name}</span>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <Button variant="ghost" size="sm" onClick={() => { setEditingCatId(c.id); setCatForm({ name: c.name, color: c.color }); setShowCatForm(true) }}>
                                            <Pencil className="h-3.5 w-3.5 text-surface-500" />
                                        </Button>
                                        <Button variant="ghost" size="sm" onClick={() => setDeleteCatTarget(c.id)}>
                                            <Trash2 className="h-3.5 w-3.5 text-red-500" />
                                        </Button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </Modal>

            {/* Category Create/Edit Modal */}
            <Modal open={showCatForm} onOpenChange={(v) => { setShowCatForm(v); if (!v) setEditingCatId(null) }} title={editingCatId ? 'Editar Categoria' : 'Nova Categoria de Despesa'}>
                <form onSubmit={e => { e.preventDefault(); saveCatMut.mutate(catForm) }} className="space-y-4">
                    <Input label="Nome *" value={catForm.name} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCatForm(p => ({ ...p, name: e.target.value }))} required />
                    <div>
                        <label className="mb-1.5 block text-[13px] font-medium text-surface-700">Cor</label>
                        <div className="flex items-center gap-3">
                            <input type="color" value={catForm.color} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCatForm(p => ({ ...p, color: e.target.value }))}
                                className="h-10 w-14 cursor-pointer rounded-lg border border-surface-300" />
                            <span className="text-[13px] text-surface-500">{catForm.color}</span>
                        </div>
                    </div>
                    <div className="flex justify-end gap-2 border-t pt-4">
                        <Button variant="outline" type="button" onClick={() => { setShowCatForm(false); setEditingCatId(null) }}>Cancelar</Button>
                        <Button type="submit" loading={saveCatMut.isPending} disabled={saveCatMut.isPending}>{editingCatId ? 'Salvar' : 'Criar'}</Button>
                    </div>
                </form>
            </Modal>

            {/* Delete Category Confirmation */}
            <Modal open={deleteCatTarget !== null} onOpenChange={() => setDeleteCatTarget(null)} title="Excluir Categoria">
                <div className="space-y-4">
                    <p className="text-[13px] text-surface-600">Tem certeza que deseja excluir esta categoria? Despesas vinculadas precisarão ser reclassificadas.</p>
                    <div className="flex justify-end gap-2 border-t pt-4">
                        <Button variant="outline" onClick={() => setDeleteCatTarget(null)}>Cancelar</Button>
                        <Button className="bg-red-600 hover:bg-red-700" loading={delCatMut.isPending} disabled={delCatMut.isPending} onClick={() => delCatMut.mutate(deleteCatTarget!)}>Excluir</Button>
                    </div>
                </div>
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
                            <div><span className="text-xs text-surface-500">Valor</span><p className="text-[15px] font-semibold tabular-nums">{fmtBRL(showDetail.amount)}</p></div>
                            <div><span className="text-xs text-surface-500">Status</span><Badge variant={statusConfig[showDetail.status]?.variant}>{statusConfig[showDetail.status]?.label}</Badge></div>
                            <div><span className="text-xs text-surface-500">Responsável</span><p className="text-sm">{showDetail.creator.name}</p></div>
                            <div><span className="text-xs text-surface-500">Data</span><p className="text-sm">{fmtDate(showDetail.expense_date)}</p></div>
                            {showDetail.payment_method && <div><span className="text-xs text-surface-500">Forma de Pagamento</span><p className="text-sm">{paymentMethods[showDetail.payment_method] ?? showDetail.payment_method}</p></div>}
                            {showDetail.approver && <div><span className="text-xs text-surface-500">Aprovado por</span><p className="text-sm">{showDetail.approver.name}</p></div>}
                            {showDetail.work_order && <div><span className="text-xs text-surface-500">OS</span><p className="text-sm text-brand-600 font-medium">{woIdentifier(showDetail.work_order)}</p></div>}
                            {showDetail.affects_technician_cash && <div><span className="text-xs text-surface-500">Caixa do Técnico</span><Badge variant="info">Impacta caixa</Badge></div>}
                            {showDetail.receipt_path && <div><span className="text-xs text-surface-500">Comprovante</span><p className="text-sm text-brand-600 underline"><a href={showDetail.receipt_path} target="_blank" rel="noreferrer">Ver comprovante</a></p></div>}
                            {showDetail.rejection_reason && <div className="col-span-2"><span className="text-xs text-surface-500">Motivo da rejeição</span><p className="text-sm text-red-600">{showDetail.rejection_reason}</p></div>}
                            {showDetail.notes && <div className="col-span-2"><span className="text-xs text-surface-500">Obs</span><p className="text-[13px] text-surface-600">{showDetail.notes}</p></div>}
                        </div>
                    </div>
                )}
            </Modal>

            {/* Rejection Modal */}
            <Modal open={rejectTarget !== null} onOpenChange={() => setRejectTarget(null)} title="Rejeitar Despesa">
                <form onSubmit={e => { e.preventDefault(); if (!rejectReason.trim()) return; statusMut.mutate({ id: rejectTarget!, status: EXPENSE_STATUS.REJECTED, rejection_reason: rejectReason.trim() }) }} className="space-y-4">
                    <div>
                        <label className="mb-1.5 block text-[13px] font-medium text-surface-700">Motivo da rejeição *</label>
                        <textarea value={rejectReason} onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setRejectReason(e.target.value)} rows={3} required
                            className="w-full rounded-lg border border-default bg-surface-50 px-3.5 py-2.5 text-sm focus:border-brand-400 focus:bg-surface-0 focus:outline-none focus:ring-2 focus:ring-brand-500/15"
                            placeholder="Informe o motivo da rejeição..." />
                    </div>
                    <div className="flex justify-end gap-2 border-t pt-4">
                        <Button variant="outline" type="button" onClick={() => setRejectTarget(null)}>Cancelar</Button>
                        <Button type="submit" className="bg-red-600 hover:bg-red-700" loading={statusMut.isPending} disabled={statusMut.isPending}>Rejeitar</Button>
                    </div>
                </form>
            </Modal>

            {/* Delete Confirmation Modal */}
            <Modal open={deleteTarget !== null} onOpenChange={() => setDeleteTarget(null)} title="Confirmar Exclusão">
                <div className="space-y-4">
                    <p className="text-[13px] text-surface-600">Tem certeza que deseja excluir esta despesa? Esta ação não pode ser desfeita.</p>
                    <div className="flex justify-end gap-2 border-t pt-4">
                        <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancelar</Button>
                        <Button className="bg-red-600 hover:bg-red-700" loading={delMut.isPending} disabled={delMut.isPending} onClick={() => { delMut.mutate(deleteTarget!) }}>Excluir</Button>
                    </div>
                </div>
            </Modal>
        </div>
    )
}
