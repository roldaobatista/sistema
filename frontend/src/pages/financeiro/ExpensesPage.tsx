import { useState, useEffect, useRef } from 'react'
import { toast } from 'sonner'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
    Receipt, Plus, Search, CheckCircle, XCircle, ClipboardCheck,
    Clock, Eye, Trash2, Tag, RefreshCw, Pencil, RotateCcw, Settings, Download, DollarSign,
    BarChart3, ChevronDown, Copy, History, AlertTriangle,
} from 'lucide-react'
import api from '@/lib/api'
import { broadcastQueryInvalidation } from '@/lib/cross-tab-sync'
import { EXPENSE_STATUS } from '@/lib/constants'
import { Button } from '@/components/ui/button'
import { IconButton } from '@/components/ui/iconbutton'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Modal } from '@/components/ui/modal'
import { PageHeader } from '@/components/ui/pageheader'
import { EmptyState } from '@/components/ui/emptystate'
import { useAuthStore } from '@/stores/auth-store'
import { ExpenseAnalyticsPanel } from '@/components/expenses/ExpenseAnalyticsPanel'
import { ExpenseHistoryModal } from '@/components/expenses/ExpenseHistoryModal'
import { ExpenseCategoryManager } from '@/components/expenses/ExpenseCategoryManager'
import { ColorDot } from '@/components/ui/color-dot'

const statusConfig: Record<string, { label: string; variant: any }> = {
    pending: { label: 'Pendente', variant: 'warning' },
    reviewed: { label: 'Conferido', variant: 'info' },
    approved: { label: 'Aprovado', variant: 'success' },
    rejected: { label: 'Rejeitado', variant: 'danger' },
    reimbursed: { label: 'Reembolsado', variant: 'success' },
}

const isEditableExpenseStatus = (status: string): status is 'pending' | 'rejected' =>
    status === EXPENSE_STATUS.PENDING || status === EXPENSE_STATUS.REJECTED

const paymentMethods: Record<string, string> = {
    dinheiro: 'Dinheiro', pix: 'PIX', cartao_credito: 'Cartão Crédito',
    cartao_debito: 'Cartão Débito', boleto: 'Boleto', transferencia: 'Transferência',
    corporate_card: 'Cartão Corporativo',
}

interface Exp {
    id: number; description: string; amount: string
    expense_date: string; status: string; payment_method: string | null
    notes: string | null; receipt_path: string | null
    chart_of_account_id?: number | null
    chart_of_account?: { id: number; code: string; name: string; type: string } | null
    rejection_reason?: string | null
    affects_technician_cash?: boolean
    affects_net_value?: boolean
    km_quantity?: string | null
    km_rate?: string | null
    km_billed_to_client?: boolean
    category: { id: number; name: string; color: string } | null
    creator: { id: number; name: string }
    work_order: { id: number; number: string; os_number?: string | null; business_number?: string | null } | null
    approver?: { id: number; name: string } | null
    reviewer?: { id: number; name: string } | null
    _warning?: string
    _budget_warning?: string
}

interface StatusHistoryEntry {
    id: number; from_status: string | null; to_status: string
    reason: string | null; changed_by: string; changed_at: string
}

const fmtBRL = (val: string | number) => Number(val).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const fmtDate = (d: string) => new Date(d + 'T00:00:00').toLocaleDateString('pt-BR')
const woIdentifier = (wo?: { number: string; os_number?: string | null; business_number?: string | null } | null) =>
    wo?.business_number ?? wo?.os_number ?? wo?.number ?? '—'

export function ExpensesPage() {
    const qc = useQueryClient()
    const { hasPermission } = useAuthStore()
    const canViewChart = hasPermission('finance.chart.view')

    const canCreate = hasPermission('expenses.expense.create')
    const canUpdate = hasPermission('expenses.expense.update')
    const canApprove = hasPermission('expenses.expense.approve')
    const canReview = hasPermission('expenses.expense.review')
    const canDelete = hasPermission('expenses.expense.delete')

    const [search, setSearch] = useState('')
    const [statusFilter, setStatusFilter] = useState('')
    const [catFilter, setCatFilter] = useState('')
    const [page, setPage] = useState(1)
    const [showForm, setShowForm] = useState(false)
    const [showDetail, setShowDetail] = useState<Exp | null>(null)
    const [showCatManager, setShowCatManager] = useState(false)
    const [editingId, setEditingId] = useState<number | null>(null)
    const [rejectTarget, setRejectTarget] = useState<number | null>(null)
    const [rejectReason, setRejectReason] = useState('')
    const [deleteTarget, setDeleteTarget] = useState<number | null>(null)
    const [dateFrom, setDateFrom] = useState('')
    const [dateTo, setDateTo] = useState('')
    const [debouncedSearch, setDebouncedSearch] = useState('')

    const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({})
    const searchTimer = useRef<ReturnType<typeof setTimeout>>(undefined)
    const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
    const [showBatchReject, setShowBatchReject] = useState(false)
    const [batchRejectReason, setBatchRejectReason] = useState('')
    const [creatorFilter, setCreatorFilter] = useState('')
    const [woFilter, setWoFilter] = useState('')
    const [showAnalytics, setShowAnalytics] = useState(false)
    const [showHistory, setShowHistory] = useState<number | null>(null)
    const emptyForm = {
        expense_category_id: '' as string | number, work_order_id: '' as string | number,
        chart_of_account_id: '' as string | number, description: '', amount: '', expense_date: '', payment_method: '', notes: '',
        affects_technician_cash: false, affects_net_value: true, receipt: null as File | null,
        km_quantity: '' as string | number, km_rate: '' as string | number, km_billed_to_client: false,
    }
    const [form, setForm] = useState(emptyForm)

    useEffect(() => {
        clearTimeout(searchTimer.current)
        searchTimer.current = setTimeout(() => setDebouncedSearch(search), 300)
        return () => clearTimeout(searchTimer.current)
    }, [search])

    // Reset page when filters change
    useEffect(() => { setPage(1) }, [debouncedSearch, statusFilter, catFilter, dateFrom, dateTo, creatorFilter, woFilter])

    const { data: res, isLoading } = useQuery({
        queryKey: ['expenses', debouncedSearch, statusFilter, catFilter, dateFrom, dateTo, creatorFilter, woFilter, page],
        queryFn: () => api.get('/expenses', {
            params: {
                search: debouncedSearch || undefined,
                status: statusFilter || undefined,
                expense_category_id: catFilter || undefined,
                date_from: dateFrom || undefined,
                date_to: dateTo || undefined,
                created_by: creatorFilter || undefined,
                work_order_id: woFilter || undefined,
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

    const { data: chartRes } = useQuery({
        queryKey: ['chart-of-accounts-expenses'],
        queryFn: () => api.get('/chart-of-accounts', { params: { is_active: 1, type: 'expense' } }),
        enabled: canViewChart && showForm,
    })
    const chartAccounts: { id: number; code: string; name: string }[] = chartRes?.data?.data ?? []

    const { data: analyticsRes } = useQuery({
        queryKey: ['expense-analytics'],
        queryFn: () => api.get('/expense-analytics'),
        enabled: showAnalytics,
    })
    const analytics = analyticsRes?.data ?? null

    const { data: wosRes } = useQuery({
        queryKey: ['work-orders-expense'],
        queryFn: () => api.get('/work-orders', { params: { per_page: 50 } }),
        enabled: showForm,
    })

    const { data: usersRes } = useQuery({
        queryKey: ['users-select-expenses'],
        queryFn: () => api.get('/users', { params: { per_page: 200, active: 1 } }),
    })
    const allUsers: { id: number; name: string }[] = usersRes?.data?.data ?? usersRes?.data ?? []

    const saveMut = useMutation({
        mutationFn: (data: typeof form) => {
            const formData = new FormData()
            if (data.expense_category_id) formData.append('expense_category_id', String(data.expense_category_id))
            if (data.work_order_id) formData.append('work_order_id', String(data.work_order_id))
            if (data.chart_of_account_id) formData.append('chart_of_account_id', String(data.chart_of_account_id))
            formData.append('description', data.description)
            formData.append('amount', data.amount)
            formData.append('expense_date', data.expense_date)
            if (data.payment_method) formData.append('payment_method', data.payment_method)
            if (data.notes) formData.append('notes', data.notes)
            formData.append('affects_technician_cash', data.affects_technician_cash ? '1' : '0')
            formData.append('affects_net_value', data.affects_net_value ? '1' : '0')
            if (data.km_quantity) formData.append('km_quantity', String(data.km_quantity))
            if (data.km_rate) formData.append('km_rate', String(data.km_rate))
            formData.append('km_billed_to_client', data.km_billed_to_client ? '1' : '0')
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
        onSuccess: (res: any) => {
            qc.invalidateQueries({ queryKey: ['expenses'] })
            qc.invalidateQueries({ queryKey: ['expense-summary'] })
            qc.invalidateQueries({ queryKey: ['expense-analytics'] })
            broadcastQueryInvalidation(['expenses', 'expense-summary', 'expense-analytics'], 'Despesa')
            setShowForm(false)
            setEditingId(null)
            setForm(emptyForm)
            setFieldErrors({})
            const msg = editingId ? 'Despesa atualizada com sucesso' : 'Despesa criada com sucesso'
            const warning = res?.data?._warning
            const budgetWarning = res?.data?._budget_warning
            toast.success(warning ? `${msg}. ⚠️ ${warning}` : budgetWarning ? `${msg}. ⚠️ ${budgetWarning}` : msg)
        },
        onError: (err: any) => {
            if (err?.response?.status === 422 && err?.response?.data?.errors) {
                setFieldErrors(err.response.data.errors)
            } else if (err?.response?.status === 403) {
                toast.error('Você não tem permissão para esta ação')
            } else {
                toast.error(err?.response?.data?.message ?? 'Erro ao salvar despesa')
            }
        },
    })

    const statusMut = useMutation({
        mutationFn: ({ id, status, rejection_reason }: { id: number; status: string; rejection_reason?: string }) =>
            api.put(`/expenses/${id}/status`, { status, rejection_reason }),
        onSuccess: (_d, vars) => {
            qc.invalidateQueries({ queryKey: ['expenses'] })
            qc.invalidateQueries({ queryKey: ['expense-summary'] })
            qc.invalidateQueries({ queryKey: ['expense-analytics'] })
            broadcastQueryInvalidation(['expenses', 'expense-summary', 'expense-analytics'], 'Despesa')
            setRejectTarget(null)
            toast.success(`Despesa ${statusConfig[vars.status]?.label?.toLowerCase() ?? vars.status} com sucesso`)
        },
        onError: (err: any) => {
            setRejectTarget(null)
            if (err?.response?.status === 403) {
                toast.error(err?.response?.data?.message ?? 'Você não tem permissão para esta ação')
            } else {
                toast.error(err?.response?.data?.message ?? 'Erro ao atualizar status')
            }
        },
    })

    const delMut = useMutation({
        mutationFn: (id: number) => api.delete(`/expenses/${id}`),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['expenses'] })
            qc.invalidateQueries({ queryKey: ['expense-summary'] })
            qc.invalidateQueries({ queryKey: ['expense-analytics'] })
            broadcastQueryInvalidation(['expenses', 'expense-summary', 'expense-analytics'], 'Despesa')
            setDeleteTarget(null)
            toast.success('Despesa excluída com sucesso')
        },
        onError: (err: any) => {
            setDeleteTarget(null)
            if (err?.response?.status === 403) {
                toast.error('Você não tem permissão para excluir')
            } else {
                toast.error(err?.response?.data?.message ?? 'Erro ao excluir despesa')
            }
        },
    })

    const batchMut = useMutation({
        mutationFn: (data: { expense_ids: number[]; status: string; rejection_reason?: string }) =>
            api.post('/expenses/batch-status', data),
        onSuccess: (res: any) => {
            qc.invalidateQueries({ queryKey: ['expenses'] })
            qc.invalidateQueries({ queryKey: ['expense-summary'] })
            qc.invalidateQueries({ queryKey: ['expense-analytics'] })
            broadcastQueryInvalidation(['expenses', 'expense-summary', 'expense-analytics'], 'Despesa')
            setSelectedIds(new Set())
            setShowBatchReject(false)
            toast.success(res?.data?.message ?? 'Lote processado com sucesso')
        },
        onError: (err: any) => {
            if (err?.response?.status === 422) {
                toast.error(err?.response?.data?.message ?? 'Erro de validação no lote')
            } else if (err?.response?.status === 403) {
                toast.error('Você não tem permissão para esta ação')
            } else {
                toast.error(err?.response?.data?.message ?? 'Erro ao processar lote')
            }
        },
    })

    const dupMut = useMutation({
        mutationFn: (id: number) => api.post(`/expenses/${id}/duplicate`),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['expenses'] })
            qc.invalidateQueries({ queryKey: ['expense-summary'] })
            qc.invalidateQueries({ queryKey: ['expense-analytics'] })
            broadcastQueryInvalidation(['expenses', 'expense-summary', 'expense-analytics'], 'Despesa')
            toast.success('Despesa duplicada como pendente')
        },
        onError: (err: any) => {
            toast.error(err?.response?.data?.message ?? 'Erro ao duplicar despesa')
        },
    })

    const reviewMut = useMutation({
        mutationFn: (id: number) => api.post(`/expenses/${id}/review`),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['expenses'] })
            qc.invalidateQueries({ queryKey: ['expense-summary'] })
            broadcastQueryInvalidation(['expenses', 'expense-summary'], 'Despesa')
            toast.success('Despesa conferida com sucesso')
        },
        onError: (err: any) => {
            if (err?.response?.status === 403) {
                toast.error(err?.response?.data?.message ?? 'Você não tem permissão para conferir')
            } else {
                toast.error(err?.response?.data?.message ?? 'Erro ao conferir despesa')
            }
        },
    })

    const { data: historyRes } = useQuery({
        queryKey: ['expense-history', showHistory],
        queryFn: () => api.get(`/expenses/${showHistory}/history`),
        enabled: showHistory !== null,
    })
    const historyEntries: StatusHistoryEntry[] = historyRes?.data ?? []

    const handleExport = async () => {
        try {
            const params = new URLSearchParams()
            if (statusFilter) params.set('status', statusFilter)
            if (catFilter) params.set('expense_category_id', catFilter)
            if (dateFrom) params.set('date_from', dateFrom)
            if (dateTo) params.set('date_to', dateTo)
            if (creatorFilter) params.set('created_by', creatorFilter)
            if (woFilter) params.set('work_order_id', woFilter)
            const response = await api.get(`/expenses-export?${params.toString()}`, { responseType: 'blob' })
            const url = window.URL.createObjectURL(new Blob([response.data]))
            const a = document.createElement('a')
            a.href = url
            a.download = `despesas_${new Date().toISOString().slice(0, 10)}.csv`
            a.click()
            window.URL.revokeObjectURL(url)
            toast.success('Exportação concluída')
        } catch {
            toast.error('Erro ao exportar despesas')
        }
    }

    const toggleSelect = (id: number) => {
        setSelectedIds(prev => {
            const next = new Set(prev)
            if (next.has(id)) next.delete(id); else next.add(id)
            return next
        })
    }

    const toggleSelectAll = () => {
        const eligibleIds = records.filter(r => r.status === EXPENSE_STATUS.PENDING || r.status === EXPENSE_STATUS.REVIEWED).map(r => r.id)
        if (eligibleIds.length > 0 && eligibleIds.every(id => selectedIds.has(id))) {
            setSelectedIds(new Set())
        } else {
            setSelectedIds(new Set(eligibleIds))
        }
    }

    const eligibleRecords = records.filter(r => r.status === EXPENSE_STATUS.PENDING || r.status === EXPENSE_STATUS.REVIEWED)
    const allEligibleSelected = eligibleRecords.length > 0 && eligibleRecords.every(r => selectedIds.has(r.id))

    const filterUsers = allUsers.length > 0 ? allUsers : Array.from(new Map(records.map(r => [r.creator.id, r.creator])).values())

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
                toast.error('Você não tem permissão para ver esta despesa')
            } else {
                toast.error(err?.response?.data?.message ?? 'Erro ao carregar detalhes da despesa')
            }
        }
    }

    const openEdit = (exp: Exp) => {
        if (!isEditableExpenseStatus(exp.status)) return
        setEditingId(exp.id)
        setFieldErrors({})
        setForm({
            expense_category_id: exp.category?.id ?? '',
            work_order_id: exp.work_order?.id ?? '',
            chart_of_account_id: exp.chart_of_account?.id ?? '',
            description: exp.description,
            amount: exp.amount,
            expense_date: exp.expense_date,
            payment_method: exp.payment_method ?? '',
            notes: exp.notes ?? '',
            affects_technician_cash: !!exp.affects_technician_cash,
            affects_net_value: exp.affects_net_value !== false,
            receipt: null,
            km_quantity: exp.km_quantity ?? '',
            km_rate: exp.km_rate ?? '',
            km_billed_to_client: !!exp.km_billed_to_client,
        })
        setShowForm(true)
    }

    return (
        <div className="space-y-5">
            <PageHeader
                title="Despesas"
                subtitle="Controle de despesas e aprovações"
                count={pagination?.total}
                actions={[
                    { label: 'Exportar CSV', onClick: handleExport, icon: <Download className="h-4 w-4" />, variant: 'outline' as const },
                    ...(canCreate ? [{ label: 'Categorias', onClick: () => setShowCatManager(true), icon: <Settings className="h-4 w-4" />, variant: 'outline' as const }] : []),
                    ...(canCreate ? [{ label: 'Nova Despesa', onClick: () => { setEditingId(null); setForm(emptyForm); setFieldErrors({}); setShowForm(true) }, icon: <Plus className="h-4 w-4" /> }] : []),
                ]}
            />

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-xl border border-default bg-surface-0 p-4 shadow-card">
                    <div className="flex items-center gap-2 text-amber-600"><Clock className="h-4 w-4" /><span className="text-xs font-medium">Pendente Aprovação</span></div>
                    <p className="mt-1 text-xl font-bold text-surface-900">{fmtBRL(summary.pending ?? 0)}</p>
                    <p className="mt-0.5 text-xs text-surface-400">{summary.pending_count ?? 0} despesa(s)</p>
                </div>
                <div className="rounded-xl border border-default bg-surface-0 p-4 shadow-card">
                    <div className="flex items-center gap-2 text-sky-600"><CheckCircle className="h-4 w-4" /><span className="text-xs font-medium">Aprovado</span></div>
                    <p className="mt-1 text-xl font-bold text-sky-600">{fmtBRL(summary.approved ?? 0)}</p>
                </div>
                <div className="rounded-xl border border-default bg-surface-0 p-4 shadow-card">
                    <div className="flex items-center gap-2 text-emerald-600"><DollarSign className="h-4 w-4" /><span className="text-xs font-medium">Reembolsado</span></div>
                    <p className="mt-1 text-xl font-bold text-emerald-600">{fmtBRL(summary.reimbursed ?? 0)}</p>
                </div>
                <div className="rounded-xl border border-default bg-surface-0 p-4 shadow-card">
                    <div className="flex items-center gap-2 text-surface-600"><Receipt className="h-4 w-4" /><span className="text-xs font-medium">Total do Mês</span></div>
                    <p className="mt-1 text-xl font-bold text-surface-900">{fmtBRL(summary.month_total ?? 0)}</p>
                    <p className="mt-0.5 text-xs text-surface-400">{summary.total_count ?? 0} total</p>
                </div>
            </div>

            <ExpenseAnalyticsPanel
                show={showAnalytics}
                onToggle={() => setShowAnalytics(p => !p)}
                analytics={analytics}
                fmtBRL={fmtBRL}
            />

            <div className="flex flex-wrap gap-3">
                <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-surface-400" />
                    <input value={search} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearch(e.target.value)} placeholder="Buscar descrição"
                        className="w-full rounded-lg border border-default bg-surface-50 py-2.5 pl-10 pr-4 text-sm focus:border-brand-500 focus:outline-none" />
                </div>
                <select value={statusFilter} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setStatusFilter(e.target.value)}
                    aria-label="Filtrar por status"
                    className="rounded-lg border border-default bg-surface-50 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none">
                    <option value="">Todos os status</option>
                    {Object.entries(statusConfig).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
                <select value={catFilter} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setCatFilter(e.target.value)}
                    aria-label="Filtrar por categoria"
                    className="rounded-lg border border-default bg-surface-50 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none">
                    <option value="">Todas categorias</option>
                    {categories.map((c: { id: number; name: string }) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                {filterUsers.length > 1 && (
                    <select value={creatorFilter} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setCreatorFilter(e.target.value)}
                        aria-label="Filtrar por responsável"
                        className="rounded-lg border border-default bg-surface-50 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none">
                        <option value="">Todos responsáveis</option>
                        {filterUsers.map((c: { id: number; name: string }) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                )}
            </div>
            <div className="flex flex-wrap gap-3">
                <Input type="date" value={dateFrom} onChange={(e: any) => setDateFrom(e.target.value)} className="w-40" placeholder="De" />
                <Input type="date" value={dateTo} onChange={(e: any) => setDateTo(e.target.value)} className="w-40" placeholder="Até" />
                {woFilter && (
                    <Button variant="ghost" size="sm" onClick={() => setWoFilter('')} className="text-xs text-surface-500">
                        Limpar filtro OS
                    </Button>
                )}
            </div>

            {selectedIds.size > 0 && canApprove && (
                <div className="flex items-center gap-3 rounded-lg border border-brand-200 bg-brand-50/50 px-4 py-2.5">
                    <span className="text-sm font-medium text-brand-700">{selectedIds.size} selecionada(s)</span>
                    <Button size="sm" variant="outline" icon={<CheckCircle className="h-4 w-4" />}
                        loading={batchMut.isPending}
                        onClick={() => batchMut.mutate({ expense_ids: Array.from(selectedIds), status: EXPENSE_STATUS.APPROVED })}>
                        Aprovar Selecionadas
                    </Button>
                    <Button size="sm" variant="outline" className="border-red-300 text-red-600 hover:bg-red-50" icon={<XCircle className="h-4 w-4" />}
                        onClick={() => { setShowBatchReject(true); setBatchRejectReason('') }}>
                        Rejeitar Selecionadas
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setSelectedIds(new Set())}>
                        Limpar seleção
                    </Button>
                </div>
            )}

            <div className="overflow-hidden rounded-xl border border-default bg-surface-0 shadow-card">
                <table className="w-full">
                    <thead>
                        <tr className="border-b border-subtle bg-surface-50">
                            {canApprove && (
                                <th className="w-10 px-3 py-2.5">
                                    <input type="checkbox" checked={allEligibleSelected && eligibleRecords.length > 0} onChange={toggleSelectAll}
                                        className="h-4 w-4 rounded border-default text-brand-600 focus:ring-brand-500"
                                        title="Selecionar pendentes e conferidas" />
                                </th>
                            )}
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
                            Array.from({ length: 5 }).map((_, i) => (
                                <tr key={`skel-${i}`}>
                                    {canApprove && <td className="px-3 py-3"><div className="h-4 w-4 animate-pulse rounded bg-surface-200" /></td>}
                                    <td className="px-4 py-3"><div className="h-4 w-32 animate-pulse rounded bg-surface-200" /></td>
                                    <td className="hidden px-4 py-3 sm:table-cell"><div className="h-4 w-20 animate-pulse rounded bg-surface-200" /></td>
                                    <td className="hidden px-4 py-3 md:table-cell"><div className="h-4 w-24 animate-pulse rounded bg-surface-200" /></td>
                                    <td className="hidden px-4 py-3 md:table-cell"><div className="h-4 w-20 animate-pulse rounded bg-surface-200" /></td>
                                    <td className="px-4 py-3"><div className="h-5 w-16 animate-pulse rounded-full bg-surface-200" /></td>
                                    <td className="px-4 py-3"><div className="ml-auto h-4 w-20 animate-pulse rounded bg-surface-200" /></td>
                                    <td className="px-4 py-3"><div className="ml-auto h-4 w-16 animate-pulse rounded bg-surface-200" /></td>
                                </tr>
                            ))
                        ) : records.length === 0 ? (
                            <tr><td colSpan={canApprove ? 8 : 7} className="px-4 py-16 text-center">
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
                            <tr key={r.id} className={`hover:bg-surface-50 transition-colors duration-100 ${selectedIds.has(r.id) ? 'bg-brand-50/30' : ''}`}>
                                {canApprove && (
                                    <td className="px-3 py-3">
                                        {(r.status === EXPENSE_STATUS.PENDING || r.status === EXPENSE_STATUS.REVIEWED) ? (
                                            <input type="checkbox" checked={selectedIds.has(r.id)} onChange={() => toggleSelect(r.id)}
                                                aria-label={`Selecionar despesa ${r.description}`}
                                                className="h-4 w-4 rounded border-default text-brand-600 focus:ring-brand-500" />
                                        ) : <div className="h-4 w-4" />}
                                    </td>
                                )}
                                <td className="px-4 py-3">
                                    <p className="text-sm font-medium text-surface-900">{r.description}</p>
                                    {r.work_order && <p className="text-xs text-brand-500">{woIdentifier(r.work_order)}</p>}
                                </td>
                                <td className="hidden px-4 py-3 sm:table-cell">
                                    {r.category ? (
                                        <span className="inline-flex items-center gap-1.5 text-xs font-medium">
                                            <ColorDot color={r.category.color} size="md" />
                                            {r.category.name}
                                        </span>
                                    ) : '—'}
                                </td>
                                <td className="hidden px-4 py-3 text-sm text-surface-600 md:table-cell">{r.creator.name}</td>
                                <td className="hidden px-4 py-3 text-sm text-surface-500 md:table-cell">{fmtDate(r.expense_date)}</td>
                                <td className="px-4 py-3"><Badge variant={statusConfig[r.status]?.variant}>{statusConfig[r.status]?.label}</Badge></td>
                                <td className="px-3.5 py-2.5 text-right text-sm font-semibold text-surface-900">{fmtBRL(r.amount)}</td>
                                <td className="px-4 py-3">
                                    <div className="flex items-center justify-end gap-1">
                                        <IconButton label="Ver detalhes" icon={<Eye className="h-4 w-4" />} onClick={() => loadDetail(r)} />
                                        {canUpdate && isEditableExpenseStatus(r.status) && (
                                            <IconButton label="Editar" icon={<Pencil className="h-4 w-4" />} onClick={() => openEdit(r)} className="hover:text-brand-600" />
                                        )}
                                        {canReview && r.status === EXPENSE_STATUS.PENDING && (
                                            <IconButton label="Conferir" icon={<ClipboardCheck className="h-4 w-4" />} onClick={() => reviewMut.mutate(r.id)} className="hover:text-blue-600" />
                                        )}
                                        {canApprove && (r.status === EXPENSE_STATUS.PENDING || r.status === EXPENSE_STATUS.REVIEWED) && (
                                            <>
                                                <IconButton label="Aprovar" icon={<CheckCircle className="h-4 w-4" />} onClick={() => statusMut.mutate({ id: r.id, status: EXPENSE_STATUS.APPROVED })} className="hover:text-sky-600" />
                                                <IconButton label="Rejeitar" icon={<XCircle className="h-4 w-4" />} onClick={() => {
                                                    setRejectTarget(r.id)
                                                    setRejectReason('')
                                                }} className="hover:text-red-600" />
                                            </>
                                        )}
                                        {canApprove && r.status === EXPENSE_STATUS.APPROVED && (
                                            <IconButton label="Marcar como reembolsado" icon={<RefreshCw className="h-4 w-4" />} onClick={() => statusMut.mutate({ id: r.id, status: EXPENSE_STATUS.REIMBURSED })} className="hover:text-emerald-600" />
                                        )}
                                        {r.status === EXPENSE_STATUS.REJECTED && (canUpdate || canApprove) && (
                                            <IconButton label="Resubmeter como pendente" icon={<RotateCcw className="h-4 w-4" />} onClick={() => statusMut.mutate({ id: r.id, status: EXPENSE_STATUS.PENDING })} className="hover:text-amber-600" />
                                        )}
                                        {canCreate && (
                                            <IconButton label="Duplicar" icon={<Copy className="h-4 w-4" />} onClick={() => dupMut.mutate(r.id)} />
                                        )}
                                        <IconButton label="Histórico" icon={<History className="h-4 w-4" />} onClick={() => setShowHistory(r.id)} />
                                        {canDelete && isEditableExpenseStatus(r.status) && (
                                            <IconButton label="Excluir" icon={<Trash2 className="h-4 w-4" />} onClick={() => setDeleteTarget(r.id)} className="hover:text-red-600" />
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

            <Modal open={showForm} onOpenChange={(v) => { setShowForm(v); if (!v) { setEditingId(null); setFieldErrors({}) } }} title={editingId ? 'Editar Despesa' : 'Nova Despesa'} size="lg">
                <form onSubmit={e => { e.preventDefault(); saveMut.mutate(form) }} className="space-y-4">
                    <div>
                        <Input label="Descrição *" value={form.description} onChange={(e: React.ChangeEvent<HTMLInputElement>) => set('description', e.target.value)} required />
                        {fieldErrors.description && <p className="mt-1 text-xs text-red-500">{fieldErrors.description[0]}</p>}
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                        <div>
                            <label htmlFor="expense_category_id" className="mb-1.5 block text-sm font-medium text-surface-700">Categoria</label>
                            <select id="expense_category_id" value={form.expense_category_id} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => set('expense_category_id', e.target.value)}
                                className="w-full rounded-lg border border-default bg-surface-50 px-3.5 py-2.5 text-sm focus:border-brand-400 focus:bg-surface-0 focus:outline-none focus:ring-2 focus:ring-brand-500/15">
                                <option value="">Sem categoria</option>
                                {categories.map((c: { id: number; name: string }) => <option key={c.id} value={c.id}>{c.name}</option>)}
                            </select>
                            {fieldErrors.expense_category_id && <p className="mt-1 text-xs text-red-500">{fieldErrors.expense_category_id[0]}</p>}
                        </div>
                        <div>
                            <label htmlFor="work_order_id" className="mb-1.5 block text-sm font-medium text-surface-700">Vinculada à OS</label>
                            <select id="work_order_id" value={form.work_order_id} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => set('work_order_id', e.target.value)}
                                className="w-full rounded-lg border border-default bg-surface-50 px-3.5 py-2.5 text-sm focus:border-brand-400 focus:bg-surface-0 focus:outline-none focus:ring-2 focus:ring-brand-500/15">
                                <option value="">Nenhuma</option>
                                {(wosRes?.data?.data ?? []).map((wo: any) => <option key={wo.id} value={wo.id}>{wo.business_number ?? wo.os_number ?? wo.number} — {wo.customer?.name}</option>)}
                            </select>
                        </div>
                    </div>
                    {canViewChart && (
                        <div>
                            <label htmlFor="chart_of_account_id" className="mb-1.5 block text-sm font-medium text-surface-700">Plano de Contas</label>
                            <select id="chart_of_account_id" value={form.chart_of_account_id} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => set('chart_of_account_id', e.target.value)}
                                className="w-full rounded-lg border border-default bg-surface-50 px-3.5 py-2.5 text-sm focus:border-brand-400 focus:bg-surface-0 focus:outline-none focus:ring-2 focus:ring-brand-500/15">
                                <option value="">Nao classificado</option>
                                {chartAccounts.map(account => <option key={account.id} value={account.id}>{account.code} - {account.name}</option>)}
                            </select>
                        </div>
                    )}
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
                            <label htmlFor="payment_method" className="mb-1.5 block text-sm font-medium text-surface-700">Forma Pgto</label>
                            <select id="payment_method" value={form.payment_method} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => set('payment_method', e.target.value)}
                                className="w-full rounded-lg border border-default bg-surface-50 px-3.5 py-2.5 text-sm focus:border-brand-400 focus:bg-surface-0 focus:outline-none focus:ring-2 focus:ring-brand-500/15">
                                <option value="">Não definido</option>
                                {Object.entries(paymentMethods).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                            </select>
                        </div>
                    </div>
                    <div>
                        <label htmlFor="expense_notes" className="mb-1.5 block text-sm font-medium text-surface-700">Observações</label>
                        <textarea id="expense_notes" value={form.notes} onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => set('notes', e.target.value)} rows={2}
                            className="w-full rounded-lg border border-default bg-surface-50 px-3.5 py-2.5 text-sm focus:border-brand-400 focus:bg-surface-0 focus:outline-none focus:ring-2 focus:ring-brand-500/15" />
                    </div>
                    <div className="flex flex-col gap-2 sm:flex-row sm:gap-6">
                        <div className="flex items-center gap-2">
                            <input type="checkbox" id="affects_cash" checked={form.affects_technician_cash}
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => set('affects_technician_cash', e.target.checked as any)}
                                className="h-4 w-4 rounded border-default text-brand-600 focus:ring-brand-500" />
                            <label htmlFor="affects_cash" className="text-sm font-medium text-surface-700">Impacta caixa do técnico</label>
                        </div>
                        <div className="flex items-center gap-2">
                            <input type="checkbox" id="affects_net" checked={form.affects_net_value}
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => set('affects_net_value', e.target.checked as any)}
                                className="h-4 w-4 rounded border-default text-brand-600 focus:ring-brand-500" />
                            <label htmlFor="affects_net" className="text-sm font-medium text-surface-700">Deduz do valor líquido (comissões)</label>
                        </div>
                    </div>
                    {/* Km Tracking */}
                    <div className="rounded-lg border border-default p-3 space-y-3 bg-surface-50/50">
                        <p className="text-xs font-semibold text-surface-600 uppercase tracking-wider">Km Rodados</p>
                        <div className="grid gap-3 sm:grid-cols-3">
                            <div>
                                <Input label="Quantidade (km)" type="number" step="0.1" value={form.km_quantity}
                                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                                        const km = e.target.value
                                        set('km_quantity', km)
                                        if (km && form.km_rate) {
                                            set('amount', String((Number(km) * Number(form.km_rate)).toFixed(2)))
                                        }
                                    }} />
                            </div>
                            <div>
                                <Input label="Valor por km (R$)" type="number" step="0.01" value={form.km_rate}
                                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                                        const rate = e.target.value
                                        set('km_rate', rate)
                                        if (rate && form.km_quantity) {
                                            set('amount', String((Number(form.km_quantity) * Number(rate)).toFixed(2)))
                                        }
                                    }} />
                            </div>
                            <div className="flex items-end pb-1">
                                <div className="flex items-center gap-2">
                                    <input type="checkbox" id="km_billed" checked={form.km_billed_to_client}
                                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => set('km_billed_to_client', e.target.checked as any)}
                                        className="h-4 w-4 rounded border-default text-brand-600 focus:ring-brand-500" />
                                    <label htmlFor="km_billed" className="text-sm font-medium text-surface-700">Cobrar do cliente</label>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div>
                        <label htmlFor="expense_receipt" className="mb-1.5 block text-sm font-medium text-surface-700">Comprovante</label>
                        <input id="expense_receipt" type="file" accept="image/*,.pdf" onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
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

            <ExpenseCategoryManager
                open={showCatManager}
                onClose={() => setShowCatManager(false)}
                categories={categories}
            />

            <Modal open={!!showDetail} onOpenChange={() => setShowDetail(null)} title="Detalhes da Despesa" size="lg">
                {showDetail && (
                    <div className="space-y-4">
                        <div className="grid gap-4 sm:grid-cols-2">
                            <div><span className="text-xs text-surface-500">Descrição</span><p className="text-sm font-medium">{showDetail.description}</p></div>
                            <div>
                                <span className="text-xs text-surface-500">Categoria</span>
                                {showDetail.category ? (
                                    <p className="flex items-center gap-1.5 text-sm font-medium">
                                        <ColorDot color={showDetail.category.color} size="md" />
                                        {showDetail.category.name}
                                    </p>
                                ) : <p className="text-sm text-surface-400">Sem categoria</p>}
                            </div>
                            <div>
                                <span className="text-xs text-surface-500">Plano de Contas</span>
                                <p className="text-sm font-medium">{showDetail.chart_of_account ? `${showDetail.chart_of_account.code} - ${showDetail.chart_of_account.name}` : '—'}</p>
                            </div>
                            <div><span className="text-xs text-surface-500">Valor</span><p className="text-sm font-semibold tabular-nums">{fmtBRL(showDetail.amount)}</p></div>
                            <div><span className="text-xs text-surface-500">Status</span><Badge variant={statusConfig[showDetail.status]?.variant}>{statusConfig[showDetail.status]?.label}</Badge></div>
                            <div><span className="text-xs text-surface-500">Responsável</span><p className="text-sm">{showDetail.creator.name}</p></div>
                            <div><span className="text-xs text-surface-500">Data</span><p className="text-sm">{fmtDate(showDetail.expense_date)}</p></div>
                            {showDetail.payment_method && <div><span className="text-xs text-surface-500">Forma de Pagamento</span><p className="text-sm">{paymentMethods[showDetail.payment_method] ?? showDetail.payment_method}</p></div>}
                            {showDetail.approver && <div><span className="text-xs text-surface-500">Aprovado por</span><p className="text-sm">{showDetail.approver.name}</p></div>}
                            {showDetail.work_order && <div><span className="text-xs text-surface-500">OS</span><p className="text-sm text-brand-600 font-medium">{woIdentifier(showDetail.work_order)}</p></div>}
                            {showDetail.reviewer && <div><span className="text-xs text-surface-500">Conferido por</span><p className="text-sm">{showDetail.reviewer.name}</p></div>}
                            {showDetail.affects_technician_cash && <div><span className="text-xs text-surface-500">Caixa do Técnico</span><Badge variant="info">Impacta caixa</Badge></div>}
                            {showDetail.affects_net_value && <div><span className="text-xs text-surface-500">Valor Líquido</span><Badge variant="warning">Deduz do líquido</Badge></div>}
                            {showDetail.km_quantity && Number(showDetail.km_quantity) > 0 && (
                                <div><span className="text-xs text-surface-500">Km Rodados</span><p className="text-sm font-medium">{Number(showDetail.km_quantity).toLocaleString('pt-BR', { minimumFractionDigits: 1 })} km</p></div>
                            )}
                            {showDetail.km_rate && Number(showDetail.km_rate) > 0 && (
                                <div><span className="text-xs text-surface-500">Valor por Km</span><p className="text-sm font-medium">{fmtBRL(showDetail.km_rate)}</p></div>
                            )}
                            {showDetail.km_billed_to_client && <div><span className="text-xs text-surface-500">Km cobrado do cliente</span><Badge variant="info">Sim</Badge></div>}
                            {showDetail.receipt_path && <div><span className="text-xs text-surface-500">Comprovante</span><p className="text-sm text-brand-600 underline"><a href={`${api.defaults.baseURL?.replace('/api', '')}${showDetail.receipt_path}`} target="_blank" rel="noreferrer">Ver comprovante</a></p></div>}
                            {showDetail.rejection_reason && <div className="col-span-2"><span className="text-xs text-surface-500">Motivo da rejeição</span><p className="text-sm text-red-600">{showDetail.rejection_reason}</p></div>}
                            {showDetail.notes && <div className="col-span-2"><span className="text-xs text-surface-500">Obs</span><p className="text-sm text-surface-600">{showDetail.notes}</p></div>}
                        </div>
                    </div>
                )}
            </Modal>

            <Modal open={rejectTarget !== null} onOpenChange={() => setRejectTarget(null)} title="Rejeitar Despesa">
                <form onSubmit={e => { e.preventDefault(); if (!rejectReason.trim()) return; statusMut.mutate({ id: rejectTarget!, status: EXPENSE_STATUS.REJECTED, rejection_reason: rejectReason.trim() }) }} className="space-y-4">
                    <div>
                        <label className="mb-1.5 block text-sm font-medium text-surface-700">Motivo da rejeição *</label>
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

            <Modal open={deleteTarget !== null} onOpenChange={() => setDeleteTarget(null)} title="Confirmar Exclusão">
                <div className="space-y-4">
                    <p className="text-sm text-surface-600">Tem certeza que deseja excluir esta despesa? Esta ação não pode ser desfeita.</p>
                    <div className="flex justify-end gap-2 border-t pt-4">
                        <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancelar</Button>
                        <Button className="bg-red-600 hover:bg-red-700" loading={delMut.isPending} disabled={delMut.isPending} onClick={() => { delMut.mutate(deleteTarget!) }}>Excluir</Button>
                    </div>
                </div>
            </Modal>

            <Modal open={showBatchReject} onOpenChange={setShowBatchReject} title="Rejeitar em Lote">
                <form onSubmit={e => { e.preventDefault(); if (!batchRejectReason.trim()) return; batchMut.mutate({ expense_ids: Array.from(selectedIds), status: EXPENSE_STATUS.REJECTED, rejection_reason: batchRejectReason.trim() }) }} className="space-y-4">
                    <p className="text-sm text-surface-600">{selectedIds.size} despesa(s) selecionada(s) serão rejeitadas.</p>
                    <div>
                        <label className="mb-1.5 block text-sm font-medium text-surface-700">Motivo da rejeição *</label>
                        <textarea value={batchRejectReason} onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setBatchRejectReason(e.target.value)} rows={3} required
                            className="w-full rounded-lg border border-default bg-surface-50 px-3.5 py-2.5 text-sm focus:border-brand-400 focus:bg-surface-0 focus:outline-none focus:ring-2 focus:ring-brand-500/15"
                            placeholder="Informe o motivo da rejeição..." />
                    </div>
                    <div className="flex justify-end gap-2 border-t pt-4">
                        <Button variant="outline" type="button" onClick={() => setShowBatchReject(false)}>Cancelar</Button>
                        <Button type="submit" className="bg-red-600 hover:bg-red-700" loading={batchMut.isPending} disabled={batchMut.isPending}>Rejeitar Selecionadas</Button>
                    </div>
                </form>
            </Modal>

            <ExpenseHistoryModal
                open={showHistory !== null}
                onClose={() => setShowHistory(null)}
                entries={historyEntries}
                statusConfig={statusConfig}
            />
        </div>
    )
}
