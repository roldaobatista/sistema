import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
    Search, Plus, Trash2, Send, Save, User, Loader2, ArrowLeft,
    ShoppingCart, Calculator, CheckCircle2,
} from 'lucide-react'
import { cn, getApiErrorMessage } from '@/lib/utils'
import api from '@/lib/api'
import { toast } from 'sonner'

const formatCurrency = (val: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val)

interface Customer {
    id: number
    name: string
    phone?: string
    email?: string
}

interface Service {
    id: number
    name: string
    price?: number
}

interface Product {
    id: number
    name: string
    price?: number
}

interface QuoteItem {
    type: 'service' | 'product'
    id: number
    name: string
    quantity: number
    unit_price: number
    service_id?: number
    product_id?: number
}

export default function TechQuickQuotePage() {
    const navigate = useNavigate()
    const [customerSearch, setCustomerSearch] = useState('')
    const [customer, setCustomer] = useState<Customer | null>(null)
    const [customers, setCustomers] = useState<Customer[]>([])
    const [customerEquipments, setCustomerEquipments] = useState<{ id: number; name: string }[]>([])
    const [searchingCustomers, setSearchingCustomers] = useState(false)
    const [items, setItems] = useState<QuoteItem[]>([])
    const [notes, setNotes] = useState('')
    const [discountPercent, setDiscountPercent] = useState('')
    const [saving, setSaving] = useState(false)
    const [sending, setSending] = useState(false)
    const [savedQuoteId, setSavedQuoteId] = useState<number | null>(null)
    const [savedQuoteNumber, setSavedQuoteNumber] = useState<string | null>(null)

    const [showServiceSearch, setShowServiceSearch] = useState(false)
    const [showProductSearch, setShowProductSearch] = useState(false)
    const [serviceSearch, setServiceSearch] = useState('')
    const [productSearch, setProductSearch] = useState('')
    const [services, setServices] = useState<Service[]>([])
    const [products, setProducts] = useState<Product[]>([])

    useEffect(() => {
        if (!customerSearch || customerSearch.length < 2) {
            setCustomers([])
            return
        }
        const t = setTimeout(() => {
            setSearchingCustomers(true)
            api.get('/customers', { params: { search: customerSearch, per_page: 10 } })
                .then((res) => setCustomers(res.data?.data ?? res.data ?? []))
                .catch(() => toast.error('Erro ao buscar clientes'))
                .finally(() => setSearchingCustomers(false))
        }, 300)
        return () => clearTimeout(t)
    }, [customerSearch])

    useEffect(() => {
        if (!customer?.id) {
            setCustomerEquipments([])
            return
        }
        api.get('/equipments', { params: { customer_id: customer.id, per_page: 100 } })
            .then((res) => {
                const list = res.data?.data ?? res.data ?? []
                const arr = Array.isArray(list) ? list : []
                setCustomerEquipments(arr.map((e: { id: number; name?: string; tag?: string; brand?: string; model?: string }) => ({
                    id: e.id,
                    name: e.name ?? e.tag ?? ([e.brand, e.model].filter(Boolean).join(' ') || `Equipamento #${e.id}`),
                })))
            })
            .catch(() => setCustomerEquipments([]))
    }, [customer?.id])

    useEffect(() => {
        if (!serviceSearch || serviceSearch.length < 2) {
            setServices([])
            return
        }
        const t = setTimeout(() => {
            api.get('/services', { params: { search: serviceSearch, per_page: 10 } })
                .then((res) => setServices(res.data?.data ?? res.data ?? []))
                .catch(() => setServices([]))
        }, 300)
        return () => clearTimeout(t)
    }, [serviceSearch])

    useEffect(() => {
        if (!productSearch || productSearch.length < 2) {
            setProducts([])
            return
        }
        const t = setTimeout(() => {
            api.get('/products', { params: { search: productSearch, per_page: 10 } })
                .then((res) => setProducts(res.data?.data ?? res.data ?? []))
                .catch(() => setProducts([]))
        }, 300)
        return () => clearTimeout(t)
    }, [productSearch])

    const addService = (s: Service) => {
        setItems((prev) => [...prev, {
            type: 'service',
            id: s.id,
            name: s.name,
            quantity: 1,
            unit_price: s.price ?? 0,
            service_id: s.id,
        }])
        setShowServiceSearch(false)
        setServiceSearch('')
    }

    const addProduct = (p: Product) => {
        setItems((prev) => [...prev, {
            type: 'product',
            id: p.id,
            name: p.name,
            quantity: 1,
            unit_price: p.price ?? 0,
            product_id: p.id,
        }])
        setShowProductSearch(false)
        setProductSearch('')
    }

    const updateItem = (idx: number, field: 'quantity' | 'unit_price', value: number) => {
        setItems((prev) => prev.map((it, i) => i === idx ? { ...it, [field]: value } : it))
    }

    const removeItem = (idx: number) => {
        setItems((prev) => prev.filter((_, i) => i !== idx))
    }

    const subtotal = useMemo(() =>
        items.reduce((sum, it) => sum + it.quantity * it.unit_price, 0), [items])
    const discount = parseFloat(discountPercent) || 0
    const discountAmount = subtotal * (discount / 100)
    const total = subtotal - discountAmount

    const firstEquipment = customerEquipments[0]
    const canSave = customer && items.length > 0 && firstEquipment

    const buildPayload = () => {
        const discountPct = parseFloat(discountPercent) || 0
        return {
            customer_id: customer!.id,
            discount_percentage: discountPct,
            observations: notes || undefined,
            equipments: [{
                equipment_id: firstEquipment!.id,
                description: 'Orçamento rápido',
                items: items.map((it) => ({
                    type: it.type,
                    product_id: it.type === 'product' ? it.product_id : undefined,
                    service_id: it.type === 'service' ? it.service_id : undefined,
                    quantity: it.quantity,
                    original_price: it.unit_price,
                    unit_price: it.unit_price,
                    discount_percentage: 0,
                })),
            }],
        }
    }

    const handleSaveDraft = async () => {
        if (!canSave) {
            toast.error('Selecione um cliente com equipamento e adicione itens')
            return
        }
        setSaving(true)
        try {
            const { data } = await api.post('/quotes', buildPayload())
            const quote = data?.data ?? data
            setSavedQuoteId(quote.id)
            setSavedQuoteNumber(quote.quote_number ?? `#${quote.id}`)
            toast.success('Orçamento salvo!')
        } catch (err: unknown) {
            toast.error(getApiErrorMessage(err, 'Erro ao salvar orçamento'))
        } finally {
            setSaving(false)
        }
    }

    const handleSend = async () => {
        if (!canSave) {
            toast.error('Selecione um cliente com equipamento e adicione itens')
            return
        }
        setSending(true)
        try {
            let quoteId = savedQuoteId
            if (!quoteId) {
                const { data } = await api.post('/quotes', buildPayload())
                const quote = data?.data ?? data
                quoteId = quote.id
                setSavedQuoteId(quoteId)
                setSavedQuoteNumber(quote.quote_number ?? `#${quoteId}`)
            }
            await api.post(`/quotes/${quoteId}/internal-approve`)
            await api.post(`/quotes/${quoteId}/send`)
            toast.success('Orçamento enviado ao cliente!')
        } catch (err: unknown) {
            const msg = getApiErrorMessage(err, 'Erro ao enviar orçamento')
            if (msg.includes('aprovado') || msg.includes('internamente')) {
                toast.error('Orçamento precisa ser aprovado internamente antes de enviar')
            } else {
                toast.error(msg)
            }
        } finally {
            setSending(false)
        }
    }

    if (savedQuoteId && savedQuoteNumber) {
        return (
            <div className="flex flex-col h-full">
                <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col items-center justify-center gap-4">
                    <CheckCircle2 className="w-16 h-16 text-emerald-500" />
                    <div className="text-center">
                        <h2 className="text-xl font-bold text-surface-900 dark:text-surface-50">Orçamento salvo!</h2>
                        <p className="text-sm text-surface-500 mt-1">Nº {savedQuoteNumber}</p>
                    </div>
                    <div className="flex gap-2">
                        <button
                            onClick={() => navigate('/tech')}
                            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-brand-600 text-white font-medium"
                        >
                            <ArrowLeft className="w-4 h-4" />
                            Voltar
                        </button>
                        <button
                            onClick={() => { setSavedQuoteId(null); setSavedQuoteNumber(null) }}
                            className="px-4 py-2.5 rounded-xl bg-surface-200 dark:bg-surface-700 text-surface-700 dark:text-surface-300 font-medium"
                        >
                            Novo orçamento
                        </button>
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div className="flex flex-col h-full">
            <div className="bg-white dark:bg-surface-900 px-4 pt-3 pb-4 border-b border-surface-200 dark:border-surface-700">
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => navigate('/tech')}
                        className="p-1.5 -ml-1.5 rounded-lg hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors"
                    >
                        <ArrowLeft className="w-5 h-5 text-surface-600 dark:text-surface-400" />
                    </button>
                    <h1 className="text-lg font-bold text-surface-900 dark:text-surface-50">Orçamento Rápido</h1>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
                <div className="bg-white dark:bg-surface-800/80 rounded-xl p-4">
                    <label className="flex items-center gap-2 text-sm font-medium text-surface-700 dark:text-surface-300 mb-2">
                        <Search className="w-4 h-4" />
                        Buscar cliente
                    </label>
                    <input
                        type="text"
                        value={customer ? '' : customerSearch}
                        onChange={(e) => { setCustomerSearch(e.target.value); setCustomer(null) }}
                        onFocus={() => customer && setCustomer(null)}
                        placeholder="Digite nome, CPF/CNPJ..."
                        className="w-full px-3 py-2.5 rounded-lg bg-surface-100 dark:bg-surface-700 border-0 text-sm focus:ring-2 focus:ring-brand-500/30 focus:outline-none"
                    />
                    {searchingCustomers && (
                        <div className="flex items-center gap-2 mt-2 text-xs text-surface-500">
                            <Loader2 className="w-3 h-3 animate-spin" /> Buscando...
                        </div>
                    )}
                    {!customer && customers.length > 0 && (
                        <ul className="mt-2 space-y-1 max-h-40 overflow-y-auto">
                            {customers.map((c) => (
                                <li key={c.id}>
                                    <button
                                        type="button"
                                        onClick={() => { setCustomer(c); setCustomerSearch(''); setCustomers([]) }}
                                        className="w-full text-left px-3 py-2 rounded-lg hover:bg-surface-100 dark:hover:bg-surface-700 text-sm"
                                    >
                                        {c.name}
                                    </button>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>

                {customer && (
                    <div className="bg-white dark:bg-surface-800/80 rounded-xl p-4">
                        <div className="flex items-center gap-2 mb-2">
                            <User className="w-4 h-4 text-brand-500" />
                            <span className="font-semibold text-surface-900 dark:text-surface-50">{customer.name}</span>
                        </div>
                        {customer.phone && <p className="text-xs text-surface-500">{customer.phone}</p>}
                        {customer.email && <p className="text-xs text-surface-500">{customer.email}</p>}
                        {customerEquipments.length === 0 && (
                            <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                                Cliente precisa ter pelo menos um equipamento cadastrado
                            </p>
                        )}
                        <button
                            type="button"
                            onClick={() => setCustomer(null)}
                            className="text-xs text-brand-600 dark:text-brand-400 mt-2"
                        >
                            Trocar cliente
                        </button>
                    </div>
                )}

                <div className="bg-white dark:bg-surface-800/80 rounded-xl p-4">
                    <div className="flex items-center justify-between mb-3">
                        <span className="text-sm font-medium text-surface-700 dark:text-surface-300 flex items-center gap-2">
                            <ShoppingCart className="w-4 h-4" />
                            Itens
                        </span>
                        <div className="flex gap-2">
                            <button
                                type="button"
                                onClick={() => setShowServiceSearch(true)}
                                className="flex items-center gap-1 px-2 py-1.5 rounded-lg bg-brand-600 text-white text-xs font-medium"
                            >
                                <Plus className="w-3.5 h-3.5" /> Serviço
                            </button>
                            <button
                                type="button"
                                onClick={() => setShowProductSearch(true)}
                                className="flex items-center gap-1 px-2 py-1.5 rounded-lg bg-surface-200 dark:bg-surface-700 text-surface-700 dark:text-surface-300 text-xs font-medium"
                            >
                                <Plus className="w-3.5 h-3.5" /> Produto
                            </button>
                        </div>
                    </div>

                    {showServiceSearch && (
                        <div className="mb-3 p-2 rounded-lg bg-surface-50 dark:bg-surface-800">
                            <input
                                type="text"
                                value={serviceSearch}
                                onChange={(e) => setServiceSearch(e.target.value)}
                                placeholder="Buscar serviço..."
                                className="w-full px-3 py-2 rounded-lg bg-surface-100 dark:bg-surface-700 border-0 text-sm mb-2"
                                autoFocus
                            />
                            <ul className="max-h-32 overflow-y-auto space-y-1">
                                {services.map((s) => (
                                    <li key={s.id}>
                                        <button
                                            type="button"
                                            onClick={() => addService(s)}
                                            className="w-full text-left px-2 py-1.5 rounded text-sm hover:bg-surface-100 dark:hover:bg-surface-700"
                                        >
                                            {s.name} {s.price != null && `- ${formatCurrency(s.price)}`}
                                        </button>
                                    </li>
                                ))}
                            </ul>
                            <button
                                type="button"
                                onClick={() => { setShowServiceSearch(false); setServiceSearch('') }}
                                className="text-xs text-surface-500 mt-1"
                            >
                                Fechar
                            </button>
                        </div>
                    )}

                    {showProductSearch && (
                        <div className="mb-3 p-2 rounded-lg bg-surface-50 dark:bg-surface-800">
                            <input
                                type="text"
                                value={productSearch}
                                onChange={(e) => setProductSearch(e.target.value)}
                                placeholder="Buscar produto..."
                                className="w-full px-3 py-2 rounded-lg bg-surface-100 dark:bg-surface-700 border-0 text-sm mb-2"
                                autoFocus
                            />
                            <ul className="max-h-32 overflow-y-auto space-y-1">
                                {products.map((p) => (
                                    <li key={p.id}>
                                        <button
                                            type="button"
                                            onClick={() => addProduct(p)}
                                            className="w-full text-left px-2 py-1.5 rounded text-sm hover:bg-surface-100 dark:hover:bg-surface-700"
                                        >
                                            {p.name} {p.price != null && `- ${formatCurrency(p.price)}`}
                                        </button>
                                    </li>
                                ))}
                            </ul>
                            <button
                                type="button"
                                onClick={() => { setShowProductSearch(false); setProductSearch('') }}
                                className="text-xs text-surface-500 mt-1"
                            >
                                Fechar
                            </button>
                        </div>
                    )}

                    {items.length === 0 ? (
                        <p className="text-sm text-surface-500 py-4 text-center">Nenhum item adicionado</p>
                    ) : (
                        <ul className="space-y-2">
                            {items.map((it, idx) => (
                                <li
                                    key={`${it.type}-${it.id}-${idx}`}
                                    className="flex items-center gap-2 p-2 rounded-lg bg-surface-50 dark:bg-surface-800"
                                >
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium truncate">{it.name}</p>
                                        <div className="flex items-center gap-2 mt-1">
                                            <input
                                                type="number"
                                                min={0.01}
                                                step={0.01}
                                                value={it.quantity}
                                                onChange={(e) => updateItem(idx, 'quantity', parseFloat(e.target.value) || 1)}
                                                className="w-14 px-2 py-1 rounded bg-surface-100 dark:bg-surface-700 text-xs"
                                            />
                                            <input
                                                type="number"
                                                min={0}
                                                step={0.01}
                                                value={it.unit_price}
                                                onChange={(e) => updateItem(idx, 'unit_price', parseFloat(e.target.value) || 0)}
                                                className="w-20 px-2 py-1 rounded bg-surface-100 dark:bg-surface-700 text-xs"
                                            />
                                            <span className="text-xs font-medium">
                                                {formatCurrency(it.quantity * it.unit_price)}
                                            </span>
                                        </div>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => removeItem(idx)}
                                        className="p-1.5 rounded-full text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
                                        aria-label="Remover"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>

                <div className="bg-white dark:bg-surface-800/80 rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-3">
                        <Calculator className="w-4 h-4 text-brand-500" />
                        <span className="text-sm font-medium text-surface-700 dark:text-surface-300">Totais</span>
                    </div>
                    <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                            <span className="text-surface-500">Subtotal</span>
                            <span>{formatCurrency(subtotal)}</span>
                        </div>
                        <div className="flex justify-between items-center gap-2">
                            <span className="text-surface-500">Desconto (%)</span>
                            <input
                                type="number"
                                min={0}
                                max={100}
                                step={0.5}
                                value={discountPercent}
                                onChange={(e) => setDiscountPercent(e.target.value)}
                                placeholder="0"
                                className="w-16 px-2 py-1 rounded bg-surface-100 dark:bg-surface-700 text-sm text-right"
                            />
                        </div>
                        {discount > 0 && (
                            <div className="flex justify-between text-surface-500">
                                <span>Valor desconto</span>
                                <span>-{formatCurrency(discountAmount)}</span>
                            </div>
                        )}
                        <div className="flex justify-between font-bold text-base pt-2 border-t border-surface-200 dark:border-surface-700">
                            <span>Total</span>
                            <span>{formatCurrency(total)}</span>
                        </div>
                    </div>
                </div>

                <div>
                    <label className="text-sm font-medium text-surface-700 dark:text-surface-300 mb-2 block">Observações</label>
                    <textarea
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        placeholder="Notas do orçamento..."
                        rows={2}
                        className="w-full px-3 py-2.5 rounded-lg bg-surface-100 dark:bg-surface-700 border-0 text-sm focus:ring-2 focus:ring-brand-500/30 focus:outline-none resize-none"
                    />
                </div>

                <div className="flex gap-2">
                    <button
                        onClick={handleSaveDraft}
                        disabled={saving || !canSave}
                        className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-surface-200 dark:bg-surface-700 text-surface-700 dark:text-surface-300 font-semibold disabled:opacity-50"
                    >
                        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                        Salvar Rascunho
                    </button>
                    <button
                        onClick={handleSend}
                        disabled={sending || !canSave}
                        className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-brand-600 text-white font-semibold disabled:opacity-50"
                    >
                        {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                        Enviar ao Cliente
                    </button>
                </div>
            </div>
        </div>
    )
}
