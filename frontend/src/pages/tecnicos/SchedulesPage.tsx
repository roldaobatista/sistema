import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ChevronLeft, ChevronRight, Plus, Trash2, User, Calendar, BarChartHorizontal, Map as MapIcon } from 'lucide-react'
import api from '@/lib/api'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { IconButton } from '@/components/ui/iconbutton'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Modal } from '@/components/ui/modal'
import { useAuthStore } from '@/stores/auth-store'
import { TechnicianGantt } from './components/TechnicianGantt'
import { TechnicianRecommendationSelector } from './components/TechnicianRecommendationSelector'
import { TechnicianMap } from './components/TechnicianMap'

const statusConfig: Record<string, { label: string; variant: 'default' | 'brand' | 'success' | 'danger' | 'warning' | 'info' | 'secondary' }> = {
    scheduled: { label: 'Agendado', variant: 'info' },
    confirmed: { label: 'Confirmado', variant: 'brand' },
    completed: { label: 'Concluido', variant: 'success' },
    cancelled: { label: 'Cancelado', variant: 'danger' },
    // CRM / Service Call statuses
    pending: { label: 'Pendente', variant: 'warning' },
    in_progress: { label: 'Em Andamento', variant: 'brand' },
    done: { label: 'Feito', variant: 'success' },
    open: { label: 'Aberto', variant: 'warning' },
}

import type { Technician, Customer, ScheduleItem, WorkOrder } from '@/types/operational'

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
    start.setDate(start.getDate() - start.getDay() + 1) // Start Monday

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

    const [viewMode, setViewMode] = useState<'week' | 'timeline' | 'map'>('week')
    const [weekOf, setWeekOf] = useState(() => new Date())
    const [selectedDate, setSelectedDate] = useState(() => new Date()) // For timeline view

    const [showForm, setShowForm] = useState(false)
    const [showDetail, setShowDetail] = useState(false)
    const [editing, setEditing] = useState<ScheduleItem | null>(null)
    const [form, setForm] = useState(emptyForm)
    const [technicianFilter, setTechnicianFilter] = useState('')

    const weekDays = getWeekDays(weekOf)
    const from = viewMode === 'week' ? formatDateISO(weekDays[0]) : formatDateISO(selectedDate)
    const to = viewMode === 'week' ? `${formatDateISO(weekDays[6])}` : formatDateISO(selectedDate)

    const { data: unifiedResponse } = useQuery({
        queryKey: ['schedules-unified', from, to, technicianFilter],
        queryFn: () =>
            api.get('/schedules-unified', {
                params: {
                    from,
                    to,
                    technician_id: technicianFilter || undefined,
                },
            }),
    })

    // Normalize data from unified endpoint
    const scheduleItems: ScheduleItem[] = unifiedResponse?.data?.data ?? []

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

    const { data: conflictData } = useQuery({
        queryKey: ['schedule-conflict', form.technician_id, form.scheduled_start, form.scheduled_end, editing?.id],
        queryFn: () => api.get('/technician/schedules/conflicts', {
            params: {
                technician_id: form.technician_id,
                start: form.scheduled_start,
                end: form.scheduled_end,
                exclude_schedule_id: editing?.source === 'schedule' ? editing.id : undefined,
            }
        }),
        enabled: !!(showForm && form.technician_id && form.scheduled_start && form.scheduled_end),
    })

    const saveMutation = useMutation({
        mutationFn: (payload: typeof form) => {
            // Only support editing standard schedules for now
            if (editing && editing.source !== 'schedule') {
                return Promise.reject(new Error('Apenas agendamentos podem ser editados aqui.'))
            }
            return editing
                ? api.put(`/schedules/${editing.id}`, payload)
                : api.post('/schedules', payload)
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['schedules-unified'] })
            setShowForm(false)
            setEditing(null)
            setForm(emptyForm)
            toast.success('Salvo com sucesso')
        },
        onError: (error: any) => {
            toast.error(error?.response?.data?.message ?? 'Erro ao salvar agendamento')
        },
    })

    const deleteMutation = useMutation({
        mutationFn: (id: number | string) => {
            if (editing && editing.source !== 'schedule') {
                return Promise.reject(new Error('Apenas agendamentos podem ser excluídos aqui.'))
            }
            return api.delete(`/schedules/${id}`)
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['schedules-unified'] })
            setShowForm(false)
            setEditing(null)
            setForm(emptyForm)
            toast.success('Excluído com sucesso')
        },
        onError: (error: any) => {
            toast.error(error?.response?.data?.message ?? 'Erro ao excluir agendamento')
        },
    })

    const setFormField = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => {
        setForm((previous) => ({ ...previous, [key]: value }))
    }

    const previousPeriod = () => {
        if (viewMode === 'week') {
            setWeekOf((current) => {
                const next = new Date(current)
                next.setDate(next.getDate() - 7)
                return next
            })
        } else {
            setSelectedDate((current) => {
                const next = new Date(current)
                next.setDate(next.getDate() - 1)
                return next
            })
        }
    }

    const nextPeriod = () => {
        if (viewMode === 'week') {
            setWeekOf((current) => {
                const next = new Date(current)
                next.setDate(next.getDate() + 7)
                return next
            })
        } else {
            setSelectedDate((current) => {
                const next = new Date(current)
                next.setDate(next.getDate() + 1)
                return next
            })
        }
    }

    const goToToday = () => {
        setWeekOf(new Date())
        setSelectedDate(new Date())
    }

    const openCreate = (day?: Date) => {
        if (!canManageSchedules) return
        const targetDay = day || (viewMode === 'timeline' ? selectedDate : new Date())
        const start = `${formatDateISO(targetDay)}T09:00`
        const end = `${formatDateISO(targetDay)}T10:00`

        setEditing(null)
        setForm({ ...emptyForm, scheduled_start: start, scheduled_end: end })
        setShowForm(true)
    }

    const openEdit = (item: ScheduleItem) => {
        if (item.source !== 'schedule') {
            // CRM/Chamados: abrir detalhe read-only em modal
            setEditing(item)
            setForm({
                title: item.title,
                technician_id: item.technician.id,
                customer_id: item.customer?.id ?? '',
                work_order_id: item.work_order?.id ?? '',
                scheduled_start: item.start.replace(' ', 'T').slice(0, 16),
                scheduled_end: item.end.replace(' ', 'T').slice(0, 16),
                notes: item.notes ?? '',
                address: item.address ?? '',
                status: item.status,
            })
            setShowDetail(true)
            return
        }
        if (!canManageSchedules) return

        setEditing(item)
        setForm({
            title: item.title,
            technician_id: item.technician.id,
            customer_id: item.customer?.id ?? '',
            work_order_id: item.work_order?.id ?? '',
            scheduled_start: item.start.replace(' ', 'T').slice(0, 16),
            scheduled_end: item.end.replace(' ', 'T').slice(0, 16),
            notes: item.notes ?? '',
            address: item.address ?? '',
            status: item.status,
        })
        setShowForm(true)
    }

    const getItemsForDay = (day: Date) => scheduleItems.filter((item) => item.start.startsWith(formatDateISO(day)))
    const isToday = (day: Date) => formatDateISO(day) === formatDateISO(new Date())

    return (
        <div className="space-y-5">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-lg font-semibold tracking-tight text-surface-900">Agenda Técnica</h1>
                    <p className="mt-0.5 text-[13px] text-surface-500">Gestão visual de visitas e atividades</p>
                </div>
                <div className="flex items-center gap-2">
                    <div className="flex rounded-lg border border-surface-200 bg-surface-50 p-1">
                        <button
                            onClick={() => setViewMode('week')}
                            className={cn(
                                "flex items-center gap-2 rounded-md px-3 py-1.5 text-xs font-medium transition-all",
                                viewMode === 'week' ? "bg-white text-brand-700 shadow-sm" : "text-surface-500 hover:text-surface-900"
                            )}
                        >
                            <Calendar className="h-3.5 w-3.5" /> Semana
                        </button>
                        <button
                            onClick={() => setViewMode('timeline')}
                            className={cn(
                                "flex items-center gap-2 rounded-md px-3 py-1.5 text-xs font-medium transition-all",
                                viewMode === 'timeline' ? "bg-white text-brand-700 shadow-sm" : "text-surface-500 hover:text-surface-900"
                            )}
                        >
                            <BarChartHorizontal className="h-3.5 w-3.5" /> Timeline
                        </button>
                        <button
                            onClick={() => setViewMode('map')}
                            className={cn(
                                "flex items-center gap-2 rounded-md px-3 py-1.5 text-xs font-medium transition-all",
                                viewMode === 'map' ? "bg-white text-brand-700 shadow-sm" : "text-surface-500 hover:text-surface-900"
                            )}
                        >
                            <MapIcon className="h-3.5 w-3.5" /> Mapa
                        </button>
                    </div>

                    {canManageSchedules && (
                        <Button icon={<Plus className="h-4 w-4" />} onClick={() => openCreate()}>
                            Novo
                        </Button>
                    )}
                </div>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-2">
                    <IconButton label="Anterior" icon={<ChevronLeft className="h-4 w-4" />} onClick={previousPeriod} />
                    <button onClick={goToToday} className="rounded-lg bg-brand-50 px-3 py-1.5 text-sm font-medium text-brand-700 hover:bg-brand-100 transition-colors">
                        Hoje
                    </button>
                    <IconButton label="Próximo" icon={<ChevronRight className="h-4 w-4" />} onClick={nextPeriod} />
                    <span className="ml-2 text-sm font-medium text-surface-600">
                        {viewMode === 'week' && (
                            <>{weekDays[0].toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })} - {weekDays[6].toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })}</>
                        )}
                        {viewMode === 'timeline' && (
                            <>{selectedDate.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}</>
                        )}
                    </span>
                </div>

                <select
                    value={technicianFilter}
                    title="Filtrar por técnico"
                    onChange={(event: React.ChangeEvent<HTMLSelectElement>) => setTechnicianFilter(event.target.value)}
                    className="rounded-lg border border-default bg-surface-50 px-3.5 py-2 text-sm focus:border-brand-400 focus:bg-surface-0 focus:outline-none focus:ring-2 focus:ring-brand-500/15"
                >
                    <option value="">Todos os técnicos</option>
                    {technicians.map((technician) => (
                        <option key={technician.id} value={technician.id}>{technician.name}</option>
                    ))}
                </select>
            </div>

            {viewMode === 'week' ? (
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
                                    <button onClick={() => openCreate(day)} title="Novo agendamento" className="rounded p-0.5 text-surface-400 hover:bg-surface-100 hover:text-surface-600">
                                        <Plus className="h-3 w-3" />
                                    </button>
                                )}
                            </div>

                            <div className="space-y-1.5">
                                {getItemsForDay(day).map((item) => (
                                    <button
                                        key={item.id}
                                        onClick={() => openEdit(item)}
                                        className={cn(
                                            'group w-full rounded-lg border border-surface-100 bg-white p-2 text-left shadow-sm transition-all',
                                            canManageSchedules ? 'hover:shadow-card' : 'cursor-default'
                                        )}
                                    >
                                        <div className="flex items-center justify-between">
                                            <span className="text-[10px] font-medium text-surface-400">{formatTime(item.start)}</span>
                                            <Badge variant={statusConfig[item.status]?.variant ?? 'default'} className="px-1 py-0 text-[9px]">
                                                {statusConfig[item.status]?.label ?? item.status}
                                            </Badge>
                                        </div>
                                        <p className="mt-0.5 truncate text-xs font-medium text-surface-800">{item.title}</p>
                                        <p className="flex items-center gap-0.5 truncate text-[10px] text-surface-500">
                                            <User className="h-2.5 w-2.5" />
                                            {item.technician?.name}
                                        </p>
                                        {item.work_order && (
                                            <p className="truncate text-[10px] text-brand-500">{workOrderIdentifier(item.work_order)}</p>
                                        )}
                                    </button>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            ) : viewMode === 'timeline' ? (
                <TechnicianGantt
                    date={selectedDate}
                    technicians={technicianFilter ? technicians.filter(t => t.id === Number(technicianFilter)) : technicians}
                    items={scheduleItems}
                    onItemClick={openEdit}
                />
            ) : (
                <TechnicianMap
                    items={scheduleItems}
                    technicianId={technicianFilter}
                />
            )}

            <Modal open={showForm && canManageSchedules} onOpenChange={setShowForm} title={editing ? 'Editar Agendamento' : 'Novo Agendamento'} size="lg">
                <form onSubmit={(event) => { event.preventDefault(); saveMutation.mutate(form) }} className="space-y-4">
                    {conflictData?.data?.conflict && (
                        <div className="rounded-lg bg-danger-50 p-3 text-xs text-danger-600 border border-danger-100 flex items-center gap-2">
                            <span className="font-bold">Aviso de Conflito:</span>
                            <span>{conflictData.data.message} ({conflictData.data.details.title})</span>
                        </div>
                    )}

                    <Input label="Titulo" value={form.title} onChange={(event: React.ChangeEvent<HTMLInputElement>) => setFormField('title', event.target.value)} required placeholder="Ex: Manutencao preventiva" />

                    <div className="grid gap-4 sm:grid-cols-2">
                        <div>
                            <label className="mb-1.5 block text-[13px] font-medium text-surface-700">Técnico *</label>
                            <select value={form.technician_id} title="Técnico" onChange={(event: React.ChangeEvent<HTMLSelectElement>) => setFormField('technician_id', event.target.value)} required
                                className="w-full rounded-lg border border-default bg-surface-50 px-3.5 py-2.5 text-sm focus:border-brand-400 focus:bg-surface-0 focus:outline-none focus:ring-2 focus:ring-brand-500/15">
                                <option value="">Selecionar</option>
                                {technicians.map((technician) => (
                                    <option key={technician.id} value={technician.id}>{technician.name}</option>
                                ))}
                            </select>

                            <TechnicianRecommendationSelector
                                start={form.scheduled_start}
                                end={form.scheduled_end}
                                serviceId={undefined} // TODO: Add service selection later
                                currentTechnicianId={form.technician_id}
                                onSelect={(techId) => setFormField('technician_id', techId)}
                            />
                        </div>

                        <div>
                            <label className="mb-1.5 block text-[13px] font-medium text-surface-700">OS Vinculada</label>
                            <select value={form.work_order_id} title="OS Vinculada" onChange={(event: React.ChangeEvent<HTMLSelectElement>) => setFormField('work_order_id', event.target.value)}
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
                            <select value={form.customer_id} title="Cliente" onChange={(event: React.ChangeEvent<HTMLSelectElement>) => setFormField('customer_id', event.target.value)}
                                className="w-full rounded-lg border border-default bg-surface-50 px-3.5 py-2.5 text-sm focus:border-brand-400 focus:bg-surface-0 focus:outline-none focus:ring-2 focus:ring-brand-500/15">
                                <option value="">Nenhum</option>
                                {customers.map((customer) => (
                                    <option key={customer.id} value={customer.id}>{customer.name}</option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="mb-1.5 block text-[13px] font-medium text-surface-700">Status</label>
                            <select value={form.status} title="Status" onChange={(event: React.ChangeEvent<HTMLSelectElement>) => setFormField('status', event.target.value)}
                                className="w-full rounded-lg border border-default bg-surface-50 px-3.5 py-2.5 text-sm focus:border-brand-400 focus:bg-surface-0 focus:outline-none focus:ring-2 focus:ring-brand-500/15">
                                {Object.entries(statusConfig).filter(([key]) => ['scheduled', 'confirmed', 'completed', 'cancelled'].includes(key)).map(([key, value]) => (
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

            {/* Modal de Detalhe (read-only para CRM/Chamados) */}
            <Modal open={showDetail} onOpenChange={setShowDetail} title={`Detalhe: ${editing?.title ?? ''}`} size="lg">
                {editing && (
                    <div className="space-y-4">
                        <div className="flex items-center gap-2">
                            <Badge variant={statusConfig[editing.status]?.variant ?? 'default'}>
                                {statusConfig[editing.status]?.label ?? editing.status}
                            </Badge>
                            <span className="text-xs text-surface-500 capitalize">Origem: {editing.source}</span>
                        </div>
                        <div className="grid gap-3 sm:grid-cols-2">
                            <div>
                                <p className="text-xs font-medium text-surface-500">Técnico</p>
                                <p className="text-sm text-surface-900">{editing.technician?.name ?? '-'}</p>
                            </div>
                            <div>
                                <p className="text-xs font-medium text-surface-500">Cliente</p>
                                <p className="text-sm text-surface-900">{editing.customer?.name ?? '-'}</p>
                            </div>
                            <div>
                                <p className="text-xs font-medium text-surface-500">Início</p>
                                <p className="text-sm text-surface-900">{formatTime(editing.start)}</p>
                            </div>
                            <div>
                                <p className="text-xs font-medium text-surface-500">Fim</p>
                                <p className="text-sm text-surface-900">{formatTime(editing.end)}</p>
                            </div>
                            {editing.work_order && (
                                <div>
                                    <p className="text-xs font-medium text-surface-500">OS Vinculada</p>
                                    <p className="text-sm text-brand-600">{workOrderIdentifier(editing.work_order)}</p>
                                </div>
                            )}
                            {editing.address && (
                                <div>
                                    <p className="text-xs font-medium text-surface-500">Endereço</p>
                                    <p className="text-sm text-surface-900">{editing.address}</p>
                                </div>
                            )}
                        </div>
                        {editing.notes && (
                            <div>
                                <p className="text-xs font-medium text-surface-500">Observações</p>
                                <p className="text-sm text-surface-700 bg-surface-50 rounded-lg p-3 border border-subtle">{editing.notes}</p>
                            </div>
                        )}
                        <div className="flex justify-end border-t border-subtle pt-4">
                            <Button variant="outline" onClick={() => setShowDetail(false)}>Fechar</Button>
                        </div>
                    </div>
                )}
            </Modal>
        </div>
    )
}
