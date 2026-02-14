import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
    ArrowLeft,
    Calendar,
    Clock,
    User,
    ChevronLeft,
    ChevronRight,
    MapPin,
    Phone,
    AlertTriangle,
    Zap,
    Filter,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import api from '@/lib/api'
import { SERVICE_CALL_STATUS } from '@/lib/constants'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

const statusLabels: Record<string, { label: string; variant: any; color: string }> = {
    [SERVICE_CALL_STATUS.OPEN]: { label: 'Aberto', variant: 'info', color: '#3b82f6' },
    [SERVICE_CALL_STATUS.SCHEDULED]: { label: 'Agendado', variant: 'warning', color: '#f59e0b' },
    [SERVICE_CALL_STATUS.IN_TRANSIT]: { label: 'Em Transito', variant: 'info', color: '#06b6d4' },
    [SERVICE_CALL_STATUS.IN_PROGRESS]: { label: 'Em Atendimento', variant: 'danger', color: '#f97316' },
    [SERVICE_CALL_STATUS.COMPLETED]: { label: 'Concluido', variant: 'success', color: '#22c55e' },
    [SERVICE_CALL_STATUS.CANCELLED]: { label: 'Cancelado', variant: 'default', color: '#6b7280' },
}

const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab']
const WEEKDAYS_FULL = ['Domingo', 'Segunda', 'Terca', 'Quarta', 'Quinta', 'Sexta', 'Sabado']

interface ServiceCallItem {
    id: number
    call_number: string
    status: string
    priority: string
    scheduled_date?: string | null
    city?: string | null
    address?: string | null
    customer?: { name?: string | null; phone?: string | null }
    technician?: { name?: string | null }
}

function formatDate(date: Date) {
    return date.toISOString().split('T')[0]
}

export function TechnicianAgendaPage() {
    const navigate = useNavigate()
    const [selectedTech, setSelectedTech] = useState<string>('')
    const [weekOffset, setWeekOffset] = useState(0)
    const [selectedDay, setSelectedDay] = useState<number | null>(null)

    const { data: assigneesRes } = useQuery({
        queryKey: ['service-call-assignees'],
        queryFn: () => api.get('/service-calls-assignees').then((r) => r.data),
    })

    const today = new Date()
    const startOfWeek = new Date(today)
    startOfWeek.setDate(today.getDate() - today.getDay() + 1 + weekOffset * 7)
    const weekDays = Array.from({ length: 7 }, (_, i) => {
        const date = new Date(startOfWeek)
        date.setDate(startOfWeek.getDate() + i)
        return date
    })

    const { data: agendaRes, isLoading } = useQuery({
        queryKey: ['service-calls-agenda', selectedTech, formatDate(weekDays[0]), formatDate(weekDays[6])],
        queryFn: () =>
            api
                .get('/service-calls/agenda', {
                    params: {
                        technician_id: selectedTech || undefined,
                        date_from: formatDate(weekDays[0]),
                        date_to: formatDate(weekDays[6]),
                    },
                })
                .then((r) => r.data),
    })

    const technicians = assigneesRes?.technicians ?? []
    const calls: ServiceCallItem[] = agendaRes ?? []

    const getCallsForDay = (date: Date) => {
        const dateStr = formatDate(date)
        return calls.filter((call) => call.scheduled_date?.startsWith(dateStr))
    }

    const isToday = (date: Date) => formatDate(date) === formatDate(today)

    const stats = useMemo(() => {
        const summary = { total: calls.length, pending: 0, completed: 0, urgent: 0 }

        for (const call of calls) {
            if ([SERVICE_CALL_STATUS.OPEN, SERVICE_CALL_STATUS.SCHEDULED, SERVICE_CALL_STATUS.IN_TRANSIT, SERVICE_CALL_STATUS.IN_PROGRESS].includes(call.status as any)) {
                summary.pending += 1
            }
            if (call.status === SERVICE_CALL_STATUS.COMPLETED) {
                summary.completed += 1
            }
            if (call.priority === 'urgent') {
                summary.urgent += 1
            }
        }

        return summary
    }, [calls])

    const expandedDayIndex = selectedDay

    return (
        <div className="space-y-5">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <button onClick={() => navigate('/chamados')} className="rounded-lg p-1.5 hover:bg-surface-100 dark:hover:bg-surface-800">
                        <ArrowLeft className="h-5 w-5 text-surface-500" />
                    </button>
                    <div>
                        <h1 className="text-lg font-semibold tracking-tight text-surface-900 dark:text-white">Agenda de Tecnicos</h1>
                        <p className="text-[13px] text-surface-500">Visao semanal de chamados agendados</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    {stats.urgent > 0 && (
                        <div className="hidden items-center gap-1 rounded-lg bg-red-50 px-2 py-1 text-[11px] font-medium text-red-600 dark:bg-red-900/20 md:flex">
                            <Zap className="w-3 h-3" /> {stats.urgent} urgente{stats.urgent > 1 ? 's' : ''}
                        </div>
                    )}
                    <select
                        value={selectedTech}
                        onChange={(event) => setSelectedTech(event.target.value)}
                        className="rounded-lg border border-surface-200 bg-surface-50 px-3 py-2 text-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-500/15 dark:border-surface-600 dark:bg-surface-800"
                    >
                        <option value="">Todos os tecnicos</option>
                        {technicians.map((technician: any) => (
                            <option key={technician.id} value={technician.id}>
                                {technician.name}
                            </option>
                        ))}
                    </select>
                </div>
            </div>

            <div className="flex items-center justify-between rounded-xl border border-surface-200 bg-surface-0 px-4 py-3 shadow-card dark:border-surface-700 dark:bg-surface-900">
                <Button variant="ghost" size="sm" onClick={() => { setWeekOffset((week) => week - 1); setSelectedDay(null) }}>
                    <ChevronLeft className="h-4 w-4" />
                </Button>
                <div className="text-center">
                    <p className="text-sm font-semibold text-surface-900 dark:text-white">
                        {weekDays[0].toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })} - {weekDays[6].toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </p>
                    {weekOffset !== 0 && (
                        <button onClick={() => { setWeekOffset(0); setSelectedDay(null) }} className="text-xs text-brand-600 hover:underline">
                            Ir para hoje
                        </button>
                    )}
                </div>
                <Button variant="ghost" size="sm" onClick={() => { setWeekOffset((week) => week + 1); setSelectedDay(null) }}>
                    <ChevronRight className="h-4 w-4" />
                </Button>
            </div>

            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                {[
                    { label: 'Total na Semana', value: stats.total, color: 'text-brand-600', bg: 'bg-brand-50 dark:bg-brand-900/20' },
                    { label: 'Pendentes', value: stats.pending, color: 'text-amber-600', bg: 'bg-amber-50 dark:bg-amber-900/20' },
                    { label: 'Concluidos', value: stats.completed, color: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-900/20' },
                    { label: 'Urgentes', value: stats.urgent, color: 'text-red-600', bg: 'bg-red-50 dark:bg-red-900/20' },
                ].map((item) => (
                    <div key={item.label} className={`rounded-xl border border-surface-200 px-4 py-3 shadow-card dark:border-surface-700 ${item.bg}`}>
                        <p className={`text-2xl font-bold ${item.color}`}>{item.value}</p>
                        <p className="text-[11px] text-surface-500">{item.label}</p>
                    </div>
                ))}
            </div>

            {isLoading ? (
                <div className="grid grid-cols-7 gap-2">
                    {Array.from({ length: 7 }).map((_, index) => (
                        <div key={index} className="min-h-[160px] animate-pulse rounded-xl border border-surface-200 bg-surface-0 p-3 dark:border-surface-700 dark:bg-surface-900" />
                    ))}
                </div>
            ) : (
                <div className="grid grid-cols-7 gap-2">
                    {weekDays.map((day, index) => {
                        const dayCalls = getCallsForDay(day)
                        const isTodayDay = isToday(day)
                        const isExpanded = expandedDayIndex === index
                        const hasUrgent = dayCalls.some((call) => call.priority === 'urgent')

                        return (
                            <div
                                key={index}
                                onClick={() => setSelectedDay(isExpanded ? null : index)}
                                className={`min-h-[160px] cursor-pointer rounded-xl border p-3 shadow-card transition-all ${isTodayDay
                                        ? 'border-brand-400 bg-brand-50/30 ring-1 ring-brand-200 dark:bg-brand-900/10 dark:ring-brand-800'
                                        : isExpanded
                                            ? 'border-brand-300 bg-surface-0 ring-1 ring-brand-100 dark:bg-surface-900'
                                            : 'border-surface-200 bg-surface-0 hover:border-surface-300 dark:border-surface-700 dark:bg-surface-900 dark:hover:border-surface-600'
                                    }`}
                            >
                                <div className="mb-2 text-center">
                                    <p className="text-[10px] font-medium uppercase tracking-wider text-surface-400">{WEEKDAYS[day.getDay()]}</p>
                                    <p className={`text-[16px] font-bold tabular-nums ${isTodayDay ? 'text-brand-600' : 'text-surface-900 dark:text-white'}`}>
                                        {day.getDate()}
                                    </p>
                                    {dayCalls.length > 0 && (
                                        <div className="mt-0.5 flex items-center justify-center gap-1">
                                            <span className="text-[10px] text-surface-500">{dayCalls.length} item{dayCalls.length > 1 ? 's' : ''}</span>
                                            {hasUrgent && <AlertTriangle className="h-2.5 w-2.5 text-red-500" />}
                                        </div>
                                    )}
                                </div>

                                <div className="space-y-1.5">
                                    {dayCalls.length === 0 ? (
                                        <p className="py-3 text-center text-[10px] text-surface-300 dark:text-surface-600">-</p>
                                    ) : (
                                        dayCalls.map((call) => {
                                            const status = statusLabels[call.status] ?? statusLabels[SERVICE_CALL_STATUS.OPEN]

                                            return (
                                                <div
                                                    key={call.id}
                                                    className="group cursor-pointer rounded-lg border border-surface-100 bg-surface-50 p-1.5 transition-colors hover:bg-surface-100 dark:border-surface-700/50 dark:bg-surface-800/40 dark:hover:bg-surface-800"
                                                    onClick={(event) => {
                                                        event.stopPropagation()
                                                        navigate(`/chamados/${call.id}`)
                                                    }}
                                                    title={`${call.customer?.name ?? '-'} - ${status.label}`}
                                                >
                                                    <div className="mb-0.5 flex items-center gap-1">
                                                        <span className="h-1.5 w-1.5 flex-shrink-0 rounded-full" style={{ background: status.color }} />
                                                        <Badge variant={status.variant} className="px-1 py-0 text-[7px] leading-tight">{status.label}</Badge>
                                                        {call.priority === 'urgent' && <AlertTriangle className="ml-auto h-2.5 w-2.5 flex-shrink-0 text-red-500" />}
                                                    </div>

                                                    <p className="truncate text-[10px] font-medium text-surface-700 dark:text-surface-300">
                                                        {call.customer?.name ?? '-'}
                                                    </p>

                                                    {call.technician?.name && (
                                                        <p className="mt-0.5 flex items-center gap-0.5 text-[8px] text-surface-400">
                                                            <User className="h-2 w-2 flex-shrink-0" />
                                                            <span className="truncate">{call.technician.name}</span>
                                                        </p>
                                                    )}

                                                    {call.scheduled_date && (
                                                        <p className="flex items-center gap-0.5 text-[8px] text-surface-400">
                                                            <Clock className="h-2 w-2 flex-shrink-0" />
                                                            {new Date(call.scheduled_date).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                                                        </p>
                                                    )}
                                                </div>
                                            )
                                        })
                                    )}
                                </div>
                            </div>
                        )
                    })}
                </div>
            )}

            {expandedDayIndex !== null && (
                <div className="rounded-xl border border-brand-200 bg-surface-0 p-4 shadow-card dark:border-brand-800 dark:bg-surface-900">
                    <div className="mb-3 flex items-center justify-between">
                        <h2 className="text-sm font-semibold text-surface-900 dark:text-white">
                            <Calendar className="mr-1 inline h-4 w-4" />
                            {WEEKDAYS_FULL[weekDays[expandedDayIndex].getDay()]}, {weekDays[expandedDayIndex].toLocaleDateString('pt-BR', { day: '2-digit', month: 'long' })}
                        </h2>
                        <button onClick={() => setSelectedDay(null)} className="text-xs text-surface-500 hover:text-surface-700">Fechar</button>
                    </div>
                    {(() => {
                        const dayCalls = getCallsForDay(weekDays[expandedDayIndex])
                        if (dayCalls.length === 0) {
                            return (
                                <div className="flex flex-col items-center py-6 text-surface-400">
                                    <Filter className="mb-2 h-8 w-8 opacity-30" />
                                    <p className="text-[12px]">Nenhum item neste dia</p>
                                </div>
                            )
                        }

                        return (
                            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                                {dayCalls.map((call) => {
                                    const status = statusLabels[call.status] ?? statusLabels[SERVICE_CALL_STATUS.OPEN]
                                    return (
                                        <div
                                            key={`detail-${call.id}`}
                                            className="cursor-pointer rounded-lg border border-surface-200 p-3 transition-shadow hover:shadow-md dark:border-surface-700"
                                            onClick={() => navigate(`/chamados/${call.id}`)}
                                        >
                                            <div className="mb-2 flex items-center justify-between">
                                                <span className="text-[10px] font-mono text-surface-400">{call.call_number}</span>
                                                <Badge variant={status.variant} className="text-[10px]">{status.label}</Badge>
                                            </div>
                                            <p className="truncate text-[13px] font-semibold text-surface-900 dark:text-white">
                                                {call.customer?.name || '-'}
                                            </p>
                                            <div className="mt-2 space-y-1 text-[11px] text-surface-500">
                                                {call.technician?.name && (
                                                    <p className="flex items-center gap-1"><User className="h-3 w-3" />{call.technician.name}</p>
                                                )}
                                                {call.scheduled_date && (
                                                    <p className="flex items-center gap-1"><Clock className="h-3 w-3" />{new Date(call.scheduled_date).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</p>
                                                )}
                                                {call.customer?.phone && (
                                                    <p className="flex items-center gap-1"><Phone className="h-3 w-3" />{call.customer.phone}</p>
                                                )}
                                                {(call.city || call.address) && (
                                                    <p className="flex items-center gap-1"><MapPin className="h-3 w-3" />{call.city || call.address}</p>
                                                )}
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        )
                    })()}
                </div>
            )}
        </div>
    )
}
