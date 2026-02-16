import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Plus, Trash2, Package, Briefcase, Users, Truck } from 'lucide-react'
import api from '@/lib/api'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { PageHeader } from '@/components/ui/pageheader'
import { useAuthStore } from '@/stores/auth-store'
import { usePriceGate } from '@/hooks/usePriceGate'
import PriceHistoryHint from '@/components/common/PriceHistoryHint'

interface ItemForm {
    type: 'product' | 'service'
    reference_id: number | ''
    description: string
    quantity: string
    unit_price: string
    discount: string
}

const emptyItem: ItemForm = {
    type: 'product', reference_id: '', description: '',
    quantity: '1', unit_price: '0', discount: '0',
}

export function WorkOrderCreatePage() {
  const { hasPermission } = useAuthStore()
  const { canViewPrices } = usePriceGate()

    const navigate = useNavigate()
    const qc = useQueryClient()
    const [searchParams] = useSearchParams()

    const [form, setForm] = useState({
        customer_id: '' as string | number,
        equipment_id: '' as string | number,
        assigned_to: '' as string | number,
        priority: 'normal',
        description: '',
        internal_notes: '',
        discount: '0',
        // Novos campos v2
        os_number: '',
        seller_id: '' as string | number,
        driver_id: '' as string | number,
        origin_type: (searchParams.get('origin') || 'direct') as string,
        quote_id: searchParams.get('quote_id') || '',
        service_call_id: searchParams.get('service_call_id') || '',
        discount_percentage: '0',
        displacement_value: '0',
        is_warranty: false,
    })
    const [selectedTechIds, setSelectedTechIds] = useState<number[]>([])
    const [selectedEquipIds, setSelectedEquipIds] = useState<number[]>([])
    const [newEquip, setNewEquip] = useState({ type: '', brand: '', model: '', serial_number: '' })
    const [showNewEquip, setShowNewEquip] = useState(false)
    const [items, setItems] = useState<ItemForm[]>([])
    const [customerSearch, setCustomerSearch] = useState('')

    // Queries
    const { data: customersRes } = useQuery({
        queryKey: ['customers-select', customerSearch],
        queryFn: () => api.get('/customers', { params: { search: customerSearch, per_page: 20, is_active: true } }),
        enabled: customerSearch.length >= 2,
    })

    const { data: productsRes } = useQuery({
        queryKey: ['products-select'],
        queryFn: () => api.get('/products', { params: { per_page: 100, is_active: true } }),
    })

    const { data: servicesRes } = useQuery({
        queryKey: ['services-select'],
        queryFn: () => api.get('/services', { params: { per_page: 100, is_active: true } }),
    })

    const { data: techsRes } = useQuery({
        queryKey: ['technicians'],
        queryFn: () => api.get('/users', { params: { per_page: 50 } }),
    })

    const customers = customersRes?.data?.data ?? []
    const products = productsRes?.data?.data ?? []
    const services = servicesRes?.data?.data ?? []
    const technicians = techsRes?.data?.data ?? []

    const saveMut = useMutation({
        mutationFn: (data: any) => api.post('/work-orders', data),
        onSuccess: (res) => {
            qc.invalidateQueries({ queryKey: ['work-orders'] })
            toast.success('OS criada com sucesso!')
            const warrantyWarning = res?.data?.warranty_warning
            if (warrantyWarning) {
                toast.warning(warrantyWarning, { duration: 8000 })
            }
            const workOrderId = res?.data?.data?.id ?? res?.data?.id
            if (workOrderId) navigate(`/os/${workOrderId}`)
        },
        onError: (err: any) => toast.error(err?.response?.data?.message || 'Erro ao criar OS'),
    })

    const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) =>
        setForm(prev => ({ ...prev, [k]: v }))

    const addItem = () => setItems(prev => [...prev, { ...emptyItem }])

    const updateItem = (i: number, field: keyof ItemForm, val: any) => {
        setItems(prev => prev.map((item, idx) => {
            if (idx !== i) return item
            const updated = { ...item, [field]: val }
            // Clear reference when switching type
            if (field === 'type' && val !== item.type) {
                updated.reference_id = ''
                updated.description = ''
                updated.unit_price = '0'
            }
            // Auto-fill from reference
            if (field === 'reference_id' && val) {
                const list = updated.type === 'product' ? products : services
                const ref = list.find((r: any) => r.id === Number(val))
                if (ref) {
                    updated.description = ref.name
                    updated.unit_price = updated.type === 'product' ? ref.sell_price : ref.default_price
                }
            }
            return updated
        }))
    }

    const removeItem = (i: number) => setItems(prev => prev.filter((_, idx) => idx !== i))

    const itemTotal = (it: ItemForm) => Math.max(0, (parseFloat(it.quantity) || 0) * (parseFloat(it.unit_price) || 0) - (parseFloat(it.discount) || 0))
    const round2 = (n: number) => Math.round(n * 100) / 100
    const subtotal = items.reduce((sum, it) => sum + itemTotal(it), 0)
    const discountFixed = parseFloat(form.discount) || 0
    const discountPercent = parseFloat(form.discount_percentage) || 0
    const displacement = parseFloat(form.displacement_value) || 0
    // Backend uses OR logic: either percentage OR fixed discount, never both
    const discountAmount = discountPercent > 0
        ? round2(subtotal * discountPercent / 100)
        : discountFixed
    const grandTotal = Math.max(0, subtotal - discountAmount + displacement)

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        const payload: any = {
            ...form,
            technician_ids: selectedTechIds.length > 0 ? selectedTechIds : undefined,
            equipment_ids: selectedEquipIds.length > 0 ? selectedEquipIds : undefined,
            items: items.map(it => ({
                ...it,
                reference_id: it.reference_id || null,
            })),
        }
        if (showNewEquip && newEquip.type) {
            payload.new_equipment = newEquip
        }
        saveMut.mutate(payload)
    }

    return (
        <div className="space-y-5">
            <PageHeader
                title="Nova Ordem de Serviço"
                subtitle="Preencha os dados para abrir uma OS"
                backTo="/os"
            />

            <form onSubmit={handleSubmit} className="space-y-5">
                <div className="rounded-xl border border-default bg-surface-0 p-5 shadow-card space-y-4">
                    <h2 className="text-sm font-semibold text-surface-900">Dados Gerais</h2>
                    <div className="grid gap-4 sm:grid-cols-2">
                        <div>
                            <label className="mb-1.5 block text-sm font-medium text-surface-700">Cliente *</label>
                            <input
                                type="text"
                                value={customerSearch}
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCustomerSearch(e.target.value)}
                                placeholder="Digite para buscar cliente..."
                                className="w-full rounded-lg border border-default bg-surface-50 px-3.5 py-2.5 text-sm focus:border-brand-400 focus:bg-surface-0 focus:outline-none focus:ring-2 focus:ring-brand-500/15"
                            />
                            {customers.length > 0 && !form.customer_id && (
                                <div className="mt-1 max-h-32 overflow-y-auto rounded-lg border border-default bg-surface-0 shadow-lg">
                                    {customers.map((c: any) => (
                                        <button key={c.id} type="button"
                                            onClick={() => { set('customer_id', c.id); setCustomerSearch(c.name) }}
                                            className="w-full px-3 py-2 text-left text-sm hover:bg-surface-50">
                                            <span className="font-medium">{c.name}</span>
                                            {c.document && <span className="ml-2 text-xs text-surface-400">{c.document}</span>}
                                        </button>
                                    ))}
                                </div>
                            )}
                            {form.customer_id && (
                                <button type="button" onClick={() => { set('customer_id', ''); setCustomerSearch('') }}
                                    className="mt-1 text-xs text-red-500 hover:underline">Limpar seleção</button>
                            )}
                        </div>

                        <div>
                            <label className="mb-1.5 block text-sm font-medium text-surface-700">Prioridade</label>
                            <select value={form.priority} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => set('priority', e.target.value)}
                                className="w-full rounded-lg border border-default bg-surface-50 px-3.5 py-2.5 text-sm focus:border-brand-400 focus:bg-surface-0 focus:outline-none focus:ring-2 focus:ring-brand-500/15">
                                <option value="low">Baixa</option>
                                <option value="normal">Normal</option>
                                <option value="high">Alta</option>
                                <option value="urgent">Urgente</option>
                            </select>
                        </div>

                        <div className="flex items-center gap-2 pt-6">
                            <label className="flex items-center gap-2 text-sm text-surface-700 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={form.is_warranty}
                                    onChange={e => setForm(p => ({ ...p, is_warranty: e.target.checked }))}
                                    className="rounded border-surface-400 text-brand-600 focus:ring-brand-500"
                                />
                                OS de Garantia
                                <span className="text-xs text-surface-400">(não gera comissão)</span>
                            </label>
                        </div>

                        <div>
                            <label className="mb-1.5 block text-sm font-medium text-surface-700">Técnico</label>
                            <select value={form.assigned_to} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => set('assigned_to', e.target.value)}
                                className="w-full rounded-lg border border-default bg-surface-50 px-3.5 py-2.5 text-sm focus:border-brand-400 focus:bg-surface-0 focus:outline-none focus:ring-2 focus:ring-brand-500/15">
                                <option value="">Sem atribuição</option>
                                {technicians.map((t: any) => <option key={t.id} value={t.id}>{t.name}</option>)}
                            </select>
                        </div>
                    </div>

                    <div>
                        <label className="mb-1.5 block text-sm font-medium text-surface-700">Defeito Relatado / Descrição *</label>
                        <textarea value={form.description} onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => set('description', e.target.value)}
                            rows={3} required placeholder="Descreva o problema..."
                            className="w-full rounded-lg border border-default bg-surface-50 px-3.5 py-2.5 text-sm focus:border-brand-400 focus:bg-surface-0 focus:outline-none focus:ring-2 focus:ring-brand-500/15" />
                    </div>

                    <div>
                        <label className="mb-1.5 block text-sm font-medium text-surface-700">Observações Internas</label>
                        <textarea value={form.internal_notes} onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => set('internal_notes', e.target.value)}
                            rows={2} placeholder="Notas internas..."
                            className="w-full rounded-lg border border-default bg-surface-50 px-3.5 py-2.5 text-sm focus:border-brand-400 focus:bg-surface-0 focus:outline-none focus:ring-2 focus:ring-brand-500/15" />
                    </div>
                </div>

                <div className="rounded-xl border border-default bg-surface-0 p-5 shadow-card space-y-4">
                    <h2 className="text-sm font-semibold text-surface-900 flex items-center gap-2"><Users className="h-4 w-4 text-brand-500" />Equipe e Origem</h2>
                    <div className="grid gap-4 sm:grid-cols-3">
                        <div>
                            <label className="mb-1.5 block text-sm font-medium text-surface-700">Nº OS (manual)</label>
                            <input value={form.os_number} onChange={(e: React.ChangeEvent<HTMLInputElement>) => set('os_number', e.target.value)} placeholder="Ex: 001234"
                                className="w-full rounded-lg border border-default bg-surface-50 px-3.5 py-2.5 text-sm focus:border-brand-400 focus:bg-surface-0 focus:outline-none focus:ring-2 focus:ring-brand-500/15" />
                        </div>
                        <div>
                            <label className="mb-1.5 block text-sm font-medium text-surface-700">Vendedor</label>
                            <select value={form.seller_id} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => set('seller_id', e.target.value)}
                                className="w-full rounded-lg border border-default bg-surface-50 px-3.5 py-2.5 text-sm focus:border-brand-400 focus:bg-surface-0 focus:outline-none focus:ring-2 focus:ring-brand-500/15">
                                <option value="">Nenhum</option>
                                {technicians.map((t: any) => <option key={t.id} value={t.id}>{t.name}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="mb-1.5 block text-sm font-medium text-surface-700 flex items-center gap-1"><Truck className="h-3.5 w-3.5" />Motorista (UMC)</label>
                            <select value={form.driver_id} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => set('driver_id', e.target.value)}
                                className="w-full rounded-lg border border-default bg-surface-50 px-3.5 py-2.5 text-sm focus:border-brand-400 focus:bg-surface-0 focus:outline-none focus:ring-2 focus:ring-brand-500/15">
                                <option value="">Nenhum</option>
                                {technicians.map((t: any) => <option key={t.id} value={t.id}>{t.name}</option>)}
                            </select>
                        </div>
                    </div>
                    <div>
                        <label className="mb-2 block text-sm font-medium text-surface-700">Técnicos (múltiplos)</label>
                        <div className="flex flex-wrap gap-2">
                            {technicians.map((t: any) => (
                                <button key={t.id} type="button" onClick={() => setSelectedTechIds(prev => prev.includes(t.id) ? prev.filter(id => id !== t.id) : [...prev, t.id])}
                                    className={cn('rounded-lg border px-3 py-1.5 text-xs font-medium transition-all',
                                        selectedTechIds.includes(t.id) ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-default text-surface-600 hover:border-surface-400')}>
                                    {t.name}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="rounded-xl border border-default bg-surface-0 p-5 shadow-card space-y-4">
                    <div className="flex items-center justify-between">
                        <h2 className="text-sm font-semibold text-surface-900">Equipamento</h2>
                        <Button variant="ghost" size="sm" type="button" onClick={() => setShowNewEquip(!showNewEquip)}>
                            {showNewEquip ? 'Cancelar' : '+ Novo Equipamento'}
                        </Button>
                    </div>
                    {showNewEquip && (
                        <div className="grid gap-3 sm:grid-cols-4">
                            <Input label="Tipo *" value={newEquip.type} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewEquip(p => ({ ...p, type: e.target.value }))} placeholder="Ex: Impressora" />
                            <Input label="Marca" value={newEquip.brand} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewEquip(p => ({ ...p, brand: e.target.value }))} />
                            <Input label="Modelo" value={newEquip.model} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewEquip(p => ({ ...p, model: e.target.value }))} />
                            <Input label="NÂº Série" value={newEquip.serial_number} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewEquip(p => ({ ...p, serial_number: e.target.value }))} />
                        </div>
                    )}
                </div>

                <div className="rounded-xl border border-default bg-surface-0 p-5 shadow-card space-y-4">
                    <div className="flex items-center justify-between">
                        <h2 className="text-sm font-semibold text-surface-900">Itens (Produtos & Serviços)</h2>
                        <Button variant="ghost" size="sm" type="button" onClick={addItem} icon={<Plus className="h-4 w-4" />}>
                            Adicionar
                        </Button>
                    </div>

                    {items.length === 0 ? (
                        <p className="py-6 text-center text-sm text-surface-400">Nenhum item adicionado</p>
                    ) : (
                        <div className="space-y-3">
                            {items.map((item, i) => (
                                <div key={i} className="rounded-lg border border-subtle p-2.5 space-y-3">
                                    <div className="flex items-center gap-2">
                                        <div className="flex rounded-lg border border-default overflow-hidden">
                                            <button type="button" onClick={() => updateItem(i, 'type', 'product')}
                                                className={cn('flex items-center gap-1 px-3 py-1.5 text-xs font-medium transition-colors',
                                                    item.type === 'product' ? 'bg-brand-50 text-brand-700' : 'text-surface-500 hover:bg-surface-50')}>
                                                <Package className="h-3 w-3" /> Produto
                                            </button>
                                            <button type="button" onClick={() => updateItem(i, 'type', 'service')}
                                                className={cn('flex items-center gap-1 px-3 py-1.5 text-xs font-medium transition-colors',
                                                    item.type === 'service' ? 'bg-emerald-50 text-emerald-700' : 'text-surface-500 hover:bg-surface-50')}>
                                                <Briefcase className="h-3 w-3" /> Serviço
                                            </button>
                                        </div>
                                        <div className="flex-1">
                                            <select value={item.reference_id} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => updateItem(i, 'reference_id', e.target.value)}
                                                className="w-full rounded-lg border border-default bg-surface-0 px-2.5 py-1.5 text-xs focus:border-brand-400 focus:bg-surface-0 focus:outline-none focus:ring-2 focus:ring-brand-500/15">
                                                <option value="">â€” Selecionar {item.type === 'product' ? 'produto' : 'serviço'} â€”</option>
                                                {(item.type === 'product' ? products : services).map((r: any) => (
                                                    <option key={r.id} value={r.id}>{r.name} â€” R$ {item.type === 'product' ? r.sell_price : r.default_price}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <Button variant="ghost" size="sm" type="button" onClick={() => { if (window.confirm('Deseja realmente excluir?')) removeItem(i) }}>
                                            <Trash2 className="h-4 w-4 text-red-500" />
                                        </Button>
                                    </div>
                                    {canViewPrices && item.reference_id && form.customer_id && (
                                        <PriceHistoryHint
                                            customerId={form.customer_id}
                                            type={item.type}
                                            referenceId={item.reference_id}
                                            onApplyPrice={(price) => updateItem(i, 'unit_price', String(price))}
                                        />
                                    )}
                                    <div className={`grid gap-3 ${canViewPrices ? 'sm:grid-cols-4' : 'sm:grid-cols-2'}`}>
                                        <Input label="Descrição" value={item.description} onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateItem(i, 'description', e.target.value)} />
                                        <Input label="Qtd" type="number" step="0.01" value={item.quantity} onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateItem(i, 'quantity', e.target.value)} />
                                        {canViewPrices && (
                                            <>
                                                <Input label="Preço Unitário" type="number" step="0.01" value={item.unit_price} onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateItem(i, 'unit_price', e.target.value)} />
                                                <div>
                                                    <Input label="Desconto" type="number" step="0.01" value={item.discount} onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateItem(i, 'discount', e.target.value)} />
                                                    <p className="mt-1 text-right text-xs font-medium text-surface-600">
                                                        Subtotal: {itemTotal(item).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                                    </p>
                                                </div>
                                            </>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {canViewPrices && (
                    <div className="border-t border-subtle pt-4 space-y-2">
                        <div className="flex items-center justify-between text-sm">
                            <span className="text-surface-600">Subtotal</span>
                            <span className="font-medium">{subtotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                        </div>
                        <div className="flex items-center justify-between gap-4 text-sm">
                            <span className="text-surface-600">Desconto Fixo (R$)</span>
                            <input type="number" step="0.01" value={form.discount} onChange={(e: React.ChangeEvent<HTMLInputElement>) => set('discount', e.target.value)}
                                disabled={parseFloat(form.discount_percentage) > 0}
                                className="w-28 rounded-lg border border-default px-2.5 py-1.5 text-right text-sm focus:border-brand-400 focus:bg-surface-0 focus:outline-none focus:ring-2 focus:ring-brand-500/15 disabled:opacity-50 disabled:cursor-not-allowed" />
                        </div>
                        <div className="flex items-center justify-between gap-4 text-sm">
                            <span className="text-surface-600">Desconto Global (%)</span>
                            <input type="number" step="0.01" min="0" max="100" value={form.discount_percentage} onChange={(e: React.ChangeEvent<HTMLInputElement>) => set('discount_percentage', e.target.value)}
                                disabled={parseFloat(form.discount) > 0}
                                className="w-28 rounded-lg border border-default px-2.5 py-1.5 text-right text-sm focus:border-brand-400 focus:bg-surface-0 focus:outline-none focus:ring-2 focus:ring-brand-500/15 disabled:opacity-50 disabled:cursor-not-allowed" />
                        </div>
                        {parseFloat(form.discount) > 0 && parseFloat(form.discount_percentage) > 0 && (
                            <p className="text-xs text-amber-600">âš  Apenas um tipo de desconto pode ser aplicado. O desconto percentual terá prioridade.</p>
                        )}
                        <div className="flex items-center justify-between gap-4 text-sm">
                            <span className="text-surface-600">Valor Deslocamento (R$)</span>
                            <input type="number" step="0.01" value={form.displacement_value} onChange={(e: React.ChangeEvent<HTMLInputElement>) => set('displacement_value', e.target.value)}
                                className="w-28 rounded-lg border border-default px-2.5 py-1.5 text-right text-sm focus:border-brand-400 focus:bg-surface-0 focus:outline-none focus:ring-2 focus:ring-brand-500/15" />
                        </div>
                        <div className="flex items-center justify-between text-base border-t border-subtle pt-2">
                            <span className="font-semibold text-surface-900">Total</span>
                            <span className="font-bold text-brand-600">{grandTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                        </div>
                    </div>
                    )}
                </div>

                <div className="flex items-center justify-end gap-3">
                    <Button variant="outline" type="button" onClick={() => navigate('/os')}>Cancelar</Button>
                    <Button type="submit" loading={saveMut.isPending} disabled={!form.customer_id || !form.description}>
                        Abrir OS
                    </Button>
                </div>
            </form>
        </div>
    )
}
