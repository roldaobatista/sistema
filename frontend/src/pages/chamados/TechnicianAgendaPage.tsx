import React, { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, Calendar, Clock, User, ChevronLeft, ChevronRight } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import api from '@/lib/api'
import { SERVICE_CALL_STATUS } from '@/lib/constants'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'

const statusLabels: Record<string, { label: string; variant: any }> = {
    [SERVICE_CALL_STATUS.OPEN]: { label: 'Aberto', variant: 'info' },
    [SERVICE_CALL_STATUS.SCHEDULED]: { label: 'Agendado', variant: 'warning' },
    [SERVICE_CALL_STATUS.IN_TRANSIT]: { label: 'Em Deslocamento', variant: 'info' },
    [SERVICE_CALL_STATUS.IN_PROGRESS]: { label: 'Em Atendimento', variant: 'danger' },
    [SERVICE_CALL_STATUS.COMPLETED]: { label: 'Concluído', variant: 'success' },
    [SERVICE_CALL_STATUS.CANCELLED]: { label: 'Cancelado', variant: 'default' },
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
        queryKey: ['technicians-agenda'],
        queryFn: () => api.get('/users/by-role/tecnico'),
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
        queryFn: () => api.get('/schedules-unified', {
            params: {
                technician_id: selectedTech || undefined,
                from: formatDate(weekDays[0]),
                to: formatDate(weekDays[6]),
            },
        }),
        enabled: true,
    })

    const technicians = techsRes?.data ?? []
    // O endpoint unificado retorna { data: [...], meta: ... }
    const calls: any[] = agendaRes?.data?.data ?? []

    const getCallsForDay = (date: Date) => {
        const dateStr = formatDate(date)
        return calls.filter((c: any) => c.start?.startsWith(dateStr) || c.scheduled_date?.startsWith(dateStr))
    }

    const isToday = (d: Date) => formatDate(d) === formatDate(today)

    return (
        <div className="space-y-5">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <button onClick={() => navigate('/chamados')} className="rounded-lg p-1.5 hover:bg-surface-100">
                        <ArrowLeft className="h-5 w-5 text-surface-500" />
                    </button>
                    <div>
                        <h1 className="text-lg font-semibold text-surface-900 tracking-tight">Agenda de Técnicos</h1>
                        <p className="text-[13px] text-surface-500">Chamados agendados por semana</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <select value={selectedTech} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setSelectedTech(e.target.value)}
                        className="rounded-lg border border-default bg-surface-50 px-3 py-2 text-sm focus:border-brand-400 focus:bg-surface-0 focus:outline-none focus:ring-2 focus:ring-brand-500/15">
                        <option value="">Todos os técnicos</option>
                        {technicians.map((t: any) => <option key={t.id} value={t.id}>{t.name}</option>)}
                    </select>
                </div>
            </div>

            {/* Week navigation */}
            <div className="flex items-center justify-between rounded-xl border border-default bg-surface-0 px-4 py-3 shadow-card">
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
                <div className="py-16 text-center text-[13px] text-surface-500">Carregando agenda...</div>
            ) : (
                <div className="grid grid-cols-7 gap-2">
                    {weekDays.map((day, i) => {
                        const dayCalls = getCallsForDay(day)
                        return (
                            <div key={i} className={`rounded-xl border bg-white p-3 min-h-[140px] shadow-card transition-colors ${isToday(day) ? 'border-brand-400 bg-brand-50/30' : 'border-surface-200'}`}>
                                <div className="mb-2 text-center">
                                    <p className="text-[10px] font-medium uppercase text-surface-400">{WEEKDAYS[day.getDay()]}</p>
                                    <p className={`text-[15px] font-semibold tabular-nums ${isToday(day) ? 'text-brand-600' : 'text-surface-900'}`}>{day.getDate()}</p>
                                </div>
                                <div className="space-y-1.5">
                                    {dayCalls.length === 0 ? (
                                        <p className="py-2 text-center text-[10px] text-surface-300">—</p>
                                    ) : dayCalls.map((call: any) => {
                                        const isCall = call.source === 'service_call'
                                        const isCrm = call.source === 'crm'

                                        // Status mapping
                                        let variant = 'default'
                                        let label = call.status

                                        if (isCall) {
                                            const st = statusLabels[call.status] ?? statusLabels['open']
                                            variant = st?.variant ?? 'default'
                                            label = st?.label ?? call.status
                                        } else if (isCrm) {
                                            variant = 'brand'
                                            label = call.crm_type === 'meeting' ? 'Reunião' : 'Tarefa'
                                        } else {
                                            // Schedule normal
                                            if (call.status === 'confirmed') variant = 'brand'
                                            else if (call.status === 'completed') variant = 'success'
                                            else if (call.status === 'cancelled') variant = 'default'
                                            else variant = 'info'
                                        }

                                        return (
                                            <div key={call.id} className="rounded-md border border-surface-100 bg-surface-50 p-1.5 hover:bg-surface-100 cursor-pointer transition-colors"
                                                title={`${call.title} — ${call.customer?.name ?? 'Sem cliente'}`}>
                                                <div className="flex items-center gap-1">
                                                    <Badge variant={variant as any} className="text-[8px] px-1 py-0">{label}</Badge>
                                                    {isCrm && <span className="text-[8px] text-surface-400">CRM</span>}
                                                </div>
                                                <p className="text-[10px] font-medium text-surface-700 mt-0.5 truncate">{call.customer?.name ?? call.title}</p>
                                                {call.technician && (
                                                    <p className="text-[9px] text-surface-400 flex items-center gap-0.5 mt-0.5">
                                                        <User className="h-2 w-2" />{call.technician.name}
                                                    </p>
                                                )}
                                                {call.start && (
                                                    <p className="text-[9px] text-surface-400 flex items-center gap-0.5">
                                                        <Clock className="h-2 w-2" />{call.start.substring(11, 16)}
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
                <div className="rounded-xl border border-default bg-surface-0 p-4 shadow-card text-center">
                    <p className="text-2xl font-bold text-brand-600">{calls.length}</p>
                    <p className="text-xs text-surface-500">Itens na semana</p>
                </div>
                <div className="rounded-xl border border-default bg-surface-0 p-4 shadow-card text-center">
                    <p className="text-2xl font-bold text-amber-600">{calls.filter((c: any) => {
                        if (c.source === 'service_call') return [SERVICE_CALL_STATUS.OPEN, SERVICE_CALL_STATUS.SCHEDULED, SERVICE_CALL_STATUS.IN_TRANSIT].includes(c.status)
                        if (c.source === 'schedule') return ['pending', 'confirmed'].includes(c.status)
                        return true // CRM activities are pending by default
                    }).length}</p>
                    <p className="text-xs text-surface-500">Pendentes</p>
                </div>
                <div className="rounded-xl border border-default bg-surface-0 p-4 shadow-card text-center">
                    <p className="text-2xl font-bold text-emerald-600">{calls.filter((c: any) => {
                        if (c.source === 'service_call') return c.status === SERVICE_CALL_STATUS.COMPLETED
                        if (c.source === 'schedule') return c.status === 'completed'
                        return false
                    }).length}</p>
                    <p className="text-xs text-surface-500">Concluídos</p>
                </div>
            </div>
        </div>
    )
}
