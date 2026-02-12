import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ChevronLeft, ChevronRight, Plus, Trash2, User } from 'lucide-react'
import api from '@/lib/api'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { useAuthStore } from '@/stores/auth-store'

const statusConfig: Record<string, { label: string; variant: 'default' | 'brand' | 'success' | 'danger' | 'warning' | 'info' }> = {
    scheduled: { label: 'Agendado', variant: 'info' },
    confirmed: { label: 'Confirmado', variant: 'brand' },
    completed: { label: 'Concluido', variant: 'success' },
    cancelled: { label: 'Cancelado', variant: 'danger' },
}

interface Technician {
    id: number
    name: string
}

interface Customer {
    id: number
    name: string
}

interface WorkOrder {
    id: number
    number: string
    os_number?: string | null
    business_number?: string | null
    status: string
    customer?: { name: string }
}

interface Schedule {
    id: number
    title: string
    notes: string | null
    status: string
    scheduled_start: string
    scheduled_end: string
    address: string | null
    technician: Technician
    customer: Customer | null
    work_order: WorkOrder | null
}

const emptyForm = {
    title: '',
    technician_id: '' as string | number,
    customer_id: '' as string | number,
    work_order_id: '' as string | number,
    scheduled_start: '',
    scheduled_end: '',
    notes: '',
    address: '',
    status: 'scheduled',
}

function getWeekDays(date: Date) {
    const start = new Date(date)
    start.setDate(start.getDate() - start.getDay() + 1)

    return Array.from({ length: 7 }, (_, index) => {
        const current = new Date(start)
        current.setDate(start.getDate() + index)
        return current
    })
}

const toLocalDateInput = (date: Date) => {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
}

const formatDateISO = (date: Date) => toLocalDateInput(date)
const formatDayLabel = (date: Date) => date.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' })
const formatTime = (value: string) => new Date(value).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
const workOrderIdentifier = (workOrder?: WorkOrder | null) => workOrder?.business_number ?? workOrder?.os_number ?? workOrder?.number ?? '-'

export function SchedulesPage() {
    const queryClient = useQueryClient()
    const { hasPermission, hasRole } = useAuthStore()
    const canManageSchedules = hasRole('super_admin') || hasPermission('technicians.schedule.manage')

    const [weekOf, setWeekOf] = useState(() => new Date())
    const [showForm, setShowForm] = useState(false)
    const [editing, setEditing] = useState<Schedule | null>(null)
    const [form, setForm] = useState(emptyForm)
    const [technicianFilter, setTechnicianFilter] = useState('')

    const weekDays = getWeekDays(weekOf)
    const from = formatDateISO(weekDays[0])
    const to = `${formatDateISO(weekDays[6])}T23:59:59`

    const { data: schedulesResponse } = useQuery({
        queryKey: ['schedules', from, to, technicianFilter],
        queryFn: () =>
            api.get('/schedules', {
                params: {
                    from,
                    to,
                    technician_id: technicianFilter || undefined,
                    per_page: 200,
                },
            }),
    })
    const schedules: Schedule[] = schedulesResponse?.data?.data ?? []

    const { data: techniciansResponse } = useQuery({
        queryKey: ['technicians-schedules'],
        queryFn: () => api.get('/technicians/options'),
    })
    const technicians: Technician[] = techniciansResponse?.data ?? []

    const { data: workOrdersResponse } = useQuery({
        queryKey: ['work-orders-select'],
        queryFn: () => api.get('/work-orders', { params: { per_page: 50, status: 'open' } }),
        enabled: showForm,
    })
    const workOrders: WorkOrder[] = workOrdersResponse?.data?.data ?? []

    const { data: customersResponse } = useQuery({
        queryKey: ['customers-select'],
        queryFn: () => api.get('/customers', { params: { per_page: 50 } }),
        enabled: showForm,
    })
    const customers: Customer[] = customersResponse?.data?.data ?? []

    const saveMutation = useMutation({
        mutationFn: (payload: typeof form) =>
            editing ? api.put(`/schedules/${editing.id}`, payload) : api.post('/schedules', payload),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['schedules'] })
            setShowForm(false)
            setEditing(null)
            setForm(emptyForm)
        },
        onError: (error: { response?: { data?: { message?: string } } }) => {
            toast.error(error?.response?.data?.message ?? 'Erro ao salvar agendamento')
        },
    })

    const deleteMutation = useMutation({
        mutationFn: (id: number) => api.delete(`/schedules/${id}`),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['schedules'] })
            setShowForm(false)
            setEditing(null)
            setForm(emptyForm)
        },
        onError: (error: { response?: { data?: { message?: string } } }) => {
            toast.error(error?.response?.data?.message ?? 'Erro ao excluir agendamento')
        },
    })

    const setFormField = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => {
        setForm((previous) => ({ ...previous, [key]: value }))
    }

    const previousWeek = () => setWeekOf((current) => {
        const next = new Date(current)
        next.setDate(next.getDate() - 7)
        return next
    })

    const nextWeek = () => setWeekOf((current) => {
        const next = new Date(current)
        next.setDate(next.getDate() + 7)
        return next
    })

    const goToToday = () => setWeekOf(new Date())

    const openCreate = (day?: Date) => {
        if (!canManageSchedules) return
        const start = day ? `${formatDateISO(day)}T09:00` : ''
        const end = day ? `${formatDateISO(day)}T10:00` : ''

        setEditing(null)
        setForm({ ...emptyForm, scheduled_start: start, scheduled_end: end })
        setShowForm(true)
    }

    const openEdit = (schedule: Schedule) => {
        if (!canManageSchedules) return
        setEditing(schedule)
        setForm({
            title: schedule.title,
            technician_id: schedule.technician.id,
            customer_id: schedule.customer?.id ?? '',
            work_order_id: schedule.work_order?.id ?? '',
            scheduled_start: schedule.scheduled_start.replace(' ', 'T').slice(0, 16),
            scheduled_end: schedule.scheduled_end.replace(' ', 'T').slice(0, 16),
            notes: schedule.notes ?? '',
            address: schedule.address ?? '',
            status: schedule.status,
        })
        setShowForm(true)
    }

    const getSchedulesForDay = (day: Date) => schedules.filter((schedule) => schedule.scheduled_start.startsWith(formatDateISO(day)))
    const isToday = (day: Date) => formatDateISO(day) === formatDateISO(new Date())

    return (
        <div className="space-y-5">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-lg font-semibold tracking-tight text-surface-900">Agenda</h1>
                    <p className="mt-0.5 text-[13px] text-surface-500">Agendamentos e visitas dos tecnicos</p>
                </div>
                {canManageSchedules && (
                    <Button icon={<Plus className="h-4 w-4" />} onClick={() => openCreate()}>
                        Novo Agendamento
                    </Button>
                )}
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-2">
                    <Button variant="ghost" size="sm" onClick={previousWeek}><ChevronLeft className="h-4 w-4" /></Button>
                    <button onClick={goToToday} className="rounded-lg bg-brand-50 px-3 py-1.5 text-sm font-medium text-brand-700 hover:bg-brand-100 transition-colors">
                        Hoje
                    </button>
                    <Button variant="ghost" size="sm" onClick={nextWeek}><ChevronRight className="h-4 w-4" /></Button>
                    <span className="ml-2 text-sm font-medium text-surface-600">
                        {weekDays[0].toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })} - {weekDays[6].toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </span>
                </div>

                <select
                    value={technicianFilter}
                    onChange={(event: React.ChangeEvent<HTMLSelectElement>) => setTechnicianFilter(event.target.value)}
                    className="rounded-lg border border-default bg-surface-50 px-3 py-2 text-sm focus:border-brand-400 focus:bg-surface-0 focus:outline-none focus:ring-2 focus:ring-brand-500/15"
                >
                    <option value="">Todos os tecnicos</option>
                    {technicians.map((technician) => (
                        <option key={technician.id} value={technician.id}>{technician.name}</option>
                    ))}
                </select>
            </div>

            <div className="grid grid-cols-7 gap-2">
                {weekDays.map((day) => (
                    <div
                        key={formatDateISO(day)}
                        className={cn(
                            'min-h-[200px] rounded-xl border bg-surface-0 p-2 transition-colors',
                            isToday(day) ? 'border-brand-300 bg-brand-50/50' : 'border-default'
                        )}
                    >
                        <div className="mb-2 flex items-center justify-between">
                            <span className={cn('text-xs font-semibold uppercase', isToday(day) ? 'text-brand-700' : 'text-surface-500')}>
                                {formatDayLabel(day)}
                            </span>
                            {canManageSchedules && (
                                <button onClick={() => openCreate(day)} className="rounded p-0.5 text-surface-400 hover:bg-surface-100 hover:text-surface-600">
                                    <Plus className="h-3 w-3" />
                                </button>
                            )}
                        </div>

                        <div className="space-y-1.5">
                            {getSchedulesForDay(day).map((schedule) => (
                                <button
                                    key={schedule.id}
                                    onClick={() => openEdit(schedule)}
                                    className={cn(
                                        'group w-full rounded-lg border border-surface-100 bg-white p-2 text-left shadow-sm transition-all',
                                        canManageSchedules ? 'hover:shadow-card' : 'cursor-default'
                                    )}
                                >
                                    <div className="flex items-center justify-between">
                                        <span className="text-[10px] font-medium text-surface-400">{formatTime(schedule.scheduled_start)}</span>
                                        <Badge variant={statusConfig[schedule.status]?.variant ?? 'default'} className="px-1 py-0 text-[9px]">
                                            {statusConfig[schedule.status]?.label}
                                        </Badge>
                                    </div>
                                    <p className="mt-0.5 truncate text-xs font-medium text-surface-800">{schedule.title}</p>
                                    <p className="flex items-center gap-0.5 truncate text-[10px] text-surface-500">
                                        <User className="h-2.5 w-2.5" />
                                        {schedule.technician.name}
                                    </p>
                                    {schedule.work_order && (
                                        <p className="truncate text-[10px] text-brand-500">{workOrderIdentifier(schedule.work_order)}</p>
                                    )}
                                </button>
                            ))}
                        </div>
                    </div>
                ))}
            </div>

            <Modal open={showForm && canManageSchedules} onOpenChange={setShowForm} title={editing ? 'Editar Agendamento' : 'Novo Agendamento'} size="lg">
                <form onSubmit={(event) => { event.preventDefault(); saveMutation.mutate(form) }} className="space-y-4">
                    <Input label="Titulo" value={form.title} onChange={(event: React.ChangeEvent<HTMLInputElement>) => setFormField('title', event.target.value)} required placeholder="Ex: Manutencao preventiva" />

                    <div className="grid gap-4 sm:grid-cols-2">
                        <div>
                            <label className="mb-1.5 block text-[13px] font-medium text-surface-700">Tecnico *</label>
                            <select value={form.technician_id} onChange={(event: React.ChangeEvent<HTMLSelectElement>) => setFormField('technician_id', event.target.value)} required
                                className="w-full rounded-lg border border-default bg-surface-50 px-3.5 py-2.5 text-sm focus:border-brand-400 focus:bg-surface-0 focus:outline-none focus:ring-2 focus:ring-brand-500/15">
                                <option value="">Selecionar</option>
                                {technicians.map((technician) => (
                                    <option key={technician.id} value={technician.id}>{technician.name}</option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="mb-1.5 block text-[13px] font-medium text-surface-700">OS Vinculada</label>
                            <select value={form.work_order_id} onChange={(event: React.ChangeEvent<HTMLSelectElement>) => setFormField('work_order_id', event.target.value)}
                                className="w-full rounded-lg border border-default bg-surface-50 px-3.5 py-2.5 text-sm focus:border-brand-400 focus:bg-surface-0 focus:outline-none focus:ring-2 focus:ring-brand-500/15">
                                <option value="">Nenhuma</option>
                                {workOrders.map((workOrder) => (
                                    <option key={workOrder.id} value={workOrder.id}>
                                        {workOrder.business_number ?? workOrder.os_number ?? workOrder.number} - {workOrder.customer?.name}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                        <div>
                            <label className="mb-1.5 block text-[13px] font-medium text-surface-700">Cliente</label>
                            <select value={form.customer_id} onChange={(event: React.ChangeEvent<HTMLSelectElement>) => setFormField('customer_id', event.target.value)}
                                className="w-full rounded-lg border border-default bg-surface-50 px-3.5 py-2.5 text-sm focus:border-brand-400 focus:bg-surface-0 focus:outline-none focus:ring-2 focus:ring-brand-500/15">
                                <option value="">Nenhum</option>
                                {customers.map((customer) => (
                                    <option key={customer.id} value={customer.id}>{customer.name}</option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="mb-1.5 block text-[13px] font-medium text-surface-700">Status</label>
                            <select value={form.status} onChange={(event: React.ChangeEvent<HTMLSelectElement>) => setFormField('status', event.target.value)}
                                className="w-full rounded-lg border border-default bg-surface-50 px-3.5 py-2.5 text-sm focus:border-brand-400 focus:bg-surface-0 focus:outline-none focus:ring-2 focus:ring-brand-500/15">
                                {Object.entries(statusConfig).map(([key, value]) => (
                                    <option key={key} value={key}>{value.label}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                        <Input label="Inicio" type="datetime-local" value={form.scheduled_start} onChange={(event: React.ChangeEvent<HTMLInputElement>) => setFormField('scheduled_start', event.target.value)} required />
                        <Input label="Fim" type="datetime-local" value={form.scheduled_end} onChange={(event: React.ChangeEvent<HTMLInputElement>) => setFormField('scheduled_end', event.target.value)} required />
                    </div>

                    <Input label="Endereco" value={form.address} onChange={(event: React.ChangeEvent<HTMLInputElement>) => setFormField('address', event.target.value)} placeholder="Local da visita" />

                    <div>
                        <label className="mb-1.5 block text-[13px] font-medium text-surface-700">Observacoes</label>
                        <textarea value={form.notes} onChange={(event: React.ChangeEvent<HTMLTextAreaElement>) => setFormField('notes', event.target.value)} rows={2}
                            className="w-full rounded-lg border border-default bg-surface-50 px-3.5 py-2.5 text-sm focus:border-brand-400 focus:bg-surface-0 focus:outline-none focus:ring-2 focus:ring-brand-500/15" />
                    </div>

                    <div className="flex items-center justify-between border-t border-subtle pt-4">
                        <div>
                            {editing && (
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    type="button"
                                    onClick={() => {
                                        if (confirm('Excluir?')) {
                                            deleteMutation.mutate(editing.id)
                                            setShowForm(false)
                                        }
                                    }}
                                >
                                    <Trash2 className="h-4 w-4 text-red-500" /> Excluir
                                </Button>
                            )}
                        </div>
                        <div className="flex gap-2">
                            <Button variant="outline" type="button" onClick={() => setShowForm(false)}>Cancelar</Button>
                            <Button type="submit" loading={saveMutation.isPending}>{editing ? 'Salvar' : 'Agendar'}</Button>
                        </div>
                    </div>
                </form>
            </Modal>
        </div>
    )
}
