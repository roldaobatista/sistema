import { useState, useCallback, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
    ArrowLeft, Plus, Receipt, Loader2, CheckCircle2,
    Trash2, Camera, Pencil,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import api from '@/lib/api'

interface ExpenseCategory {
    id: number
    name: string
    color: string
}

export default function TechExpensePage() {

    const { id: woId } = useParams<{ id: string }>()
    const navigate = useNavigate()
    const [woExpenses, setWoExpenses] = useState<any[]>([])
    const [categories, setCategories] = useState<ExpenseCategory[]>([])
    const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null)
    const [description, setDescription] = useState('')
    const [amount, setAmount] = useState('')
    const [photo, setPhoto] = useState<File | null>(null)
    const [photoPreview, setPhotoPreview] = useState<string | null>(null)
    const [saving, setSaving] = useState(false)
    const [showForm, setShowForm] = useState(false)
    const [loading, setLoading] = useState(true)
    const [editingId, setEditingId] = useState<number | null>(null)

    useEffect(() => {
        api.get('/expense-categories')
            .then(res => setCategories(res.data ?? []))
            .catch(() => toast.error('Erro ao carregar categorias'))
    }, [])

    useEffect(() => {
        if (!woId) return
        setLoading(true)
        api.get('/expenses', { params: { work_order_id: woId, my: 1, per_page: 100 } })
            .then(res => setWoExpenses(res.data?.data ?? []))
            .catch(() => toast.error('Erro ao carregar despesas'))
            .finally(() => setLoading(false))
    }, [woId])

    const handlePhotoCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return
        setPhoto(file)
        const reader = new FileReader()
        reader.onload = () => setPhotoPreview(reader.result as string)
        reader.readAsDataURL(file)
    }

    const selectedCategory = categories.find(c => c.id === selectedCategoryId)

    const resetForm = () => {
        setSelectedCategoryId(null)
        setDescription('')
        setAmount('')
        setPhoto(null)
        setPhotoPreview(null)
        setEditingId(null)
        setShowForm(false)
    }

    const handleEdit = (exp: any) => {
        if (exp.status !== 'pending') {
            toast.error('Somente despesas pendentes podem ser editadas')
            return
        }
        setEditingId(exp.id)
        setSelectedCategoryId(exp.expense_category_id ?? exp.category?.id ?? null)
        setDescription(exp.notes ?? exp.description ?? '')
        setAmount(String(exp.amount ?? ''))
        setPhoto(null)
        setPhotoPreview(exp.receipt_path ?? null)
        setShowForm(true)
    }

    const handleSave = useCallback(async () => {
        if (!selectedCategoryId || !amount || !woId) return
        setSaving(true)

        try {
            const catName = selectedCategory?.name ?? ''
            const formData = new FormData()
            formData.append('work_order_id', woId)
            formData.append('expense_category_id', String(selectedCategoryId))
            formData.append('description', description || catName)
            formData.append('amount', amount)
            formData.append('expense_date', new Date().toISOString().slice(0, 10))
            formData.append('affects_technician_cash', '1')
            formData.append('affects_net_value', '1')
            if (description) formData.append('notes', description)
            if (photo) formData.append('receipt', photo)

            if (editingId) {
                formData.append('_method', 'PUT')
                const { data } = await api.post(`/expenses/${editingId}`, formData, {
                    headers: { 'Content-Type': 'multipart/form-data' },
                })
                setWoExpenses(prev => prev.map(e => e.id === editingId ? data : e))
                toast.success('Despesa atualizada com sucesso')
            } else {
                const { data } = await api.post('/expenses', formData, {
                    headers: { 'Content-Type': 'multipart/form-data' },
                })
                setWoExpenses(prev => [data, ...prev])
                toast.success('Despesa registrada com sucesso')
            }

            resetForm()
        } catch {
            toast.error('Não foi possível salvar a despesa. Tente novamente.')
        } finally {
            setSaving(false)
        }
    }, [selectedCategoryId, selectedCategory, description, amount, photo, woId, editingId])

    const handleRemove = async (expenseId: number) => {
        if (!confirm('Deseja remover esta despesa?')) return
        try {
            await api.delete(`/expenses/${expenseId}`)
            setWoExpenses(prev => prev.filter(e => e.id !== expenseId))
            toast.success('Despesa removida')
        } catch {
            toast.error('Não foi possível remover a despesa')
        }
    }

    const formatCurrency = (val: number) =>
        new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val)

    const total = woExpenses.reduce((sum: number, e: any) => sum + (Number(e.amount) || 0), 0)

    return (
        <div className="flex flex-col h-full">
            {/* Header */}
            <div className="bg-white dark:bg-surface-900 px-4 pt-3 pb-4 border-b border-surface-200 dark:border-surface-700">
                <button onClick={() => navigate(`/tech/os/${woId}`)} className="flex items-center gap-1 text-sm text-brand-600 dark:text-brand-400 mb-2">
                    <ArrowLeft className="w-4 h-4" /> Voltar
                </button>
                <div className="flex items-center justify-between">
                    <h1 className="text-lg font-bold text-surface-900 dark:text-surface-50">Despesas</h1>
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
                    <div className="bg-white dark:bg-surface-800/80 rounded-xl p-4 space-y-4">
                        <h3 className="text-sm font-semibold text-surface-900 dark:text-surface-50">{editingId ? 'Editar Despesa' : 'Nova Despesa'}</h3>

                        {/* Category chips */}
                        <div>
                            <label className="text-xs text-surface-500 font-medium mb-2 block">Categoria *</label>
                            <div className="flex flex-wrap gap-2">
                                {categories.map((cat) => (
                                    <button
                                        key={cat.id}
                                        onClick={() => setSelectedCategoryId(cat.id)}
                                        className={cn(
                                            'px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
                                            selectedCategoryId === cat.id
                                                ? 'text-white'
                                                : 'bg-surface-100 dark:bg-surface-700 text-surface-600 dark:text-surface-400'
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
                            <label className="text-xs text-surface-500 font-medium mb-1.5 block">Valor (R$) *</label>
                            <input
                                type="number"
                                inputMode="decimal"
                                step="0.01"
                                value={amount}
                                onChange={(e) => setAmount(e.target.value)}
                                placeholder="0,00"
                                className="w-full px-3 py-2.5 rounded-lg bg-surface-100 dark:bg-surface-700 border-0 text-sm focus:ring-2 focus:ring-brand-500/30 focus:outline-none"
                            />
                        </div>

                        {/* Description */}
                        <div>
                            <label className="text-xs text-surface-500 font-medium mb-1.5 block">Descrição</label>
                            <textarea
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                placeholder="Detalhes da despesa..."
                                rows={2}
                                className="w-full px-3 py-2.5 rounded-lg bg-surface-100 dark:bg-surface-700 border-0 text-sm placeholder:text-surface-400 focus:ring-2 focus:ring-brand-500/30 focus:outline-none resize-none"
                            />
                        </div>

                        {/* Photo capture */}
                        <div>
                            <label className="text-xs text-surface-500 font-medium mb-1.5 block">Comprovante (foto)</label>
                            {photoPreview ? (
                                <div className="relative">
                                    <img src={photoPreview} alt="Preview" className="w-full h-32 object-cover rounded-lg" />
                                    <button
                                        onClick={() => { setPhoto(null); setPhotoPreview(null) }}
                                        aria-label="Remover foto"
                                        className="absolute top-2 right-2 w-7 h-7 rounded-full bg-red-600 text-white flex items-center justify-center"
                                    >
                                        <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                            ) : (
                                <label className="flex items-center justify-center gap-2 py-6 rounded-lg border-2 border-dashed border-surface-300 dark:border-surface-600 cursor-pointer active:bg-surface-50 dark:active:bg-surface-800">
                                    <Camera className="w-5 h-5 text-surface-400" />
                                    <span className="text-sm text-surface-500">Tirar foto</span>
                                    <input
                                        type="file"
                                        accept="image/*"
                                        capture="environment"
                                        onChange={handlePhotoCapture}
                                        className="hidden"
                                    />
                                </label>
                            )}
                        </div>

                        {/* Save */}
                        <button
                            onClick={handleSave}
                            disabled={saving || !selectedCategoryId || !amount}
                            className={cn(
                                'w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold text-white transition-colors',
                                selectedCategoryId && amount
                                    ? 'bg-brand-600 active:bg-brand-700'
                                    : 'bg-surface-300 dark:bg-surface-700',
                                saving && 'opacity-70',
                            )}
                        >
                            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                            {editingId ? 'Atualizar' : 'Salvar Despesa'}
                        </button>
                    </div>
                )}

                {/* Saved expenses list */}
                {woExpenses.length > 0 && (
                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <h3 className="text-xs font-semibold text-surface-400 uppercase tracking-wide">
                                Registradas ({woExpenses.length})
                            </h3>
                            <span className="text-sm font-bold text-surface-900 dark:text-surface-50">
                                {formatCurrency(total)}
                            </span>
                        </div>

                        {woExpenses.map((exp: any) => {
                            const catColor = exp.category?.color ?? '#f59e0b'
                            const statusMap: Record<string, { label: string; cls: string }> = {
                                pending: { label: 'Pendente', cls: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' },
                                reviewed: { label: 'Conferida', cls: 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400' },
                                approved: { label: 'Aprovada', cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' },
                                rejected: { label: 'Rejeitada', cls: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
                                reimbursed: { label: 'Reembolsada', cls: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
                            }
                            const st = statusMap[exp.status] ?? statusMap.pending
                            return (
                                <div
                                    key={exp.id}
                                    className={cn('flex items-center gap-3 bg-white dark:bg-surface-800/80 rounded-xl p-3', exp.status === 'pending' && 'cursor-pointer active:bg-surface-50 dark:active:bg-surface-800')}
                                    onClick={() => exp.status === 'pending' && handleEdit(exp)}
                                >
                                    <div
                                        className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                                        style={{ backgroundColor: `${catColor}20`, color: catColor }}
                                    >
                                        <Receipt className="w-4 h-4" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium text-surface-900 dark:text-surface-50">{exp.description}</p>
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
                                        <p className="text-sm font-bold text-surface-900 dark:text-surface-50">
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
