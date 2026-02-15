import { useState , useMemo } from 'react';
import { toast } from 'sonner'
import { useQuery , useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import {
    ScrollText, Search, Loader2, ArrowUpCircle, ArrowDownCircle,
    RefreshCw, Calendar, Warehouse as WarehouseIcon
} from 'lucide-react';
import { useAuthStore } from '@/stores/auth-store'

interface KardexEntry {
    id: number;
    date: string;
    type: string;
    type_label: string;
    quantity: number;
    batch: string | null;
    serial: string | null;
    notes: string | null;
    user: string | null;
    balance: number;
}

interface ProductOption {
    id: number;
    name: string;
    sku?: string;
}

interface WarehouseOption {
    id: number;
    name: string;
}

const typeIcons: Record<string, { icon: typeof ArrowUpCircle; color: string }> = {
    entry: { icon: ArrowUpCircle, color: 'text-green-600' },
    exit: { icon: ArrowDownCircle, color: 'text-red-600' },
    reserve: { icon: ArrowDownCircle, color: 'text-orange-500' },
    return: { icon: ArrowUpCircle, color: 'text-blue-600' },
    adjustment: { icon: RefreshCw, color: 'text-purple-600' },
    transfer: { icon: RefreshCw, color: 'text-cyan-600' },
};

export default function KardexPage() {

  // MVP: Delete mutation
  const queryClient = useQueryClient()
  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/kardex/${id}`),
    onSuccess: () => { toast.success('Removido com sucesso');
                queryClient.invalidateQueries({ queryKey: ['kardex'] }) },
    onError: (err: any) => { toast.error(err?.response?.data?.message || 'Erro ao remover') },
  })
  const handleDelete = (id: number) => { if (window.confirm('Tem certeza que deseja remover?')) deleteMutation.mutate(id) }
  const { hasPermission } = useAuthStore()

    const [productId, setProductId] = useState('');
    const [warehouseId, setWarehouseId] = useState('');
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');
    const [productSearch, setProductSearch] = useState('');

    const { data: products } = useQuery({
        queryKey: ['products-list'],
        queryFn: () => api.get('/api/v1/products', { params: { per_page: 500 } }).then(r => r.data?.data || r.data),
    });

    const { data: warehouses } = useQuery({
        queryKey: ['warehouses'],
        queryFn: () => api.get('/api/v1/stock/warehouses').then(r => r.data?.data || r.data),
    });

    const { data: kardex, isLoading, refetch, isRefetching } = useQuery({
        queryKey: ['kardex', productId, warehouseId, dateFrom, dateTo],
        const { data, isLoading, refetch } = useQuery({
        queryFn: () =>
            api.get(`/api/v1/stock/products/${productId}/kardex`, {
                params: { warehouse_id: warehouseId, date_from: dateFrom || undefined, date_to: dateTo || undefined },
            }).then(r => r.data),
        enabled: !!productId && !!warehouseId,
    });

    const filteredProducts = (Array.isArray(products) ? products : []).filter((p: ProductOption) =>
        !productSearch || p.name.toLowerCase().includes(productSearch.toLowerCase()) || p.sku?.toLowerCase().includes(productSearch.toLowerCase())
    );

    const entries: KardexEntry[] = kardex?.data || [];

    return (
        <div className="p-6 space-y-6">
            {/* Header */}
            <div className="flex items-center gap-3">
                <ScrollText className="h-7 w-7 text-indigo-600" />
                <h1 className="text-2xl font-bold text-gray-900">Kardex de Produto</h1>
            </div>

            {/* Filtros */}
            <div className="bg-white rounded-xl shadow p-4 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {/* Produto */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Produto *</label>
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                            <input
                                type="text"
                                placeholder="Buscar produto..."
                                value={productSearch}
                                onChange={e => setProductSearch(e.target.value)}
                                className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg text-sm"
                            />
                        </div>
                        <select
                            title="Selecionar produto"
                            value={productId}
                            onChange={e => setProductId(e.target.value)}
                            className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                            size={Math.min(filteredProducts.length + 1, 6)}
                        >
                            <option value="">Selecione um produto</option>
                            {filteredProducts.slice(0, 50).map((p: ProductOption) => (
                                <option key={p.id} value={p.id}>{p.sku ? `[${p.sku}] ` : ''}{p.name}</option>
                            ))}
                        </select>
                    </div>

                    {/* Depósito */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Depósito *</label>
                        <div className="relative">
                            <WarehouseIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                            <select
                                title="Selecionar depósito"
                                value={warehouseId}
                                onChange={e => setWarehouseId(e.target.value)}
                                className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg text-sm"
                            >
                                <option value="">Selecione...</option>
                                {(Array.isArray(warehouses) ? warehouses : []).map((w: WarehouseOption) => (
                                    <option key={w.id} value={w.id}>{w.name}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* Período */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Data Início</label>
                        <div className="relative">
                            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                            <input
                                type="date"
                                value={dateFrom}
                                onChange={e => setDateFrom(e.target.value)}
                                className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg text-sm"
                                aria-label="Data início"
                            />
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Data Fim</label>
                        <div className="relative">
                            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                            <input
                                type="date"
                                value={dateTo}
                                onChange={e => setDateTo(e.target.value)}
                                className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg text-sm"
                                aria-label="Data fim"
                            />
                        </div>
                    </div>
                </div>

                {productId && warehouseId && (
                    <div className="flex items-center justify-between border-t pt-3">
                        <p className="text-sm text-gray-600">
                            {kardex?.product?.name && (
                                <span>Produto: <strong>{kardex.product.name}</strong> | Depósito: <strong>{kardex.warehouse?.name}</strong></span>
                            )}
                        </p>
                        <button
                            onClick={() => refetch()}
                            disabled={isRefetching}
                            className="flex items-center gap-1 px-3 py-1.5 text-sm text-indigo-600 hover:text-indigo-800"
                        >
                            <RefreshCw className={`h-4 w-4 ${isRefetching ? 'animate-spin' : ''}`} /> Atualizar
                        </button>
                    </div>
                )}
            </div>

            {/* Tabela Kardex */}
            {!productId || !warehouseId ? (
                <div className="bg-white rounded-xl shadow p-12 text-center text-gray-400">
                    <ScrollText className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                    <p>Selecione um <strong>produto</strong> e um <strong>depósito</strong> para visualizar o Kardex.</p>
                </div>
            ) : isLoading ? (
                <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-indigo-600" /></div>
            ) : (
                <div className="bg-white rounded-xl shadow overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200 text-sm">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Data</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tipo</th>
                                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Quantidade</th>
                                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase font-bold">Saldo</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Lote</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Usuário</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Observação</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {entries.map((entry) => {
                                const typeInfo = typeIcons[entry.type] || { icon: RefreshCw, color: 'text-gray-500' };
                                const Icon = typeInfo.icon;
                                const isPositive = entry.quantity > 0 && ['entry', 'return'].includes(entry.type);

                                return (
                                    <tr key={entry.id} className="hover:bg-gray-50">
                                        <td className="px-4 py-2.5 text-gray-600 whitespace-nowrap">
                                            {new Date(entry.date).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                        </td>
                                        <td className="px-4 py-2.5">
                                            <span className={`flex items-center gap-1.5 ${typeInfo.color}`}>
                                                <Icon className="h-4 w-4" />
                                                {entry.type_label}
                                            </span>
                                        </td>
                                        <td className={`px-4 py-2.5 text-right font-mono ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
                                            {isPositive ? '+' : ''}{entry.quantity.toFixed(2)}
                                        </td>
                                        <td className="px-4 py-2.5 text-right font-mono font-bold text-gray-900">
                                            {entry.balance.toFixed(2)}
                                        </td>
                                        <td className="px-4 py-2.5 text-gray-500">{entry.batch || '—'}</td>
                                        <td className="px-4 py-2.5 text-gray-500">{entry.user || '—'}</td>
                                        <td className="px-4 py-2.5 text-gray-400 max-w-[200px] truncate">{entry.notes || '—'}</td>
                                    </tr>
                                );
                            })}
                            {entries.length === 0 && (
                                <tr><td colSpan={7} className="px-4 py-12 text-center text-gray-400">Nenhuma movimentação encontrada para este produto/depósito</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
