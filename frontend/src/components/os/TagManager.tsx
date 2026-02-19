import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Tag, Plus, X } from 'lucide-react'
import api from '@/lib/api'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

const presetColors = [
    'bg-red-100 text-red-700',
    'bg-amber-100 text-amber-700',
    'bg-emerald-100 text-emerald-700',
    'bg-sky-100 text-sky-700',
    'bg-violet-100 text-violet-700',
    'bg-pink-100 text-pink-700',
    'bg-surface-100 text-surface-700',
]

interface TagManagerProps {
    workOrderId: number
    currentTags?: string[]
}

export default function TagManager({ workOrderId, currentTags = [] }: TagManagerProps) {
    const qc = useQueryClient()
    const [isAdding, setIsAdding] = useState(false)
    const [newTag, setNewTag] = useState('')

    const tagMut = useMutation({
        mutationFn: (tags: string[]) => api.put(`/work-orders/${workOrderId}`, { tags }),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['work-order', workOrderId] })
            toast.success('Tags atualizadas')
        },
        onError: () => toast.error('Erro ao atualizar tags'),
    })

    const addTag = () => {
        const tag = newTag.trim().toLowerCase()
        if (!tag || currentTags.includes(tag)) return
        tagMut.mutate([...currentTags, tag])
        setNewTag('')
        setIsAdding(false)
    }

    const removeTag = (tag: string) => {
        tagMut.mutate(currentTags.filter(t => t !== tag))
    }

    const getTagColor = (tag: string) => {
        const hash = tag.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0)
        return presetColors[hash % presetColors.length]
    }

    return (
        <div className="rounded-xl border border-default bg-surface-0 p-4 shadow-card">
            <h3 className="text-sm font-semibold text-surface-900 mb-3 flex items-center gap-2">
                <Tag className="h-4 w-4 text-brand-500" />
                Tags
            </h3>

            <div className="flex flex-wrap gap-1.5">
                {currentTags.map(tag => (
                    <span key={tag} className={cn('inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium', getTagColor(tag))}>
                        {tag}
                        <button onClick={() => removeTag(tag)} className="hover:opacity-70" aria-label={`Remover tag ${tag}`}>
                            <X className="h-2.5 w-2.5" />
                        </button>
                    </span>
                ))}

                {isAdding ? (
                    <div className="flex items-center gap-1">
                        <input
                            autoFocus
                            value={newTag}
                            onChange={e => setNewTag(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter') addTag(); if (e.key === 'Escape') setIsAdding(false) }}
                            onBlur={() => { if (newTag.trim()) addTag(); else setIsAdding(false) }}
                            placeholder="nova tag..."
                            aria-label="Nome da nova tag"
                            className="w-24 rounded-full border border-brand-300 bg-brand-50 px-2.5 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                        />
                    </div>
                ) : (
                    <button
                        onClick={() => setIsAdding(true)}
                        className="inline-flex items-center gap-1 rounded-full border border-dashed border-surface-300 px-2.5 py-1 text-xs text-surface-400 hover:border-brand-300 hover:text-brand-500 transition-colors"
                    >
                        <Plus className="h-3 w-3" /> Adicionar
                    </button>
                )}
            </div>
        </div>
    )
}
