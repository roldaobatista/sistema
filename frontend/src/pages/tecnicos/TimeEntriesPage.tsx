import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
    Square, Timer, Briefcase, Car, Pause,
    Plus, Trash2,
} from 'lucide-react'
import api from '@/lib/api'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Modal } from '@/components/ui/modal'
import { useAuthStore } from '@/stores/auth-store'

const typeConfig: Record<string, { label: string; variant: 'default' | 'brand' | 'success' | 'danger' | 'warning' | 'info'; icon: typeof Briefcase }> = {
    work: { label: 'Trabalho', variant: 'success', icon: Briefcase },
    travel: { label: 'Deslocamento', variant: 'info', icon: Car },
    waiting: { label: 'Espera', variant: 'warning', icon: Pause },
}

interface Technician {
    id: number
    name: string
}

interface WorkOrder {
    id: number
    number: string
    os_number?: string | null
    business_number?: string | null
    customer?: { name: string }
}

interface TimeEntry {
    id: number
    type: string
    started_at: string
    ended_at: string | null
    duration_minutes: number | null
    description: string | null
    technician: Technician
    work_order: WorkOrder | null
}

interface SummaryItem {
    technician_id: string
    technician?: Technician
    type: string
    total_minutes: number
}

const emptyForm = {
    work_order_id: '' as string | number,
    technician_id: '' as string | number,
    type: 'work',
    started_at: '',
    ended_at: '',
    description: '',
}
const woIdentifier = (wo?: WorkOrder | null) =>
    wo?.business_number ?? wo?.os_number ?? wo?.number ?? '—'

const toLocalDateInput = (date: Date) => {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
}

export function TimeEntriesPage() {
    const qc = useQueryClient()
    const { hasPermission, hasRole } = useAuthStore()
    const isSuperAdmin = hasRole('super_admin')
    const canCreate = isSuperAdmin || hasPermission('technicians.time_entry.create')
    const canUpdate = isSuperAdmin || hasPermission('technicians.time_entry.update')
    const canDelete = isSuperAdmin || hasPermission('technicians.time_entry.delete')
    const canStop = canCreate || canUpdate
    const [showForm, setShowForm] = useState(false)
    const [form, setForm] = useState(emptyForm)
    const [techFilter, setTechFilter] = useState('')
    const [typeFilter, setTypeFilter] = useState('')
    const [dateFrom, setDateFrom] = useState(() => {
        const d = new Date()
        d.setDate(d.getDate() - 7)
        return toLocalDateInput(d)
    })
    const [dateTo, setDateTo] = useState(() => toLocalDateInput(new Date()))

    const { data: res, isLoading } = useQuery({
        queryKey: ['time-entries', techFilter, typeFilter, dateFrom, dateTo],
        queryFn: () => api.get('/time-entries', {
            params: {
                technician_id: techFilter || undefined,
                type: typeFilter || undefined,
                from: dateFrom, to: dateTo + 'T23:59:59',
                per_page: 100,
            },
        }),
    })
    const entries: TimeEntry[] = res?.data?.data ?? []

    const { data: summaryRes } = useQuery({
        queryKey: ['time-entries-summary', dateFrom, dateTo],
        const { data, isLoading } = useQuery({
        queryFn: () => api.get('/time-entries-summary', { params: { from: dateFrom, to: dateTo } }),
    })
    const summary: SummaryItem[] = summaryRes?.data?.data ?? []

    const { data: techsRes } = useQuery({
        queryKey: ['technicians-time-entries'],
        const { data, isLoading } = useQuery({
        queryFn: () => api.get('/technicians/options'),
    })
    const technicians: Technician[] = techsRes?.data ?? []

    const { data: wosRes } = useQuery({
        queryKey: ['work-orders-select-te'],
        const { data, isLoading } = useQuery({
        queryFn: () => api.get('/work-orders', { params: { per_page: 50 } }),
        enabled: showForm,
    })
    const workOrders: WorkOrder[] = wosRes?.data?.data ?? []

    const saveMut = useMutation({
        mutationFn: (data: typeof form) => api.post('/time-entries', data),
        onSuccess: () => {
            toast.success('Operação realizada com sucesso')
                qc.invalidateQueries({ queryKey: ['time-entries'] })
            qc.invalidateQueries({ queryKey: ['time-entries-summary'] })
            setShowForm(false)
        },
        onError: (err: { response?: { data?: { message?: string } } }) => toast.error(err?.response?.data?.message ?? 'Erro ao salvar apontamento'),
    })

    const stopMut = useMutation({
        mutationFn: (id: number) => api.post(`/time-entries/${id}/stop`),
        onSuccess: () => {
            toast.success('Operação realizada com sucesso')
                qc.invalidateQueries({ queryKey: ['time-entries'] })
            qc.invalidateQueries({ queryKey: ['time-entries-summary'] })
        },
        onError: (err: { response?: { data?: { message?: string } } }) => toast.error(err?.response?.data?.message ?? 'Erro ao parar timer'),
    })

    const delMut = useMutation({
        mutationFn: (id: number) => api.delete(`/time-entries/${id}`),
        onSuccess: () => {
            toast.success('Operação realizada com sucesso')
                qc.invalidateQueries({ queryKey: ['time-entries'] })
            qc.invalidateQueries({ queryKey: ['time-entries-summary'] })
        },
        onError: (err: { response?: { data?: { message?: string } } }) => toast.error(err?.response?.data?.message ?? 'Erro ao excluir apontamento'),
    })

    const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) =>
        setForm(prev => ({ ...prev, [k]: v }))

    const formatDuration = (m: number | null) => {
        if (!m) return '—'
        const h = Math.floor(m / 60); const min = m % 60
        return h > 0 ? `${h}h${min.toString().padStart(2, '0')}` : `${min}min`
    }
    const formatTime = (s: string) => new Date(s).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    const formatDate = (s: string) => new Date(s).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })

    // Running entries
    const runningEntries = entries.filter(e => !e.ended_at)

    // Summary per tech
    const techSummary: Record<string, { name: string; work: number; travel: number; waiting: number }> = {}
    summary.forEach((s) => {
        const id = s.technician_id
        if (!techSummary[id]) techSummary[id] = { name: s.technician?.name ?? '?', work: 0, travel: 0, waiting: 0 }
        techSummary[id][s.type as 'work' | 'travel' | 'waiting'] = s.total_minutes || 0
    })

    return (
        <div className="space-y-5">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-lg font-semibold text-surface-900 tracking-tight">Apontamento de Horas</h1>
                    <p className="mt-0.5 text-[13px] text-surface-500">Registro de tempo dos técnicos nas OS</p>
                </div>
                {canCreate && (
                    <Button icon={<Plus className="h-4 w-4" />} onClick={() => { setForm(emptyForm); setShowForm(true) }}>
                        Novo Apontamento
                    </Button>
                )}
            </div>

            {/* Running Timers */}
            {runningEntries.length > 0 && (
                <div className="rounded-xl border-2 border-emerald-300 bg-emerald-50 p-4">
                    <h3 className="text-sm font-semibold text-emerald-800 mb-2 flex items-center gap-1.5">
                        <span className="relative flex h-2.5 w-2.5"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span><span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500"></span></span>
                        Em andamento
                    </h3>
                    <div className="space-y-2">
                        {runningEntries.map(e => {
                            const tc = typeConfig[e.type]
                            const Icon = tc?.icon ?? Timer
                            return (
                                <div key={e.id} className="flex items-center gap-3 rounded-lg bg-white p-3 shadow-sm">
                                    <Icon className="h-4 w-4 text-emerald-600" />
                                    <div className="flex-1 min-w-0">
                                        <span className="text-[13px] font-medium text-surface-900">{e.technician.name}</span>
                                        {e.work_order && <span className="ml-2 text-xs text-brand-500">{woIdentifier(e.work_order)}</span>}
                                        <p className="text-xs text-surface-500">{tc?.label} — Iniciado {formatTime(e.started_at)}</p>
                                    </div>
                                    {canStop && (
                                        <Button variant="outline" size="sm" onClick={() => stopMut.mutate(e.id)} loading={stopMut.isPending}>
                                            <Square className="h-3.5 w-3.5 mr-1" /> Parar
                                        </Button>
                                    )}
                                </div>
                            )
                        })}
                    </div>
                </div>
            )}

            {/* Summary Cards */}
            {Object.keys(techSummary).length > 0 && (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {Object.values(techSummary).map(ts => (
                        <div key={ts.name} className="rounded-xl border border-default bg-surface-0 p-4 shadow-card">
                            <p className="text-sm font-semibold text-surface-900">{ts.name}</p>
                            <div className="mt-2 grid grid-cols-3 gap-2 text-center">
                                <div><p className="text-[15px] font-semibold tabular-nums text-emerald-600">{formatDuration(ts.work)}</p><p className="text-[10px] text-surface-500">Trabalho</p></div>
                                <div><p className="text-[15px] font-semibold tabular-nums text-sky-600">{formatDuration(ts.travel)}</p><p className="text-[10px] text-surface-500">Desloc.</p></div>
                                <div><p className="text-[15px] font-semibold tabular-nums text-amber-600">{formatDuration(ts.waiting)}</p><p className="text-[10px] text-surface-500">Espera</p></div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Time composition bar */}
            {Object.keys(techSummary).length > 0 && (() => {
                let totalWork = 0, totalTravel = 0, totalWait = 0
                Object.values(techSummary).forEach(ts => { totalWork += ts.work; totalTravel += ts.travel; totalWait += ts.waiting })
                const grandTotal = totalWork + totalTravel + totalWait
                if (grandTotal === 0) return null
                const pctW = Math.round((totalWork / grandTotal) * 100)
                const pctT = Math.round((totalTravel / grandTotal) * 100)
                const pctWt = 100 - pctW - pctT
                return (
                    <div className="rounded-xl border border-default bg-surface-0 p-4 shadow-card">
                        <h3 className="text-xs font-semibold text-surface-700 mb-2">Composição do Tempo Total</h3>
                        <div className="flex h-5 overflow-hidden rounded-full">
                            {totalWork > 0 && <div className="bg-emerald-500 transition-all" style={{ width: `${pctW}%` }} />}
                            {totalTravel > 0 && <div className="bg-sky-500 transition-all" style={{ width: `${pctT}%` }} />}
                            {totalWait > 0 && <div className="bg-amber-400 transition-all" style={{ width: `${pctWt}%` }} />}
                        </div>
                        <div className="mt-2 flex gap-4 text-xs text-surface-600">
                            <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />Trabalho <strong>{formatDuration(totalWork)}</strong> ({pctW}%)</span>
                            <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-sky-500" />Deslocam. <strong>{formatDuration(totalTravel)}</strong> ({pctT}%)</span>
                            <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-amber-400" />Espera <strong>{formatDuration(totalWait)}</strong> ({pctWt}%)</span>
                        </div>
                    </div>
                )
            })()}

            {/* Filters */}
            <div className="flex flex-wrap gap-3">
                <select value={techFilter} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setTechFilter(e.target.value)}
                    className="rounded-lg border border-default bg-surface-50 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none">
                    <option value="">Todos os técnicos</option>
                    {technicians.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
                <select value={typeFilter} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setTypeFilter(e.target.value)}
                    className="rounded-lg border border-default bg-surface-50 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none">
                    <option value="">Todos os tipos</option>
                    {Object.entries(typeConfig).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
                <input type="date" value={dateFrom} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDateFrom(e.target.value)}
                    className="rounded-lg border border-default bg-surface-50 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none" />
                <input type="date" value={dateTo} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDateTo(e.target.value)}
                    className="rounded-lg border border-default bg-surface-50 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none" />
            </div>

            {/* Entries Table */}
            <div className="overflow-hidden rounded-xl border border-default bg-surface-0 shadow-card">
                <table className="w-full">
                    <thead>
                        <tr className="border-b border-subtle bg-surface-50">
                            <th className="px-3.5 py-2.5 text-left text-[11px] font-medium uppercase tracking-wider text-surface-500">Técnico</th>
                            <th className="px-3.5 py-2.5 text-left text-[11px] font-medium uppercase tracking-wider text-surface-500">OS</th>
                            <th className="px-3.5 py-2.5 text-left text-[11px] font-medium uppercase tracking-wider text-surface-500">Tipo</th>
                            <th className="hidden px-3.5 py-2.5 text-left text-[11px] font-medium uppercase tracking-wider text-surface-500 md:table-cell">Data</th>
                            <th className="px-3.5 py-2.5 text-left text-[11px] font-medium uppercase tracking-wider text-surface-500">Horário</th>
                            <th className="px-3.5 py-2.5 text-right text-[11px] font-medium uppercase tracking-wider text-surface-500">Duração</th>
                            <th className="px-3.5 py-2.5 text-right text-[11px] font-medium uppercase tracking-wider text-surface-500">Ações</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-subtle">
                        {isLoading ? (
                            <tr><td colSpan={7} className="px-4 py-12 text-center text-[13px] text-surface-500">Carregando...</td></tr>
                        ) : entries.length === 0 ? (
                            <tr><td colSpan={7} className="px-4 py-12 text-center text-[13px] text-surface-500">Nenhum apontamento encontrado</td></tr>
                        ) : entries.map(e => {
                            const tc = typeConfig[e.type] ?? typeConfig.work
                            const Icon = tc.icon
                            return (
                                <tr key={e.id} className="hover:bg-surface-50 transition-colors duration-100">
                                    <td className="px-4 py-3 text-[13px] font-medium text-surface-900">{e.technician.name}</td>
                                    <td className="px-4 py-3 text-xs text-brand-600 font-medium">{woIdentifier(e.work_order)}</td>
                                    <td className="px-4 py-3">
                                        <Badge variant={tc.variant} className="gap-1"><Icon className="h-3 w-3" />{tc.label}</Badge>
                                    </td>
                                    <td className="hidden px-4 py-3 text-xs text-surface-500 md:table-cell">{formatDate(e.started_at)}</td>
                                    <td className="px-4 py-3 text-xs text-surface-600">
                                        {formatTime(e.started_at)} — {e.ended_at ? formatTime(e.ended_at) : <span className="text-emerald-500 font-medium">em curso</span>}
                                    </td>
                                    <td className="px-3.5 py-2.5 text-right">
                                        <span className="text-sm font-semibold text-surface-800">{formatDuration(e.duration_minutes)}</span>
                                    </td>
                                    <td className="px-4 py-3">
                                        <div className="flex items-center justify-end gap-1">
                                            {!e.ended_at && canStop && (
                                                <Button variant="ghost" size="sm" onClick={() => stopMut.mutate(e.id)}>
                                                    <Square className="h-4 w-4 text-red-500" />
                                                </Button>
                                            )}
                                            {canDelete && (
                                                <Button variant="ghost" size="sm" onClick={() => { if (confirm('Excluir?')) delMut.mutate(e.id) }}>
                                                    <Trash2 className="h-4 w-4 text-red-500" />
                                                </Button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            )
                        })}
                    </tbody>
                </table>
            </div>

            {/* Manual Entry Modal */}
            <Modal open={showForm && canCreate} onOpenChange={setShowForm} title="Novo Apontamento">
                <form onSubmit={e => { e.preventDefault(); saveMut.mutate(form) }} className="space-y-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                        <div>
                            <label className="mb-1.5 block text-[13px] font-medium text-surface-700">Técnico *</label>
                            <select value={form.technician_id} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => set('technician_id', e.target.value)} required
                                className="w-full rounded-lg border border-default bg-surface-50 px-3.5 py-2.5 text-sm focus:border-brand-400 focus:bg-surface-0 focus:outline-none focus:ring-2 focus:ring-brand-500/15">
                                <option value="">Selecionar</option>
                                {technicians.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="mb-1.5 block text-[13px] font-medium text-surface-700">OS *</label>
                            <select value={form.work_order_id} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => set('work_order_id', e.target.value)} required
                                className="w-full rounded-lg border border-default bg-surface-50 px-3.5 py-2.5 text-sm focus:border-brand-400 focus:bg-surface-0 focus:outline-none focus:ring-2 focus:ring-brand-500/15">
                                <option value="">Selecionar</option>
                                {workOrders.map((wo) => <option key={wo.id} value={wo.id}>{wo.business_number ?? wo.os_number ?? wo.number} — {wo.customer?.name}</option>)}
                            </select>
                        </div>
                    </div>
                    <div>
                        <label className="mb-2 block text-[13px] font-medium text-surface-700">Tipo</label>
                        <div className="flex gap-2">
                            {Object.entries(typeConfig).map(([k, v]) => {
                                const Icon = v.icon
                                return (
                                    <button key={k} type="button" onClick={() => set('type', k)}
                                        className={cn('flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium transition-all',
                                            form.type === k ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-surface-200 text-surface-500')}>
                                        <Icon className="h-4 w-4" />{v.label}
                                    </button>
                                )
                            })}
                        </div>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                        <Input label="Início" type="datetime-local" value={form.started_at} onChange={(e: React.ChangeEvent<HTMLInputElement>) => set('started_at', e.target.value)} required />
                        <Input label="Fim" type="datetime-local" value={form.ended_at} onChange={(e: React.ChangeEvent<HTMLInputElement>) => set('ended_at', e.target.value)} />
                    </div>
                    <div>
                        <label className="mb-1.5 block text-[13px] font-medium text-surface-700">Descrição</label>
                        <textarea value={form.description} onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => set('description', e.target.value)} rows={2}
                            className="w-full rounded-lg border border-default bg-surface-50 px-3.5 py-2.5 text-sm focus:border-brand-400 focus:bg-surface-0 focus:outline-none focus:ring-2 focus:ring-brand-500/15" />
                    </div>
                    <div className="flex justify-end gap-2 border-t border-subtle pt-4">
                        <Button variant="outline" type="button" onClick={() => setShowForm(false)}>Cancelar</Button>
                        <Button type="submit" loading={saveMut.isPending}>Salvar</Button>
                    </div>
                </form>
            </Modal>
        </div>
    )
}

