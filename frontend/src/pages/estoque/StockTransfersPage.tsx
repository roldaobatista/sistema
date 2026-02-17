import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
    ArrowLeftRight, Plus, Search, Loader2, CheckCircle2,
    XCircle, Clock, Eye, Warehouse, Package, ChevronDown, Lightbulb
} from 'lucide-react'
import api from '@/lib/api'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/stores/auth-store'
import { PageHeader } from '@/components/ui/pageheader'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'
import { Input } from '@/components/ui/input'


interface TransferItem {
    id: number
    product_id: number
    quantity: number
    product?: { id: number; name: string; code?: string; unit?: string }
}

interface StockTransfer {
    id: number
    from_warehouse_id: number
    to_warehouse_id: number
    status: string
    notes?: string
    created_at: string
    from_warehouse?: { id: number; name: string }
    to_warehouse?: { id: number; name: string }
    to_user?: { id: number; name: string }
    items: TransferItem[]
}

interface WarehouseOption {
    id: number
    name: string
}

interface ProductOption {
    id: number
    name: string
    code?: string
    unit?: string
    stock_qty?: number
}

const STATUS_MAP: Record<string, { label: string; color: string; icon: any }> = {
    pending_acceptance: { label: 'Aguardando Aceite', color: 'bg-amber-100 text-amber-700', icon: Clock },
    accepted: { label: 'Aceita', color: 'bg-emerald-100 text-emerald-700', icon: CheckCircle2 },
    rejected: { label: 'Rejeitada', color: 'bg-red-100 text-red-700', icon: XCircle },
    completed: { label: 'Concluída', color: 'bg-blue-100 text-blue-700', icon: CheckCircle2 },
}

export default function StockTransfersPage() {
    const qc = useQueryClient()
    const { hasPermission } = useAuthStore()
    const canCreate = hasPermission('estoque.movement.create')

    const [search, setSearch] = useState('')
    const [statusFilter, setStatusFilter] = useState<string>('all')
    const [showCreateModal, setShowCreateModal] = useState(false)
    const [showDetailModal, setShowDetailModal] = useState(false)
    const [selectedTransfer, setSelectedTransfer] = useState<StockTransfer | null>(null)
    const [rejectConfirm, setRejectConfirm] = useState<StockTransfer | null>(null)
    const [rejectReason, setRejectReason] = useState('')
    const [showSuggest, setShowSuggest] = useState(false)

    // Form state
    const [fromWarehouseId, setFromWarehouseId] = useState('')
    const [toWarehouseId, setToWarehouseId] = useState('')
    const [notes, setNotes] = useState('')
    const [formItems, setFormItems] = useState<Array<{ product_id: string; quantity: string }>>([
        { product_id: '', quantity: '' }
    ])

    // Queries
    const { data: transfersRes, isLoading } = useQuery({
        queryKey: ['stock-transfers', statusFilter],
        queryFn: () => api.get('/stock/transfers', { params: { status: statusFilter !== 'all' ? statusFilter : undefined, per_page: 50 } })
    })
    const transfers: StockTransfer[] = transfersRes?.data?.data ?? []

    const { data: warehousesRes } = useQuery({
        queryKey: ['warehouses-for-transfer'],
        queryFn: () => api.get('/stock/warehouses')
    })
    const warehouses: WarehouseOption[] = warehousesRes?.data?.data ?? warehousesRes?.data ?? []

    const { data: productsRes } = useQuery({
        queryKey: ['products-for-transfer'],
        queryFn: () => api.get('/stock/summary'),
        enabled: showCreateModal,
    })
    const products: ProductOption[] = productsRes?.data?.products ?? []

    // Sugestões de transferência
    const { data: suggestionsRes, isLoading: suggestLoading, refetch: refetchSuggestions } = useQuery({
        queryKey: ['suggest-transfers'],
        queryFn: () => api.get('/stock-advanced/transfers/suggest'),
        enabled: showSuggest,
    })
    const suggestions: any[] = suggestionsRes?.data?.suggestions ?? suggestionsRes?.data?.data ?? suggestionsRes?.data ?? []

    // Mutations
    const createMut = useMutation({
        mutationFn: (data: any) => api.post('/stock/transfers', data),
        onSuccess: () => {
            toast.success('Transferência criada com sucesso!')
            qc.invalidateQueries({ queryKey: ['stock-transfers'] })
            resetForm()
        },
        onError: (err: any) => {
            if (err.response?.status === 422) {
                const errors = err.response.data.errors
                const msgs = Object.values(errors || {}).flat().join(', ')
                toast.error(msgs || 'Erro de validação')
            } else {
                toast.error(err?.response?.data?.message || 'Erro ao criar transferência')
            }
        }
    })

    const acceptMut = useMutation({
        mutationFn: (id: number) => api.post(`/stock/transfers/${id}/accept`),
        onSuccess: () => {
            toast.success('Transferência aceita e efetivada!')
            qc.invalidateQueries({ queryKey: ['stock-transfers'] })
            setShowDetailModal(false)
        },
        onError: (err: any) => toast.error(err?.response?.data?.message || 'Erro ao aceitar')
    })

    const rejectMut = useMutation({
        mutationFn: ({ id, reason }: { id: number; reason?: string }) =>
            api.post(`/stock/transfers/${id}/reject`, { rejection_reason: reason }),
        onSuccess: () => {
            toast.success('Transferência rejeitada.')
            qc.invalidateQueries({ queryKey: ['stock-transfers'] })
            setRejectConfirm(null)
            setRejectReason('')
            setShowDetailModal(false)
        },
        onError: (err: any) => toast.error(err?.response?.data?.message || 'Erro ao rejeitar')
    })

    const resetForm = () => {
        setShowCreateModal(false)
        setFromWarehouseId('')
        setToWarehouseId('')
        setNotes('')
        setFormItems([{ product_id: '', quantity: '' }])
    }

    const addItem = () => setFormItems(prev => [...prev, { product_id: '', quantity: '' }])
    const removeItem = (idx: number) => setFormItems(prev => prev.filter((_, i) => i !== idx))
    const updateItem = (idx: number, field: 'product_id' | 'quantity', value: string) => {
        setFormItems(prev => prev.map((item, i) => i === idx ? { ...item, [field]: value } : item))
    }

    const handleSubmit = () => {
        if (!fromWarehouseId || !toWarehouseId) {
            toast.error('Selecione os depósitos de origem e destino.')
            return
        }
        if (fromWarehouseId === toWarehouseId) {
            toast.error('Origem e destino devem ser diferentes.')
            return
        }
        const validItems = formItems.filter(i => i.product_id && Number(i.quantity) > 0)
        if (validItems.length === 0) {
            toast.error('Adicione pelo menos um item com quantidade válida.')
            return
        }
        createMut.mutate({
            from_warehouse_id: Number(fromWarehouseId),
            to_warehouse_id: Number(toWarehouseId),
            items: validItems.map(i => ({ product_id: Number(i.product_id), quantity: Number(i.quantity) })),
            notes: notes || undefined,
        })
    }

    const filtered = transfers.filter(t => {
        if (!search) return true
        const s = search.toLowerCase()
        return (
            t.from_warehouse?.name?.toLowerCase().includes(s) ||
            t.to_warehouse?.name?.toLowerCase().includes(s) ||
            t.notes?.toLowerCase().includes(s) ||
            t.items.some(i => i.product?.name?.toLowerCase().includes(s))
        )
    })

    const getStatusInfo = (status: string) => STATUS_MAP[status] ?? { label: status, color: 'bg-surface-100 text-surface-600', icon: Clock }

    return (
        <div className="space-y-5">
            <PageHeader
                title="Transferências de Estoque"
                subtitle="Gerencie a movimentação de produtos entre depósitos, veículos e técnicos"
                actions={canCreate ? [
                    { label: 'Sugestões', icon: <Lightbulb className="h-4 w-4" />, variant: 'outline' as const, onClick: () => setShowSuggest(true) },
                    { label: 'Nova Transferência', icon: <Plus className="h-4 w-4" />, onClick: () => setShowCreateModal(true) },
                ] : []}
            />

            {/* Filtros */}
            <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-surface-400" />
                    <input
                        type="text"
                        placeholder="Buscar por depósito, produto ou observação..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 bg-surface-0 border border-default rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                    />
                </div>
                <select
                    value={statusFilter}
                    onChange={e => setStatusFilter(e.target.value)}
                    className="px-4 py-2.5 bg-surface-0 border border-default rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                    title="Filtrar por status"
                >
                    <option value="all">Todos os Status</option>
                    <option value="pending_acceptance">Aguardando Aceite</option>
                    <option value="accepted">Aceitas</option>
                    <option value="completed">Concluídas</option>
                    <option value="rejected">Rejeitadas</option>
                </select>
            </div>

            {/* Lista */}
            {isLoading ? (
                <div className="flex justify-center py-20">
                    <Loader2 className="h-8 w-8 animate-spin text-brand-500" />
                </div>
            ) : filtered.length === 0 ? (
                <div className="bg-surface-0 rounded-2xl border border-default p-12 text-center">
                    <ArrowLeftRight className="mx-auto h-12 w-12 text-surface-300 mb-4" />
                    <h3 className="text-lg font-semibold text-surface-700">Nenhuma transferência encontrada</h3>
                    <p className="text-sm text-surface-500 mt-1">
                        {search ? 'Tente alterar os filtros de busca.' : 'Crie uma nova transferência para movimentar estoque entre depósitos.'}
                    </p>
                </div>
            ) : (
                <div className="bg-surface-0 rounded-2xl border border-default overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-default bg-surface-50/50">
                                    <th className="px-4 py-3 text-left font-medium text-surface-500">#</th>
                                    <th className="px-4 py-3 text-left font-medium text-surface-500">Origem</th>
                                    <th className="px-4 py-3 text-left font-medium text-surface-500">Destino</th>
                                    <th className="px-4 py-3 text-center font-medium text-surface-500">Itens</th>
                                    <th className="px-4 py-3 text-center font-medium text-surface-500">Status</th>
                                    <th className="px-4 py-3 text-left font-medium text-surface-500">Data</th>
                                    <th className="px-4 py-3 text-right font-medium text-surface-500">Ações</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-default">
                                {filtered.map(t => {
                                    const si = getStatusInfo(t.status)
                                    const StatusIcon = si.icon
                                    return (
                                        <tr key={t.id} className="hover:bg-surface-50/50 transition-colors">
                                            <td className="px-4 py-3 font-mono text-xs text-surface-400">#{t.id}</td>
                                            <td className="px-4 py-3">
                                                <div className="flex items-center gap-2">
                                                    <Warehouse className="h-4 w-4 text-surface-400 shrink-0" />
                                                    <span className="font-medium text-surface-800 truncate max-w-[160px]">{t.from_warehouse?.name || '—'}</span>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="flex items-center gap-2">
                                                    <Warehouse className="h-4 w-4 text-brand-500 shrink-0" />
                                                    <span className="font-medium text-surface-800 truncate max-w-[160px]">{t.to_warehouse?.name || '—'}</span>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                                <span className="bg-surface-100 text-surface-600 px-2 py-0.5 rounded-full text-xs font-bold">
                                                    {t.items.length}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                                <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium', si.color)}>
                                                    <StatusIcon className="h-3 w-3" />
                                                    {si.label}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-xs text-surface-500">
                                                {new Date(t.created_at).toLocaleDateString('pt-BR')}
                                            </td>
                                            <td className="px-4 py-3 text-right">
                                                <div className="flex items-center justify-end gap-1">
                                                    <button
                                                        onClick={() => { setSelectedTransfer(t); setShowDetailModal(true) }}
                                                        className="p-1.5 rounded-md hover:bg-surface-100 text-surface-500 hover:text-brand-600"
                                                        title="Ver Detalhes"
                                                    >
                                                        <Eye className="h-3.5 w-3.5" />
                                                    </button>
                                                    {canCreate && t.status === 'pending_acceptance' && (
                                                        <>
                                                            <button
                                                                onClick={() => acceptMut.mutate(t.id)}
                                                                disabled={acceptMut.isPending}
                                                                className="p-1.5 rounded-md hover:bg-emerald-50 text-emerald-600 hover:text-emerald-700"
                                                                title="Aceitar"
                                                            >
                                                                <CheckCircle2 className="h-3.5 w-3.5" />
                                                            </button>
                                                            <button
                                                                onClick={() => setRejectConfirm(t)}
                                                                className="p-1.5 rounded-md hover:bg-red-50 text-red-500 hover:text-red-600"
                                                                title="Rejeitar"
                                                            >
                                                                <XCircle className="h-3.5 w-3.5" />
                                                            </button>
                                                        </>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Modal Criar Transferência */}
            <Modal
                open={showCreateModal}
                onClose={resetForm}
                title="Nova Transferência de Estoque"
                size="lg"
                footer={
                    <div className="flex justify-end gap-3">
                        <Button variant="outline" onClick={resetForm}>Cancelar</Button>
                        <Button onClick={handleSubmit} loading={createMut.isPending} disabled={!fromWarehouseId || !toWarehouseId}>
                            Criar Transferência
                        </Button>
                    </div>
                }
            >
                <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                            <label className="text-xs font-medium text-surface-500 uppercase">Depósito Origem</label>
                            <select
                                value={fromWarehouseId}
                                onChange={e => setFromWarehouseId(e.target.value)}
                                className="w-full px-3 py-2 bg-surface-50 border border-default rounded-lg text-sm focus:ring-2 focus:ring-brand-500/20 outline-none"
                                title="Depósito Origem"
                            >
                                <option value="">Selecione...</option>
                                {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                            </select>
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-xs font-medium text-surface-500 uppercase">Depósito Destino</label>
                            <select
                                value={toWarehouseId}
                                onChange={e => setToWarehouseId(e.target.value)}
                                className="w-full px-3 py-2 bg-surface-50 border border-default rounded-lg text-sm focus:ring-2 focus:ring-brand-500/20 outline-none"
                                title="Depósito Destino"
                            >
                                <option value="">Selecione...</option>
                                {warehouses.filter(w => String(w.id) !== fromWarehouseId).map(w => (
                                    <option key={w.id} value={w.id}>{w.name}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <Input
                        label="Observações (opcional)"
                        value={notes}
                        onChange={e => setNotes(e.target.value)}
                        placeholder="Ex: Reabastecimento de veículo"
                    />

                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <label className="text-xs font-medium text-surface-500 uppercase">Itens da Transferência</label>
                            <button onClick={addItem} className="text-xs text-brand-600 hover:text-brand-700 font-medium flex items-center gap-1">
                                <Plus className="h-3 w-3" /> Adicionar Item
                            </button>
                        </div>
                        {formItems.map((item, idx) => (
                            <div key={idx} className="flex items-center gap-2">
                                <select
                                    value={item.product_id}
                                    onChange={e => updateItem(idx, 'product_id', e.target.value)}
                                    className="flex-1 px-3 py-2 bg-surface-50 border border-default rounded-lg text-sm focus:ring-2 focus:ring-brand-500/20 outline-none"
                                    title="Produto"
                                >
                                    <option value="">Selecione produto...</option>
                                    {products.map(p => (
                                        <option key={p.id} value={p.id}>{p.name} {p.code ? `(${p.code})` : ''} — Estoque: {p.stock_qty ?? 0} {p.unit ?? ''}</option>
                                    ))}
                                </select>
                                <input
                                    type="number"
                                    value={item.quantity}
                                    onChange={e => updateItem(idx, 'quantity', e.target.value)}
                                    placeholder="Qtd"
                                    min="0.01"
                                    step="0.01"
                                    className="w-24 px-3 py-2 bg-surface-50 border border-default rounded-lg text-sm text-right focus:ring-2 focus:ring-brand-500/20 outline-none"
                                />
                                {formItems.length > 1 && (
                                    <button onClick={() => removeItem(idx)} className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded" title="Remover item">
                                        <XCircle className="h-4 w-4" />
                                    </button>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            </Modal>

            {/* Modal Detalhes */}
            <Modal
                open={showDetailModal}
                onClose={() => { setShowDetailModal(false); setSelectedTransfer(null) }}
                title={`Transferência #${selectedTransfer?.id ?? ''}`}
                size="lg"
                footer={
                    selectedTransfer?.status === 'pending_acceptance' && canCreate ? (
                        <div className="flex justify-end gap-3">
                            <Button variant="outline" onClick={() => { setShowDetailModal(false); setRejectConfirm(selectedTransfer) }}
                                className="text-red-600 border-red-200 hover:bg-red-50">
                                Rejeitar
                            </Button>
                            <Button
                                onClick={() => selectedTransfer && acceptMut.mutate(selectedTransfer.id)}
                                loading={acceptMut.isPending}
                                className="bg-emerald-600 hover:bg-emerald-700"
                            >
                                Aceitar Transferência
                            </Button>
                        </div>
                    ) : undefined
                }
            >
                {selectedTransfer && (
                    <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="bg-surface-50 p-3 rounded-xl">
                                <p className="text-xs text-surface-400 uppercase font-medium mb-1">Origem</p>
                                <p className="font-semibold text-surface-800 flex items-center gap-2">
                                    <Warehouse className="h-4 w-4 text-surface-400" />
                                    {selectedTransfer.from_warehouse?.name}
                                </p>
                            </div>
                            <div className="bg-surface-50 p-3 rounded-xl">
                                <p className="text-xs text-surface-400 uppercase font-medium mb-1">Destino</p>
                                <p className="font-semibold text-surface-800 flex items-center gap-2">
                                    <Warehouse className="h-4 w-4 text-brand-500" />
                                    {selectedTransfer.to_warehouse?.name}
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-4">
                            {(() => {
                                const si = getStatusInfo(selectedTransfer.status)
                                return <span className={cn('inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium', si.color)}>
                                    <si.icon className="h-3 w-3" /> {si.label}
                                </span>
                            })()}
                            <span className="text-xs text-surface-400">{new Date(selectedTransfer.created_at).toLocaleString('pt-BR')}</span>
                        </div>
                        {selectedTransfer.notes && (
                            <p className="text-sm text-surface-600 bg-surface-50 p-3 rounded-xl">{selectedTransfer.notes}</p>
                        )}
                        <div>
                            <h4 className="text-xs font-bold text-surface-400 uppercase mb-2">Itens ({selectedTransfer.items.length})</h4>
                            <div className="border border-default rounded-xl divide-y divide-default overflow-hidden">
                                {selectedTransfer.items.map(item => (
                                    <div key={item.id} className="p-3 flex items-center justify-between hover:bg-surface-50/50">
                                        <div className="flex items-center gap-3">
                                            <Package className="h-4 w-4 text-surface-400" />
                                            <div>
                                                <p className="font-medium text-sm text-surface-800">{item.product?.name ?? `Produto #${item.product_id}`}</p>
                                                {item.product?.code && <p className="text-xs text-surface-400">{item.product.code}</p>}
                                            </div>
                                        </div>
                                        <span className="text-sm font-bold text-surface-700">
                                            {item.quantity} {item.product?.unit ?? 'un'}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}
            </Modal>

            {/* Confirmar Rejeição */}
            {rejectConfirm && (
                <Modal
                    open={!!rejectConfirm}
                    onClose={() => { setRejectConfirm(null); setRejectReason('') }}
                    title="Rejeitar Transferência"
                    size="sm"
                    footer={
                        <div className="flex justify-end gap-3">
                            <Button variant="outline" onClick={() => { setRejectConfirm(null); setRejectReason('') }}>Cancelar</Button>
                            <Button
                                onClick={() => rejectMut.mutate({ id: rejectConfirm.id, reason: rejectReason })}
                                loading={rejectMut.isPending}
                                className="bg-red-600 hover:bg-red-700 text-white"
                            >
                                Confirmar Rejeição
                            </Button>
                        </div>
                    }
                >
                    <div className="space-y-3">
                        <p className="text-sm text-surface-600">Tem certeza que deseja rejeitar a transferência <strong>#{rejectConfirm.id}</strong>?</p>
                        <Input
                            label="Motivo da rejeição (opcional)"
                            value={rejectReason}
                            onChange={e => setRejectReason(e.target.value)}
                            placeholder="Ex: Produtos não conferem com o pedido"
                        />
                    </div>
                </Modal>
            )}

            {/* Modal Sugestões de Transferência */}
            <Modal
                open={showSuggest}
                onClose={() => setShowSuggest(false)}
                title="Sugestões de Transferência"
                size="lg"
            >
                <div className="space-y-3">
                    <p className="text-sm text-surface-500">Sugestões automáticas para balancear estoque entre depósitos.</p>
                    {suggestLoading ? (
                        <div className="flex justify-center py-8">
                            <Loader2 className="h-6 w-6 animate-spin text-brand-500" />
                        </div>
                    ) : !Array.isArray(suggestions) || suggestions.length === 0 ? (
                        <div className="py-8 text-center text-surface-400">
                            <Lightbulb className="h-8 w-8 mx-auto mb-2 text-surface-300" />
                            <p>Nenhuma sugestão disponível no momento.</p>
                            <p className="text-xs mt-1">O estoque está bem distribuído entre os depósitos.</p>
                        </div>
                    ) : (
                        <div className="border border-default rounded-xl divide-y divide-default overflow-hidden">
                            {suggestions.map((s: any, idx: number) => (
                                <div key={idx} className="p-3 flex items-center justify-between hover:bg-surface-50/50">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2 text-sm">
                                            <span className="font-medium">{s.product_name ?? s.product?.name ?? `Produto #${s.product_id}`}</span>
                                        </div>
                                        <div className="flex items-center gap-1 mt-1 text-xs text-surface-500">
                                            <span>{s.from_warehouse_name ?? s.from_warehouse?.name ?? 'Origem'}</span>
                                            <ArrowLeftRight className="h-3 w-3" />
                                            <span>{s.to_warehouse_name ?? s.to_warehouse?.name ?? 'Destino'}</span>
                                            <span className="ml-2 font-medium text-brand-600">{s.suggested_quantity ?? s.quantity} un</span>
                                        </div>
                                        {s.reason && <p className="text-xs text-surface-400 mt-0.5">{s.reason}</p>}
                                    </div>
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => {
                                            setFromWarehouseId(String(s.from_warehouse_id))
                                            setToWarehouseId(String(s.to_warehouse_id))
                                            setFormItems([{ product_id: String(s.product_id), quantity: String(s.suggested_quantity ?? s.quantity) }])
                                            setShowSuggest(false)
                                            setShowCreateModal(true)
                                        }}
                                    >
                                        Criar
                                    </Button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </Modal>
        </div>
    )
}
