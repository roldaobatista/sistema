import React, { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { broadcastQueryInvalidation } from '@/lib/cross-tab-sync'
import {
    ArrowLeft, ArrowRight, Plus, Trash2, Search, Package, Wrench, Save, Scale,
} from 'lucide-react'
import api from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useAuthStore } from '@/stores/auth-store'
import PriceHistoryHint from '@/components/common/PriceHistoryHint'
import QuickEquipmentModal from '@/components/common/QuickEquipmentModal'
import QuickProductServiceModal from '@/components/common/QuickProductServiceModal'

// Strings constant for easy localization in the future
const STRINGS = {
    newQuote: 'Novo Orçamento',
    fillInfo: 'Preencha as informações do orçamento',
    stepCustomer: 'Cliente',
    stepEquipments: 'Equipamentos e Itens',
    stepReview: 'Revisão',
    selectCustomer: 'Selecionar Cliente',
    searchPlaceholder: 'Pesquisar cliente por nome, CPF/CNPJ...',
    validity: 'Validade',
    observations: 'Observações',
    next: 'Próximo',
    back: 'Voltar',
    customerEquipments: 'Equipamentos do Cliente',
    noEquipments: 'Nenhum equipamento cadastrado para este cliente',
    descriptionPlaceholder: 'Descrição do que será feito neste equipamento...',
    addProduct: '+ Produto',
    addService: '+ Serviço',
    type: 'Tipo',
    item: 'Item',
    quantity: 'Qtd',
    unitPrice: 'Preço Unit.',
    discount: 'Desc %',
    subtotal: 'Subtotal',
    summary: 'Resumo do Orçamento',
    totalItems: 'Total de itens',
    globalDiscount: 'Desconto global (%)',
    total: 'Total',
    saveQuote: 'Salvar Orçamento',
    saving: 'Salvando...',
    errorSaving: 'Erro ao salvar orçamento. Verifique os dados e tente novamente.',
}

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
    const { hasPermission } = useAuthStore()
    const [searchParams] = useSearchParams()
    const customerIdFromUrl = searchParams.get('customer_id')

    const navigate = useNavigate()
    const [step, setStep] = useState<Step>('customer')
    const [customerId, setCustomerId] = useState<number | null>(customerIdFromUrl ? Number(customerIdFromUrl) : null)
    const [customerSearch, setCustomerSearch] = useState('')
    const [validUntil, setValidUntil] = useState('')
    const [discountPercentage, setDiscountPercentage] = useState(0)
    const [displacementValue, setDisplacementValue] = useState(0)
    const [observations, setObservations] = useState('')
    const [internalNotes, setInternalNotes] = useState('')
    const [source, setSource] = useState<string>('')
    const [sellerId, setSellerId] = useState<number | null>(null)
    const [paymentTerms, setPaymentTerms] = useState<string>('')
    const [paymentTermsDetail, setPaymentTermsDetail] = useState('')
    const [blocks, setBlocks] = useState<EquipmentBlock[]>([])
    const [errorMsg, setErrorMsg] = useState<string | null>(null)
    const [showQuickEquipmentModal, setShowQuickEquipmentModal] = useState(false)
    const [showQuickProductService, setShowQuickProductService] = useState(false)
    const [quickPSTab, setQuickPSTab] = useState<'product' | 'service'>('product')

    const { data: preselectedCustomer } = useQuery({
        queryKey: ['customer', customerIdFromUrl],
        queryFn: () => api.get(`/customers/${customerIdFromUrl}`).then((r) => r.data),
        enabled: !!customerIdFromUrl,
    })

    // Fetch default validity days from settings
    const { data: settingsRes } = useQuery({
        queryKey: ['settings'],
        queryFn: () => api.get('/settings', { params: { group: 'quotes' } }),
    })

    useEffect(() => {
        if (preselectedCustomer?.name) {
            setCustomerSearch(preselectedCustomer.name)
        }
    }, [preselectedCustomer])

    // Auto-populate valid_until from setting
    useEffect(() => {
        if (validUntil) return // don't override if user already set it
        const settings = settingsRes?.data ?? []
        const daysSetting = settings.find((s: any) => s.key === 'quote_default_validity_days')
        const days = daysSetting ? parseInt(daysSetting.value) : 30
        if (days > 0) {
            const date = new Date()
            date.setDate(date.getDate() + days)
            setValidUntil(date.toISOString().slice(0, 10))
        }
    }, [settingsRes]) // eslint-disable-line react-hooks/exhaustive-deps

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

    const { data: usersRes } = useQuery({
        queryKey: ['users-sellers'],
        queryFn: () => api.get('/users', { params: { per_page: 200 } }),
    })
    const sellers = usersRes?.data?.data ?? (Array.isArray(usersRes?.data) ? usersRes.data : [])

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
    const total = subtotal - discountAmount + displacementValue

    const qc = useQueryClient()

    const saveMut = useMutation({
        mutationFn: () => {
            setErrorMsg(null)
            return api.post('/quotes', {
                customer_id: customerId,
                seller_id: sellerId || undefined,
                source: source || null,
                valid_until: validUntil || null,
                discount_percentage: discountPercentage,
                displacement_value: displacementValue,
                observations: observations || null,
                internal_notes: internalNotes || null,
                payment_terms: paymentTerms || null,
                payment_terms_detail: paymentTermsDetail || null,
                equipments: blocks.map(b => ({
                    equipment_id: b.equipment_id,
                    description: b.description,
                    items: b.items.map(it => ({
                        type: it.type, product_id: it.product_id, service_id: it.service_id,
                        quantity: it.quantity, original_price: it.original_price,
                        unit_price: it.unit_price, discount_percentage: it.discount_percentage,
                    })),
                })),
            })
        },
        onSuccess: () => {
            toast.success('Orçamento criado com sucesso!')
            qc.invalidateQueries({ queryKey: ['quotes'] })
            qc.invalidateQueries({ queryKey: ['quotes-summary'] })
            broadcastQueryInvalidation(['quotes', 'quotes-summary', 'dashboard'], 'Orçamento')
            navigate('/orcamentos')
        },
        onError: (err: any) => {
            const msg = err?.response?.data?.message || STRINGS.errorSaving
            setErrorMsg(msg)
            toast.error(msg)
        },
    })

    const handleNext = () => {
        if (step === 'customer') {
            if (!customerId) {
                toast.error('Selecione um cliente antes de continuar')
                return
            }
            setStep('equipments')
        } else if (step === 'equipments') {
            if (blocks.length === 0) {
                toast.error('Adicione pelo menos um equipamento')
                return
            }
            const hasEmptyBlock = blocks.some(b => b.items.length === 0)
            if (hasEmptyBlock) {
                toast.error('Todos os equipamentos devem ter pelo menos um item')
                return
            }
            setStep('review')
        }
    }

    const handleBack = () => {
        setStep(step === 'review' ? 'equipments' : 'customer')
    }

    const formatCurrency = (v: number) =>
        v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

    return (
        <div className="max-w-4xl mx-auto pb-20 space-y-6">
            {/* Header */}
            <div className="flex items-center gap-3">
                <button onClick={() => navigate('/orcamentos')} className="rounded-lg p-1.5 hover:bg-surface-100">
                    <ArrowLeft className="h-5 w-5 text-surface-500" />
                </button>
                <div>
                    <h1 className="text-lg font-semibold text-surface-900 tracking-tight">{STRINGS.newQuote}</h1>
                    <p className="text-[13px] text-surface-500">{STRINGS.fillInfo}</p>
                </div>
            </div>

            {/* Steps Indicator */}
            <div className="flex items-center justify-center gap-4 mb-8">
                {(['customer', 'equipments', 'review'] as Step[]).map((s, idx) => {
                    const stepNames = [STRINGS.stepCustomer, STRINGS.stepEquipments, STRINGS.stepReview]
                    const currentIdx = ['customer', 'equipments', 'review'].indexOf(step)
                    const isActive = idx <= currentIdx
                    return (
                        <React.Fragment key={s}>
                            <div className={`flex items-center gap-2 ${isActive ? 'text-brand-600' : 'text-surface-400'}`}>
                                <div className={`h-8 w-8 rounded-full flex items-center justify-center text-sm font-bold border ${isActive ? 'bg-brand-100 border-brand-500' : 'bg-surface-50 border-surface-300'}`}>
                                    {idx + 1}
                                </div>
                                <span className="text-sm font-medium hidden sm:block">{stepNames[idx]}</span>
                            </div>
                            {idx < 2 && <div className="w-12 h-px bg-surface-200" />}
                        </React.Fragment>
                    )
                })}
            </div>

            <div className="bg-surface-0 border border-default rounded-xl p-6 shadow-card">

                {/* Step 1: Customer */}
                {step === 'customer' && (
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-surface-700 mb-1">{STRINGS.selectCustomer}</label>
                            <Input
                                placeholder={STRINGS.searchPlaceholder}
                                value={customerSearch}
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCustomerSearch(e.target.value)}
                            />
                            {customers.length > 0 && (
                                <div className="mt-2 border border-default rounded-lg max-h-40 overflow-y-auto">
                                    {customers.map((c: any) => (
                                        <button key={c.id} type="button"
                                            onClick={() => { setCustomerId(c.id); setCustomerSearch(c.name) }}
                                            className={`w-full text-left px-3 py-2 text-sm hover:bg-surface-50 ${customerId === c.id ? 'bg-brand-50 text-brand-700' : 'text-surface-700'}`}>
                                            {c.name} {c.document && <span className="text-surface-400">— {c.document}</span>}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-surface-700 mb-1">{STRINGS.validity}</label>
                            <input type="date" value={validUntil} onChange={e => setValidUntil(e.target.value)}
                                className="w-full rounded-lg border border-default bg-surface-50 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-surface-700 mb-1">{STRINGS.observations}</label>
                            <textarea value={observations} onChange={e => setObservations(e.target.value)} rows={3}
                                className="w-full rounded-lg border border-default bg-surface-50 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-surface-700 mb-1">Vendedor</label>
                            <select value={sellerId ?? ''} onChange={e => setSellerId(e.target.value ? Number(e.target.value) : null)}
                                className="w-full rounded-lg border border-default bg-surface-50 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none">
                                <option value="">Usuário atual (padrão)</option>
                                {sellers.map((u: { id: number; name: string }) => (
                                    <option key={u.id} value={u.id}>{u.name}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-surface-700 mb-1">Origem Comercial</label>
                            <select value={source} onChange={e => setSource(e.target.value)}
                                className="w-full rounded-lg border border-default bg-surface-50 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none">
                                <option value="">Selecione (opcional)</option>
                                <option value="prospeccao">Prospecção</option>
                                <option value="retorno">Retorno</option>
                                <option value="contato_direto">Contato Direto</option>
                                <option value="indicacao">Indicação</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-surface-700 mb-1">Notas Internas</label>
                            <textarea value={internalNotes} onChange={e => setInternalNotes(e.target.value)} rows={2}
                                placeholder="Notas visíveis apenas internamente..."
                                className="w-full rounded-lg border border-default bg-surface-50 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-surface-700 mb-1">Condições de Pagamento</label>
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
                            <div>
                                <label className="block text-sm font-medium text-surface-700 mb-1">Detalhes do Pagamento</label>
                                <input value={paymentTermsDetail} onChange={e => setPaymentTermsDetail(e.target.value)}
                                    placeholder="Detalhes adicionais sobre forma de pagamento..."
                                    className="w-full rounded-lg border border-default bg-surface-50 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none" />
                            </div>
                        )}
                        <div className="flex justify-end pt-4">
                            <Button onClick={handleNext} disabled={!customerId} icon={<ArrowRight className="h-4 w-4" />}>
                                {STRINGS.next}
                            </Button>
                        </div>
                    </div>
                )}

                {/* Step 2: Equipments & Items */}
                {step === 'equipments' && (
                    <div className="space-y-6">
                        <div className="flex items-center justify-between mb-2">
                            <h3 className="text-sm font-semibold text-surface-900">{STRINGS.customerEquipments}</h3>
                            <button
                                type="button"
                                onClick={() => setShowQuickEquipmentModal(true)}
                                className="flex items-center gap-1.5 rounded-lg border border-brand-200 bg-brand-50 px-3 py-1.5 text-xs font-medium text-brand-700 hover:bg-brand-100 hover:border-brand-300 transition-all"
                            >
                                <Plus className="h-3.5 w-3.5" />
                                Cadastrar Equipamento
                            </button>
                        </div>
                        {customerEquipments.length === 0 ? (
                            <p className="text-sm text-surface-400 italic">{STRINGS.noEquipments}</p>
                        ) : (
                            <div className="flex flex-wrap gap-2">
                                {customerEquipments.map((eq: any) => (
                                    <button key={eq.id} type="button"
                                        onClick={() => addBlock(eq.id, eq.brand ? `${eq.brand} ${eq.model}` : eq.model ?? `Equip #${eq.id}`)}
                                        className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-all ${blocks.find(b => b.equipment_id === eq.id)
                                            ? 'border-brand-500 bg-brand-50 text-brand-700'
                                            : 'border-surface-200 text-surface-600 hover:border-surface-300'}`}>
                                        <Plus className="inline h-3 w-3 mr-1" />
                                        {eq.brand ? `${eq.brand} ${eq.model}` : eq.model ?? `Equip #${eq.id}`}
                                    </button>
                                ))}
                            </div>
                        )}

                        {blocks.map((block, bIdx) => (
                            <div key={block.equipment_id} className="rounded-xl border border-default p-4 space-y-3">
                                <div className="flex items-center justify-between">
                                    <h4 className="text-sm font-semibold text-surface-800">{block.equipmentName}</h4>
                                    <button onClick={() => removeBlock(bIdx)} className="text-red-400 hover:text-red-600">
                                        <Trash2 className="h-4 w-4" />
                                    </button>
                                </div>
                                <textarea value={block.description}
                                    onChange={e => updateBlock(bIdx, 'description', e.target.value)}
                                    placeholder={STRINGS.descriptionPlaceholder} rows={2}
                                    className="w-full rounded-lg border border-default bg-surface-50 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none" />

                                {/* Items */}
                                {block.items.map((it, iIdx) => (
                                    <div key={iIdx} className="space-y-1">
                                        <div className="flex items-center gap-2 rounded-lg bg-surface-50 p-2 text-sm">
                                            <span className="w-16 text-xs text-surface-500">{it.type === 'product' ? 'Produto' : 'Serviço'}</span>
                                            <span className="flex-1 font-medium text-surface-800">{it.name}</span>
                                            <input type="number" min={1} value={it.quantity}
                                                onChange={e => updateItem(bIdx, iIdx, 'quantity', Number(e.target.value))}
                                                className="w-16 rounded border border-default bg-surface-0 px-2 py-1 text-center text-sm" />
                                            <input type="number" step="0.01" value={it.unit_price}
                                                onChange={e => updateItem(bIdx, iIdx, 'unit_price', Number(e.target.value))}
                                                className="w-24 rounded border border-default bg-surface-0 px-2 py-1 text-right text-sm" />
                                            <input type="number" step="0.01" min={0} max={100} value={it.discount_percentage}
                                                onChange={e => updateItem(bIdx, iIdx, 'discount_percentage', Number(e.target.value))}
                                                className="w-20 rounded border border-default bg-surface-0 px-2 py-1 text-right text-sm" />
                                            <span className="w-24 text-right font-medium text-surface-900">
                                                {formatCurrency(it.quantity * it.unit_price * (1 - it.discount_percentage / 100))}
                                            </span>
                                            <button onClick={() => removeItem(bIdx, iIdx)} className="text-surface-400 hover:text-red-500">
                                                <Trash2 className="h-3.5 w-3.5" />
                                            </button>
                                        </div>
                                        {customerId && (it.product_id || it.service_id) && (
                                            <PriceHistoryHint
                                                customerId={customerId}
                                                type={it.type}
                                                referenceId={it.product_id || it.service_id}
                                                onApplyPrice={(price) => updateItem(bIdx, iIdx, 'unit_price', price)}
                                            />
                                        )}
                                    </div>
                                ))}

                                {/* Add item buttons */}
                                <div className="flex gap-2 flex-wrap">
                                    <div className="flex gap-1 items-center">
                                        <select onChange={e => {
                                            const p = products.find((pr: any) => pr.id === Number(e.target.value))
                                            if (p) addItem(bIdx, 'product', p.id, p.name, p.sell_price ?? 0)
                                            e.target.value = ''
                                        }} className="rounded-lg border border-default bg-surface-50 px-2 py-1.5 text-xs">
                                            <option value="">{STRINGS.addProduct}</option>
                                            {products.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
                                        </select>
                                        <button
                                            type="button"
                                            onClick={() => { setQuickPSTab('product'); setShowQuickProductService(true) }}
                                            title="Cadastrar novo produto"
                                            className="flex items-center justify-center rounded-lg border border-dashed border-brand-300 bg-brand-50 h-[30px] w-[30px] text-brand-600 hover:bg-brand-100 hover:border-brand-400 transition-colors"
                                        >
                                            <Plus className="h-3.5 w-3.5" />
                                        </button>
                                    </div>
                                    <div className="flex gap-1 items-center">
                                        <select onChange={e => {
                                            const s = services.find((sv: any) => sv.id === Number(e.target.value))
                                            if (s) addItem(bIdx, 'service', s.id, s.name, s.default_price ?? 0)
                                            e.target.value = ''
                                        }} className="rounded-lg border border-default bg-surface-50 px-2 py-1.5 text-xs">
                                            <option value="">{STRINGS.addService}</option>
                                            {services.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
                                        </select>
                                        <button
                                            type="button"
                                            onClick={() => { setQuickPSTab('service'); setShowQuickProductService(true) }}
                                            title="Cadastrar novo serviço"
                                            className="flex items-center justify-center rounded-lg border border-dashed border-emerald-300 bg-emerald-50 h-[30px] w-[30px] text-emerald-600 hover:bg-emerald-100 hover:border-emerald-400 transition-colors"
                                        >
                                            <Plus className="h-3.5 w-3.5" />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}

                        <div className="flex justify-between pt-4">
                            <Button variant="outline" onClick={handleBack} icon={<ArrowLeft className="h-4 w-4" />}>
                                {STRINGS.back}
                            </Button>
                            <Button onClick={handleNext} icon={<ArrowRight className="h-4 w-4" />}>
                                {STRINGS.next}
                            </Button>
                        </div>

                        {customerId && (
                            <QuickEquipmentModal
                                open={showQuickEquipmentModal}
                                onOpenChange={setShowQuickEquipmentModal}
                                customerId={customerId}
                                customerName={customerSearch}
                            />
                        )}

                        <QuickProductServiceModal
                            open={showQuickProductService}
                            onOpenChange={setShowQuickProductService}
                            defaultTab={quickPSTab}
                        />
                    </div>
                )}

                {/* Step 3: Review */}
                {step === 'review' && (
                    <div className="space-y-6">
                        <h3 className="text-sm font-semibold text-surface-900">{STRINGS.summary}</h3>

                        {blocks.map(block => (
                            <div key={block.equipment_id} className="rounded-lg border border-surface-100 p-3">
                                <p className="text-sm font-medium text-surface-800 mb-1">{block.equipmentName}</p>
                                {block.description && <p className="text-xs text-surface-500 mb-2">{block.description}</p>}
                                {block.items.map((it, i) => (
                                    <div key={i} className="flex justify-between text-sm py-1">
                                        <span className="text-surface-700">{it.name} × {it.quantity}</span>
                                        <span className="font-medium text-surface-900">
                                            {formatCurrency(it.quantity * it.unit_price * (1 - it.discount_percentage / 100))}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        ))}

                        <div className="space-y-2 border-t border-subtle pt-4">
                            <div className="flex justify-between text-sm">
                                <span className="text-surface-600">{STRINGS.totalItems}</span>
                                <span>{blocks.reduce((a, b) => a + b.items.length, 0)}</span>
                            </div>
                            <div className="flex items-center justify-between text-sm">
                                <span className="text-surface-600">{STRINGS.globalDiscount}</span>
                                <input type="number" min={0} max={100} step="0.01" value={discountPercentage}
                                    onChange={e => setDiscountPercentage(Number(e.target.value))}
                                    className="w-20 rounded border border-default bg-surface-50 px-2 py-1 text-right text-sm" />
                            </div>
                            <div className="flex items-center justify-between text-sm">
                                <span className="text-surface-600">Deslocamento (R$)</span>
                                <input type="number" min={0} step="0.01" value={displacementValue}
                                    onChange={e => setDisplacementValue(Number(e.target.value))}
                                    className="w-28 rounded border border-default bg-surface-50 px-2 py-1 text-right text-sm" />
                            </div>
                            <div className="flex justify-between text-base font-bold pt-2">
                                <span className="text-surface-900">{STRINGS.total}</span>
                                <span className="text-brand-600">{formatCurrency(total)}</span>
                            </div>
                        </div>

                        {errorMsg && <p className="text-sm text-red-600">{errorMsg}</p>}

                        <div className="flex justify-between pt-4">
                            <Button variant="outline" onClick={handleBack} icon={<ArrowLeft className="h-4 w-4" />}>
                                {STRINGS.back}
                            </Button>
                            <Button icon={<Save className="h-4 w-4" />}
                                onClick={() => { if (!saveMut.isPending) saveMut.mutate() }}
                                loading={saveMut.isPending}>
                                {saveMut.isPending ? STRINGS.saving : STRINGS.saveQuote}
                            </Button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}

