import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import api from '@/lib/api'
import { broadcastQueryInvalidation } from '@/lib/cross-tab-sync'
import { QUOTE_STATUS } from '@/lib/constants'
import type { Quote, QuoteEquipment, QuoteItem } from '@/types/quote'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'
import { ArrowLeft, Save, Plus, Trash2, Package, Wrench } from 'lucide-react'
import { useAuthStore } from '@/stores/auth-store'
import PriceHistoryHint from '@/components/common/PriceHistoryHint'
import QuickProductServiceModal from '@/components/common/QuickProductServiceModal'

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
    const [source, setSource] = useState('')
    const [paymentTerms, setPaymentTerms] = useState('')
    const [paymentTermsDetail, setPaymentTermsDetail] = useState('')
    const [discountPercentage, setDiscountPercentage] = useState(0)
    const [displacementValue, setDisplacementValue] = useState(0)
    const [addItemEquipmentId, setAddItemEquipmentId] = useState<number | null>(null)
    const [newItem, setNewItem] = useState<ItemForm>({ type: 'service', custom_description: '', quantity: 1, original_price: 0, unit_price: 0, discount_percentage: 0 })
    const [showAddEquipment, setShowAddEquipment] = useState(false)
    const [showQuickProductService, setShowQuickProductService] = useState(false)
    const [quickPSTab, setQuickPSTab] = useState<'product' | 'service'>('product')
    const [removeEquipmentTarget, setRemoveEquipmentTarget] = useState<{ quoteEquipId: number; equipmentName: string } | null>(null)

    const { data: quote, isLoading } = useQuery<Quote>({
        queryKey: ['quote', id],
        queryFn: () => api.get(`/quotes/${id}`).then(r => r.data),
        enabled: !!id,
    })

    const { data: customerEquipmentsRes } = useQuery({
        queryKey: ['customer-equipments', quote?.customer_id],
        queryFn: () => api.get(`/customers/${quote!.customer_id}`).then(r => r.data),
        enabled: !!quote?.customer_id,
    })
    const customerEquipments: { id: number; brand?: string; model?: string; tag?: string }[] = customerEquipmentsRes?.equipments ?? []

    const { data: products } = useQuery({ queryKey: ['products'], queryFn: () => api.get('/products?per_page=999').then(r => r.data?.data ?? r.data) })
    const { data: services } = useQuery({ queryKey: ['services'], queryFn: () => api.get('/services?per_page=999').then(r => r.data?.data ?? r.data) })

    useEffect(() => {
        if (quote) {
            setValidUntil(quote.valid_until ? new Date(quote.valid_until).toISOString().slice(0, 10) : '')
            setObservations(quote.observations ?? '')
            setInternalNotes(quote.internal_notes ?? '')
            setSource(quote.source ?? '')
            setDiscountPercentage(parseFloat(String(quote.discount_percentage)) || 0)
            setDisplacementValue(parseFloat(String(quote.displacement_value)) || 0)
            setPaymentTerms((quote as any).payment_terms ?? '')
            setPaymentTermsDetail((quote as any).payment_terms_detail ?? '')
        }
    }, [quote])

    const invalidateAll = () => {
        qc.invalidateQueries({ queryKey: ['quote', id] })
        qc.invalidateQueries({ queryKey: ['quotes'] })
        qc.invalidateQueries({ queryKey: ['quotes-summary'] })
        broadcastQueryInvalidation(['quotes', 'quotes-summary', 'dashboard'], 'Orçamento')
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

    const addEquipmentMut = useMutation({
        mutationFn: (equipmentId: number) => api.post(`/quotes/${id}/equipments`, { equipment_id: equipmentId }),
        onSuccess: () => { toast.success('Equipamento adicionado!'); setShowAddEquipment(false); invalidateAll() },
        onError: (err: any) => toast.error(err?.response?.data?.message || 'Erro ao adicionar equipamento'),
    })

    const removeEquipmentMut = useMutation({
        mutationFn: ({ quoteEquipId }: { quoteEquipId: number }) => api.delete(`/quotes/${id}/equipments/${quoteEquipId}`),
        onSuccess: () => { toast.success('Equipamento removido!'); invalidateAll() },
        onError: (err: any) => toast.error(err?.response?.data?.message || 'Erro ao remover equipamento'),
    })

    const handleSaveGeneral = () => {
        updateMut.mutate({
            valid_until: validUntil || null,
            source: source || null,
            observations: observations || null,
            internal_notes: internalNotes || null,
            discount_percentage: discountPercentage,
            displacement_value: displacementValue,
            payment_terms: paymentTerms || null,
            payment_terms_detail: paymentTermsDetail || null,
        })
    }

    const isMutable = quote ? (quote.status === QUOTE_STATUS.DRAFT || quote.status === QUOTE_STATUS.PENDING_INTERNAL || quote.status === QUOTE_STATUS.REJECTED) : true

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
                    <div>
                        <label className="block text-sm font-medium text-content-secondary mb-1">Deslocamento (R$)</label>
                        <Input type="number" min={0} step={0.01} value={displacementValue} onChange={(e) => setDisplacementValue(parseFloat(e.target.value) || 0)} />
                    </div>
                    <div className="md:col-span-2">
                        <label htmlFor="quote-observations" className="block text-sm font-medium text-content-secondary mb-1">Observações</label>
                        <textarea id="quote-observations" aria-label="Observações do orçamento" className="w-full rounded-lg border border-default p-3 text-sm min-h-[80px]" value={observations} onChange={(e) => setObservations(e.target.value)} placeholder="Observações visíveis ao cliente" />
                    </div>
                    <div className="md:col-span-2">
                        <label htmlFor="quote-internal-notes" className="block text-sm font-medium text-content-secondary mb-1">Notas Internas</label>
                        <textarea id="quote-internal-notes" aria-label="Notas internas do orçamento" className="w-full rounded-lg border border-default p-3 text-sm min-h-[60px]" value={internalNotes} onChange={(e) => setInternalNotes(e.target.value)} placeholder="Notas visíveis apenas internamente" />
                    </div>
                    <div>
                        <label htmlFor="quote-source" className="block text-sm font-medium text-content-secondary mb-1">Origem Comercial</label>
                        <select id="quote-source" aria-label="Origem comercial" value={source} onChange={e => setSource(e.target.value)}
                            className="w-full rounded-lg border border-default bg-surface-50 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none">
                            <option value="">Selecione (opcional)</option>
                            <option value="prospeccao">Prospecção</option>
                            <option value="retorno">Retorno</option>
                            <option value="contato_direto">Contato Direto</option>
                            <option value="indicacao">Indicação</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-content-secondary mb-1">Condições de Pagamento</label>
                        <select value={paymentTerms} onChange={e => setPaymentTerms(e.target.value)}
                            className="w-full rounded-lg border border-default bg-surface-50 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none">
                            <option value="">Selecione (opcional)</option>
                            <option value="a_vista">À Vista</option>
                            <option value="boleto_30">Boleto 30 dias</option>
                            <option value="boleto_30_60">Boleto 30/60 dias</option>
                            <option value="boleto_30_60_90">Boleto 30/60/90 dias</option>
                            <option value="cartao_credito">Cartão de Crédito</option>
                            <option value="cartao_debito">Cartão de Débito</option>
                            <option value="pix">PIX</option>
                            <option value="transferencia">Transferência Bancária</option>
                            <option value="cheque">Cheque</option>
                            <option value="financiamento">Financiamento</option>
                            <option value="parcelado">Parcelado</option>
                            <option value="consignado">Consignado</option>
                            <option value="outros">Outros</option>
                        </select>
                    </div>
                    {paymentTerms && (
                        <div className="md:col-span-2">
                            <label className="block text-sm font-medium text-content-secondary mb-1">Detalhes do Pagamento</label>
                            <input value={paymentTermsDetail} onChange={e => setPaymentTermsDetail(e.target.value)}
                                placeholder="Detalhes adicionais sobre forma de pagamento..."
                                className="w-full rounded-lg border border-default bg-surface-50 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none" />
                        </div>
                    )}
                </div>
                <div className="flex justify-end mt-4">
                    <Button icon={<Save className="h-4 w-4" />} onClick={handleSaveGeneral} disabled={updateMut.isPending}>
                        {updateMut.isPending ? 'Salvando...' : 'Salvar Alterações'}
                    </Button>
                </div>
            </Card>

            {/* Equipamentos e Itens */}
            <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-content-secondary">Equipamentos e Itens</h2>
                <Button variant="outline" size="sm" icon={<Plus className="h-4 w-4" />} onClick={() => setShowAddEquipment(!showAddEquipment)}>
                    Adicionar Equipamento
                </Button>
            </div>

            {showAddEquipment && (
                <Card className="p-4 border-dashed border-brand-300 bg-brand-50/30">
                    <h4 className="text-sm font-medium text-content-primary mb-3">Selecione um equipamento do cliente</h4>
                    {customerEquipments.length === 0 ? (
                        <p className="text-sm text-content-tertiary italic">Nenhum equipamento cadastrado para este cliente.</p>
                    ) : (
                        <div className="flex flex-wrap gap-2">
                            {customerEquipments
                                .filter(ce => !quote.equipments?.some(qe => qe.equipment_id === ce.id))
                                .map(ce => (
                                    <button
                                        key={ce.id}
                                        type="button"
                                        onClick={() => addEquipmentMut.mutate(ce.id)}
                                        disabled={addEquipmentMut.isPending}
                                        className="rounded-lg border border-surface-200 px-3 py-1.5 text-xs font-medium text-surface-600 hover:border-brand-500 hover:bg-brand-50 hover:text-brand-700 transition-all"
                                    >
                                        <Plus className="inline h-3 w-3 mr-1" />
                                        {ce.brand ? `${ce.brand} ${ce.model}` : ce.model ?? ce.tag ?? `Equip #${ce.id}`}
                                    </button>
                                ))
                            }
                            {customerEquipments.filter(ce => !quote.equipments?.some(qe => qe.equipment_id === ce.id)).length === 0 && (
                                <p className="text-sm text-content-tertiary italic">Todos os equipamentos do cliente já foram adicionados.</p>
                            )}
                        </div>
                    )}
                </Card>
            )}

            {quote.equipments?.map((eq) => (
                <Card key={eq.id} className="p-5">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="font-medium text-content-primary">
                            {eq.equipment?.tag || eq.equipment?.model || 'Equipamento'}
                            {eq.description && <span className="text-sm text-content-secondary ml-2">— {eq.description}</span>}
                        </h3>
                        <div className="flex gap-2">
                            <Button variant="outline" size="sm" icon={<Plus className="h-4 w-4" />} onClick={() => setAddItemEquipmentId(eq.id)}>
                                Adicionar Item
                            </Button>
                            <Button
                                variant="danger"
                                size="sm"
                                icon={<Trash2 className="h-4 w-4" />}
                                onClick={() => setRemoveEquipmentTarget({ quoteEquipId: eq.id, equipmentName: eq.equipment?.tag || eq.equipment?.model || 'Equipamento' })}
                                disabled={removeEquipmentMut.isPending}
                            >
                                Remover
                            </Button>
                        </div>
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
                                    <label htmlFor="new-item-type" className="text-xs text-content-secondary">Tipo</label>
                                    <select id="new-item-type" aria-label="Tipo do item (produto ou serviço)" className="w-full mt-1 rounded-lg border border-default p-2 text-sm" value={newItem.type} onChange={(e) => setNewItem({ ...newItem, type: e.target.value as 'product' | 'service', product_id: null, service_id: null })}>
                                        <option value="product">Produto</option>
                                        <option value="service">Serviço</option>
                                    </select>
                                </div>
                                <div>
                                    <label htmlFor="new-item-product-service" className="text-xs text-content-secondary">{newItem.type === 'product' ? 'Produto' : 'Serviço'}</label>
                                    <div className="flex gap-1 items-center mt-1">
                                        <select id="new-item-product-service" aria-label={newItem.type === 'product' ? 'Selecionar produto' : 'Selecionar serviço'} className="flex-1 rounded-lg border border-default p-2 text-sm" onChange={(e) => {
                                            const val = parseInt(e.target.value)
                                            if (newItem.type === 'product') {
                                                const p = (products ?? []).find((x: any) => x.id === val)
                                                const price = p?.sell_price ?? 0
                                                setNewItem({ ...newItem, product_id: val, unit_price: price, original_price: price, custom_description: p?.name ?? '' })
                                            } else {
                                                const s = (services ?? []).find((x: any) => x.id === val)
                                                const price = s?.default_price ?? 0
                                                setNewItem({ ...newItem, service_id: val, unit_price: price, original_price: price, custom_description: s?.name ?? '' })
                                            }
                                        }}>
                                            <option value="">Selecione...</option>
                                            {(newItem.type === 'product' ? products : services)?.map((x: any) => (
                                                <option key={x.id} value={x.id}>{x.name}</option>
                                            ))}
                                        </select>
                                        <button
                                            type="button"
                                            onClick={() => { setQuickPSTab(newItem.type); setShowQuickProductService(true) }}
                                            title={`Cadastrar novo ${newItem.type === 'product' ? 'produto' : 'serviço'}`}
                                            className={`flex items-center justify-center rounded-lg border border-dashed h-[34px] w-[34px] transition-colors ${newItem.type === 'product'
                                                ? 'border-brand-300 bg-brand-50 text-brand-600 hover:bg-brand-100 hover:border-brand-400'
                                                : 'border-emerald-300 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 hover:border-emerald-400'
                                                }`}
                                        >
                                            <Plus className="h-3.5 w-3.5" />
                                        </button>
                                    </div>
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
                            {quote?.customer_id && (newItem.product_id || newItem.service_id) && (
                                <div className="mt-3">
                                    <PriceHistoryHint
                                        customerId={quote.customer_id}
                                        type={newItem.type}
                                        referenceId={newItem.product_id || newItem.service_id || undefined}
                                        onApplyPrice={(price) => setNewItem(prev => ({ ...prev, unit_price: price }))}
                                    />
                                </div>
                            )}
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

            <QuickProductServiceModal
                open={showQuickProductService}
                onOpenChange={setShowQuickProductService}
                defaultTab={quickPSTab}
            />

            {removeEquipmentTarget && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setRemoveEquipmentTarget(null)}>
                    <div className="bg-surface-0 rounded-xl p-6 max-w-sm mx-4 shadow-elevated" onClick={(e) => e.stopPropagation()}>
                        <h3 className="text-lg font-semibold text-content-primary mb-2">Remover equipamento</h3>
                        <p className="text-content-secondary text-sm mb-6">
                            Remover <strong>{removeEquipmentTarget.equipmentName}</strong> e todos os itens vinculados? Esta ação não pode ser desfeita.
                        </p>
                        <div className="flex gap-3 justify-end">
                            <Button variant="outline" size="sm" onClick={() => setRemoveEquipmentTarget(null)}>Cancelar</Button>
                            <Button
                                variant="danger"
                                size="sm"
                                onClick={() => {
                                    removeEquipmentMut.mutate({ quoteEquipId: removeEquipmentTarget.quoteEquipId })
                                    setRemoveEquipmentTarget(null)
                                }}
                                disabled={removeEquipmentMut.isPending}
                            >
                                {removeEquipmentMut.isPending ? 'Removendo...' : 'Remover'}
                            </Button>
                        </div>
                    </div>
                </div>
            )}
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
                    <button type="button" onClick={() => setEditing(true)} className="p-1 rounded hover:bg-surface-200 opacity-0 group-hover:opacity-100 transition-opacity text-content-secondary" aria-label="Editar item">✏️</button>
                    {confirmDelete ? (
                        <div className="flex gap-1">
                            <button type="button" onClick={onRemove} className="text-xs text-red-600 font-medium" aria-label="Confirmar remoção do item">Sim</button>
                            <button type="button" onClick={() => setConfirmDelete(false)} className="text-xs text-content-secondary" aria-label="Cancelar remoção">Não</button>
                        </div>
                    ) : (
                        <button type="button" onClick={() => setConfirmDelete(true)} className="p-1 rounded hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-opacity text-red-500" aria-label="Remover item">
                            <Trash2 className="h-3.5 w-3.5" aria-hidden />
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
                <Button size="sm" disabled={saving} onClick={() => { onSave({ quantity: qty, unit_price: price, discount_percentage: disc }); setEditing(false) }}>
                    Salvar
                </Button>
            </div>
        </div>
    )
}
