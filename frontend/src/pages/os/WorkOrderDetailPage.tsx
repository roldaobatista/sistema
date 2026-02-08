import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
    ArrowLeft, Clock, User, Phone, Mail, MapPin,
    Briefcase, Package, Plus, Trash2, Pencil, Download,
    CheckCircle2, AlertTriangle, Play, Pause, Truck, XCircle,
    DollarSign, CalendarDays, LinkIcon,
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
    const [showStatusModal, setShowStatusModal] = useState(false)
    const [newStatus, setNewStatus] = useState('')
    const [statusNotes, setStatusNotes] = useState('')
    const [showItemModal, setShowItemModal] = useState(false)
    const [itemForm, setItemForm] = useState({
        type: 'service' as 'product' | 'service',
        reference_id: '' as string | number, description: '',
        quantity: '1', unit_price: '0', discount: '0',
    })

    const { data: res, isLoading } = useQuery({
        queryKey: ['work-order', id],
        queryFn: () => api.get(`/ work - orders / ${id} `),
    })

    const { data: productsRes } = useQuery({
        queryKey: ['products-select'],
        queryFn: () => api.get('/products', { params: { per_page: 100, is_active: true } }),
    })

    const { data: servicesRes } = useQuery({
        queryKey: ['services-select'],
        queryFn: () => api.get('/services', { params: { per_page: 100, is_active: true } }),
    })

    const order = res?.data
    const products = productsRes?.data?.data ?? []
    const services = servicesRes?.data?.data ?? []

    const statusMut = useMutation({
        mutationFn: (data: { status: string; notes: string }) =>
            api.post(`/ work - orders / ${id}/status`, data),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['work-order', id] })
            setShowStatusModal(false)
        },
    })

    const addItemMut = useMutation({
        mutationFn: (data: any) => api.post(`/work-orders/${id}/items`, data),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['work-order', id] })
            setShowItemModal(false)
        },
    })

    const delItemMut = useMutation({
        mutationFn: (itemId: number) => api.delete(`/work-orders/${id}/items/${itemId}`),
        onSuccess: () => qc.invalidateQueries({ queryKey: ['work-order', id] }),
    })

    const updateMut = useMutation({
        mutationFn: (data: any) => api.put(`/work-orders/${id}`, data),
        onSuccess: () => qc.invalidateQueries({ queryKey: ['work-order', id] }),
    })

    const signMut = useMutation({
        mutationFn: (data: { signature: string; signer_name: string }) =>
            api.post(`/work-orders/${id}/signature`, data),
        onSuccess: () => qc.invalidateQueries({ queryKey: ['work-order', id] }),
    })

    if (isLoading || !order) {
        return <div className="py-16 text-center text-sm text-surface-500">Carregando...</div>
    }

    const formatBRL = (v: string | number) =>
        parseFloat(String(v)).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

    const formatDate = (d: string | null) =>
        d ? new Date(d).toLocaleDateString('pt-BR', {
            day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit',
        }) : '—'

    const sc = statusConfig[order.status] ?? statusConfig.open
    const StatusIcon = sc.icon

    const openItemForm = () => {
        setItemForm({ type: 'service', reference_id: '', description: '', quantity: '1', unit_price: '0', discount: '0' })
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

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <button onClick={() => navigate('/os')} className="rounded-lg p-1.5 hover:bg-surface-100">
                        <ArrowLeft className="h-5 w-5 text-surface-500" />
                    </button>
                    <div>
                        <div className="flex items-center gap-2">
                            <h1 className="text-2xl font-bold text-surface-900">{order.number}</h1>
                            <Badge variant={sc.variant} dot>{sc.label}</Badge>
                            {order.priority !== 'normal' && (
                                <Badge variant={priorityConfig[order.priority]?.variant}>
                                    {order.priority === 'urgent' && <AlertTriangle className="h-3 w-3 mr-0.5" />}
                                    {priorityConfig[order.priority]?.label}
                                </Badge>
                            )}
                        </div>
                        <p className="text-sm text-surface-500">Criada em {formatDate(order.created_at)}</p>
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
                    <Button variant="outline" icon={<Download className="h-4 w-4" />}
                        onClick={() => window.open(`${api.defaults.baseURL}/work-orders/${id}/pdf`, '_blank')}>
                        Baixar PDF
                    </Button>
                    <Button onClick={() => { setNewStatus(order.status); setStatusNotes(''); setShowStatusModal(true) }}>
                        Alterar Status
                    </Button>
                </div>
            </div>

            <div className="grid gap-6 lg:grid-cols-3">
                {/* Main Content */}
                <div className="lg:col-span-2 space-y-6">
                    {/* Descrição */}
                    <div className="rounded-xl border border-surface-200 bg-white p-5 shadow-card">
                        <h3 className="text-sm font-semibold text-surface-900 mb-2">Defeito Relatado</h3>
                        <p className="text-sm text-surface-700 whitespace-pre-wrap">{order.description}</p>

                        {order.technical_report && (
                            <div className="mt-4 border-t border-surface-200 pt-4">
                                <h3 className="text-sm font-semibold text-surface-900 mb-2">Laudo Técnico</h3>
                                <p className="text-sm text-surface-700 whitespace-pre-wrap">{order.technical_report}</p>
                            </div>
                        )}

                        {order.internal_notes && (
                            <div className="mt-4 border-t border-surface-200 pt-4">
                                <h3 className="text-sm font-semibold text-surface-500 mb-1">Observações Internas</h3>
                                <p className="text-xs text-surface-500 italic">{order.internal_notes}</p>
                            </div>
                        )}
                    </div>

                    {/* Itens */}
                    <div className="rounded-xl border border-surface-200 bg-white p-5 shadow-card">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-sm font-semibold text-surface-900">Itens</h3>
                            <Button variant="ghost" size="sm" onClick={openItemForm} icon={<Plus className="h-4 w-4" />}>
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
                                        <Button variant="ghost" size="sm" onClick={() => { if (confirm('Remover?')) delItemMut.mutate(item.id) }}>
                                            <Trash2 className="h-3.5 w-3.5 text-red-500" />
                                        </Button>
                                    </div>
                                ))}
                                <div className="flex items-center justify-between border-t border-surface-200 pt-3 mt-3">
                                    <span className="text-sm font-medium text-surface-600">Desconto</span>
                                    <span className="text-sm text-surface-600">{formatBRL(order.discount)}</span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-base font-bold text-surface-900">Total</span>
                                    <span className="text-base font-bold text-brand-600">{formatBRL(order.total)}</span>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Timeline */}
                    <div className="rounded-xl border border-surface-200 bg-white p-5 shadow-card">
                        <h3 className="text-sm font-semibold text-surface-900 mb-4">Timeline</h3>
                        <div className="relative ml-3 space-y-0">
                            {order.status_history?.map((entry: any, i: number) => {
                                const entryConf = statusConfig[entry.to_status] ?? statusConfig.open
                                const EntryIcon = entryConf.icon
                                return (
                                    <div key={entry.id} className="relative pb-6 pl-6">
                                        {i < order.status_history.length - 1 && (
                                            <span className="absolute left-[7px] top-5 bottom-0 w-px bg-surface-200" />
                                        )}
                                        <div className={cn('absolute left-0 top-0.5 flex h-4 w-4 items-center justify-center rounded-full',
                                            `bg-${entryConf.variant === 'info' ? 'sky' : entryConf.variant === 'warning' ? 'amber' : entryConf.variant === 'success' ? 'emerald' : entryConf.variant === 'danger' ? 'red' : 'surface'}-100`)}>
                                            <EntryIcon className="h-2.5 w-2.5 text-surface-600" />
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <Badge variant={entryConf.variant} className="text-[10px]">{entryConf.label}</Badge>
                                                <span className="text-xs text-surface-400">{formatDate(entry.created_at)}</span>
                                            </div>
                                            <p className="mt-0.5 text-xs text-surface-500">
                                                por <span className="font-medium">{entry.user?.name}</span>
                                                {entry.notes && <> — {entry.notes}</>}
                                            </p>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                </div>

                {/* Sidebar Info */}
                <div className="space-y-4">
                    {/* Cliente */}
                    <div className="rounded-xl border border-surface-200 bg-white p-4 shadow-card">
                        <h3 className="text-xs font-semibold uppercase tracking-wider text-surface-500 mb-3">Cliente</h3>
                        <p className="text-sm font-medium text-surface-900">{order.customer?.name}</p>
                        {order.customer?.phone && (
                            <p className="mt-1 flex items-center gap-1.5 text-xs text-surface-500"><Phone className="h-3 w-3" />{order.customer.phone}</p>
                        )}
                        {order.customer?.email && (
                            <p className="mt-0.5 flex items-center gap-1.5 text-xs text-surface-500"><Mail className="h-3 w-3" />{order.customer.email}</p>
                        )}
                    </div>

                    {/* Equipamento */}
                    {order.equipment && (
                        <div className="rounded-xl border border-surface-200 bg-white p-4 shadow-card">
                            <h3 className="text-xs font-semibold uppercase tracking-wider text-surface-500 mb-3">Equipamento</h3>
                            <p className="text-sm font-medium text-surface-900">{order.equipment.type}</p>
                            {order.equipment.brand && <p className="text-xs text-surface-500">{order.equipment.brand} {order.equipment.model}</p>}
                            {order.equipment.serial_number && <p className="text-xs text-surface-400 mt-1">S/N: {order.equipment.serial_number}</p>}
                        </div>
                    )}

                    {/* Responsáveis */}
                    <div className="rounded-xl border border-surface-200 bg-white p-4 shadow-card">
                        <h3 className="text-xs font-semibold uppercase tracking-wider text-surface-500 mb-3">Responsáveis</h3>
                        <div className="space-y-2 text-sm">
                            <div className="flex items-center justify-between">
                                <span className="text-surface-500">Criada por</span>
                                <span className="font-medium text-surface-700">{order.creator?.name}</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-surface-500">Técnico</span>
                                <span className="font-medium text-surface-700">{order.assignee?.name ?? '—'}</span>
                            </div>
                            {order.seller && (
                                <div className="flex items-center justify-between">
                                    <span className="text-surface-500">Vendedor</span>
                                    <span className="font-medium text-surface-700">{order.seller.name}</span>
                                </div>
                            )}
                            {order.driver && (
                                <div className="flex items-center justify-between">
                                    <span className="text-surface-500">Motorista</span>
                                    <span className="font-medium text-surface-700">{order.driver.name}</span>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Técnicos N:N */}
                    {order.technicians?.length > 0 && (
                        <div className="rounded-xl border border-surface-200 bg-white p-4 shadow-card">
                            <h3 className="text-xs font-semibold uppercase tracking-wider text-surface-500 mb-3">Técnicos Atribuídos</h3>
                            <div className="flex flex-wrap gap-1.5">
                                {order.technicians.map((t: any) => (
                                    <Badge key={t.id} variant="info">{t.name}{t.pivot?.role === 'driver' ? ' (Mot.)' : ''}</Badge>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Origem */}
                    {(order.quote || order.service_call || order.os_number) && (
                        <div className="rounded-xl border border-surface-200 bg-white p-4 shadow-card">
                            <h3 className="text-xs font-semibold uppercase tracking-wider text-surface-500 mb-3">Origem</h3>
                            <div className="space-y-2 text-sm">
                                {order.os_number && (
                                    <div className="flex items-center justify-between">
                                        <span className="text-surface-500">Nº Manual</span>
                                        <span className="font-mono font-medium text-surface-700">{order.os_number}</span>
                                    </div>
                                )}
                                {order.origin_type && (
                                    <div className="flex items-center justify-between">
                                        <span className="text-surface-500">Tipo</span>
                                        <Badge variant={order.origin_type === 'quote' ? 'brand' : order.origin_type === 'service_call' ? 'warning' : 'default'}>
                                            {order.origin_type === 'quote' ? 'Orçamento' : order.origin_type === 'service_call' ? 'Chamado' : 'Direto'}
                                        </Badge>
                                    </div>
                                )}
                                {order.quote && (
                                    <div className="flex items-center justify-between">
                                        <span className="text-surface-500">Orçamento</span>
                                        <button onClick={() => navigate(`/orcamentos/${order.quote_id}`)} className="text-xs font-medium text-brand-600 hover:underline">
                                            {order.quote.quote_number}
                                        </button>
                                    </div>
                                )}
                                {order.service_call && (
                                    <div className="flex items-center justify-between">
                                        <span className="text-surface-500">Chamado</span>
                                        <span className="text-xs font-medium text-surface-700">{order.service_call.call_number}</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Datas */}
                    <div className="rounded-xl border border-surface-200 bg-white p-4 shadow-card">
                        <h3 className="text-xs font-semibold uppercase tracking-wider text-surface-500 mb-3">Datas</h3>
                        <div className="space-y-1.5 text-xs">
                            {[
                                ['Criada', order.created_at],
                                ['Recebido', order.received_at],
                                ['Iniciada', order.started_at],
                                ['Concluída', order.completed_at],
                                ['Entregue', order.delivered_at],
                            ].map(([label, date]) => (
                                <div key={label as string} className="flex items-center justify-between">
                                    <span className="text-surface-500">{label}</span>
                                    <span className="text-surface-700">{formatDate(date as string)}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="bg-white rounded-xl shadow-card">
                        <SignaturePad
                            onSave={signMut.mutate}
                            disabled={signMut.isPending || !!order.signature_path}
                            existingSignature={order.signature_path}
                        />
                    </div>
                </div>
            </div>

            {/* Status Modal */}
            <Modal open={showStatusModal} onOpenChange={setShowStatusModal} title="Alterar Status" size="sm">
                <form onSubmit={e => { e.preventDefault(); statusMut.mutate({ status: newStatus, notes: statusNotes }) }} className="space-y-4">
                    <div>
                        <label className="mb-2 block text-sm font-medium text-surface-700">Novo Status</label>
                        <div className="grid grid-cols-2 gap-2">
                            {Object.entries(statusConfig).map(([key, conf]) => {
                                const Icon = conf.icon
                                return (
                                    <button key={key} type="button" onClick={() => setNewStatus(key)}
                                        className={cn('flex items-center gap-2 rounded-lg border p-2.5 text-xs font-medium transition-all',
                                            newStatus === key
                                                ? 'border-brand-500 bg-brand-50 text-brand-700'
                                                : 'border-surface-200 text-surface-600 hover:border-surface-300')}>
                                        <Icon className="h-3.5 w-3.5" />
                                        {conf.label}
                                    </button>
                                )
                            })}
                        </div>
                    </div>
                    <div>
                        <label className="mb-1.5 block text-sm font-medium text-surface-700">Observação</label>
                        <textarea value={statusNotes} onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setStatusNotes(e.target.value)} rows={2}
                            placeholder="Motivo da mudança..."
                            className="w-full rounded-lg border border-surface-300 bg-white px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20" />
                    </div>
                    <div className="flex justify-end gap-2">
                        <Button variant="outline" type="button" onClick={() => setShowStatusModal(false)}>Cancelar</Button>
                        <Button type="submit" loading={statusMut.isPending}>Confirmar</Button>
                    </div>
                </form>
            </Modal>

            {/* Add Item Modal */}
            <Modal open={showItemModal} onOpenChange={setShowItemModal} title="Adicionar Item">
                <form onSubmit={e => {
                    e.preventDefault()
                    addItemMut.mutate({ ...itemForm, reference_id: itemForm.reference_id || null })
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
                        <label className="mb-1.5 block text-sm font-medium text-surface-700">
                            {itemForm.type === 'product' ? 'Produto' : 'Serviço'}
                        </label>
                        <select value={itemForm.reference_id} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => handleRefChange(e.target.value)}
                            className="w-full rounded-lg border border-surface-300 bg-white px-3 py-2.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20">
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
                        <Button type="submit" loading={addItemMut.isPending}>Adicionar</Button>
                    </div>
                </form>
            </Modal>
        </div>
    )
}
