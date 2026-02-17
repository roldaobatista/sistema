import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { crmFeaturesApi } from '@/lib/crm-features-api'
import type { CrmCalendarEvent } from '@/lib/crm-features-api'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { PageHeader } from '@/components/ui/pageheader'
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
    DialogBody, DialogFooter, DialogDescription,
} from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'
import {
    CalendarDays, ChevronLeft, ChevronRight, Plus, Loader2,
    Clock, MapPin, User, RefreshCw, LayoutGrid, List,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
const MONTH_NAMES = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
]

const typeColors: Record<string, string> = {
    meeting: 'bg-blue-500',
    call: 'bg-emerald-500',
    task: 'bg-purple-500',
    follow_up: 'bg-amber-500',
    visit: 'bg-indigo-500',
    renewal: 'bg-red-500',
    activity: 'bg-teal-500',
    event: 'bg-pink-500',
}

const typeLabels: Record<string, string> = {
    meeting: 'Reunião',
    call: 'Ligação',
    task: 'Tarefa',
    follow_up: 'Follow-up',
    visit: 'Visita',
    renewal: 'Renovação',
    activity: 'Atividade',
    event: 'Evento',
}

const fmtTime = (d: string) =>
    new Date(d).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })

const fmtDate = (d: string) =>
    new Date(d).toLocaleDateString('pt-BR')

function isSameDay(d1: Date, d2: Date) {
    return d1.getFullYear() === d2.getFullYear() && d1.getMonth() === d2.getMonth() && d1.getDate() === d2.getDate()
}

function getMonthDays(year: number, month: number) {
    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)
    const startPad = firstDay.getDay()
    const days: (Date | null)[] = []

    for (let i = 0; i < startPad; i++) days.push(null)
    for (let d = 1; d <= lastDay.getDate(); d++) days.push(new Date(year, month, d))

    const remaining = 7 - (days.length % 7)
    if (remaining < 7) for (let i = 0; i < remaining; i++) days.push(null)

    return days
}

function getWeekDays(baseDate: Date) {
    const day = baseDate.getDay()
    const start = new Date(baseDate)
    start.setDate(start.getDate() - day)
    const days: Date[] = []
    for (let i = 0; i < 7; i++) {
        const d = new Date(start)
        d.setDate(d.getDate() + i)
        days.push(d)
    }
    return days
}

export function CrmCalendarPage() {
    const queryClient = useQueryClient()
    const [view, setView] = useState<'month' | 'week'>('month')
    const [currentDate, setCurrentDate] = useState(new Date())
    const [userFilter, setUserFilter] = useState('all')
    const [dialogOpen, setDialogOpen] = useState(false)
    const [selectedDay, setSelectedDay] = useState<Date | null>(null)

    const year = currentDate.getFullYear()
    const month = currentDate.getMonth()

    const rangeStart = useMemo(() => {
        if (view === 'month') {
            const d = new Date(year, month, 1)
            d.setDate(d.getDate() - d.getDay())
            return d.toISOString().slice(0, 10)
        }
        const day = currentDate.getDay()
        const s = new Date(currentDate)
        s.setDate(s.getDate() - day)
        return s.toISOString().slice(0, 10)
    }, [view, year, month, currentDate])

    const rangeEnd = useMemo(() => {
        if (view === 'month') {
            const d = new Date(year, month + 1, 0)
            d.setDate(d.getDate() + (6 - d.getDay()))
            return d.toISOString().slice(0, 10)
        }
        const day = currentDate.getDay()
        const e = new Date(currentDate)
        e.setDate(e.getDate() + (6 - day))
        return e.toISOString().slice(0, 10)
    }, [view, year, month, currentDate])

    const queryParams: { start: string; end: string; user_id?: number } = {
        start: rangeStart,
        end: rangeEnd,
    }
    if (userFilter !== 'all') queryParams.user_id = Number(userFilter)

    const { data: eventsRes, isLoading, isError } = useQuery({
        queryKey: ['crm-calendar', queryParams],
        queryFn: () => crmFeaturesApi.getCalendarEvents(queryParams).then(r => r.data),
    })

    const events: CrmCalendarEvent[] = useMemo(() => {
        const raw = eventsRes?.data ?? eventsRes ?? []
        return Array.isArray(raw) ? raw : []
    }, [eventsRes])

    const uniqueUsers = useMemo(() => {
        const map = new Map<number, string>()
        events.forEach(e => { if (e.user) map.set(e.user.id, e.user.name) })
        return Array.from(map.entries())
    }, [events])

    function eventsForDay(day: Date) {
        return events.filter(e => isSameDay(new Date(e.start_at), day))
    }

    function navigate(dir: -1 | 1) {
        const d = new Date(currentDate)
        if (view === 'month') d.setMonth(d.getMonth() + dir)
        else d.setDate(d.getDate() + dir * 7)
        setCurrentDate(d)
    }

    function goToday() {
        setCurrentDate(new Date())
    }

    const today = new Date()
    const monthDays = getMonthDays(year, month)
    const weekDays = getWeekDays(currentDate)

    const headerLabel = view === 'month'
        ? `${MONTH_NAMES[month]} ${year}`
        : `Semana de ${getWeekDays(currentDate)[0].toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })} - ${getWeekDays(currentDate)[6].toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })}`

    return (
        <div className="space-y-6">
            <PageHeader
                title="Calendário Comercial"
                subtitle="Visualize eventos, atividades e renovações de contrato"
                icon={CalendarDays}
            >
                <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                    <DialogTrigger asChild>
                        <Button size="sm" icon={<Plus className="h-4 w-4" />}>
                            Novo Evento
                        </Button>
                    </DialogTrigger>
                    <CreateEventDialog
                        defaultDate={selectedDay}
                        onSuccess={() => {
                            setDialogOpen(false)
                            queryClient.invalidateQueries({ queryKey: ['crm-calendar'] })
                        }}
                    />
                </Dialog>
            </PageHeader>

            {/* Toolbar */}
            <Card>
                <CardContent className="pt-6">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                            <Button variant="outline" size="sm" onClick={() => navigate(-1)} icon={<ChevronLeft className="h-4 w-4" />} />
                            <Button variant="outline" size="sm" onClick={goToday}>Hoje</Button>
                            <Button variant="outline" size="sm" onClick={() => navigate(1)} icon={<ChevronRight className="h-4 w-4" />} />
                            <h2 className="text-lg font-semibold ml-2">{headerLabel}</h2>
                        </div>
                        <div className="flex items-center gap-2">
                            <Select value={userFilter} onValueChange={setUserFilter}>
                                <SelectTrigger className="w-[180px]">
                                    <SelectValue placeholder="Filtrar por usuário" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">Todos os Usuários</SelectItem>
                                    {uniqueUsers.map(([id, name]) => (
                                        <SelectItem key={id} value={String(id)}>{name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <div className="flex rounded-md border">
                                <Button
                                    variant={view === 'month' ? 'secondary' : 'ghost'}
                                    size="sm"
                                    className="rounded-r-none"
                                    onClick={() => setView('month')}
                                    icon={<LayoutGrid className="h-4 w-4" />}
                                >
                                    Mês
                                </Button>
                                <Button
                                    variant={view === 'week' ? 'secondary' : 'ghost'}
                                    size="sm"
                                    className="rounded-l-none"
                                    onClick={() => setView('week')}
                                    icon={<List className="h-4 w-4" />}
                                >
                                    Semana
                                </Button>
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {isLoading && (
                <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
            )}

            {isError && (
                <Card>
                    <CardContent className="pt-6">
                        <div className="flex flex-col items-center gap-3 py-8 text-center">
                            <RefreshCw className="h-8 w-8 text-muted-foreground" />
                            <p className="text-sm text-muted-foreground">Erro ao carregar calendário.</p>
                            <Button variant="outline" size="sm" onClick={() => queryClient.invalidateQueries({ queryKey: ['crm-calendar'] })}>
                                Tentar novamente
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Month View */}
            {!isLoading && !isError && view === 'month' && (
                <Card>
                    <CardContent className="pt-6">
                        <div className="grid grid-cols-7 gap-px bg-muted rounded-lg overflow-hidden border">
                            {WEEKDAYS.map(d => (
                                <div key={d} className="bg-muted px-2 py-2 text-center text-xs font-medium text-muted-foreground">
                                    {d}
                                </div>
                            ))}
                            {monthDays.map((day, i) => {
                                if (!day) {
                                    return <div key={`empty-${i}`} className="min-h-[100px] bg-background/50" />
                                }
                                const dayEvents = eventsForDay(day)
                                const isToday = isSameDay(day, today)
                                const isCurrentMonth = day.getMonth() === month

                                return (
                                    <div
                                        key={i}
                                        className={cn(
                                            'min-h-[100px] bg-background p-1.5 cursor-pointer hover:bg-muted/30 transition-colors',
                                            !isCurrentMonth && 'opacity-40',
                                        )}
                                        onClick={() => { setSelectedDay(day); setDialogOpen(true) }}
                                    >
                                        <div className={cn(
                                            'mb-1 flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium',
                                            isToday && 'bg-primary text-primary-foreground',
                                        )}>
                                            {day.getDate()}
                                        </div>
                                        <div className="space-y-0.5">
                                            {dayEvents.slice(0, 3).map(ev => (
                                                <div
                                                    key={ev.id}
                                                    className={cn(
                                                        'truncate rounded px-1 py-0.5 text-[10px] font-medium text-white',
                                                        typeColors[ev.type] ?? 'bg-surface-500',
                                                    )}
                                                    title={`${ev.title} - ${fmtTime(ev.start_at)}`}
                                                >
                                                    {ev.title}
                                                </div>
                                            ))}
                                            {dayEvents.length > 3 && (
                                                <p className="text-[10px] text-muted-foreground pl-1">
                                                    +{dayEvents.length - 3} mais
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Week View */}
            {!isLoading && !isError && view === 'week' && (
                <div className="grid gap-4 md:grid-cols-7">
                    {weekDays.map(day => {
                        const dayEvents = eventsForDay(day)
                        const isToday = isSameDay(day, today)
                        return (
                            <Card
                                key={day.toISOString()}
                                className={cn(isToday && 'ring-2 ring-primary')}
                            >
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-sm flex items-center gap-2">
                                        <span className={cn(
                                            'flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold',
                                            isToday ? 'bg-primary text-primary-foreground' : 'bg-muted',
                                        )}>
                                            {day.getDate()}
                                        </span>
                                        <span className="text-xs text-muted-foreground">
                                            {WEEKDAYS[day.getDay()]}
                                        </span>
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    {dayEvents.length === 0 ? (
                                        <p className="text-xs text-muted-foreground text-center py-4">
                                            Sem eventos
                                        </p>
                                    ) : (
                                        <div className="space-y-2">
                                            {dayEvents.map(ev => (
                                                <div
                                                    key={ev.id}
                                                    className={cn(
                                                        'rounded-md border-l-4 bg-muted/50 p-2 space-y-1',
                                                        `border-l-${typeColors[ev.type]?.replace('bg-', '') ?? 'gray-500'}`,
                                                    )}
                                                    style={{ borderLeftColor: getColorHex(ev.type) }}
                                                >
                                                    <p className="text-xs font-medium leading-tight">{ev.title}</p>
                                                    <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                                                        <Clock className="h-3 w-3" />
                                                        {fmtTime(ev.start_at)}
                                                        {!ev.all_day && ` - ${fmtTime(ev.end_at)}`}
                                                    </div>
                                                    {ev.customer && (
                                                        <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                                                            <User className="h-3 w-3" />
                                                            {ev.customer.name}
                                                        </div>
                                                    )}
                                                    {ev.location && (
                                                        <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                                                            <MapPin className="h-3 w-3" />
                                                            {ev.location}
                                                        </div>
                                                    )}
                                                    <Badge variant="secondary" className="text-[10px] h-4">
                                                        {typeLabels[ev.type] ?? ev.type}
                                                    </Badge>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        )
                    })}
                </div>
            )}

            {/* Legend */}
            {!isLoading && !isError && (
                <Card>
                    <CardContent className="pt-6">
                        <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                            <span className="font-medium">Legenda:</span>
                            {Object.entries(typeLabels).map(([k, v]) => (
                                <span key={k} className="flex items-center gap-1.5">
                                    <span className={cn('inline-block h-3 w-3 rounded', typeColors[k] ?? 'bg-surface-500')} />
                                    {v}
                                </span>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    )
}

function getColorHex(type: string): string {
    const map: Record<string, string> = {
        meeting: '#3b82f6',
        call: '#10b981',
        task: '#a855f7',
        follow_up: '#f59e0b',
        visit: '#6366f1',
        renewal: '#ef4444',
        activity: '#14b8a6',
        event: '#ec4899',
    }
    return map[type] ?? '#6b7280'
}

function CreateEventDialog({
    defaultDate,
    onSuccess,
}: {
    defaultDate: Date | null
    onSuccess: () => void
}) {
    const formatDateValue = (d: Date | null) => d ? d.toISOString().slice(0, 10) : ''
    const nowTime = () => {
        const d = new Date()
        return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
    }

    const [form, setForm] = useState({
        title: '',
        description: '',
        type: 'meeting',
        start_date: formatDateValue(defaultDate ?? new Date()),
        start_time: nowTime(),
        end_date: formatDateValue(defaultDate ?? new Date()),
        end_time: '',
        all_day: false,
        location: '',
    })

    const createMut = useMutation({
        mutationFn: () => {
            const start_at = `${form.start_date}T${form.start_time || '00:00'}:00`
            const end_at = form.end_date
                ? `${form.end_date}T${form.end_time || '23:59'}:00`
                : start_at
            return crmFeaturesApi.createCalendarEvent({
                title: form.title,
                description: form.description || null,
                type: form.type,
                start_at,
                end_at,
                all_day: form.all_day,
                location: form.location || null,
            })
        },
        onSuccess: () => {
            toast.success('Evento criado com sucesso')
            onSuccess()
        },
        onError: () => toast.error('Erro ao criar evento'),
    })

    const update = (field: string, value: string | boolean) =>
        setForm(prev => ({ ...prev, [field]: value }))

    return (
        <DialogContent size="lg">
            <DialogHeader>
                <DialogTitle>Novo Evento</DialogTitle>
                <DialogDescription>Agende um compromisso no calendário comercial</DialogDescription>
            </DialogHeader>
            <DialogBody>
                <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-1.5 md:col-span-2">
                        <Label>Título</Label>
                        <Input
                            placeholder="Título do evento"
                            value={form.title}
                            onChange={e => update('title', e.target.value)}
                        />
                    </div>
                    <div className="space-y-1.5 md:col-span-2">
                        <Label>Descrição</Label>
                        <Input
                            placeholder="Descrição (opcional)"
                            value={form.description}
                            onChange={e => update('description', e.target.value)}
                        />
                    </div>
                    <div className="space-y-1.5">
                        <Label>Tipo</Label>
                        <Select value={form.type} onValueChange={v => update('type', v)}>
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {Object.entries(typeLabels).map(([k, v]) => (
                                    <SelectItem key={k} value={k}>{v}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-1.5">
                        <Label>Local</Label>
                        <Input
                            placeholder="Local (opcional)"
                            value={form.location}
                            onChange={e => update('location', e.target.value)}
                        />
                    </div>
                    <div className="space-y-1.5">
                        <Label>Data Início</Label>
                        <Input type="date" value={form.start_date} onChange={e => update('start_date', e.target.value)} />
                    </div>
                    <div className="space-y-1.5">
                        <Label>Hora Início</Label>
                        <Input type="time" value={form.start_time} onChange={e => update('start_time', e.target.value)} />
                    </div>
                    <div className="space-y-1.5">
                        <Label>Data Fim</Label>
                        <Input type="date" value={form.end_date} onChange={e => update('end_date', e.target.value)} />
                    </div>
                    <div className="space-y-1.5">
                        <Label>Hora Fim</Label>
                        <Input type="time" value={form.end_time} onChange={e => update('end_time', e.target.value)} />
                    </div>
                </div>
            </DialogBody>
            <DialogFooter>
                <Button variant="outline" onClick={onSuccess}>
                    Cancelar
                </Button>
                <Button
                    onClick={() => createMut.mutate()}
                    disabled={createMut.isPending || !form.title || !form.start_date}
                >
                    {createMut.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Criar Evento
                </Button>
            </DialogFooter>
        </DialogContent>
    )
}
