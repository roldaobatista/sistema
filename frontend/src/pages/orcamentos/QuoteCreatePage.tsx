import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation } from '@tanstack/react-query'
import {
    ArrowLeft, ArrowRight, Plus, Trash2, Search, Package, Wrench, Save,
} from 'lucide-react'
import api from '@/lib/api'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'

type Step = 'customer' | 'equipments' | 'review'

interface EquipmentBlock {
    equipment_id: number; equipmentName: string; description: string
    items: ItemRow[]
}
interface ItemRow {
    type: 'product' | 'service'; product_id?: number; service_id?: number
    name: string; quantity: number; original_price: number; unit_price: number; discount_percentage: number
}

export function QuoteCreatePage() {
    const navigate = useNavigate()
    const [step, setStep] = useState<Step>('customer')
    const [customerId, setCustomerId] = useState<number | null>(null)
    const [customerSearch, setCustomerSearch] = useState('')
    const [validUntil, setValidUntil] = useState('')
    const [discountPercentage, setDiscountPercentage] = useState(0)
    const [observations, setObservations] = useState('')
    const [blocks, setBlocks] = useState<EquipmentBlock[]>([])

    // Lookups
    const { data: customersRes } = useQuery({
        queryKey: ['customers-search', customerSearch],
        queryFn: () => api.get('/customers', { params: { search: customerSearch, per_page: 10 } }),
        enabled: customerSearch.length > 1,
    })
    const customers = customersRes?.data?.data ?? []

    const { data: equipmentsRes } = useQuery({
        queryKey: ['equipments-for-customer', customerId],
        queryFn: () => api.get(`/customers/${customerId}`),
        enabled: !!customerId,
    })
    const customerEquipments = equipmentsRes?.data?.equipments ?? []

    const { data: productsRes } = useQuery({
        queryKey: ['products-all'],
        queryFn: () => api.get('/products', { params: { per_page: 200 } }),
    })
    const products = productsRes?.data?.data ?? []

    const { data: servicesRes } = useQuery({
        queryKey: ['services-all'],
        queryFn: () => api.get('/services', { params: { per_page: 200 } }),
    })
    const services = servicesRes?.data?.data ?? []

    const addBlock = (eqId: number, eqName: string) => {
        if (blocks.find(b => b.equipment_id === eqId)) return
        setBlocks(p => [...p, { equipment_id: eqId, equipmentName: eqName, description: '', items: [] }])
    }

    const removeBlock = (idx: number) => setBlocks(p => p.filter((_, i) => i !== idx))

    const updateBlock = (idx: number, field: string, value: any) =>
        setBlocks(p => p.map((b, i) => i === idx ? { ...b, [field]: value } : b))

    const addItem = (blockIdx: number, type: 'product' | 'service', id: number, name: string, price: number) => {
        setBlocks(p => p.map((b, i) => i === blockIdx ? {
            ...b, items: [...b.items, {
                type, ...(type === 'product' ? { product_id: id } : { service_id: id }),
                name, quantity: 1, original_price: price, unit_price: price, discount_percentage: 0,
            }]
        } : b))
    }

    const updateItem = (blockIdx: number, itemIdx: number, field: string, value: any) =>
        setBlocks(p => p.map((b, bi) => bi === blockIdx ? {
            ...b, items: b.items.map((it, ii) => ii === itemIdx ? { ...it, [field]: value } : it)
        } : b))

    const removeItem = (blockIdx: number, itemIdx: number) =>
        setBlocks(p => p.map((b, bi) => bi === blockIdx ? { ...b, items: b.items.filter((_, ii) => ii !== itemIdx) } : b))

    const subtotal = blocks.reduce((acc, b) => acc + b.items.reduce((a, it) => {
        const price = it.unit_price * (1 - it.discount_percentage / 100)
        return a + price * it.quantity
    }, 0), 0)
    const discountAmount = discountPercentage > 0 ? subtotal * (discountPercentage / 100) : 0
    const total = subtotal - discountAmount

    const saveMut = useMutation({
        mutationFn: () => api.post('/quotes', {
            customer_id: customerId,
            seller_id: 1, // TODO: current user
            valid_until: validUntil || null,
            discount_percentage: discountPercentage,
            observations,
            equipments: blocks.map(b => ({
                equipment_id: b.equipment_id,
                description: b.description,
                items: b.items.map(it => ({
                    type: it.type, product_id: it.product_id, service_id: it.service_id,
                    quantity: it.quantity, original_price: it.original_price,
                    unit_price: it.unit_price, discount_percentage: it.discount_percentage,
                })),
            })),
        }),
        onSuccess: () => navigate('/orcamentos'),
    })

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-3">
                <button onClick={() => navigate('/orcamentos')} className="rounded-lg p-1.5 text-surface-500 hover:bg-surface-100">
                    <ArrowLeft className="h-5 w-5" />
                </button>
                <div>
                    <h1 className="text-2xl font-bold text-surface-900">Novo Orçamento</h1>
                    <p className="text-sm text-surface-500">Preencha as informações do orçamento</p>
                </div>
            </div>

            {/* Steps indicator */}
            <div className="flex gap-2">
                {(['customer', 'equipments', 'review'] as const).map((s, i) => (
                    <button key={s} onClick={() => setStep(s)}
                        className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all ${step === s ? 'bg-brand-500 text-white shadow' : 'bg-surface-100 text-surface-600 hover:bg-surface-200'}`}>
                        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white/20 text-xs font-bold">{i + 1}</span>
                        {s === 'customer' ? 'Cliente' : s === 'equipments' ? 'Equipamentos e Itens' : 'Revisão'}
                    </button>
                ))}
            </div>

            {/* Step 1: Customer */}
            {step === 'customer' && (
                <div className="rounded-xl border border-surface-200 bg-white p-6 shadow-card space-y-4">
                    <h3 className="text-lg font-semibold text-surface-900">Selecionar Cliente</h3>
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-surface-400" />
                        <input value={customerSearch} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCustomerSearch(e.target.value)}
                            placeholder="Pesquisar cliente por nome, CPF/CNPJ..."
                            className="w-full rounded-lg border border-surface-300 bg-white py-2.5 pl-10 pr-3 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20" />
                    </div>
                    {customers.length > 0 && (
                        <div className="space-y-2">
                            {customers.map((c: any) => (
                                <button key={c.id} onClick={() => { setCustomerId(c.id); setCustomerSearch(c.name) }}
                                    className={`w-full rounded-lg border p-3 text-left transition-all ${customerId === c.id ? 'border-brand-500 bg-brand-50 ring-2 ring-brand-500/20' : 'border-surface-200 hover:border-surface-300'}`}>
                                    <p className="font-medium text-surface-900">{c.name}</p>
                                    <p className="text-xs text-surface-500">{c.document} • {c.email}</p>
                                </button>
                            ))}
                        </div>
                    )}
                    <div className="grid grid-cols-2 gap-4">
                        <Input label="Validade" type="date" value={validUntil} onChange={(e: any) => setValidUntil(e.target.value)} />
                        <Input label="Observações" value={observations} onChange={(e: any) => setObservations(e.target.value)} />
                    </div>
                    <div className="flex justify-end">
                        <Button icon={<ArrowRight className="h-4 w-4" />} onClick={() => setStep('equipments')} disabled={!customerId}>Próximo</Button>
                    </div>
                </div>
            )}

            {/* Step 2: Equipments + Items */}
            {step === 'equipments' && (
                <div className="space-y-4">
                    {/* Equipment selector */}
                    <div className="rounded-xl border border-surface-200 bg-white p-5 shadow-card">
                        <h3 className="mb-3 text-lg font-semibold text-surface-900">Equipamentos do Cliente</h3>
                        <div className="flex flex-wrap gap-2">
                            {customerEquipments.length === 0 ? (
                                <p className="text-sm text-surface-500">Nenhum equipamento cadastrado para este cliente</p>
                            ) : customerEquipments.map((eq: any) => (
                                <button key={eq.id} onClick={() => addBlock(eq.id, eq.name || `${eq.brand} ${eq.model}`)}
                                    className={`rounded-lg border px-3 py-2 text-sm transition-all ${blocks.find(b => b.equipment_id === eq.id) ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-surface-200 hover:border-brand-300'}`}>
                                    {eq.name || `${eq.brand} ${eq.model}`} {eq.serial_number && `(${eq.serial_number})`}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Blocks per equipment */}
                    {blocks.map((block, bi) => (
                        <div key={bi} className="rounded-xl border border-surface-200 bg-white shadow-card overflow-hidden">
                            <div className="flex items-center justify-between border-b border-surface-200 bg-surface-50 px-5 py-3">
                                <h4 className="font-semibold text-surface-900">{block.equipmentName}</h4>
                                <button onClick={() => removeBlock(bi)} className="text-red-500 hover:text-red-700"><Trash2 className="h-4 w-4" /></button>
                            </div>
                            <div className="p-5 space-y-4">
                                <textarea value={block.description} onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => updateBlock(bi, 'description', e.target.value)}
                                    placeholder="Descrição do que será feito neste equipamento..."
                                    className="w-full rounded-lg border border-surface-300 bg-white px-3.5 py-2 text-sm focus:border-brand-500 focus:outline-none resize-none" rows={2} />

                                {/* Add item buttons */}
                                <div className="flex gap-2">
                                    <select onChange={(e: React.ChangeEvent<HTMLSelectElement>) => { const p = products.find((pr: any) => pr.id === +e.target.value); if (p) addItem(bi, 'product', p.id, p.name, +p.price); e.target.value = '' }}
                                        className="rounded-lg border border-surface-300 bg-white px-3 py-2 text-sm">
                                        <option value="">+ Produto</option>
                                        {products.map((p: any) => <option key={p.id} value={p.id}>{p.name} — R$ {Number(p.price).toFixed(2)}</option>)}
                                    </select>
                                    <select onChange={(e: React.ChangeEvent<HTMLSelectElement>) => { const s = services.find((sv: any) => sv.id === +e.target.value); if (s) addItem(bi, 'service', s.id, s.name, +s.price); e.target.value = '' }}
                                        className="rounded-lg border border-surface-300 bg-white px-3 py-2 text-sm">
                                        <option value="">+ Serviço</option>
                                        {services.map((s: any) => <option key={s.id} value={s.id}>{s.name} — R$ {Number(s.price).toFixed(2)}</option>)}
                                    </select>
                                </div>

                                {/* Items table */}
                                {block.items.length > 0 && (
                                    <table className="w-full text-sm">
                                        <thead>
                                            <tr className="border-b text-left text-xs text-surface-500">
                                                <th className="pb-2">Tipo</th><th className="pb-2">Item</th><th className="pb-2 w-20">Qtd</th>
                                                <th className="pb-2 w-28">Preço Unit.</th><th className="pb-2 w-20">Desc %</th>
                                                <th className="pb-2 w-28 text-right">Subtotal</th><th className="pb-2 w-8"></th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-surface-100">
                                            {block.items.map((it, ii) => {
                                                const price = it.unit_price * (1 - it.discount_percentage / 100)
                                                const sub = price * it.quantity
                                                return (
                                                    <tr key={ii}>
                                                        <td className="py-2">
                                                            {it.type === 'product' ? <Package className="h-4 w-4 text-blue-500" /> : <Wrench className="h-4 w-4 text-emerald-500" />}
                                                        </td>
                                                        <td className="py-2 font-medium">{it.name}</td>
                                                        <td className="py-2"><input type="number" value={it.quantity} min={0.01} step={0.01} onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateItem(bi, ii, 'quantity', +e.target.value)}
                                                            className="w-full rounded border border-surface-300 px-2 py-1 text-sm" /></td>
                                                        <td className="py-2"><input type="number" value={it.unit_price} min={0} step={0.01} onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateItem(bi, ii, 'unit_price', +e.target.value)}
                                                            className="w-full rounded border border-surface-300 px-2 py-1 text-sm" /></td>
                                                        <td className="py-2"><input type="number" value={it.discount_percentage} min={0} max={100} onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateItem(bi, ii, 'discount_percentage', +e.target.value)}
                                                            className="w-full rounded border border-surface-300 px-2 py-1 text-sm" /></td>
                                                        <td className="py-2 text-right font-semibold">{sub.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                                                        <td className="py-2"><button onClick={() => removeItem(bi, ii)} className="text-red-400 hover:text-red-600"><Trash2 className="h-3.5 w-3.5" /></button></td>
                                                    </tr>
                                                )
                                            })}
                                        </tbody>
                                    </table>
                                )}
                            </div>
                        </div>
                    ))}

                    <div className="flex justify-between">
                        <Button variant="outline" onClick={() => setStep('customer')}>Voltar</Button>
                        <Button icon={<ArrowRight className="h-4 w-4" />} onClick={() => setStep('review')} disabled={blocks.length === 0}>Revisão</Button>
                    </div>
                </div>
            )}

            {/* Step 3: Review */}
            {step === 'review' && (
                <div className="space-y-4">
                    <div className="rounded-xl border border-surface-200 bg-white p-6 shadow-card space-y-4">
                        <h3 className="text-lg font-semibold text-surface-900">Resumo do Orçamento</h3>
                        <div className="grid grid-cols-2 gap-4 text-sm">
                            <div><span className="text-surface-500">Cliente:</span> <span className="font-medium">{customerSearch}</span></div>
                            <div><span className="text-surface-500">Validade:</span> <span className="font-medium">{validUntil || 'Não definida'}</span></div>
                            <div><span className="text-surface-500">Equipamentos:</span> <span className="font-medium">{blocks.length}</span></div>
                            <div><span className="text-surface-500">Total de itens:</span> <span className="font-medium">{blocks.reduce((a, b) => a + b.items.length, 0)}</span></div>
                        </div>

                        {/* Discount */}
                        <div className="flex items-center gap-4 border-t border-surface-200 pt-4">
                            <label className="text-sm text-surface-600">Desconto global (%)</label>
                            <input type="number" value={discountPercentage} min={0} max={100} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDiscountPercentage(+e.target.value)}
                                className="w-24 rounded-lg border border-surface-300 px-3 py-1.5 text-sm" />
                        </div>

                        {/* Totals */}
                        <div className="rounded-lg bg-surface-50 p-4 space-y-2">
                            <div className="flex justify-between text-sm"><span className="text-surface-500">Subtotal</span>
                                <span className="font-medium">{subtotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span></div>
                            {discountAmount > 0 && (
                                <div className="flex justify-between text-sm"><span className="text-red-500">Desconto ({discountPercentage}%)</span>
                                    <span className="font-medium text-red-500">-{discountAmount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span></div>
                            )}
                            <div className="flex justify-between border-t border-surface-200 pt-2 text-lg font-bold">
                                <span>Total</span>
                                <span className="text-brand-700">{total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                            </div>
                        </div>
                    </div>

                    <div className="flex justify-between">
                        <Button variant="outline" onClick={() => setStep('equipments')}>Voltar</Button>
                        <Button icon={<Save className="h-4 w-4" />} onClick={() => saveMut.mutate()} loading={saveMut.isPending}>Salvar Orçamento</Button>
                    </div>
                </div>
            )}
        </div>
    )
}
