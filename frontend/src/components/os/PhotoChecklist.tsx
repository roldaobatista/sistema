import { useState, useRef } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { CheckSquare, Square, Plus, Trash2, Camera, Image, GripVertical, Copy } from 'lucide-react'
import api from '@/lib/api'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

interface ChecklistItem {
    id: string
    text: string
    checked: boolean
    photo_url?: string
}

interface PhotoChecklistProps {
    workOrderId: number
    initialItems?: ChecklistItem[]
}

export default function PhotoChecklist({ workOrderId, initialItems = [] }: PhotoChecklistProps) {
    const qc = useQueryClient()
    const [items, setItems] = useState<ChecklistItem[]>(initialItems)
    const [newText, setNewText] = useState('')
    const fileInputRef = useRef<HTMLInputElement>(null)
    const [uploadingId, setUploadingId] = useState<string | null>(null)

    const saveMut = useMutation({
        mutationFn: (checklistItems: ChecklistItem[]) =>
            api.put(`/work-orders/${workOrderId}`, { checklist: checklistItems }),
        onSuccess: () => qc.invalidateQueries({ queryKey: ['work-order', workOrderId] }),
    })

    const save = (updated: ChecklistItem[]) => {
        setItems(updated)
        saveMut.mutate(updated)
    }

    const addItem = () => {
        if (!newText.trim()) return
        const item: ChecklistItem = { id: crypto.randomUUID(), text: newText.trim(), checked: false }
        save([...items, item])
        setNewText('')
    }

    const toggleItem = (id: string) => {
        save(items.map(i => i.id === id ? { ...i, checked: !i.checked } : i))
    }

    const removeItem = (id: string) => {
        save(items.filter(i => i.id !== id))
    }

    const handlePhoto = (id: string) => {
        setUploadingId(id)
        fileInputRef.current?.click()
    }

    const onFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file || !uploadingId) return

        try {
            const fd = new FormData()
            fd.append('file', file)
            fd.append('type', 'checklist')
            const res = await api.post(`/work-orders/${workOrderId}/attachments`, fd)
            const url = res.data?.data?.url ?? res.data?.url
            if (url) {
                save(items.map(i => i.id === uploadingId ? { ...i, photo_url: url } : i))
                toast.success('Foto anexada ao item')
            }
        } catch {
            toast.error('Erro ao enviar foto')
        } finally {
            setUploadingId(null)
            e.target.value = ''
        }
    }

    const cloneChecklist = () => {
        navigator.clipboard.writeText(JSON.stringify(items))
        toast.success('Checklist copiado para clipboard!')
    }

    const progress = items.length > 0 ? Math.round((items.filter(i => i.checked).length / items.length) * 100) : 0

    return (
        <div className="rounded-xl border border-default bg-surface-0 p-4 shadow-card">
            <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-surface-900 flex items-center gap-2">
                    <CheckSquare className="h-4 w-4 text-brand-500" />
                    Checklist
                    {items.length > 0 && (
                        <span className="text-[10px] font-normal text-surface-400">
                            {items.filter(i => i.checked).length}/{items.length}
                        </span>
                    )}
                </h3>
                {items.length > 0 && (
                    <button onClick={cloneChecklist} className="text-surface-400 hover:text-brand-500" aria-label="Copiar checklist">
                        <Copy className="h-3.5 w-3.5" />
                    </button>
                )}
            </div>

            {/* Progress */}
            {items.length > 0 && (
                <div className="mb-3">
                    <div className="flex justify-between text-[10px] text-surface-400 mb-1">
                        <span>Progresso</span>
                        <span>{progress}%</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-surface-100 overflow-hidden">
                        <div className="h-full rounded-full bg-brand-500 transition-all" style={{ width: `${progress}%` }} />
                    </div>
                </div>
            )}

            {/* Items */}
            <div className="space-y-1.5">
                {items.map(item => (
                    <div key={item.id} className={cn(
                        'group flex items-start gap-2 rounded-lg px-2 py-1.5 hover:bg-surface-50 transition-colors',
                        item.checked && 'opacity-60'
                    )}>
                        <button onClick={() => toggleItem(item.id)} className="mt-0.5" aria-label={item.checked ? 'Desmarcar item' : 'Marcar item como concluído'}>
                            {item.checked
                                ? <CheckSquare className="h-4 w-4 text-emerald-500" />
                                : <Square className="h-4 w-4 text-surface-300" />}
                        </button>
                        <div className="flex-1 min-w-0">
                            <span className={cn('text-xs text-surface-700', item.checked && 'line-through')}>
                                {item.text}
                            </span>
                            {item.photo_url && (
                                <img src={item.photo_url} alt="Foto do item" className="mt-1 rounded-md h-12 w-16 object-cover" />
                            )}
                        </div>
                        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => handlePhoto(item.id)} className="p-1 text-surface-400 hover:text-brand-500" aria-label="Anexar foto">
                                <Camera className="h-3 w-3" />
                            </button>
                            <button onClick={() => removeItem(item.id)} className="p-1 text-surface-400 hover:text-red-500" aria-label="Remover item">
                                <Trash2 className="h-3 w-3" />
                            </button>
                        </div>
                    </div>
                ))}
            </div>

            {/* Add item */}
            <div className="flex items-center gap-2 mt-2">
                <input
                    value={newText}
                    onChange={e => setNewText(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && addItem()}
                    placeholder="Novo item..."
                    aria-label="Texto do novo item do checklist"
                    className="flex-1 rounded-lg border border-subtle bg-surface-50 px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                />
                <button onClick={addItem} className="rounded-lg bg-brand-500 p-1.5 text-white hover:bg-brand-600 transition-colors" aria-label="Adicionar item">
                    <Plus className="h-3.5 w-3.5" />
                </button>
            </div>

            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={onFileChange} aria-label="Upload de foto para checklist" />
        </div>
    )
}
