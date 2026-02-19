import { useState, useCallback } from 'react'
import {
    Plus, Loader2, CheckCircle2, Trash2, Camera, Pencil, X,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { compressImage } from '@/lib/compress-image'
import type { ExpenseCategory } from '@/types/expense'

interface ExpenseFormProps {
    categories: ExpenseCategory[]
    /** Called on submit with form data. Return resolved data from API. */
    onSubmit: (data: ExpenseFormSubmitData) => Promise<void>
    /** If true the form is in edit mode */
    editingId?: number | null
    /** Pre-fill data for editing */
    initialData?: Partial<ExpenseFormValues>
    /** How to render: 'inline' shows in-page, 'sheet' shows as bottom sheet overlay */
    variant?: 'inline' | 'sheet'
    /** Close/cancel handler */
    onClose?: () => void
    /** Whether to show a date field (default: false, auto-sets today) */
    showDateField?: boolean
    /** Whether to show work_order_id hidden field */
    workOrderId?: string
}

interface ExpenseFormValues {
    categoryId: number | null
    description: string
    amount: string
    date: string
    photo: File | null
    photoPreview: string | null
}

export interface ExpenseFormSubmitData {
    expense_category_id: number
    description: string
    amount: string
    expense_date: string
    notes: string
    photo: File | null
    categoryName: string
}

export default function ExpenseForm({
    categories,
    onSubmit,
    editingId = null,
    initialData,
    variant = 'inline',
    onClose,
    showDateField = false,
    workOrderId,
}: ExpenseFormProps) {
    const [categoryId, setCategoryId] = useState<number | null>(initialData?.categoryId ?? null)
    const [description, setDescription] = useState(initialData?.description ?? '')
    const [amount, setAmount] = useState(initialData?.amount ?? '')
    const [date, setDate] = useState(initialData?.date ?? new Date().toISOString().slice(0, 10))
    const [photo, setPhoto] = useState<File | null>(initialData?.photo ?? null)
    const [photoPreview, setPhotoPreview] = useState<string | null>(initialData?.photoPreview ?? null)
    const [saving, setSaving] = useState(false)

    const selectedCategory = categories.find(c => c.id === categoryId)

    const handlePhotoCapture = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return

        const compressed = await compressImage(file)
        setPhoto(compressed)
        const reader = new FileReader()
        reader.onload = () => setPhotoPreview(reader.result as string)
        reader.readAsDataURL(compressed)
    }, [])

    const removePhoto = useCallback(() => {
        setPhoto(null)
        setPhotoPreview(null)
    }, [])

    const handleSave = useCallback(async () => {
        if (!categoryId || !amount) return
        const numericAmount = parseFloat(amount)
        if (isNaN(numericAmount) || numericAmount <= 0) return

        setSaving(true)
        try {
            await onSubmit({
                expense_category_id: categoryId,
                description: description || selectedCategory?.name || '',
                amount,
                expense_date: date,
                notes: '',
                photo,
                categoryName: selectedCategory?.name ?? '',
            })
        } finally {
            setSaving(false)
        }
    }, [categoryId, amount, description, date, photo, selectedCategory, onSubmit])

    const isValid = !!categoryId && !!amount && parseFloat(amount) > 0

    const formContent = (
        <div className="space-y-4">
            {/* Category chips */}
            <div>
                <label className="text-xs text-surface-500 font-medium mb-2 block">Categoria *</label>
                <div className="flex flex-wrap gap-2">
                    {categories.map((cat) => (
                        <button
                            key={cat.id}
                            type="button"
                            onClick={() => setCategoryId(cat.id)}
                            className={cn(
                                'px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
                                categoryId === cat.id
                                    ? 'text-white'
                                    : 'bg-surface-100 text-surface-600'
                            )}
                            // Dynamic background from DB — cannot be static CSS
                            // eslint-disable-next-line react/forbid-dom-props
                            style={categoryId === cat.id ? { backgroundColor: cat.color } : undefined}
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
                    min="0.01"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0,00"
                    className="w-full px-3 py-2.5 rounded-lg bg-surface-100 border-0 text-sm focus:ring-2 focus:ring-brand-500/30 focus:outline-none"
                />
            </div>

            {/* Date (optional) */}
            {showDateField && (
                <div>
                    <label className="text-xs text-surface-500 font-medium mb-1.5 block">Data</label>
                    <input
                        type="date"
                        value={date}
                        onChange={(e) => setDate(e.target.value)}
                        max={new Date().toISOString().slice(0, 10)}
                        aria-label="Data da despesa"
                        className="w-full px-3 py-2.5 rounded-lg bg-surface-100 border-0 text-sm focus:ring-2 focus:ring-brand-500/30 focus:outline-none"
                    />
                </div>
            )}

            {/* Description */}
            <div>
                <label className="text-xs text-surface-500 font-medium mb-1.5 block">Descrição</label>
                <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Detalhes da despesa..."
                    rows={2}
                    className="w-full px-3 py-2.5 rounded-lg bg-surface-100 border-0 text-sm placeholder:text-surface-400 focus:ring-2 focus:ring-brand-500/30 focus:outline-none resize-none"
                />
            </div>

            {/* Photo capture */}
            <div>
                <label className="text-xs text-surface-500 font-medium mb-1.5 block">Comprovante (foto)</label>
                {photoPreview ? (
                    <div className="relative">
                        <img src={photoPreview} alt="Preview" className="w-full h-32 object-cover rounded-lg" />
                        <button
                            type="button"
                            onClick={removePhoto}
                            aria-label="Remover foto"
                            className="absolute top-2 right-2 w-7 h-7 rounded-full bg-red-600 text-white flex items-center justify-center"
                        >
                            <Trash2 className="w-3.5 h-3.5" />
                        </button>
                    </div>
                ) : (
                    <label className="flex items-center justify-center gap-2 py-6 rounded-lg border-2 border-dashed border-surface-300 cursor-pointer active:bg-surface-50 dark:active:bg-surface-800 transition-colors">
                        <Camera className="w-5 h-5 text-surface-400" />
                        <span className="text-sm text-surface-500">Tirar foto ou selecionar</span>
                        <input
                            type="file"
                            accept="image/*"
                            capture="environment"
                            onChange={handlePhotoCapture}
                            className="hidden"
                            aria-label="Selecionar comprovante"
                        />
                    </label>
                )}
            </div>

            {/* Save */}
            <button
                type="button"
                onClick={handleSave}
                disabled={saving || !isValid}
                className={cn(
                    'w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold text-white transition-colors',
                    isValid
                        ? 'bg-brand-600 active:bg-brand-700'
                        : 'bg-surface-300',
                    saving && 'opacity-70',
                )}
            >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                {editingId ? 'Atualizar' : 'Salvar Despesa'}
            </button>
        </div>
    )

    if (variant === 'sheet') {
        return (
            <div className="absolute inset-0 z-20 flex flex-col">
                <div className="flex-1 bg-black/40" onClick={onClose} />
                <div className="bg-card rounded-t-2xl px-4 pt-4 pb-6 shadow-2xl animate-in slide-in-from-bottom duration-200 max-h-[85vh] overflow-y-auto">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-base font-bold text-foreground">
                            {editingId ? 'Editar Despesa' : 'Nova Despesa Avulsa'}
                        </h2>
                        <button type="button" onClick={onClose} aria-label="Fechar formulário" className="p-1 rounded-full hover:bg-surface-100 dark:hover:bg-surface-800">
                            <X className="w-5 h-5 text-surface-400" />
                        </button>
                    </div>
                    {formContent}
                </div>
            </div>
        )
    }

    return (
        <div className="bg-card rounded-xl p-4 space-y-4 animate-in slide-in-from-top duration-200">
            <h3 className="text-sm font-semibold text-foreground">{editingId ? 'Editar Despesa' : 'Nova Despesa'}</h3>
            {formContent}
        </div>
    )
}
