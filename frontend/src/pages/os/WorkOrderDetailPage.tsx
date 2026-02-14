import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
    ArrowLeft, Clock, User, Phone, Mail, MapPin, ClipboardList,
    Briefcase, Package, Plus, Trash2, Pencil, Download, Save, X,
    CheckCircle2, AlertTriangle, Play, Pause, Truck, XCircle,
    DollarSign, CalendarDays, LinkIcon, Upload, Paperclip, Shield, Users, Copy, RotateCcw, Navigation,
} from 'lucide-react'
import api from '@/lib/api'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { IconButton } from '@/components/ui/iconbutton'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Modal } from '@/components/ui/modal'
import { SignaturePad } from '@/components/signature/SignaturePad'
import { useAuthStore } from '@/stores/auth-store'
import { usePriceGate } from '@/hooks/usePriceGate'
import SLACountdown from '@/components/common/SLACountdown'
import AdminChatTab from '@/components/os/AdminChatTab'
import AuditTrailTab from '@/components/os/AuditTrailTab'

const MAX_ATTACHMENT_SIZE_MB = 10

const statusConfig: Record<string, { label: string; variant: any; icon: any }> = {
    open: { label: 'Aberta', variant: 'info', icon: Clock },
    in_progress: { label: 'Em Andamento', variant: 'warning', icon: Play },
    waiting_parts: { label: 'Aguard. PeÃ§as', variant: 'warning', icon: Pause },
    waiting_approval: { label: 'Aguard. AprovaÃ§Ã£o', variant: 'brand', icon: Pause },
    completed: { label: 'ConcluÃ­da', variant: 'success', icon: CheckCircle2 },
    delivered: { label: 'Entregue', variant: 'success', icon: Truck },
    invoiced: { label: 'Faturada', variant: 'brand', icon: DollarSign },
    cancelled: { label: 'Cancelada', variant: 'danger', icon: XCircle },
}

const priorityConfig: Record<string, { label: string; variant: any }> = {
    low: { label: 'Baixa', variant: 'default' },
    normal: { label: 'Normal', variant: 'info' },
    high: { label: 'Alta', variant: 'warning' },
    urgent: { label: 'Urgente', variant: 'danger' },
}

export function WorkOrderDetailPage() {
    const { id } = useParams()
    const navigate = useNavigate()
    const qc = useQueryClient()
    const { hasPermission } = useAuthStore()
    const { canViewPrices } = usePriceGate()
    const canUpdate = hasPermission('os.work_order.update')
    const canChangeStatus = hasPermission('os.work_order.change_status')
    const canAuthorizeDispatch = hasPermission('os.work_order.authorize_dispatch')

    // State
    const [showStatusModal, setShowStatusModal] = useState(false)
    const [newStatus, setNewStatus] = useState('')
    const [statusNotes, setStatusNotes] = useState('')

    const [showItemModal, setShowItemModal] = useState(false)
    const [itemForm, setItemForm] = useState({
        type: 'service' as 'product' | 'service',
        reference_id: '' as string | number, description: '',
        quantity: '1', unit_price: '0', discount: '0',
    })
    const [editingItem, setEditingItem] = useState<any>(null)

    // Inline editing states
    const [isEditing, setIsEditing] = useState(false)
    const [editForm, setEditForm] = useState({
        description: '', priority: '', technical_report: '', internal_notes: '',
        displacement_value: '0',
    })
    const [activeTab, setActiveTab] = useState<'details' | 'checklist' | 'chat' | 'audit'>('details')

    // Delete confirmation state
    const [deleteItemId, setDeleteItemId] = useState<number | null>(null)
    const [deleteAttachId, setDeleteAttachId] = useState<number | null>(null)

    // Queries
    const { data: res, isLoading, isError, refetch: refetchOrder } = useQuery({
        queryKey: ['work-order', id],
        queryFn: () => api.get(`/work-orders/${id}`),
    })

    const { data: productsRes } = useQuery({
        queryKey: ['products-select'],
        queryFn: () => api.get('/products', { params: { per_page: 100, is_active: true } }),
    })

    const { data: servicesRes } = useQuery({
        queryKey: ['services-select'],
        queryFn: () => api.get('/services', { params: { per_page: 100, is_active: true } }),
    })

    const { data: checklistRes } = useQuery({
        queryKey: ['wo-checklist', id],
        queryFn: () => api.get(`/work-orders/${id}/checklist-responses`),
    })
    const checklistItems: any[] = checklistRes?.data?.data ?? []

    const order = res?.data
    const products = productsRes?.data?.data ?? []
    const services = servicesRes?.data?.data ?? []

    // Mutations
    const saveChecklistMut = useMutation({
        mutationFn: (responses: any[]) => api.post(`/work-orders/${id}/checklist-responses`, { responses }),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['wo-checklist', id] })
            toast.success('Checklist salvo com sucesso!')
        },
        onError: (err: any) => toast.error(err?.response?.data?.message || 'Erro ao salvar checklist'),
    })

    const statusMut = useMutation({
        mutationFn: (data: { status: string; notes: string }) =>
            api.post(`/work-orders/${id}/status`, data),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['work-order', id] })
            qc.invalidateQueries({ queryKey: ['work-orders'] })
            setShowStatusModal(false)
            toast.success('Status atualizado com sucesso!')
        },
        onError: (err: any) => toast.error(err?.response?.data?.message || 'Erro ao alterar status'),
    })

    const addItemMut = useMutation({
        mutationFn: (data: any) => api.post(`/work-orders/${id}/items`, data),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['work-order', id] })
            qc.invalidateQueries({ queryKey: ['work-orders'] })
            qc.invalidateQueries({ queryKey: ['stock'] })
            qc.invalidateQueries({ queryKey: ['products'] })
            setShowItemModal(false)
            toast.success('Item adicionado com sucesso!')
        },
        onError: (err: any) => toast.error(err?.response?.data?.message || 'Erro ao adicionar item'),
    })

    const updateItemMut = useMutation({
        mutationFn: (data: any) => api.put(`/work-orders/${id}/items/${editingItem?.id}`, data),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['work-order', id] })
            qc.invalidateQueries({ queryKey: ['work-orders'] })
            qc.invalidateQueries({ queryKey: ['stock'] })
            qc.invalidateQueries({ queryKey: ['products'] })
            setShowItemModal(false)
            setEditingItem(null)
            toast.success('Item atualizado com sucesso!')
        },
        onError: (err: any) => toast.error(err?.response?.data?.message || 'Erro ao atualizar item'),
    })

    const delItemMut = useMutation({
        mutationFn: (itemId: number) => api.delete(`/work-orders/${id}/items/${itemId}`),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['work-order', id] })
            qc.invalidateQueries({ queryKey: ['work-orders'] })
            qc.invalidateQueries({ queryKey: ['stock'] })
            qc.invalidateQueries({ queryKey: ['products'] })
            setDeleteItemId(null)
            toast.success('Item removido com sucesso!')
        },
        onError: (err: any) => toast.error(err?.response?.data?.message || 'Erro ao remover item'),
    })

    const updateMut = useMutation({
        mutationFn: (data: any) => api.put(`/work-orders/${id}`, data),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['work-order', id] })
            qc.invalidateQueries({ queryKey: ['work-orders'] })
            toast.success('AlteraÃ§Ãµes salvas com sucesso!')
        },
        onError: (err: any) => toast.error(err?.response?.data?.message || 'Erro ao salvar alteraÃ§Ãµes'),
    })

    // Attachment mutations
    const uploadAttachmentMut = useMutation({
        mutationFn: (formData: FormData) =>
            api.post(`/work-orders/${id}/attachments`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
            }),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['work-order', id] })
            toast.success('Anexo enviado com sucesso!')
        },
        onError: (err: any) => toast.error(err?.response?.data?.message || 'Erro ao enviar anexo'),
    })

    const deleteAttachmentMut = useMutation({
        mutationFn: (attachmentId: number) =>
            api.delete(`/work-orders/${id}/attachments/${attachmentId}`),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['work-order', id] })
            setDeleteAttachId(null)
            toast.success('Anexo removido com sucesso!')
        },
        onError: (err: any) => toast.error(err?.response?.data?.message || 'Erro ao remover anexo'),
    })

    const signMut = useMutation({
        mutationFn: (data: { signature: string; signer_name: string }) =>
            api.post(`/work-orders/${id}/signature`, data),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['work-order', id] })
            toast.success('Assinatura registrada com sucesso!')
        },
        onError: (err: any) => toast.error(err?.response?.data?.message || 'Erro ao salvar assinatura'),
    })

    const duplicateMut = useMutation({
        mutationFn: () => api.post(`/work-orders/${id}/duplicate`),
        onSuccess: (res: any) => {
            qc.invalidateQueries({ queryKey: ['work-orders'] })
            toast.success('OS duplicada com sucesso!')
            navigate(`/os/${res.data?.data?.id ?? res.data?.id}`)
        },
        onError: (err: any) => toast.error(err?.response?.data?.message || 'Erro ao duplicar OS'),
    })

    const reopenMut = useMutation({
        mutationFn: () => api.post(`/work-orders/${id}/reopen`),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['work-order', id] })
            qc.invalidateQueries({ queryKey: ['work-orders'] })
            toast.success('OS reaberta com sucesso!')
        },
        onError: (err: any) => toast.error(err?.response?.data?.message || 'Erro ao reabrir OS'),
    })

    const dispatchMut = useMutation({
        mutationFn: () => api.post(`/work-orders/${id}/authorize-dispatch`),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['work-order', id] })
            qc.invalidateQueries({ queryKey: ['work-orders'] })
            toast.success('Deslocamento autorizado!')
        },
        onError: (err: any) => toast.error(err?.response?.data?.message || 'Erro ao autorizar deslocamento'),
    })

    // Helpers
    const downloadPdf = async () => {
        try {
            const response = await api.get(`/work-orders/${id}/pdf`, { responseType: 'blob' })
            const blob = new Blob([response.data], { type: 'application/pdf' })
            const url = window.URL.createObjectURL(blob)
            const link = document.createElement('a')
            link.href = url
            link.download = `os-${id}.pdf`
            document.body.appendChild(link)
            link.click()
            link.remove()
            window.URL.revokeObjectURL(url)
        } catch {
            toast.error('Erro ao gerar PDF')
        }
    }

    if (isLoading || !order) {
        return (
            <div className="space-y-5">
                <div className="animate-pulse flex items-center gap-3">
                    <div className="h-8 w-8 rounded-lg bg-surface-200" />
                    <div className="space-y-1">
                        <div className="h-5 w-32 rounded bg-surface-200" />
                        <div className="h-3 w-48 rounded bg-surface-100" />
                    </div>
                </div>
                <div className="grid gap-6 lg:grid-cols-3">
                    <div className="lg:col-span-2 space-y-5">
                        <div className="animate-pulse rounded-xl border border-default bg-surface-0 p-5 shadow-card space-y-3">
                            <div className="h-4 w-28 rounded bg-surface-200" />
                            <div className="h-4 w-full rounded bg-surface-100" />
                            <div className="h-4 w-3/4 rounded bg-surface-100" />
                        </div>
                        <div className="animate-pulse rounded-xl border border-default bg-surface-0 p-5 shadow-card space-y-3">
                            <div className="h-4 w-20 rounded bg-surface-200" />
                            <div className="h-12 w-full rounded bg-surface-100" />
                            <div className="h-12 w-full rounded bg-surface-100" />
                        </div>
                    </div>
                    <div className="space-y-5">
                        <div className="animate-pulse rounded-xl border border-default bg-surface-0 p-5 shadow-card space-y-3">
                            <div className="h-4 w-20 rounded bg-surface-200" />
                            <div className="h-4 w-full rounded bg-surface-100" />
                            <div className="h-4 w-2/3 rounded bg-surface-100" />
                        </div>
                    </div>
                </div>
            </div>
        )
    }

    if (isError) {
        return (
            <div className="py-16 text-center">
                <AlertTriangle className="mx-auto h-12 w-12 text-red-300" />
                <p className="mt-3 text-sm text-surface-500">Erro ao carregar ordem de serviÃ§o</p>
                <Button className="mt-3" variant="outline" onClick={() => refetchOrder()}>Tentar novamente</Button>
            </div>
        )
    }

    const formatBRL = (v: string | number) =>
        parseFloat(String(v)).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

    const formatDate = (d: string | null) =>
        d ? new Date(d).toLocaleDateString('pt-BR', {
            day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit',
        }) : 'â€”'

    const sc = statusConfig[order.status] ?? statusConfig.open
    const StatusIcon = sc.icon

    const openItemForm = (item?: any) => {
        if (item) {
            setEditingItem(item)
            setItemForm({
                type: item.type,
                reference_id: item.reference_id ?? '',
                description: item.description,
                quantity: item.quantity,
                unit_price: item.unit_price,
                discount: item.discount,
            })
        } else {
            setEditingItem(null)
            setItemForm({ type: 'service', reference_id: '', description: '', quantity: '1', unit_price: '0', discount: '0' })
        }
        setShowItemModal(true)
    }

    const handleRefChange = (val: string) => {
        const list = itemForm.type === 'product' ? products : services
        const ref = list.find((r: any) => r.id === Number(val))
        setItemForm(prev => ({
            ...prev,
            reference_id: val,
            description: ref?.name ?? prev.description,
            unit_price: itemForm.type === 'product' ? (ref?.sell_price ?? '0') : (ref?.default_price ?? '0'),
        }))
    }

    const startEditing = () => {
        setEditForm({
            description: order.description ?? '',
            priority: order.priority ?? 'normal',
            technical_report: order.technical_report ?? '',
            internal_notes: order.internal_notes ?? '',
            displacement_value: order.displacement_value ?? '0',
        })
        setIsEditing(true)
    }

    const cancelEditing = () => setIsEditing(false)

    const saveEditing = () => {
        updateMut.mutate(editForm, { onSuccess: () => setIsEditing(false) })
    }

    return (
        <div className="space-y-5">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <IconButton label="Voltar" icon={<ArrowLeft className="h-5 w-5" />} onClick={() => navigate('/os')} />
                    <div>
                        <div className="flex items-center gap-2">
                            <h1 className="text-lg font-semibold text-surface-900 tracking-tight">{order.business_number ?? order.os_number ?? order.number}</h1>
                            <Badge variant={sc.variant} dot>{sc.label}</Badge>
                            {order.priority !== 'normal' && (
                                <Badge variant={priorityConfig[order.priority]?.variant ?? 'default'}>
                                    {priorityConfig[order.priority]?.label}
                                </Badge>
                            )}
                            <SLACountdown dueAt={order.sla_due_at} status={order.status} />
                        </div>
                        <p className="text-[13px] text-surface-500">Criada em {formatDate(order.created_at)}</p>
                        {/* Rastreabilidade */}
                        <div className="mt-1 flex items-center gap-2">
                            {order.quote_id && (
                                <button onClick={() => navigate(`/orcamentos/${order.quote_id}`)}
                                    className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700 hover:bg-amber-100 transition-colors">
                                    <LinkIcon className="h-3 w-3" /> OrÃ§amento #{order.quote?.number ?? order.quote_id}
                                </button>
                            )}
                            {order.service_call_id && (
                                <button onClick={() => navigate(`/chamados/${order.service_call_id}`)}
                                    className="inline-flex items-center gap-1 rounded-md bg-sky-50 px-2 py-0.5 text-xs font-medium text-sky-700 hover:bg-sky-100 transition-colors">
                                    <LinkIcon className="h-3 w-3" /> Chamado #{order.service_call_id}
                                </button>
                            )}
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    {canUpdate && (
                        !isEditing ? (
                            <Button variant="outline" icon={<Pencil className="h-4 w-4" />} onClick={startEditing}>
                                Editar
                            </Button>
                        ) : (
                            <>
                                <Button variant="outline" icon={<X className="h-4 w-4" />} onClick={cancelEditing}>
                                    Cancelar
                                </Button>
                                <Button icon={<Save className="h-4 w-4" />} onClick={saveEditing} loading={updateMut.isPending}>
                                    Salvar
                                </Button>
                            </>
                        )
                    )}
                    {hasPermission('os.work_order.create') && (
                        <Button variant="outline" icon={<Copy className="h-4 w-4" />}
                            onClick={() => duplicateMut.mutate()} loading={duplicateMut.isPending}>
                            Duplicar
                        </Button>
                    )}
                    {order.status === 'cancelled' && canChangeStatus && (
                        <Button variant="outline" icon={<RotateCcw className="h-4 w-4" />}
                            onClick={() => reopenMut.mutate()} loading={reopenMut.isPending}>
                            Reabrir
                        </Button>
                    )}
                    <Button variant="outline" icon={<Download className="h-4 w-4" />}
                        onClick={downloadPdf}>
                        Baixar PDF
                    </Button>
                    {canChangeStatus && (
                        <Button onClick={() => { setNewStatus(''); setStatusNotes(''); setShowStatusModal(true) }}>
                            Alterar Status
                        </Button>
                    )}
                </div>
            </div>

            <div className="flex items-center gap-1 border-b border-subtle mb-6">
                <button
                    onClick={() => setActiveTab('details')}
                    className={cn(
                        "px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px",
                        activeTab === 'details' ? "border-brand-500 text-brand-600" : "border-transparent text-surface-500 hover:text-surface-700"
                    )}
                >
                    InformaÃ§Ãµes Gerais
                </button>
                <button
                    onClick={() => setActiveTab('checklist')}
                    className={cn(
                        "px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px",
                        activeTab === 'checklist' ? "border-brand-500 text-brand-600" : "border-transparent text-surface-500 hover:text-surface-700"
                    )}
                >
                    Checklist
                </button>
                <button
                    onClick={() => setActiveTab('chat')}
                    className={cn(
                        "px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px flex items-center gap-2",
                        activeTab === 'chat' ? "border-brand-500 text-brand-600" : "border-transparent text-surface-500 hover:text-surface-700"
                    )}
                >
                    Chat Interno
                    <Badge variant="brand" className="px-1.5 py-0 text-[10px]">Beta</Badge>
                </button>
                <button
                    onClick={() => setActiveTab('audit')}
                    className={cn(
                        "px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px",
                        activeTab === 'audit' ? "border-brand-500 text-brand-600" : "border-transparent text-surface-500 hover:text-surface-700"
                    )}
                >
                    Auditoria
                </button>
            </div>

            <div className="grid gap-6 lg:grid-cols-3">
                {/* Main Content */}
                <div className="lg:col-span-2 space-y-5">
                    {activeTab === 'chat' && (
                        <AdminChatTab workOrderId={Number(id)} />
                    )}

                    {activeTab === 'audit' && (
                        <AuditTrailTab workOrderId={Number(id)} />
                    )}

                    {activeTab === 'details' && (
                        <>
                            {/* DescriÃ§Ã£o */}
                            <div className="rounded-xl border border-default bg-surface-0 p-5 shadow-card">
                                <h3 className="text-sm font-semibold text-surface-900 mb-2">Defeito Relatado</h3>
                                {isEditing ? (
                                    <textarea
                                        value={editForm.description}
                                        onChange={e => setEditForm(p => ({ ...p, description: e.target.value }))}
                                        rows={4}
                                        className="w-full rounded-lg border border-default bg-surface-50 px-3 py-2 text-sm focus:border-brand-400 focus:bg-surface-0 focus:outline-none focus:ring-2 focus:ring-brand-500/15"
                                    />
                                ) : (
                                    <p className="text-sm text-surface-700 whitespace-pre-wrap">{order.description}</p>
                                )}

                                {isEditing && (
                                    <div className="mt-4 border-t border-subtle pt-4">
                                        <h3 className="text-sm font-semibold text-surface-900 mb-2">Prioridade</h3>
                                        <div className="flex gap-2">
                                            {Object.entries(priorityConfig).map(([key, conf]) => (
                                                <button key={key} type="button" onClick={() => setEditForm(p => ({ ...p, priority: key }))}
                                                    className={cn('rounded-lg border px-3 py-1.5 text-xs font-medium transition-all',
                                                        editForm.priority === key
                                                            ? 'border-brand-500 bg-brand-50 text-brand-700'
                                                            : 'border-surface-200 text-surface-600 hover:border-surface-300')}>
                                                    {conf.label}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                <div className="mt-4 border-t border-subtle pt-4">
                                    <h3 className="text-sm font-semibold text-surface-900 mb-2">Laudo TÃ©cnico</h3>
                                    {isEditing ? (
                                        <textarea
                                            value={editForm.technical_report}
                                            onChange={e => setEditForm(p => ({ ...p, technical_report: e.target.value }))}
                                            rows={3}
                                            placeholder="Escreva o laudo tÃ©cnico..."
                                            className="w-full rounded-lg border border-default bg-surface-50 px-3 py-2 text-sm focus:border-brand-400 focus:bg-surface-0 focus:outline-none focus:ring-2 focus:ring-brand-500/15"
                                        />
                                    ) : (
                                        order.technical_report
                                            ? <p className="text-sm text-surface-700 whitespace-pre-wrap">{order.technical_report}</p>
                                            : <p className="text-sm text-surface-400 italic">Nenhum laudo registrado</p>
                                    )}
                                </div>

                                <div className="mt-4 border-t border-subtle pt-4">
                                    <h3 className="text-sm font-semibold text-surface-500 mb-1">ObservaÃ§Ãµes Internas</h3>
                                    {isEditing ? (
                                        <textarea
                                            value={editForm.internal_notes}
                                            onChange={e => setEditForm(p => ({ ...p, internal_notes: e.target.value }))}
                                            rows={2}
                                            placeholder="Notas internas..."
                                            className="w-full rounded-lg border border-default bg-surface-50 px-3 py-2 text-sm focus:border-brand-400 focus:bg-surface-0 focus:outline-none focus:ring-2 focus:ring-brand-500/15"
                                        />
                                    ) : (
                                        order.internal_notes
                                            ? <p className="text-xs text-surface-500 italic">{order.internal_notes}</p>
                                            : <p className="text-xs text-surface-400 italic">Nenhuma observaÃ§Ã£o interna</p>
                                    )}
                                </div>

                                <div className="mt-4 border-t border-subtle pt-4">
                                    <h3 className="text-sm font-semibold text-surface-500 mb-1">Deslocamento</h3>
                                    {isEditing && canViewPrices ? (
                                        <Input
                                            label="Valor do Deslocamento (R$)"
                                            type="number"
                                            step="0.01"
                                            value={editForm.displacement_value}
                                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEditForm(p => ({ ...p, displacement_value: e.target.value }))}
                                        />
                                    ) : canViewPrices ? (
                                        parseFloat(order.displacement_value ?? 0) > 0
                                            ? <p className="text-sm text-emerald-600 font-medium">+ {formatBRL(order.displacement_value)}</p>
                                            : <p className="text-sm text-surface-400 italic">Nenhum valor de deslocamento</p>
                                    ) : null}
                                </div>
                            </div>

                            {/* Itens List Section */}
                            <div className="rounded-xl border border-default bg-surface-0 p-5 shadow-card">
                                <div className="flex items-center justify-between mb-4">
                                    <h3 className="text-sm font-semibold text-surface-900">Itens</h3>
                                    {canUpdate && (
                                        <Button variant="ghost" size="sm" onClick={() => openItemForm()} icon={<Plus className="h-4 w-4" />}>
                                            Adicionar
                                        </Button>
                                    )}
                                </div>

                                {order.items?.length === 0 ? (
                                    <p className="py-6 text-center text-sm text-surface-400">Nenhum item</p>
                                ) : (
                                    <div className="space-y-2">
                                        {order.items?.map((item: any) => (
                                            <div key={item.id} className="flex items-center gap-3 rounded-lg border border-surface-100 p-3 hover:bg-surface-50">
                                                <div className={cn('rounded-md p-1.5', item.type === 'product' ? 'bg-brand-50' : 'bg-emerald-50')}>
                                                    {item.type === 'product'
                                                        ? <Package className="h-4 w-4 text-brand-600" />
                                                        : <Briefcase className="h-4 w-4 text-emerald-600" />}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm font-medium text-surface-800">{item.description}</p>
                                                    <p className="text-xs text-surface-400">
                                                        {item.quantity}{canViewPrices ? ` Ã— ${formatBRL(item.unit_price)}` : ` un.`}
                                                    </p>
                                                </div>
                                                {canViewPrices && (
                                                    <span className="text-sm font-semibold text-surface-900">{formatBRL(item.total)}</span>
                                                )}
                                                {canUpdate && (
                                                    <div className="flex gap-1">
                                                        <IconButton label="Editar item" icon={<Pencil className="h-3.5 w-3.5" />} onClick={() => openItemForm(item)} className="hover:text-brand-600" />
                                                        <IconButton label="Remover item" icon={<Trash2 className="h-3.5 w-3.5" />} onClick={() => setDeleteItemId(item.id)} className="hover:text-red-600" />
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                        {canViewPrices && (
                                            <>
                                                <div className="flex items-center justify-between border-t border-subtle pt-3 mt-3">
                                                    <span className="text-sm font-medium text-surface-600">Desconto fixo</span>
                                                    <span className="text-[13px] text-surface-600">{formatBRL(order.discount ?? 0)}</span>
                                                </div>
                                                {parseFloat(order.discount_percentage ?? 0) > 0 && (
                                                    <div className="flex items-center justify-between">
                                                        <span className="text-sm font-medium text-surface-600">Desconto (%)</span>
                                                        <span className="text-[13px] text-surface-600">{order.discount_percentage}% ({formatBRL(order.discount_amount ?? 0)})</span>
                                                    </div>
                                                )}
                                                {parseFloat(order.displacement_value ?? 0) > 0 && (
                                                    <div className="flex items-center justify-between">
                                                        <span className="text-sm font-medium text-surface-600">Deslocamento</span>
                                                        <span className="text-[13px] text-emerald-600">+ {formatBRL(order.displacement_value)}</span>
                                                    </div>
                                                )}
                                                <div className="flex items-center justify-between">
                                                    <span className="text-base font-bold text-surface-900">Total</span>
                                                    <span className="text-base font-bold text-brand-600">{formatBRL(order.total)}</span>
                                                </div>
                                            </>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* Anexos / Fotos */}
                            <div className="rounded-xl border border-default bg-surface-0 p-5 shadow-card">
                                <div className="flex items-center justify-between mb-4">
                                    <h3 className="text-sm font-semibold text-surface-900 flex items-center gap-2">
                                        <Paperclip className="h-4 w-4 text-brand-500" />
                                        Anexos
                                    </h3>
                                    {canUpdate && (
                                        <label className="cursor-pointer">
                                            <input
                                                type="file"
                                                className="hidden"
                                                onChange={(e) => {
                                                    const file = e.target.files?.[0]
                                                    if (!file) return
                                                    if (file.size > MAX_ATTACHMENT_SIZE_MB * 1024 * 1024) {
                                                        toast.error(`Arquivo excede ${MAX_ATTACHMENT_SIZE_MB}MB`)
                                                        return
                                                    }
                                                    const fd = new FormData()
                                                    fd.append('file', file)
                                                    uploadAttachmentMut.mutate(fd)
                                                    e.target.value = ''
                                                }}
                                            />
                                            <Button variant="ghost" size="sm" icon={<Upload className="h-4 w-4" />}>
                                                <span>Enviar</span>
                                            </Button>
                                        </label>
                                    )}
                                </div>

                                {(!order.attachments || order.attachments.length === 0) ? (
                                    <p className="py-4 text-center text-sm text-surface-400">Nenhum anexo</p>
                                ) : (
                                    <div className="space-y-2">
                                        {order.attachments.map((att: any) => (
                                            <div key={att.id} className="flex items-center gap-3 rounded-lg border border-surface-100 p-3 hover:bg-surface-50">
                                                <div className="rounded-md bg-surface-100 p-1.5">
                                                    <Paperclip className="h-4 w-4 text-surface-500" />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm font-medium text-surface-800 truncate">{att.file_name}</p>
                                                    <p className="text-xs text-surface-400">
                                                        {att.uploader?.name ?? 'Sistema'} Â· {(att.file_size / 1024).toFixed(0)}KB
                                                    </p>
                                                </div>
                                                <div className="flex gap-1">
                                                    <IconButton label="Baixar anexo" icon={<Download className="h-3.5 w-3.5" />} onClick={() => {
                                                        const base = (api.defaults.baseURL ?? '').replace(/\/api\/?$/, '');
                                                        window.open(`${base}/storage/${att.file_path}`, '_blank');
                                                    }} />
                                                    {canUpdate && (
                                                        <IconButton label="Remover anexo" icon={<Trash2 className="h-3.5 w-3.5" />} onClick={() => setDeleteAttachId(att.id)} className="hover:text-red-600" />
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </>
                    )}
                </div>

                {/* Sidebar */}
                <div className="space-y-6">
                    <div className="rounded-xl border border-default bg-surface-0 p-5 shadow-card">
                        <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-surface-900">
                            <User className="h-4 w-4 text-brand-500" />
                            Cliente
                        </h3>
                        <div className="space-y-3">
                            <div>
                                <p className="text-xs text-surface-500">Nome</p>
                                <p className="font-medium text-surface-900">{order.customer?.name}</p>
                            </div>
                            <div>
                                <p className="text-xs text-surface-500">Documento</p>
                                <p className="font-medium text-surface-900">{order.customer?.document || 'â€”'}</p>
                            </div>
                            <div>
                                <p className="text-xs text-surface-500">Contato</p>
                                <p className="font-medium text-surface-900">
                                    {order.customer?.contacts?.[0]?.phone || order.customer?.email || 'â€”'}
                                </p>
                            </div>

                            {/* Navigation Links */}
                            <div className="flex flex-col gap-2 pt-2 border-t border-subtle">
                                {order.waze_link && (
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="w-full justify-start text-[#33ccff] border-[#33ccff]/30 hover:bg-[#33ccff]/5"
                                        onClick={() => window.open(order.waze_link)}
                                    >
                                        <Navigation className="h-4 w-4 mr-2" /> Navegar com Waze
                                    </Button>
                                )}
                                {order.google_maps_link && (
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="w-full justify-start text-[#4285F4] border-[#4285F4]/30 hover:bg-[#4285F4]/5"
                                        onClick={() => window.open(order.google_maps_link, '_blank')}
                                    >
                                        <MapPin className="h-4 w-4 mr-2" /> Navegar com Google Maps
                                    </Button>
                                )}
                            </div>
                        </div>
                    </div>
                    {/* Placeholder for Timeline/Checklist if needed */}

                    {/* Equipamentos */}
                    {
                        (order.equipment || order.equipments_list?.length > 0) && (
                            <div className="rounded-xl border border-default bg-surface-0 p-5 shadow-card">
                                <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-surface-900">
                                    <Shield className="h-4 w-4 text-brand-500" />
                                    Equipamentos
                                </h3>
                                <div className="space-y-2">
                                    {order.equipment && (
                                        <div className="rounded-lg border border-surface-100 p-2.5">
                                            <p className="text-sm font-medium text-surface-800">{order.equipment.type} {order.equipment.brand ?? ''} {order.equipment.model ?? ''}</p>
                                            {order.equipment.serial_number && <p className="text-xs text-surface-400">S/N: {order.equipment.serial_number}</p>}
                                        </div>
                                    )}
                                    {order.equipments_list?.map((eq: any) => (
                                        <div key={eq.id} className="rounded-lg border border-surface-100 p-2.5">
                                            <p className="text-sm font-medium text-surface-800">{eq.type} {eq.brand ?? ''} {eq.model ?? ''}</p>
                                            {eq.serial_number && <p className="text-xs text-surface-400">S/N: {eq.serial_number}</p>}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )
                    }

                    {/* TÃ©cnicos */}
                    {
                        order.technicians?.length > 0 && (
                            <div className="rounded-xl border border-default bg-surface-0 p-5 shadow-card">
                                <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-surface-900">
                                    <Users className="h-4 w-4 text-brand-500" />
                                    TÃ©cnicos
                                </h3>
                                <div className="flex flex-wrap gap-1.5">
                                    {order.technicians.map((t: any) => (
                                        <span key={t.id} className="rounded-lg bg-brand-50 px-2.5 py-1 text-xs font-medium text-brand-700">
                                            {t.name}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )
                    }

                    {/* AutorizaÃ§Ã£o de Deslocamento */}
                    <div className="rounded-xl border border-default bg-surface-0 p-5 shadow-card">
                        <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-surface-900">
                            <Navigation className="h-4 w-4 text-brand-500" />
                            Deslocamento
                        </h3>
                        {order.dispatch_authorized_at ? (
                            <div className="space-y-2">
                                <Badge variant="success" dot>Autorizado</Badge>
                                <div>
                                    <p className="text-xs text-surface-500">Autorizado em</p>
                                    <p className="text-sm font-medium text-surface-900">{formatDate(order.dispatch_authorized_at)}</p>
                                </div>
                                {order.dispatch_authorizer && (
                                    <div>
                                        <p className="text-xs text-surface-500">Por</p>
                                        <p className="text-sm font-medium text-surface-900">{order.dispatch_authorizer.name}</p>
                                    </div>
                                )}
                                {order.driver && (
                                    <div>
                                        <p className="text-xs text-surface-500">Motorista</p>
                                        <p className="text-sm font-medium text-surface-900">{order.driver.name}</p>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="space-y-3">
                                <Badge variant="warning" dot>Aguardando autorizaÃ§Ã£o</Badge>
                                {order.driver && (
                                    <div>
                                        <p className="text-xs text-surface-500">Motorista designado</p>
                                        <p className="text-sm font-medium text-surface-900">{order.driver.name}</p>
                                    </div>
                                )}
                                {canAuthorizeDispatch && ['open', 'in_progress'].includes(order.status) && (
                                    <Button
                                        variant="outline" size="sm" className="w-full"
                                        icon={<Navigation className="h-4 w-4" />}
                                        onClick={() => dispatchMut.mutate()}
                                        loading={dispatchMut.isPending}
                                    >
                                        Autorizar Deslocamento
                                    </Button>
                                )}
                            </div>
                        )}
                    </div>

                    {/* SLA Info */}
                    {
                        (order.sla_due_at || order.sla_responded_at) && (
                            <div className="rounded-xl border border-default bg-surface-0 p-5 shadow-card">
                                <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-surface-900">
                                    <CalendarDays className="h-4 w-4 text-brand-500" />
                                    SLA
                                </h3>
                                <div className="space-y-2">
                                    {order.sla_due_at && (
                                        <div>
                                            <p className="text-xs text-surface-500">Prazo SLA</p>
                                            <p className="font-medium text-surface-900">{formatDate(order.sla_due_at)}</p>
                                        </div>
                                    )}
                                    {order.sla_responded_at && (
                                        <div>
                                            <p className="text-xs text-surface-500">Respondido em</p>
                                            <p className="font-medium text-surface-900">{formatDate(order.sla_responded_at)}</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )
                    }

                    {/* Garantia */}
                    {
                        (order.warranty_until || order.warranty_terms) && (
                            <div className="rounded-xl border border-default bg-surface-0 p-5 shadow-card">
                                <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-surface-900">
                                    <Shield className="h-4 w-4 text-emerald-500" />
                                    Garantia
                                </h3>
                                <div className="space-y-2">
                                    {order.warranty_until && (
                                        <div>
                                            <p className="text-xs text-surface-500">VÃ¡lida atÃ©</p>
                                            <p className="font-medium text-surface-900">{formatDate(order.warranty_until)}</p>
                                        </div>
                                    )}
                                    {order.warranty_terms && (
                                        <div>
                                            <p className="text-xs text-surface-500">Termos</p>
                                            <p className="text-sm text-surface-700">{order.warranty_terms}</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )
                    }

                    {/* Assinatura do Cliente (somente quando completed ou delivered) */}
                    {
                        ['completed', 'delivered'].includes(order.status) && !order.signature_path && (
                            <div className="rounded-xl border border-default bg-surface-0 p-5 shadow-card">
                                <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-surface-900">
                                    <Pencil className="h-4 w-4 text-brand-500" />
                                    Assinatura do Cliente
                                </h3>
                                <SignaturePad
                                    onSave={(data) => signMut.mutate(data)}
                                />
                            </div>
                        )
                    }
                    {
                        order.signature_path && (
                            <div className="rounded-xl border border-default bg-surface-0 p-5 shadow-card">
                                <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-surface-900">
                                    <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                                    Assinatura Registrada
                                </h3>
                                <div className="space-y-2">
                                    <img src={order.signature_path} alt="Assinatura" className="max-h-24 rounded-lg border border-surface-100" />
                                    {order.signed_by_name && <p className="text-sm text-surface-600">{order.signed_by_name}</p>}
                                    {order.signature_at && <p className="text-xs text-surface-400">{formatDate(order.signature_at)}</p>}
                                </div>
                            </div>
                        )
                    }

                    {/* Timeline / HistÃ³rico de Status */}
                    {
                        order.status_history?.length > 0 && (
                            <div className="rounded-xl border border-default bg-surface-0 p-5 shadow-card">
                                <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-surface-900">
                                    <Clock className="h-4 w-4 text-brand-500" />
                                    HistÃ³rico
                                </h3>
                                <div className="space-y-3">
                                    {order.status_history.map((h: any) => {
                                        const cfg = statusConfig[h.to_status]
                                        return (
                                            <div key={h.id} className="flex items-start gap-3">
                                                <div className="flex-shrink-0 mt-1">
                                                    <div className={cn('h-2.5 w-2.5 rounded-full', cfg ? `bg-${cfg.variant === 'info' ? 'sky' : cfg.variant === 'warning' ? 'amber' : cfg.variant === 'success' ? 'emerald' : cfg.variant === 'danger' ? 'red' : 'brand'}-500` : 'bg-surface-300')} />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm font-medium text-surface-800">{cfg?.label ?? h.to_status}</p>
                                                    {h.notes && <p className="text-xs text-surface-500 mt-0.5">{h.notes}</p>}
                                                    <p className="text-xs text-surface-400 mt-0.5">
                                                        {h.user?.name ?? 'Sistema'} Â· {formatDate(h.created_at)}
                                                    </p>
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                            </div>
                        )
                    }


                </div >
            </div >

            {/* Add/Edit Item Modal */}
            < Modal open={showItemModal} onOpenChange={(open) => { setShowItemModal(open); if (!open) setEditingItem(null) }} title={editingItem ? "Editar Item" : "Adicionar Item"} >
                <form onSubmit={e => {
                    e.preventDefault()
                    const payload = { ...itemForm, reference_id: itemForm.reference_id || null }
                    if (editingItem) {
                        updateItemMut.mutate(payload)
                    } else {
                        addItemMut.mutate(payload)
                    }
                }} className="space-y-4">
                    <div className="flex rounded-lg border border-surface-200 overflow-hidden">
                        {(['product', 'service'] as const).map(t => (
                            <button key={t} type="button" onClick={() => setItemForm(p => ({ ...p, type: t, reference_id: '' }))}
                                className={cn('flex-1 py-2 text-sm font-medium transition-colors',
                                    itemForm.type === t ? (t === 'product' ? 'bg-brand-50 text-brand-700' : 'bg-emerald-50 text-emerald-700') : 'text-surface-500')}>
                                {t === 'product' ? 'Produto' : 'ServiÃ§o'}
                            </button>
                        ))}
                    </div>
                    <div>
                        <label className="mb-1.5 block text-[13px] font-medium text-surface-700">
                            {itemForm.type === 'product' ? 'Produto' : 'ServiÃ§o'}
                        </label>
                        <select value={itemForm.reference_id} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => handleRefChange(e.target.value)}
                            className="w-full rounded-lg border border-default bg-surface-50 px-3 py-2.5 text-sm focus:border-brand-400 focus:bg-surface-0 focus:outline-none focus:ring-2 focus:ring-brand-500/15">
                            <option value="">â€” Selecionar â€”</option>
                            {(itemForm.type === 'product' ? products : services).map((r: any) => (
                                <option key={r.id} value={r.id}>{r.name}</option>
                            ))}
                        </select>
                    </div>
                    <Input label="DescriÃ§Ã£o" value={itemForm.description}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setItemForm(p => ({ ...p, description: e.target.value }))} required />
                    <div className={`grid gap-3 ${canViewPrices ? 'grid-cols-3' : 'grid-cols-1'}`}>
                        <Input label="Qtd" type="number" step="0.01" value={itemForm.quantity}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setItemForm(p => ({ ...p, quantity: e.target.value }))} />
                        {canViewPrices && (
                            <>
                                <Input label="PreÃ§o Un." type="number" step="0.01" value={itemForm.unit_price}
                                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setItemForm(p => ({ ...p, unit_price: e.target.value }))} />
                                <Input label="Desconto" type="number" step="0.01" value={itemForm.discount}
                                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setItemForm(p => ({ ...p, discount: e.target.value }))} />
                            </>
                        )}
                    </div>
                    <div className="flex justify-end gap-2">
                        <Button variant="outline" type="button" onClick={() => setShowItemModal(false)}>Cancelar</Button>
                        <Button type="submit" loading={addItemMut.isPending || updateItemMut.isPending}>
                            {editingItem ? 'Salvar' : 'Adicionar'}
                        </Button>
                    </div>
                </form>
            </Modal >

            {/* Status Modal */}
            < Modal open={showStatusModal} onOpenChange={setShowStatusModal} title="Alterar Status" >
                <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-2">
                        {Object.entries(statusConfig)
                            .filter(([k]) => (order.allowed_transitions ?? []).includes(k))
                            .map(([k, v]) => (
                                <button key={k} onClick={() => setNewStatus(k)}
                                    className={cn('flex items-center gap-2 rounded-lg border p-3 text-sm transition-all',
                                        newStatus === k ? 'border-brand-500 bg-brand-50 ring-1 ring-brand-500' : 'border-surface-200 hover:border-surface-300')}>
                                    <v.icon className={cn('h-4 w-4', newStatus === k ? 'text-brand-600' : 'text-surface-400')} />
                                    <span className={cn('font-medium', newStatus === k ? 'text-surface-900' : 'text-surface-600')}>{v.label}</span>
                                </button>
                            ))}
                        {(order.allowed_transitions ?? []).length === 0 && (
                            <p className="col-span-2 py-4 text-center text-sm text-surface-400">Este status Ã© final. NÃ£o hÃ¡ transiÃ§Ãµes disponÃ­veis.</p>
                        )}
                    </div>
                    <Input label="ObservaÃ§Ãµes (Opcional)" value={statusNotes} onChange={(e: any) => setStatusNotes(e.target.value)} />
                    <div className="flex justify-end gap-2 pt-2">
                        <Button variant="outline" onClick={() => setShowStatusModal(false)}>Cancelar</Button>
                        <Button onClick={() => statusMut.mutate({ status: newStatus, notes: statusNotes })} disabled={!newStatus} loading={statusMut.isPending}>Confirmar</Button>
                    </div>
                </div>
            </Modal >

            {/* Delete Item Confirmation Modal */}
            < Modal open={deleteItemId !== null} onOpenChange={(open) => { if (!open) setDeleteItemId(null) }} title="Confirmar RemoÃ§Ã£o" >
                <div className="space-y-4">
                    <p className="text-sm text-surface-600">Tem certeza que deseja remover este item? Esta aÃ§Ã£o nÃ£o pode ser desfeita.</p>
                    <div className="flex justify-end gap-2">
                        <Button variant="outline" onClick={() => setDeleteItemId(null)}>Cancelar</Button>
                        <Button
                            variant="danger"
                            onClick={() => { if (deleteItemId) delItemMut.mutate(deleteItemId) }}
                            loading={delItemMut.isPending}
                        >
                            Remover
                        </Button>
                    </div>
                </div>
            </Modal >

            {/* Delete Attachment Confirmation Modal */}
            < Modal open={deleteAttachId !== null} onOpenChange={(open) => { if (!open) setDeleteAttachId(null) }} title="Confirmar RemoÃ§Ã£o" >
                <div className="space-y-4">
                    <p className="text-sm text-surface-600">Tem certeza que deseja remover este anexo? Esta aÃ§Ã£o nÃ£o pode ser desfeita.</p>
                    <div className="flex justify-end gap-2">
                        <Button variant="outline" onClick={() => setDeleteAttachId(null)}>Cancelar</Button>
                        <Button
                            variant="danger"
                            onClick={() => { if (deleteAttachId) { if (window.confirm('Deseja realmente excluir este registro?')) deleteAttachmentMut.mutate(deleteAttachId) } }}
                            loading={deleteAttachmentMut.isPending}
                        >
                            Remover
                        </Button>
                    </div>
                </div>
            </Modal >

        </div >
    )
}