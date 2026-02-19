import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { CalendarDays, ChevronLeft, ChevronRight, Clock, User } from 'lucide-react'
import api from '@/lib/api'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'

interface ScheduleEvent {
    id: number
    number: string
    os_number?: string
    business_number?: string
    status: string
    scheduled_at: string
    scheduled_end?: string
    customer?: { name: string }
    technicians?: { id: number; name: string }[]
    priority: string
    description?: string
}

const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
const MONTHS = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']

const priorityColors: Record<string, string> = {
    urgent: 'bg-red-500',
    high: 'bg-amber-500',
    normal: 'bg-brand-500',
    low: 'bg-surface-400',
}

const statusColors: Record<string, string> = {
    open: 'border-l-sky-500',
    in_progress: 'border-l-amber-500',
    completed: 'border-l-emerald-500',
    waiting_parts: 'border-l-orange-500',
    waiting_approval: 'border-l-violet-500',
    cancelled: 'border-l-red-400',
}

export default function ScheduleCalendar() {
    const qc = useQueryClient()
    const [currentDate, setCurrentDate] = useState(new Date())
    const [view, setView] = useState<'month' | 'week' | 'day'>('month')
    const [selectedEvent, setSelectedEvent] = useState<ScheduleEvent | null>(null)
    const [dragTarget, setDragTarget] = useState<{ id: number; date: string } | null>(null)

    const year = currentDate.getFullYear()
    const month = currentDate.getMonth()

    const { data: eventsRes } = useQuery({
        queryKey: ['os-schedule', year, month],
        queryFn: () => api.get('/work-orders', {
            params: {
                scheduled_from: new Date(year, month, 1).toISOString().slice(0, 10),
                scheduled_to: new Date(year, month + 1, 0).toISOString().slice(0, 10),
                per_page: 200,
                has_schedule: 1,
            }
        }),
    })
    const events: ScheduleEvent[] = eventsRes?.data?.data ?? []

    const rescheduleMut = useMutation({
        mutationFn: ({ id, date }: { id: number; date: string }) =>
            api.put(`/work-orders/${id}`, { scheduled_at: date }),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['os-schedule'] })
            toast.success('OS reagendada')
        },
        onError: () => toast.error('Erro ao reagendar'),
    })

    // Calendar grid
    const calendarDays = useMemo(() => {
        const firstDay = new Date(year, month, 1).getDay()
        const daysInMonth = new Date(year, month + 1, 0).getDate()
        const daysInPrevMonth = new Date(year, month, 0).getDate()

        const days: { date: Date; isCurrentMonth: boolean }[] = []

        for (let i = firstDay - 1; i >= 0; i--) {
            days.push({ date: new Date(year, month - 1, daysInPrevMonth - i), isCurrentMonth: false })
        }
        for (let i = 1; i <= daysInMonth; i++) {
            days.push({ date: new Date(year, month, i), isCurrentMonth: true })
        }
        const remaining = 42 - days.length
        for (let i = 1; i <= remaining; i++) {
            days.push({ date: new Date(year, month + 1, i), isCurrentMonth: false })
        }

        return days
    }, [year, month])

    const getEventsForDate = (date: Date) => {
        const dateStr = date.toISOString().slice(0, 10)
        return events.filter(e => e.scheduled_at?.startsWith(dateStr))
    }

    const today = new Date().toISOString().slice(0, 10)

    const prev = () => setCurrentDate(new Date(year, month - 1, 1))
    const next = () => setCurrentDate(new Date(year, month + 1, 1))
    const goToday = () => setCurrentDate(new Date())

    const handleDrop = (dateStr: string) => {
        if (dragTarget) {
            rescheduleMut.mutate({ id: dragTarget.id, date: dateStr })
            setDragTarget(null)
        }
    }

    const formatTime = (dt: string) =>
        new Date(dt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })

    const woId = (e: ScheduleEvent) => e.business_number ?? e.os_number ?? e.number

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <h2 className="text-lg font-bold text-surface-900">
                        {MONTHS[month]} {year}
                    </h2>
                    <div className="flex items-center gap-1">
                        <button onClick={prev} className="rounded-lg p-1.5 hover:bg-surface-100" aria-label="Mês anterior">
                            <ChevronLeft className="h-4 w-4" />
                        </button>
                        <button onClick={goToday} className="rounded-lg px-2 py-1 text-xs font-medium text-brand-600 hover:bg-brand-50">
                            Hoje
                        </button>
                        <button onClick={next} className="rounded-lg p-1.5 hover:bg-surface-100" aria-label="Próximo mês">
                            <ChevronRight className="h-4 w-4" />
                        </button>
                    </div>
                </div>

                <div className="flex rounded-lg border border-default overflow-hidden">
                    {(['month', 'week', 'day'] as const).map(v => (
                        <button
                            key={v}
                            onClick={() => setView(v)}
                            className={cn(
                                'px-3 py-1.5 text-xs font-medium transition-colors',
                                view === v ? 'bg-brand-500 text-white' : 'text-surface-600 hover:bg-surface-50'
                            )}
                        >
                            {v === 'month' ? 'Mês' : v === 'week' ? 'Semana' : 'Dia'}
                        </button>
                    ))}
                </div>
            </div>

            {/* Month view grid */}
            {view === 'month' && (
                <div className="rounded-xl border border-default bg-surface-0 shadow-card overflow-hidden">
                    {/* Weekday header */}
                    <div className="grid grid-cols-7 border-b border-subtle">
                        {WEEKDAYS.map(d => (
                            <div key={d} className="py-2 text-center text-[11px] font-semibold text-surface-500 uppercase tracking-wider">
                                {d}
                            </div>
                        ))}
                    </div>

                    {/* Days grid */}
                    <div className="grid grid-cols-7">
                        {calendarDays.map(({ date, isCurrentMonth }, idx) => {
                            const dateStr = date.toISOString().slice(0, 10)
                            const dayEvents = getEventsForDate(date)
                            const isToday = dateStr === today

                            return (
                                <div
                                    key={idx}
                                    className={cn(
                                        'min-h-[100px] border-b border-r border-subtle/50 p-1 transition-colors',
                                        !isCurrentMonth && 'bg-surface-50/50',
                                        isToday && 'bg-brand-50/30'
                                    )}
                                    onDragOver={e => e.preventDefault()}
                                    onDrop={() => handleDrop(dateStr)}
                                >
                                    <div className={cn(
                                        'text-xs font-medium mb-1 w-6 h-6 flex items-center justify-center rounded-full',
                                        isToday ? 'bg-brand-500 text-white' : isCurrentMonth ? 'text-surface-700' : 'text-surface-300'
                                    )}>
                                        {date.getDate()}
                                    </div>

                                    <div className="space-y-0.5">
                                        {dayEvents.slice(0, 3).map(evt => (
                                            <button
                                                key={evt.id}
                                                draggable
                                                onDragStart={() => setDragTarget({ id: evt.id, date: dateStr })}
                                                onClick={() => setSelectedEvent(evt)}
                                                className={cn(
                                                    'w-full text-left rounded px-1 py-0.5 text-[10px] truncate border-l-2 transition-colors hover:opacity-80',
                                                    statusColors[evt.status] ?? 'border-l-surface-300',
                                                    'bg-surface-100'
                                                )}
                                            >
                                                <span className={cn('inline-block w-1.5 h-1.5 rounded-full mr-1', priorityColors[evt.priority] ?? 'bg-brand-500')} />
                                                {formatTime(evt.scheduled_at)} {woId(evt)}
                                            </button>
                                        ))}
                                        {dayEvents.length > 3 && (
                                            <span className="text-[9px] text-surface-400 px-1">
                                                +{dayEvents.length - 3} mais
                                            </span>
                                        )}
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                </div>
            )}

            {/* Week view */}
            {view === 'week' && (
                <WeekView
                    currentDate={currentDate}
                    events={events}
                    onEventClick={setSelectedEvent}
                    formatTime={formatTime}
                    woId={woId}
                />
            )}

            {/* Day view */}
            {view === 'day' && (
                <DayView
                    currentDate={currentDate}
                    events={events}
                    onEventClick={setSelectedEvent}
                    formatTime={formatTime}
                    woId={woId}
                />
            )}

            {/* Event detail modal */}
            {selectedEvent && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setSelectedEvent(null)}>
                    <div className="w-full max-w-sm rounded-2xl bg-surface-0 p-5 shadow-lg" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center gap-2 mb-3">
                            <CalendarDays className="h-5 w-5 text-brand-500" />
                            <h3 className="text-base font-bold text-surface-900">{woId(selectedEvent)}</h3>
                            <span className={cn('ml-auto w-2 h-2 rounded-full', priorityColors[selectedEvent.priority])} />
                        </div>

                        {selectedEvent.customer && (
                            <p className="text-sm text-surface-600 flex items-center gap-1.5 mb-1">
                                <User className="h-3.5 w-3.5 text-surface-400" /> {selectedEvent.customer.name}
                            </p>
                        )}

                        <p className="text-sm text-surface-600 flex items-center gap-1.5 mb-1">
                            <Clock className="h-3.5 w-3.5 text-surface-400" /> {formatTime(selectedEvent.scheduled_at)}
                            {selectedEvent.scheduled_end && ` ~ ${formatTime(selectedEvent.scheduled_end)}`}
                        </p>

                        {selectedEvent.technicians && selectedEvent.technicians.length > 0 && (
                            <p className="text-sm text-surface-600 flex items-center gap-1.5 mb-2">
                                <User className="h-3.5 w-3.5 text-surface-400" />
                                {selectedEvent.technicians.map(t => t.name).join(', ')}
                            </p>
                        )}

                        {selectedEvent.description && (
                            <p className="text-xs text-surface-500 mt-2 border-t border-subtle pt-2">{selectedEvent.description}</p>
                        )}

                        <div className="mt-4 flex gap-2">
                            <Button size="sm" onClick={() => window.location.href = `/os/${selectedEvent!.id}`}>
                                Abrir OS
                            </Button>
                            <Button variant="outline" size="sm" onClick={() => setSelectedEvent(null)}>
                                Fechar
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

// Week View Component
function WeekView({ currentDate, events, onEventClick, formatTime, woId }: {
    currentDate: Date
    events: ScheduleEvent[]
    onEventClick: (e: ScheduleEvent) => void
    formatTime: (d: string) => string
    woId: (e: ScheduleEvent) => string
}) {
    const startOfWeek = new Date(currentDate)
    startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay())

    const weekDays = Array.from({ length: 7 }, (_, i) => {
        const d = new Date(startOfWeek)
        d.setDate(d.getDate() + i)
        return d
    })

    const today = new Date().toISOString().slice(0, 10)

    return (
        <div className="rounded-xl border border-default bg-surface-0 shadow-card overflow-hidden">
            <div className="grid grid-cols-7">
                {weekDays.map((day, idx) => {
                    const dateStr = day.toISOString().slice(0, 10)
                    const dayEvents = events.filter(e => e.scheduled_at?.startsWith(dateStr))
                    const isToday = dateStr === today

                    return (
                        <div key={idx} className={cn('border-r border-subtle/50 last:border-r-0', isToday && 'bg-brand-50/30')}>
                            <div className={cn('py-2 text-center border-b border-subtle', isToday && 'bg-brand-100/50')}>
                                <div className="text-[10px] uppercase text-surface-400">{WEEKDAYS[idx]}</div>
                                <div className={cn(
                                    'text-sm font-bold mt-0.5',
                                    isToday ? 'text-brand-600' : 'text-surface-700'
                                )}>
                                    {day.getDate()}
                                </div>
                            </div>
                            <div className="p-1 min-h-[200px] space-y-1">
                                {dayEvents.map(evt => (
                                    <button
                                        key={evt.id}
                                        onClick={() => onEventClick(evt)}
                                        className={cn(
                                            'w-full text-left rounded-lg px-2 py-1.5 text-[10px] border-l-2 bg-surface-50 hover:bg-surface-100 transition-colors',
                                            statusColors[evt.status] ?? 'border-l-surface-300'
                                        )}
                                    >
                                        <div className="font-medium text-surface-800">{formatTime(evt.scheduled_at)}</div>
                                        <div className="text-surface-500 truncate">{woId(evt)}</div>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )
                })}
            </div>
        </div>
    )
}

// Day View Component
function DayView({ currentDate, events, onEventClick, formatTime, woId }: {
    currentDate: Date
    events: ScheduleEvent[]
    onEventClick: (e: ScheduleEvent) => void
    formatTime: (d: string) => string
    woId: (e: ScheduleEvent) => string
}) {
    const dateStr = currentDate.toISOString().slice(0, 10)
    const dayEvents = events
        .filter(e => e.scheduled_at?.startsWith(dateStr))
        .sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at))

    const hours = Array.from({ length: 12 }, (_, i) => i + 7) // 07:00 - 18:00

    return (
        <div className="rounded-xl border border-default bg-surface-0 shadow-card overflow-hidden">
            <div className="p-3 border-b border-subtle text-center">
                <span className="text-sm font-bold text-surface-900">
                    {currentDate.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })}
                </span>
            </div>

            <div className="divide-y divide-subtle/50">
                {hours.map(hour => {
                    const hourEvents = dayEvents.filter(e => new Date(e.scheduled_at).getHours() === hour)
                    return (
                        <div key={hour} className="flex min-h-[60px]">
                            <div className="w-16 flex-shrink-0 py-2 pr-2 text-right text-xs text-surface-400 font-mono">
                                {String(hour).padStart(2, '0')}:00
                            </div>
                            <div className="flex-1 border-l border-subtle p-1 space-y-1">
                                {hourEvents.map(evt => (
                                    <button
                                        key={evt.id}
                                        onClick={() => onEventClick(evt)}
                                        className={cn(
                                            'w-full text-left rounded-lg px-3 py-2 border-l-2 bg-brand-50 hover:bg-brand-100 transition-colors',
                                            statusColors[evt.status] ?? 'border-l-brand-500'
                                        )}
                                    >
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs font-bold text-brand-700">{woId(evt)}</span>
                                            <span className="text-[10px] text-surface-500">{formatTime(evt.scheduled_at)}</span>
                                        </div>
                                        {evt.customer && (
                                            <div className="text-[10px] text-surface-500 mt-0.5">{evt.customer.name}</div>
                                        )}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )
                })}
            </div>
        </div>
    )
}
