import { useState, useCallback , useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
    ArrowLeft, Plus, Receipt, Loader2, CheckCircle2,
    Trash2, Camera,
} from 'lucide-react'
import { useOfflineStore } from '@/hooks/useOfflineStore'
import { offlinePost } from '@/lib/syncEngine'
import { generateUlid } from '@/lib/offlineDb'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

const CATEGORIES = [
    'Transporte',
    'Alimentação',
    'Hospedagem',
    'Peças/Material',
    'Pedágio',
    'Combustível',
    'Outros',
]

export default function TechExpensePage() {

    const { id: woId } = useParams<{ id: string }>()
    const navigate = useNavigate()
    const { items: savedExpenses, put: putExpense, remove } = useOfflineStore('expenses')
    const { put: putPhoto } = useOfflineStore('photos')
    const [category, setCategory] = useState('')
    const [description, setDescription] = useState('')
    const [amount, setAmount] = useState('')
    const [photo, setPhoto] = useState<Blob | null>(null)
    const [photoPreview, setPhotoPreview] = useState<string | null>(null)
    const [saving, setSaving] = useState(false)
    const [showForm, setShowForm] = useState(false)

    const woExpenses = savedExpenses.filter((e: any) => e.work_order_id === Number(woId))

    const handlePhotoCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return
        setPhoto(file)
        const reader = new FileReader()
        reader.onload = () => setPhotoPreview(reader.result as string)
        reader.readAsDataURL(file)
    }

    const handleSave = useCallback(async () => {
        if (!category || !amount || !woId) return
        setSaving(true)

        try {
            const expenseId = generateUlid()
            const expenseData = {
                id: expenseId,
                work_order_id: Number(woId),
                category,
                description,
                amount: parseFloat(amount),
                affects_technician_cash: true,
                affects_net_value: true,
                synced: false,
                created_at: new Date().toISOString(),
            }

            await putExpense(expenseData as any)

            // Save photo if present
            if (photo) {
                const photoId = generateUlid()
                await putPhoto({
                    id: photoId,
                    work_order_id: Number(woId),
                    entity_type: 'expense',
                    entity_id: expenseId,
                    blob: photo,
                    synced: false,
                    created_at: new Date().toISOString(),
                } as any)
            }

            // Queue for sync
            await offlinePost('/tech/sync/batch', {
                mutations: [{
                    type: 'expense',
                    data: expenseData,
                }],
            })

            // Reset form
            setCategory('')
            setDescription('')
            setAmount('')
            setPhoto(null)
            setPhotoPreview(null)
            setShowForm(false)
            toast.success('Despesa salva para sincronização')
        } catch {
            toast.error('Não foi possível salvar a despesa agora. Tente novamente.')
        } finally {
            setSaving(false)
        }
    }, [category, description, amount, photo, woId, putExpense, putPhoto])

    const formatCurrency = (val: number) =>
        new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val)

    const total = woExpenses.reduce((sum: number, e: any) => sum + (e.amount || 0), 0)

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
                        onClick={() => setShowForm(!showForm)}
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
                        <h3 className="text-sm font-semibold text-surface-900 dark:text-surface-50">Nova Despesa</h3>

                        {/* Category chips */}
                        <div>
                            <label className="text-xs text-surface-500 font-medium mb-2 block">Categoria *</label>
                            <div className="flex flex-wrap gap-2">
                                {CATEGORIES.map((cat) => (
                                    <button
                                        key={cat}
                                        onClick={() => setCategory(cat)}
                                        className={cn(
                                            'px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
                                            category === cat
                                                ? 'bg-brand-600 text-white'
                                                : 'bg-surface-100 dark:bg-surface-700 text-surface-600 dark:text-surface-400'
                                        )}
                                    >
                                        {cat}
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
                            disabled={saving || !category || !amount}
                            className={cn(
                                'w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold text-white transition-colors',
                                category && amount
                                    ? 'bg-brand-600 active:bg-brand-700'
                                    : 'bg-surface-300 dark:bg-surface-700',
                                saving && 'opacity-70',
                            )}
                        >
                            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                            Salvar Despesa
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

                        {woExpenses.map((exp: any) => (
                            <div key={exp.id} className="flex items-center gap-3 bg-white dark:bg-surface-800/80 rounded-xl p-3">
                                <div className="w-9 h-9 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center flex-shrink-0">
                                    <Receipt className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-surface-900 dark:text-surface-50">{exp.category}</p>
                                    {exp.description && (
                                        <p className="text-xs text-surface-500 truncate">{exp.description}</p>
                                    )}
                                </div>
                                <div className="text-right flex-shrink-0">
                                    <p className="text-sm font-bold text-surface-900 dark:text-surface-50">
                                        {formatCurrency(exp.amount)}
                                    </p>
                                    {!exp.synced && (
                                        <span className="text-[10px] text-amber-500 font-medium">pendente</span>
                                    )}
                                </div>
                                <button
                                    onClick={() => remove(exp.id)}
                                    aria-label="Remover despesa"
                                    className="w-7 h-7 rounded-full flex items-center justify-center text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
                                >
                                    <Trash2 className="w-3.5 h-3.5" />
                                </button>
                            </div>
                        ))}
                    </div>
                )}

                {!showForm && woExpenses.length === 0 && (
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
