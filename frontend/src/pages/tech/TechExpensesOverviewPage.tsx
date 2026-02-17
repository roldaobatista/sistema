import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Receipt, Loader2, Plus, CheckCircle2, X, Camera } from 'lucide-react'
import { cn } from '@/lib/utils'
import api from '@/lib/api'
import { toast } from 'sonner'

interface ExpenseCategory {
    id: number
    name: string
    color: string
}

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

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
    pending: { label: 'Pendente', color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30' },
    reviewed: { label: 'Conferida', color: 'bg-sky-100 text-sky-700 dark:bg-sky-900/30' },
    approved: { label: 'Aprovada', color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30' },
    rejected: { label: 'Rejeitada', color: 'bg-red-100 text-red-700 dark:bg-red-900/30' },
    reimbursed: { label: 'Reembolsada', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
}

export default function TechExpensesOverviewPage() {
    const navigate = useNavigate()
    const [expenses, setExpenses] = useState<Expense[]>([])
    const [loading, setLoading] = useState(true)
    const [period, setPeriod] = useState<'week' | 'month' | 'all'>('month')
    const [categoryFilter, setCategoryFilter] = useState('')

    // Create form state
    const [showCreateForm, setShowCreateForm] = useState(false)
    const [apiCategories, setApiCategories] = useState<ExpenseCategory[]>([])
    const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null)
    const [description, setDescription] = useState('')
    const [amount, setAmount] = useState('')
    const [photo, setPhoto] = useState<File | null>(null)
    const [photoPreview, setPhotoPreview] = useState<string | null>(null)
    const [saving, setSaving] = useState(false)

    useEffect(() => {
        api.get('/expense-categories')
            .then(res => setApiCategories(res.data ?? []))
            .catch(() => toast.error('Erro ao carregar categorias'))
    }, [])

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

    const handlePhoto = (file: File) => {
        setPhoto(file)
        const reader = new FileReader()
        reader.onloadend = () => setPhotoPreview(reader.result as string)
        reader.readAsDataURL(file)
    }

    const selectedCategory = apiCategories.find(c => c.id === selectedCategoryId)

    const handleCreateExpense = useCallback(async () => {
        if (!selectedCategoryId || !amount) return
        setSaving(true)
        try {
            const catName = selectedCategory?.name ?? ''
            const formData = new FormData()
            formData.append('expense_category_id', String(selectedCategoryId))
            formData.append('description', description || catName)
            formData.append('amount', amount)
            formData.append('expense_date', new Date().toISOString().slice(0, 10))
            formData.append('affects_technician_cash', '1')
            formData.append('affects_net_value', '1')
            if (description) formData.append('notes', description)
            if (photo) formData.append('receipt', photo)

            await api.post('/expenses', formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
            })

            setSelectedCategoryId(null)
            setDescription('')
            setAmount('')
            setPhoto(null)
            setPhotoPreview(null)
            setShowCreateForm(false)
            toast.success('Despesa registrada com sucesso')
            fetchExpenses()
        } catch {
            toast.error('Não foi possível salvar a despesa. Tente novamente.')
        } finally {
            setSaving(false)
        }
    }, [selectedCategoryId, selectedCategory, description, amount, photo])

    const formatCurrency = (val: number) =>
        new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val)

    const filtered = categoryFilter
        ? expenses.filter(e => (e.category?.name ?? 'Outros') === categoryFilter)
        : expenses

    const toNum = (v: number | string) => Number(v) || 0
    const totalAmount = filtered.reduce((sum, e) => sum + toNum(e.amount), 0)
    const pendingAmount = filtered.filter(e => e.status === 'pending' || e.status === 'reviewed').reduce((sum, e) => sum + toNum(e.amount), 0)
    const approvedAmount = filtered.filter(e => e.status === 'approved' || e.status === 'reimbursed').reduce((sum, e) => sum + toNum(e.amount), 0)

    const uniqueCategories = [...new Set(expenses.map(e => e.category?.name ?? 'Outros'))].sort()

    return (
        <div className="flex flex-col h-full relative">
            <div className="bg-card px-4 pt-3 pb-4 border-b border-border">
                <button onClick={() => navigate('/tech')} className="flex items-center gap-1 text-sm text-brand-600 mb-2">
                    <ArrowLeft className="w-4 h-4" /> Voltar
                </button>
                <h1 className="text-lg font-bold text-foreground">Minhas Despesas</h1>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
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
                            const statusInfo = STATUS_LABELS[exp.status] || STATUS_LABELS.pending
                            const woLabel = exp.work_order?.os_number ?? exp.work_order?.number
                            return (
                                <div key={exp.id} className="bg-card rounded-xl p-3">
                                    <div className="flex items-center gap-3">
                                        <div
                                            className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                                            style={{ backgroundColor: `${catColor}20`, color: catColor }}
                                        >
                                            <Receipt className="w-4 h-4" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2">
                                                <p className="text-sm font-medium text-foreground">{exp.description}</p>
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
                <div className="absolute inset-0 z-20 flex flex-col">
                    <div className="flex-1 bg-black/40" onClick={() => setShowCreateForm(false)} />
                    <div className="bg-card rounded-t-2xl px-4 pt-4 pb-6 shadow-2xl animate-in slide-in-from-bottom duration-200 max-h-[85vh] overflow-y-auto">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-base font-bold text-foreground">Nova Despesa Avulsa</h2>
                            <button onClick={() => setShowCreateForm(false)} aria-label="Fechar formulário" className="p-1 rounded-full hover:bg-surface-100 dark:hover:bg-surface-800">
                                <X className="w-5 h-5 text-surface-400" />
                            </button>
                        </div>

                        <div className="space-y-4">
                            {/* Category chips */}
                            <div>
                                <label className="text-xs text-surface-500 font-medium mb-2 block">Categoria *</label>
                                <div className="flex flex-wrap gap-2">
                                    {apiCategories.map((cat) => (
                                        <button
                                            key={cat.id}
                                            onClick={() => setSelectedCategoryId(cat.id)}
                                            className={cn(
                                                'px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
                                                selectedCategoryId === cat.id
                                                    ? 'text-white'
                                                    : 'bg-surface-100 text-surface-600'
                                            )}
                                            style={selectedCategoryId === cat.id ? { backgroundColor: cat.color } : undefined}
                                        >
                                            {cat.name}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Amount */}
                            <div>
                                <label className="text-xs text-surface-500 font-medium mb-1 block">Valor (R$) *</label>
                                <input
                                    type="number"
                                    step="0.01"
                                    value={amount}
                                    onChange={e => setAmount(e.target.value)}
                                    placeholder="0,00"
                                    className="w-full rounded-lg border border-border bg-surface-50 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30"
                                />
                            </div>

                            {/* Description */}
                            <div>
                                <label className="text-xs text-surface-500 font-medium mb-1 block">Descrição</label>
                                <input
                                    type="text"
                                    value={description}
                                    onChange={e => setDescription(e.target.value)}
                                    placeholder="Descrição da despesa"
                                    className="w-full rounded-lg border border-border bg-surface-50 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30"
                                />
                            </div>

                            {/* Photo */}
                            <div>
                                <label className="text-xs text-surface-500 font-medium mb-1 block">Comprovante</label>
                                {photoPreview ? (
                                    <div className="relative w-full h-32 rounded-lg overflow-hidden">
                                        <img src={photoPreview} alt="preview" className="w-full h-full object-cover" />
                                        <button onClick={() => { setPhoto(null); setPhotoPreview(null) }}
                                            className="absolute top-1 right-1 w-6 h-6 bg-black/50 rounded-full flex items-center justify-center">
                                            <X className="w-3 h-3 text-white" />
                                        </button>
                                    </div>
                                ) : (
                                    <label className="flex items-center justify-center gap-2 w-full py-6 border-2 border-dashed border-surface-300 rounded-lg cursor-pointer hover:bg-surface-50 dark:hover:bg-surface-800 transition-colors">
                                        <Camera className="w-5 h-5 text-surface-400" />
                                        <span className="text-xs text-surface-500">Tirar foto ou selecionar</span>
                                        <input type="file" accept="image/*" className="hidden" aria-label="Selecionar comprovante"
                                            onChange={e => { if (e.target.files?.[0]) handlePhoto(e.target.files[0]) }}
                                        />
                                    </label>
                                )}
                            </div>

                            {/* Save button */}
                            <button
                                onClick={handleCreateExpense}
                                disabled={saving || !selectedCategoryId || !amount}
                                className={cn(
                                    'w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold text-white transition-colors',
                                    selectedCategoryId && amount
                                        ? 'bg-brand-600 active:bg-brand-700'
                                        : 'bg-surface-300',
                                    saving && 'opacity-70',
                                )}
                            >
                                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                                Salvar Despesa
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
