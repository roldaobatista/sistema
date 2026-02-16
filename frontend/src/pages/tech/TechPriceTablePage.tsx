import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
    DollarSign, Search, Package, ShoppingBag, Loader2, ArrowLeft,
    Layers, BarChart, ChevronDown,
} from 'lucide-react'
import { cn, formatCurrency } from '@/lib/utils'
import api from '@/lib/api'
import { toast } from 'sonner'

interface PriceTable {
    id: number
    name: string
    is_default?: boolean
}

interface Service {
    id: number
    name: string
    category?: string
    sale_price?: number
    price?: number
    duration_minutes?: number
    description?: string
}

interface Product {
    id: number
    name: string
    sku?: string
    sale_price?: number
    price?: number
    stock_quantity?: number
    stock_status?: string
}

export default function TechPriceTablePage() {
    const navigate = useNavigate()
    const [tab, setTab] = useState<'servicos' | 'produtos'>('servicos')
    const [search, setSearch] = useState('')
    const [tables, setTables] = useState<PriceTable[]>([])
    const [selectedTableId, setSelectedTableId] = useState<number | null>(null)
    const [services, setServices] = useState<Service[]>([])
    const [products, setProducts] = useState<Product[]>([])
    const [loading, setLoading] = useState(false)
    const [expandedService, setExpandedService] = useState<number | null>(null)

    useEffect(() => {
        loadPriceTables()
    }, [])

    useEffect(() => {
        if (tab === 'servicos') loadServices()
        else loadProducts()
    }, [tab, selectedTableId])

    async function loadPriceTables() {
        try {
            const { data } = await api.get('/advanced/price-tables', { params: { per_page: 50 } })
            const list = data?.data ?? data ?? []
            const arr = Array.isArray(list) ? list : list?.data ?? []
            setTables(arr)
            const defaultT = arr.find((t: PriceTable) => t.is_default)
            if (defaultT) setSelectedTableId(defaultT.id)
            else if (arr.length) setSelectedTableId(arr[0].id)
        } catch {
            setTables([])
        }
    }

    async function loadServices() {
        setLoading(true)
        try {
            let items: Service[] = []
            if (selectedTableId) {
                const { data } = await api.get(`/advanced/price-tables/${selectedTableId}`)
                const pt = data?.data ?? data
                items = (pt?.items ?? []).filter((i: any) => i.priceable_type?.includes('Service') || i.priceable?.type === 'service')
                    .map((i: any) => ({
                        id: i.priceable?.id ?? i.id,
                        name: i.priceable?.name ?? i.name,
                        category: i.priceable?.category,
                        sale_price: i.price ?? i.priceable?.sale_price ?? i.priceable?.price,
                        price: i.price ?? i.priceable?.price ?? i.priceable?.sale_price,
                        duration_minutes: i.priceable?.duration_minutes,
                        description: i.priceable?.description,
                    }))
            }
            if (items.length === 0) {
                const { data } = await api.get('/services', { params: { per_page: 100 } })
                const list = data?.data ?? data ?? []
                setServices(Array.isArray(list) ? list : list?.data ?? [])
            } else {
                setServices(items)
            }
        } catch {
            toast.error('Erro ao carregar serviços')
            setServices([])
        } finally {
            setLoading(false)
        }
    }

    async function loadProducts() {
        setLoading(true)
        try {
            let items: Product[] = []
            if (selectedTableId) {
                const { data } = await api.get(`/advanced/price-tables/${selectedTableId}`)
                const pt = data?.data ?? data
                items = (pt?.items ?? []).filter((i: any) => i.priceable_type?.includes('Product') || i.priceable?.type === 'product')
                    .map((i: any) => ({
                        id: i.priceable?.id ?? i.id,
                        name: i.priceable?.name ?? i.name,
                        sku: i.priceable?.sku,
                        sale_price: i.price ?? i.priceable?.sale_price ?? i.priceable?.price,
                        price: i.price ?? i.priceable?.price ?? i.priceable?.sale_price,
                        stock_quantity: i.priceable?.stock_quantity,
                        stock_status: i.priceable?.stock_status,
                    }))
            }
            if (items.length === 0) {
                const { data } = await api.get('/products', { params: { per_page: 100 } })
                const list = data?.data ?? data ?? []
                setProducts(Array.isArray(list) ? list : list?.data ?? [])
            } else {
                setProducts(items)
            }
        } catch {
            toast.error('Erro ao carregar produtos')
            setProducts([])
        } finally {
            setLoading(false)
        }
    }

    const filteredServices = services.filter(
        (s) => !search.trim() || s.name.toLowerCase().includes(search.toLowerCase())
    )
    const filteredProducts = products.filter(
        (p) => !search.trim() || p.name.toLowerCase().includes(search.toLowerCase()) || (p.sku && p.sku.toLowerCase().includes(search.toLowerCase()))
    )

    const byCategory = filteredServices.reduce<Record<string, Service[]>>((acc, s) => {
        const cat = s.category || 'Outros'
        if (!acc[cat]) acc[cat] = []
        acc[cat].push(s)
        return acc
    }, {})

    function getStockBadge(p: Product) {
        const qty = p.stock_quantity ?? 0
        const status = p.stock_status || (qty > 10 ? 'in_stock' : qty > 0 ? 'low' : 'out_of_stock')
        const cls = status === 'in_stock' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
            : status === 'low' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
            : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
        const label = status === 'in_stock' ? 'Em estoque' : status === 'low' ? 'Baixo' : 'Sem estoque'
        return <span className={cn('px-1.5 py-0.5 rounded text-[10px] font-medium', cls)}>{label}</span>
    }

    return (
        <div className="flex flex-col h-full">
            <header className="bg-white dark:bg-surface-900 px-4 py-3 flex items-center gap-3 border-b border-surface-200 dark:border-surface-700">
                <button onClick={() => navigate('/tech')} className="p-1">
                    <ArrowLeft className="w-5 h-5 text-surface-600 dark:text-surface-300" />
                </button>
                <DollarSign className="w-5 h-5 text-brand-600 dark:text-brand-400" />
                <h1 className="text-lg font-bold text-surface-900 dark:text-surface-50">Tabela de Preços</h1>
            </header>

            <div className="flex border-b border-surface-200 dark:border-surface-700">
                <button
                    onClick={() => setTab('servicos')}
                    className={cn(
                        'flex-1 py-3 text-sm font-medium flex items-center justify-center gap-1',
                        tab === 'servicos'
                            ? 'text-brand-600 dark:text-brand-400 border-b-2 border-brand-500'
                            : 'text-surface-500 dark:text-surface-400'
                    )}
                >
                    <Layers className="w-4 h-4" /> Serviços
                </button>
                <button
                    onClick={() => setTab('produtos')}
                    className={cn(
                        'flex-1 py-3 text-sm font-medium flex items-center justify-center gap-1',
                        tab === 'produtos'
                            ? 'text-brand-600 dark:text-brand-400 border-b-2 border-brand-500'
                            : 'text-surface-500 dark:text-surface-400'
                    )}
                >
                    <Package className="w-4 h-4" /> Produtos
                </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400" />
                    <input
                        type="text"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Buscar..."
                        className="w-full pl-9 pr-4 py-2.5 rounded-lg bg-surface-100 dark:bg-surface-700 border-0 text-sm focus:ring-2 focus:ring-brand-500/30 focus:outline-none"
                    />
                </div>

                {tables.length > 1 && (
                    <div className="flex flex-wrap gap-2">
                        {tables.map((t) => (
                            <button
                                key={t.id}
                                onClick={() => setSelectedTableId(t.id)}
                                className={cn(
                                    'px-3 py-1.5 rounded-lg text-xs font-medium',
                                    selectedTableId === t.id
                                        ? 'bg-brand-100 text-brand-700 dark:bg-brand-900/30 dark:text-brand-400'
                                        : 'bg-surface-100 dark:bg-surface-700 text-surface-600 dark:text-surface-400'
                                )}
                            >
                                {t.name}
                            </button>
                        ))}
                    </div>
                )}

                {loading ? (
                    <div className="flex justify-center py-12">
                        <Loader2 className="w-8 h-8 animate-spin text-brand-500" />
                    </div>
                ) : tab === 'servicos' ? (
                    <div className="space-y-4">
                        {Object.keys(byCategory).sort().map((cat) => (
                            <div key={cat}>
                                <p className="text-xs font-semibold text-surface-500 dark:text-surface-400 uppercase mb-2">{cat}</p>
                                <div className="space-y-2">
                                    {byCategory[cat].map((s) => {
                                        const price = s.sale_price ?? s.price ?? 0
                                        const isExpanded = expandedService === s.id
                                        return (
                                            <div
                                                key={s.id}
                                                className="bg-white dark:bg-surface-800/80 rounded-xl p-4"
                                            >
                                                <button
                                                    onClick={() => setExpandedService(isExpanded ? null : s.id)}
                                                    className="w-full text-left flex items-center justify-between"
                                                >
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-sm font-medium text-surface-900 dark:text-surface-50">{s.name}</p>
                                                        <p className="text-xs text-brand-600 dark:text-brand-400 mt-0.5">
                                                            {formatCurrency(price)}
                                                        </p>
                                                    </div>
                                                    <ChevronDown className={cn('w-4 h-4 text-surface-400 flex-shrink-0 transition-transform', isExpanded && 'rotate-180')} />
                                                </button>
                                                {isExpanded && (s.description || s.duration_minutes) && (
                                                    <div className="mt-3 pt-3 border-t border-surface-100 dark:border-surface-700 text-xs text-surface-500">
                                                        {s.description && <p>{s.description}</p>}
                                                        {s.duration_minutes && (
                                                            <p className="mt-1">Duração estimada: {s.duration_minutes} min</p>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        )
                                    })}
                                </div>
                            </div>
                        ))}
                        {filteredServices.length === 0 && (
                            <div className="flex flex-col items-center justify-center py-16 gap-2">
                                <BarChart className="w-12 h-12 text-surface-300" />
                                <p className="text-sm text-surface-500">Nenhum serviço encontrado</p>
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="space-y-2">
                        {filteredProducts.map((p) => {
                            const price = p.sale_price ?? p.price ?? 0
                            return (
                                <div key={p.id} className="bg-white dark:bg-surface-800/80 rounded-xl p-4 flex items-center justify-between">
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium text-surface-900 dark:text-surface-50">{p.name}</p>
                                        <div className="flex items-center gap-2 mt-1">
                                            {p.sku && <span className="text-xs text-surface-500">SKU: {p.sku}</span>}
                                            {getStockBadge(p)}
                                        </div>
                                    </div>
                                    <p className="text-sm font-semibold text-brand-600 dark:text-brand-400 ml-2">
                                        {formatCurrency(price)}
                                    </p>
                                </div>
                            )
                        })}
                        {filteredProducts.length === 0 && (
                            <div className="flex flex-col items-center justify-center py-16 gap-2">
                                <ShoppingBag className="w-12 h-12 text-surface-300" />
                                <p className="text-sm text-surface-500">Nenhum produto encontrado</p>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    )
}
