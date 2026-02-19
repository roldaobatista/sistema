import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Receipt, Loader2, Plus, AlertTriangle } from 'lucide-react'
import { cn, formatCurrency } from '@/lib/utils'
import api from '@/lib/api'
import { toast } from 'sonner'
import { useExpenseCategories } from '@/hooks/useExpenseCategories'
import { usePullToRefresh } from '@/hooks/usePullToRefresh'
import ExpenseForm from '@/components/expenses/ExpenseForm'
import type { ExpenseFormSubmitData } from '@/components/expenses/ExpenseForm'
import type { ExpenseItem, ExpenseStatus } from '@/types/expense'
import { EXPENSE_STATUS_MAP } from '@/types/expense'

export default function TechExpensesOverviewPage() {
    const navigate = useNavigate()
    const { categories } = useExpenseCategories()
    const [expenses, setExpenses] = useState<ExpenseItem[]>([])
    const [loading, setLoading] = useState(true)
    const [period, setPeriod] = useState<'week' | 'month' | 'all'>('month')
    const [categoryFilter, setCategoryFilter] = useState('')
    const [showCreateForm, setShowCreateForm] = useState(false)

    const fetchExpenses = useCallback(async () => {
        setLoading(true)
        try {
            const params: Record<string, string> = { my: '1', per_page: '200' }
            if (period === 'week') {
                const d = new Date()
                d.setDate(d.getDate() - 7)
                params.date_from = d.toISOString().slice(0, 10)
            } else if (period === 'month') {
                const d = new Date()
                d.setDate(1)
                params.date_from = d.toISOString().slice(0, 10)
            }
            const { data } = await api.get('/expenses', { params })
            setExpenses(data.data ?? data ?? [])
        } catch {
            toast.error('Erro ao carregar despesas')
        } finally {
            setLoading(false)
        }
    }, [period])

    useEffect(() => { fetchExpenses() }, [fetchExpenses])

    const { containerRef, isRefreshing, pullDistance } = usePullToRefresh({
        onRefresh: fetchExpenses,
    })

    const handleCreateExpense = useCallback(async (data: ExpenseFormSubmitData) => {
        try {
            const formData = new FormData()
            formData.append('expense_category_id', String(data.expense_category_id))
            formData.append('description', data.description || data.categoryName)
            formData.append('amount', data.amount)
            formData.append('expense_date', data.expense_date)
            formData.append('affects_technician_cash', '1')
            formData.append('affects_net_value', '1')
            if (data.notes) formData.append('notes', data.notes)
            if (data.photo) formData.append('receipt', data.photo)

            const { data: created } = await api.post('/expenses', formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
            })

            setShowCreateForm(false)
            toast.success('Despesa registrada com sucesso')

            if (created._budget_warning) {
                toast.warning(created._budget_warning)
            }

            fetchExpenses()
        } catch (err: unknown) {
            const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
            toast.error(msg || 'Erro ao salvar despesa')
        }
    }, [fetchExpenses])

    const toNum = (v: number | string) => Number(v) || 0

    const filtered = categoryFilter
        ? expenses.filter(e => (e.category?.name ?? 'Outros') === categoryFilter)
        : expenses

    const totalAmount = filtered.reduce((sum, e) => sum + toNum(e.amount), 0)
    const pendingAmount = filtered
        .filter(e => e.status === 'pending' || e.status === 'reviewed')
        .reduce((sum, e) => sum + toNum(e.amount), 0)
    const approvedAmount = filtered
        .filter(e => e.status === 'approved' || e.status === 'reimbursed')
        .reduce((sum, e) => sum + toNum(e.amount), 0)

    const rejectedCount = expenses.filter(e => e.status === 'rejected').length
    const uniqueCategories = [...new Set(expenses.map(e => e.category?.name ?? 'Outros'))].sort()

    return (
        <div className="flex flex-col h-full relative">
            <div className="bg-card px-4 pt-3 pb-4 border-b border-border">
                <button onClick={() => navigate('/tech')} className="flex items-center gap-1 text-sm text-brand-600 mb-2">
                    <ArrowLeft className="w-4 h-4" /> Voltar
                </button>
                <h1 className="text-lg font-bold text-foreground">Minhas Despesas</h1>
            </div>

            {/* Pull-to-refresh indicator */}
            {(pullDistance > 0 || isRefreshing) && (
                <div className="flex items-center justify-center py-2">
                    <Loader2 className={cn('w-5 h-5 text-brand-500', isRefreshing && 'animate-spin')} />
                    <span className="ml-2 text-xs text-surface-500">
                        {isRefreshing ? 'Atualizando...' : 'Solte para atualizar'}
                    </span>
                </div>
            )}

            <div ref={containerRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
                {/* Rejected alert */}
                {rejectedCount > 0 && (
                    <div className="flex items-center gap-2 px-3 py-2 bg-red-50 dark:bg-red-900/20 rounded-xl border border-red-200 dark:border-red-800">
                        <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0" />
                        <p className="text-xs text-red-700 dark:text-red-400 font-medium">
                            {rejectedCount} despesa(s) rejeitada(s) — corrija e reenvie
                        </p>
                    </div>
                )}

                {/* Summary cards */}
                <div className="grid grid-cols-3 gap-2">
                    <div className="bg-card rounded-xl p-3 text-center">
                        <p className="text-[10px] text-surface-500 font-medium uppercase">Total</p>
                        <p className="text-sm font-bold text-foreground mt-0.5">{formatCurrency(totalAmount)}</p>
                    </div>
                    <div className="bg-card rounded-xl p-3 text-center">
                        <p className="text-[10px] text-amber-600 font-medium uppercase">Pendente</p>
                        <p className="text-sm font-bold text-amber-700 mt-0.5">{formatCurrency(pendingAmount)}</p>
                    </div>
                    <div className="bg-card rounded-xl p-3 text-center">
                        <p className="text-[10px] text-emerald-600 font-medium uppercase">Aprovado</p>
                        <p className="text-sm font-bold text-emerald-700 mt-0.5">{formatCurrency(approvedAmount)}</p>
                    </div>
                </div>

                {/* Period filter */}
                <div className="flex gap-2">
                    {([['week', 'Semana'], ['month', 'Mês'], ['all', 'Tudo']] as const).map(([key, label]) => (
                        <button
                            key={key}
                            onClick={() => setPeriod(key)}
                            className={cn(
                                'flex-1 py-2 rounded-lg text-xs font-medium transition-colors',
                                period === key
                                    ? 'bg-brand-600 text-white'
                                    : 'bg-surface-100 text-surface-600'
                            )}
                        >
                            {label}
                        </button>
                    ))}
                </div>

                {/* Category filter */}
                {uniqueCategories.length > 0 && (
                    <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
                        <button
                            onClick={() => setCategoryFilter('')}
                            className={cn(
                                'px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap',
                                !categoryFilter ? 'bg-brand-600 text-white' : 'bg-surface-100 text-surface-600'
                            )}
                        >
                            Todas
                        </button>
                        {uniqueCategories.map(cat => (
                            <button
                                key={cat}
                                onClick={() => setCategoryFilter(cat)}
                                className={cn(
                                    'px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap',
                                    categoryFilter === cat ? 'bg-brand-600 text-white' : 'bg-surface-100 text-surface-600'
                                )}
                            >
                                {cat}
                            </button>
                        ))}
                    </div>
                )}

                {/* Expenses list */}
                {loading ? (
                    <div className="flex flex-col items-center justify-center py-20 gap-3">
                        <Loader2 className="w-8 h-8 animate-spin text-brand-500" />
                        <p className="text-sm text-surface-500">Carregando despesas...</p>
                    </div>
                ) : filtered.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 gap-3">
                        <Receipt className="w-12 h-12 text-surface-300" />
                        <p className="text-sm text-surface-500">Nenhuma despesa encontrada</p>
                    </div>
                ) : (
                    <div className="space-y-2">
                        {filtered.map((exp) => {
                            const catName = exp.category?.name ?? 'Outros'
                            const catColor = exp.category?.color ?? '#9ca3af'
                            const statusInfo = EXPENSE_STATUS_MAP[exp.status as ExpenseStatus] || EXPENSE_STATUS_MAP.pending
                            const woLabel = exp.work_order?.os_number ?? exp.work_order?.number

                            return (
                                <div key={exp.id} className="bg-card rounded-xl p-3">
                                    <div className="flex items-center gap-3">
                                        {/* Thumbnail or icon */}
                                        {exp.receipt_path ? (
                                            <img
                                                src={exp.receipt_path}
                                                alt="Comprovante"
                                                className="w-9 h-9 rounded-lg object-cover flex-shrink-0"
                                            />
                                        ) : (
                                            <div
                                                className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                                                // eslint-disable-next-line react/forbid-dom-props -- dynamic category color from DB
                                                style={{ backgroundColor: `${catColor}20`, color: catColor }}
                                            >
                                                <Receipt className="w-4 h-4" />
                                            </div>
                                        )}
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2">
                                                <p className="text-sm font-medium text-foreground">{exp.description}</p>
                                                <span className={cn('px-1.5 py-0.5 rounded-full text-[10px] font-medium', statusInfo.cls)}>
                                                    {statusInfo.label}
                                                </span>
                                            </div>
                                            {catName && (
                                                <p className="text-xs text-surface-500 truncate">{catName}</p>
                                            )}
                                            <div className="flex items-center gap-2 mt-0.5 text-[10px] text-surface-400">
                                                {woLabel && <span>OS: {woLabel}</span>}
                                                <span>{new Date(exp.expense_date + 'T00:00:00').toLocaleDateString('pt-BR')}</span>
                                            </div>
                                            {exp.status === 'rejected' && exp.rejection_reason && (
                                                <p className="text-[10px] text-red-500 mt-0.5 truncate">
                                                    Motivo: {exp.rejection_reason}
                                                </p>
                                            )}
                                        </div>
                                        <p className="text-sm font-bold text-foreground flex-shrink-0">
                                            {formatCurrency(toNum(exp.amount))}
                                        </p>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                )}

                {/* Bottom spacer for FAB */}
                <div className="h-16" />
            </div>

            {/* FAB — New Expense */}
            {!showCreateForm && (
                <button
                    onClick={() => setShowCreateForm(true)}
                    aria-label="Nova despesa avulsa"
                    className="absolute bottom-6 right-6 w-14 h-14 rounded-full bg-brand-600 text-white shadow-lg flex items-center justify-center active:scale-95 transition-transform z-10"
                >
                    <Plus className="w-6 h-6" />
                </button>
            )}

            {/* Bottom Sheet — Create Expense */}
            {showCreateForm && (
                <ExpenseForm
                    categories={categories}
                    onSubmit={handleCreateExpense}
                    variant="sheet"
                    onClose={() => setShowCreateForm(false)}
                    showDateField
                />
            )}
        </div>
    )
}
