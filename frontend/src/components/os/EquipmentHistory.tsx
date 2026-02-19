import { useQuery } from '@tanstack/react-query'
import { Monitor, Calendar, Wrench, AlertTriangle } from 'lucide-react'
import api from '@/lib/api'
import { cn } from '@/lib/utils'

interface EquipmentHistoryProps {
    equipmentId: number
    currentWorkOrderId: number
}

interface HistoryEntry {
    id: number
    number: string
    os_number?: string
    business_number?: string
    status: string
    description: string
    created_at: string
    completed_at?: string
}

const statusLabels: Record<string, string> = {
    open: 'Aberta', in_progress: 'Em Andamento', completed: 'Concluída',
    delivered: 'Entregue', invoiced: 'Faturada', cancelled: 'Cancelada',
    waiting_parts: 'Aguard. Peças', waiting_approval: 'Aguard. Aprovação',
    awaiting_dispatch: 'Aguard. Despacho',
}

export default function EquipmentHistory({ equipmentId, currentWorkOrderId }: EquipmentHistoryProps) {
    const { data: histRes } = useQuery({
        queryKey: ['equipment-history', equipmentId],
        queryFn: () => api.get(`/work-orders`, { params: { equipment_id: equipmentId, per_page: 10 } }),
        enabled: !!equipmentId,
    })
    const entries: HistoryEntry[] = (histRes?.data?.data ?? []).filter((e: any) => e.id !== currentWorkOrderId)

    if (entries.length === 0) return null

    const formatDate = (d: string) =>
        new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: '2-digit' })

    return (
        <div className="rounded-xl border border-default bg-surface-0 p-4 shadow-card">
            <h3 className="text-sm font-semibold text-surface-900 mb-3 flex items-center gap-2">
                <Monitor className="h-4 w-4 text-brand-500" />
                Histórico do Equipamento
                <span className="ml-auto text-[10px] font-normal text-surface-400">{entries.length} OS anteriores</span>
            </h3>

            <div className="space-y-2 max-h-48 overflow-y-auto">
                {entries.map(e => {
                    const id = e.business_number ?? e.os_number ?? e.number
                    return (
                        <a key={e.id} href={`/os/${e.id}`}
                            className="group block rounded-lg bg-surface-50 px-3 py-2 hover:bg-brand-50 transition-colors"
                        >
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-bold text-brand-600 group-hover:text-brand-700">{id}</span>
                                <span className="text-[10px] text-surface-400 flex items-center gap-1">
                                    <Calendar className="h-2.5 w-2.5" />
                                    {formatDate(e.created_at)}
                                </span>
                            </div>
                            <p className="text-[11px] text-surface-500 truncate mt-0.5">{e.description}</p>
                            <span className={cn(
                                'mt-1 inline-block rounded-full px-1.5 py-0.5 text-[10px] font-medium',
                                e.status === 'completed' || e.status === 'delivered' || e.status === 'invoiced'
                                    ? 'bg-emerald-100 text-emerald-700'
                                    : e.status === 'cancelled' ? 'bg-red-100 text-red-700'
                                        : 'bg-amber-100 text-amber-700'
                            )}>
                                {statusLabels[e.status] ?? e.status}
                            </span>
                        </a>
                    )
                })}
            </div>
        </div>
    )
}
