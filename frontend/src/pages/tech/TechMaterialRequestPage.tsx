import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
    Package, Search, Plus, Minus, Trash2, Send, Loader2, ArrowLeft,
    ShoppingCart, CheckCircle2, Clock, Truck,
} from 'lucide-react'
import { cn, getApiErrorMessage } from '@/lib/utils'
import api from '@/lib/api'
import { toast } from 'sonner'
import { useAuthStore } from '@/stores/auth-store'

interface MaterialRequest {
    id: number
    reference?: string
    description?: string
    items_count?: number
    status: string
    created_at: string
    work_order_id?: number
    work_order_number?: string
    requester_id?: number
}

interface Product {
    id: number
    name: string
    sku?: string
    unit?: string
}

interface SelectedItem {
    product_id: number
    product_name: string
    quantity: number
}

const STATUS_MAP: Record<string, { label: string; color: string; icon: typeof Clock }> = {
    pending: { label: 'Pendente', color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400', icon: Clock },
    approved: { label: 'Aprovada', color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400', icon: CheckCircle2 },
    in_separation: { label: 'Em Separação', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400', icon: Package },
    shipped: { label: 'Enviada', color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400', icon: Truck },
    delivered: { label: 'Entregue', color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400', icon: CheckCircle2 },
    rejected: { label: 'Rejeitada', color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400', icon: Trash2 },
}

export default function TechMaterialRequestPage() {
    const navigate = useNavigate()
    const { user } = useAuthStore()
    const [activeTab, setActiveTab] = useState<'list' | 'new'>('list')
    const [requests, setRequests] = useState<MaterialRequest[]>([])
    const [loading, setLoading] = useState(true)
    const [submitting, setSubmitting] = useState(false)
    const [workOrderNumber, setWorkOrderNumber] = useState('')
    const [productSearch, setProductSearch] = useState('')
    const [searchResults, setSearchResults] = useState<Product[]>([])
    const [searching, setSearching] = useState(false)
    const [selectedItems, setSelectedItems] = useState<SelectedItem[]>([])
    const [notes, setNotes] = useState('')

    useEffect(() => {
        if (activeTab === 'list') {
            fetchRequests()
        }
    }, [activeTab])

    useEffect(() => {
        if (productSearch.length >= 2) {
            const timeoutId = setTimeout(() => {
                searchProducts()
            }, 300)
            return () => clearTimeout(timeoutId)
        } else {
            setSearchResults([])
        }
    }, [productSearch])

    async function fetchRequests() {
        try {
            setLoading(true)
            const { data } = await api.get('/material-requests')
            const allRequests = data.data || []
            // Filter by current user if my parameter is needed
            const filtered = user?.id
                ? allRequests.filter((req: MaterialRequest) => req.requester_id === user.id)
                : allRequests
            setRequests(filtered)
        } catch (err: unknown) {
            toast.error(getApiErrorMessage(err, 'Erro ao carregar solicitações'))
        } finally {
            setLoading(false)
        }
    }

    async function searchProducts() {
        try {
            setSearching(true)
            const { data } = await api.get('/products', {
                params: {
                    search: productSearch,
                    per_page: 10,
                },
            })
            setSearchResults(data.data || [])
        } catch (err: unknown) {
            toast.error(getApiErrorMessage(err, 'Erro ao buscar produtos'))
        } finally {
            setSearching(false)
        }
    }

    const handleAddProduct = (product: Product) => {
        const existing = selectedItems.find((item) => item.product_id === product.id)
        if (existing) {
            setSelectedItems((prev) =>
                prev.map((item) =>
                    item.product_id === product.id
                        ? { ...item, quantity: item.quantity + 1 }
                        : item
                )
            )
        } else {
            setSelectedItems((prev) => [
                ...prev,
                {
                    product_id: product.id,
                    product_name: product.name,
                    quantity: 1,
                },
            ])
        }
        setProductSearch('')
        setSearchResults([])
    }

    const handleRemoveItem = (productId: number) => {
        setSelectedItems((prev) => prev.filter((item) => item.product_id !== productId))
    }

    const handleUpdateQuantity = (productId: number, delta: number) => {
        setSelectedItems((prev) =>
            prev.map((item) => {
                if (item.product_id === productId) {
                    const newQuantity = Math.max(0.01, item.quantity + delta)
                    return { ...item, quantity: newQuantity }
                }
                return item
            })
        )
    }

    const handleSubmit = async () => {
        if (selectedItems.length === 0) {
            toast.error('Adicione pelo menos um produto')
            return
        }

        try {
            setSubmitting(true)
            await api.post('/material-requests', {
                work_order_id: workOrderNumber ? parseInt(workOrderNumber) : undefined,
                items: selectedItems.map((item) => ({
                    product_id: item.product_id,
                    quantity_requested: item.quantity,
                })),
                justification: notes || undefined,
            })
            toast.success('Solicitação criada com sucesso')
            setActiveTab('list')
            setWorkOrderNumber('')
            setSelectedItems([])
            setNotes('')
            fetchRequests()
        } catch (err: unknown) {
            toast.error(getApiErrorMessage(err, 'Erro ao criar solicitação'))
        } finally {
            setSubmitting(false)
        }
    }

    return (
        <div className="flex flex-col h-full">
            {/* Header */}
            <div className="bg-white dark:bg-surface-900 px-4 pt-3 pb-4 border-b border-surface-200 dark:border-surface-700">
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => navigate(-1)}
                        className="p-1.5 -ml-1.5 rounded-lg hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors"
                    >
                        <ArrowLeft className="w-5 h-5 text-surface-600 dark:text-surface-400" />
                    </button>
                    <h1 className="text-lg font-bold text-surface-900 dark:text-surface-50">
                        Solicitação de Material
                    </h1>
                </div>

                {/* Tabs */}
                <div className="flex gap-2 mt-3">
                    <button
                        onClick={() => setActiveTab('list')}
                        className={cn(
                            'flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                            activeTab === 'list'
                                ? 'bg-brand-600 text-white'
                                : 'bg-surface-100 dark:bg-surface-800 text-surface-600 dark:text-surface-400'
                        )}
                    >
                        Minhas Solicitações
                    </button>
                    <button
                        onClick={() => setActiveTab('new')}
                        className={cn(
                            'flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                            activeTab === 'new'
                                ? 'bg-brand-600 text-white'
                                : 'bg-surface-100 dark:bg-surface-800 text-surface-600 dark:text-surface-400'
                        )}
                    >
                        Nova Solicitação
                    </button>
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
                {activeTab === 'list' ? (
                    <>
                        {loading ? (
                            <div className="flex flex-col items-center justify-center py-20 gap-3">
                                <Loader2 className="w-8 h-8 animate-spin text-brand-500" />
                                <p className="text-sm text-surface-500">Carregando solicitações...</p>
                            </div>
                        ) : requests.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-20 gap-3">
                                <ShoppingCart className="w-12 h-12 text-surface-300" />
                                <p className="text-sm text-surface-500">Nenhuma solicitação encontrada</p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {requests.map((request) => {
                                    const status = STATUS_MAP[request.status] || STATUS_MAP.pending
                                    const StatusIcon = status.icon

                                    return (
                                        <div
                                            key={request.id}
                                            className="bg-white dark:bg-surface-800/80 rounded-xl p-4 shadow-sm"
                                        >
                                            <div className="flex items-start justify-between gap-2">
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                                                        <span className="font-semibold text-sm text-surface-900 dark:text-surface-50">
                                                            {request.reference || `#${request.id}`}
                                                        </span>
                                                        <span
                                                            className={cn(
                                                                'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium',
                                                                status.color
                                                            )}
                                                        >
                                                            <StatusIcon className="w-3 h-3" />
                                                            {status.label}
                                                        </span>
                                                    </div>
                                                    {request.description && (
                                                        <p className="text-xs text-surface-500 dark:text-surface-400 line-clamp-2 mt-1">
                                                            {request.description}
                                                        </p>
                                                    )}
                                                    <div className="flex items-center gap-3 mt-2 text-[11px] text-surface-400 dark:text-surface-500">
                                                        <span className="flex items-center gap-1">
                                                            <Package className="w-3 h-3" />
                                                            {request.items_count || 0} item(ns)
                                                        </span>
                                                        {request.work_order_number && (
                                                            <span className="flex items-center gap-1">
                                                                OS: {request.work_order_number}
                                                            </span>
                                                        )}
                                                        <span className="flex items-center gap-1">
                                                            <Clock className="w-3 h-3" />
                                                            {new Date(request.created_at).toLocaleDateString('pt-BR')}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        )}
                    </>
                ) : (
                    <div className="space-y-4">
                        {/* Work Order */}
                        <div>
                            <label className="block text-xs font-medium text-surface-600 dark:text-surface-400 mb-1.5">
                                Ordem de Serviço (opcional)
                            </label>
                            <input
                                type="text"
                                value={workOrderNumber}
                                onChange={(e) => setWorkOrderNumber(e.target.value)}
                                placeholder="Número da OS"
                                className="w-full px-3 py-2.5 rounded-xl bg-surface-100 dark:bg-surface-800 border-0 text-sm placeholder:text-surface-400 focus:ring-2 focus:ring-brand-500/30 focus:outline-none"
                            />
                        </div>

                        {/* Product Search */}
                        <div>
                            <label className="block text-xs font-medium text-surface-600 dark:text-surface-400 mb-1.5">
                                Buscar Produtos
                            </label>
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400" />
                                <input
                                    type="text"
                                    value={productSearch}
                                    onChange={(e) => setProductSearch(e.target.value)}
                                    placeholder="Digite para buscar..."
                                    className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-surface-100 dark:bg-surface-800 border-0 text-sm placeholder:text-surface-400 focus:ring-2 focus:ring-brand-500/30 focus:outline-none"
                                />
                            </div>

                            {/* Search Results */}
                            {productSearch.length >= 2 && (
                                <div className="mt-2 space-y-1 max-h-48 overflow-y-auto">
                                    {searching ? (
                                        <div className="flex items-center justify-center py-4">
                                            <Loader2 className="w-5 h-5 animate-spin text-brand-500" />
                                        </div>
                                    ) : searchResults.length === 0 ? (
                                        <div className="text-center py-4 text-sm text-surface-400">
                                            Nenhum produto encontrado
                                        </div>
                                    ) : (
                                        searchResults.map((product) => (
                                            <button
                                                key={product.id}
                                                onClick={() => handleAddProduct(product)}
                                                className="w-full text-left px-3 py-2 rounded-lg bg-surface-50 dark:bg-surface-700/50 hover:bg-surface-100 dark:hover:bg-surface-700 transition-colors"
                                            >
                                                <div className="flex items-center justify-between">
                                                    <div>
                                                        <p className="text-sm font-medium text-surface-900 dark:text-surface-50">
                                                            {product.name}
                                                        </p>
                                                        {product.sku && (
                                                            <p className="text-xs text-surface-400">SKU: {product.sku}</p>
                                                        )}
                                                    </div>
                                                    <Plus className="w-4 h-4 text-brand-600" />
                                                </div>
                                            </button>
                                        ))
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Selected Items */}
                        {selectedItems.length > 0 && (
                            <div>
                                <label className="block text-xs font-medium text-surface-600 dark:text-surface-400 mb-1.5">
                                    Itens Selecionados
                                </label>
                                <div className="space-y-2">
                                    {selectedItems.map((item) => (
                                        <div
                                            key={item.product_id}
                                            className="bg-surface-50 dark:bg-surface-700/50 rounded-lg p-3 flex items-center justify-between"
                                        >
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-medium text-surface-900 dark:text-surface-50 truncate">
                                                    {item.product_name}
                                                </p>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <button
                                                    onClick={() => handleUpdateQuantity(item.product_id, -0.5)}
                                                    className="p-1 rounded-lg hover:bg-surface-200 dark:hover:bg-surface-600"
                                                >
                                                    <Minus className="w-4 h-4 text-surface-600 dark:text-surface-400" />
                                                </button>
                                                <input
                                                    type="number"
                                                    value={item.quantity}
                                                    onChange={(e) => {
                                                        const val = parseFloat(e.target.value) || 0.01
                                                        setSelectedItems((prev) =>
                                                            prev.map((i) =>
                                                                i.product_id === item.product_id
                                                                    ? { ...i, quantity: Math.max(0.01, val) }
                                                                    : i
                                                            )
                                                        )
                                                    }}
                                                    min="0.01"
                                                    step="0.01"
                                                    className="w-20 px-2 py-1 text-sm rounded-lg bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 text-center"
                                                />
                                                <button
                                                    onClick={() => handleUpdateQuantity(item.product_id, 0.5)}
                                                    className="p-1 rounded-lg hover:bg-surface-200 dark:hover:bg-surface-600"
                                                >
                                                    <Plus className="w-4 h-4 text-surface-600 dark:text-surface-400" />
                                                </button>
                                                <button
                                                    onClick={() => handleRemoveItem(item.product_id)}
                                                    className="p-1 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30 ml-1"
                                                >
                                                    <Trash2 className="w-4 h-4 text-red-600 dark:text-red-400" />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Notes */}
                        <div>
                            <label className="block text-xs font-medium text-surface-600 dark:text-surface-400 mb-1.5">
                                Observações
                            </label>
                            <textarea
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                                placeholder="Observações sobre a solicitação..."
                                rows={3}
                                className="w-full px-3 py-2.5 rounded-xl bg-surface-100 dark:bg-surface-800 border-0 text-sm placeholder:text-surface-400 focus:ring-2 focus:ring-brand-500/30 focus:outline-none resize-none"
                            />
                        </div>

                        {/* Submit Button */}
                        <button
                            onClick={handleSubmit}
                            disabled={submitting || selectedItems.length === 0}
                            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-brand-600 text-white rounded-xl text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {submitting ? (
                                <>
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                    Enviando...
                                </>
                            ) : (
                                <>
                                    <Send className="w-5 h-5" />
                                    Enviar Solicitação
                                </>
                            )}
                        </button>
                    </div>
                )}
            </div>
        </div>
    )
}
