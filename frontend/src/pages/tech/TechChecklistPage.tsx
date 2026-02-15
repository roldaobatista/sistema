import { useEffect, useState, useCallback , useMemo } from 'react'
import { toast } from 'sonner'
import { useParams, useNavigate } from 'react-router-dom'
import {
    ArrowLeft, CheckCircle2, Loader2, AlertCircle,
    ChevronDown, ChevronUp,
} from 'lucide-react'
import { useOfflineStore } from '@/hooks/useOfflineStore'
import { offlinePost } from '@/lib/syncEngine'
import { generateUlid } from '@/lib/offlineDb'
import { cn } from '@/lib/utils'
import type { OfflineChecklist } from '@/lib/offlineDb'

interface ChecklistItem {
    id: string | number
    label: string
    type: string
    required: boolean
    options?: string[] | null
}

export default function TechChecklistPage() {

    const { id: woId } = useParams<{ id: string }>()
    const navigate = useNavigate()
    const { items: checklists } = useOfflineStore('checklists')
    const { put: putResponse } = useOfflineStore('checklist-responses')
    const [selectedChecklist, setSelectedChecklist] = useState<OfflineChecklist | null>(null)
    const [responses, setResponses] = useState<Record<string | number, string | boolean>>({})
    const [expandedSections, setExpandedSections] = useState<Set<number>>(new Set())
    const [saving, setSaving] = useState(false)
    const [saved, setSaved] = useState(false)

    useEffect(() => {
        if (checklists.length > 0 && !selectedChecklist) {
            setSelectedChecklist(checklists[0])
            // Expand all by default
            setExpandedSections(new Set(checklists[0].items?.map((_: ChecklistItem, i: number) => i) || []))
        }
    }, [checklists, selectedChecklist])

    const toggleSection = (index: number) => {
        setExpandedSections((prev) => {
            const next = new Set(prev)
            if (next.has(index)) next.delete(index)
            else next.add(index)
            return next
        })
    }

    const updateResponse = (itemId: string | number, value: string | boolean) => {
        setResponses((prev) => ({ ...prev, [itemId]: value }))
        setSaved(false)
    }

    const handleSave = useCallback(async () => {
        if (!selectedChecklist || !woId) return
        setSaving(true)
        try {
            const responseData = {
                id: generateUlid(),
                work_order_id: Number(woId),
                equipment_id: null,
                checklist_id: selectedChecklist.id,
                responses,
                completed_at: new Date().toISOString(),
                synced: false,
            }

            // Save to IndexedDB
            await putResponse(responseData as any)

            // Queue for sync
            await offlinePost('/tech/sync/batch', {
                mutations: [{
                    type: 'checklist_response',
                    data: responseData,
                }],
            })

            setSaved(true)
        } catch {
            // Will retry
        } finally {
            setSaving(false)
        }
    }, [selectedChecklist, woId, responses, putResponse])

    const items: ChecklistItem[] = selectedChecklist?.items || []
    const requiredIds = items.filter((i) => i.required).map((i) => i.id)
    const allRequiredFilled = requiredIds.every((id) => responses[id] !== undefined && responses[id] !== '')

    return (
        <div className="flex flex-col h-full">
            {/* Header */}
            <div className="bg-white dark:bg-surface-900 px-4 pt-3 pb-4 border-b border-surface-200 dark:border-surface-700">
                <button onClick={() => navigate(`/tech/os/${woId}`)} className="flex items-center gap-1 text-sm text-brand-600 dark:text-brand-400 mb-2">
                    <ArrowLeft className="w-4 h-4" /> Voltar
                </button>
                <h1 className="text-lg font-bold text-surface-900 dark:text-surface-50">Checklist</h1>

                {/* Checklist selector */}
                {checklists.length > 1 && (
                    <div className="mt-3 flex gap-2 overflow-x-auto no-scrollbar">
                        {checklists.map((cl) => (
                            <button
                                key={cl.id}
                                onClick={() => {
                                    setSelectedChecklist(cl)
                                    setResponses({})
                                    setSaved(false)
                                }}
                                className={cn(
                                    'px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors',
                                    selectedChecklist?.id === cl.id
                                        ? 'bg-brand-600 text-white'
                                        : 'bg-surface-100 dark:bg-surface-800 text-surface-600 dark:text-surface-400'
                                )}
                            >
                                {cl.name}
                            </button>
                        ))}
                    </div>
                )}
            </div>

            {/* Items */}
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
                {items.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 gap-3">
                        <AlertCircle className="w-10 h-10 text-surface-300" />
                        <p className="text-sm text-surface-500">Nenhum item no checklist</p>
                    </div>
                ) : (
                    items.map((item, index) => {
                        const isExpanded = expandedSections.has(index)
                        const value = responses[item.id]
                        const isFilled = value !== undefined && value !== ''

                        return (
                            <div
                                key={item.id}
                                className="bg-white dark:bg-surface-800/80 rounded-xl overflow-hidden"
                            >
                                <button
                                    onClick={() => toggleSection(index)}
                                    className="w-full flex items-center gap-3 p-4"
                                >
                                    <div className={cn(
                                        'w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0',
                                        isFilled
                                            ? 'bg-emerald-500 text-white'
                                            : item.required
                                                ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-600'
                                                : 'bg-surface-100 dark:bg-surface-700 text-surface-400'
                                    )}>
                                        {isFilled ? (
                                            <CheckCircle2 className="w-4 h-4" />
                                        ) : (
                                            <span className="text-[10px] font-bold">{index + 1}</span>
                                        )}
                                    </div>
                                    <div className="flex-1 text-left">
                                        <p className="text-sm font-medium text-surface-900 dark:text-surface-50">
                                            {item.label}
                                            {item.required && <span className="text-red-500 ml-1">*</span>}
                                        </p>
                                    </div>
                                    {isExpanded ? (
                                        <ChevronUp className="w-4 h-4 text-surface-400" />
                                    ) : (
                                        <ChevronDown className="w-4 h-4 text-surface-400" />
                                    )}
                                </button>

                                {isExpanded && (
                                    <div className="px-4 pb-4">
                                        {item.type === 'boolean' || item.type === 'yes_no' ? (
                                            <div className="flex gap-3">
                                                {[
                                                    { val: true, label: 'Conforme', color: 'bg-emerald-600' },
                                                    { val: false, label: 'Não Conforme', color: 'bg-red-600' },
                                                ].map((opt) => (
                                                    <button
                                                        key={String(opt.val)}
                                                        onClick={() => updateResponse(item.id, opt.val)}
                                                        className={cn(
                                                            'flex-1 py-2.5 rounded-lg text-xs font-medium transition-colors',
                                                            value === opt.val
                                                                ? `${opt.color} text-white`
                                                                : 'bg-surface-100 dark:bg-surface-700 text-surface-600 dark:text-surface-400'
                                                        )}
                                                    >
                                                        {opt.label}
                                                    </button>
                                                ))}
                                            </div>
                                        ) : item.type === 'select' && item.options ? (
                                            <div className="flex flex-wrap gap-2">
                                                {item.options.map((opt) => (
                                                    <button
                                                        key={opt}
                                                        onClick={() => updateResponse(item.id, opt)}
                                                        className={cn(
                                                            'px-3 py-2 rounded-lg text-xs font-medium transition-colors',
                                                            value === opt
                                                                ? 'bg-brand-600 text-white'
                                                                : 'bg-surface-100 dark:bg-surface-700 text-surface-600 dark:text-surface-400'
                                                        )}
                                                    >
                                                        {opt}
                                                    </button>
                                                ))}
                                            </div>
                                        ) : (
                                            <textarea
                                                value={String(value || '')}
                                                onChange={(e) => updateResponse(item.id, e.target.value)}
                                                placeholder="Digite aqui..."
                                                rows={2}
                                                className="w-full px-3 py-2.5 rounded-lg bg-surface-100 dark:bg-surface-700 border-0 text-sm placeholder:text-surface-400 focus:ring-2 focus:ring-brand-500/30 focus:outline-none resize-none"
                                            />
                                        )}
                                    </div>
                                )}
                            </div>
                        )
                    })
                )}
            </div>

            {/* Save button */}
            <div className="p-4 bg-white dark:bg-surface-900 border-t border-surface-200 dark:border-surface-700 safe-area-bottom">
                <button
                    onClick={handleSave}
                    disabled={saving || !allRequiredFilled}
                    className={cn(
                        'w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold text-white transition-colors',
                        saved
                            ? 'bg-emerald-600'
                            : allRequiredFilled
                                ? 'bg-brand-600 active:bg-brand-700'
                                : 'bg-surface-300 dark:bg-surface-700',
                        saving && 'opacity-70',
                    )}
                >
                    {saving ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                    ) : saved ? (
                        <>
                            <CheckCircle2 className="w-4 h-4" /> Salvo
                        </>
                    ) : (
                        'Salvar Checklist'
                    )}
                </button>
            </div>
        </div>
    )
}
