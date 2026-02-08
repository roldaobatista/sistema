import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
    Calendar, Plus, Clock, User, MapPin, FileText,
    ChevronLeft, ChevronRight, Pencil, Trash2,
} from 'lucide-react'
import api from '@/lib/api'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'

const statusConfig: Record<string, { label: string; variant: any }> = {
    scheduled: { label: 'Agendado', variant: 'info' },
    confirmed: { label: 'Confirmado', variant: 'brand' },
    completed: { label: 'Concluído', variant: 'success' },
    cancelled: { label: 'Cancelado', variant: 'danger' },
}

interface Schedule {
    id: number; title: string; notes: string | null; status: string
    scheduled_start: string; scheduled_end: string; address: string | null
    technician: { id: number; name: string }
    customer: { id: number; name: string } | null
    work_order: { id: number; number: string; status: string } | null
}

const emptyForm = {
    title: '', technician_id: '' as string | number, customer_id: '' as string | number,
    work_order_id: '' as string | number, scheduled_start: '', scheduled_end: '',
    notes: '', address: '', status: 'scheduled',
}

function getWeekDays(date: Date) {
    const start = new Date(date)
    start.setDate(start.getDate() - start.getDay() + 1) // Monday
    return Array.from({ length: 7 }, (_, i) => {
        const d = new Date(start)
        d.setDate(start.getDate() + i)
        return d
    })
}

const fmt = (d: Date) => d.toISOString().split('T')[0]
const fmtShort = (d: Date) => d.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' })
const fmtTime = (s: string) => new Date(s).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })

export function SchedulesPage() {
    const qc = useQueryClient()
    const [weekOf, setWeekOf] = useState(() => new Date())
    const [showForm, setShowForm] = useState(false)
    const [editing, setEditing] = useState<Schedule | null>(null)
    const [form, setForm] = useState(emptyForm)
    const [techFilter, setTechFilter] = useState('')

    const days = getWeekDays(weekOf)
    const from = fmt(days[0])
    const to = fmt(days[6]) + 'T23:59:59'

    const { data: res, isLoading } = useQuery({
        queryKey: ['schedules', from, to, techFilter],
        queryFn: () => api.get('/schedules', {
            params: { from, to, technician_id: techFilter || undefined, per_page: 200 },
        }),
    })
    const schedules: Schedule[] = res?.data?.data ?? []

    const { data: techsRes } = useQuery({
        queryKey: ['technicians'],
        queryFn: () => api.get('/users', { params: { per_page: 50 } }),
    })
    const technicians = techsRes?.data?.data ?? []

    const { data: wosRes } = useQuery({
        queryKey: ['work-orders-select'],
        queryFn: () => api.get('/work-orders', { params: { per_page: 50, status: 'open' } }),
        enabled: showForm,
    })
    const workOrders = wosRes?.data?.data ?? []

    const saveMut = useMutation({
        mutationFn: (data: typeof form) =>
            editing ? api.put(`/schedules/${editing.id}`, data) : api.post('/schedules', data),
        onSuccess: () => { qc.invalidateQueries({ queryKey: ['schedules'] }); setShowForm(false) },
    })

    const delMut = useMutation({
        mutationFn: (id: number) => api.delete(`/schedules/${id}`),
        onSuccess: () => qc.invalidateQueries({ queryKey: ['schedules'] }),
    })

    const prevWeek = () => setWeekOf(d => { const n = new Date(d); n.setDate(n.getDate() - 7); return n })
    const nextWeek = () => setWeekOf(d => { const n = new Date(d); n.setDate(n.getDate() + 7); return n })
    const today = () => setWeekOf(new Date())

    const openCreate = (day?: Date) => {
        setEditing(null)
        const start = day ? `${fmt(day)}T09:00` : ''
        const end = day ? `${fmt(day)}T10:00` : ''
        setForm({ ...emptyForm, scheduled_start: start, scheduled_end: end })
        setShowForm(true)
    }

    const openEdit = (s: Schedule) => {
        setEditing(s)
        setForm({
            title: s.title, technician_id: s.technician.id,
            customer_id: s.customer?.id ?? '', work_order_id: s.work_order?.id ?? '',
            scheduled_start: s.scheduled_start.replace(' ', 'T').slice(0, 16),
            scheduled_end: s.scheduled_end.replace(' ', 'T').slice(0, 16),
            notes: s.notes ?? '', address: s.address ?? '', status: s.status,
        })
        setShowForm(true)
    }

    const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) =>
        setForm(prev => ({ ...prev, [k]: v }))

    const getSchedulesForDay = (day: Date) =>
        schedules.filter(s => s.scheduled_start.startsWith(fmt(day)))

    const isToday = (d: Date) => fmt(d) === fmt(new Date())

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-surface-900">Agenda</h1>
                    <p className="mt-1 text-sm text-surface-500">Agendamentos e visitas dos técnicos</p>
                </div>
                <Button icon={<Plus className="h-4 w-4" />} onClick={() => openCreate()}>Novo Agendamento</Button>
            </div>

            {/* Week Nav + Filters */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-2">
                    <Button variant="ghost" size="sm" onClick={prevWeek}><ChevronLeft className="h-4 w-4" /></Button>
                    <button onClick={today} className="rounded-lg bg-brand-50 px-3 py-1.5 text-sm font-medium text-brand-700 hover:bg-brand-100 transition-colors">
                        Hoje
                    </button>
                    <Button variant="ghost" size="sm" onClick={nextWeek}><ChevronRight className="h-4 w-4" /></Button>
                    <span className="ml-2 text-sm font-medium text-surface-600">
                        {days[0].toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })} — {days[6].toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </span>
                </div>
                <select value={techFilter} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setTechFilter(e.target.value)}
                    className="rounded-lg border border-surface-300 bg-white px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20">
                    <option value="">Todos os técnicos</option>
                    {technicians.map((t: any) => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
            </div>

            {/* Week Grid */}
            <div className="grid grid-cols-7 gap-2">
                {days.map(day => (
                    <div key={fmt(day)} className={cn(
                        'min-h-[200px] rounded-xl border p-2 transition-colors',
                        isToday(day) ? 'border-brand-300 bg-brand-50/50' : 'border-surface-200 bg-white',
                    )}>
                        <div className="flex items-center justify-between mb-2">
                            <span className={cn(
                                'text-xs font-semibold uppercase',
                                isToday(day) ? 'text-brand-700' : 'text-surface-500',
                            )}>
                                {fmtShort(day)}
                            </span>
                            <button onClick={() => openCreate(day)}
                                className="rounded p-0.5 text-surface-400 hover:bg-surface-100 hover:text-surface-600">
                                <Plus className="h-3 w-3" />
                            </button>
                        </div>
                        <div className="space-y-1.5">
                            {getSchedulesForDay(day).map(s => (
                                <button key={s.id} onClick={() => openEdit(s)}
                                    className="w-full rounded-lg border border-surface-100 bg-white p-2 text-left shadow-sm hover:shadow-card transition-all group">
                                    <div className="flex items-center justify-between">
                                        <span className="text-[10px] font-medium text-surface-400">{fmtTime(s.scheduled_start)}</span>
                                        <Badge variant={statusConfig[s.status]?.variant ?? 'default'} className="text-[9px] px-1 py-0">
                                            {statusConfig[s.status]?.label}
                                        </Badge>
                                    </div>
                                    <p className="mt-0.5 text-xs font-medium text-surface-800 truncate">{s.title}</p>
                                    <p className="text-[10px] text-surface-500 truncate flex items-center gap-0.5">
                                        <User className="h-2.5 w-2.5" />{s.technician.name}
                                    </p>
                                    {s.work_order && (
                                        <p className="text-[10px] text-brand-500 truncate">{s.work_order.number}</p>
                                    )}
                                </button>
                            ))}
                        </div>
                    </div>
                ))}
            </div>

            {/* Form Modal */}
            <Modal open={showForm} onOpenChange={setShowForm} title={editing ? 'Editar Agendamento' : 'Novo Agendamento'} size="lg">
                <form onSubmit={e => { e.preventDefault(); saveMut.mutate(form) }} className="space-y-4">
                    <Input label="Título" value={form.title} onChange={(e: React.ChangeEvent<HTMLInputElement>) => set('title', e.target.value)} required placeholder="Ex: Manutenção preventiva" />
                    <div className="grid gap-4 sm:grid-cols-2">
                        <div>
                            <label className="mb-1.5 block text-sm font-medium text-surface-700">Técnico *</label>
                            <select value={form.technician_id} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => set('technician_id', e.target.value)} required
                                className="w-full rounded-lg border border-surface-300 bg-white px-3.5 py-2.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20">
                                <option value="">Selecionar</option>
                                {technicians.map((t: any) => <option key={t.id} value={t.id}>{t.name}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="mb-1.5 block text-sm font-medium text-surface-700">OS Vinculada</label>
                            <select value={form.work_order_id} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => set('work_order_id', e.target.value)}
                                className="w-full rounded-lg border border-surface-300 bg-white px-3.5 py-2.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20">
                                <option value="">Nenhuma</option>
                                {workOrders.map((wo: any) => <option key={wo.id} value={wo.id}>{wo.number} — {wo.customer?.name}</option>)}
                            </select>
                        </div>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                        <Input label="Início" type="datetime-local" value={form.scheduled_start} onChange={(e: React.ChangeEvent<HTMLInputElement>) => set('scheduled_start', e.target.value)} required />
                        <Input label="Fim" type="datetime-local" value={form.scheduled_end} onChange={(e: React.ChangeEvent<HTMLInputElement>) => set('scheduled_end', e.target.value)} required />
                    </div>
                    <Input label="Endereço" value={form.address} onChange={(e: React.ChangeEvent<HTMLInputElement>) => set('address', e.target.value)} placeholder="Local da visita" />
                    <div>
                        <label className="mb-1.5 block text-sm font-medium text-surface-700">Observações</label>
                        <textarea value={form.notes} onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => set('notes', e.target.value)} rows={2}
                            className="w-full rounded-lg border border-surface-300 bg-white px-3.5 py-2.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20" />
                    </div>
                    {editing && (
                        <div>
                            <label className="mb-1.5 block text-sm font-medium text-surface-700">Status</label>
                            <div className="flex gap-2">
                                {Object.entries(statusConfig).map(([k, v]) => (
                                    <button key={k} type="button" onClick={() => set('status', k)}
                                        className={cn('rounded-lg border px-3 py-1.5 text-xs font-medium transition-all',
                                            form.status === k ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-surface-200 text-surface-500')}>
                                        {v.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                    <div className="flex items-center justify-between border-t border-surface-200 pt-4">
                        <div>
                            {editing && (
                                <Button variant="ghost" size="sm" type="button"
                                    onClick={() => { if (confirm('Excluir?')) { delMut.mutate(editing.id); setShowForm(false) } }}>
                                    <Trash2 className="h-4 w-4 text-red-500" /> Excluir
                                </Button>
                            )}
                        </div>
                        <div className="flex gap-2">
                            <Button variant="outline" type="button" onClick={() => setShowForm(false)}>Cancelar</Button>
                            <Button type="submit" loading={saveMut.isPending}>{editing ? 'Salvar' : 'Agendar'}</Button>
                        </div>
                    </div>
                </form>
            </Modal>
        </div>
    )
}
