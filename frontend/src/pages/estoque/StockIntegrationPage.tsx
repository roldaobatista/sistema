import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import api from '@/lib/api';
import { useAuthStore } from '@/stores/auth-store'
import {
    ShoppingCart, PackageSearch, QrCode, RotateCcw, Trash2,
    Loader2, Search, Plus, Eye, Check, X, AlertTriangle, Package
} from 'lucide-react';

type Tab = 'quotes' | 'requests' | 'tags' | 'rma' | 'disposal';

const tabs: { key: Tab; label: string; icon: React.ElementType; color: string }[] = [
    { key: 'quotes', label: 'Cotações', icon: ShoppingCart, color: 'text-blue-600' },
    { key: 'requests', label: 'Solicitações', icon: PackageSearch, color: 'text-purple-600' },
    { key: 'tags', label: 'Tags RFID/QR', icon: QrCode, color: 'text-teal-600' },
    { key: 'rma', label: 'RMA', icon: RotateCcw, color: 'text-orange-600' },
    { key: 'disposal', label: 'Descarte', icon: Trash2, color: 'text-red-600' },
];

const statusColors: Record<string, string> = {
    draft: 'bg-gray-100 text-gray-700',
    sent: 'bg-blue-100 text-blue-700',
    received: 'bg-indigo-100 text-indigo-700',
    approved: 'bg-green-100 text-green-700',
    rejected: 'bg-red-100 text-red-700',
    cancelled: 'bg-gray-200 text-gray-600',
    pending: 'bg-yellow-100 text-yellow-700',
    partially_fulfilled: 'bg-amber-100 text-amber-700',
    fulfilled: 'bg-green-100 text-green-700',
    active: 'bg-green-100 text-green-700',
    inactive: 'bg-gray-100 text-gray-700',
    lost: 'bg-red-100 text-red-700',
    damaged: 'bg-orange-100 text-orange-700',
    requested: 'bg-yellow-100 text-yellow-700',
    in_transit: 'bg-blue-100 text-blue-700',
    inspected: 'bg-indigo-100 text-indigo-700',
    resolved: 'bg-green-100 text-green-700',
    in_progress: 'bg-blue-100 text-blue-700',
    completed: 'bg-green-100 text-green-700',
};

const statusLabels: Record<string, string> = {
    draft: 'Rascunho', sent: 'Enviada', received: 'Recebida', approved: 'Aprovada',
    rejected: 'Rejeitada', cancelled: 'Cancelada', pending: 'Pendente',
    partially_fulfilled: 'Parcial', fulfilled: 'Concluída', active: 'Ativa',
    inactive: 'Inativa', lost: 'Perdida', damaged: 'Danificada',
    requested: 'Solicitado', in_transit: 'Em trânsito', inspected: 'Inspecionado',
    resolved: 'Resolvido', in_progress: 'Em andamento', completed: 'Concluído',
};

const formatBRL = (v: number) => v?.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) ?? '—';
const formatDate = (d: string) => d ? new Date(d).toLocaleDateString('pt-BR') : '—';

function StatusBadge({ status }: { status: string }) {
    return (
        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[status] ?? 'bg-gray-100 text-gray-600'}`}>
            {statusLabels[status] ?? status}
        </span>
    );
}

export default function StockIntegrationPage() {
    const { hasPermission } = useAuthStore()

    const [activeTab, setActiveTab] = useState<Tab>('quotes');
    const [search, setSearch] = useState('');
    const queryClient = useQueryClient();

    // ═══ Queries ═══
    const { data: quotesData, isLoading: quotesLoading } = useQuery({
        queryKey: ['purchase-quotes', search],
        const { data, isLoading } = useQuery({
        queryFn: () => api.get('/api/v1/purchase-quotes', { params: { search, per_page: 50 } }).then(r => r.data),
        enabled: activeTab === 'quotes',
    });

    const { data: requestsData, isLoading: requestsLoading } = useQuery({
        queryKey: ['material-requests', search],
        const { data, isLoading } = useQuery({
        queryFn: () => api.get('/api/v1/material-requests', { params: { search, per_page: 50 } }).then(r => r.data),
        enabled: activeTab === 'requests',
    });

    const { data: tagsData, isLoading: tagsLoading } = useQuery({
        queryKey: ['asset-tags', search],
        const { data, isLoading } = useQuery({
        queryFn: () => api.get('/api/v1/asset-tags', { params: { search, per_page: 50 } }).then(r => r.data),
        enabled: activeTab === 'tags',
    });

    const { data: rmaData, isLoading: rmaLoading } = useQuery({
        queryKey: ['rma-requests', search],
        const { data, isLoading } = useQuery({
        queryFn: () => api.get('/api/v1/rma', { params: { search, per_page: 50 } }).then(r => r.data),
        enabled: activeTab === 'rma',
    });

    const { data: disposalData, isLoading: disposalLoading } = useQuery({
        queryKey: ['stock-disposals', search],
        const { data, isLoading } = useQuery({
        queryFn: () => api.get('/api/v1/stock-disposals', { params: { search, per_page: 50 } }).then(r => r.data),
        enabled: activeTab === 'disposal',
    });

    // ═══ Status update mutations ═══
    const updateQuoteStatus = useMutation({
        mutationFn: ({ id, status }: { id: number; status: string }) => api.put(`/api/v1/purchase-quotes/${id}`, { status }),
        onSuccess: () => { toast.success('Cotação atualizada');
                queryClient.invalidateQueries({ queryKey: ['purchase-quotes'] }); },
        onError: () => toast.error('Erro ao atualizar cotação'),
    });

    const updateRequestStatus = useMutation({
        mutationFn: ({ id, status }: { id: number; status: string }) => api.put(`/api/v1/material-requests/${id}`, { status }),
        onSuccess: () => { toast.success('Solicitação atualizada');
                queryClient.invalidateQueries({ queryKey: ['material-requests'] }); },
        onError: () => toast.error('Erro ao atualizar'),
    });

    const updateRmaStatus = useMutation({
        mutationFn: ({ id, status }: { id: number; status: string }) => api.put(`/api/v1/rma/${id}`, { status }),
        onSuccess: () => { toast.success('RMA atualizado');
                queryClient.invalidateQueries({ queryKey: ['rma-requests'] }); },
        onError: () => toast.error('Erro ao atualizar RMA'),
    });

    const updateDisposalStatus = useMutation({
        mutationFn: ({ id, status }: { id: number; status: string }) => api.put(`/api/v1/stock-disposals/${id}`, { status }),
        onSuccess: () => { toast.success('Descarte atualizado');
                queryClient.invalidateQueries({ queryKey: ['stock-disposals'] }); },
        onError: () => toast.error('Erro ao atualizar descarte'),
    });

    const isLoading =
        (activeTab === 'quotes' && quotesLoading) ||
        (activeTab === 'requests' && requestsLoading) ||
        (activeTab === 'tags' && tagsLoading) ||
        (activeTab === 'rma' && rmaLoading) ||
        (activeTab === 'disposal' && disposalLoading);

    return (
        <div className="p-6 space-y-6">
            <div className="flex items-center gap-3">
                <Package className="h-7 w-7 text-indigo-600" />
                <h1 className="text-2xl font-bold text-gray-900">Integração de Estoque</h1>
            </div>

            {/* Tabs */}
            <div className="flex flex-wrap gap-1 p-1 bg-gray-100 rounded-xl">
                {tabs.map(tab => (
                    <button
                        key={tab.key}
                        onClick={() => { setActiveTab(tab.key); setSearch(''); }}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition ${activeTab === tab.key ? 'bg-white shadow-sm text-gray-900' : 'text-gray-600 hover:text-gray-900'
                            }`}
                    >
                        <tab.icon className={`h-4 w-4 ${activeTab === tab.key ? tab.color : ''}`} />
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Search */}
            <div className="relative max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                    type="text"
                    placeholder="Buscar..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                />
            </div>

            {isLoading && (
                <div className="flex justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
                </div>
            )}

            {/* ═══ COTAÇÕES ═══ */}
            {activeTab === 'quotes' && !quotesLoading && (
                <div className="bg-white rounded-xl shadow overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Ref</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Título</th>
                                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Itens</th>
                                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Fornecedores</th>
                                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Prazo</th>
                                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Status</th>
                                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {(quotesData?.data ?? []).length === 0 && (
                                <tr><td colSpan={7} className="px-4 py-12 text-center text-gray-400">
                                    <ShoppingCart className="h-8 w-8 mx-auto mb-2 text-gray-300" />Nenhuma cotação
                                </td></tr>
                            )}
                            {(quotesData?.data ?? []).map((q: any) => (
                                <tr key={q.id} className="hover:bg-gray-50">
                                    <td className="px-4 py-3 text-sm font-mono">{q.reference}</td>
                                    <td className="px-4 py-3 text-sm font-medium">{q.title}</td>
                                    <td className="px-4 py-3 text-sm text-center">{q.items?.length ?? 0}</td>
                                    <td className="px-4 py-3 text-sm text-center">{q.suppliers?.length ?? 0}</td>
                                    <td className="px-4 py-3 text-sm text-center">{formatDate(q.deadline)}</td>
                                    <td className="px-4 py-3 text-center"><StatusBadge status={q.status} /></td>
                                    <td className="px-4 py-3 text-center">
                                        <div className="flex justify-center gap-1">
                                            {q.status === 'draft' && (
                                                <button title="Enviar" onClick={() => updateQuoteStatus.mutate({ id: q.id, status: 'sent' })} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded"><Check className="h-4 w-4" /></button>
                                            )}
                                            {q.status !== 'cancelled' && (
                                                <button title="Cancelar" onClick={() => updateQuoteStatus.mutate({ id: q.id, status: 'cancelled' })} className="p-1.5 text-red-600 hover:bg-red-50 rounded"><X className="h-4 w-4" /></button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* ═══ SOLICITAÇÕES ═══ */}
            {activeTab === 'requests' && !requestsLoading && (
                <div className="bg-white rounded-xl shadow overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Ref</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Solicitante</th>
                                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Itens</th>
                                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Prioridade</th>
                                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Status</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Data</th>
                                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {(requestsData?.data ?? []).length === 0 && (
                                <tr><td colSpan={7} className="px-4 py-12 text-center text-gray-400">
                                    <PackageSearch className="h-8 w-8 mx-auto mb-2 text-gray-300" />Nenhuma solicitação
                                </td></tr>
                            )}
                            {(requestsData?.data ?? []).map((r: any) => (
                                <tr key={r.id} className="hover:bg-gray-50">
                                    <td className="px-4 py-3 text-sm font-mono">{r.reference}</td>
                                    <td className="px-4 py-3 text-sm">{r.requester?.name ?? '—'}</td>
                                    <td className="px-4 py-3 text-sm text-center">{r.items?.length ?? 0}</td>
                                    <td className="px-4 py-3 text-center">
                                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${r.priority === 'urgent' ? 'bg-red-100 text-red-700' :
                                            r.priority === 'high' ? 'bg-orange-100 text-orange-700' :
                                                r.priority === 'normal' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700'
                                            }`}>{r.priority === 'urgent' ? 'Urgente' : r.priority === 'high' ? 'Alta' : r.priority === 'normal' ? 'Normal' : 'Baixa'}</span>
                                    </td>
                                    <td className="px-4 py-3 text-center"><StatusBadge status={r.status} /></td>
                                    <td className="px-4 py-3 text-sm">{formatDate(r.created_at)}</td>
                                    <td className="px-4 py-3 text-center">
                                        <div className="flex justify-center gap-1">
                                            {r.status === 'pending' && (
                                                <>
                                                    <button title="Aprovar" onClick={() => updateRequestStatus.mutate({ id: r.id, status: 'approved' })} className="p-1.5 text-green-600 hover:bg-green-50 rounded"><Check className="h-4 w-4" /></button>
                                                    <button title="Rejeitar" onClick={() => updateRequestStatus.mutate({ id: r.id, status: 'rejected' })} className="p-1.5 text-red-600 hover:bg-red-50 rounded"><X className="h-4 w-4" /></button>
                                                </>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* ═══ TAGS RFID/QR ═══ */}
            {activeTab === 'tags' && !tagsLoading && (
                <div className="bg-white rounded-xl shadow overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Código</th>
                                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Tipo</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Localização</th>
                                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Status</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Última Leitura</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Por</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {(tagsData?.data ?? []).length === 0 && (
                                <tr><td colSpan={6} className="px-4 py-12 text-center text-gray-400">
                                    <QrCode className="h-8 w-8 mx-auto mb-2 text-gray-300" />Nenhuma tag
                                </td></tr>
                            )}
                            {(tagsData?.data ?? []).map((t: any) => (
                                <tr key={t.id} className="hover:bg-gray-50">
                                    <td className="px-4 py-3 text-sm font-mono font-medium">{t.tag_code}</td>
                                    <td className="px-4 py-3 text-center">
                                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${t.tag_type === 'rfid' ? 'bg-purple-100 text-purple-700' :
                                            t.tag_type === 'qrcode' ? 'bg-teal-100 text-teal-700' : 'bg-gray-100 text-gray-700'
                                            }`}>{t.tag_type?.toUpperCase()}</span>
                                    </td>
                                    <td className="px-4 py-3 text-sm">{t.location ?? '—'}</td>
                                    <td className="px-4 py-3 text-center"><StatusBadge status={t.status} /></td>
                                    <td className="px-4 py-3 text-sm">{t.last_scanned_at ? formatDate(t.last_scanned_at) : '—'}</td>
                                    <td className="px-4 py-3 text-sm">{t.last_scanner?.name ?? '—'}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* ═══ RMA ═══ */}
            {activeTab === 'rma' && !rmaLoading && (
                <div className="bg-white rounded-xl shadow overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Nº RMA</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tipo</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Cliente</th>
                                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Itens</th>
                                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Status</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Data</th>
                                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {(rmaData?.data ?? []).length === 0 && (
                                <tr><td colSpan={7} className="px-4 py-12 text-center text-gray-400">
                                    <RotateCcw className="h-8 w-8 mx-auto mb-2 text-gray-300" />Nenhum RMA
                                </td></tr>
                            )}
                            {(rmaData?.data ?? []).map((r: any) => (
                                <tr key={r.id} className="hover:bg-gray-50">
                                    <td className="px-4 py-3 text-sm font-mono font-medium">{r.rma_number}</td>
                                    <td className="px-4 py-3 text-sm">{r.type === 'customer_return' ? 'Cliente' : 'Fornecedor'}</td>
                                    <td className="px-4 py-3 text-sm">{r.customer?.name ?? '—'}</td>
                                    <td className="px-4 py-3 text-sm text-center">{r.items?.length ?? 0}</td>
                                    <td className="px-4 py-3 text-center"><StatusBadge status={r.status} /></td>
                                    <td className="px-4 py-3 text-sm">{formatDate(r.created_at)}</td>
                                    <td className="px-4 py-3 text-center">
                                        <div className="flex justify-center gap-1">
                                            {r.status === 'requested' && (
                                                <button title="Aprovar" onClick={() => updateRmaStatus.mutate({ id: r.id, status: 'approved' })} className="p-1.5 text-green-600 hover:bg-green-50 rounded"><Check className="h-4 w-4" /></button>
                                            )}
                                            {r.status === 'inspected' && (
                                                <button title="Resolver" onClick={() => updateRmaStatus.mutate({ id: r.id, status: 'resolved' })} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded"><Check className="h-4 w-4" /></button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* ═══ DESCARTE ═══ */}
            {activeTab === 'disposal' && !disposalLoading && (
                <div className="bg-white rounded-xl shadow overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Ref</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tipo</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Método</th>
                                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Itens</th>
                                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Status</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Data</th>
                                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {(disposalData?.data ?? []).length === 0 && (
                                <tr><td colSpan={7} className="px-4 py-12 text-center text-gray-400">
                                    <Trash2 className="h-8 w-8 mx-auto mb-2 text-gray-300" />Nenhum descarte
                                </td></tr>
                            )}
                            {(disposalData?.data ?? []).map((d: any) => {
                                const typeLabels: Record<string, string> = {
                                    expired: 'Vencido', damaged: 'Danificado', obsolete: 'Obsoleto',
                                    recalled: 'Recall', hazardous: 'Perigoso', other: 'Outro',
                                };
                                const methodLabels: Record<string, string> = {
                                    recycling: 'Reciclagem', incineration: 'Incineração', landfill: 'Aterro',
                                    donation: 'Doação', return_manufacturer: 'Devolução Fabricante', specialized_treatment: 'Tratamento',
                                };
                                return (
                                    <tr key={d.id} className="hover:bg-gray-50">
                                        <td className="px-4 py-3 text-sm font-mono font-medium">{d.reference}</td>
                                        <td className="px-4 py-3 text-sm">{typeLabels[d.disposal_type] ?? d.disposal_type}</td>
                                        <td className="px-4 py-3 text-sm">{methodLabels[d.disposal_method] ?? d.disposal_method}</td>
                                        <td className="px-4 py-3 text-sm text-center">{d.items?.length ?? 0}</td>
                                        <td className="px-4 py-3 text-center"><StatusBadge status={d.status} /></td>
                                        <td className="px-4 py-3 text-sm">{formatDate(d.created_at)}</td>
                                        <td className="px-4 py-3 text-center">
                                            <div className="flex justify-center gap-1">
                                                {d.status === 'pending' && (
                                                    <button title="Aprovar" onClick={() => updateDisposalStatus.mutate({ id: d.id, status: 'approved' })} className="p-1.5 text-green-600 hover:bg-green-50 rounded"><Check className="h-4 w-4" /></button>
                                                )}
                                                {d.status === 'approved' && (
                                                    <button title="Concluir" onClick={() => updateDisposalStatus.mutate({ id: d.id, status: 'completed' })} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded"><Check className="h-4 w-4" /></button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
