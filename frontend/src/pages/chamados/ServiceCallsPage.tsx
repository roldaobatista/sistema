import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import {
    Plus, Search, Phone, MapPin, UserCheck, ArrowRight, Trash2,
    AlertCircle, Clock, Truck, CheckCircle, XCircle,
} from 'lucide-react'
import api from '@/lib/api'
import { SERVICE_CALL_STATUS } from '@/lib/constants'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Modal } from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
import { toast } from 'sonner'

const statusConfig: Record<string, { label: string; variant: any; icon: any }> = {
    [SERVICE_CALL_STATUS.OPEN]: { label: 'Aberto', variant: 'info', icon: Phone },
    [SERVICE_CALL_STATUS.SCHEDULED]: { label: 'Agendado', variant: 'warning', icon: Clock },
    [SERVICE_CALL_STATUS.IN_TRANSIT]: { label: 'Em Deslocamento', variant: 'info', icon: Truck },
    [SERVICE_CALL_STATUS.IN_PROGRESS]: { label: 'Em Atendimento', variant: 'default', icon: AlertCircle },
    [SERVICE_CALL_STATUS.COMPLETED]: { label: 'Concluído', variant: 'success', icon: CheckCircle },
    [SERVICE_CALL_STATUS.CANCELLED]: { label: 'Cancelado', variant: 'danger', icon: XCircle },
}

const priorityConfig: Record<string, { label: string; color: string }> = {
    low: { label: 'Baixa', color: 'text-surface-500' },
    normal: { label: 'Normal', color: 'text-blue-500' },
    high: { label: 'Alta', color: 'text-amber-500' },
    urgent: { label: 'Urgente', color: 'text-red-500' },
}

const emptyForm = { customer_id: '', priority: 'normal', address: '', city: '', state: '', observations: '', scheduled_date: '' }

export function ServiceCallsPage() {
    const navigate = useNavigate()
    const qc = useQueryClient()
    const [search, setSearch] = useState('')
    const [statusFilter, setStatusFilter] = useState('')
    const [showCreate, setShowCreate] = useState(false)
    const [showAssign, setShowAssign] = useState<any>(null)

    // Form state
    const [form, setForm] = useState({ ...emptyForm })
    const [assignForm, setAssignForm] = useState({ technician_id: '', driver_id: '', scheduled_date: '' })
    const [customerSearch, setCustomerSearch] = useState('')

    const { data: summaryRes } = useQuery({ queryKey: ['service-calls-summary'], queryFn: () => api.get('/service-calls-summary') })
    const summary = summaryRes?.data ?? {}

    const { data: callsRes } = useQuery({
        queryKey: ['service-calls', search, statusFilter],
        queryFn: () => api.get('/service-calls', { params: { search: search || undefined, status: statusFilter || undefined, per_page: 50 } }),
    })
    const calls = callsRes?.data?.data ?? []

    const { data: customersRes } = useQuery({
        queryKey: ['customers-lookup', customerSearch],
        queryFn: () => api.get('/customers', { params: { search: customerSearch, per_page: 10 } }),
        enabled: customerSearch.length > 1,
    })

    const { data: techniciansRes } = useQuery({
        queryKey: ['users-all'],
        queryFn: () => api.get('/users', { params: { per_page: 100 } }),
    })
    const technicians = techniciansRes?.data?.data ?? []

    const resetCreateForm = () => {
        setForm({ ...emptyForm })
        setCustomerSearch('')
    }

    const createMut = useMutation({
        mutationFn: () => {
            if (!form.customer_id) {
                return Promise.reject(new Error('Selecione um cliente'))
            }
            return api.post('/service-calls', form)
        },
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['service-calls'] })
            qc.invalidateQueries({ queryKey: ['service-calls-summary'] })
            setShowCreate(false)
            resetCreateForm()
            toast.success('Chamado criado com sucesso!')
        },
        onError: (err: any) => {
            toast.error(err?.response?.data?.message || err?.message || 'Erro ao criar chamado')
        },
    })

    const assignMut = useMutation({
        mutationFn: () => api.put(`/service-calls/${showAssign.id}/assign`, assignForm),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['service-calls'] })
            qc.invalidateQueries({ queryKey: ['service-calls-summary'] })
            setShowAssign(null)
            toast.success('Técnico atribuído com sucesso!')
        },
        onError: (err: any) => {
            toast.error(err?.response?.data?.message || 'Erro ao atribuir técnico')
        },
    })

    const statusMut = useMutation({
        mutationFn: ({ id, status }: { id: number; status: string }) => api.put(`/service-calls/${id}/status`, { status }),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['service-calls'] })
            qc.invalidateQueries({ queryKey: ['service-calls-summary'] })
            toast.success('Status atualizado!')
        },
        onError: (err: any) => {
            toast.error(err?.response?.data?.message || 'Erro ao atualizar status')
        },
    })

    const convertMut = useMutation({
        mutationFn: (id: number) => api.post(`/service-calls/${id}/convert-to-os`),
        onSuccess: (res) => {
            qc.invalidateQueries({ queryKey: ['service-calls'] })
            qc.invalidateQueries({ queryKey: ['service-calls-summary'] })
            toast.success('Chamado convertido em OS!')
            const workOrderId = res?.data?.id
            if (workOrderId) navigate(`/os/${workOrderId}`)
        },
        onError: (err: any) => {
            const existingId = err?.response?.data?.work_order?.id
            if (existingId) {
                toast.info('Este chamado já foi convertido em OS')
                navigate(`/os/${existingId}`)
            } else {
                toast.error(err?.response?.data?.message || 'Erro ao converter chamado')
            }
        },
    })

    const deleteMut = useMutation({
        mutationFn: (id: number) => api.delete(`/service-calls/${id}`),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['service-calls'] })
            qc.invalidateQueries({ queryKey: ['service-calls-summary'] })
            toast.success('Chamado excluído com sucesso!')
        },
        onError: (err: any) => {
            toast.error(err?.response?.data?.message || 'Erro ao excluir chamado')
        },
    })

    const stats = [
        { label: 'Abertos', value: summary.open ?? 0, icon: Phone, color: 'text-blue-600' },
        { label: 'Agendados', value: summary.scheduled ?? 0, icon: Clock, color: 'text-amber-600' },
        { label: 'Em Deslocamento', value: summary.in_transit ?? 0, icon: Truck, color: 'text-cyan-600' },
        { label: 'Em Atendimento', value: summary.in_progress ?? 0, icon: AlertCircle, color: 'text-indigo-600' },
        { label: 'Concluídos Hoje', value: summary.completed_today ?? 0, icon: CheckCircle, color: 'text-emerald-600' },
    ]

    const nextStatus: Record<string, string> = {
        [SERVICE_CALL_STATUS.OPEN]: SERVICE_CALL_STATUS.SCHEDULED, [SERVICE_CALL_STATUS.SCHEDULED]: SERVICE_CALL_STATUS.IN_TRANSIT, [SERVICE_CALL_STATUS.IN_TRANSIT]: SERVICE_CALL_STATUS.IN_PROGRESS, [SERVICE_CALL_STATUS.IN_PROGRESS]: SERVICE_CALL_STATUS.COMPLETED,
    }

    return (
        <div className="space-y-5">
            <div className="flex items-center justify-between">
                <div><h1 className="text-lg font-semibold text-surface-900 tracking-tight">Chamados Técnicos</h1>
                    <p className="mt-0.5 text-[13px] text-surface-500">Gestão de atendimentos e agendamentos</p></div>
                <Button icon={<Plus className="h-4 w-4" />} onClick={() => setShowCreate(true)}>Novo Chamado</Button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
                {stats.map(s => {
                    const Icon = s.icon
                    return (
                        <div key={s.label} className="rounded-xl border border-default bg-surface-0 p-4 shadow-card">
                            <div className="flex items-center gap-3">
                                <div className={`rounded-lg bg-surface-50 p-2 ${s.color}`}><Icon className="h-5 w-5" /></div>
                                <div><p className="text-xs text-surface-500">{s.label}</p><p className="text-xl font-bold text-surface-900">{s.value}</p></div>
                            </div>
                        </div>
                    )
                })}
            </div>

            {/* Pipeline Visual */}
            <div className="rounded-xl border border-default bg-surface-0 p-5 shadow-card">
                <h3 className="text-sm font-semibold text-surface-900 mb-3">Fluxo de Atendimento</h3>
                <div className="flex items-center gap-1">
                    {[
                        { key: 'open', label: 'Aberto', count: summary.open ?? 0, color: 'bg-blue-500' },
                        { key: 'scheduled', label: 'Agendado', count: summary.scheduled ?? 0, color: 'bg-amber-500' },
                        { key: 'in_transit', label: 'Deslocamento', count: summary.in_transit ?? 0, color: 'bg-cyan-500' },
                        { key: 'in_progress', label: 'Atendimento', count: summary.in_progress ?? 0, color: 'bg-brand-500' },
                        { key: 'completed', label: 'Concluído', count: summary.completed_today ?? 0, color: 'bg-emerald-500' },
                    ].map((stage, i, arr) => (
                        <React.Fragment key={stage.key}>
                            <div className="flex-1 text-center">
                                <div className={`mx-auto h-10 rounded-lg ${stage.color} flex items-center justify-center`}>
                                    <span className="text-sm font-bold text-white">{stage.count}</span>
                                </div>
                                <p className="text-[10px] text-surface-500 mt-1 font-medium">{stage.label}</p>
                            </div>
                            {i < arr.length - 1 && (
                                <ArrowRight className="h-4 w-4 text-surface-300 flex-shrink-0" />
                            )}
                        </React.Fragment>
                    ))}
                </div>
            </div>
            {/* Filters */}
            <div className="flex flex-wrap gap-3">
                <div className="relative flex-1 min-w-[200px]">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-surface-400" />
                    <input value={search} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearch(e.target.value)} placeholder="Buscar chamado ou cliente..."
                        className="w-full rounded-lg border border-default bg-surface-50 py-2 pl-10 pr-3 text-sm focus:border-brand-400 focus:bg-surface-0 focus:outline-none focus:ring-2 focus:ring-brand-500/15" />
                </div>
                <select value={statusFilter} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setStatusFilter(e.target.value)}
                    className="rounded-lg border border-default bg-surface-50 px-3 py-2 text-sm">
                    <option value="">Todos</option>
                    {Object.entries(statusConfig).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
            </div>

            {/* Table */}
            <div className="overflow-hidden rounded-xl border border-default bg-surface-0 shadow-card">
                <table className="w-full">
                    <thead><tr className="border-b border-subtle bg-surface-50">
                        <th className="px-3.5 py-2.5 text-left text-xs font-semibold uppercase text-surface-600">Nº</th>
                        <th className="px-3.5 py-2.5 text-left text-xs font-semibold uppercase text-surface-600">Cliente</th>
                        <th className="px-3.5 py-2.5 text-left text-xs font-semibold uppercase text-surface-600">Técnico</th>
                        <th className="px-3.5 py-2.5 text-left text-xs font-semibold uppercase text-surface-600">Status</th>
                        <th className="px-3.5 py-2.5 text-left text-xs font-semibold uppercase text-surface-600">Prioridade</th>
                        <th className="px-3.5 py-2.5 text-left text-xs font-semibold uppercase text-surface-600">Agendado</th>
                        <th className="px-3.5 py-2.5 text-left text-xs font-semibold uppercase text-surface-600">Local</th>
                        <th className="px-3.5 py-2.5 text-right text-xs font-semibold uppercase text-surface-600">Ações</th>
                    </tr></thead>
                    <tbody className="divide-y divide-subtle">
                        {calls.length === 0 ? (
                            <tr><td colSpan={8} className="px-4 py-12 text-center text-[13px] text-surface-500">Nenhum chamado encontrado</td></tr>
                        ) : calls.map((c: any) => {
                            const sc = statusConfig[c.status] ?? statusConfig[SERVICE_CALL_STATUS.OPEN]
                            const pr = priorityConfig[c.priority] ?? priorityConfig.normal
                            return (
                                <tr key={c.id} className="hover:bg-surface-50 transition-colors duration-100">
                                    <td className="px-4 py-3 text-sm font-mono font-semibold text-brand-700">
                                        <button onClick={() => navigate(`/chamados/${c.id}`)} className="hover:underline">
                                            {c.call_number}
                                        </button>
                                    </td>
                                    <td className="px-4 py-3 text-sm text-surface-900">{c.customer?.name}</td>
                                    <td className="px-4 py-3 text-[13px] text-surface-600">
                                        {c.technician?.name ?? <span className="text-surface-400 italic text-xs">Não atribuído</span>}
                                    </td>
                                    <td className="px-4 py-3"><Badge variant={sc.variant}>{sc.label}</Badge></td>
                                    <td className="px-4 py-3"><span className={`text-sm font-medium ${pr.color}`}>{pr.label}</span></td>
                                    <td className="px-4 py-3 text-[13px] text-surface-500">{c.scheduled_date ? new Date(c.scheduled_date).toLocaleDateString('pt-BR') : '—'}</td>
                                    <td className="px-4 py-3 text-[13px] text-surface-500">
                                        {c.city && c.state ? `${c.city}/${c.state}` : <span className="text-surface-300">-</span>}
                                    </td>
                                    <td className="px-3.5 py-2.5 text-right">
                                        <div className="flex justify-end gap-1">
                                            {!c.technician_id && (<button onClick={() => { setShowAssign(c); setAssignForm({ technician_id: '', driver_id: '', scheduled_date: '' }) }} title="Atribuir técnico"
                                                className="rounded p-1.5 text-blue-600 hover:bg-blue-50"><UserCheck className="h-4 w-4" /></button>)}
                                            {nextStatus[c.status] && (<button onClick={() => {
                                                if (c.status === SERVICE_CALL_STATUS.OPEN && !c.technician_id) {
                                                    setShowAssign(c); setAssignForm({ technician_id: '', driver_id: '', scheduled_date: '' });
                                                    toast.info('Atribua um técnico antes de agendar o chamado');
                                                    return;
                                                }
                                                statusMut.mutate({ id: c.id, status: nextStatus[c.status] })
                                            }} title="Avançar status"
                                                className="rounded p-1.5 text-emerald-600 hover:bg-emerald-50"><ArrowRight className="h-4 w-4" /></button>)}
                                            {(c.status === SERVICE_CALL_STATUS.COMPLETED || c.status === SERVICE_CALL_STATUS.IN_PROGRESS) && (<button onClick={() => convertMut.mutate(c.id)} title="Converter em OS"
                                                className="rounded p-1.5 text-brand-600 hover:bg-brand-50"><MapPin className="h-4 w-4" /></button>)}
                                            {c.status === SERVICE_CALL_STATUS.OPEN && (<button onClick={() => { if (confirm('Deseja excluir este chamado?')) deleteMut.mutate(c.id) }} title="Excluir"
                                                className="rounded p-1.5 text-red-500 hover:bg-red-50"><Trash2 className="h-4 w-4" /></button>)}
                                        </div>
                                    </td>
                                </tr>
                            )
                        })}
                    </tbody>
                </table>
            </div>

            {/* Modal Criar */}
            <Modal open={showCreate} onOpenChange={(v) => { if (!v) { setShowCreate(false); resetCreateForm() } }} title="Novo Chamado Técnico">
                <div className="space-y-4">
                    <div>
                        <label className="text-[13px] font-medium text-surface-700">Cliente</label>
                        <input value={customerSearch} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCustomerSearch(e.target.value)} placeholder="Buscar cliente..."
                            className="mt-1 w-full rounded-lg border border-surface-300 px-3 py-2 text-sm" />
                        {(customersRes?.data?.data ?? []).map((c: any) => (
                            <button key={c.id} onClick={() => { setForm(f => ({ ...f, customer_id: c.id })); setCustomerSearch(c.name) }}
                                className={`mt-1 w-full rounded border p-2 text-left text-sm ${+form.customer_id === c.id ? 'border-brand-500 bg-brand-50' : 'border-surface-200'}`}>
                                {c.name}
                            </button>
                        ))}
                        {!form.customer_id && <p className="mt-1 text-xs text-red-500">Selecione um cliente</p>}
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div><label className="text-[13px] font-medium text-surface-700">Prioridade</label>
                            <select value={form.priority} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setForm(f => ({ ...f, priority: e.target.value }))}
                                className="mt-1 w-full rounded-lg border border-surface-300 px-3 py-2 text-sm">
                                {Object.entries(priorityConfig).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                            </select></div>
                        <Input label="Data Agendamento" type="datetime-local" value={form.scheduled_date} onChange={(e: any) => setForm(f => ({ ...f, scheduled_date: e.target.value }))} />
                    </div>
                    <div className="grid grid-cols-3 gap-4">
                        <Input label="Cidade" value={form.city} onChange={(e: any) => setForm(f => ({ ...f, city: e.target.value }))} />
                        <Input label="UF" value={form.state} onChange={(e: any) => setForm(f => ({ ...f, state: e.target.value }))} />
                        <Input label="Endereço" value={form.address} onChange={(e: any) => setForm(f => ({ ...f, address: e.target.value }))} />
                    </div>
                    <Input label="Observações" value={form.observations} onChange={(e: any) => setForm(f => ({ ...f, observations: e.target.value }))} />
                    <div className="flex justify-end gap-2">
                        <Button variant="outline" onClick={() => { setShowCreate(false); resetCreateForm() }}>Cancelar</Button>
                        <Button onClick={() => createMut.mutate()} loading={createMut.isPending} disabled={!form.customer_id}>Criar Chamado</Button>
                    </div>
                </div>
            </Modal>

            {/* Modal Atribuir */}
            <Modal open={!!showAssign} onOpenChange={(v) => { if (!v) setShowAssign(null) }} title="Atribuir Técnico">
                <div className="space-y-4">
                    <div><label className="text-[13px] font-medium text-surface-700">Técnico</label>
                        <select value={assignForm.technician_id} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setAssignForm(f => ({ ...f, technician_id: e.target.value }))}
                            className="mt-1 w-full rounded-lg border border-surface-300 px-3 py-2 text-sm">
                            <option value="">Selecione</option>
                            {technicians.map((t: any) => <option key={t.id} value={t.id}>{t.name}</option>)}
                        </select></div>
                    <div><label className="text-[13px] font-medium text-surface-700">Motorista (UMC)</label>
                        <select value={assignForm.driver_id} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setAssignForm(f => ({ ...f, driver_id: e.target.value }))}
                            className="mt-1 w-full rounded-lg border border-surface-300 px-3 py-2 text-sm">
                            <option value="">Selecione (opcional)</option>
                            {technicians.map((t: any) => <option key={t.id} value={t.id}>{t.name}</option>)}
                        </select></div>
                    <Input label="Data Agendamento" type="datetime-local" value={assignForm.scheduled_date} onChange={(e: any) => setAssignForm(f => ({ ...f, scheduled_date: e.target.value }))} />
                    <div className="flex justify-end gap-2">
                        <Button variant="outline" onClick={() => setShowAssign(null)}>Cancelar</Button>
                        <Button onClick={() => { if (!assignForm.technician_id) { toast.error('Selecione um técnico'); return; } assignMut.mutate() }} loading={assignMut.isPending}>Atribuir</Button>
                    </div>
                </div>
            </Modal>
        </div>
    )
}
