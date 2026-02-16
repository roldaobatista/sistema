import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
    ArrowLeft, Clock, Play, Square, Loader2, Calendar,
    MapPin, Timer, CheckCircle2,
} from 'lucide-react'
import { cn, getApiErrorMessage } from '@/lib/utils'
import api from '@/lib/api'
import { toast } from 'sonner'

interface TimeEntry {
    id: number
    work_order_id: number | null
    work_order_number?: string
    type: string
    clock_in: string
    clock_out: string | null
    duration_minutes: number | null
    notes: string | null
    latitude: number | null
    longitude: number | null
}

interface ActiveClock {
    id: number
    clock_in: string
    type: string
    work_order_id: number | null
}

export default function TechTimeEntriesPage() {
    const navigate = useNavigate()
    const [entries, setEntries] = useState<TimeEntry[]>([])
    const [activeClock, setActiveClock] = useState<ActiveClock | null>(null)
    const [loading, setLoading] = useState(true)
    const [clocking, setClocking] = useState(false)
    const [elapsed, setElapsed] = useState('00:00:00')
    const timerRef = useRef<ReturnType<typeof setInterval>>(undefined)
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().slice(0, 10))

    useEffect(() => {
        fetchData()
    }, [selectedDate])

    useEffect(() => {
        if (activeClock) {
            const updateElapsed = () => {
                const diff = Date.now() - new Date(activeClock.clock_in).getTime()
                const h = Math.floor(diff / 3600000)
                const m = Math.floor((diff % 3600000) / 60000)
                const s = Math.floor((diff % 60000) / 1000)
                setElapsed(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`)
            }
            updateElapsed()
            timerRef.current = setInterval(updateElapsed, 1000)
            return () => clearInterval(timerRef.current)
        } else {
            setElapsed('00:00:00')
        }
    }, [activeClock])

    async function fetchData() {
        setLoading(true)
        try {
            const [entriesRes, activeRes] = await Promise.allSettled([
                api.get('/technician/time-entries', { params: { date: selectedDate, my: '1' } }),
                api.get('/technician/time-entries/active'),
            ])
            if (entriesRes.status === 'fulfilled') {
                setEntries(entriesRes.value.data?.data ?? entriesRes.value.data ?? [])
            }
            if (activeRes.status === 'fulfilled' && activeRes.value.data?.data) {
                setActiveClock(activeRes.value.data.data)
            }
        } catch {
            toast.error('Erro ao carregar apontamentos')
        } finally {
            setLoading(false)
        }
    }

    async function handleClockIn() {
        setClocking(true)
        try {
            let latitude: number | null = null
            let longitude: number | null = null
            try {
                const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
                    navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 5000 })
                )
                latitude = pos.coords.latitude
                longitude = pos.coords.longitude
            } catch {
                // GPS não disponível
            }

            const { data } = await api.post('/technician/time-entries/clock-in', {
                type: 'work',
                latitude,
                longitude,
            })
            setActiveClock(data.data ?? data)
            toast.success('Ponto registrado - início')
        } catch (err: unknown) {
            toast.error(getApiErrorMessage(err, 'Erro ao registrar ponto'))
        } finally {
            setClocking(false)
        }
    }

    async function handleClockOut() {
        if (!activeClock) return
        setClocking(true)
        try {
            let latitude: number | null = null
            let longitude: number | null = null
            try {
                const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
                    navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 5000 })
                )
                latitude = pos.coords.latitude
                longitude = pos.coords.longitude
            } catch {
                // GPS não disponível
            }

            await api.post(`/technician/time-entries/${activeClock.id}/clock-out`, {
                latitude,
                longitude,
            })
            setActiveClock(null)
            toast.success('Ponto registrado - saída')
            fetchData()
        } catch (err: unknown) {
            toast.error(getApiErrorMessage(err, 'Erro ao registrar saída'))
        } finally {
            setClocking(false)
        }
    }

    const formatDuration = (minutes: number | null) => {
        if (!minutes) return '—'
        const h = Math.floor(minutes / 60)
        const m = minutes % 60
        return `${h}h${String(m).padStart(2, '0')}min`
    }

    const totalMinutes = entries.reduce((sum, e) => sum + (e.duration_minutes || 0), 0)

    return (
        <div className="flex flex-col h-full">
            <div className="bg-white dark:bg-surface-900 px-4 pt-3 pb-4 border-b border-surface-200 dark:border-surface-700">
                <button onClick={() => navigate('/tech')} className="flex items-center gap-1 text-sm text-brand-600 dark:text-brand-400 mb-2">
                    <ArrowLeft className="w-4 h-4" /> Voltar
                </button>
                <h1 className="text-lg font-bold text-surface-900 dark:text-surface-50">Apontamento de Horas</h1>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
                {/* Clock in/out card */}
                <div className={cn(
                    'rounded-2xl p-5 text-center',
                    activeClock
                        ? 'bg-gradient-to-br from-emerald-500 to-emerald-600 text-white'
                        : 'bg-white dark:bg-surface-800/80'
                )}>
                    <div className="flex items-center justify-center gap-2 mb-2">
                        <Timer className={cn('w-5 h-5', activeClock ? 'text-white/80' : 'text-surface-400')} />
                        <span className={cn('text-sm font-medium', activeClock ? 'text-white/80' : 'text-surface-500')}>
                            {activeClock ? 'Em serviço' : 'Fora de serviço'}
                        </span>
                    </div>

                    <p className={cn('text-4xl font-bold font-mono', activeClock ? 'text-white' : 'text-surface-300 dark:text-surface-600')}>
                        {elapsed}
                    </p>

                    {activeClock && (
                        <p className="text-xs mt-1 text-white/70">
                            Início: {new Date(activeClock.clock_in).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                        </p>
                    )}

                    <button
                        onClick={activeClock ? handleClockOut : handleClockIn}
                        disabled={clocking}
                        className={cn(
                            'mt-4 w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold transition-colors',
                            activeClock
                                ? 'bg-white/20 text-white backdrop-blur-sm active:bg-white/30'
                                : 'bg-brand-600 text-white active:bg-brand-700',
                            clocking && 'opacity-70',
                        )}
                    >
                        {clocking ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                        ) : activeClock ? (
                            <><Square className="w-4 h-4" /> Registrar Saída</>
                        ) : (
                            <><Play className="w-4 h-4" /> Registrar Entrada</>
                        )}
                    </button>
                </div>

                {/* Date selector */}
                <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-surface-400" />
                    <input
                        type="date"
                        value={selectedDate}
                        onChange={(e) => setSelectedDate(e.target.value)}
                        className="flex-1 px-3 py-2 rounded-lg bg-white dark:bg-surface-800 border-0 text-sm focus:ring-2 focus:ring-brand-500/30 focus:outline-none"
                    />
                    {totalMinutes > 0 && (
                        <span className="px-2.5 py-1 rounded-full bg-brand-100 dark:bg-brand-900/30 text-brand-700 dark:text-brand-400 text-xs font-medium">
                            Total: {formatDuration(totalMinutes)}
                        </span>
                    )}
                </div>

                {/* Entries list */}
                {loading ? (
                    <div className="flex justify-center py-8">
                        <Loader2 className="w-6 h-6 animate-spin text-brand-500" />
                    </div>
                ) : entries.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 gap-3">
                        <Clock className="w-10 h-10 text-surface-300" />
                        <p className="text-sm text-surface-500">Nenhum apontamento neste dia</p>
                    </div>
                ) : (
                    <div className="space-y-2">
                        {entries.map(entry => (
                            <div key={entry.id} className="bg-white dark:bg-surface-800/80 rounded-xl p-3">
                                <div className="flex items-center gap-3">
                                    <div className={cn(
                                        'w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0',
                                        entry.clock_out ? 'bg-emerald-100 dark:bg-emerald-900/30' : 'bg-blue-100 dark:bg-blue-900/30'
                                    )}>
                                        {entry.clock_out
                                            ? <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                                            : <Play className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                                        }
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <span className="text-sm font-medium text-surface-900 dark:text-surface-50">
                                                {new Date(entry.clock_in).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                                                {entry.clock_out && ` — ${new Date(entry.clock_out).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`}
                                            </span>
                                        </div>
                                        {entry.work_order_number && (
                                            <p className="text-xs text-surface-500">OS: {entry.work_order_number}</p>
                                        )}
                                        {entry.notes && (
                                            <p className="text-xs text-surface-400 truncate">{entry.notes}</p>
                                        )}
                                    </div>
                                    <span className="text-sm font-bold text-surface-700 dark:text-surface-300 flex-shrink-0">
                                        {formatDuration(entry.duration_minutes)}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}
