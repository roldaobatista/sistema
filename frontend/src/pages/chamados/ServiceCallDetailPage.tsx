import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { AxiosError } from 'axios'
import {
    ArrowLeft, Phone, Clock, Truck, AlertCircle, CheckCircle, XCircle,
    UserCheck, ArrowRight, MapPin, ClipboardList, Wrench, Link as LinkIcon,
    Send, AlertTriangle, RotateCcw, MessageSquare, Pencil,
} from 'lucide-react'
import api from '@/lib/api'
import { SERVICE_CALL_STATUS } from '@/lib/constants'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'
import { useAuthStore } from '@/stores/auth-store'
import { toast } from 'sonner'

const statusConfig: Record<string, { label: string; variant: any; icon: any }> = {
    [SERVICE_CALL_STATUS.OPEN]: { label: 'Aberto', variant: 'info', icon: AlertCircle },
    [SERVICE_CALL_STATUS.SCHEDULED]: { label: 'Agendado', variant: 'warning', icon: Clock },
    [SERVICE_CALL_STATUS.IN_TRANSIT]: { label: 'Em Trânsito', variant: 'info', icon: Truck },
    [SERVICE_CALL_STATUS.IN_PROGRESS]: { label: 'Em Atendimento', variant: 'warning', icon: ArrowRight },
    [SERVICE_CALL_STATUS.COMPLETED]: { label: 'Concluído', variant: 'success', icon: CheckCircle },
    [SERVICE_CALL_STATUS.CANCELLED]: { label: 'Cancelado', variant: 'danger', icon: XCircle },
}

const priorityConfig: Record<string, { label: string; variant: any }> = {
    low: { label: 'Baixa', variant: 'default' },
    normal: { label: 'Normal', variant: 'info' },
    high: { label: 'Alta', variant: 'warning' },
    urgent: { label: 'Urgente', variant: 'danger' },
}

// Must stay in sync with ServiceCall::ALLOWED_TRANSITIONS on backend
const statusTransitions: Record<string, string[]> = {
    open: ['scheduled', 'cancelled'],
    scheduled: ['in_transit', 'open', 'cancelled'],
    in_transit: ['in_progress', 'scheduled', 'cancelled'],
    in_progress: ['completed', 'cancelled'],
    completed: [],
    cancelled: ['open'],
}

function toLocalDateTimeInput(value?: string | null): string {
    if (!value) return ''

    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return ''

    const timezoneOffset = date.getTimezoneOffset() * 60000
    return new Date(date.getTime() - timezoneOffset).toISOString().slice(0, 16)
}

export function ServiceCallDetailPage() {
    const { id } = useParams<{ id: string }>()
    const navigate = useNavigate()
    const queryClient = useQueryClient()
    const { hasPermission, hasRole } = useAuthStore()

    const [cancelModalOpen, setCancelModalOpen] = useState(false)
    const [completeModalOpen, setCompleteModalOpen] = useState(false)
    const [reopenModalOpen, setReopenModalOpen] = useState(false)
    const [resolutionNotes, setResolutionNotes] = useState('')
    const [commentText, setCommentText] = useState('')
    const [activeTab, setActiveTab] = useState<'info' | 'comments'>('info')
    const [assignment, setAssignment] = useState({
        technician_id: '',
        driver_id: '',
        scheduled_date: '',
    })

    const canUpdate = hasRole('super_admin') || hasPermission('service_calls.service_call.update')
    const canAssign = hasRole('super_admin') || hasPermission('service_calls.service_call.assign')
    const canCreate = hasRole('super_admin') || hasPermission('service_calls.service_call.create')

    const { data: call, isLoading, isError } = useQuery({
        queryKey: ['service-call', id],
        const { data, isLoading, isError, refetch } = useQuery({
        queryFn: () => api.get(`/service-calls/${id}`).then((r) => r.data),
        enabled: !!id,
    })

    const { data: comments = [], refetch: refetchComments } = useQuery({
        queryKey: ['service-call-comments', id],
        const { data, isLoading, isError } = useQuery({
        queryFn: () => api.get(`/service-calls/${id}/comments`).then((r) => r.data),
        enabled: !!id,
    })

    const { data: assigneesRes } = useQuery({
        queryKey: ['service-call-assignees'],
        const { data, isLoading, isError } = useQuery({
        queryFn: () => api.get('/service-calls-assignees').then((r) => r.data),
        enabled: canAssign || canCreate,
    })

    const invalidateAll = () => {
        queryClient.invalidateQueries({ queryKey: ['service-call', id] })
        queryClient.invalidateQueries({ queryKey: ['service-calls'] })
        queryClient.invalidateQueries({ queryKey: ['service-calls-summary'] })
    }

    useEffect(() => {
        if (!call) return
        setAssignment({
            technician_id: call.technician_id ? String(call.technician_id) : '',
            driver_id: call.driver_id ? String(call.driver_id) : '',
            scheduled_date: toLocalDateTimeInput(call.scheduled_date),
        })
    }, [call])

    const statusMutation = useMutation({
        mutationFn: (data: { status: string; resolution_notes?: string }) =>
            api.put(`/service-calls/${id}/status`, data),
        onSuccess: () => {
            toast.success('Status atualizado com sucesso')
            invalidateAll()
            setCancelModalOpen(false)
            setCompleteModalOpen(false)
            setReopenModalOpen(false)
            setResolutionNotes('')
        },
        onError: (err: AxiosError<any>) => {
            toast.error(err.response?.data?.message || 'Erro ao atualizar status')
        },
    })

    const commentMutation = useMutation({
        mutationFn: (content: string) => api.post(`/service-calls/${id}/comments`, { content }),
        onSuccess: () => {
            toast.success('Comentário adicionado')
                setCommentText('')
            refetchComments()
        },
        onError: (err: AxiosError<any>) => {
            toast.error(err.response?.data?.message || 'Erro ao adicionar comentário')
        },
    })

    const assignMutation = useMutation({
        mutationFn: (data: { technician_id: number; driver_id?: number; scheduled_date?: string }) =>
            api.put(`/service-calls/${id}/assign`, data),
        onSuccess: (res) => {
            toast.success('Atribuicao atualizada com sucesso')
            invalidateAll()

            setAssignment({
                technician_id: res.data.technician_id ? String(res.data.technician_id) : '',
                driver_id: res.data.driver_id ? String(res.data.driver_id) : '',
                scheduled_date: toLocalDateTimeInput(res.data.scheduled_date),
            })
        },
        onError: (err: AxiosError<any>) => {
            toast.error(err.response?.data?.message || 'Erro ao atribuir tecnico')
        },
    })

    const convertMutation = useMutation({
        mutationFn: () => api.post(`/service-calls/${id}/convert-to-os`),
        onSuccess: (res) => {
            toast.success('OS criada com sucesso!')
            invalidateAll()
            navigate(`/os/${res.data.id}`)
        },
        onError: (err: AxiosError<any>) => {
            if (err.response?.status === 409) {
                toast.error(err.response.data?.message || 'Chamado já possui OS')
            } else {
                toast.error(err.response?.data?.message || 'Erro ao converter')
            }
        },
    })

    if (isLoading) {
        return (
            <div className="space-y-6 animate-pulse">
                <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-64" />
                <div className="bg-white dark:bg-gray-800 rounded-xl p-6 space-y-4">
                    <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-48" />
                    <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-full" />
                    <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4" />
                </div>
            </div>
        )
    }

    if (isError || !call) {
        return (
            <div className="flex flex-col items-center justify-center py-20 text-gray-500">
                <AlertCircle className="w-12 h-12 mb-4 opacity-30" />
                <p className="text-lg font-medium">Chamado não encontrado</p>
                <Button variant="outline" className="mt-4" onClick={() => navigate('/chamados')}>
                    <ArrowLeft className="w-4 h-4 mr-1" /> Voltar
                </Button>
            </div>
        )
    }

    const sc = statusConfig[call.status]
    const pc = priorityConfig[call.priority]
    const StatusIcon = sc?.icon || AlertCircle
    const transitions = statusTransitions[call.status] || []
    const technicians = assigneesRes?.technicians ?? []
    const drivers = assigneesRes?.drivers ?? []

    const handleStatusChange = (newStatus: string) => {
        if (newStatus === 'cancelled') {
            setCancelModalOpen(true)
        } else if (newStatus === 'completed') {
            setCompleteModalOpen(true)
        } else if (newStatus === 'open' && call.status === 'cancelled') {
            setReopenModalOpen(true)
        } else {
            statusMutation.mutate({ status: newStatus })
        }
    }

    const handleAssign = () => {
        if (!assignment.technician_id) {
            toast.error('Selecione um tecnico')
            return
        }

        assignMutation.mutate({
            technician_id: Number(assignment.technician_id),
            driver_id: assignment.driver_id ? Number(assignment.driver_id) : undefined,
            scheduled_date: assignment.scheduled_date || undefined,
        })
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <Button variant="ghost" size="sm" onClick={() => navigate('/chamados')}>
                        <ArrowLeft className="w-4 h-4" />
                    </Button>
                    <div>
                        <h1 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                            Chamado {call.call_number}
                            <Badge variant={sc?.variant || 'default'}>
                                <StatusIcon className="w-3 h-3 mr-1" />
                                {sc?.label || call.status}
                            </Badge>
                            {pc && <Badge variant={pc.variant}>{pc.label}</Badge>}
                            {call.sla_breached && (
                                <Badge variant="danger">
                                    <AlertTriangle className="w-3 h-3 mr-1" /> SLA Estourado
                                </Badge>
                            )}
                        </h1>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    {canUpdate && (
                        <Button variant="outline" size="sm" onClick={() => navigate(`/chamados/${id}/editar`)}>
                            <Pencil className="w-4 h-4 mr-1" /> Editar
                        </Button>
                    )}
                    {canCreate && ['completed', 'in_progress'].includes(call.status) && (
                        <Button
                            variant="outline"
                            size="sm"
                            loading={convertMutation.isPending}
                            onClick={() => convertMutation.mutate()}
                        >
                            <LinkIcon className="w-4 h-4 mr-1" /> Gerar OS
                        </Button>
                    )}
                </div>
            </div>

            {/* Status Actions */}
            {canUpdate && transitions.length > 0 && (
                <div className="flex flex-wrap gap-2">
                    {transitions.map((t) => {
                        const tc = statusConfig[t]
                        const TIcon = tc?.icon || ArrowRight
                        const isCancel = t === 'cancelled'
                        const isReopen = t === 'open'
                        return (
                            <Button
                                key={t}
                                variant={isCancel ? 'danger' : isReopen ? 'outline' : 'outline'}
                                size="sm"
                                loading={statusMutation.isPending}
                                onClick={() => handleStatusChange(t)}
                            >
                                {isReopen ? <RotateCcw className="w-4 h-4 mr-1" /> : <TIcon className="w-4 h-4 mr-1" />}
                                {isReopen ? 'Reabrir' : tc?.label || t}
                            </Button>
                        )
                    })}
                </div>
            )}

            {/* Tabs */}
            <div className="flex gap-1 border-b border-gray-200 dark:border-gray-700">
                <button
                    onClick={() => setActiveTab('info')}
                    className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === 'info'
                        ? 'border-primary-500 text-primary-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700'
                        }`}
                >
                    <ClipboardList className="w-4 h-4 inline mr-1" /> Informações
                </button>
                <button
                    onClick={() => setActiveTab('comments')}
                    className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === 'comments'
                        ? 'border-primary-500 text-primary-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700'
                        }`}
                >
                    <MessageSquare className="w-4 h-4 inline mr-1" /> Comentários
                    {comments.length > 0 && (
                        <span className="ml-1 px-1.5 py-0.5 text-xs bg-gray-200 dark:bg-gray-600 rounded-full">
                            {comments.length}
                        </span>
                    )}
                </button>
            </div>

            {activeTab === 'info' && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Customer & Contact */}
                    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-5 space-y-4">
                        <h2 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                            <Phone className="w-4 h-4" /> Cliente
                        </h2>
                        {call.customer ? (
                            <div className="space-y-2 text-sm">
                                <p className="font-medium text-gray-900 dark:text-white">{call.customer.name}</p>
                                {call.customer.phone && <p className="text-gray-600 dark:text-gray-400">{call.customer.phone}</p>}
                                {call.customer.email && <p className="text-gray-600 dark:text-gray-400">{call.customer.email}</p>}
                                {call.customer.contacts?.length > 0 && (
                                    <div className="mt-2 pt-2 border-t border-gray-100 dark:border-gray-700">
                                        <p className="text-xs font-medium text-gray-500 mb-1">Contatos</p>
                                        {call.customer.contacts.map((c: any) => (
                                            <p key={c.id} className="text-gray-600 dark:text-gray-400">
                                                {c.name} — {c.phone || c.email}
                                            </p>
                                        ))}
                                    </div>
                                )}
                            </div>
                        ) : (
                            <p className="text-gray-400 text-sm">Nenhum cliente</p>
                        )}
                    </div>

                    {/* Technician & Schedule */}
                    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-5 space-y-4">
                        <h2 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                            <UserCheck className="w-4 h-4" /> Técnico & Agendamento
                        </h2>
                        <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                                <span className="text-gray-500">Técnico</span>
                                <span className="font-medium">{call.technician?.name || <span className="text-gray-400 italic">Não atribuído</span>}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-gray-500">Motorista</span>
                                <span className="font-medium">{call.driver?.name || <span className="text-gray-400">—</span>}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-gray-500">Agendado para</span>
                                <span className="font-medium">
                                    {call.scheduled_date
                                        ? new Date(call.scheduled_date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
                                        : '—'}
                                </span>
                            </div>
                            {call.started_at && (
                                <div className="flex justify-between">
                                    <span className="text-gray-500">Iniciado em</span>
                                    <span className="font-medium">{new Date(call.started_at).toLocaleString('pt-BR')}</span>
                                </div>
                            )}
                            {call.completed_at && (
                                <div className="flex justify-between">
                                    <span className="text-gray-500">Concluído em</span>
                                    <span className="font-medium">{new Date(call.completed_at).toLocaleString('pt-BR')}</span>
                                </div>
                            )}
                            {call.response_time_minutes != null && (
                                <div className="flex justify-between">
                                    <span className="text-gray-500">Tempo de Resposta</span>
                                    <span className="font-medium">{call.response_time_minutes} min</span>
                                </div>
                            )}
                            {call.resolution_time_minutes != null && (
                                <div className="flex justify-between">
                                    <span className="text-gray-500">Tempo de Resolução</span>
                                    <span className="font-medium">{call.resolution_time_minutes} min</span>
                                </div>
                            )}
                            <div className="flex justify-between">
                                <span className="text-gray-500">Criado em</span>
                                <span className="font-medium">
                                    {call.created_at
                                        ? new Date(call.created_at).toLocaleString('pt-BR')
                                        : '—'}
                                </span>
                            </div>
                            {call.created_by && typeof call.created_by === 'object' && (
                                <div className="flex justify-between">
                                    <span className="text-gray-500">Criado por</span>
                                    <span className="font-medium">{call.created_by.name}</span>
                                </div>
                            )}
                            {call.quote && (
                                <div className="flex justify-between">
                                    <span className="text-gray-500">Orçamento</span>
                                    <button
                                        onClick={() => navigate(`/orcamentos/${call.quote.id}`)}
                                        className="font-medium text-primary-600 hover:underline"
                                    >
                                        {call.quote.quote_number || `#${call.quote.id}`}
                                    </button>
                                </div>
                            )}
                        </div>
                        {canAssign && (
                            <div className="mt-4 border-t border-gray-100 pt-4 dark:border-gray-700 space-y-3">
                                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                                    Atribuicao
                                </p>

                                <div>
                                    <label htmlFor="assign-technician" className="mb-1 block text-xs text-gray-500">Tecnico</label>
                                    <select
                                        id="assign-technician"
                                        value={assignment.technician_id}
                                        onChange={(e) => setAssignment((prev) => ({ ...prev, technician_id: e.target.value }))}
                                        className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700"
                                    >
                                        <option value="">Selecione</option>
                                        {technicians.map((tech: any) => (
                                            <option key={tech.id} value={tech.id}>
                                                {tech.name}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label htmlFor="assign-driver" className="mb-1 block text-xs text-gray-500">Motorista</label>
                                    <select
                                        id="assign-driver"
                                        value={assignment.driver_id}
                                        onChange={(e) => setAssignment((prev) => ({ ...prev, driver_id: e.target.value }))}
                                        className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700"
                                    >
                                        <option value="">Sem motorista</option>
                                        {drivers.map((driver: any) => (
                                            <option key={driver.id} value={driver.id}>
                                                {driver.name}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label htmlFor="assign-scheduled-date" className="mb-1 block text-xs text-gray-500">Data agendada</label>
                                    <input
                                        id="assign-scheduled-date"
                                        type="datetime-local"
                                        value={assignment.scheduled_date}
                                        onChange={(e) => setAssignment((prev) => ({ ...prev, scheduled_date: e.target.value }))}
                                        className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700"
                                    />
                                </div>

                                <div className="flex justify-end">
                                    <Button size="sm" loading={assignMutation.isPending} onClick={handleAssign}>
                                        Salvar atribuicao
                                    </Button>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Location */}
                    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-5 space-y-4">
                        <h2 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                            <MapPin className="w-4 h-4" /> Localização
                        </h2>
                        <div className="space-y-2 text-sm">
                            {call.address && <p className="text-gray-700 dark:text-gray-300">{call.address}</p>}
                            {call.city && <p className="text-gray-600 dark:text-gray-400">{call.city}/{call.state}</p>}
                            {call.latitude && call.longitude && (
                                <a
                                    href={`https://www.google.com/maps?q=${call.latitude},${call.longitude}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-primary-600 hover:underline text-xs"
                                >
                                    Ver no Google Maps ↗
                                </a>
                            )}
                            {!call.address && !call.city && <p className="text-gray-400">Sem endereço</p>}
                        </div>
                    </div>

                    {/* Equipments */}
                    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-5 space-y-4">
                        <h2 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                            <Wrench className="w-4 h-4" /> Equipamentos ({call.equipments?.length || 0})
                        </h2>
                        {call.equipments?.length > 0 ? (
                            <div className="space-y-2">
                                {call.equipments.map((eq: any) => (
                                    <div key={eq.id} className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-700/30 rounded-lg text-sm">
                                        <div>
                                            <p className="font-medium">{eq.tag || eq.model || `#${eq.id}`}</p>
                                            {eq.serial_number && <p className="text-xs text-gray-500">S/N: {eq.serial_number}</p>}
                                        </div>
                                        {eq.pivot?.observations && (
                                            <span className="text-xs text-gray-500 max-w-32 truncate">{eq.pivot.observations}</span>
                                        )}
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="text-gray-400 text-sm">Nenhum equipamento vinculado</p>
                        )}
                    </div>

                    {/* Observations & Resolution */}
                    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-5 space-y-4 lg:col-span-2">
                        <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Observações</h2>
                        <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                            {call.observations || <span className="text-gray-400">Sem observações</span>}
                        </p>
                        {call.resolution_notes && (
                            <>
                                <h2 className="text-sm font-semibold text-gray-900 dark:text-white mt-4">Notas de Resolução</h2>
                                <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{call.resolution_notes}</p>
                            </>
                        )}
                    </div>
                </div>
            )}

            {activeTab === 'comments' && (
                <div className="space-y-4">
                    {/* Add Comment */}
                    {canCreate && (
                        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
                            <textarea
                                value={commentText}
                                onChange={(e) => setCommentText(e.target.value)}
                                placeholder="Adicionar comentário interno..."
                                rows={3}
                                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm resize-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                            />
                            <div className="flex justify-end mt-2">
                                <Button
                                    size="sm"
                                    disabled={!commentText.trim()}
                                    loading={commentMutation.isPending}
                                    onClick={() => commentText.trim() && commentMutation.mutate(commentText.trim())}
                                >
                                    <Send className="w-4 h-4 mr-1" /> Enviar
                                </Button>
                            </div>
                        </div>
                    )}

                    {/* Comment List */}
                    {comments.length === 0 ? (
                        <div className="flex flex-col items-center py-12 text-gray-500">
                            <MessageSquare className="w-10 h-10 mb-3 opacity-30" />
                            <p className="text-sm">Nenhum comentário ainda</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {comments.map((c: any) => (
                                <div key={c.id} className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="text-sm font-medium text-gray-900 dark:text-white">
                                            {c.user?.name || 'Usuário'}
                                        </span>
                                        <span className="text-xs text-gray-500">
                                            {new Date(c.created_at).toLocaleString('pt-BR')}
                                        </span>
                                    </div>
                                    <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{c.content}</p>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Cancel Modal */}
            <Modal open={cancelModalOpen} onOpenChange={setCancelModalOpen} title="Cancelar Chamado">
                <div className="space-y-4">
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                        Tem certeza que deseja cancelar o chamado <strong>{call.call_number}</strong>?
                    </p>
                    <div className="flex justify-end gap-3">
                        <Button variant="outline" onClick={() => setCancelModalOpen(false)}>Voltar</Button>
                        <Button
                            variant="danger"
                            loading={statusMutation.isPending}
                            onClick={() => statusMutation.mutate({ status: 'cancelled' })}
                        >
                            <XCircle className="w-4 h-4 mr-1" /> Cancelar Chamado
                        </Button>
                    </div>
                </div>
            </Modal>

            {/* Complete Modal */}
            <Modal open={completeModalOpen} onOpenChange={setCompleteModalOpen} title="Concluir Chamado">
                <div className="space-y-4">
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                        Registre o que foi feito para concluir o chamado <strong>{call.call_number}</strong>.
                    </p>
                    <textarea
                        value={resolutionNotes}
                        onChange={(e) => setResolutionNotes(e.target.value)}
                        placeholder="Notas de resolução (opcional)..."
                        rows={4}
                        className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm resize-none focus:ring-2 focus:ring-primary-500"
                    />
                    <div className="flex justify-end gap-3">
                        <Button variant="outline" onClick={() => setCompleteModalOpen(false)}>Voltar</Button>
                        <Button
                            loading={statusMutation.isPending}
                            onClick={() => statusMutation.mutate({ status: 'completed', resolution_notes: resolutionNotes || undefined })}
                        >
                            <CheckCircle className="w-4 h-4 mr-1" /> Concluir
                        </Button>
                    </div>
                </div>
            </Modal>

            {/* Reopen Modal */}
            <Modal open={reopenModalOpen} onOpenChange={setReopenModalOpen} title="Reabrir Chamado">
                <div className="space-y-4">
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                        Deseja reabrir o chamado <strong>{call.call_number}</strong>?
                    </p>
                    <div className="flex justify-end gap-3">
                        <Button variant="outline" onClick={() => setReopenModalOpen(false)}>Voltar</Button>
                        <Button
                            loading={statusMutation.isPending}
                            onClick={() => statusMutation.mutate({ status: 'open' })}
                        >
                            <RotateCcw className="w-4 h-4 mr-1" /> Reabrir
                        </Button>
                    </div>
                </div>
            </Modal>
        </div>
    )
}
