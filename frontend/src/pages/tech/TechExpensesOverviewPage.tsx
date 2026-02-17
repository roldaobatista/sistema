import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Receipt, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import api from '@/lib/api'
import { toast } from 'sonner'

interface Expense {
    id: number
    description: string
    category?: { id: number; name: string; color: string } | null
    amount: number | string
    work_order_id: number | null
    work_order?: { id: number; number: string; os_number?: string | null } | null
    status: string
    expense_date: string
    created_at: string
    notes?: string | null
    receipt_path?: string | null
}

const CATEGORY_ICONS: Record<string, string> = {
    'Transporte': 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400',
    'Alimentação': 'bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400',
    'Hospedagem': 'bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400',
    'Peças/Material': 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400',
    'Pedágio': 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400',
    'Combustível': 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400',
    'Outros': 'bg-surface-100 dark:bg-surface-800 text-surface-600 dark:text-surface-400',
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
    pending: { label: 'Pendente', color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' },
    reviewed: { label: 'Conferida', color: 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400' },
    approved: { label: 'Aprovada', color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' },
    rejected: { label: 'Rejeitada', color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
    reimbursed: { label: 'Reembolsada', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
}

export default function TechExpensesOverviewPage() {
    const navigate = useNavigate()
    const [expenses, setExpenses] = useState<Expense[]>([])
    const [loading, setLoading] = useState(true)
    const [period, setPeriod] = useState<'week' | 'month' | 'all'>('month')
    const [categoryFilter, setCategoryFilter] = useState('')

    useEffect(() => {
        fetchExpenses()
    }, [period])

    async function fetchExpenses() {
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
    }

    const formatCurrency = (val: number) =>
        new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val)

    const filtered = categoryFilter
        ? expenses.filter(e => (e.category?.name ?? 'Outros') === categoryFilter)
        : expenses

    const toNum = (v: number | string) => Number(v) || 0
    const totalAmount = filtered.reduce((sum, e) => sum + toNum(e.amount), 0)
    const pendingAmount = filtered.filter(e => e.status === 'pending' || e.status === 'reviewed').reduce((sum, e) => sum + toNum(e.amount), 0)
    const approvedAmount = filtered.filter(e => e.status === 'approved' || e.status === 'reimbursed').reduce((sum, e) => sum + toNum(e.amount), 0)

    const categories = [...new Set(expenses.map(e => e.category?.name ?? 'Outros'))].sort()

    return (
        <div className="flex flex-col h-full">
            <div className="bg-white dark:bg-surface-900 px-4 pt-3 pb-4 border-b border-surface-200 dark:border-surface-700">
                <button onClick={() => navigate('/tech')} className="flex items-center gap-1 text-sm text-brand-600 dark:text-brand-400 mb-2">
                    <ArrowLeft className="w-4 h-4" /> Voltar
                </button>
                <h1 className="text-lg font-bold text-surface-900 dark:text-surface-50">Minhas Despesas</h1>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
                {/* Summary cards */}
                <div className="grid grid-cols-3 gap-2">
                    <div className="bg-white dark:bg-surface-800/80 rounded-xl p-3 text-center">
                        <p className="text-[10px] text-surface-500 font-medium uppercase">Total</p>
                        <p className="text-sm font-bold text-surface-900 dark:text-surface-50 mt-0.5">{formatCurrency(totalAmount)}</p>
                    </div>
                    <div className="bg-white dark:bg-surface-800/80 rounded-xl p-3 text-center">
                        <p className="text-[10px] text-amber-600 font-medium uppercase">Pendente</p>
                        <p className="text-sm font-bold text-amber-700 dark:text-amber-400 mt-0.5">{formatCurrency(pendingAmount)}</p>
                    </div>
                    <div className="bg-white dark:bg-surface-800/80 rounded-xl p-3 text-center">
                        <p className="text-[10px] text-emerald-600 font-medium uppercase">Aprovado</p>
                        <p className="text-sm font-bold text-emerald-700 dark:text-emerald-400 mt-0.5">{formatCurrency(approvedAmount)}</p>
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
                                    : 'bg-surface-100 dark:bg-surface-800 text-surface-600 dark:text-surface-400'
                            )}
                        >
                            {label}
                        </button>
                    ))}
                </div>

                {/* Category filter */}
                {categories.length > 0 && (
                    <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
                        <button
                            onClick={() => setCategoryFilter('')}
                            className={cn(
                                'px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap',
                                !categoryFilter ? 'bg-brand-600 text-white' : 'bg-surface-100 dark:bg-surface-800 text-surface-600 dark:text-surface-400'
                            )}
                        >
                            Todas
                        </button>
                        {categories.map(cat => (
                            <button
                                key={cat}
                                onClick={() => setCategoryFilter(cat)}
                                className={cn(
                                    'px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap',
                                    categoryFilter === cat ? 'bg-brand-600 text-white' : 'bg-surface-100 dark:bg-surface-800 text-surface-600 dark:text-surface-400'
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
                            const catColor = CATEGORY_ICONS[catName] || CATEGORY_ICONS['Outros']
                            const statusInfo = STATUS_LABELS[exp.status] || STATUS_LABELS.pending
                            const woLabel = exp.work_order?.os_number ?? exp.work_order?.number
                            return (
                                <div key={exp.id} className="bg-white dark:bg-surface-800/80 rounded-xl p-3">
                                    <div className="flex items-center gap-3">
                                        <div className={cn('w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0', catColor)}>
                                            <Receipt className="w-4 h-4" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2">
                                                <p className="text-sm font-medium text-surface-900 dark:text-surface-50">{exp.description}</p>
                                                <span className={cn('px-1.5 py-0.5 rounded-full text-[10px] font-medium', statusInfo.color)}>
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
                                        </div>
                                        <p className="text-sm font-bold text-surface-900 dark:text-surface-50 flex-shrink-0">
                                            {formatCurrency(toNum(exp.amount))}
                                        </p>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                )}
            </div>
        </div>
    )
}
