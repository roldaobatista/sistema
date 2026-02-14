import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import api from '@/lib/api'
import { QUOTE_STATUS } from '@/lib/constants'
import type { Quote, QuoteEquipment, QuoteItem } from '@/types/quote'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'
import { ArrowLeft, Save, Plus, Trash2, Package, Wrench } from 'lucide-react'
import { useAuthStore } from '@/stores/auth-store'

const formatCurrency = (v: number | string) => {
    const n = typeof v === 'string' ? parseFloat(v) : v
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(n || 0)
}

interface ItemForm {
    type: 'product' | 'service'
    product_id?: number | null
    service_id?: number | null
    custom_description: string
    quantity: number
    original_price: number
    unit_price: number
    discount_percentage: number
}

export function QuoteEditPage() {
  const { hasPermission } = useAuthStore()

    const { id } = useParams<{ id: string }>()
    const navigate = useNavigate()
    const qc = useQueryClient()

    const [validUntil, setValidUntil] = useState('')
    const [observations, setObservations] = useState('')
    const [internalNotes, setInternalNotes] = useState('')
    const [discountPercentage, setDiscountPercentage] = useState(0)
    const [discountAmount, setDiscountAmount] = useState(0)
    const [addItemEquipmentId, setAddItemEquipmentId] = useState<number | null>(null)
    const [newItem, setNewItem] = useState<ItemForm>({ type: 'service', custom_description: '', quantity: 1, original_price: 0, unit_price: 0, discount_percentage: 0 })

    const { data: quote, isLoading } = useQuery<Quote>({
        queryKey: ['quote', id],
        queryFn: () => api.get(`/quotes/${id}`).then(r => r.data),
        enabled: !!id,
    })

    const { data: products } = useQuery({ queryKey: ['products'], queryFn: () => api.get('/products?per_page=999').then(r => r.data?.data ?? r.data) })
    const { data: services } = useQuery({ queryKey: ['services'], queryFn: () => api.get('/services?per_page=999').then(r => r.data?.data ?? r.data) })

    useEffect(() => {
        if (quote) {
            setValidUntil(quote.valid_until ? new Date(quote.valid_until).toISOString().slice(0, 10) : '')
            setObservations(quote.observations ?? '')
            setInternalNotes(quote.internal_notes ?? '')
            setDiscountPercentage(parseFloat(String(quote.discount_percentage)) || 0)
            setDiscountAmount(parseFloat(String(quote.discount_amount)) || 0)
        }
    }, [quote])

    const invalidateAll = () => {
        qc.invalidateQueries({ queryKey: ['quote', id] })
        qc.invalidateQueries({ queryKey: ['quotes'] })
        qc.invalidateQueries({ queryKey: ['quotes-summary'] })
    }

    const updateMut = useMutation({
        mutationFn: (data: Record<string, unknown>) => api.put(`/quotes/${id}`, data),
        onSuccess: () => { toast.success('Orçamento atualizado!'); invalidateAll() },
        onError: (err: any) => toast.error(err?.response?.data?.message || 'Erro ao atualizar'),
    })

    const updateItemMut = useMutation({
        mutationFn: ({ itemId, data }: { itemId: number; data: Partial<QuoteItem> }) => api.put(`/quote-items/${itemId}`, data),
        onSuccess: () => { toast.success('Item atualizado!'); invalidateAll() },
        onError: (err: any) => toast.error(err?.response?.data?.message || 'Erro ao atualizar item'),
    })

    const removeItemMut = useMutation({
        mutationFn: (itemId: number) => api.delete(`/quote-items/${itemId}`),
        onSuccess: () => { toast.success('Item removido!'); invalidateAll() },
        onError: (err: any) => toast.error(err?.response?.data?.message || 'Erro ao remover item'),
    })

    const addItemMut = useMutation({
        mutationFn: ({ equipId, data }: { equipId: number; data: ItemForm }) => api.post(`/quote-equipments/${equipId}/items`, data),
        onSuccess: () => {
            toast.success('Item adicionado!')
            setAddItemEquipmentId(null)
            setNewItem({ type: 'service', custom_description: '', quantity: 1, original_price: 0, unit_price: 0, discount_percentage: 0 })
            invalidateAll()
        },
        onError: (err: any) => toast.error(err?.response?.data?.message || 'Erro ao adicionar item'),
    })

    const handleSaveGeneral = () => {
        updateMut.mutate({
            valid_until: validUntil || null,
            observations: observations || null,
            internal_notes: internalNotes || null,
            discount_percentage: discountPercentage,
            discount_amount: discountAmount,
        })
    }

    const isMutable = quote ? (quote.status === QUOTE_STATUS.DRAFT || quote.status === QUOTE_STATUS.REJECTED) : true

    useEffect(() => {
        if (quote && !isMutable) {
            toast.error('Orçamento não pode ser editado neste status')
            navigate(`/orcamentos/${id}`)
        }
    }, [quote, isMutable, navigate, id])

    if (isLoading) {
        return (
            <div className="space-y-6">
                <div className="h-8 w-48 bg-surface-100 rounded animate-pulse" />
                {[1, 2].map(i => <div key={i} className="h-40 bg-surface-100 rounded-xl animate-pulse" />)}
            </div>
        )
    }

    if (!quote) {
        return (
            <div className="text-center py-20">
                <p className="text-content-secondary">Orçamento não encontrado</p>
                <Button variant="outline" className="mt-4" onClick={() => navigate('/orcamentos')}>Voltar</Button>
            </div>
        )
    }

    if (!isMutable) {
        return null
    }

    return (
        <div className="space-y-6 max-w-4xl mx-auto">
            <div className="flex items-center gap-3">
                <Button variant="ghost" size="icon" onClick={() => navigate(`/orcamentos/${id}`)}>
                    <ArrowLeft className="h-5 w-5" />
                </Button>
                <h1 className="text-2xl font-bold text-content-primary">
                    Editar Orçamento {quote.quote_number}
                </h1>
            </div>

            {/* Dados gerais */}
            <Card className="p-5">
                <h3 className="text-sm font-semibold text-content-secondary mb-4">Dados Gerais</h3>
                <div className="grid gap-4 md:grid-cols-2">
                    <div>
                        <label className="block text-sm font-medium text-content-secondary mb-1">Validade</label>
                        <Input type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-content-secondary mb-1">Desconto (%)</label>
                        <Input type="number" min={0} max={100} step={0.01} value={discountPercentage} onChange={(e) => setDiscountPercentage(parseFloat(e.target.value) || 0)} />
                    </div>
                    <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-content-secondary mb-1">Observações</label>
                        <textarea className="w-full rounded-lg border border-default p-3 text-sm min-h-[80px]" value={observations} onChange={(e) => setObservations(e.target.value)} />
                    </div>
                    <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-content-secondary mb-1">Notas Internas</label>
                        <textarea className="w-full rounded-lg border border-default p-3 text-sm min-h-[60px]" value={internalNotes} onChange={(e) => setInternalNotes(e.target.value)} />
                    </div>
                </div>
                <div className="flex justify-end mt-4">
                    <Button icon={<Save className="h-4 w-4" />} onClick={handleSaveGeneral} disabled={updateMut.isPending}>
                        {updateMut.isPending ? 'Salvando...' : 'Salvar Alterações'}
                    </Button>
                </div>
            </Card>

            {/* Equipamentos e Itens */}
            {quote.equipments?.map((eq) => (
                <Card key={eq.id} className="p-5">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="font-medium text-content-primary">
                            {eq.equipment?.tag || eq.equipment?.model || 'Equipamento'}
                            {eq.description && <span className="text-sm text-content-secondary ml-2">— {eq.description}</span>}
                        </h3>
                        <Button variant="outline" size="sm" icon={<Plus className="h-4 w-4" />} onClick={() => setAddItemEquipmentId(eq.id)}>
                            Adicionar Item
                        </Button>
                    </div>

                    <div className="space-y-3">
                        {eq.items?.map((item) => (
                            <EditableItemRow
                                key={item.id}
                                item={item}
                                onSave={(data) => updateItemMut.mutate({ itemId: item.id, data })}
                                onRemove={() => removeItemMut.mutate(item.id)}
                                saving={updateItemMut.isPending}
                            />
                        ))}
                    </div>

                    {/* Add item form */}
                    {addItemEquipmentId === eq.id && (
                        <div className="mt-4 p-4 border border-dashed border-brand-300 rounded-lg bg-brand-50/30">
                            <h4 className="text-sm font-medium text-content-primary mb-3">Novo Item</h4>
                            <div className="grid gap-3 md:grid-cols-2">
                                <div>
                                    <label className="text-xs text-content-secondary">Tipo</label>
                                    <select className="w-full mt-1 rounded-lg border border-default p-2 text-sm" value={newItem.type} onChange={(e) => setNewItem({ ...newItem, type: e.target.value as 'product' | 'service', product_id: null, service_id: null })}>
                                        <option value="product">Produto</option>
                                        <option value="service">Serviço</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="text-xs text-content-secondary">{newItem.type === 'product' ? 'Produto' : 'Serviço'}</label>
                                    <select className="w-full mt-1 rounded-lg border border-default p-2 text-sm" onChange={(e) => {
                                        const val = parseInt(e.target.value)
                                        if (newItem.type === 'product') {
                                            const p = (products ?? []).find((x: any) => x.id === val)
                                            setNewItem({ ...newItem, product_id: val, unit_price: p?.price ?? 0, original_price: p?.price ?? 0, custom_description: p?.name ?? '' })
                                        } else {
                                            const s = (services ?? []).find((x: any) => x.id === val)
                                            setNewItem({ ...newItem, service_id: val, unit_price: s?.price ?? 0, original_price: s?.price ?? 0, custom_description: s?.name ?? '' })
                                        }
                                    }}>
                                        <option value="">Selecione...</option>
                                        {(newItem.type === 'product' ? products : services)?.map((x: any) => (
                                            <option key={x.id} value={x.id}>{x.name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="text-xs text-content-secondary">Quantidade</label>
                                    <Input type="number" min={0.01} step={0.01} value={newItem.quantity} onChange={(e) => setNewItem({ ...newItem, quantity: parseFloat(e.target.value) || 0 })} />
                                </div>
                                <div>
                                    <label className="text-xs text-content-secondary">Preço Unitário</label>
                                    <Input type="number" min={0} step={0.01} value={newItem.unit_price} onChange={(e) => setNewItem({ ...newItem, unit_price: parseFloat(e.target.value) || 0 })} />
                                </div>
                                <div>
                                    <label className="text-xs text-content-secondary">Desconto (%)</label>
                                    <Input type="number" min={0} max={100} step={0.01} value={newItem.discount_percentage} onChange={(e) => setNewItem({ ...newItem, discount_percentage: parseFloat(e.target.value) || 0 })} />
                                </div>
                                <div>
                                    <label className="text-xs text-content-secondary">Descrição</label>
                                    <Input value={newItem.custom_description} onChange={(e) => setNewItem({ ...newItem, custom_description: e.target.value })} />
                                </div>
                            </div>
                            <div className="flex gap-2 justify-end mt-3">
                                <Button variant="outline" size="sm" onClick={() => setAddItemEquipmentId(null)}>Cancelar</Button>
                                <Button size="sm" onClick={() => addItemMut.mutate({ equipId: eq.id, data: newItem })} disabled={addItemMut.isPending}>
                                    {addItemMut.isPending ? 'Adicionando...' : 'Adicionar'}
                                </Button>
                            </div>
                        </div>
                    )}
                </Card>
            ))}
        </div>
    )
}

function EditableItemRow({ item, onSave, onRemove, saving }: {
    item: QuoteItem
    onSave: (data: Partial<QuoteItem>) => void
    onRemove: () => void
    saving: boolean
}) {
    const [editing, setEditing] = useState(false)
    const [qty, setQty] = useState(item.quantity)
    const [price, setPrice] = useState(parseFloat(String(item.unit_price)))
    const [disc, setDisc] = useState(parseFloat(String(item.discount_percentage)) || 0)
    const [confirmDelete, setConfirmDelete] = useState(false)

    const name = item.custom_description || item.product?.name || item.service?.name || '—'
    const icon = item.type === 'product' ? <Package className="h-4 w-4 text-blue-500" /> : <Wrench className="h-4 w-4 text-amber-500" />

    if (!editing) {
        return (
            <div className="flex items-center justify-between p-3 rounded-lg bg-surface-50 group">
                <div className="flex items-center gap-2 flex-1">
                    {icon}
                    <span className="text-sm font-medium">{name}</span>
                    <span className="text-xs text-content-tertiary">×{item.quantity}</span>
                    <span className="text-xs text-content-tertiary">@ {formatCurrency(item.unit_price)}</span>
                    {parseFloat(String(item.discount_percentage)) > 0 && <span className="text-xs text-red-500">-{item.discount_percentage}%</span>}
                </div>
                <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">{formatCurrency(item.subtotal)}</span>
                    <button onClick={() => setEditing(true)} className="p-1 rounded hover:bg-surface-200 opacity-0 group-hover:opacity-100 transition-opacity text-content-secondary">✏️</button>
                    {confirmDelete ? (
                        <div className="flex gap-1">
                            <button onClick={onRemove} className="text-xs text-red-600 font-medium">Sim</button>
                            <button onClick={() => setConfirmDelete(false)} className="text-xs text-content-secondary">Não</button>
                        </div>
                    ) : (
                        <button onClick={() => setConfirmDelete(true)} className="p-1 rounded hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-opacity text-red-500">
                            <Trash2 className="h-3.5 w-3.5" />
                        </button>
                    )}
                </div>
            </div>
        )
    }

    return (
        <div className="p-3 rounded-lg border border-brand-300 bg-brand-50/20">
            <div className="grid gap-2 grid-cols-3">
                <div>
                    <label className="text-xs text-content-secondary">Quantidade</label>
                    <Input type="number" min={0.01} step={0.01} value={qty} onChange={(e) => setQty(parseFloat(e.target.value) || 0)} />
                </div>
                <div>
                    <label className="text-xs text-content-secondary">Preço Unitário</label>
                    <Input type="number" min={0} step={0.01} value={price} onChange={(e) => setPrice(parseFloat(e.target.value) || 0)} />
                </div>
                <div>
                    <label className="text-xs text-content-secondary">Desconto (%)</label>
                    <Input type="number" min={0} max={100} step={0.01} value={disc} onChange={(e) => setDisc(parseFloat(e.target.value) || 0)} />
                </div>
            </div>
            <div className="flex gap-2 justify-end mt-2">
                <Button variant="outline" size="sm" onClick={() => setEditing(false)}>Cancelar</Button>
                <Button size="sm" disabled={saving} onClick={() => { onSave({ quantity: qty, unit_price: price, discount_percentage: disc } as any); setEditing(false) }}>
                    Salvar
                </Button>
            </div>
        </div>
    )
}
