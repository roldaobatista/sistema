import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
    ArrowLeft, Clock, User, Phone, Mail, MapPin, ClipboardList,
    Briefcase, Package, Plus, Trash2, Pencil, Download, Save, X,
    CheckCircle2, AlertTriangle, Play, Pause, Truck, XCircle,
    DollarSign, CalendarDays, LinkIcon, Upload, Paperclip, Shield, Users,
} from 'lucide-react'
import api from '@/lib/api'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { SignaturePad } from '@/components/signature/SignaturePad'

const statusConfig: Record<string, { label: string; variant: any; icon: any }> = {
    open: { label: 'Aberta', variant: 'info', icon: Clock },
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
    })

    // Queries
    const { data: res, isLoading } = useQuery({
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
        onSuccess: () => qc.invalidateQueries({ queryKey: ['wo-checklist', id] }),
    })

    const statusMut = useMutation({
        mutationFn: (data: { status: string; notes: string }) =>
            api.post(`/work-orders/${id}/status`, data),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['work-order', id] })
            setShowStatusModal(false)
        },
        onError: (err: any) => alert(err?.response?.data?.message || 'Erro ao alterar status'),
    })

    const addItemMut = useMutation({
        mutationFn: (data: any) => api.post(`/work-orders/${id}/items`, data),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['work-order', id] })
            setShowItemModal(false)
        },
        onError: (err: any) => alert(err?.response?.data?.message || 'Erro ao adicionar item'),
    })

    const updateItemMut = useMutation({
        mutationFn: (data: any) => api.put(`/work-orders/${id}/items/${editingItem?.id}`, data),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['work-order', id] })
            setShowItemModal(false)
            setEditingItem(null)
        },
        onError: (err: any) => alert(err?.response?.data?.message || 'Erro ao atualizar item'),
    })

    const delItemMut = useMutation({
        mutationFn: (itemId: number) => api.delete(`/work-orders/${id}/items/${itemId}`),
        onSuccess: () => qc.invalidateQueries({ queryKey: ['work-order', id] }),
        onError: (err: any) => alert(err?.response?.data?.message || 'Erro ao remover item'),
    })

    const updateMut = useMutation({
        mutationFn: (data: any) => api.put(`/work-orders/${id}`, data),
        onSuccess: () => qc.invalidateQueries({ queryKey: ['work-order', id] }),
        onError: (err: any) => alert(err?.response?.data?.message || 'Erro ao salvar alterações'),
    })

    const signMut = useMutation({
        mutationFn: (data: { signature: string; signer_name: string }) =>
            api.post(`/work-orders/${id}/signature`, data),
        onSuccess: () => qc.invalidateQueries({ queryKey: ['work-order', id] }),
        onError: (err: any) => alert(err?.response?.data?.message || 'Erro ao salvar assinatura'),
    })

    // Helpers
    const downloadPdf = async () => {
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
    }

    if (isLoading || !order) {
        return <div className="py-16 text-center text-[13px] text-surface-500">Carregando...</div>
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

    const startEditing = () => {
        setEditForm({
            description: order.description ?? '',
            priority: order.priority ?? 'normal',
            technical_report: order.technical_report ?? '',
            internal_notes: order.internal_notes ?? '',
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
                    <button onClick={() => navigate('/os')} className="rounded-lg p-1.5 hover:bg-surface-100">
                        <ArrowLeft className="h-5 w-5 text-surface-500" />
                    </button>
                    <div>
                        <div className="flex items-center gap-2">
                            <h1 className="text-lg font-semibold text-surface-900 tracking-tight">{order.business_number ?? order.os_number ?? order.number}</h1>
                            <Badge variant={sc.variant} dot>{sc.label}</Badge>
                            {order.priority !== 'normal' && (
                                <Badge variant={priorityConfig[order.priority]?.variant}>
                                    {order.priority === 'urgent' && <AlertTriangle className="h-3 w-3 mr-0.5" />}
                                    {priorityConfig[order.priority]?.label}
                                </Badge>
                            )}
                        </div>
                        <p className="text-[13px] text-surface-500">Criada em {formatDate(order.created_at)}</p>
                        {/* Rastreabilidade */}
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
                    {!isEditing ? (
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
                    )}
                    <Button variant="outline" icon={<Download className="h-4 w-4" />}
                        onClick={downloadPdf}>
                        Baixar PDF
                    </Button>
                    <Button onClick={() => { setNewStatus(''); setStatusNotes(''); setShowStatusModal(true) }}>
                        Alterar Status
                    </Button>
                </div>
            </div>

            <div className="grid gap-6 lg:grid-cols-3">
                {/* Main Content */}
                <div className="lg:col-span-2 space-y-5">
                    {/* Descrição */}
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
                    </div>

                    {/* Itens List Section */}
                    <div className="rounded-xl border border-default bg-surface-0 p-5 shadow-card">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-sm font-semibold text-surface-900">Itens</h3>
                            <Button variant="ghost" size="sm" onClick={() => openItemForm()} icon={<Plus className="h-4 w-4" />}>
                                Adicionar
                            </Button>
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
                                            <p className="text-xs text-surface-400">{item.quantity} × {formatBRL(item.unit_price)}</p>
                                        </div>
                                        <span className="text-sm font-semibold text-surface-900">{formatBRL(item.total)}</span>
                                        <div className="flex gap-1">
                                            <Button variant="ghost" size="sm" onClick={() => openItemForm(item)}>
                                                <Pencil className="h-3.5 w-3.5 text-surface-500" />
                                            </Button>
                                            <Button variant="ghost" size="sm" onClick={() => { if (confirm('Remover?')) delItemMut.mutate(item.id) }}>
                                                <Trash2 className="h-3.5 w-3.5 text-red-500" />
                                            </Button>
                                        </div>
                                    </div>
                                ))}
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
                            </div>
                        )}
                    </div>

                    {/* Checklist Responses */}
                    {checklistItems.length > 0 && (
                        <div className="rounded-xl border border-default bg-surface-0 p-5 shadow-card">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-sm font-semibold text-surface-900 flex items-center gap-2">
                                    <ClipboardList className="h-4 w-4 text-brand-500" />
                                    Checklist
                                </h3>
                                <Badge variant="outline">{checklistItems.length} itens</Badge>
                            </div>
                            <div className="space-y-2">
                                {checklistItems.map((resp: any) => (
                                    <div key={resp.id} className="flex items-start gap-3 rounded-lg border border-surface-100 p-3">
                                        <div className="flex-shrink-0 mt-0.5">
                                            {resp.value === 'true' || resp.value === 'sim' || resp.value === 'ok' ? (
                                                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                                            ) : resp.value === 'false' || resp.value === 'não' || resp.value === 'nok' ? (
                                                <XCircle className="h-4 w-4 text-red-500" />
                                            ) : (
                                                <ClipboardList className="h-4 w-4 text-surface-400" />
                                            )}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium text-surface-800">
                                                {resp.item?.label ?? resp.item?.name ?? `Item #${resp.checklist_item_id}`}
                                            </p>
                                            {resp.value && resp.value !== 'true' && resp.value !== 'false' && resp.value !== 'sim' && resp.value !== 'não' && resp.value !== 'ok' && resp.value !== 'nok' && (
                                                <p className="text-xs text-surface-600 mt-0.5">{resp.value}</p>
                                            )}
                                            {resp.notes && (
                                                <p className="text-xs text-surface-400 italic mt-0.5">{resp.notes}</p>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
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
                                <p className="font-medium text-surface-900">{order.customer?.document || '—'}</p>
                            </div>
                            <div>
                                <p className="text-xs text-surface-500">Contato</p>
                                <p className="font-medium text-surface-900">
                                    {order.customer?.contacts?.[0]?.phone || order.customer?.email || '—'}
                                </p>
                            </div>
                        </div>
                    </div>
                    {/* Placeholder for Timeline/Checklist if needed */}

                    {/* Equipamentos */}
                    {(order.equipment || order.equipments_list?.length > 0) && (
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
                    )}

                    {/* Técnicos */}
                    {order.technicians?.length > 0 && (
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

                    {/* SLA Info */}
                    {(order.sla_due_at || order.sla_responded_at) && (
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
                    )}

                    {/* Timeline / Histórico de Status */}
                    {order.status_history?.length > 0 && (
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
                    )}

                    {/* Assinatura Digital */}
                    <div className="rounded-xl border border-default bg-surface-0 p-5 shadow-card">
                        <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-surface-900">
                            <Pencil className="h-4 w-4 text-brand-500" />
                            Assinatura
                        </h3>
                        {order.signature_path ? (
                            <div>
                                <img src={order.signature_path} alt="Assinatura" className="rounded border border-surface-200 max-h-24" />
                                {order.signature_signer && <p className="mt-1 text-xs text-surface-500">{order.signature_signer}</p>}
                                {order.signature_at && <p className="text-xs text-surface-400">{formatDate(order.signature_at)}</p>}
                            </div>
                        ) : (
                            <SignaturePad
                                onSave={({ signature, signer_name }: { signature: string; signer_name: string }) => signMut.mutate({ signature, signer_name })}
                                disabled={signMut.isPending}
                            />
                        )}
                    </div>
                </div>
            </div>

            {/* Add/Edit Item Modal */}
            <Modal open={showItemModal} onOpenChange={(open) => { setShowItemModal(open); if (!open) setEditingItem(null) }} title={editingItem ? "Editar Item" : "Adicionar Item"}>
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
                                {t === 'product' ? 'Produto' : 'Serviço'}
                            </button>
                        ))}
                    </div>
                    <div>
                        <label className="mb-1.5 block text-[13px] font-medium text-surface-700">
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
                    <Input label="Descrição" value={itemForm.description}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setItemForm(p => ({ ...p, description: e.target.value }))} required />
                    <div className="grid grid-cols-3 gap-3">
                        <Input label="Qtd" type="number" step="0.01" value={itemForm.quantity}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setItemForm(p => ({ ...p, quantity: e.target.value }))} />
                        <Input label="Preço Un." type="number" step="0.01" value={itemForm.unit_price}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setItemForm(p => ({ ...p, unit_price: e.target.value }))} />
                        <Input label="Desconto" type="number" step="0.01" value={itemForm.discount}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setItemForm(p => ({ ...p, discount: e.target.value }))} />
                    </div>
                    <div className="flex justify-end gap-2">
                        <Button variant="outline" type="button" onClick={() => setShowItemModal(false)}>Cancelar</Button>
                        <Button type="submit" loading={addItemMut.isPending || updateItemMut.isPending}>
                            {editingItem ? 'Salvar' : 'Adicionar'}
                        </Button>
                    </div>
                </form>
            </Modal>

            {/* Status Modal */}
            <Modal open={showStatusModal} onOpenChange={setShowStatusModal} title="Alterar Status">
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
                            <p className="col-span-2 py-4 text-center text-sm text-surface-400">Este status é final. Não há transições disponíveis.</p>
                        )}
                    </div>
                    <Input label="Observações (Opcional)" value={statusNotes} onChange={(e: any) => setStatusNotes(e.target.value)} />
                    <div className="flex justify-end gap-2 pt-2">
                        <Button variant="outline" onClick={() => setShowStatusModal(false)}>Cancelar</Button>
                        <Button onClick={() => statusMut.mutate({ status: newStatus, notes: statusNotes })} disabled={!newStatus} loading={statusMut.isPending}>Confirmar</Button>
                    </div>
                </div>
            </Modal>

        </div>
    )
}
