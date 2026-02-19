import { History } from 'lucide-react'
import { Modal } from '@/components/ui/modal'
import { Badge } from '@/components/ui/badge'

interface StatusHistoryEntry {
    id: number
    from_status: string | null
    to_status: string
    reason: string | null
    changed_by: string
    changed_at: string
}

interface ExpenseHistoryModalProps {
    open: boolean
    onClose: () => void
    entries: StatusHistoryEntry[]
    statusConfig: Record<string, { label: string; variant: string }>
}

export function ExpenseHistoryModal({ open, onClose, entries, statusConfig }: ExpenseHistoryModalProps) {
    return (
        <Modal open={open} onOpenChange={onClose} title="Histórico de Status">
            <div className="space-y-3 max-h-80 overflow-y-auto">
                {entries.length === 0 ? (
                    <p className="text-sm text-surface-400 text-center py-6">Nenhum registro de histórico</p>
                ) : entries.map((h) => (
                    <div key={h.id} className="flex gap-3 border-b border-subtle pb-3 last:border-0">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface-100">
                            <History className="h-4 w-4 text-surface-500" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                                {h.from_status && (
                                    <>
                                        <Badge variant={statusConfig[h.from_status]?.variant as never}>{statusConfig[h.from_status]?.label}</Badge>
                                        <span className="text-xs text-surface-400">→</span>
                                    </>
                                )}
                                <Badge variant={statusConfig[h.to_status]?.variant as never}>{statusConfig[h.to_status]?.label}</Badge>
                            </div>
                            {h.reason && <p className="mt-1 text-xs text-surface-600">{h.reason}</p>}
                            <p className="mt-1 text-xs text-surface-400">
                                {h.changed_by} · {new Date(h.changed_at).toLocaleString('pt-BR')}
                            </p>
                        </div>
                    </div>
                ))}
            </div>
        </Modal>
    )
}
