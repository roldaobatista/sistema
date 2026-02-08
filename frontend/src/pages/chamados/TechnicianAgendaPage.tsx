import React, { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, Calendar, Clock, User, ChevronLeft, ChevronRight } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import api from '@/lib/api'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'

const statusLabels: Record<string, { label: string; variant: any }> = {
    open: { label: 'Aberto', variant: 'info' },
    scheduled: { label: 'Agendado', variant: 'warning' },
    en_route: { label: 'A Caminho', variant: 'brand' },
    in_progress: { label: 'Em Atend.', variant: 'danger' },
    completed: { label: 'Concluído', variant: 'success' },
    cancelled: { label: 'Cancelado', variant: 'default' },
}

const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab']

function formatDate(d: Date) {
    return d.toISOString().split('T')[0]
}

export function TechnicianAgendaPage() {
    const navigate = useNavigate()
    const [selectedTech, setSelectedTech] = useState<string>('')
    const [weekOffset, setWeekOffset] = useState(0)

    const { data: techsRes } = useQuery({
        queryKey: ['technicians'],
        queryFn: () => api.get('/users', { params: { per_page: 50 } }),
    })

    const today = new Date()
    const startOfWeek = new Date(today)
    startOfWeek.setDate(today.getDate() - today.getDay() + 1 + weekOffset * 7) // Monday
    const weekDays = Array.from({ length: 7 }, (_, i) => {
        const d = new Date(startOfWeek)
        d.setDate(startOfWeek.getDate() + i)
        return d
    })

    const { data: agendaRes, isLoading } = useQuery({
        queryKey: ['agenda', selectedTech, formatDate(weekDays[0]), formatDate(weekDays[6])],
        queryFn: () => api.get('/service-calls/agenda', {
            params: {
                technician_id: selectedTech || undefined,
                date_from: formatDate(weekDays[0]),
                date_to: formatDate(weekDays[6]),
            },
        }),
        enabled: true,
    })

    const technicians = techsRes?.data?.data ?? []
    const calls: any[] = agendaRes?.data ?? []

    const getCallsForDay = (date: Date) => {
        const dateStr = formatDate(date)
        return calls.filter((c: any) => c.scheduled_date === dateStr || c.created_at?.startsWith(dateStr))
    }

    const isToday = (d: Date) => formatDate(d) === formatDate(today)

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <button onClick={() => navigate('/chamados')} className="rounded-lg p-1.5 hover:bg-surface-100">
                        <ArrowLeft className="h-5 w-5 text-surface-500" />
                    </button>
                    <div>
                        <h1 className="text-2xl font-bold text-surface-900">Agenda de Técnicos</h1>
                        <p className="text-sm text-surface-500">Chamados agendados por semana</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <select value={selectedTech} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setSelectedTech(e.target.value)}
                        className="rounded-lg border border-surface-300 bg-white px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20">
                        <option value="">Todos os técnicos</option>
                        {technicians.map((t: any) => <option key={t.id} value={t.id}>{t.name}</option>)}
                    </select>
                </div>
            </div>

            {/* Week navigation */}
            <div className="flex items-center justify-between rounded-xl border border-surface-200 bg-white px-4 py-3 shadow-card">
                <Button variant="ghost" size="sm" onClick={() => setWeekOffset(w => w - 1)}>
                    <ChevronLeft className="h-4 w-4" />
                </Button>
                <div className="text-center">
                    <p className="text-sm font-semibold text-surface-900">
                        {weekDays[0].toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })} — {weekDays[6].toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </p>
                    {weekOffset !== 0 && (
                        <button onClick={() => setWeekOffset(0)} className="text-xs text-brand-600 hover:underline">Ir para hoje</button>
                    )}
                </div>
                <Button variant="ghost" size="sm" onClick={() => setWeekOffset(w => w + 1)}>
                    <ChevronRight className="h-4 w-4" />
                </Button>
            </div>

            {/* Calendar grid */}
            {isLoading ? (
                <div className="py-16 text-center text-sm text-surface-500">Carregando agenda...</div>
            ) : (
                <div className="grid grid-cols-7 gap-2">
                    {weekDays.map((day, i) => {
                        const dayCalls = getCallsForDay(day)
                        return (
                            <div key={i} className={`rounded-xl border bg-white p-3 min-h-[140px] shadow-card transition-colors ${isToday(day) ? 'border-brand-400 bg-brand-50/30' : 'border-surface-200'}`}>
                                <div className="mb-2 text-center">
                                    <p className="text-[10px] font-medium uppercase text-surface-400">{WEEKDAYS[day.getDay()]}</p>
                                    <p className={`text-lg font-bold ${isToday(day) ? 'text-brand-600' : 'text-surface-900'}`}>{day.getDate()}</p>
                                </div>
                                <div className="space-y-1.5">
                                    {dayCalls.length === 0 ? (
                                        <p className="py-2 text-center text-[10px] text-surface-300">—</p>
                                    ) : dayCalls.map((call: any) => {
                                        const st = statusLabels[call.status] ?? statusLabels.open
                                        return (
                                            <div key={call.id} className="rounded-md border border-surface-100 bg-surface-50 p-1.5 hover:bg-surface-100 cursor-pointer transition-colors"
                                                title={`${call.call_number} — ${call.customer?.name}`}>
                                                <div className="flex items-center gap-1">
                                                    <Badge variant={st.variant} className="text-[8px] px-1 py-0">{st.label}</Badge>
                                                </div>
                                                <p className="text-[10px] font-medium text-surface-700 mt-0.5 truncate">{call.customer?.name}</p>
                                                {call.technician && (
                                                    <p className="text-[9px] text-surface-400 flex items-center gap-0.5 mt-0.5">
                                                        <User className="h-2 w-2" />{call.technician.name}
                                                    </p>
                                                )}
                                                {call.scheduled_time && (
                                                    <p className="text-[9px] text-surface-400 flex items-center gap-0.5">
                                                        <Clock className="h-2 w-2" />{call.scheduled_time}
                                                    </p>
                                                )}
                                            </div>
                                        )
                                    })}
                                </div>
                            </div>
                        )
                    })}
                </div>
            )}

            {/* Summary */}
            <div className="grid gap-4 sm:grid-cols-3">
                <div className="rounded-xl border border-surface-200 bg-white p-4 shadow-card text-center">
                    <p className="text-2xl font-bold text-brand-600">{calls.length}</p>
                    <p className="text-xs text-surface-500">Chamados na semana</p>
                </div>
                <div className="rounded-xl border border-surface-200 bg-white p-4 shadow-card text-center">
                    <p className="text-2xl font-bold text-amber-600">{calls.filter((c: any) => ['open', 'scheduled', 'en_route'].includes(c.status)).length}</p>
                    <p className="text-xs text-surface-500">Pendentes</p>
                </div>
                <div className="rounded-xl border border-surface-200 bg-white p-4 shadow-card text-center">
                    <p className="text-2xl font-bold text-emerald-600">{calls.filter((c: any) => c.status === 'completed').length}</p>
                    <p className="text-xs text-surface-500">Concluídos</p>
                </div>
            </div>
        </div>
    )
}
