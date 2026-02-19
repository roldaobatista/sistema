import { useState, useEffect, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Play, Square, Clock, Wrench, Truck, Coffee, Settings } from 'lucide-react'
import api from '@/lib/api'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'

const activityTypes = [
    { key: 'work', label: 'Trabalho', icon: Wrench, color: 'emerald' },
    { key: 'travel', label: 'Deslocamento', icon: Truck, color: 'sky' },
    { key: 'setup', label: 'Preparação', icon: Settings, color: 'amber' },
    { key: 'pause', label: 'Pausa', icon: Coffee, color: 'surface' },
] as const

interface TimeLog {
    id: number
    user_id: number
    started_at: string
    ended_at: string | null
    duration_seconds: number | null
    activity_type: string
    description: string | null
    user?: { id: number; name: string }
}

interface ExecutionTimerProps {
    workOrderId: number
    status: string
}

function formatDuration(seconds: number): string {
    const h = Math.floor(seconds / 3600)
    const m = Math.floor((seconds % 3600) / 60)
    const s = seconds % 60
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
}

export default function ExecutionTimer({ workOrderId, status }: ExecutionTimerProps) {
    const qc = useQueryClient()
    const [elapsed, setElapsed] = useState(0)
    const [selectedType, setSelectedType] = useState<string>('work')

    const { data: logsRes } = useQuery({
        queryKey: ['work-order-time-logs', workOrderId],
        queryFn: () => api.get('/work-order-time-logs', { params: { work_order_id: workOrderId } }),
    })
    const logs: TimeLog[] = logsRes?.data?.data ?? []

    const activeLog = logs.find(l => !l.ended_at)

    // Live counter while timer is running
    useEffect(() => {
        if (!activeLog) { setElapsed(0); return }
        const startTime = new Date(activeLog.started_at).getTime()
        const tick = () => setElapsed(Math.floor((Date.now() - startTime) / 1000))
        tick()
        const interval = setInterval(tick, 1000)
        return () => clearInterval(interval)
    }, [activeLog])

    const startMut = useMutation({
        mutationFn: () => api.post('/work-order-time-logs/start', {
            work_order_id: workOrderId,
            activity_type: selectedType,
        }),
        onSuccess: () => {
            toast.success('Timer iniciado')
            qc.invalidateQueries({ queryKey: ['work-order-time-logs', workOrderId] })
        },
        onError: (err: any) => toast.error(err?.response?.data?.message || 'Erro ao iniciar timer'),
    })

    const stopMut = useMutation({
        mutationFn: (logId: number) => api.post(`/work-order-time-logs/${logId}/stop`),
        onSuccess: () => {
            toast.success('Timer parado')
            qc.invalidateQueries({ queryKey: ['work-order-time-logs', workOrderId] })
        },
        onError: (err: any) => toast.error(err?.response?.data?.message || 'Erro ao parar timer'),
    })

    // Total time calculated from completed logs
    const totalSeconds = logs.reduce((sum, l) => sum + (l.duration_seconds ?? 0), 0) + (activeLog ? elapsed : 0)

    // Per-activity breakdown
    const breakdown = activityTypes.map(at => {
        const secs = logs
            .filter(l => l.activity_type === at.key && l.duration_seconds)
            .reduce((s, l) => s + (l.duration_seconds ?? 0), 0) + (activeLog?.activity_type === at.key ? elapsed : 0)
        return { ...at, seconds: secs }
    }).filter(b => b.seconds > 0)

    const canStart = ['in_progress', 'open', 'waiting_parts', 'waiting_approval'].includes(status)

    return (
        <div className="rounded-xl border border-default bg-surface-0 p-4 shadow-card">
            <h3 className="text-sm font-semibold text-surface-900 mb-3 flex items-center gap-2">
                <Clock className="h-4 w-4 text-brand-500" />
                Timer de Execução
            </h3>

            {/* Main timer display */}
            <div className="text-center mb-4">
                <p className={cn(
                    'text-3xl font-mono font-bold tabular-nums transition-colors',
                    activeLog ? 'text-emerald-600' : 'text-surface-400'
                )}>
                    {formatDuration(activeLog ? elapsed : 0)}
                </p>
                {activeLog && (
                    <p className="text-xs text-surface-500 mt-1">
                        {activityTypes.find(a => a.key === activeLog.activity_type)?.label ?? activeLog.activity_type}
                    </p>
                )}
            </div>

            {/* Activity type selector */}
            {!activeLog && canStart && (
                <div className="flex gap-1.5 mb-3 justify-center flex-wrap">
                    {activityTypes.map(at => {
                        const Icon = at.icon
                        return (
                            <button
                                key={at.key}
                                onClick={() => setSelectedType(at.key)}
                                className={cn(
                                    'flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all border',
                                    selectedType === at.key
                                        ? 'border-brand-300 bg-brand-50 text-brand-700'
                                        : 'border-transparent bg-surface-100 text-surface-500 hover:bg-surface-200'
                                )}
                            >
                                <Icon className="h-3 w-3" />
                                {at.label}
                            </button>
                        )
                    })}
                </div>
            )}

            {/* Start/Stop buttons */}
            <div className="flex gap-2 justify-center">
                {activeLog ? (
                    <Button
                        variant="danger"
                        size="sm"
                        onClick={() => stopMut.mutate(activeLog.id)}
                        loading={stopMut.isPending}
                        icon={<Square className="h-3.5 w-3.5" />}
                    >
                        Parar
                    </Button>
                ) : canStart ? (
                    <Button
                        size="sm"
                        onClick={() => startMut.mutate()}
                        loading={startMut.isPending}
                        icon={<Play className="h-3.5 w-3.5" />}
                    >
                        Iniciar
                    </Button>
                ) : null}
            </div>

            {/* Summary */}
            {totalSeconds > 0 && (
                <div className="mt-4 pt-3 border-t border-subtle">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-medium text-surface-600">Tempo Total</span>
                        <span className="text-sm font-bold text-surface-900">{formatDuration(totalSeconds)}</span>
                    </div>
                    {breakdown.length > 0 && (
                        <div className="space-y-1">
                            {breakdown.map(b => {
                                const Icon = b.icon
                                return (
                                    <div key={b.key} className="flex items-center justify-between text-xs">
                                        <span className="flex items-center gap-1 text-surface-500">
                                            <Icon className="h-3 w-3" /> {b.label}
                                        </span>
                                        <span className="font-mono text-surface-700">{formatDuration(b.seconds)}</span>
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </div>
            )}

            {/* Recent logs */}
            {logs.filter(l => l.ended_at).length > 0 && (
                <div className="mt-3 pt-3 border-t border-subtle">
                    <p className="text-[10px] font-semibold text-surface-400 uppercase tracking-wider mb-2">Registros</p>
                    <div className="space-y-1.5 max-h-32 overflow-y-auto">
                        {logs.filter(l => l.ended_at).slice(0, 5).map(l => (
                            <div key={l.id} className="flex items-center justify-between text-[11px] text-surface-500">
                                <span>
                                    {activityTypes.find(a => a.key === l.activity_type)?.label ?? l.activity_type}
                                    {l.user && <span className="ml-1 text-surface-400">— {l.user.name}</span>}
                                </span>
                                <span className="font-mono">{formatDuration(l.duration_seconds ?? 0)}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    )
}
