import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
    Calendar, ChevronLeft, ChevronRight, Clock, MapPin, Receipt, Briefcase,
    Send, CheckCircle2, Loader2, ArrowLeft, Car,
} from 'lucide-react'
import { cn, formatCurrency, getApiErrorMessage } from '@/lib/utils'
import api from '@/lib/api'
import { toast } from 'sonner'

const formatHours = (minutes: number) =>
    `${Math.floor(minutes / 60)}h ${minutes % 60}min`

const STATUS_BADGES: Record<string, string> = {
    completed: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30',
    in_progress: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    pending: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30',
    cancelled: 'bg-red-100 text-red-700 dark:bg-red-900/30',
}

const STATUS_LABELS: Record<string, string> = {
    completed: 'Concluída',
    in_progress: 'Em Andamento',
    pending: 'Pendente',
    cancelled: 'Cancelada',
}

interface WorkOrder {
    id: number
    number?: string
    os_number?: string
    status: string
    customer?: { name?: string }
    scheduled_date?: string
    completed_at?: string
    created_at: string
}

interface Expense {
    id: number
    description?: string
    amount: number
    expense_date?: string
    category?: { name?: string }
}

interface TimeEntry {
    id: number
    started_at: string
    ended_at?: string
    duration_minutes?: number
    work_order?: { os_number?: string; number?: string }
}

interface DaySummary {
    workOrdersCount: number
    hoursWorked: number
    kmTotal: number
    expensesTotal: number
}

export default function TechDaySummaryPage() {
    const navigate = useNavigate()
    const [userId, setUserId] = useState<number | null>(null)
    const [selectedDate, setSelectedDate] = useState(() => {
        const d = new Date()
        return d.toISOString().slice(0, 10)
    })
    const [loading, setLoading] = useState(true)
    const [workOrders, setWorkOrders] = useState<WorkOrder[]>([])
    const [expenses, setExpenses] = useState<Expense[]>([])
    const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([])
    const [summary, setSummary] = useState<DaySummary>({
        workOrdersCount: 0,
        hoursWorked: 0,
        kmTotal: 0,
        expensesTotal: 0,
    })

    useEffect(() => {
        api.get('/me')
            .then(({ data }) => setUserId(data?.id ?? null))
            .catch(() => setLoading(false))
    }, [])

    const dateObj = new Date(selectedDate)
    const formattedDate = dateObj.toLocaleDateString('pt-BR', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
    })

    const navigateDate = (delta: number) => {
        const d = new Date(selectedDate)
        d.setDate(d.getDate() + delta)
        setSelectedDate(d.toISOString().slice(0, 10))
    }

    useEffect(() => {
        if (!userId) return

        async function fetchData() {
            try {
                setLoading(true)
                const from = `${selectedDate}T00:00:00`
                const to = `${selectedDate}T23:59:59`

                const [woRes, expRes, teRes] = await Promise.all([
                    api.get('/work-orders', {
                        params: {
                            status: 'completed',
                            date_from: selectedDate,
                            date_to: selectedDate,
                            per_page: 100,
                        },
                    }).catch(() => ({ data: { data: [] } })),
                    api.get('/expenses', {
                        params: {
                            created_by: userId,
                            date_from: selectedDate,
                            date_to: selectedDate,
                            per_page: 100,
                        },
                    }).catch(() => ({ data: { data: [] } })),
                    api.get('/time-entries', {
                        params: {
                            technician_id: userId,
                            from,
                            to,
                            per_page: 100,
                        },
                    }).catch(() => ({ data: [] })),
                ])

                const woData = woRes.data?.data ?? woRes.data ?? []
                const woList = Array.isArray(woData) ? woData : woData.data ?? []
                setWorkOrders(woList)

                const expData = expRes.data?.data ?? expRes.data ?? []
                const expList = Array.isArray(expData) ? expData : expData.data ?? []
                setExpenses(expList)

                const teData = teRes.data?.data ?? teRes.data ?? []
                const teList = Array.isArray(teData) ? teData : teData.data ?? []
                setTimeEntries(teList)

                const hoursWorked = teList.reduce(
                    (acc: number, e: TimeEntry) => acc + (e.duration_minutes ?? 0),
                    0
                )
                const expensesTotal = expList.reduce(
                    (acc: number, e: Expense) => acc + Number(e.amount ?? 0),
                    0
                )

                setSummary({
                    workOrdersCount: woList.length,
                    hoursWorked,
                    kmTotal: 0, // Will be calculated via useMemo
                    expensesTotal,
                })
            } catch (err: unknown) {
                toast.error(getApiErrorMessage(err, 'Erro ao carregar resumo'))
            } finally {
                setLoading(false)
            }
        }

        fetchData()
    }, [userId, selectedDate])

    const kmTotal = useMemo(() => {
        return timeEntries.reduce((sum: number, te: Record<string, unknown>) => sum + (Number(te.distance_km) || 0), 0)
    }, [timeEntries])

    const hoursTotal = useMemo(() => {
        return Math.floor(summary.hoursWorked / 60)
    }, [summary.hoursWorked])

    const handleSendSummary = async () => {
        try {
            await api.post('/mobile/voice-report', {
                type: 'daily_summary',
                date: selectedDate,
                data: {
                    os_count: workOrders.length,
                    hours_total: hoursTotal,
                    km_total: kmTotal,
                    expenses_total: summary.expensesTotal,
                }
            })
            toast.success('Resumo enviado ao gestor!')
        } catch {
            toast.error('Erro ao enviar resumo. Tente novamente.')
        }
    }

    return (
        <div className="flex flex-col h-full">
            <div className="bg-card px-4 pt-3 pb-4 border-b border-border">
                <button
                    onClick={() => navigate('/tech')}
                    className="flex items-center gap-1 text-sm text-brand-600 mb-2"
                >
                    <ArrowLeft className="w-4 h-4" /> Voltar
                </button>
                <h1 className="text-lg font-bold text-foreground">
                    Resumo Diário
                </h1>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
                <div className="flex items-center justify-between bg-card rounded-xl p-3">
                    <button
                        onClick={() => navigateDate(-1)}
                        aria-label="Dia anterior"
                        className="p-2 rounded-lg hover:bg-surface-100 dark:hover:bg-surface-700"
                    >
                        <ChevronLeft className="w-5 h-5 text-surface-600" />
                    </button>
                    <div className="flex items-center gap-2">
                        <Calendar className="w-5 h-5 text-brand-600" />
                        <span className="text-sm font-medium text-foreground capitalize">
                            {formattedDate}
                        </span>
                    </div>
                    <button
                        onClick={() => navigateDate(1)}
                        aria-label="Próximo dia"
                        className="p-2 rounded-lg hover:bg-surface-100 dark:hover:bg-surface-700"
                    >
                        <ChevronRight className="w-5 h-5 text-surface-600" />
                    </button>
                </div>

                {loading ? (
                    <div className="flex justify-center py-12">
                        <Loader2 className="w-8 h-8 animate-spin text-brand-500" />
                    </div>
                ) : (
                    <>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="bg-card rounded-xl p-3">
                                <div className="flex items-center gap-2 mb-1">
                                    <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                                    <span className="text-xs text-surface-500">OS Atendidas</span>
                                </div>
                                <p className="text-lg font-bold text-foreground">
                                    {summary.workOrdersCount}
                                </p>
                            </div>
                            <div className="bg-card rounded-xl p-3">
                                <div className="flex items-center gap-2 mb-1">
                                    <Clock className="w-4 h-4 text-blue-500" />
                                    <span className="text-xs text-surface-500">Horas Trabalhadas</span>
                                </div>
                                <p className="text-lg font-bold text-foreground">
                                    {formatHours(summary.hoursWorked)}
                                </p>
                            </div>
                            <div className="bg-card rounded-xl p-3">
                                <div className="flex items-center gap-2 mb-1">
                                    <Car className="w-4 h-4 text-amber-500" />
                                    <span className="text-xs text-surface-500">Km Percorridos</span>
                                </div>
                                <p className="text-lg font-bold text-foreground">
                                    {kmTotal ?? 0} km
                                </p>
                            </div>
                            <div className="bg-card rounded-xl p-3">
                                <div className="flex items-center gap-2 mb-1">
                                    <Receipt className="w-4 h-4 text-purple-500" />
                                    <span className="text-xs text-surface-500">Total Despesas</span>
                                </div>
                                <p className="text-lg font-bold text-foreground">
                                    {formatCurrency(summary.expensesTotal)}
                                </p>
                            </div>
                        </div>

                        <div>
                            <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                                <Briefcase className="w-4 h-4" /> OS do Dia
                            </h3>
                            {workOrders.length === 0 ? (
                                <p className="text-sm text-surface-500 py-4">Nenhuma OS concluída</p>
                            ) : (
                                <div className="space-y-2">
                                    {workOrders.map((wo) => (
                                        <div
                                            key={wo.id}
                                            className="bg-card rounded-xl p-3"
                                        >
                                            <div className="flex justify-between items-start">
                                                <div>
                                                    <p className="text-sm font-medium text-foreground">
                                                        {(wo.os_number || wo.number) ?? `#${wo.id}`}
                                                    </p>
                                                    <p className="text-xs text-surface-500">
                                                        {wo.customer?.name ?? '—'}
                                                    </p>
                                                </div>
                                                <span
                                                    className={cn(
                                                        'inline-block px-2 py-0.5 rounded text-[10px] font-medium',
                                                        STATUS_BADGES[wo.status] ?? 'bg-surface-100 text-surface-600'
                                                    )}
                                                >
                                                    {STATUS_LABELS[wo.status] ?? wo.status}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-3 mt-2 text-[11px] text-surface-400">
                                                {wo.completed_at && (
                                                    <span className="flex items-center gap-1">
                                                        <Clock className="w-3 h-3" />
                                                        {new Date(wo.completed_at).toLocaleTimeString('pt-BR', {
                                                            hour: '2-digit',
                                                            minute: '2-digit',
                                                        })}
                                                    </span>
                                                )}
                                                {wo.scheduled_date && (
                                                    <span className="flex items-center gap-1">
                                                        <MapPin className="w-3 h-3" />
                                                        {new Date(wo.scheduled_date).toLocaleDateString('pt-BR')}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div>
                            <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                                <Receipt className="w-4 h-4" /> Despesas do Dia
                            </h3>
                            {expenses.length === 0 ? (
                                <p className="text-sm text-surface-500 py-4">Nenhuma despesa</p>
                            ) : (
                                <div className="space-y-2">
                                    {expenses.map((ex) => (
                                        <div
                                            key={ex.id}
                                            className="bg-card rounded-xl p-3 flex justify-between items-center"
                                        >
                                            <div>
                                                <p className="text-sm text-foreground">
                                                    {ex.category?.name ?? 'Despesa'}
                                                </p>
                                                {ex.description && (
                                                    <p className="text-xs text-surface-500 truncate max-w-[200px]">
                                                        {ex.description}
                                                    </p>
                                                )}
                                            </div>
                                            <p className="text-sm font-medium text-foreground">
                                                {formatCurrency(Number(ex.amount || 0))}
                                            </p>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div>
                            <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                                <Clock className="w-4 h-4" /> Apontamentos
                            </h3>
                            {timeEntries.length === 0 ? (
                                <p className="text-sm text-surface-500 py-4">Nenhum apontamento</p>
                            ) : (
                                <div className="space-y-2">
                                    {timeEntries.map((te) => (
                                        <div
                                            key={te.id}
                                            className="bg-card rounded-xl p-3"
                                        >
                                            <div className="flex justify-between items-center">
                                                <span className="text-sm text-foreground">
                                                    OS {(te.work_order?.os_number || te.work_order?.number) ?? '—'}
                                                </span>
                                                <span className="text-sm font-medium">
                                                    {formatHours(te.duration_minutes ?? 0)}
                                                </span>
                                            </div>
                                            <p className="text-[10px] text-surface-400 mt-1">
                                                {new Date(te.started_at).toLocaleTimeString('pt-BR', {
                                                    hour: '2-digit',
                                                    minute: '2-digit',
                                                })}
                                                {te.ended_at && (
                                                    <> – {new Date(te.ended_at).toLocaleTimeString('pt-BR', {
                                                        hour: '2-digit',
                                                        minute: '2-digit',
                                                    })}</>
                                                )}
                                            </p>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        <button
                            onClick={handleSendSummary}
                            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-brand-600 text-white font-medium"
                        >
                            <Send className="w-5 h-5" /> Enviar Resumo
                        </button>
                    </>
                )}
            </div>
        </div>
    )
}
