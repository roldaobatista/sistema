import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import api from '@/lib/api';
import { useAuthStore } from '@/stores/auth-store';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    ShoppingCart, PackageSearch, QrCode, RotateCcw, Trash2,
    Loader2, Search, Plus, Eye, Check, X, AlertTriangle, Package,
    ChevronLeft, ChevronRight,
} from 'lucide-react';

type Tab = 'quotes' | 'requests' | 'tags' | 'rma' | 'disposal';

const tabs: { key: Tab; label: string; icon: React.ElementType; color: string }[] = [
    { key: 'quotes', label: 'Cotações', icon: ShoppingCart, color: 'text-blue-600' },
    { key: 'requests', label: 'Solicitações', icon: PackageSearch, color: 'text-purple-600' },
    { key: 'tags', label: 'Tags RFID/QR', icon: QrCode, color: 'text-teal-600' },
    { key: 'rma', label: 'RMA', icon: RotateCcw, color: 'text-orange-600' },
    { key: 'disposal', label: 'Descarte', icon: Trash2, color: 'text-red-600' },
];

const createTitles: Record<Tab, string> = {
    quotes: 'Nova Cotação',
    requests: 'Nova Solicitação',
    tags: 'Nova Tag',
    rma: 'Novo RMA',
    disposal: 'Novo Descarte',
};

const PER_PAGE = 15;

const statusColors: Record<string, string> = {
    draft: 'bg-surface-100 text-surface-700',
    sent: 'bg-blue-100 text-blue-700',
    received: 'bg-indigo-100 text-indigo-700',
    approved: 'bg-green-100 text-green-700',
    rejected: 'bg-red-100 text-red-700',
    cancelled: 'bg-surface-200 text-surface-600',
    pending: 'bg-yellow-100 text-yellow-700',
    partially_fulfilled: 'bg-amber-100 text-amber-700',
    fulfilled: 'bg-green-100 text-green-700',
    active: 'bg-green-100 text-green-700',
    inactive: 'bg-surface-100 text-surface-700',
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
        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[status] ?? 'bg-surface-100 text-surface-600'}`}>
            {statusLabels[status] ?? status}
        </span>
    );
}

function PaginationControls({ data, page, onPageChange }: { data: any; page: number; onPageChange: (p: number) => void }) {
    const lastPage = data?.last_page ?? data?.meta?.last_page ?? 1;
    const total = data?.total ?? data?.meta?.total ?? 0;
    if (lastPage <= 1) return null;
    return (
        <div className="flex items-center justify-between px-4 py-3 border-t border-subtle">
            <span className="text-xs text-surface-500">{total} registros</span>
            <div className="flex items-center gap-1">
                <button title="Página anterior" disabled={page <= 1} onClick={() => onPageChange(page - 1)} className="p-1.5 rounded hover:bg-surface-100 disabled:opacity-40 disabled:cursor-not-allowed">
                    <ChevronLeft className="h-4 w-4" />
                </button>
                <span className="text-sm px-2">{page} / {lastPage}</span>
                <button title="Próxima página" disabled={page >= lastPage} onClick={() => onPageChange(page + 1)} className="p-1.5 rounded hover:bg-surface-100 disabled:opacity-40 disabled:cursor-not-allowed">
                    <ChevronRight className="h-4 w-4" />
                </button>
            </div>
        </div>
    );
}

export default function StockIntegrationPage() {
    const { hasPermission } = useAuthStore()

    const [activeTab, setActiveTab] = useState<Tab>('quotes');
    const [search, setSearch] = useState('');
    const [page, setPage] = useState(1);
    const [createOpen, setCreateOpen] = useState(false);
    const [detailItem, setDetailItem] = useState<any>(null);
    const [confirmAction, setConfirmAction] = useState<{
        id: number; status: string; label: string;
        type: 'quote' | 'request' | 'rma' | 'disposal';
    } | null>(null);
    const [deleteConfirm, setDeleteConfirm] = useState<{ id: number; label: string } | null>(null);
    const [form, setForm] = useState<Record<string, any>>({});
    const queryClient = useQueryClient();

    // Produtos para seletor nos formulários
    const { data: productsRes } = useQuery({
        queryKey: ['products-for-integration'],
        queryFn: () => api.get('/stock/summary').then(r => r.data),
        enabled: createOpen,
    });
    const productOptions: { id: number; name: string; code?: string; unit?: string }[] = productsRes?.products ?? [];

    const updateForm = (field: string, value: any) => setForm(prev => ({ ...prev, [field]: value }));

    // ═══ Queries ═══
    const { data: quotesData, isLoading: quotesLoading } = useQuery({
        queryKey: ['purchase-quotes', search, page],
        queryFn: () => api.get('/purchase-quotes', { params: { search, page, per_page: PER_PAGE } }).then(r => r.data),
        enabled: activeTab === 'quotes',
    });

    const { data: requestsData, isLoading: requestsLoading } = useQuery({
        queryKey: ['material-requests', search, page],
        queryFn: () => api.get('/material-requests', { params: { search, page, per_page: PER_PAGE } }).then(r => r.data),
        enabled: activeTab === 'requests',
    });

    const { data: tagsData, isLoading: tagsLoading } = useQuery({
        queryKey: ['asset-tags', search, page],
        queryFn: () => api.get('/asset-tags', { params: { search, page, per_page: PER_PAGE } }).then(r => r.data),
        enabled: activeTab === 'tags',
    });

    const { data: rmaData, isLoading: rmaLoading } = useQuery({
        queryKey: ['rma-requests', search, page],
        queryFn: () => api.get('/rma', { params: { search, page, per_page: PER_PAGE } }).then(r => r.data),
        enabled: activeTab === 'rma',
    });

    const { data: disposalData, isLoading: disposalLoading } = useQuery({
        queryKey: ['stock-disposals', search, page],
        queryFn: () => api.get('/stock-disposals', { params: { search, page, per_page: PER_PAGE } }).then(r => r.data),
        enabled: activeTab === 'disposal',
    });

    // ═══ Delete mutation ═══
    const deleteQuoteMut = useMutation({
        mutationFn: (id: number) => api.delete(`/purchase-quotes/${id}`),
        onSuccess: () => {
            toast.success('Cotação excluída com sucesso');
            queryClient.invalidateQueries({ queryKey: ['purchase-quotes'] });
            setDeleteConfirm(null);
        },
        onError: (error: any) => toast.error(error?.response?.data?.message || 'Erro ao excluir cotação'),
    });

    // ═══ Status update mutations ═══
    const updateQuoteStatus = useMutation({
        mutationFn: ({ id, status }: { id: number; status: string }) => api.put(`/purchase-quotes/${id}`, { status }),
        onSuccess: () => {
            toast.success('Cotação atualizada');
            queryClient.invalidateQueries({ queryKey: ['purchase-quotes'] });
        },
        onError: () => toast.error('Erro ao atualizar cotação'),
    });

    const updateRequestStatus = useMutation({
        mutationFn: ({ id, status }: { id: number; status: string }) => api.put(`/material-requests/${id}`, { status }),
        onSuccess: () => {
            toast.success('Solicitação atualizada');
            queryClient.invalidateQueries({ queryKey: ['material-requests'] });
        },
        onError: () => toast.error('Erro ao atualizar'),
    });

    const updateRmaStatus = useMutation({
        mutationFn: ({ id, status }: { id: number; status: string }) => api.put(`/rma/${id}`, { status }),
        onSuccess: () => {
            toast.success('RMA atualizado');
            queryClient.invalidateQueries({ queryKey: ['rma-requests'] });
        },
        onError: () => toast.error('Erro ao atualizar RMA'),
    });

    const updateDisposalStatus = useMutation({
        mutationFn: ({ id, status }: { id: number; status: string }) => api.put(`/stock-disposals/${id}`, { status }),
        onSuccess: () => {
            toast.success('Descarte atualizado');
            queryClient.invalidateQueries({ queryKey: ['stock-disposals'] });
        },
        onError: () => toast.error('Erro ao atualizar descarte'),
    });

    // ═══ Create mutations ═══
    const onCreateSuccess = (msg: string, queryKey: string) => {
        toast.success(msg);
        queryClient.invalidateQueries({ queryKey: [queryKey] });
        setCreateOpen(false);
        setForm({});
    };

    const createQuote = useMutation({
        mutationFn: (data: Record<string, any>) => api.post('/purchase-quotes', data),
        onSuccess: () => onCreateSuccess('Cotação criada', 'purchase-quotes'),
        onError: () => toast.error('Erro ao criar cotação'),
    });

    const createRequest = useMutation({
        mutationFn: (data: Record<string, any>) => api.post('/material-requests', data),
        onSuccess: () => onCreateSuccess('Solicitação criada', 'material-requests'),
        onError: () => toast.error('Erro ao criar solicitação'),
    });

    const createTag = useMutation({
        mutationFn: (data: Record<string, any>) => api.post('/asset-tags', data),
        onSuccess: () => onCreateSuccess('Tag criada', 'asset-tags'),
        onError: () => toast.error('Erro ao criar tag'),
    });

    const createRma = useMutation({
        mutationFn: (data: Record<string, any>) => api.post('/rma', data),
        onSuccess: () => onCreateSuccess('RMA criado', 'rma-requests'),
        onError: () => toast.error('Erro ao criar RMA'),
    });

    const createDisposal = useMutation({
        mutationFn: (data: Record<string, any>) => api.post('/stock-disposals', data),
        onSuccess: () => onCreateSuccess('Descarte criado', 'stock-disposals'),
        onError: () => toast.error('Erro ao criar descarte'),
    });

    const handleCreate = () => {
        const buildItems = () => {
            const items: Record<string, any>[] = [];
            if (form._item_product_id && form._item_qty) {
                items.push({
                    product_id: Number(form._item_product_id),
                    quantity: Number(form._item_qty),
                    quantity_requested: Number(form._item_qty),
                    specifications: form._item_specs ?? undefined,
                    defect_description: form._item_defect ?? undefined,
                });
            }
            return items;
        };

        const items = buildItems();
        const { _item_product_id, _item_qty, _item_specs, _item_defect, ...rest } = form;

        const payloads: Record<Tab, Record<string, any>> = {
            quotes: { title: rest.title, notes: rest.notes, deadline: rest.deadline, items },
            requests: { priority: rest.priority ?? 'normal', justification: rest.justification, items },
            tags: { tag_code: rest.tag_code, tag_type: rest.tag_type ?? 'qrcode', taggable_type: rest.taggable_type ?? 'App\\Models\\Product', taggable_id: Number(rest.taggable_id), location: rest.location },
            rma: { type: rest.type ?? 'customer_return', reason: rest.reason, items },
            disposal: { disposal_type: rest.disposal_type ?? 'expired', disposal_method: rest.disposal_method ?? 'recycling', justification: rest.justification, items },
        };

        const mutations: Record<Tab, typeof createQuote> = {
            quotes: createQuote, requests: createRequest, tags: createTag,
            rma: createRma, disposal: createDisposal,
        };
        mutations[activeTab].mutate(payloads[activeTab]);
    };

    const handleConfirmAction = () => {
        if (!confirmAction) return;
        const { id, status, type } = confirmAction;
        const mutations = {
            quote: updateQuoteStatus, request: updateRequestStatus,
            rma: updateRmaStatus, disposal: updateDisposalStatus,
        };
        mutations[type].mutate({ id, status });
        setConfirmAction(null);
    };

    const isCreating = createQuote.isPending || createRequest.isPending || createTag.isPending || createRma.isPending || createDisposal.isPending;

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
                <h1 className="text-2xl font-bold text-surface-900">Integração de Estoque</h1>
            </div>

            <div className="flex flex-wrap gap-1 p-1 bg-surface-100 rounded-xl">
                {tabs.map(tab => (
                    <button
                        key={tab.key}
                        onClick={() => { setActiveTab(tab.key); setSearch(''); setPage(1); }}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition ${activeTab === tab.key ? 'bg-surface-0 shadow-sm text-surface-900' : 'text-surface-600 hover:text-surface-900'
                            }`}
                    >
                        <tab.icon className={`h-4 w-4 ${activeTab === tab.key ? tab.color : ''}`} />
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Search + Novo */}
            <div className="flex items-center gap-3">
                <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-surface-400" />
                    <input
                        type="text"
                        placeholder="Buscar..."
                        value={search}
                        onChange={e => { setSearch(e.target.value); setPage(1); }}
                        className="w-full pl-10 pr-4 py-2 border border-default rounded-lg focus:ring-2 focus:ring-indigo-500"
                    />
                </div>
                <Button onClick={() => { setForm({}); setCreateOpen(true); }} icon={<Plus className="h-4 w-4" />}>
                    Novo
                </Button>
            </div>

            {isLoading && (
                <div className="flex justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
                </div>
            )}

            {activeTab === 'quotes' && !quotesLoading && (
                <div className="bg-surface-0 rounded-xl shadow-card overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-subtle">
                            <thead className="bg-surface-50">
                                <tr>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-surface-500 uppercase">Ref</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-surface-500 uppercase">Título</th>
                                    <th className="px-4 py-3 text-center text-xs font-medium text-surface-500 uppercase">Itens</th>
                                    <th className="px-4 py-3 text-center text-xs font-medium text-surface-500 uppercase">Fornecedores</th>
                                    <th className="px-4 py-3 text-center text-xs font-medium text-surface-500 uppercase">Prazo</th>
                                    <th className="px-4 py-3 text-center text-xs font-medium text-surface-500 uppercase">Status</th>
                                    <th className="px-4 py-3 text-center text-xs font-medium text-surface-500 uppercase">Ações</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-surface-100">
                                {(quotesData?.data ?? []).length === 0 && (
                                    <tr><td colSpan={7} className="px-4 py-12 text-center text-surface-400">
                                        <ShoppingCart className="h-8 w-8 mx-auto mb-2 text-surface-300" />Nenhuma cotação
                                    </td></tr>
                                )}
                                {(quotesData?.data ?? []).map((q: any) => (
                                    <tr key={q.id} className="hover:bg-surface-50">
                                        <td className="px-4 py-3 text-sm font-mono">{q.reference}</td>
                                        <td className="px-4 py-3 text-sm font-medium">{q.title}</td>
                                        <td className="px-4 py-3 text-sm text-center">{q.items?.length ?? 0}</td>
                                        <td className="px-4 py-3 text-sm text-center">{q.suppliers?.length ?? 0}</td>
                                        <td className="px-4 py-3 text-sm text-center">{formatDate(q.deadline)}</td>
                                        <td className="px-4 py-3 text-center"><StatusBadge status={q.status} /></td>
                                        <td className="px-4 py-3 text-center">
                                            <div className="flex justify-center gap-1">
                                                <button title="Ver detalhes" onClick={() => setDetailItem(q)} className="p-1.5 text-surface-500 hover:bg-surface-100 rounded"><Eye className="h-4 w-4" /></button>
                                                {q.status === 'draft' && (
                                                    <button title="Enviar" onClick={() => updateQuoteStatus.mutate({ id: q.id, status: 'sent' })} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded"><Check className="h-4 w-4" /></button>
                                                )}
                                                {q.status !== 'cancelled' && (
                                                    <button title="Cancelar" onClick={() => setConfirmAction({ id: q.id, status: 'cancelled', label: 'cancelar esta cotação', type: 'quote' })} className="p-1.5 text-red-600 hover:bg-red-50 rounded"><X className="h-4 w-4" /></button>
                                                )}
                                                {(q.status === 'draft' || q.status === 'cancelled') && (
                                                    <button title="Excluir" onClick={() => setDeleteConfirm({ id: q.id, label: q.title || q.reference })} className="p-1.5 text-red-600 hover:bg-red-50 rounded"><Trash2 className="h-4 w-4" /></button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    <PaginationControls data={quotesData} page={page} onPageChange={setPage} />
                </div>
            )}

            {activeTab === 'requests' && !requestsLoading && (
                <div className="bg-surface-0 rounded-xl shadow-card overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-subtle">
                            <thead className="bg-surface-50">
                                <tr>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-surface-500 uppercase">Ref</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-surface-500 uppercase">Solicitante</th>
                                    <th className="px-4 py-3 text-center text-xs font-medium text-surface-500 uppercase">Itens</th>
                                    <th className="px-4 py-3 text-center text-xs font-medium text-surface-500 uppercase">Prioridade</th>
                                    <th className="px-4 py-3 text-center text-xs font-medium text-surface-500 uppercase">Status</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-surface-500 uppercase">Data</th>
                                    <th className="px-4 py-3 text-center text-xs font-medium text-surface-500 uppercase">Ações</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-subtle">
                                {(requestsData?.data ?? []).length === 0 && (
                                    <tr><td colSpan={7} className="px-4 py-12 text-center text-surface-400">
                                        <PackageSearch className="h-8 w-8 mx-auto mb-2 text-surface-300" />Nenhuma solicitação
                                    </td></tr>
                                )}
                                {(requestsData?.data ?? []).map((r: any) => (
                                    <tr key={r.id} className="hover:bg-surface-50">
                                        <td className="px-4 py-3 text-sm font-mono">{r.reference}</td>
                                        <td className="px-4 py-3 text-sm">{r.requester?.name ?? '—'}</td>
                                        <td className="px-4 py-3 text-sm text-center">{r.items?.length ?? 0}</td>
                                        <td className="px-4 py-3 text-center">
                                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${r.priority === 'urgent' ? 'bg-red-100 text-red-700' :
                                                r.priority === 'high' ? 'bg-orange-100 text-orange-700' :
                                                    r.priority === 'normal' ? 'bg-blue-100 text-blue-700' : 'bg-surface-100 text-surface-700'
                                                }`}>{r.priority === 'urgent' ? 'Urgente' : r.priority === 'high' ? 'Alta' : r.priority === 'normal' ? 'Normal' : 'Baixa'}</span>
                                        </td>
                                        <td className="px-4 py-3 text-center"><StatusBadge status={r.status} /></td>
                                        <td className="px-4 py-3 text-sm">{formatDate(r.created_at)}</td>
                                        <td className="px-4 py-3 text-center">
                                            <div className="flex justify-center gap-1">
                                                <button title="Ver detalhes" onClick={() => setDetailItem(r)} className="p-1.5 text-surface-500 hover:bg-surface-100 rounded"><Eye className="h-4 w-4" /></button>
                                                {r.status === 'pending' && (
                                                    <>
                                                        <button title="Aprovar" onClick={() => updateRequestStatus.mutate({ id: r.id, status: 'approved' })} className="p-1.5 text-green-600 hover:bg-green-50 rounded"><Check className="h-4 w-4" /></button>
                                                        <button title="Rejeitar" onClick={() => setConfirmAction({ id: r.id, status: 'rejected', label: 'rejeitar esta solicitação', type: 'request' })} className="p-1.5 text-red-600 hover:bg-red-50 rounded"><X className="h-4 w-4" /></button>
                                                    </>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    <PaginationControls data={requestsData} page={page} onPageChange={setPage} />
                </div>
            )}

            {activeTab === 'tags' && !tagsLoading && (
                <div className="bg-surface-0 rounded-xl shadow-card overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-subtle">
                            <thead className="bg-surface-50">
                                <tr>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-surface-500 uppercase">Código</th>
                                    <th className="px-4 py-3 text-center text-xs font-medium text-surface-500 uppercase">Tipo</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-surface-500 uppercase">Localização</th>
                                    <th className="px-4 py-3 text-center text-xs font-medium text-surface-500 uppercase">Status</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-surface-500 uppercase">Última Leitura</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-surface-500 uppercase">Por</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-subtle">
                                {(tagsData?.data ?? []).length === 0 && (
                                    <tr><td colSpan={6} className="px-4 py-12 text-center text-surface-400">
                                        <QrCode className="h-8 w-8 mx-auto mb-2 text-surface-300" />Nenhuma tag
                                    </td></tr>
                                )}
                                {(tagsData?.data ?? []).map((t: any) => (
                                    <tr key={t.id} className="hover:bg-surface-50">
                                        <td className="px-4 py-3 text-sm font-mono font-medium">{t.tag_code}</td>
                                        <td className="px-4 py-3 text-center">
                                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${t.tag_type === 'rfid' ? 'bg-purple-100 text-purple-700' :
                                                t.tag_type === 'qrcode' ? 'bg-teal-100 text-teal-700' : 'bg-surface-100 text-surface-700'
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
                    <PaginationControls data={tagsData} page={page} onPageChange={setPage} />
                </div>
            )}

            {activeTab === 'rma' && !rmaLoading && (
                <div className="bg-surface-0 rounded-xl shadow-card overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-subtle">
                            <thead className="bg-surface-50">
                                <tr>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-surface-500 uppercase">Nº RMA</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-surface-500 uppercase">Tipo</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-surface-500 uppercase">Cliente</th>
                                    <th className="px-4 py-3 text-center text-xs font-medium text-surface-500 uppercase">Itens</th>
                                    <th className="px-4 py-3 text-center text-xs font-medium text-surface-500 uppercase">Status</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-surface-500 uppercase">Data</th>
                                    <th className="px-4 py-3 text-center text-xs font-medium text-surface-500 uppercase">Ações</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-surface-100">
                                {(rmaData?.data ?? []).length === 0 && (
                                    <tr><td colSpan={7} className="px-4 py-12 text-center text-surface-400">
                                        <RotateCcw className="h-8 w-8 mx-auto mb-2 text-surface-300" />Nenhum RMA
                                    </td></tr>
                                )}
                                {(rmaData?.data ?? []).map((r: any) => (
                                    <tr key={r.id} className="hover:bg-surface-50">
                                        <td className="px-4 py-3 text-sm font-mono font-medium">{r.rma_number}</td>
                                        <td className="px-4 py-3 text-sm">{r.type === 'customer_return' ? 'Cliente' : 'Fornecedor'}</td>
                                        <td className="px-4 py-3 text-sm">{r.customer?.name ?? '—'}</td>
                                        <td className="px-4 py-3 text-sm text-center">{r.items?.length ?? 0}</td>
                                        <td className="px-4 py-3 text-center"><StatusBadge status={r.status} /></td>
                                        <td className="px-4 py-3 text-sm">{formatDate(r.created_at)}</td>
                                        <td className="px-4 py-3 text-center">
                                            <div className="flex justify-center gap-1">
                                                <button title="Ver detalhes" onClick={() => setDetailItem(r)} className="p-1.5 text-surface-500 hover:bg-surface-100 rounded"><Eye className="h-4 w-4" /></button>
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
                    <PaginationControls data={rmaData} page={page} onPageChange={setPage} />
                </div>
            )}

            {activeTab === 'disposal' && !disposalLoading && (
                <div className="bg-surface-0 rounded-xl shadow-card overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-subtle">
                            <thead className="bg-surface-50">
                                <tr>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-surface-500 uppercase">Ref</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-surface-500 uppercase">Tipo</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-surface-500 uppercase">Método</th>
                                    <th className="px-4 py-3 text-center text-xs font-medium text-surface-500 uppercase">Itens</th>
                                    <th className="px-4 py-3 text-center text-xs font-medium text-surface-500 uppercase">Status</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-surface-500 uppercase">Data</th>
                                    <th className="px-4 py-3 text-center text-xs font-medium text-surface-500 uppercase">Ações</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-surface-100">
                                {(disposalData?.data ?? []).length === 0 && (
                                    <tr><td colSpan={7} className="px-4 py-12 text-center text-surface-400">
                                        <Trash2 className="h-8 w-8 mx-auto mb-2 text-surface-300" />Nenhum descarte
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
                                        <tr key={d.id} className="hover:bg-surface-50">
                                            <td className="px-4 py-3 text-sm font-mono font-medium">{d.reference}</td>
                                            <td className="px-4 py-3 text-sm">{typeLabels[d.disposal_type] ?? d.disposal_type}</td>
                                            <td className="px-4 py-3 text-sm">{methodLabels[d.disposal_method] ?? d.disposal_method}</td>
                                            <td className="px-4 py-3 text-sm text-center">{d.items?.length ?? 0}</td>
                                            <td className="px-4 py-3 text-center"><StatusBadge status={d.status} /></td>
                                            <td className="px-4 py-3 text-sm">{formatDate(d.created_at)}</td>
                                            <td className="px-4 py-3 text-center">
                                                <div className="flex justify-center gap-1">
                                                    <button title="Ver detalhes" onClick={() => setDetailItem(d)} className="p-1.5 text-surface-500 hover:bg-surface-100 rounded"><Eye className="h-4 w-4" /></button>
                                                    {d.status === 'pending' && (
                                                        <button title="Aprovar" onClick={() => updateDisposalStatus.mutate({ id: d.id, status: 'approved' })} className="p-1.5 text-green-600 hover:bg-green-50 rounded"><Check className="h-4 w-4" /></button>
                                                    )}
                                                    {d.status === 'approved' && (
                                                        <button title="Concluir" onClick={() => updateDisposalStatus.mutate({ id: d.id, status: 'completed' })} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded"><Check className="h-4 w-4" /></button>
                                                    )}
                                                    {d.status !== 'completed' && d.status !== 'cancelled' && (
                                                        <button title="Cancelar" onClick={() => setConfirmAction({ id: d.id, status: 'cancelled', label: 'cancelar este descarte', type: 'disposal' })} className="p-1.5 text-red-600 hover:bg-red-50 rounded"><X className="h-4 w-4" /></button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                    <PaginationControls data={disposalData} page={page} onPageChange={setPage} />
                </div>
            )}

            {/* ═══ Create Modal ═══ */}
            <Modal
                open={createOpen}
                onClose={() => { setCreateOpen(false); setForm({}); }}
                title={createTitles[activeTab]}
            >
                <div className="space-y-4">
                    {activeTab === 'quotes' && (
                        <>
                            <Input label="Título" value={form.title ?? ''} onChange={e => updateForm('title', e.target.value)} placeholder="Título da cotação" />
                            <Input label="Prazo" type="date" value={form.deadline ?? ''} onChange={e => updateForm('deadline', e.target.value)} />
                            <Input label="Observações" value={form.notes ?? ''} onChange={e => updateForm('notes', e.target.value)} placeholder="Observações (opcional)" />
                            <div className="border border-default rounded-lg p-3 space-y-2 bg-surface-50">
                                <p className="text-xs font-semibold text-surface-500 uppercase">Item da Cotação</p>
                                <div className="space-y-1.5">
                                    <label className="block text-[13px] font-medium text-surface-700">Produto</label>
                                    <select
                                        value={form._item_product_id ?? ''}
                                        onChange={e => updateForm('_item_product_id', e.target.value)}
                                        className="w-full rounded-md border border-default bg-surface-50 px-3 py-2 text-sm text-surface-900 focus:outline-none focus:ring-2 focus:ring-brand-500/15 focus:border-brand-400"
                                        title="Selecionar produto"
                                    >
                                        <option value="">Selecione um produto...</option>
                                        {productOptions.map(p => <option key={p.id} value={p.id}>{p.name} {p.code ? `(${p.code})` : ''}</option>)}
                                    </select>
                                </div>
                                <Input label="Quantidade" type="number" step="0.01" min="0.01" value={form._item_qty ?? ''} onChange={e => updateForm('_item_qty', e.target.value)} placeholder="Quantidade" />
                                <Input label="Especificações" value={form._item_specs ?? ''} onChange={e => updateForm('_item_specs', e.target.value)} placeholder="Especificações (opcional)" />
                            </div>
                        </>
                    )}
                    {activeTab === 'requests' && (
                        <>
                            <div className="space-y-1.5">
                                <label htmlFor="sel-priority" className="block text-[13px] font-medium text-surface-700">Prioridade</label>
                                <select
                                    id="sel-priority"
                                    value={form.priority ?? 'normal'}
                                    onChange={e => updateForm('priority', e.target.value)}
                                    className="w-full rounded-md border border-default bg-surface-50 px-3 py-2 text-sm text-surface-900 focus:outline-none focus:ring-2 focus:ring-brand-500/15 focus:border-brand-400"
                                >
                                    <option value="low">Baixa</option>
                                    <option value="normal">Normal</option>
                                    <option value="high">Alta</option>
                                    <option value="urgent">Urgente</option>
                                </select>
                            </div>
                            <Input label="Justificativa" value={form.justification ?? ''} onChange={e => updateForm('justification', e.target.value)} placeholder="Justificativa da solicitação" />
                            <div className="border border-default rounded-lg p-3 space-y-2 bg-surface-50">
                                <p className="text-xs font-semibold text-surface-500 uppercase">Item Solicitado</p>
                                <Input label="ID do Produto" type="number" value={form._item_product_id ?? ''} onChange={e => updateForm('_item_product_id', e.target.value)} placeholder="ID do produto" />
                                <Input label="Quantidade" type="number" step="0.01" min="0.01" value={form._item_qty ?? ''} onChange={e => updateForm('_item_qty', e.target.value)} placeholder="Quantidade" />
                            </div>
                        </>
                    )}
                    {activeTab === 'tags' && (
                        <>
                            <Input label="Código da Tag" value={form.tag_code ?? ''} onChange={e => updateForm('tag_code', e.target.value)} placeholder="Ex: TAG-001" />
                            <div className="space-y-1.5">
                                <label htmlFor="sel-tag-type" className="block text-[13px] font-medium text-surface-700">Tipo</label>
                                <select
                                    id="sel-tag-type"
                                    value={form.tag_type ?? 'qrcode'}
                                    onChange={e => updateForm('tag_type', e.target.value)}
                                    className="w-full rounded-md border border-default bg-surface-50 px-3 py-2 text-sm text-surface-900 focus:outline-none focus:ring-2 focus:ring-brand-500/15 focus:border-brand-400"
                                >
                                    <option value="rfid">RFID</option>
                                    <option value="qrcode">QR Code</option>
                                    <option value="barcode">Código de Barras</option>
                                </select>
                            </div>
                            <div className="space-y-1.5">
                                <label htmlFor="sel-taggable-type" className="block text-[13px] font-medium text-surface-700">Tipo de Recurso</label>
                                <select
                                    id="sel-taggable-type"
                                    value={form.taggable_type ?? 'App\\Models\\Product'}
                                    onChange={e => updateForm('taggable_type', e.target.value)}
                                    className="w-full rounded-md border border-default bg-surface-50 px-3 py-2 text-sm text-surface-900 focus:outline-none focus:ring-2 focus:ring-brand-500/15 focus:border-brand-400"
                                >
                                    <option value="App\Models\Product">Produto</option>
                                    <option value="App\Models\Equipment">Equipamento</option>
                                </select>
                            </div>
                            <Input label="ID do Recurso" type="number" value={form.taggable_id ?? ''} onChange={e => updateForm('taggable_id', e.target.value)} placeholder="ID do produto ou equipamento" />
                            <Input label="Localização" value={form.location ?? ''} onChange={e => updateForm('location', e.target.value)} placeholder="Ex: Almoxarifado A" />
                        </>
                    )}
                    {activeTab === 'rma' && (
                        <>
                            <div className="space-y-1.5">
                                <label htmlFor="sel-rma-type" className="block text-[13px] font-medium text-surface-700">Tipo</label>
                                <select
                                    id="sel-rma-type"
                                    value={form.type ?? 'customer_return'}
                                    onChange={e => updateForm('type', e.target.value)}
                                    className="w-full rounded-md border border-default bg-surface-50 px-3 py-2 text-sm text-surface-900 focus:outline-none focus:ring-2 focus:ring-brand-500/15 focus:border-brand-400"
                                >
                                    <option value="customer_return">Devolução de Cliente</option>
                                    <option value="supplier_return">Devolução para Fornecedor</option>
                                </select>
                            </div>
                            <Input label="Motivo" value={form.reason ?? ''} onChange={e => updateForm('reason', e.target.value)} placeholder="Motivo da devolução" />
                            <div className="border border-default rounded-lg p-3 space-y-2 bg-surface-50">
                                <p className="text-xs font-semibold text-surface-500 uppercase">Item</p>
                                <Input label="ID do Produto" type="number" value={form._item_product_id ?? ''} onChange={e => updateForm('_item_product_id', e.target.value)} placeholder="ID do produto" />
                                <Input label="Quantidade" type="number" step="0.01" min="0.01" value={form._item_qty ?? ''} onChange={e => updateForm('_item_qty', e.target.value)} placeholder="Quantidade" />
                                <Input label="Descrição do Defeito" value={form._item_defect ?? ''} onChange={e => updateForm('_item_defect', e.target.value)} placeholder="Descreva o defeito (opcional)" />
                            </div>
                        </>
                    )}
                    {activeTab === 'disposal' && (
                        <>
                            <div className="space-y-1.5">
                                <label htmlFor="sel-disposal-type" className="block text-[13px] font-medium text-surface-700">Tipo de Descarte</label>
                                <select
                                    id="sel-disposal-type"
                                    value={form.disposal_type ?? 'expired'}
                                    onChange={e => updateForm('disposal_type', e.target.value)}
                                    className="w-full rounded-md border border-default bg-surface-50 px-3 py-2 text-sm text-surface-900 focus:outline-none focus:ring-2 focus:ring-brand-500/15 focus:border-brand-400"
                                >
                                    <option value="expired">Vencido</option>
                                    <option value="damaged">Danificado</option>
                                    <option value="obsolete">Obsoleto</option>
                                    <option value="recalled">Recolhido</option>
                                    <option value="hazardous">Perigoso</option>
                                    <option value="other">Outro</option>
                                </select>
                            </div>
                            <div className="space-y-1.5">
                                <label htmlFor="sel-disposal-method" className="block text-[13px] font-medium text-surface-700">Método de Descarte</label>
                                <select
                                    id="sel-disposal-method"
                                    value={form.disposal_method ?? 'recycling'}
                                    onChange={e => updateForm('disposal_method', e.target.value)}
                                    className="w-full rounded-md border border-default bg-surface-50 px-3 py-2 text-sm text-surface-900 focus:outline-none focus:ring-2 focus:ring-brand-500/15 focus:border-brand-400"
                                >
                                    <option value="recycling">Reciclagem</option>
                                    <option value="incineration">Incineração</option>
                                    <option value="landfill">Aterro</option>
                                    <option value="donation">Doação</option>
                                    <option value="return_manufacturer">Devolver ao Fabricante</option>
                                    <option value="specialized_treatment">Tratamento Especializado</option>
                                </select>
                            </div>
                            <Input label="Justificativa" value={form.justification ?? ''} onChange={e => updateForm('justification', e.target.value)} placeholder="Justificativa do descarte" />
                            <div className="border border-default rounded-lg p-3 space-y-2 bg-surface-50">
                                <p className="text-xs font-semibold text-surface-500 uppercase">Item para Descarte</p>
                                <Input label="ID do Produto" type="number" value={form._item_product_id ?? ''} onChange={e => updateForm('_item_product_id', e.target.value)} placeholder="ID do produto" />
                                <Input label="Quantidade" type="number" step="0.01" min="0.01" value={form._item_qty ?? ''} onChange={e => updateForm('_item_qty', e.target.value)} placeholder="Quantidade" />
                            </div>
                        </>
                    )}
                </div>
                <div className="flex justify-end gap-2 mt-6">
                    <Button variant="outline" onClick={() => { setCreateOpen(false); setForm({}); }}>Cancelar</Button>
                    <Button onClick={handleCreate} loading={isCreating}>Salvar</Button>
                </div>
            </Modal>

            {/* ═══ Confirmation Modal ═══ */}
            <Modal
                open={!!confirmAction}
                onClose={() => setConfirmAction(null)}
                title="Confirmar Ação"
                size="sm"
            >
                <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 p-2 bg-red-50 rounded-full">
                        <AlertTriangle className="h-5 w-5 text-red-600" />
                    </div>
                    <p className="text-sm text-surface-600 pt-1.5">
                        Tem certeza que deseja <strong>{confirmAction?.label}</strong>? Esta ação não pode ser desfeita.
                    </p>
                </div>
                <div className="flex justify-end gap-2 mt-6">
                    <Button variant="outline" onClick={() => setConfirmAction(null)}>Voltar</Button>
                    <Button variant="danger" onClick={handleConfirmAction}>Confirmar</Button>
                </div>
            </Modal>

            {/* ═══ Detail Modal ═══ */}
            <Modal
                open={!!detailItem}
                onClose={() => setDetailItem(null)}
                title={`Detalhes — ${detailItem?.reference ?? detailItem?.rma_number ?? detailItem?.tag_code ?? '#' + detailItem?.id}`}
                size="lg"
            >
                {detailItem && (
                    <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-3">
                            {detailItem.title && <div className="bg-surface-50 p-3 rounded-lg"><p className="text-xs text-surface-400 mb-0.5">Título</p><p className="font-medium text-sm">{detailItem.title}</p></div>}
                            {detailItem.reference && <div className="bg-surface-50 p-3 rounded-lg"><p className="text-xs text-surface-400 mb-0.5">Referência</p><p className="font-mono text-sm">{detailItem.reference}</p></div>}
                            {detailItem.rma_number && <div className="bg-surface-50 p-3 rounded-lg"><p className="text-xs text-surface-400 mb-0.5">Nº RMA</p><p className="font-mono text-sm">{detailItem.rma_number}</p></div>}
                            {detailItem.status && <div className="bg-surface-50 p-3 rounded-lg"><p className="text-xs text-surface-400 mb-0.5">Status</p><StatusBadge status={detailItem.status} /></div>}
                            {detailItem.priority && <div className="bg-surface-50 p-3 rounded-lg"><p className="text-xs text-surface-400 mb-0.5">Prioridade</p><p className="text-sm font-medium capitalize">{detailItem.priority}</p></div>}
                            {detailItem.deadline && <div className="bg-surface-50 p-3 rounded-lg"><p className="text-xs text-surface-400 mb-0.5">Prazo</p><p className="text-sm">{formatDate(detailItem.deadline)}</p></div>}
                            {detailItem.type && <div className="bg-surface-50 p-3 rounded-lg"><p className="text-xs text-surface-400 mb-0.5">Tipo</p><p className="text-sm capitalize">{detailItem.type?.replace(/_/g, ' ')}</p></div>}
                            {detailItem.created_at && <div className="bg-surface-50 p-3 rounded-lg"><p className="text-xs text-surface-400 mb-0.5">Criado em</p><p className="text-sm">{formatDate(detailItem.created_at)}</p></div>}
                            {detailItem.requester?.name && <div className="bg-surface-50 p-3 rounded-lg"><p className="text-xs text-surface-400 mb-0.5">Solicitante</p><p className="text-sm">{detailItem.requester.name}</p></div>}
                            {detailItem.customer?.name && <div className="bg-surface-50 p-3 rounded-lg"><p className="text-xs text-surface-400 mb-0.5">Cliente</p><p className="text-sm">{detailItem.customer.name}</p></div>}
                        </div>
                        {(detailItem.notes || detailItem.reason || detailItem.justification) && (
                            <div className="bg-surface-50 p-3 rounded-lg">
                                <p className="text-xs text-surface-400 mb-0.5">{detailItem.reason ? 'Motivo' : detailItem.justification ? 'Justificativa' : 'Observações'}</p>
                                <p className="text-sm text-surface-700">{detailItem.notes || detailItem.reason || detailItem.justification}</p>
                            </div>
                        )}
                        {detailItem.items?.length > 0 && (
                            <div>
                                <h4 className="text-xs font-bold text-surface-400 uppercase mb-2">Itens ({detailItem.items.length})</h4>
                                <div className="border border-default rounded-lg divide-y divide-default overflow-hidden">
                                    {detailItem.items.map((item: any, idx: number) => (
                                        <div key={idx} className="p-3 flex items-center justify-between hover:bg-surface-50/50">
                                            <div className="flex items-center gap-2">
                                                <Package className="h-4 w-4 text-surface-400" />
                                                <div>
                                                    <p className="text-sm font-medium">{item.product?.name ?? `Produto #${item.product_id}`}</p>
                                                    {item.specifications && <p className="text-xs text-surface-400">{item.specifications}</p>}
                                                    {item.defect_description && <p className="text-xs text-red-500">{item.defect_description}</p>}
                                                </div>
                                            </div>
                                            <span className="text-sm font-bold">{item.quantity ?? item.quantity_requested ?? '—'}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                        {detailItem.suppliers?.length > 0 && (
                            <div>
                                <h4 className="text-xs font-bold text-surface-400 uppercase mb-2">Fornecedores ({detailItem.suppliers.length})</h4>
                                <div className="border border-default rounded-lg divide-y divide-default overflow-hidden">
                                    {detailItem.suppliers.map((s: any, idx: number) => (
                                        <div key={idx} className="p-3 flex items-center justify-between hover:bg-surface-50/50">
                                            <p className="text-sm font-medium">{s.supplier?.name ?? `Fornecedor #${s.supplier_id}`}</p>
                                            <StatusBadge status={s.status} />
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </Modal>

            {/* Modal confirmação de exclusão */}
            <Modal open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)} title="Confirmar Exclusão" size="sm">
                <div className="space-y-4 pt-2">
                    <p className="text-sm text-surface-600">
                        Tem certeza que deseja excluir a cotação <strong>{deleteConfirm?.label}</strong>? Esta ação não pode ser desfeita.
                    </p>
                    <div className="flex items-center justify-end gap-3 border-t border-subtle pt-4">
                        <Button variant="outline" onClick={() => setDeleteConfirm(null)}>Cancelar</Button>
                        <Button
                            variant="destructive"
                            loading={deleteQuoteMut.isPending}
                            onClick={() => { if (deleteConfirm) deleteQuoteMut.mutate(deleteConfirm.id) }}
                        >
                            Excluir
                        </Button>
                    </div>
                </div>
            </Modal>
        </div>
    );
}
