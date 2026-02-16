import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
    ArrowLeft, Calendar, ChevronLeft, ChevronRight, Clock, MapPin,
    Loader2, Wrench, CheckCircle2, AlertCircle, Navigation,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import api from '@/lib/api'
import { toast } from 'sonner'

interface ScheduleWO {
    id: number
    os_number: string | null
    number: string | null
    customer_name: string | null
    description: string | null
    status: string
    priority: string
    scheduled_date: string | null
    scheduled_time: string | null
    city: string | null
}

const STATUS_COLORS: Record<string, string> = {
    pending: 'bg-amber-500',
    in_progress: 'bg-blue-500',
    completed: 'bg-emerald-500',
    cancelled: 'bg-red-500',
}

const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
const MONTHS = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']

export default function TechSchedulePage() {
    const navigate = useNavigate()
    const [workOrders, setWorkOrders] = useState<ScheduleWO[]>([])
    const [loading, setLoading] = useState(true)
    const [currentDate, setCurrentDate] = useState(new Date())
    const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().slice(0, 10))

    const year = currentDate.getFullYear()
    const month = currentDate.getMonth()

    useEffect(() => {
        fetchSchedule()
    }, [month, year])

    async function fetchSchedule() {
        setLoading(true)
        try {
            const from = new Date(year, month, 1).toISOString().slice(0, 10)
            const to = new Date(year, month + 1, 0).toISOString().slice(0, 10)
            const { data } = await api.get('/work-orders', {
                params: { my: '1', scheduled_from: from, scheduled_to: to, per_page: 100 }
            })
            setWorkOrders(data.data ?? data ?? [])
        } catch {
            toast.error('Erro ao carregar agenda')
        } finally {
            setLoading(false)
        }
    }

    const calendarDays = useMemo(() => {
        const firstDay = new Date(year, month, 1).getDay()
        const daysInMonth = new Date(year, month + 1, 0).getDate()
        const days: (number | null)[] = []

        for (let i = 0; i < firstDay; i++) days.push(null)
        for (let i = 1; i <= daysInMonth; i++) days.push(i)
        return days
    }, [year, month])

    const wosByDate = useMemo(() => {
        const map: Record<string, ScheduleWO[]> = {}
        workOrders.forEach(wo => {
            if (wo.scheduled_date) {
                const dateKey = wo.scheduled_date.slice(0, 10)
                if (!map[dateKey]) map[dateKey] = []
                map[dateKey].push(wo)
            }
        })
        return map
    }, [workOrders])

    const selectedDayOrders = wosByDate[selectedDate] ?? []
    const today = new Date().toISOString().slice(0, 10)

    return (
        <div className="flex flex-col h-full">
            <div className="bg-white dark:bg-surface-900 px-4 pt-3 pb-4 border-b border-surface-200 dark:border-surface-700">
                <button onClick={() => navigate('/tech')} className="flex items-center gap-1 text-sm text-brand-600 dark:text-brand-400 mb-2">
                    <ArrowLeft className="w-4 h-4" /> Voltar
                </button>
                <h1 className="text-lg font-bold text-surface-900 dark:text-surface-50">Minha Agenda</h1>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
                {/* Month navigation */}
                <div className="flex items-center justify-between bg-white dark:bg-surface-800/80 rounded-xl px-4 py-3">
                    <button
                        onClick={() => setCurrentDate(new Date(year, month - 1, 1))}
                        className="p-1.5 rounded-lg hover:bg-surface-100 dark:hover:bg-surface-700"
                    >
                        <ChevronLeft className="w-5 h-5 text-surface-600 dark:text-surface-400" />
                    </button>
                    <span className="text-sm font-semibold text-surface-900 dark:text-surface-50">
                        {MONTHS[month]} {year}
                    </span>
                    <button
                        onClick={() => setCurrentDate(new Date(year, month + 1, 1))}
                        className="p-1.5 rounded-lg hover:bg-surface-100 dark:hover:bg-surface-700"
                    >
                        <ChevronRight className="w-5 h-5 text-surface-600 dark:text-surface-400" />
                    </button>
                </div>

                {/* Route button */}
                <button
                    onClick={() => navigate('/tech/rota')}
                    className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-brand-50 dark:bg-brand-900/20 text-brand-600 dark:text-brand-400 text-xs font-medium active:scale-[0.98] transition-all"
                >
                    <Navigation className="w-4 h-4" /> Ver Rota Otimizada do Dia
                </button>

                {/* Calendar grid */}
                <div className="bg-white dark:bg-surface-800/80 rounded-xl p-3">
                    <div className="grid grid-cols-7 gap-1 mb-2">
                        {WEEKDAYS.map(d => (
                            <div key={d} className="text-center text-[10px] font-medium text-surface-400 uppercase py-1">
                                {d}
                            </div>
                        ))}
                    </div>
                    <div className="grid grid-cols-7 gap-1">
                        {calendarDays.map((day, idx) => {
                            if (day === null) return <div key={`empty-${idx}`} />
                            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
                            const dayOrders = wosByDate[dateStr] ?? []
                            const isSelected = dateStr === selectedDate
                            const isToday = dateStr === today

                            return (
                                <button
                                    key={dateStr}
                                    onClick={() => setSelectedDate(dateStr)}
                                    className={cn(
                                        'relative flex flex-col items-center py-1.5 rounded-lg text-xs transition-all',
                                        isSelected && 'bg-brand-600 text-white',
                                        !isSelected && isToday && 'bg-brand-50 dark:bg-brand-900/20 text-brand-600 dark:text-brand-400 font-bold',
                                        !isSelected && !isToday && 'text-surface-700 dark:text-surface-300 hover:bg-surface-50 dark:hover:bg-surface-700',
                                    )}
                                >
                                    <span className="font-medium">{day}</span>
                                    {dayOrders.length > 0 && (
                                        <div className="flex gap-0.5 mt-0.5">
                                            {dayOrders.slice(0, 3).map((wo, i) => (
                                                <span
                                                    key={i}
                                                    className={cn('w-1.5 h-1.5 rounded-full', isSelected ? 'bg-white/80' : STATUS_COLORS[wo.status] || 'bg-surface-400')}
                                                />
                                            ))}
                                        </div>
                                    )}
                                </button>
                            )
                        })}
                    </div>
                </div>

                {/* Day detail */}
                <div className="space-y-2">
                    <h3 className="text-xs font-semibold text-surface-400 uppercase tracking-wide">
                        {new Date(selectedDate + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
                        {selectedDayOrders.length > 0 && ` (${selectedDayOrders.length})`}
                    </h3>

                    {loading && selectedDayOrders.length === 0 ? (
                        <div className="flex justify-center py-8">
                            <Loader2 className="w-6 h-6 animate-spin text-brand-500" />
                        </div>
                    ) : selectedDayOrders.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-8 gap-2">
                            <Calendar className="w-10 h-10 text-surface-300" />
                            <p className="text-sm text-surface-500">Nenhuma OS agendada</p>
                        </div>
                    ) : (
                        selectedDayOrders.map(wo => (
                            <button
                                key={wo.id}
                                onClick={() => navigate(`/tech/os/${wo.id}`)}
                                className="w-full text-left bg-white dark:bg-surface-800/80 rounded-xl p-3 active:scale-[0.98] transition-transform"
                            >
                                <div className="flex items-start gap-3">
                                    <div className={cn('w-1 h-full min-h-[40px] rounded-full flex-shrink-0', STATUS_COLORS[wo.status] || 'bg-surface-400')} />
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <span className="text-sm font-semibold text-surface-900 dark:text-surface-50">
                                                {wo.os_number || wo.number}
                                            </span>
                                        </div>
                                        <p className="text-xs text-surface-500 truncate">{wo.customer_name}</p>
                                        {wo.description && <p className="text-xs text-surface-400 truncate mt-0.5">{wo.description}</p>}
                                        <div className="flex items-center gap-3 mt-1.5 text-[10px] text-surface-400">
                                            {wo.scheduled_time && (
                                                <span className="flex items-center gap-0.5">
                                                    <Clock className="w-3 h-3" /> {wo.scheduled_time.slice(0, 5)}
                                                </span>
                                            )}
                                            {wo.city && (
                                                <span className="flex items-center gap-0.5">
                                                    <MapPin className="w-3 h-3" /> {wo.city}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </button>
                        ))
                    )}
                </div>
            </div>
        </div>
    )
}
