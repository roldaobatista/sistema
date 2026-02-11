import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { AxiosError } from 'axios'
import {
    ArrowLeft, Phone, Clock, Truck, AlertCircle, CheckCircle, XCircle,
    UserCheck, ArrowRight, MapPin, ClipboardList, Wrench, Link as LinkIcon,
} from 'lucide-react'
import api from '@/lib/api'
import { SERVICE_CALL_STATUS } from '@/lib/constants'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { toast } from 'sonner'

interface UserLite {
    id: number
    name: string
}

interface EquipmentLite {
    id: number
    code?: string | null
    type?: string | null
    brand?: string | null
    model?: string | null
    serial_number?: string | null
}

interface ServiceCallData {
    id: number
    call_number: string
    status: 'open' | 'scheduled' | 'in_transit' | 'in_progress' | 'completed' | 'cancelled'
    priority: 'low' | 'normal' | 'high' | 'urgent'
    customer?: { id: number; name: string; phone?: string | null; email?: string | null } | null
    quote_id?: number | null
    quote?: { id: number; quote_number: string; status: string } | null
    technician?: UserLite | null
    driver?: UserLite | null
    scheduled_date?: string | null
    city?: string | null
    state?: string | null
    address?: string | null
    observations?: string | null
    equipments?: EquipmentLite[]
}

const statusConfig: Record<ServiceCallData['status'], { label: string; variant: 'default' | 'info' | 'warning' | 'success' | 'danger'; icon: typeof Phone }> = {
    open: { label: 'Aberto', variant: 'info', icon: Phone },
    scheduled: { label: 'Agendado', variant: 'warning', icon: Clock },
    in_transit: { label: 'Em Deslocamento', variant: 'info', icon: Truck },
    in_progress: { label: 'Em Atendimento', variant: 'default', icon: AlertCircle },
    completed: { label: 'Concluído', variant: 'success', icon: CheckCircle },
    cancelled: { label: 'Cancelado', variant: 'danger', icon: XCircle },
}

const priorityConfig: Record<ServiceCallData['priority'], { label: string; variant: 'default' | 'info' | 'warning' | 'danger' }> = {
    low: { label: 'Baixa', variant: 'default' },
    normal: { label: 'Normal', variant: 'info' },
    high: { label: 'Alta', variant: 'warning' },
    urgent: { label: 'Urgente', variant: 'danger' },
}

const nextStatus: Partial<Record<ServiceCallData['status'], ServiceCallData['status']>> = {
    open: 'scheduled',
    scheduled: 'in_transit',
    in_transit: 'in_progress',
    in_progress: 'completed',
}

export function ServiceCallDetailPage() {
    const { id } = useParams()
    const navigate = useNavigate()
    const qc = useQueryClient()
    const [assignForm, setAssignForm] = useState({
        technician_id: '',
        driver_id: '',
        scheduled_date: '',
    })
    const [editForm, setEditForm] = useState({ address: '', city: '', state: '', observations: '' })
    const [isEditing, setIsEditing] = useState(false)

    const { data: callRes, isLoading } = useQuery({
        queryKey: ['service-call', id],
        queryFn: () => api.get<ServiceCallData>(`/service-calls/${id}`),
        enabled: !!id,
    })
    const call = callRes?.data

    const { data: usersRes } = useQuery({
        queryKey: ['users-all'],
        queryFn: () => api.get('/users', { params: { per_page: 100 } }),
    })
    const users = usersRes?.data?.data ?? []

    useEffect(() => {
        if (!call) return
        setAssignForm({
            technician_id: call.technician?.id ? String(call.technician.id) : '',
            driver_id: call.driver?.id ? String(call.driver.id) : '',
            scheduled_date: call.scheduled_date ? String(call.scheduled_date).slice(0, 16) : '',
        })
    }, [call])

    useEffect(() => {
        if (!call) return
        setEditForm({
            address: call.address ?? '',
            city: call.city ?? '',
            state: call.state ?? '',
            observations: call.observations ?? '',
        })
    }, [call])

    const statusMut = useMutation({
        mutationFn: (status: ServiceCallData['status']) => api.put(`/service-calls/${id}/status`, { status }),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['service-call', id] })
            qc.invalidateQueries({ queryKey: ['service-calls'] })
            qc.invalidateQueries({ queryKey: ['service-calls-summary'] })
            toast.success('Status atualizado!')
        },
        onError: (err: any) => {
            toast.error(err?.response?.data?.message || 'Erro ao atualizar status')
        },
    })

    const assignMut = useMutation({
        mutationFn: () =>
            api.put(`/service-calls/${id}/assign`, {
                technician_id: assignForm.technician_id || null,
                driver_id: assignForm.driver_id || null,
                scheduled_date: assignForm.scheduled_date || null,
            }),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['service-call', id] })
            qc.invalidateQueries({ queryKey: ['service-calls'] })
            qc.invalidateQueries({ queryKey: ['service-calls-summary'] })
            toast.success('Atribuição salva!')
        },
        onError: (err: any) => {
            toast.error(err?.response?.data?.message || 'Erro ao atribuir técnico')
        },
    })

    const convertMut = useMutation({
        mutationFn: () => api.post(`/service-calls/${id}/convert-to-os`),
        onSuccess: (res) => {
            toast.success('Chamado convertido em OS!')
            const workOrderId = res?.data?.id
            if (workOrderId) {
                navigate(`/os/${workOrderId}`)
            }
        },
        onError: (error: AxiosError<{ message?: string; work_order?: { id?: number } }>) => {
            const existingId = error.response?.data?.work_order?.id
            if (existingId) {
                toast.info('Este chamado já foi convertido em OS')
                navigate(`/os/${existingId}`)
            } else {
                toast.error(error.response?.data?.message || 'Erro ao converter chamado')
            }
        },
    })

    const cancelMut = useMutation({
        mutationFn: () => api.put(`/service-calls/${id}/status`, { status: 'cancelled' }),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['service-call', id] })
            qc.invalidateQueries({ queryKey: ['service-calls'] })
            qc.invalidateQueries({ queryKey: ['service-calls-summary'] })
            toast.success('Chamado cancelado')
        },
        onError: (err: any) => {
            toast.error(err?.response?.data?.message || 'Erro ao cancelar chamado')
        },
    })

    const updateMut = useMutation({
        mutationFn: () => api.put(`/service-calls/${id}`, editForm),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['service-call', id] })
            qc.invalidateQueries({ queryKey: ['service-calls'] })
            toast.success('Chamado atualizado!')
            setIsEditing(false)
        },
        onError: (err: any) => {
            toast.error(err?.response?.data?.message || 'Erro ao atualizar chamado')
        },
    })

    const statusInfo = call ? statusConfig[call.status] : null
    const priorityInfo = call ? priorityConfig[call.priority] : null

    const next = useMemo(() => {
        if (!call) return null
        return nextStatus[call.status] ?? null
    }, [call])

    if (isLoading || !call) {
        return <div className="py-16 text-center text-[13px] text-surface-500">Carregando...</div>
    }

    return (
        <div className="space-y-5">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <button onClick={() => navigate('/chamados')} className="rounded-lg p-1.5 hover:bg-surface-100">
                        <ArrowLeft className="h-5 w-5 text-surface-500" />
                    </button>
                    <div>
                        <div className="flex items-center gap-2">
                            <h1 className="text-lg font-semibold text-surface-900 tracking-tight">{call.call_number}</h1>
                            {statusInfo && <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>}
                            {priorityInfo && <Badge variant={priorityInfo.variant}>{priorityInfo.label}</Badge>}
                        </div>
                        <p className="text-[13px] text-surface-500">Chamado técnico</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    {call.status !== 'cancelled' && call.status !== 'completed' && (
                        <Button
                            variant="outline"
                            className="text-red-600 border-red-200 hover:bg-red-50"
                            loading={cancelMut.isPending}
                            onClick={() => { if (window.confirm('Cancelar este chamado?')) cancelMut.mutate() }}
                        >
                            Cancelar Chamado
                        </Button>
                    )}
                    {next && (
                        <Button
                            variant="outline"
                            icon={<ArrowRight className="h-4 w-4" />}
                            loading={statusMut.isPending}
                            onClick={() => {
                                if (call.status === 'open' && !call.technician?.id) {
                                    toast.info('Atribua um técnico antes de avançar o status')
                                    return
                                }
                                statusMut.mutate(next)
                            }}
                        >
                            Avançar Status
                        </Button>
                    )}
                    {(call.status === SERVICE_CALL_STATUS.IN_PROGRESS || call.status === SERVICE_CALL_STATUS.COMPLETED) && (
                        <Button
                            icon={<Wrench className="h-4 w-4" />}
                            loading={convertMut.isPending}
                            onClick={() => convertMut.mutate()}
                        >
                            Converter em OS
                        </Button>
                    )}
                </div>
            </div>

            <div className="grid gap-6 lg:grid-cols-3">
                <div className="space-y-5 lg:col-span-2">
                    <div className="rounded-xl border border-default bg-surface-0 p-5 shadow-card">
                        <div className="flex items-center justify-between mb-3">
                            <h3 className="text-sm font-semibold text-surface-900">Atendimento</h3>
                            {!isEditing && call.status !== 'cancelled' && call.status !== 'completed' && (
                                <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>Editar</Button>
                            )}
                        </div>
                        {isEditing ? (
                            <div className="space-y-3">
                                <div className="grid gap-3 sm:grid-cols-3">
                                    <Input label="Endereço" value={editForm.address} onChange={(e: any) => setEditForm(f => ({ ...f, address: e.target.value }))} />
                                    <Input label="Cidade" value={editForm.city} onChange={(e: any) => setEditForm(f => ({ ...f, city: e.target.value }))} />
                                    <Input label="UF" value={editForm.state} onChange={(e: any) => setEditForm(f => ({ ...f, state: e.target.value }))} />
                                </div>
                                <div>
                                    <label className="mb-1.5 block text-[13px] font-medium text-surface-700">Observações</label>
                                    <textarea
                                        value={editForm.observations}
                                        onChange={(e) => setEditForm(f => ({ ...f, observations: e.target.value }))}
                                        className="w-full rounded-lg border border-default bg-surface-50 px-3 py-2 text-sm min-h-[80px]"
                                    />
                                </div>
                                <div className="flex justify-end gap-2">
                                    <Button variant="outline" onClick={() => setIsEditing(false)}>Cancelar</Button>
                                    <Button onClick={() => updateMut.mutate()} loading={updateMut.isPending}>Salvar</Button>
                                </div>
                            </div>
                        ) : (
                            <div className="grid gap-3 sm:grid-cols-2">
                                <div>
                                    <p className="text-xs text-surface-500">Cliente</p>
                                    <p className="text-[13px] font-medium text-surface-900">{call.customer?.name ?? '-'}</p>
                                </div>
                                <div>
                                    <p className="text-xs text-surface-500">Agendamento</p>
                                    <p className="text-[13px] font-medium text-surface-900">
                                        {call.scheduled_date ? new Date(call.scheduled_date).toLocaleString('pt-BR') : '-'}
                                    </p>
                                </div>
                                <div className="sm:col-span-2">
                                    <p className="text-xs text-surface-500">Endereço</p>
                                    <p className="text-[13px] font-medium text-surface-900">
                                        {([call.address, call.city, call.state].filter(Boolean) as string[]).join(' - ') || <span className="text-surface-400 italic">Não informado</span>}
                                    </p>
                                </div>
                                <div className="sm:col-span-2">
                                    <p className="text-xs text-surface-500">Observações</p>
                                    <p className="text-sm text-surface-700 whitespace-pre-wrap">{call.observations || 'Sem observações'}</p>
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="rounded-xl border border-default bg-surface-0 p-5 shadow-card">
                        <h3 className="mb-3 text-sm font-semibold text-surface-900">Atribuição</h3>
                        <div className="grid gap-4 sm:grid-cols-3">
                            <div>
                                <label className="mb-1.5 block text-[13px] font-medium text-surface-700">Técnico</label>
                                <select
                                    value={assignForm.technician_id}
                                    onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setAssignForm((p) => ({ ...p, technician_id: e.target.value }))}
                                    className="w-full rounded-lg border border-default bg-surface-50 px-3 py-2 text-sm"
                                >
                                    <option value="">Não atribuído</option>
                                    {users.map((u: UserLite) => <option key={u.id} value={u.id}>{u.name}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="mb-1.5 block text-[13px] font-medium text-surface-700">Motorista</label>
                                <select
                                    value={assignForm.driver_id}
                                    onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setAssignForm((p) => ({ ...p, driver_id: e.target.value }))}
                                    className="w-full rounded-lg border border-default bg-surface-50 px-3 py-2 text-sm"
                                >
                                    <option value="">Não atribuído</option>
                                    {users.map((u: UserLite) => <option key={u.id} value={u.id}>{u.name}</option>)}
                                </select>
                            </div>
                            <Input
                                label="Data do Agendamento"
                                type="datetime-local"
                                value={assignForm.scheduled_date}
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAssignForm((p) => ({ ...p, scheduled_date: e.target.value }))}
                            />
                        </div>
                        <div className="mt-4 flex justify-end">
                            <Button
                                icon={<UserCheck className="h-4 w-4" />}
                                loading={assignMut.isPending}
                                onClick={() => { if (!assignForm.technician_id) { toast.info('Selecione um técnico antes de salvar'); return; } assignMut.mutate() }}
                            >
                                Salvar Atribuição
                            </Button>
                        </div>
                    </div>
                </div>

                <div className="space-y-4">
                    {call.quote_id && (
                        <div className="rounded-xl border border-default bg-surface-0 p-4 shadow-card">
                            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-surface-500">Origem</h3>
                            <button
                                onClick={() => navigate(`/orcamentos/${call.quote_id}`)}
                                className="inline-flex items-center gap-1 text-sm font-medium text-brand-600 hover:underline"
                            >
                                <LinkIcon className="h-4 w-4" />
                                Orçamento {call.quote?.quote_number ?? `#${call.quote_id}`}
                            </button>
                        </div>
                    )}

                    <div className="rounded-xl border border-default bg-surface-0 p-4 shadow-card">
                        <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-surface-500">Equipe</h3>
                        <div className="space-y-2 text-sm">
                            <p><span className="text-surface-500">Tecnico:</span> <span className="font-medium text-surface-800">{call.technician?.name ?? '-'}</span></p>
                            <p><span className="text-surface-500">Motorista:</span> <span className="font-medium text-surface-800">{call.driver?.name ?? '-'}</span></p>
                        </div>
                    </div>

                    <div className="rounded-xl border border-default bg-surface-0 p-4 shadow-card">
                        <h3 className="mb-3 flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-surface-500">
                            <ClipboardList className="h-3.5 w-3.5" />
                            Equipamentos
                        </h3>
                        {call.equipments && call.equipments.length > 0 ? (
                            <div className="space-y-2">
                                {call.equipments.map((eq) => (
                                    <div key={eq.id} className="rounded-lg bg-surface-50 px-3 py-2">
                                        <p className="text-sm font-medium text-surface-800">{eq.code || eq.type || `Equipamento #${eq.id}`}</p>
                                        <p className="text-xs text-surface-500">{[eq.brand, eq.model, eq.serial_number].filter(Boolean).join(' - ')}</p>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="text-[13px] text-surface-500">Nenhum equipamento vinculado</p>
                        )}
                    </div>

                    <div className="rounded-xl border border-default bg-surface-0 p-4 shadow-card">
                        <h3 className="mb-3 flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-surface-500">
                            <MapPin className="h-3.5 w-3.5" />
                            Local
                        </h3>
                        <p className="text-sm text-surface-700">
                            {([call.city, call.state].filter(Boolean) as string[]).join('/') || <span className="text-surface-400 italic">Não informado</span>}
                        </p>
                    </div>
                </div>
            </div>
        </div>
    )
}
