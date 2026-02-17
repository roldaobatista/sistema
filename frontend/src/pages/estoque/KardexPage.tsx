import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import {
    ScrollText, Search, Loader2, ArrowUpCircle, ArrowDownCircle,
    RefreshCw, Calendar, Warehouse as WarehouseIcon, Download
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
  const { hasPermission } = useAuthStore()
    const [productId, setProductId] = useState('');
    const [warehouseId, setWarehouseId] = useState('');
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');
    const [productSearch, setProductSearch] = useState('');

    const { data: products } = useQuery({
        queryKey: ['products-list'],
        queryFn: () => api.get('/products', { params: { per_page: 500 } }).then(r => r.data?.data || r.data),
    });

    const { data: warehouses } = useQuery({
        queryKey: ['warehouses'],
        queryFn: () => api.get('/stock/warehouses').then(r => r.data?.data || r.data),
    });

    const { data: kardex, isLoading, isError, refetch, isRefetching } = useQuery({
        queryKey: ['kardex', productId, warehouseId, dateFrom, dateTo],
        queryFn: () =>
            api.get(`/stock/products/${productId}/kardex`, {
                params: { warehouse_id: warehouseId, date_from: dateFrom || undefined, date_to: dateTo || undefined },
            }).then(r => r.data),
        enabled: !!productId && !!warehouseId,
    });

    const filteredProducts = (Array.isArray(products) ? products : []).filter((p: ProductOption) =>
        !productSearch || p.name.toLowerCase().includes(productSearch.toLowerCase()) || p.sku?.toLowerCase().includes(productSearch.toLowerCase())
    );

    const entries: KardexEntry[] = kardex?.data || [];
    const canView = hasPermission('estoque.movement.view');

    const exportCsv = () => {
        if (entries.length === 0) return;
        const headers = ['Data', 'Tipo', 'Quantidade', 'Saldo', 'Lote', 'Usuário', 'Observação'];
        const rows = entries.map(e => [
            e.date, e.type_label, e.quantity.toFixed(2), e.balance.toFixed(2),
            e.batch || '', e.user || '', (e.notes || '').replace(/"/g, '""'),
        ]);
        const csv = [headers.join(';'), ...rows.map(r => r.map(c => `"${c}"`).join(';'))].join('\n');
        const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `kardex_${productId}_${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    };

    if (!canView) {
        return (
            <div className="p-6">
                <div className="rounded-xl border border-default bg-surface-0 p-8 text-center shadow-card">
                    <ScrollText className="mx-auto mb-3 h-10 w-10 text-surface-300" />
                    <h1 className="text-base font-semibold text-surface-900">Sem acesso ao Kardex</h1>
                    <p className="mt-1 text-sm text-surface-500">Você não possui permissão para visualizar este módulo.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="p-6 space-y-6">
            <div className="flex items-center gap-3">
                <ScrollText className="h-7 w-7 text-indigo-600" />
                <h1 className="text-2xl font-bold text-surface-900">Kardex de Produto</h1>
            </div>

            <div className="bg-surface-0 rounded-xl shadow-card p-4 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-surface-700 mb-1">Produto *</label>
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-surface-400" />
                            <input
                                type="text"
                                placeholder="Buscar produto..."
                                value={productSearch}
                                onChange={e => setProductSearch(e.target.value)}
                                className="w-full pl-10 pr-3 py-2 border border-default rounded-lg text-sm"
                            />
                        </div>
                        <select
                            title="Selecionar produto"
                            value={productId}
                            onChange={e => setProductId(e.target.value)}
                            className="w-full mt-1 px-3 py-2 border border-default rounded-lg text-sm"
                            size={Math.min(filteredProducts.length + 1, 6)}
                        >
                            <option value="">Selecione um produto</option>
                            {filteredProducts.slice(0, 50).map((p: ProductOption) => (
                                <option key={p.id} value={p.id}>{p.sku ? `[${p.sku}] ` : ''}{p.name}</option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-surface-700 mb-1">Depósito *</label>
                        <div className="relative">
                            <WarehouseIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-surface-400" />
                            <select
                                title="Selecionar depósito"
                                value={warehouseId}
                                onChange={e => setWarehouseId(e.target.value)}
                                className="w-full pl-10 pr-3 py-2 border border-default rounded-lg text-sm"
                            >
                                <option value="">Selecione...</option>
                                {(Array.isArray(warehouses) ? warehouses : []).map((w: WarehouseOption) => (
                                    <option key={w.id} value={w.id}>{w.name}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-surface-700 mb-1">Data Início</label>
                        <div className="relative">
                            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-surface-400" />
                            <input
                                type="date"
                                value={dateFrom}
                                onChange={e => setDateFrom(e.target.value)}
                                className="w-full pl-10 pr-3 py-2 border border-default rounded-lg text-sm"
                                aria-label="Data início"
                            />
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-surface-700 mb-1">Data Fim</label>
                        <div className="relative">
                            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-surface-400" />
                            <input
                                type="date"
                                value={dateTo}
                                onChange={e => setDateTo(e.target.value)}
                                className="w-full pl-10 pr-3 py-2 border border-default rounded-lg text-sm"
                                aria-label="Data fim"
                            />
                        </div>
                    </div>
                </div>

                {productId && warehouseId && (
                    <div className="flex items-center justify-between border-t pt-3">
                        <p className="text-sm text-surface-600">
                            {kardex?.product?.name && (
                                <span>Produto: <strong>{kardex.product.name}</strong> | Depósito: <strong>{kardex.warehouse?.name}</strong></span>
                            )}
                        </p>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={exportCsv}
                                disabled={entries.length === 0}
                                className="flex items-center gap-1 px-3 py-1.5 text-sm text-emerald-600 hover:text-emerald-800 disabled:opacity-40"
                            >
                                <Download className="h-4 w-4" /> Exportar CSV
                            </button>
                            <button
                                onClick={() => refetch()}
                                disabled={isRefetching}
                                className="flex items-center gap-1 px-3 py-1.5 text-sm text-indigo-600 hover:text-indigo-800"
                            >
                                <RefreshCw className={`h-4 w-4 ${isRefetching ? 'animate-spin' : ''}`} /> Atualizar
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {!productId || !warehouseId ? (
                <div className="bg-surface-0 rounded-xl shadow-card p-12 text-center text-surface-400">
                    <ScrollText className="h-12 w-12 mx-auto mb-3 text-surface-300" />
                    <p>Selecione um <strong>produto</strong> e um <strong>depósito</strong> para visualizar o Kardex.</p>
                </div>
            ) : isError ? (
                <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-center">
                    <p className="text-sm font-medium text-red-800">Erro ao carregar o Kardex. Tente novamente.</p>
                    <button
                        onClick={() => refetch()}
                        className="mt-2 px-3 py-1.5 text-sm text-red-700 hover:text-red-900 underline"
                    >
                        Tentar novamente
                    </button>
                </div>
            ) : isLoading ? (
                <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-indigo-600" /></div>
            ) : (
                <div className="bg-surface-0 rounded-xl shadow-card overflow-x-auto">
                    <table className="min-w-full divide-y divide-subtle text-sm">
                        <thead className="bg-surface-50">
                            <tr>
                                <th className="px-4 py-3 text-left text-xs font-medium text-surface-500 uppercase">Data</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-surface-500 uppercase">Tipo</th>
                                <th className="px-4 py-3 text-right text-xs font-medium text-surface-500 uppercase">Quantidade</th>
                                <th className="px-4 py-3 text-right text-xs font-medium text-surface-500 uppercase font-bold">Saldo</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-surface-500 uppercase">Lote</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-surface-500 uppercase">Usuário</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-surface-500 uppercase">Observação</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-subtle">
                            {entries.map((entry) => {
                                const typeInfo = typeIcons[entry.type] || { icon: RefreshCw, color: 'text-surface-500' };
                                const Icon = typeInfo.icon;
                                const isPositive = entry.quantity > 0 && ['entry', 'return'].includes(entry.type);

                                return (
                                    <tr key={entry.id} className="hover:bg-surface-50">
                                        <td className="px-4 py-2.5 text-surface-600 whitespace-nowrap">
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
                                        <td className="px-4 py-2.5 text-right font-mono font-bold text-surface-900">
                                            {entry.balance.toFixed(2)}
                                        </td>
                                        <td className="px-4 py-2.5 text-surface-500">{entry.batch || '—'}</td>
                                        <td className="px-4 py-2.5 text-surface-500">{entry.user || '—'}</td>
                                        <td className="px-4 py-2.5 text-surface-400 max-w-[200px] truncate">{entry.notes || '—'}</td>
                                    </tr>
                                );
                            })}
                            {entries.length === 0 && (
                                <tr><td colSpan={7} className="px-4 py-12 text-center text-surface-400">Nenhuma movimentação encontrada para este produto/depósito</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
