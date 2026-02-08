import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import {
    ChevronLeft, ChevronRight, Calendar, AlertTriangle,
    Clock, CheckCircle2, Scale, Eye
} from 'lucide-react'
import api from '@/lib/api'
import { cn } from '@/lib/utils'

interface Alert {
    id: number
    code: string
    brand: string | null
    model: string | null
    serial_number: string | null
    customer: string | null
    next_calibration_at: string
    days_remaining: number
    status: string
}

const statusConfig: Record<string, { bg: string; text: string; icon: any; label: string }> = {
    vencida: { bg: 'bg-red-100 border-red-300', text: 'text-red-700', icon: AlertTriangle, label: 'Vencida' },
    vence_em_breve: { bg: 'bg-amber-100 border-amber-300', text: 'text-amber-700', icon: Clock, label: 'Vencendo' },
    em_dia: { bg: 'bg-emerald-100 border-emerald-300', text: 'text-emerald-700', icon: CheckCircle2, label: 'Em dia' },
}

export default function EquipmentCalendarPage() {
    const [currentDate, setCurrentDate] = useState(new Date())

    const { data } = useQuery({
        queryKey: ['equipments-alerts'],
        queryFn: () => api.get('/equipments-alerts').then(r => r.data),
    })

    const alerts: Alert[] = data?.alerts ?? []

    const year = currentDate.getFullYear()
    const month = currentDate.getMonth()

    const daysInMonth = new Date(year, month + 1, 0).getDate()
    const firstDayOfWeek = new Date(year, month, 1).getDay()

    const monthName = currentDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })

    const alertsByDay = useMemo(() => {
        const map: Record<number, Alert[]> = {}
        alerts.forEach(a => {
            const d = new Date(a.next_calibration_at)
            if (d.getFullYear() === year && d.getMonth() === month) {
                const day = d.getDate()
                if (!map[day]) map[day] = []
                map[day].push(a)
            }
        })
        return map
    }, [alerts, year, month])

    const prev = () => setCurrentDate(new Date(year, month - 1, 1))
    const next = () => setCurrentDate(new Date(year, month + 1, 1))
    const today = () => setCurrentDate(new Date())

    const todayDay = new Date().getDate()
    const isCurrentMonth = new Date().getFullYear() === year && new Date().getMonth() === month

    // Grouped list for sidebar
    const overdueAlerts = alerts.filter(a => a.days_remaining < 0)
    const upcomingAlerts = alerts.filter(a => a.days_remaining >= 0 && a.days_remaining <= 30)

    const weekDays = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-surface-900">Agenda de Calibrações</h1>
                    <p className="text-sm text-surface-500">Visualize os vencimentos de calibração por mês</p>
                </div>
                <Link
                    to="/equipamentos"
                    className="flex items-center gap-2 rounded-lg border border-surface-200 px-4 py-2.5 text-sm font-medium text-surface-700 hover:bg-surface-50"
                >
                    <Scale size={16} />
                    Ver Equipamentos
                </Link>
            </div>

            <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
                {/* Calendar */}
                <div className="xl:col-span-2 rounded-xl border border-surface-200 bg-white p-5 shadow-card">
                    {/* Month nav */}
                    <div className="mb-4 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <Calendar size={20} className="text-brand-500" />
                            <h2 className="text-lg font-semibold text-surface-900 capitalize">{monthName}</h2>
                        </div>
                        <div className="flex items-center gap-1">
                            <button onClick={today} className="rounded-lg border border-surface-200 px-3 py-1.5 text-xs font-medium text-surface-600 hover:bg-surface-50">
                                Hoje
                            </button>
                            <button onClick={prev} className="rounded-lg p-1.5 text-surface-400 hover:bg-surface-100">
                                <ChevronLeft size={18} />
                            </button>
                            <button onClick={next} className="rounded-lg p-1.5 text-surface-400 hover:bg-surface-100">
                                <ChevronRight size={18} />
                            </button>
                        </div>
                    </div>

                    {/* Week headers */}
                    <div className="grid grid-cols-7 mb-1">
                        {weekDays.map(d => (
                            <div key={d} className="py-2 text-center text-xs font-semibold text-surface-500">{d}</div>
                        ))}
                    </div>

                    {/* Day cells */}
                    <div className="grid grid-cols-7 gap-px rounded-lg bg-surface-200 overflow-hidden border border-surface-200">
                        {/* Empty cells before first day */}
                        {Array.from({ length: firstDayOfWeek }).map((_, i) => (
                            <div key={`empty-${i}`} className="min-h-[90px] bg-surface-50 p-1.5" />
                        ))}

                        {/* Day cells */}
                        {Array.from({ length: daysInMonth }).map((_, i) => {
                            const day = i + 1
                            const dayAlerts = alertsByDay[day] || []
                            const isToday = isCurrentMonth && day === todayDay

                            return (
                                <div
                                    key={day}
                                    className={cn(
                                        'min-h-[90px] bg-white p-1.5 transition-colors',
                                        isToday && 'bg-brand-50/40'
                                    )}
                                >
                                    <span className={cn(
                                        'inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium',
                                        isToday ? 'bg-brand-600 text-white' : 'text-surface-700'
                                    )}>
                                        {day}
                                    </span>
                                    <div className="mt-0.5 space-y-0.5">
                                        {dayAlerts.slice(0, 3).map(a => {
                                            const cfg = statusConfig[a.status] || statusConfig.em_dia
                                            return (
                                                <Link
                                                    key={a.id}
                                                    to={`/equipamentos/${a.id}`}
                                                    className={cn(
                                                        'block truncate rounded px-1 py-0.5 text-[10px] font-medium border',
                                                        cfg.bg, cfg.text
                                                    )}
                                                    title={`${a.code} - ${a.brand} ${a.model}`}
                                                >
                                                    {a.code}
                                                </Link>
                                            )
                                        })}
                                        {dayAlerts.length > 3 && (
                                            <span className="text-[10px] text-surface-400 pl-1">
                                                +{dayAlerts.length - 3} mais
                                            </span>
                                        )}
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                </div>

                {/* Sidebar: Alerts */}
                <div className="space-y-4">
                    {/* Overdue */}
                    <div className="rounded-xl border border-red-200 bg-white p-4 shadow-card">
                        <div className="mb-3 flex items-center gap-2">
                            <AlertTriangle size={16} className="text-red-600" />
                            <h3 className="text-sm font-semibold text-red-700">
                                Vencidas ({overdueAlerts.length})
                            </h3>
                        </div>
                        {overdueAlerts.length === 0 ? (
                            <p className="text-xs text-surface-400">Nenhum equipamento vencido 🎉</p>
                        ) : (
                            <div className="space-y-2">
                                {overdueAlerts.slice(0, 8).map(a => (
                                    <Link
                                        key={a.id}
                                        to={`/equipamentos/${a.id}`}
                                        className="flex items-center justify-between rounded-lg border border-red-100 bg-red-50 p-2 text-xs hover:bg-red-100 transition-colors"
                                    >
                                        <div>
                                            <span className="font-mono font-semibold text-red-700">{a.code}</span>
                                            <span className="ml-1.5 text-red-600">{a.brand} {a.model}</span>
                                        </div>
                                        <span className="rounded-full bg-red-200 px-2 py-0.5 text-[10px] font-bold text-red-800">
                                            {Math.abs(a.days_remaining)}d atrás
                                        </span>
                                    </Link>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Upcoming */}
                    <div className="rounded-xl border border-amber-200 bg-white p-4 shadow-card">
                        <div className="mb-3 flex items-center gap-2">
                            <Clock size={16} className="text-amber-600" />
                            <h3 className="text-sm font-semibold text-amber-700">
                                Próximas 30 dias ({upcomingAlerts.length})
                            </h3>
                        </div>
                        {upcomingAlerts.length === 0 ? (
                            <p className="text-xs text-surface-400">Nenhuma calibração nos próximos 30 dias</p>
                        ) : (
                            <div className="space-y-2">
                                {upcomingAlerts.slice(0, 8).map(a => (
                                    <Link
                                        key={a.id}
                                        to={`/equipamentos/${a.id}`}
                                        className="flex items-center justify-between rounded-lg border border-amber-100 bg-amber-50 p-2 text-xs hover:bg-amber-100 transition-colors"
                                    >
                                        <div>
                                            <span className="font-mono font-semibold text-amber-700">{a.code}</span>
                                            <span className="ml-1.5 text-amber-600">{a.brand} {a.model}</span>
                                        </div>
                                        <span className="rounded-full bg-amber-200 px-2 py-0.5 text-[10px] font-bold text-amber-800">
                                            {a.days_remaining}d
                                        </span>
                                    </Link>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Summary */}
                    <div className="rounded-xl border border-surface-200 bg-white p-4 shadow-card">
                        <h3 className="mb-2 text-sm font-semibold text-surface-900">Resumo</h3>
                        <div className="space-y-2 text-xs">
                            <div className="flex justify-between">
                                <span className="text-surface-600">Total monitorados</span>
                                <span className="font-semibold text-surface-900">{alerts.length}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-red-600">Vencidas</span>
                                <span className="font-bold text-red-700">{overdueAlerts.length}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-amber-600">Vencendo em 30d</span>
                                <span className="font-bold text-amber-700">{upcomingAlerts.length}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
