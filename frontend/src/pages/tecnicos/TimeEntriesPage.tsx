import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
    Clock, Play, Square, Timer, Briefcase, Car, Pause,
    Plus, Trash2, Filter,
} from 'lucide-react'
import api from '@/lib/api'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'

const typeConfig: Record<string, { label: string; variant: any; icon: any }> = {
    work: { label: 'Trabalho', variant: 'success', icon: Briefcase },
    travel: { label: 'Deslocamento', variant: 'info', icon: Car },
    waiting: { label: 'Espera', variant: 'warning', icon: Pause },
}

interface TimeEntry {
    id: number; type: string; started_at: string; ended_at: string | null
    duration_minutes: number | null; description: string | null
    technician: { id: number; name: string }
    work_order: { id: number; number: string } | null
}

const emptyForm = {
    work_order_id: '' as string | number, technician_id: '' as string | number,
    type: 'work', started_at: '', ended_at: '', description: '',
}

export function TimeEntriesPage() {
    const qc = useQueryClient()
    const [showForm, setShowForm] = useState(false)
    const [form, setForm] = useState(emptyForm)
    const [techFilter, setTechFilter] = useState('')
    const [typeFilter, setTypeFilter] = useState('')
    const [dateFrom, setDateFrom] = useState(() => {
        const d = new Date(); d.setDate(d.getDate() - 7); return d.toISOString().split('T')[0]
    })
    const [dateTo, setDateTo] = useState(() => new Date().toISOString().split('T')[0])

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
        queryFn: () => api.get('/time-entries-summary', { params: { from: dateFrom, to: dateTo } }),
    })
    const summary = summaryRes?.data?.data ?? []

    const { data: techsRes } = useQuery({
        queryKey: ['technicians'],
        queryFn: () => api.get('/users', { params: { per_page: 50 } }),
    })
    const technicians = techsRes?.data?.data ?? []

    const { data: wosRes } = useQuery({
        queryKey: ['work-orders-select-te'],
        queryFn: () => api.get('/work-orders', { params: { per_page: 50 } }),
        enabled: showForm,
    })
    const workOrders = wosRes?.data?.data ?? []

    const saveMut = useMutation({
        mutationFn: (data: typeof form) => api.post('/time-entries', data),
        onSuccess: () => { qc.invalidateQueries({ queryKey: ['time-entries'] }); qc.invalidateQueries({ queryKey: ['time-entries-summary'] }); setShowForm(false) },
    })

    const startMut = useMutation({
        mutationFn: (data: { work_order_id: number; type: string }) => api.post('/time-entries/start', data),
        onSuccess: () => { qc.invalidateQueries({ queryKey: ['time-entries'] }) },
    })

    const stopMut = useMutation({
        mutationFn: (id: number) => api.post(`/time-entries/${id}/stop`),
        onSuccess: () => { qc.invalidateQueries({ queryKey: ['time-entries'] }); qc.invalidateQueries({ queryKey: ['time-entries-summary'] }) },
    })

    const delMut = useMutation({
        mutationFn: (id: number) => api.delete(`/time-entries/${id}`),
        onSuccess: () => { qc.invalidateQueries({ queryKey: ['time-entries'] }); qc.invalidateQueries({ queryKey: ['time-entries-summary'] }) },
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
    summary.forEach((s: any) => {
        const id = s.technician_id
        if (!techSummary[id]) techSummary[id] = { name: s.technician?.name ?? '?', work: 0, travel: 0, waiting: 0 }
        techSummary[id][s.type as 'work' | 'travel' | 'waiting'] = s.total_minutes || 0
    })

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-surface-900">Apontamento de Horas</h1>
                    <p className="mt-1 text-sm text-surface-500">Registro de tempo dos técnicos nas OS</p>
                </div>
                <Button icon={<Plus className="h-4 w-4" />} onClick={() => { setForm(emptyForm); setShowForm(true) }}>
                    Novo Apontamento
                </Button>
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
                                        <span className="text-sm font-medium text-surface-900">{e.technician.name}</span>
                                        {e.work_order && <span className="ml-2 text-xs text-brand-500">{e.work_order.number}</span>}
                                        <p className="text-xs text-surface-500">{tc?.label} — Iniciado {formatTime(e.started_at)}</p>
                                    </div>
                                    <Button variant="outline" size="sm" onClick={() => stopMut.mutate(e.id)} loading={stopMut.isPending}>
                                        <Square className="h-3.5 w-3.5 mr-1" /> Parar
                                    </Button>
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
                        <div key={ts.name} className="rounded-xl border border-surface-200 bg-white p-4 shadow-card">
                            <p className="text-sm font-semibold text-surface-900">{ts.name}</p>
                            <div className="mt-2 grid grid-cols-3 gap-2 text-center">
                                <div><p className="text-lg font-bold text-emerald-600">{formatDuration(ts.work)}</p><p className="text-[10px] text-surface-500">Trabalho</p></div>
                                <div><p className="text-lg font-bold text-sky-600">{formatDuration(ts.travel)}</p><p className="text-[10px] text-surface-500">Desloc.</p></div>
                                <div><p className="text-lg font-bold text-amber-600">{formatDuration(ts.waiting)}</p><p className="text-[10px] text-surface-500">Espera</p></div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Filters */}
            <div className="flex flex-wrap gap-3">
                <select value={techFilter} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setTechFilter(e.target.value)}
                    className="rounded-lg border border-surface-300 bg-white px-3 py-2 text-sm focus:border-brand-500 focus:outline-none">
                    <option value="">Todos os técnicos</option>
                    {technicians.map((t: any) => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
                <select value={typeFilter} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setTypeFilter(e.target.value)}
                    className="rounded-lg border border-surface-300 bg-white px-3 py-2 text-sm focus:border-brand-500 focus:outline-none">
                    <option value="">Todos os tipos</option>
                    {Object.entries(typeConfig).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
                <input type="date" value={dateFrom} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDateFrom(e.target.value)}
                    className="rounded-lg border border-surface-300 bg-white px-3 py-2 text-sm focus:border-brand-500 focus:outline-none" />
                <input type="date" value={dateTo} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDateTo(e.target.value)}
                    className="rounded-lg border border-surface-300 bg-white px-3 py-2 text-sm focus:border-brand-500 focus:outline-none" />
            </div>

            {/* Entries Table */}
            <div className="overflow-hidden rounded-xl border border-surface-200 bg-white shadow-card">
                <table className="w-full">
                    <thead>
                        <tr className="border-b border-surface-200 bg-surface-50">
                            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-surface-600">Técnico</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-surface-600">OS</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-surface-600">Tipo</th>
                            <th className="hidden px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-surface-600 md:table-cell">Data</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-surface-600">Horário</th>
                            <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-surface-600">Duração</th>
                            <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-surface-600">Ações</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-surface-100">
                        {isLoading ? (
                            <tr><td colSpan={7} className="px-4 py-12 text-center text-sm text-surface-500">Carregando...</td></tr>
                        ) : entries.length === 0 ? (
                            <tr><td colSpan={7} className="px-4 py-12 text-center text-sm text-surface-500">Nenhum apontamento encontrado</td></tr>
                        ) : entries.map(e => {
                            const tc = typeConfig[e.type] ?? typeConfig.work
                            const Icon = tc.icon
                            return (
                                <tr key={e.id} className="hover:bg-surface-50 transition-colors">
                                    <td className="px-4 py-3 text-sm font-medium text-surface-900">{e.technician.name}</td>
                                    <td className="px-4 py-3 text-xs text-brand-600 font-medium">{e.work_order?.number ?? '—'}</td>
                                    <td className="px-4 py-3">
                                        <Badge variant={tc.variant} className="gap-1"><Icon className="h-3 w-3" />{tc.label}</Badge>
                                    </td>
                                    <td className="hidden px-4 py-3 text-xs text-surface-500 md:table-cell">{formatDate(e.started_at)}</td>
                                    <td className="px-4 py-3 text-xs text-surface-600">
                                        {formatTime(e.started_at)} — {e.ended_at ? formatTime(e.ended_at) : <span className="text-emerald-500 font-medium">em curso</span>}
                                    </td>
                                    <td className="px-4 py-3 text-right">
                                        <span className="text-sm font-semibold text-surface-800">{formatDuration(e.duration_minutes)}</span>
                                    </td>
                                    <td className="px-4 py-3">
                                        <div className="flex items-center justify-end gap-1">
                                            {!e.ended_at && (
                                                <Button variant="ghost" size="sm" onClick={() => stopMut.mutate(e.id)}>
                                                    <Square className="h-4 w-4 text-red-500" />
                                                </Button>
                                            )}
                                            <Button variant="ghost" size="sm" onClick={() => { if (confirm('Excluir?')) delMut.mutate(e.id) }}>
                                                <Trash2 className="h-4 w-4 text-red-500" />
                                            </Button>
                                        </div>
                                    </td>
                                </tr>
                            )
                        })}
                    </tbody>
                </table>
            </div>

            {/* Manual Entry Modal */}
            <Modal open={showForm} onOpenChange={setShowForm} title="Novo Apontamento">
                <form onSubmit={e => { e.preventDefault(); saveMut.mutate(form) }} className="space-y-4">
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
                            <label className="mb-1.5 block text-sm font-medium text-surface-700">OS *</label>
                            <select value={form.work_order_id} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => set('work_order_id', e.target.value)} required
                                className="w-full rounded-lg border border-surface-300 bg-white px-3.5 py-2.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20">
                                <option value="">Selecionar</option>
                                {workOrders.map((wo: any) => <option key={wo.id} value={wo.id}>{wo.number} — {wo.customer?.name}</option>)}
                            </select>
                        </div>
                    </div>
                    <div>
                        <label className="mb-2 block text-sm font-medium text-surface-700">Tipo</label>
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
                        <label className="mb-1.5 block text-sm font-medium text-surface-700">Descrição</label>
                        <textarea value={form.description} onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => set('description', e.target.value)} rows={2}
                            className="w-full rounded-lg border border-surface-300 bg-white px-3.5 py-2.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20" />
                    </div>
                    <div className="flex justify-end gap-2 border-t border-surface-200 pt-4">
                        <Button variant="outline" type="button" onClick={() => setShowForm(false)}>Cancelar</Button>
                        <Button type="submit" loading={saveMut.isPending}>Salvar</Button>
                    </div>
                </form>
            </Modal>
        </div>
    )
}
