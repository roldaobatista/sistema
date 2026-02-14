import { useState, useEffect } from 'react'
import { Clock, User, Pencil, Plus, Trash2, Package, ArrowRightLeft, Loader2, Shield } from 'lucide-react'
import api from '@/lib/api'
import { cn } from '@/lib/utils'
import { formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'

interface AuditEntry {
    id: string | number
    action: string
    action_label: string
    description: string
    entity_type: string | null
    entity_id: string | number | null
    user: { id: number; name: string } | null
    old_values: Record<string, any> | null
    new_values: Record<string, any> | null
    ip_address: string | null
    created_at: string
}

interface AuditTrailTabProps {
    workOrderId: number
}

const ACTION_ICONS: Record<string, any> = {
    created: Plus,
    updated: Pencil,
    deleted: Trash2,
    status_changed: ArrowRightLeft,
}

const ACTION_COLORS: Record<string, string> = {
    created: 'text-emerald-500 bg-emerald-50 dark:bg-emerald-900/30',
    updated: 'text-brand-500 bg-brand-50 dark:bg-brand-900/30',
    deleted: 'text-red-500 bg-red-50 dark:bg-red-900/30',
    status_changed: 'text-amber-500 bg-amber-50 dark:bg-amber-900/30',
}

const FIELD_LABELS: Record<string, string> = {
    status: 'Status',
    priority: 'Prioridade',
    description: 'Descrição',
    technical_report: 'Laudo Técnico',
    internal_notes: 'Notas Internas',
    discount: 'Desconto',
    total: 'Total',
    displacement_value: 'Deslocamento',
    assigned_to: 'Responsável',
    driver_id: 'Motorista',
    quantity: 'Quantidade',
    unit_price: 'Preço Unitário',
    sla_due_at: 'Prazo SLA',
}

export default function AuditTrailTab({ workOrderId }: AuditTrailTabProps) {
    const [entries, setEntries] = useState<AuditEntry[]>([])
    const [loading, setLoading] = useState(true)
    const [expandedId, setExpandedId] = useState<string | number | null>(null)

    useEffect(() => {
        const fetch = async () => {
            try {
                const res = await api.get(`/work-orders/${workOrderId}/audit-trail`)
                setEntries(res.data?.data ?? [])
            } catch (error) {
                console.error('Failed to fetch audit trail:', error)
            } finally {
                setLoading(false)
            }
        }
        fetch()
    }, [workOrderId])

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center py-20 gap-3 text-surface-400">
                <Loader2 className="w-8 h-8 animate-spin" />
                <p className="text-sm font-medium">Carregando trilha de auditoria...</p>
            </div>
        )
    }

    if (entries.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-20 gap-3 text-center">
                <div className="w-16 h-16 rounded-3xl bg-surface-100 dark:bg-surface-800 flex items-center justify-center text-surface-300">
                    <Shield className="w-8 h-8" />
                </div>
                <p className="text-sm font-medium text-surface-500">Nenhum registro de auditoria para esta OS.</p>
            </div>
        )
    }

    return (
        <div className="rounded-xl border border-default bg-surface-0 shadow-card overflow-hidden">
            <div className="px-5 py-4 border-b border-subtle bg-surface-50 dark:bg-surface-900/50">
                <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-surface-900 flex items-center gap-2">
                        <Clock className="h-4 w-4 text-brand-500" />
                        Trilha de Auditoria
                    </h3>
                    <span className="text-xs text-surface-400 font-medium">{entries.length} registros</span>
                </div>
            </div>
            <div className="divide-y divide-subtle max-h-[600px] overflow-y-auto">
                {entries.map((entry) => {
                    const IconCmp = ACTION_ICONS[entry.action] ?? Clock
                    const colorClass = ACTION_COLORS[entry.action] ?? 'text-surface-400 bg-surface-100'
                    const isExpanded = expandedId === entry.id
                    const hasChanges = entry.old_values || entry.new_values
                    const changedFields = getChangedFields(entry)

                    return (
                        <div key={entry.id} className="group">
                            <button
                                type="button"
                                className="w-full text-left px-5 py-3 flex items-start gap-3 hover:bg-surface-50 dark:hover:bg-surface-800/50 transition-colors"
                                onClick={() => hasChanges && setExpandedId(isExpanded ? null : entry.id)}
                            >
                                <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5', colorClass)}>
                                    <IconCmp className="w-4 h-4" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-0.5">
                                        <span className="text-xs font-bold uppercase tracking-wider text-surface-400">{entry.action_label}</span>
                                        {entry.entity_type && entry.entity_type !== 'WorkOrder' && (
                                            <span className="text-[10px] bg-surface-100 dark:bg-surface-800 px-1.5 py-0.5 rounded font-medium text-surface-500">
                                                {entry.entity_type === 'WorkOrderItem' ? 'Item' : entry.entity_type}
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-sm text-surface-700 dark:text-surface-300 leading-snug">{entry.description}</p>
                                    <div className="flex items-center gap-3 mt-1.5">
                                        <span className="text-[11px] text-surface-400 flex items-center gap-1">
                                            <User className="w-3 h-3" />
                                            {entry.user?.name ?? 'Sistema'}
                                        </span>
                                        <span className="text-[11px] text-surface-400 tabular-nums">
                                            {formatDistanceToNow(new Date(entry.created_at), { locale: ptBR, addSuffix: true })}
                                        </span>
                                        {entry.ip_address && (
                                            <span className="text-[10px] text-surface-300 tabular-nums">{entry.ip_address}</span>
                                        )}
                                    </div>
                                </div>
                            </button>

                            {/* Expanded diff view */}
                            {isExpanded && changedFields.length > 0 && (
                                <div className="px-5 pb-4 pl-16">
                                    <div className="rounded-lg border border-surface-200 dark:border-surface-700 overflow-hidden">
                                        <table className="w-full text-xs">
                                            <thead>
                                                <tr className="bg-surface-50 dark:bg-surface-800">
                                                    <th className="text-left px-3 py-2 font-semibold text-surface-600">Campo</th>
                                                    <th className="text-left px-3 py-2 font-semibold text-red-500">Antes</th>
                                                    <th className="text-left px-3 py-2 font-semibold text-emerald-500">Depois</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-subtle">
                                                {changedFields.map(({ field, oldVal, newVal }) => (
                                                    <tr key={field} className="hover:bg-surface-50/50">
                                                        <td className="px-3 py-2 font-medium text-surface-700">{FIELD_LABELS[field] ?? field}</td>
                                                        <td className="px-3 py-2 text-red-600 dark:text-red-400 line-through">{formatValue(oldVal)}</td>
                                                        <td className="px-3 py-2 text-emerald-600 dark:text-emerald-400 font-medium">{formatValue(newVal)}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}
                        </div>
                    )
                })}
            </div>
        </div>
    )
}

function getChangedFields(entry: AuditEntry): { field: string; oldVal: any; newVal: any }[] {
    const old = entry.old_values ?? {}
    const updated = entry.new_values ?? {}
    const allKeys = [...new Set([...Object.keys(old), ...Object.keys(updated)])]

    return allKeys
        .filter(key => !['updated_at', 'created_at', 'deleted_at', 'id', 'tenant_id'].includes(key))
        .filter(key => JSON.stringify(old[key]) !== JSON.stringify(updated[key]))
        .map(key => ({ field: key, oldVal: old[key], newVal: updated[key] }))
}

function formatValue(val: any): string {
    if (val === null || val === undefined) return '—'
    if (typeof val === 'boolean') return val ? 'Sim' : 'Não'
    return String(val)
}
