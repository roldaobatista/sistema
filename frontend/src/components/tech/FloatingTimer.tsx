import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Play, Pause, Square, Clock, ChevronUp, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTechTimerStore } from '@/stores/tech-timer-store'
import api from '@/lib/api'
import { toast } from 'sonner'

function formatElapsed(ms: number): string {
    const totalSeconds = Math.floor(ms / 1000)
    const hours = Math.floor(totalSeconds / 3600)
    const minutes = Math.floor((totalSeconds % 3600) / 60)
    const seconds = totalSeconds % 60
    if (hours > 0) return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

export function FloatingTimer() {
    const navigate = useNavigate()
    const { isRunning, workOrderId, workOrderNumber, startedAt, accumulatedMs, pause, resume, stop } = useTechTimerStore()
    const [elapsed, setElapsed] = useState(0)
    const [minimized, setMinimized] = useState(false)

    useEffect(() => {
        if (!isRunning && !workOrderId) return

        const interval = setInterval(() => {
            let total = accumulatedMs
            if (isRunning && startedAt) {
                total += new Date().getTime() - new Date(startedAt).getTime()
            }
            setElapsed(total)
        }, 1000)

        return () => clearInterval(interval)
    }, [isRunning, startedAt, accumulatedMs, workOrderId])

    if (!workOrderId) return null

    const handleStop = async () => {
        const result = stop()
        if (!result) return

        try {
            const minutes = Math.round(result.durationMs / 60000)
            await api.post('/time-entries', {
                work_order_id: result.workOrderId,
                type: 'work',
                duration_minutes: Math.max(1, minutes),
                description: 'Tempo registrado via timer',
            })
            toast.success(`${minutes} min registrados na OS`)
        } catch {
            toast.error('Erro ao salvar tempo. Tente registrar manualmente.')
        }
    }

    if (minimized) {
        return (
            <button
                type="button"
                aria-label="Expandir timer da OS"
                onClick={() => setMinimized(false)}
                className={cn(
                    'fixed bottom-20 right-4 z-40 flex items-center gap-2 px-3 py-2 rounded-full shadow-lg',
                    isRunning
                        ? 'bg-brand-600 text-white animate-pulse'
                        : 'bg-surface-800 text-white'
                )}
            >
                <Clock className="w-4 h-4" />
                <span className="text-sm font-mono font-bold">{formatElapsed(elapsed)}</span>
                <ChevronUp className="w-3 h-3" />
            </button>
        )
    }

    return (
        <div className="fixed bottom-20 right-4 left-4 z-40 bg-card rounded-2xl shadow-2xl border border-border p-4">
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2 min-w-0">
                    <div className={cn(
                        'w-2 h-2 rounded-full flex-shrink-0',
                        isRunning ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'
                    )} />
                    <button
                        type="button"
                        aria-label={`Ir para OS ${workOrderNumber}`}
                        onClick={() => workOrderId && navigate(`/tech/os/${workOrderId}`)}
                        className="text-xs font-medium text-brand-600 truncate"
                    >
                        OS {workOrderNumber}
                    </button>
                </div>
                <button type="button" aria-label="Minimizar timer" onClick={() => setMinimized(true)} className="p-1">
                    <ChevronDown className="w-4 h-4 text-surface-400" />
                </button>
            </div>

            <div className="text-center mb-3">
                <p className={cn(
                    'text-3xl font-mono font-bold',
                    isRunning ? 'text-surface-900' : 'text-surface-400'
                )}>
                    {formatElapsed(elapsed)}
                </p>
                <p className="text-[10px] text-surface-400 mt-0.5">
                    {isRunning ? 'Em andamento' : 'Pausado'}
                </p>
            </div>

            <div className="flex gap-2">
                {isRunning ? (
                    <button
                        type="button"
                        aria-label="Pausar timer"
                        onClick={pause}
                        className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-amber-100 dark:bg-amber-900/30 text-amber-700 text-sm font-medium active:scale-95 transition-all"
                    >
                        <Pause className="w-4 h-4" /> Pausar
                    </button>
                ) : (
                    <button
                        type="button"
                        aria-label="Continuar timer"
                        onClick={resume}
                        className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-brand-100 text-brand-700 text-sm font-medium active:scale-95 transition-all"
                    >
                        <Play className="w-4 h-4" /> Continuar
                    </button>
                )}
                <button
                    type="button"
                    aria-label="Parar e registrar tempo na OS"
                    onClick={handleStop}
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-red-100 dark:bg-red-900/30 text-red-700 text-sm font-medium active:scale-95 transition-all"
                >
                    <Square className="w-4 h-4" /> Parar
                </button>
            </div>
        </div>
    )
}
