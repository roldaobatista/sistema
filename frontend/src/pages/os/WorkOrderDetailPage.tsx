import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
    ArrowLeft, Clock, User, Phone, Mail, MapPin, ClipboardList,
    Briefcase, Package, Plus, Trash2, Pencil, Download, Save, X,
    CheckCircle2, AlertTriangle, Play, Pause, Truck, XCircle,
    DollarSign, CalendarDays, LinkIcon, Upload, Paperclip, Shield, Users, Copy, RotateCcw, Navigation, QrCode, TrendingUp, Layers,
} from 'lucide-react'
import { parseLabelQrPayload } from '@/lib/labelQr'
import api from '@/lib/api'
import { broadcastQueryInvalidation } from '@/lib/cross-tab-sync'
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
import PriceHistoryHint from '@/components/common/PriceHistoryHint'
import AdminChatTab from '@/components/os/AdminChatTab'
import AuditTrailTab from '@/components/os/AuditTrailTab'
import GeoCheckinButton from '@/components/os/GeoCheckinButton'
import SatisfactionTab from '@/components/os/SatisfactionTab'
import StatusTimeline from '@/components/os/StatusTimeline'
import ExecutionTimer from '@/components/os/ExecutionTimer'
import BeforeAfterPhotos from '@/components/os/BeforeAfterPhotos'
import ShareOS from '@/components/os/ShareOS'
import ProfitabilityIndicator from '@/components/os/ProfitabilityIndicator'
import DragDropUpload from '@/components/os/DragDropUpload'
import TagManager from '@/components/os/TagManager'
import FavoriteButton from '@/components/os/FavoriteButton'
import EquipmentHistory from '@/components/os/EquipmentHistory'
import TimeReport from '@/components/os/TimeReport'
import MissingPartsIndicator from '@/components/os/MissingPartsIndicator'
import QRTracking from '@/components/os/QRTracking'
import AuditDiffViewer from '@/components/os/AuditDiffViewer'
import PhotoChecklist from '@/components/os/PhotoChecklist'
import DeliveryForecast from '@/components/os/DeliveryForecast'
import ApprovalChain from '@/components/os/ApprovalChain'
import { QrScannerModal } from '@/components/qr/QrScannerModal'

const MAX_ATTACHMENT_SIZE_MB = 50

const statusConfig: Record<string, { label: string; variant: any; icon: any }> = {
    open: { label: 'Aberta', variant: 'info', icon: Clock },
    awaiting_dispatch: { label: 'Aguard. Despacho', variant: 'warning', icon: Clock },
    in_progress: { label: 'Em Andamento', variant: 'warning', icon: Play },
    waiting_parts: { label: 'Aguard. Peças', variant: 'warning', icon: Pause },
    waiting_approval: { label: 'Aguard. Aprovação', variant: 'brand', icon: Pause },
    completed: { label: 'Concluída', variant: 'success', icon: CheckCircle2 },
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
        is_warranty: false,
    })
    const [activeTab, setActiveTab] = useState<'details' | 'checklist' | 'chat' | 'audit' | 'satisfaction'>('details')

    // Delete confirmation state
    const [deleteItemId, setDeleteItemId] = useState<number | null>(null)
    const [deleteAttachId, setDeleteAttachId] = useState<number | null>(null)
    const [showQrScanner, setShowQrScanner] = useState(false)

    // Equipment attach/detach state
    const [showEquipmentModal, setShowEquipmentModal] = useState(false)
    const [detachEquipId, setDetachEquipId] = useState<number | null>(null)

    // Cost estimate & kit states
    const [showCostEstimate, setShowCostEstimate] = useState(false)
    const [showKitModal, setShowKitModal] = useState(false)

    // Queries
    const { data: res, isLoading, isError, refetch: refetchOrder } = useQuery({
        queryKey: ['work-order', id],
        queryFn: () => api.get(`/work-orders/${id}`),
    })
    const order = res?.data

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
    const checklistResponses: any[] = checklistRes?.data?.data ?? []

    const { data: checklistTemplateRes } = useQuery({
        queryKey: ['wo-checklist-template', order?.checklist_id],
        queryFn: () => api.get(`/service-checklists/${order?.checklist_id}`),
        enabled: !!order?.checklist_id,
    })
    const checklistTemplate = checklistTemplateRes?.data?.data ?? checklistTemplateRes?.data ?? null
    const checklistTemplateItems: any[] = checklistTemplate?.items ?? []

    const [checklistForm, setChecklistForm] = useState<Record<number, { value: string; notes: string }>>({})

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
            qc.invalidateQueries({ queryKey: ['dashboard'] })
            broadcastQueryInvalidation(['work-orders', 'dashboard'], 'Ordem de Serviço')
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
            broadcastQueryInvalidation(['work-orders', 'stock', 'products'], 'Item de OS')
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
            broadcastQueryInvalidation(['work-orders', 'stock', 'products'], 'Item de OS')
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
            broadcastQueryInvalidation(['work-orders', 'stock', 'products'], 'Item de OS')
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
            broadcastQueryInvalidation(['work-orders'], 'Ordem de Serviço')
            toast.success('Alterações salvas com sucesso!')
        },
        onError: (err: any) => toast.error(err?.response?.data?.message || 'Erro ao salvar alterações'),
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

    // Equipment attach/detach mutations
    const { data: customerEquipmentsRes } = useQuery({
        queryKey: ['customer-equipments', order?.customer_id],
        queryFn: () => api.get('/equipments', { params: { customer_id: order?.customer_id, per_page: 100 } }),
        enabled: !!order?.customer_id && showEquipmentModal,
    })
    const customerEquipments = customerEquipmentsRes?.data?.data ?? []

    const attachEquipMut = useMutation({
        mutationFn: (equipmentId: number) => api.post(`/work-orders/${id}/equipments`, { equipment_id: equipmentId }),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['work-order', id] })
            setShowEquipmentModal(false)
            toast.success('Equipamento vinculado com sucesso!')
        },
        onError: (err: any) => toast.error(err?.response?.data?.message || 'Erro ao vincular equipamento'),
    })

    const detachEquipMut = useMutation({
        mutationFn: (equipmentId: number) => api.delete(`/work-orders/${id}/equipments/${equipmentId}`),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['work-order', id] })
            setDetachEquipId(null)
            toast.success('Equipamento desvinculado!')
        },
        onError: (err: any) => toast.error(err?.response?.data?.message || 'Erro ao desvincular equipamento'),
    })

    // Cost estimate query (lazy)
    const { data: costEstimateRes, isLoading: costEstimateLoading } = useQuery({
        queryKey: ['wo-cost-estimate', id],
        queryFn: () => api.get(`/work-orders/${id}/cost-estimate`),
        enabled: showCostEstimate && canViewPrices,
    })
    const costEstimate = costEstimateRes?.data

    // Parts kits query (lazy - loaded when modal opens)
    const { data: partsKitsRes } = useQuery({
        queryKey: ['parts-kits-select'],
        queryFn: () => api.get('/parts-kits', { params: { per_page: 100 } }),
        enabled: showKitModal,
    })
    const partsKits = partsKitsRes?.data?.data ?? []

    const applyKitMut = useMutation({
        mutationFn: (kitId: number) => api.post(`/work-orders/${id}/apply-kit/${kitId}`),
        onSuccess: (res: any) => {
            qc.invalidateQueries({ queryKey: ['work-order', id] })
            qc.invalidateQueries({ queryKey: ['work-orders'] })
            qc.invalidateQueries({ queryKey: ['stock'] })
            qc.invalidateQueries({ queryKey: ['products'] })
            qc.invalidateQueries({ queryKey: ['wo-cost-estimate', id] })
            setShowKitModal(false)
            toast.success(res?.data?.message || 'Kit aplicado com sucesso!')
        },
        onError: (err: any) => toast.error(err?.response?.data?.message || 'Erro ao aplicar kit'),
    })

    const duplicateMut = useMutation({
        mutationFn: () => api.post(`/work-orders/${id}/duplicate`),
        onSuccess: (res: any) => {
            qc.invalidateQueries({ queryKey: ['work-orders'] })
            broadcastQueryInvalidation(['work-orders', 'dashboard'], 'Ordem de Serviço')
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
            broadcastQueryInvalidation(['work-orders', 'dashboard'], 'Ordem de Serviço')
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
                <p className="mt-3 text-sm text-surface-500">Erro ao carregar ordem de serviço</p>
                <Button className="mt-3" variant="outline" onClick={() => refetchOrder()}>Tentar novamente</Button>
            </div>
        )
    }

    const formatBRL = (v: string | number) =>
        parseFloat(String(v)).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

    const formatDate = (d: string | null) =>
        d ? new Date(d).toLocaleDateString('pt-BR', {
            day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit',
        }) : '—'

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

    const handleScanLabel = () => setShowQrScanner(true)

    const handleQrScanned = async (raw: string) => {
        const productId = parseLabelQrPayload(raw)
        if (!productId) {
            toast.error('Código inválido. Use o formato P seguido do número (ex: P123).')
            return
        }
        try {
            const { data: product } = await api.get(`/products/${productId}`)
            setEditingItem(null)
            setItemForm({
                type: 'product',
                reference_id: String(product.id),
                description: product.name ?? '',
                quantity: '1',
                unit_price: product.sell_price ?? '0',
                discount: '0',
            })
            setShowItemModal(true)
        } catch {
            toast.error('Produto não encontrado.')
        }
    }

    const startEditing = () => {
        setEditForm({
            description: order.description ?? '',
            priority: order.priority ?? 'normal',
            technical_report: order.technical_report ?? '',
            internal_notes: order.internal_notes ?? '',
            displacement_value: order.displacement_value ?? '0',
            is_warranty: order.is_warranty ?? false,
        })
        setIsEditing(true)
    }

    const cancelEditing = () => setIsEditing(false)

    const saveEditing = () => {
        updateMut.mutate(editForm, { onSuccess: () => setIsEditing(false) })
    }

    return (
        <div className="space-y-5">
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
                            {order.is_warranty && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-50 text-amber-700 text-xs font-bold rounded-full border border-amber-200">
                                    GARANTIA
                                </span>
                            )}
                            <SLACountdown dueAt={order.sla_due_at} status={order.status} />
                        </div>
                        <p className="text-sm text-surface-500">Criada em {formatDate(order.created_at)}</p>
                        <div className="mt-1 flex items-center gap-2">
                            {order.quote_id && (
                                <button onClick={() => navigate(`/orcamentos/${order.quote_id}`)}
                                    className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700 hover:bg-amber-100 transition-colors">
                                    <LinkIcon className="h-3 w-3" /> Orçamento #{order.quote?.number ?? order.quote_id}
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
                    <GeoCheckinButton
                        workOrderId={Number(id)}
                        hasCheckin={!!order.checkin_at}
                        hasCheckout={!!order.checkout_at}
                    />
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

            <StatusTimeline
                currentStatus={order.status}
                statusHistory={order.status_history ?? []}
            />

            <div className="flex items-center gap-1 border-b border-subtle mb-6">
                <button
                    onClick={() => setActiveTab('details')}
                    className={cn(
                        "px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px",
                        activeTab === 'details' ? "border-brand-500 text-brand-600" : "border-transparent text-surface-500 hover:text-surface-700"
                    )}
                >
                    Informações Gerais
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
                    <Badge variant="brand" className="px-1.5 py-0 text-xs">Beta</Badge>
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
                {(order.status === 'completed' || order.status === 'delivered' || order.status === 'invoiced') && (
                    <button
                        onClick={() => setActiveTab('satisfaction')}
                        className={cn(
                            "px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px",
                            activeTab === 'satisfaction' ? "border-brand-500 text-brand-600" : "border-transparent text-surface-500 hover:text-surface-700"
                        )}
                    >
                        Satisfação
                    </button>
                )}
            </div>

            <div className="grid gap-6 lg:grid-cols-3">
                <div className="lg:col-span-2 space-y-5">
                    {activeTab === 'checklist' && (
                        <div className="rounded-xl border border-default bg-surface-0 p-5 shadow-card">
                            <h3 className="text-sm font-semibold text-surface-900 mb-4 flex items-center gap-2">
                                <ClipboardList className="h-4 w-4 text-brand-500" />
                                Checklist de Serviço
                            </h3>
                            {!order.checklist_id ? (
                                <p className="py-8 text-center text-sm text-surface-400">
                                    Nenhum checklist vinculado a esta OS.
                                </p>
                            ) : checklistTemplateItems.length === 0 ? (
                                <div className="py-8 text-center">
                                    <div className="animate-pulse space-y-2">
                                        <div className="h-4 w-40 mx-auto rounded bg-surface-200" />
                                        <div className="h-4 w-56 mx-auto rounded bg-surface-100" />
                                    </div>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    {checklistTemplateItems.map((item: any) => {
                                        const existing = checklistResponses.find((r: any) => r.checklist_item_id === item.id)
                                        const currentVal = checklistForm[item.id]?.value ?? existing?.value ?? ''
                                        const currentNotes = checklistForm[item.id]?.notes ?? existing?.notes ?? ''
                                        const isAnswered = !!existing?.value || !!checklistForm[item.id]?.value

                                        const updateField = (field: 'value' | 'notes', val: string) => {
                                            setChecklistForm(prev => ({
                                                ...prev,
                                                [item.id]: {
                                                    value: field === 'value' ? val : (prev[item.id]?.value ?? existing?.value ?? ''),
                                                    notes: field === 'notes' ? val : (prev[item.id]?.notes ?? existing?.notes ?? ''),
                                                },
                                            }))
                                        }

                                        return (
                                            <div key={item.id} className={cn(
                                                'rounded-lg border p-4 transition-colors',
                                                isAnswered ? 'border-emerald-200 bg-emerald-50/30' : 'border-default'
                                            )}>
                                                <div className="flex items-start gap-3">
                                                    <div className={cn(
                                                        'mt-0.5 flex h-5 w-5 items-center justify-center rounded-full text-xs font-bold',
                                                        isAnswered ? 'bg-emerald-500 text-white' : 'bg-surface-200 text-surface-500'
                                                    )}>
                                                        {isAnswered ? '✓' : item.order_index + 1}
                                                    </div>
                                                    <div className="flex-1 space-y-2">
                                                        <p className="text-sm font-medium text-surface-800">
                                                            {item.description}
                                                            {item.is_required && <span className="ml-1 text-red-500">*</span>}
                                                        </p>
                                                        {item.type === 'check' || item.type === 'yes_no' ? (
                                                            <div className="flex gap-2">
                                                                {(item.type === 'yes_no' ? ['Sim', 'Não'] : ['OK', 'NOK', 'N/A']).map(opt => (
                                                                    <button key={opt} type="button"
                                                                        onClick={() => canUpdate ? updateField('value', opt) : undefined}
                                                                        className={cn(
                                                                            'rounded-lg border px-3 py-1.5 text-xs font-medium transition-all',
                                                                            currentVal === opt
                                                                                ? opt === 'OK' || opt === 'Sim' ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                                                                                    : opt === 'NOK' || opt === 'Não' ? 'border-red-400 bg-red-50 text-red-700'
                                                                                        : 'border-surface-400 bg-surface-100 text-surface-700'
                                                                                : 'border-default text-surface-500 hover:border-surface-400',
                                                                            !canUpdate && 'opacity-70 cursor-default'
                                                                        )}
                                                                    >
                                                                        {opt}
                                                                    </button>
                                                                ))}
                                                            </div>
                                                        ) : item.type === 'number' ? (
                                                            <input type="number" step="0.01" value={currentVal}
                                                                onChange={e => updateField('value', e.target.value)}
                                                                readOnly={!canUpdate}
                                                                placeholder="Valor numérico..."
                                                                className="w-40 rounded-lg border border-default bg-surface-50 px-3 py-2 text-sm focus:border-brand-400 focus:bg-surface-0 focus:outline-none focus:ring-2 focus:ring-brand-500/15" />
                                                        ) : (
                                                            <input type="text" value={currentVal}
                                                                onChange={e => updateField('value', e.target.value)}
                                                                readOnly={!canUpdate}
                                                                placeholder="Resposta..."
                                                                className="w-full rounded-lg border border-default bg-surface-50 px-3 py-2 text-sm focus:border-brand-400 focus:bg-surface-0 focus:outline-none focus:ring-2 focus:ring-brand-500/15" />
                                                        )}
                                                        <input type="text" value={currentNotes}
                                                            onChange={e => updateField('notes', e.target.value)}
                                                            readOnly={!canUpdate}
                                                            placeholder="Observações (opcional)..."
                                                            className="w-full rounded-lg border border-default bg-surface-50 px-3 py-1.5 text-xs text-surface-500 focus:border-brand-400 focus:bg-surface-0 focus:outline-none focus:ring-2 focus:ring-brand-500/15" />
                                                    </div>
                                                </div>
                                            </div>
                                        )
                                    })}
                                    {canUpdate && (
                                        <div className="flex justify-end pt-2">
                                            <Button
                                                onClick={() => {
                                                    const responses = Object.entries(checklistForm).map(([itemId, data]) => ({
                                                        checklist_item_id: Number(itemId),
                                                        value: data.value,
                                                        notes: data.notes,
                                                    }))
                                                    if (responses.length === 0) {
                                                        toast.info('Preencha ao menos um item do checklist.')
                                                        return
                                                    }
                                                    saveChecklistMut.mutate(responses)
                                                }}
                                                loading={saveChecklistMut.isPending}
                                                icon={<Save className="h-4 w-4" />}
                                            >
                                                Salvar Checklist
                                            </Button>
                                        </div>
                                    )}
                                    <div className="flex items-center gap-2 text-xs text-surface-400 pt-2 border-t border-subtle">
                                        <span>{checklistResponses.length} / {checklistTemplateItems.length} respondidos</span>
                                        {checklistTemplate?.name && <span>· {checklistTemplate.name}</span>}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {activeTab === 'chat' && (
                        <AdminChatTab workOrderId={Number(id)} />
                    )}

                    {activeTab === 'audit' && (
                        <AuditTrailTab workOrderId={Number(id)} />
                    )}

                    {activeTab === 'satisfaction' && (
                        <SatisfactionTab workOrderId={Number(id)} />
                    )}

                    {activeTab === 'details' && (
                        <>
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
                                    <div className="mt-4 border-t border-subtle pt-4 space-y-4">
                                        <div>
                                            <h3 className="text-sm font-semibold text-surface-900 mb-2">Prioridade</h3>
                                            <div className="flex gap-2">
                                                {Object.entries(priorityConfig).map(([key, conf]) => (
                                                    <button key={key} type="button" onClick={() => setEditForm(p => ({ ...p, priority: key }))}
                                                        className={cn('rounded-lg border px-3 py-1.5 text-xs font-medium transition-all',
                                                            editForm.priority === key
                                                                ? 'border-brand-500 bg-brand-50 text-brand-700'
                                                                : 'border-default text-surface-600 hover:border-surface-400')}>
                                                        {conf.label}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                        <div>
                                            <label className="flex items-center gap-2 text-sm text-surface-700 cursor-pointer">
                                                <input
                                                    type="checkbox"
                                                    checked={editForm.is_warranty}
                                                    onChange={e => setEditForm(p => ({ ...p, is_warranty: e.target.checked }))}
                                                    className="rounded border-surface-400 text-brand-600 focus:ring-brand-500"
                                                />
                                                OS de Garantia
                                                <span className="text-xs text-surface-400">(não gera comissão)</span>
                                            </label>
                                        </div>
                                    </div>
                                )}

                                <div className="mt-4 border-t border-subtle pt-4">
                                    <h3 className="text-sm font-semibold text-surface-900 mb-2">Laudo Técnico</h3>
                                    {isEditing ? (
                                        <textarea
                                            value={editForm.technical_report}
                                            onChange={e => setEditForm(p => ({ ...p, technical_report: e.target.value }))}
                                            rows={3}
                                            placeholder="Escreva o laudo técnico..."
                                            className="w-full rounded-lg border border-default bg-surface-50 px-3 py-2 text-sm focus:border-brand-400 focus:bg-surface-0 focus:outline-none focus:ring-2 focus:ring-brand-500/15"
                                        />
                                    ) : (
                                        order.technical_report
                                            ? <p className="text-sm text-surface-700 whitespace-pre-wrap">{order.technical_report}</p>
                                            : <p className="text-sm text-surface-400 italic">Nenhum laudo registrado</p>
                                    )}
                                </div>

                                <div className="mt-4 border-t border-subtle pt-4">
                                    <h3 className="text-sm font-semibold text-surface-500 mb-1">Observações Internas</h3>
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
                                            : <p className="text-xs text-surface-400 italic">Nenhuma observação interna</p>
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

                                {order.displacement_started_at && (
                                    <div className="mt-4 border-t border-subtle pt-4">
                                        <h3 className="text-sm font-semibold text-surface-900 mb-3">Deslocamento do Técnico</h3>
                                        <div className="space-y-2 text-sm">
                                            <div className="flex justify-between">
                                                <span className="text-surface-500">Início</span>
                                                <span className="font-medium">{order.displacement_started_at ? new Date(order.displacement_started_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—'}</span>
                                            </div>
                                            {order.displacement_arrived_at && (
                                                <>
                                                    <div className="flex justify-between">
                                                        <span className="text-surface-500">Chegada</span>
                                                        <span className="font-medium">{new Date(order.displacement_arrived_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
                                                    </div>
                                                    {order.displacement_duration_minutes != null && (
                                                        <div className="flex justify-between">
                                                            <span className="text-surface-500">Tempo em deslocamento</span>
                                                            <span className="font-medium text-emerald-600">{order.displacement_duration_minutes} min</span>
                                                        </div>
                                                    )}
                                                </>
                                            )}
                                            {order.displacement_stops && order.displacement_stops.length > 0 && (
                                                <div className="mt-3 pt-3 border-t border-subtle">
                                                    <p className="text-xs font-medium text-surface-500 mb-2">Paradas</p>
                                                    <ul className="space-y-1.5">
                                                        {order.displacement_stops.map((s: { id: number; type: string; started_at: string; ended_at?: string | null }) => {
                                                            const typeLabels: Record<string, string> = { lunch: 'Almoço', hotel: 'Hotel', br_stop: 'Parada BR', other: 'Outro' }
                                                            const start = new Date(s.started_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
                                                            const end = s.ended_at ? new Date(s.ended_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : 'em andamento'
                                                            return (
                                                                <li key={s.id} className="flex justify-between text-xs">
                                                                    <span>{typeLabels[s.type] ?? s.type} ({start} – {end})</span>
                                                                </li>
                                                            )
                                                        })}
                                                    </ul>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className="rounded-xl border border-default bg-surface-0 p-5 shadow-card">
                                <div className="flex items-center justify-between mb-4">
                                    <h3 className="text-sm font-semibold text-surface-900">Itens</h3>
                                    {canUpdate && (
                                        <div className="flex gap-1">
                                            <Button variant="ghost" size="sm" onClick={() => openItemForm()} icon={<Plus className="h-4 w-4" />}>
                                                Adicionar
                                            </Button>
                                            <Button variant="ghost" size="sm" onClick={() => setShowKitModal(true)} icon={<Layers className="h-4 w-4" />} title="Aplicar kit de peças">
                                                Aplicar Kit
                                            </Button>
                                            <Button variant="ghost" size="sm" onClick={handleScanLabel} icon={<QrCode className="h-4 w-4" />} title="Escanear etiqueta (QR da peça)">
                                                Escanear etiqueta
                                            </Button>
                                        </div>
                                    )}
                                </div>

                                {order.items?.length === 0 ? (
                                    <p className="py-6 text-center text-sm text-surface-400">Nenhum item</p>
                                ) : (
                                    <div className="space-y-2">
                                        {order.items?.map((item: any) => (
                                            <div key={item.id} className="flex items-center gap-3 rounded-lg border border-default p-3 hover:bg-surface-50">
                                                <div className={cn('rounded-md p-1.5', item.type === 'product' ? 'bg-brand-50' : 'bg-emerald-50')}>
                                                    {item.type === 'product'
                                                        ? <Package className="h-4 w-4 text-brand-600" />
                                                        : <Briefcase className="h-4 w-4 text-emerald-600" />}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm font-medium text-surface-800">{item.description}</p>
                                                    <p className="text-xs text-surface-400">
                                                        {item.quantity}{canViewPrices ? ` × ${formatBRL(item.unit_price)}` : ` un.`}
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
                                                    <span className="text-sm text-surface-600">{formatBRL(order.discount ?? 0)}</span>
                                                </div>
                                                {parseFloat(order.discount_percentage ?? 0) > 0 && (
                                                    <div className="flex items-center justify-between">
                                                        <span className="text-sm font-medium text-surface-600">Desconto (%)</span>
                                                        <span className="text-sm text-surface-600">{order.discount_percentage}% ({formatBRL(order.discount_amount ?? 0)})</span>
                                                    </div>
                                                )}
                                                {parseFloat(order.displacement_value ?? 0) > 0 && (
                                                    <div className="flex items-center justify-between">
                                                        <span className="text-sm font-medium text-surface-600">Deslocamento</span>
                                                        <span className="text-sm text-emerald-600">+ {formatBRL(order.displacement_value)}</span>
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

                                {/* Drag & Drop Upload */}
                                {canUpdate && <DragDropUpload workOrderId={order.id} />}

                                {(!order.attachments || order.attachments.length === 0) ? (
                                    <p className="py-4 text-center text-sm text-surface-400">Nenhum anexo</p>
                                ) : (
                                    <div className="space-y-2">
                                        {order.attachments.map((att: any) => (
                                            <div key={att.id} className="flex items-center gap-3 rounded-lg border border-default p-3 hover:bg-surface-50">
                                                <div className="rounded-md bg-surface-100 p-1.5">
                                                    <Paperclip className="h-4 w-4 text-surface-500" />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm font-medium text-surface-800 truncate">{att.file_name}</p>
                                                    <p className="text-xs text-surface-400">
                                                        {att.uploader?.name ?? 'Sistema'} · {(att.file_size / 1024).toFixed(0)}KB
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
                                <p className="font-medium text-surface-900">{order.customer?.document || '—'}</p>
                            </div>
                            <div>
                                <p className="text-xs text-surface-500">Contato</p>
                                <p className="font-medium text-surface-900">
                                    {order.customer?.contacts?.[0]?.phone || order.customer?.email || '—'}
                                </p>
                            </div>

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

                    <div className="rounded-xl border border-default bg-surface-0 p-5 shadow-card">
                        <div className="flex items-center justify-between mb-3">
                            <h3 className="flex items-center gap-2 text-sm font-semibold text-surface-900">
                                <Shield className="h-4 w-4 text-brand-500" />
                                Equipamentos
                            </h3>
                            {canUpdate && (
                                <Button variant="ghost" size="sm" onClick={() => setShowEquipmentModal(true)} icon={<Plus className="h-4 w-4" />}>
                                    Vincular
                                </Button>
                            )}
                        </div>
                        {!order.equipment && (!order.equipments_list || order.equipments_list.length === 0) ? (
                            <p className="py-4 text-center text-sm text-surface-400">Nenhum equipamento vinculado</p>
                        ) : (
                            <div className="space-y-2">
                                {order.equipment && (
                                    <div className="flex items-center gap-2 rounded-lg border border-default p-2.5">
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium text-surface-800">{order.equipment.type} {order.equipment.brand ?? ''} {order.equipment.model ?? ''}</p>
                                            {order.equipment.serial_number && <p className="text-xs text-surface-400">S/N: {order.equipment.serial_number}</p>}
                                        </div>
                                    </div>
                                )}
                                {order.equipments_list?.map((eq: any) => (
                                    <div key={eq.id} className="flex items-center gap-2 rounded-lg border border-default p-2.5">
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium text-surface-800">{eq.type} {eq.brand ?? ''} {eq.model ?? ''}</p>
                                            {eq.serial_number && <p className="text-xs text-surface-400">S/N: {eq.serial_number}</p>}
                                        </div>
                                        {canUpdate && (
                                            <IconButton
                                                label="Desvincular equipamento"
                                                icon={<X className="h-3.5 w-3.5" />}
                                                onClick={() => setDetachEquipId(eq.id)}
                                                className="hover:text-red-600 flex-shrink-0"
                                            />
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {
                        order.technicians?.length > 0 && (
                            <div className="rounded-xl border border-default bg-surface-0 p-5 shadow-card">
                                <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-surface-900">
                                    <Users className="h-4 w-4 text-brand-500" />
                                    Técnicos
                                </h3>
                                <div className="flex flex-wrap gap-1.5">
                                    {order.technicians.map((t: any) => (
                                        <span key={t.id} className="rounded-lg bg-brand-50 px-2.5 py-1 text-xs font-medium text-brand-700">
                                            {t.name}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}

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
                                <Badge variant="warning" dot>Aguardando autorização</Badge>
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

                    {/* Timer de Execução */}
                    <ExecutionTimer workOrderId={order.id} status={order.status} />

                    {/* Fotos Antes/Depois */}
                    <BeforeAfterPhotos workOrderId={order.id} />

                    {/* Compartilhamento */}
                    <ShareOS
                        workOrderId={order.id}
                        osNumber={order.business_number ?? order.os_number ?? order.number}
                        customerName={order.customer?.name ?? ''}
                        status={statusConfig[order.status]?.label ?? order.status}
                    />

                    {/* Indicador de Rentabilidade */}
                    {canViewPrices && costEstimate && (
                        <ProfitabilityIndicator
                            revenue={parseFloat(costEstimate.revenue ?? '0')}
                            totalCost={parseFloat(costEstimate.total_cost ?? '0')}
                        />
                    )}

                    {/* Tags Personalizadas */}
                    <TagManager workOrderId={order.id} currentTags={order.tags ?? []} />

                    {/* Histórico do Equipamento */}
                    {order.equipment?.id && (
                        <EquipmentHistory equipmentId={order.equipment.id} currentWorkOrderId={order.id} />
                    )}

                    {/* Relatório Tempo por Técnico */}
                    <TimeReport workOrderId={order.id} />

                    {/* Peças em Falta */}
                    {order.items?.length > 0 && (
                        <MissingPartsIndicator items={order.items} />
                    )}

                    {/* QR Code Rastreamento */}
                    <QRTracking
                        workOrderId={order.id}
                        osNumber={order.business_number ?? order.os_number ?? order.number}
                    />

                    {/* Previsão de Entrega */}
                    <DeliveryForecast
                        workOrderId={order.id}
                        currentForecast={order.delivery_forecast}
                    />

                    {/* Checklist com Fotos */}
                    <PhotoChecklist
                        workOrderId={order.id}
                        initialItems={order.checklist ?? []}
                    />

                    {/* Cadeia de Aprovação */}
                    <ApprovalChain
                        workOrderId={order.id}
                        currentUserId={user?.id ?? 0}
                    />

                    {/* Estimativa de Custo */}
                    {canViewPrices && (
                        <div className="rounded-xl border border-default bg-surface-0 p-5 shadow-card">
                            <button
                                onClick={() => setShowCostEstimate(prev => !prev)}
                                className="flex w-full items-center justify-between text-sm font-semibold text-surface-900"
                            >
                                <span className="flex items-center gap-2">
                                    <TrendingUp className="h-4 w-4 text-brand-500" />
                                    Estimativa de Custo
                                </span>
                                <span className="text-xs text-surface-400">{showCostEstimate ? '▲' : '▼'}</span>
                            </button>
                            {showCostEstimate && (
                                costEstimateLoading ? (
                                    <div className="mt-3 space-y-2">
                                        <div className="h-4 w-full rounded bg-surface-100 animate-pulse" />
                                        <div className="h-4 w-2/3 rounded bg-surface-100 animate-pulse" />
                                    </div>
                                ) : costEstimate ? (
                                    <div className="mt-3 space-y-2 text-sm">
                                        <div className="flex justify-between">
                                            <span className="text-surface-500">Peças</span>
                                            <span className="font-medium">{formatBRL(costEstimate.parts_cost)}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-surface-500">Mão de obra ({costEstimate.labor_hours}h)</span>
                                            <span className="font-medium">{formatBRL(costEstimate.labor_cost)}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-surface-500">Deslocamento</span>
                                            <span className="font-medium">{formatBRL(costEstimate.displacement_cost)}</span>
                                        </div>
                                        <div className="flex justify-between border-t border-subtle pt-2">
                                            <span className="font-semibold text-surface-900">Custo Total</span>
                                            <span className="font-semibold">{formatBRL(costEstimate.total_cost)}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-surface-500">Receita OS</span>
                                            <span className="font-medium">{formatBRL(costEstimate.revenue)}</span>
                                        </div>
                                        <div className="flex justify-between border-t border-subtle pt-2">
                                            <span className="font-semibold text-surface-900">Margem</span>
                                            <span className={cn('font-bold', costEstimate.is_profitable ? 'text-emerald-600' : 'text-red-600')}>
                                                {costEstimate.margin_percent}%
                                            </span>
                                        </div>
                                    </div>
                                ) : null
                            )}
                        </div>
                    )}

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
                                            <p className="text-xs text-surface-500">Válida até</p>
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
                                    <img
                                        src={order.signature_path.startsWith('http') ? order.signature_path : `${(api.defaults.baseURL ?? '').replace(/\/api\/?$/, '')}/storage/${order.signature_path}`}
                                        alt="Assinatura"
                                        className="max-h-24 rounded-lg border border-default"
                                    />
                                    {(order.signature_signer || order.signed_by_name) && (
                                        <p className="text-sm text-surface-600">{order.signature_signer || order.signed_by_name}</p>
                                    )}
                                    {order.signature_at && <p className="text-xs text-surface-400">{formatDate(order.signature_at)}</p>}
                                </div>
                            </div>
                        )
                    }

                    {/* Timeline / Histórico de Status */}
                    {
                        order.status_history?.length > 0 && (
                            <div className="rounded-xl border border-default bg-surface-0 p-5 shadow-card">
                                <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-surface-900">
                                    <Clock className="h-4 w-4 text-brand-500" />
                                    Histórico
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
                                                        {h.user?.name ?? 'Sistema'} · {formatDate(h.created_at)}
                                                    </p>
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                            </div>
                        )
                    }

                </div>
            </div>

            <Modal open={showItemModal} onOpenChange={(open) => { setShowItemModal(open); if (!open) setEditingItem(null) }} title={editingItem ? "Editar Item" : "Adicionar Item"} >
                <form onSubmit={e => {
                    e.preventDefault()
                    const payload = { ...itemForm, reference_id: itemForm.reference_id || null }
                    if (editingItem) {
                        updateItemMut.mutate(payload)
                    } else {
                        addItemMut.mutate(payload)
                    }
                }} className="space-y-4">
                    <div className="flex rounded-lg border border-default overflow-hidden">
                        {(['product', 'service'] as const).map(t => (
                            <button key={t} type="button" onClick={() => setItemForm(p => ({ ...p, type: t, reference_id: '' }))}
                                className={cn('flex-1 py-2 text-sm font-medium transition-colors',
                                    itemForm.type === t ? (t === 'product' ? 'bg-brand-50 text-brand-700' : 'bg-emerald-50 text-emerald-700') : 'text-surface-500')}>
                                {t === 'product' ? 'Produto' : 'Serviço'}
                            </button>
                        ))}
                    </div>
                    <div>
                        <label className="mb-1.5 block text-sm font-medium text-surface-700">
                            {itemForm.type === 'product' ? 'Produto' : 'Serviço'}
                        </label>
                        <select value={itemForm.reference_id} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => handleRefChange(e.target.value)}
                            className="w-full rounded-lg border border-default bg-surface-50 px-3 py-2.5 text-sm focus:border-brand-400 focus:bg-surface-0 focus:outline-none focus:ring-2 focus:ring-brand-500/15">
                            <option value="">— Selecionar —</option>
                            {(itemForm.type === 'product' ? products : services).map((r: any) => (
                                <option key={r.id} value={r.id}>{r.name}</option>
                            ))}
                        </select>
                    </div>
                    {canViewPrices && itemForm.reference_id && order?.customer_id && (
                        <PriceHistoryHint
                            customerId={order.customer_id}
                            type={itemForm.type}
                            referenceId={itemForm.reference_id}
                            onApplyPrice={(price) => setItemForm(p => ({ ...p, unit_price: String(price) }))}
                        />
                    )}
                    <Input label="Descrição" value={itemForm.description}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setItemForm(p => ({ ...p, description: e.target.value }))} required />
                    <div className={`grid gap-3 ${canViewPrices ? 'grid-cols-3' : 'grid-cols-1'}`}>
                        <Input label="Qtd" type="number" step="0.01" value={itemForm.quantity}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setItemForm(p => ({ ...p, quantity: e.target.value }))} />
                        {canViewPrices && (
                            <>
                                <Input label="Preço Un." type="number" step="0.01" value={itemForm.unit_price}
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
            </Modal>

            <QrScannerModal
                open={showQrScanner}
                onClose={() => setShowQrScanner(false)}
                onScan={handleQrScanned}
                title="Escanear etiqueta (QR da peça)"
            />

            <Modal open={showStatusModal} onOpenChange={setShowStatusModal} title="Alterar Status" >
                <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-2">
                        {Object.entries(statusConfig)
                            .filter(([k]) => (order.allowed_transitions ?? []).includes(k))
                            .map(([k, v]) => (
                                <button key={k} onClick={() => setNewStatus(k)}
                                    className={cn('flex items-center gap-2 rounded-lg border p-3 text-sm transition-all',
                                        newStatus === k ? 'border-brand-500 bg-brand-50 ring-1 ring-brand-500' : 'border-default hover:border-surface-400')}>
                                    <v.icon className={cn('h-4 w-4', newStatus === k ? 'text-brand-600' : 'text-surface-400')} />
                                    <span className={cn('font-medium', newStatus === k ? 'text-surface-900' : 'text-surface-600')}>{v.label}</span>
                                </button>
                            ))}
                        {(order.allowed_transitions ?? []).length === 0 && (
                            <p className="col-span-2 py-4 text-center text-sm text-surface-400">Este status é final. Não há transições disponíveis.</p>
                        )}
                    </div>
                    <Input
                        label={newStatus === 'cancelled' ? 'Motivo do cancelamento *' : 'Observações (Opcional)'}
                        value={statusNotes}
                        onChange={(e: any) => setStatusNotes(e.target.value)}
                        placeholder={newStatus === 'cancelled' ? 'Informe o motivo do cancelamento...' : 'Observações sobre a mudança de status...'}
                    />
                    {newStatus === 'cancelled' && !statusNotes.trim() && (
                        <p className="text-xs text-red-500">O motivo do cancelamento é obrigatório.</p>
                    )}
                    <div className="flex justify-end gap-2 pt-2">
                        <Button variant="outline" onClick={() => setShowStatusModal(false)}>Cancelar</Button>
                        <Button
                            onClick={() => statusMut.mutate({ status: newStatus, notes: statusNotes })}
                            disabled={!newStatus || (newStatus === 'cancelled' && !statusNotes.trim())}
                            loading={statusMut.isPending}
                        >
                            Confirmar
                        </Button>
                    </div>
                </div>
            </Modal>

            <Modal open={deleteItemId !== null} onOpenChange={(open) => { if (!open) setDeleteItemId(null) }} title="Confirmar Remoção" >
                <div className="space-y-4">
                    <p className="text-sm text-surface-600">Tem certeza que deseja remover este item? Esta ação não pode ser desfeita.</p>
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
            </Modal>

            <Modal open={deleteAttachId !== null} onOpenChange={(open) => { if (!open) setDeleteAttachId(null) }} title="Confirmar Remoção" >
                <div className="space-y-4">
                    <p className="text-sm text-surface-600">Tem certeza que deseja remover este anexo? Esta ação não pode ser desfeita.</p>
                    <div className="flex justify-end gap-2">
                        <Button variant="outline" onClick={() => setDeleteAttachId(null)}>Cancelar</Button>
                        <Button
                            variant="danger"
                            onClick={() => { if (deleteAttachId) { deleteAttachmentMut.mutate(deleteAttachId) } }}
                            loading={deleteAttachmentMut.isPending}
                        >
                            Remover
                        </Button>
                    </div>
                </div>
            </Modal>

            {/* Modal: Vincular Equipamento */}
            <Modal open={showEquipmentModal} onOpenChange={setShowEquipmentModal} title="Vincular Equipamento">
                <div className="space-y-3">
                    {customerEquipments.length === 0 ? (
                        <p className="py-4 text-center text-sm text-surface-400">
                            Nenhum equipamento encontrado para este cliente.
                        </p>
                    ) : (
                        <div className="max-h-64 space-y-2 overflow-y-auto">
                            {customerEquipments
                                .filter((eq: any) => {
                                    const alreadyAttached = order?.equipments_list?.some((attached: any) => attached.id === eq.id) ||
                                        order?.equipment?.id === eq.id
                                    return !alreadyAttached
                                })
                                .map((eq: any) => (
                                    <button
                                        key={eq.id}
                                        className="flex w-full items-center gap-3 rounded-lg border border-default p-3 text-left transition-colors hover:border-brand-500 hover:bg-brand-50"
                                        onClick={() => attachEquipMut.mutate(eq.id)}
                                        disabled={attachEquipMut.isPending}
                                    >
                                        <Shield className="h-4 w-4 text-surface-400 flex-shrink-0" />
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium text-surface-800 truncate">{eq.type} {eq.brand ?? ''} {eq.model ?? ''}</p>
                                            {eq.serial_number && <p className="text-xs text-surface-400">S/N: {eq.serial_number}</p>}
                                        </div>
                                    </button>
                                ))
                            }
                            {customerEquipments.filter((eq: any) => {
                                const alreadyAttached = order?.equipments_list?.some((attached: any) => attached.id === eq.id) ||
                                    order?.equipment?.id === eq.id
                                return !alreadyAttached
                            }).length === 0 && (
                                    <p className="py-4 text-center text-sm text-surface-400">
                                        Todos os equipamentos do cliente já estão vinculados.
                                    </p>
                                )}
                        </div>
                    )}
                    <div className="flex justify-end pt-2">
                        <Button variant="outline" onClick={() => setShowEquipmentModal(false)}>Fechar</Button>
                    </div>
                </div>
            </Modal>

            {/* Modal: Confirmar Desvinculação */}
            <Modal open={detachEquipId !== null} onOpenChange={(open) => { if (!open) setDetachEquipId(null) }} title="Desvincular Equipamento">
                <div className="space-y-4">
                    <p className="text-sm text-surface-600">Tem certeza que deseja desvincular este equipamento da OS?</p>
                    <div className="flex justify-end gap-2">
                        <Button variant="outline" onClick={() => setDetachEquipId(null)}>Cancelar</Button>
                        <Button
                            variant="danger"
                            onClick={() => { if (detachEquipId) detachEquipMut.mutate(detachEquipId) }}
                            loading={detachEquipMut.isPending}
                        >
                            Desvincular
                        </Button>
                    </div>
                </div>
            </Modal>

            {/* Modal: Aplicar Kit de Peças */}
            <Modal open={showKitModal} onOpenChange={setShowKitModal} title="Aplicar Kit de Peças">
                <div className="space-y-3">
                    <p className="text-sm text-surface-500">Selecione um kit para adicionar todos os seus itens automaticamente à OS.</p>
                    {partsKits.length === 0 ? (
                        <p className="py-4 text-center text-sm text-surface-400">
                            Nenhum kit de peças cadastrado.
                        </p>
                    ) : (
                        <div className="max-h-64 space-y-2 overflow-y-auto">
                            {partsKits.map((kit: any) => (
                                <button
                                    key={kit.id}
                                    className="flex w-full items-center gap-3 rounded-lg border border-default p-3 text-left transition-colors hover:border-brand-500 hover:bg-brand-50"
                                    onClick={() => applyKitMut.mutate(kit.id)}
                                    disabled={applyKitMut.isPending}
                                >
                                    <Layers className="h-4 w-4 text-surface-400 flex-shrink-0" />
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium text-surface-800">{kit.name}</p>
                                        <p className="text-xs text-surface-400">{kit.items_count ?? kit.items?.length ?? '—'} itens</p>
                                    </div>
                                </button>
                            ))}
                        </div>
                    )}
                    <div className="flex justify-end pt-2">
                        <Button variant="outline" onClick={() => setShowKitModal(false)}>Fechar</Button>
                    </div>
                </div>
            </Modal>

        </div>
    )
}
