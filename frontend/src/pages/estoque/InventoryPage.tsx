import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import api from '@/lib/api';
import {
    ClipboardCheck, Plus, Eye, CheckCircle2, XCircle, Loader2,
    Warehouse as WarehouseIcon, Calendar, Search, ChevronRight
} from 'lucide-react';
import { useAuthStore } from '@/stores/auth-store'

interface Inventory {
    id: number;
    warehouse: { id: number; name: string } | null;
    creator: { id: number; name: string } | null;
    reference: string | null;
    status: string;
    completed_at: string | null;
    created_at: string;
    items?: InventoryItem[];
}

interface InventoryItem {
    id: number;
    product: { id: number; name: string; sku?: string } | null;
    batch?: { id: number; code: string } | null;
    expected_quantity: string;
    counted_quantity: string | null;
    adjustment_quantity: string | null;
    notes: string | null;
}

interface WarehouseOption {
    id: number;
    name: string;
}

const statusLabels: Record<string, { label: string; color: string }> = {
    open: { label: 'Aberto', color: 'bg-blue-100 text-blue-800' },
    processing: { label: 'Processando', color: 'bg-yellow-100 text-yellow-800' },
    completed: { label: 'Concluído', color: 'bg-green-100 text-green-800' },
    cancelled: { label: 'Cancelado', color: 'bg-red-100 text-red-800' },
};

export default function InventoryPage() {
  const { hasPermission } = useAuthStore()

    const queryClient = useQueryClient();
    const [search, setSearch] = useState('');
    const [filterStatus, setFilterStatus] = useState('');
    const [showNewModal, setShowNewModal] = useState(false);
    const [selectedInventory, setSelectedInventory] = useState<Inventory | null>(null);
    const [newWarehouseId, setNewWarehouseId] = useState('');
    const [newReference, setNewReference] = useState('');

    // Contagens para o modal de detalhe
    const [counts, setCounts] = useState<Record<number, string>>({});
    const [notes, setNotes] = useState<Record<number, string>>({});

    const { data: inventories, isLoading } = useQuery({
        queryKey: ['inventories', filterStatus],
        queryFn: () => api.get('/api/v1/stock/inventories', { params: { status: filterStatus || undefined } }).then(r => r.data),
    });

    const { data: warehouses } = useQuery({
        queryKey: ['warehouses'],
        queryFn: () => api.get('/api/v1/stock/warehouses').then(r => r.data?.data || r.data),
    });

    const { data: inventoryDetail, isLoading: isLoadingDetail } = useQuery({
        queryKey: ['inventory-detail', selectedInventory?.id],
        const { data, isLoading } = useQuery({
        queryFn: () => api.get(`/api/v1/stock/inventories/${selectedInventory!.id}`).then(r => r.data),
        enabled: !!selectedInventory,
    });

    const createMut = useMutation({
        mutationFn: (data: { warehouse_id: string; reference: string }) =>
            api.post('/api/v1/stock/inventories', data),
        onSuccess: () => {
            toast.success('Inventário iniciado com sucesso');
                queryClient.invalidateQueries({ queryKey: ['inventories'] });
            setShowNewModal(false);
            setNewWarehouseId('');
            setNewReference('');
        },
        onError: (err: any) => toast.error(err.response?.data?.message || 'Erro ao iniciar inventário'),
    });

    const countMut = useMutation({
        mutationFn: ({ inventoryId, itemId, data }: { inventoryId: number; itemId: number; data: any }) =>
            api.put(`/api/v1/stock/inventories/${inventoryId}/items/${itemId}`, data),
        onSuccess: () => {
            toast.success('Contagem registrada');
                queryClient.invalidateQueries({ queryKey: ['inventory-detail'] });
        },
        onError: (err: any) => toast.error(err.response?.data?.message || 'Erro ao registrar contagem'),
    });

    const completeMut = useMutation({
        mutationFn: (id: number) => api.post(`/api/v1/stock/inventories/${id}/complete`),
        onSuccess: () => {
            toast.success('Inventário finalizado e ajustes aplicados!');
                queryClient.invalidateQueries({ queryKey: ['inventories'] });
                queryClient.invalidateQueries({ queryKey: ['inventory-detail'] });
                queryClient.invalidateQueries({ queryKey: ['stock'] });
            setSelectedInventory(null);
        },
        onError: (err: any) => toast.error(err.response?.data?.message || 'Erro ao finalizar inventário'),
    });

    const cancelMut = useMutation({
        mutationFn: (id: number) => api.post(`/api/v1/stock/inventories/${id}/cancel`),
        onSuccess: () => {
            toast.success('Inventário cancelado');
                queryClient.invalidateQueries({ queryKey: ['inventories'] });
            setSelectedInventory(null);
        },
        onError: (err: any) => toast.error(err.response?.data?.message || 'Erro ao cancelar'),
    });

    const handleSaveCount = (inventoryId: number, itemId: number) => {
        const countValue = counts[itemId];
        if (countValue === undefined || countValue === '') {
            toast.error('Informe a quantidade contada');
            return;
        }
        countMut.mutate({
            inventoryId,
            itemId,
            data: { counted_quantity: parseFloat(countValue), notes: notes[itemId] || '' },
        });
    };

    const list = inventories?.data || inventories || [];

    return (
        <div className="p-6 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <ClipboardCheck className="h-7 w-7 text-indigo-600" />
                    <h1 className="text-2xl font-bold text-gray-900">Inventário Cego</h1>
                </div>
                <button
                    onClick={() => setShowNewModal(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition"
                >
                    <Plus className="h-4 w-4" /> Novo Inventário
                </button>
            </div>

            {/* Filtros */}
            <div className="flex flex-wrap gap-3">
                <div className="relative flex-1 min-w-[200px]">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input
                        type="text"
                        placeholder="Buscar por referência..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                    />
                </div>
                <select
                    title="Filtrar por status"
                    value={filterStatus}
                    onChange={e => setFilterStatus(e.target.value)}
                    className="px-4 py-2 border border-gray-300 rounded-lg"
                >
                    <option value="">Todos os Status</option>
                    <option value="open">Aberto</option>
                    <option value="completed">Concluído</option>
                    <option value="cancelled">Cancelado</option>
                </select>
            </div>

            {/* Tabela */}
            {isLoading ? (
                <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-indigo-600" /></div>
            ) : (
                <div className="bg-white rounded-xl shadow overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">ID</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Referência</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Depósito</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Criado por</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Data</th>
                                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {(Array.isArray(list) ? list : [])
                                .filter((inv: Inventory) => !search || inv.reference?.toLowerCase().includes(search.toLowerCase()))
                                .map((inv: Inventory) => {
                                    const st = statusLabels[inv.status] || { label: inv.status, color: 'bg-gray-100 text-gray-800' };
                                    return (
                                        <tr key={inv.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => setSelectedInventory(inv)}>
                                            <td className="px-4 py-3 text-sm font-mono text-gray-600">#{inv.id}</td>
                                            <td className="px-4 py-3 text-sm font-medium text-gray-900">{inv.reference || '—'}</td>
                                            <td className="px-4 py-3 text-sm text-gray-600 flex items-center gap-1">
                                                <WarehouseIcon className="h-4 w-4 text-gray-400" />
                                                {inv.warehouse?.name || '—'}
                                            </td>
                                            <td className="px-4 py-3"><span className={`px-2 py-1 rounded-full text-xs font-medium ${st.color}`}>{st.label}</span></td>
                                            <td className="px-4 py-3 text-sm text-gray-600">{inv.creator?.name || '—'}</td>
                                            <td className="px-4 py-3 text-sm text-gray-500 flex items-center gap-1">
                                                <Calendar className="h-3 w-3" />
                                                {new Date(inv.created_at).toLocaleDateString('pt-BR')}
                                            </td>
                                            <td className="px-4 py-3 text-right">
                                                <button title="Ver detalhes" className="text-indigo-600 hover:text-indigo-800"><ChevronRight className="h-5 w-5" /></button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            {(!Array.isArray(list) || list.length === 0) && (
                                <tr><td colSpan={7} className="px-4 py-12 text-center text-gray-500">Nenhum inventário encontrado</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Modal: Novo Inventário */}
            {showNewModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowNewModal(false)}>
                    <div className="bg-white rounded-xl p-6 w-full max-w-md space-y-4" onClick={e => e.stopPropagation()}>
                        <h2 className="text-lg font-bold text-gray-900">Novo Inventário</h2>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Depósito *</label>
                            <select
                                title="Selecionar depósito"
                                value={newWarehouseId}
                                onChange={e => setNewWarehouseId(e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                            >
                                <option value="">Selecione...</option>
                                {(Array.isArray(warehouses) ? warehouses : []).map((w: WarehouseOption) => (
                                    <option key={w.id} value={w.id}>{w.name}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Referência</label>
                            <input
                                type="text"
                                placeholder="Ex: INV-2026-001"
                                value={newReference}
                                onChange={e => setNewReference(e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                            />
                        </div>
                        <div className="flex justify-end gap-3 pt-2">
                            <button onClick={() => setShowNewModal(false)} className="px-4 py-2 border rounded-lg hover:bg-gray-50">Cancelar</button>
                            <button
                                onClick={() => createMut.mutate({ warehouse_id: newWarehouseId, reference: newReference })}
                                disabled={!newWarehouseId || createMut.isPending}
                                className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2"
                            >
                                {createMut.isPending && <Loader2 className="h-4 w-4 animate-spin" />} Iniciar
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal: Detalhe do Inventário (Contagem Cega) */}
            {selectedInventory && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setSelectedInventory(null)}>
                    <div className="bg-white rounded-xl p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto space-y-4" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between">
                            <h2 className="text-lg font-bold text-gray-900">
                                Inventário #{selectedInventory.id} — {selectedInventory.reference || 'Sem referência'}
                            </h2>
                            <div className="flex items-center gap-2">
                                {selectedInventory.status === 'open' && (
                                    <>
                                        <button
                                            onClick={() => { if (confirm('Tem certeza que deseja cancelar?')) cancelMut.mutate(selectedInventory.id); }}
                                            className="flex items-center gap-1 px-3 py-1.5 border border-red-300 text-red-600 rounded-lg hover:bg-red-50 text-sm"
                                        >
                                            <XCircle className="h-4 w-4" /> Cancelar
                                        </button>
                                        <button
                                            onClick={() => { if (confirm('Finalizar inventário e aplicar ajustes?')) completeMut.mutate(selectedInventory.id); }}
                                            className="flex items-center gap-1 px-3 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm"
                                            disabled={completeMut.isPending}
                                        >
                                            {completeMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                                            Finalizar
                                        </button>
                                    </>
                                )}
                            </div>
                        </div>

                        <p className="text-sm text-gray-500">
                            <strong>Nota:</strong> A quantidade esperada está <strong>oculta</strong> até a finalização do inventário.
                            Informe a contagem real de cada item.
                        </p>

                        {isLoadingDetail ? (
                            <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-indigo-600" /></div>
                        ) : (
                            <table className="min-w-full divide-y divide-gray-200 text-sm">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th className="px-3 py-2 text-left font-medium text-gray-500 uppercase text-xs">Produto</th>
                                        <th className="px-3 py-2 text-left font-medium text-gray-500 uppercase text-xs">Lote</th>
                                        {selectedInventory.status === 'completed' && (
                                            <th className="px-3 py-2 text-right font-medium text-gray-500 uppercase text-xs">Esperado</th>
                                        )}
                                        <th className="px-3 py-2 text-right font-medium text-gray-500 uppercase text-xs">Contagem</th>
                                        {selectedInventory.status === 'completed' && (
                                            <th className="px-3 py-2 text-right font-medium text-gray-500 uppercase text-xs">Divergência</th>
                                        )}
                                        <th className="px-3 py-2 text-left font-medium text-gray-500 uppercase text-xs">Obs.</th>
                                        {selectedInventory.status === 'open' && (
                                            <th className="px-3 py-2 text-center font-medium text-gray-500 uppercase text-xs">Ação</th>
                                        )}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {(inventoryDetail?.items || []).map((item: InventoryItem) => {
                                        const expected = parseFloat(item.expected_quantity);
                                        const counted = item.counted_quantity !== null ? parseFloat(item.counted_quantity) : null;
                                        const discrepancy = counted !== null ? counted - expected : null;

                                        return (
                                            <tr key={item.id} className="hover:bg-gray-50">
                                                <td className="px-3 py-2 font-medium text-gray-900">
                                                    {item.product?.name || '—'}
                                                    {item.product?.sku && <span className="text-xs text-gray-400 ml-1">({item.product.sku})</span>}
                                                </td>
                                                <td className="px-3 py-2 text-gray-600">{item.batch?.code || '—'}</td>
                                                {selectedInventory.status === 'completed' && (
                                                    <td className="px-3 py-2 text-right font-mono">{expected.toFixed(2)}</td>
                                                )}
                                                <td className="px-3 py-2 text-right">
                                                    {selectedInventory.status === 'open' ? (
                                                        <input
                                                            type="number"
                                                            step="0.01"
                                                            min="0"
                                                            placeholder="Qtd"
                                                            value={counts[item.id] ?? (item.counted_quantity || '')}
                                                            onChange={e => setCounts(p => ({ ...p, [item.id]: e.target.value }))}
                                                            className="w-24 px-2 py-1 border border-gray-300 rounded text-right text-sm"
                                                            aria-label="Quantidade contada"
                                                        />
                                                    ) : (
                                                        <span className="font-mono">{counted?.toFixed(2) ?? '—'}</span>
                                                    )}
                                                </td>
                                                {selectedInventory.status === 'completed' && (
                                                    <td className={`px-3 py-2 text-right font-mono font-bold ${discrepancy && discrepancy > 0 ? 'text-green-600' :
                                                        discrepancy && discrepancy < 0 ? 'text-red-600' : 'text-gray-500'
                                                        }`}>
                                                        {discrepancy !== null ? (discrepancy > 0 ? '+' : '') + discrepancy.toFixed(2) : '—'}
                                                    </td>
                                                )}
                                                <td className="px-3 py-2">
                                                    {selectedInventory.status === 'open' ? (
                                                        <input
                                                            type="text"
                                                            placeholder="Obs..."
                                                            value={notes[item.id] ?? (item.notes || '')}
                                                            onChange={e => setNotes(p => ({ ...p, [item.id]: e.target.value }))}
                                                            className="w-32 px-2 py-1 border border-gray-300 rounded text-sm"
                                                            aria-label="Observação do item"
                                                        />
                                                    ) : (
                                                        <span className="text-gray-500">{item.notes || '—'}</span>
                                                    )}
                                                </td>
                                                {selectedInventory.status === 'open' && (
                                                    <td className="px-3 py-2 text-center">
                                                        <button
                                                            onClick={() => handleSaveCount(selectedInventory.id, item.id)}
                                                            disabled={countMut.isPending}
                                                            className="px-2 py-1 bg-indigo-600 text-white rounded text-xs hover:bg-indigo-700 disabled:opacity-50"
                                                        >
                                                            Salvar
                                                        </button>
                                                    </td>
                                                )}
                                            </tr>
                                        );
                                    })}
                                    {(!inventoryDetail?.items || inventoryDetail.items.length === 0) && (
                                        <tr><td colSpan={7} className="px-3 py-8 text-center text-gray-400">Nenhum item neste inventário</td></tr>
                                    )}
                                </tbody>
                            </table>
                        )}

                        <div className="flex justify-end pt-2">
                            <button onClick={() => setSelectedInventory(null)} className="px-4 py-2 border rounded-lg hover:bg-gray-50">Fechar</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
