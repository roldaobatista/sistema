import { useState } from 'react'
import { History, ChevronDown, ChevronUp } from 'lucide-react'
import { cn } from '@/lib/utils'

interface AuditEntry {
    id: number
    event: string
    user_name?: string
    created_at: string
    old_values?: Record<string, any>
    new_values?: Record<string, any>
}

interface AuditDiffViewerProps {
    entries: AuditEntry[]
}

const fieldLabels: Record<string, string> = {
    status: 'Status', priority: 'Prioridade', description: 'Descrição',
    assignee_id: 'Técnico', total: 'Valor Total', scheduled_at: 'Agendamento',
    warranty_terms: 'Termos Garantia', warranty_until: 'Garantia Até',
    sla_due_at: 'Prazo SLA', customer_id: 'Cliente',
}

function formatVal(v: any): string {
    if (v === null || v === undefined) return '—'
    if (typeof v === 'boolean') return v ? 'Sim' : 'Não'
    return String(v)
}

export default function AuditDiffViewer({ entries }: AuditDiffViewerProps) {
    const [expanded, setExpanded] = useState<Set<number>>(new Set())

    if (!entries || entries.length === 0) return null

    const toggleExpand = (id: number) => setExpanded(prev => {
        const next = new Set(prev)
        if (next.has(id)) {
            next.delete(id)
        } else {
            next.add(id)
        }
        return next
    })

    const formatDate = (d: string) =>
        new Date(d).toLocaleString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })

    return (
        <div className="space-y-2">
            {entries.slice(0, 20).map(entry => {
                const hasChanges = entry.old_values && entry.new_values &&
                    (Object.keys(entry.old_values).length > 0 || Object.keys(entry.new_values).length > 0)
                const isExpanded = expanded.has(entry.id)

                return (
                    <div key={entry.id} className="rounded-lg border border-subtle bg-surface-50 overflow-hidden">
                        <button
                            onClick={() => hasChanges && toggleExpand(entry.id)}
                            className={cn(
                                'w-full flex items-center gap-2 px-3 py-2 text-left',
                                hasChanges && 'cursor-pointer hover:bg-surface-100'
                            )}
                            aria-label={`Detalhes da alteração: ${entry.event}`}
                        >
                            <History className="h-3 w-3 text-surface-400 flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                                <p className="text-xs font-medium text-surface-700 truncate">{entry.event}</p>
                                <p className="text-[10px] text-surface-400">
                                    {entry.user_name ?? 'Sistema'} • {formatDate(entry.created_at)}
                                </p>
                            </div>
                            {hasChanges && (
                                isExpanded
                                    ? <ChevronUp className="h-3 w-3 text-surface-400" />
                                    : <ChevronDown className="h-3 w-3 text-surface-400" />
                            )}
                        </button>

                        {isExpanded && hasChanges && entry.old_values && entry.new_values && (
                            <div className="px-3 pb-2 border-t border-subtle">
                                <table className="w-full text-[11px] mt-1.5">
                                    <thead>
                                        <tr className="text-surface-400">
                                            <th className="text-left font-medium py-0.5">Campo</th>
                                            <th className="text-left font-medium py-0.5">Antes</th>
                                            <th className="text-left font-medium py-0.5">Depois</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {Object.keys({ ...entry.old_values, ...entry.new_values }).map(key => (
                                            <tr key={key} className="border-t border-subtle/50">
                                                <td className="py-1 font-medium text-surface-600">
                                                    {fieldLabels[key] ?? key}
                                                </td>
                                                <td className="py-1 text-red-600 line-through">
                                                    {formatVal(entry.old_values![key])}
                                                </td>
                                                <td className="py-1 text-emerald-600 font-medium">
                                                    {formatVal(entry.new_values![key])}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                )
            })}
        </div>
    )
}
