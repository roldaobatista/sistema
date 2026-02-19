import { useQuery } from '@tanstack/react-query'
import { Clock, User, BarChart3 } from 'lucide-react'
import api from '@/lib/api'

interface TimeReportProps {
    workOrderId: number
}

interface TimeLog {
    id: number
    user_id: number
    started_at: string
    ended_at: string | null
    duration_seconds: number | null
    activity_type: string
    user?: { id: number; name: string }
}

const activityLabels: Record<string, string> = {
    work: 'Trabalho', travel: 'Deslocamento', setup: 'Preparação', pause: 'Pausa',
}

function formatDuration(s: number): string {
    const h = Math.floor(s / 3600)
    const m = Math.floor((s % 3600) / 60)
    return h > 0 ? `${h}h ${m}min` : `${m}min`
}

export default function TimeReport({ workOrderId }: TimeReportProps) {
    const { data: logsRes } = useQuery({
        queryKey: ['work-order-time-logs', workOrderId],
        queryFn: () => api.get('/work-order-time-logs', { params: { work_order_id: workOrderId } }),
    })
    const logs: TimeLog[] = (logsRes?.data?.data ?? []).filter((l: TimeLog) => l.ended_at && l.duration_seconds)

    if (logs.length === 0) return null

    // Group by technician
    const byTech = logs.reduce<Record<string, { name: string; total: number; byType: Record<string, number> }>>((acc, l) => {
        const key = String(l.user_id)
        if (!acc[key]) acc[key] = { name: l.user?.name ?? `Técnico #${l.user_id}`, total: 0, byType: {} }
        acc[key].total += l.duration_seconds ?? 0
        const type = l.activity_type ?? 'work'
        acc[key].byType[type] = (acc[key].byType[type] ?? 0) + (l.duration_seconds ?? 0)
        return acc
    }, {})

    const techList = Object.values(byTech).sort((a, b) => b.total - a.total)
    const grandTotal = techList.reduce((s, t) => s + t.total, 0)

    return (
        <div className="rounded-xl border border-default bg-surface-0 p-4 shadow-card">
            <h3 className="text-sm font-semibold text-surface-900 mb-3 flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-brand-500" />
                Tempo por Técnico
            </h3>

            <div className="space-y-3">
                {techList.map(tech => (
                    <div key={tech.name}>
                        <div className="flex items-center justify-between mb-1">
                            <span className="text-xs font-medium text-surface-700 flex items-center gap-1">
                                <User className="h-3 w-3 text-surface-400" /> {tech.name}
                            </span>
                            <span className="text-xs font-bold text-surface-900">{formatDuration(tech.total)}</span>
                        </div>
                        {/* Stacked bar */}
                        <div className="flex h-2 rounded-full overflow-hidden bg-surface-100">
                            {Object.entries(tech.byType).map(([type, secs]) => (
                                <div
                                    key={type}
                                    className={cn(
                                        type === 'work' ? 'bg-emerald-500' :
                                            type === 'travel' ? 'bg-sky-500' :
                                                type === 'setup' ? 'bg-amber-500' : 'bg-surface-300'
                                    )}
                                    style={{ width: `${(secs / tech.total) * 100}%` }}
                                    title={`${activityLabels[type] ?? type}: ${formatDuration(secs)}`}
                                />
                            ))}
                        </div>
                        <div className="flex gap-2 mt-1 flex-wrap">
                            {Object.entries(tech.byType).map(([type, secs]) => (
                                <span key={type} className="text-[10px] text-surface-400">
                                    {activityLabels[type] ?? type}: {formatDuration(secs)}
                                </span>
                            ))}
                        </div>
                    </div>
                ))}
            </div>

            <div className="mt-3 pt-2 border-t border-subtle flex justify-between">
                <span className="text-xs font-medium text-surface-600">Total Geral</span>
                <span className="text-sm font-bold text-surface-900">{formatDuration(grandTotal)}</span>
            </div>
        </div>
    )
}
