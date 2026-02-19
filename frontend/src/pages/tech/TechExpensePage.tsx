import { useState, useCallback, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Plus, Receipt, Loader2, Pencil, Trash2 } from 'lucide-react'
import { cn, formatCurrency } from '@/lib/utils'
import { toast } from 'sonner'
import api from '@/lib/api'
import { useExpenseCategories } from '@/hooks/useExpenseCategories'
import ExpenseForm from '@/components/expenses/ExpenseForm'
import type { ExpenseFormSubmitData } from '@/components/expenses/ExpenseForm'
import type { ExpenseItem, ExpenseStatus } from '@/types/expense'
import { EXPENSE_STATUS_MAP } from '@/types/expense'

export default function TechExpensePage() {
    const { id: woId } = useParams<{ id: string }>()
    const navigate = useNavigate()
    const { categories } = useExpenseCategories()
    const [woExpenses, setWoExpenses] = useState<ExpenseItem[]>([])
    const [loading, setLoading] = useState(true)
    const [showForm, setShowForm] = useState(false)
    const [editingId, setEditingId] = useState<number | null>(null)
    const [editInitial, setEditInitial] = useState<{
        categoryId: number | null
        description: string
        amount: string
        date: string
        photoPreview: string | null
    } | undefined>()

    useEffect(() => {
        if (!woId) return
        setLoading(true)
        api.get('/expenses', { params: { work_order_id: woId, my: 1, per_page: 100 } })
            .then(res => setWoExpenses(res.data?.data ?? []))
            .catch(() => toast.error('Erro ao carregar despesas'))
            .finally(() => setLoading(false))
    }, [woId])

    const resetForm = () => {
        setEditingId(null)
        setEditInitial(undefined)
        setShowForm(false)
    }

    const handleEdit = (exp: ExpenseItem) => {
        if (exp.status !== 'pending') {
            toast.error('Somente despesas pendentes podem ser editadas')
            return
        }
        setEditingId(exp.id)
        setEditInitial({
            categoryId: exp.expense_category_id ?? exp.category?.id ?? null,
            description: exp.description ?? '',
            amount: String(exp.amount ?? ''),
            date: exp.expense_date?.slice(0, 10) ?? new Date().toISOString().slice(0, 10),
            photoPreview: exp.receipt_path ?? null,
        })
        setShowForm(true)
    }

    const handleSubmit = useCallback(async (data: ExpenseFormSubmitData) => {
        if (!woId) return

        try {
            const formData = new FormData()
            formData.append('work_order_id', woId)
            formData.append('expense_category_id', String(data.expense_category_id))
            formData.append('description', data.description || data.categoryName)
            formData.append('amount', data.amount)
            formData.append('expense_date', data.expense_date)
            formData.append('affects_technician_cash', '1')
            formData.append('affects_net_value', '1')
            if (data.notes) formData.append('notes', data.notes)
            if (data.photo) formData.append('receipt', data.photo)

            if (editingId) {
                formData.append('_method', 'PUT')
                const { data: updated } = await api.post(`/expenses/${editingId}`, formData, {
                    headers: { 'Content-Type': 'multipart/form-data' },
                })
                setWoExpenses(prev => prev.map(e => e.id === editingId ? updated : e))
                toast.success('Despesa atualizada com sucesso')

                if (updated._budget_warning) {
                    toast.warning(updated._budget_warning)
                }
            } else {
                const { data: created } = await api.post('/expenses', formData, {
                    headers: { 'Content-Type': 'multipart/form-data' },
                })
                setWoExpenses(prev => [created, ...prev])
                toast.success('Despesa registrada com sucesso')

                if (created._budget_warning) {
                    toast.warning(created._budget_warning)
                }
            }

            resetForm()
        } catch (err: unknown) {
            const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
            toast.error(msg || 'Erro ao salvar despesa')
        }
    }, [woId, editingId])

    const handleRemove = useCallback(async (expenseId: number) => {
        if (!confirm('Deseja remover esta despesa?')) return
        try {
            await api.delete(`/expenses/${expenseId}`)
            setWoExpenses(prev => prev.filter(e => e.id !== expenseId))
            toast.success('Despesa removida')
        } catch {
            toast.error('Não foi possível remover a despesa')
        }
    }, [])

    const total = woExpenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0)

    return (
        <div className="flex flex-col h-full">
            {/* Header */}
            <div className="bg-card px-4 pt-3 pb-4 border-b border-border">
                <button onClick={() => navigate(`/tech/os/${woId}`)} className="flex items-center gap-1 text-sm text-brand-600 mb-2">
                    <ArrowLeft className="w-4 h-4" /> Voltar
                </button>
                <div className="flex items-center justify-between">
                    <h1 className="text-lg font-bold text-foreground">Despesas</h1>
                    <button
                        onClick={() => { resetForm(); setShowForm(true) }}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand-600 text-white text-xs font-medium"
                    >
                        <Plus className="w-3.5 h-3.5" /> Nova
                    </button>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
                {/* Form */}
                {showForm && (
                    <ExpenseForm
                        categories={categories}
                        onSubmit={handleSubmit}
                        editingId={editingId}
                        initialData={editInitial}
                        variant="inline"
                        onClose={resetForm}
                    />
                )}

                {/* Saved expenses list */}
                {woExpenses.length > 0 && (
                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <h3 className="text-xs font-semibold text-surface-400 uppercase tracking-wide">
                                Registradas ({woExpenses.length})
                            </h3>
                            <span className="text-sm font-bold text-foreground">
                                {formatCurrency(total)}
                            </span>
                        </div>

                        {woExpenses.map((exp) => {
                            const catColor = exp.category?.color ?? '#f59e0b'
                            const st = EXPENSE_STATUS_MAP[exp.status as ExpenseStatus] ?? EXPENSE_STATUS_MAP.pending

                            return (
                                <div
                                    key={exp.id}
                                    className={cn('flex items-center gap-3 bg-card rounded-xl p-3', exp.status === 'pending' && 'cursor-pointer active:bg-surface-50 dark:active:bg-surface-800')}
                                    onClick={() => exp.status === 'pending' && handleEdit(exp)}
                                >
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
                                        <p className="text-sm font-medium text-foreground">{exp.description}</p>
                                        {exp.category?.name && (
                                            <p className="text-xs text-surface-500 truncate">{exp.category.name}</p>
                                        )}
                                        {exp.status && (
                                            <span className={cn('inline-block mt-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-medium', st.cls)}>
                                                {st.label}
                                            </span>
                                        )}
                                    </div>
                                    <div className="text-right flex-shrink-0">
                                        <p className="text-sm font-bold text-foreground">
                                            {formatCurrency(Number(exp.amount))}
                                        </p>
                                    </div>
                                    {exp.status === 'pending' && (
                                        <div className="flex flex-col gap-1">
                                            <button
                                                onClick={(e) => { e.stopPropagation(); handleEdit(exp) }}
                                                aria-label="Editar despesa"
                                                className="w-7 h-7 rounded-full flex items-center justify-center text-brand-500 hover:bg-brand-50 dark:hover:bg-brand-900/20"
                                            >
                                                <Pencil className="w-3.5 h-3.5" />
                                            </button>
                                            <button
                                                onClick={(e) => { e.stopPropagation(); handleRemove(exp.id) }}
                                                aria-label="Remover despesa"
                                                className="w-7 h-7 rounded-full flex items-center justify-center text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
                                            >
                                                <Trash2 className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                    )}
                                </div>
                            )
                        })}
                    </div>
                )}

                {loading && (
                    <div className="flex flex-col items-center justify-center py-20 gap-3">
                        <Loader2 className="w-8 h-8 animate-spin text-brand-500" />
                        <p className="text-sm text-surface-500">Carregando despesas...</p>
                    </div>
                )}

                {!loading && !showForm && woExpenses.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-20 gap-3">
                        <Receipt className="w-12 h-12 text-surface-300" />
                        <p className="text-sm text-surface-500">Nenhuma despesa registrada</p>
                        <button
                            onClick={() => setShowForm(true)}
                            className="text-sm text-brand-600 font-medium"
                        >
                            Adicionar despesa
                        </button>
                    </div>
                )}
            </div>
        </div>
    )
}
