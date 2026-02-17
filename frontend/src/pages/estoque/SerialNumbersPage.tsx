import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import api from '@/lib/api';
import { useAuthStore } from '@/stores/auth-store';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PageHeader } from '@/components/ui/pageheader';
import {
    QrCode, Loader2, Search, Plus, Eye,
    ChevronLeft, ChevronRight, Filter, Package,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const statusConfig: Record<string, { label: string; class: string }> = {
    available: { label: 'Disponível', class: 'bg-green-100 text-green-700' },
    in_use: { label: 'Em uso', class: 'bg-blue-100 text-blue-700' },
    returned: { label: 'Devolvido', class: 'bg-indigo-100 text-indigo-700' },
    defective: { label: 'Defeituoso', class: 'bg-red-100 text-red-700' },
};

const formatDate = (d: string) => d ? new Date(d).toLocaleDateString('pt-BR') : '—';

export default function SerialNumbersPage() {
    const { hasPermission } = useAuthStore();
    const canCreate = hasPermission('estoque.movement.create');
    const queryClient = useQueryClient();

    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [page, setPage] = useState(1);
    const [createOpen, setCreateOpen] = useState(false);
    const [detailItem, setDetailItem] = useState<any>(null);

    // Form
    const [formProductId, setFormProductId] = useState('');
    const [formSerial, setFormSerial] = useState('');
    const [formStatus, setFormStatus] = useState('available');
    const [formNotes, setFormNotes] = useState('');

    const { data, isLoading } = useQuery({
        queryKey: ['serial-numbers', search, statusFilter, page],
        queryFn: () => api.get('/stock/serial-numbers', {
            params: {
                search: search || undefined,
                status: statusFilter || undefined,
                page,
            },
        }).then(r => r.data),
    });

    // Products for selector
    const { data: productsRes } = useQuery({
        queryKey: ['products-for-serial'],
        queryFn: () => api.get('/stock/summary').then(r => r.data),
        enabled: createOpen,
    });
    const productOptions: { id: number; name: string; code?: string }[] = productsRes?.products ?? [];

    const createMutation = useMutation({
        mutationFn: (payload: any) => api.post('/stock/serial-numbers', payload),
        onSuccess: () => {
            toast.success('Número de série registrado');
            queryClient.invalidateQueries({ queryKey: ['serial-numbers'] });
            setCreateOpen(false);
            resetForm();
        },
        onError: (err: any) => {
            toast.error(err?.response?.data?.message || 'Erro ao registrar');
        },
    });

    const resetForm = () => {
        setFormProductId('');
        setFormSerial('');
        setFormStatus('available');
        setFormNotes('');
    };

    const handleCreate = () => {
        if (!formProductId || !formSerial) {
            toast.error('Produto e número de série são obrigatórios');
            return;
        }
        createMutation.mutate({
            product_id: Number(formProductId),
            serial: formSerial,
            status: formStatus,
            notes: formNotes || undefined,
        });
    };

    const items = data?.data ?? [];
    const lastPage = data?.last_page ?? 1;
    const total = data?.total ?? 0;

    return (
        <div className="space-y-6">
            <PageHeader
                title="Números de Série"
                description="Rastreabilidade de produtos por número de série"
                icon={QrCode}
                actions={canCreate ? (
                    <Button onClick={() => { resetForm(); setCreateOpen(true); }} icon={<Plus className="h-4 w-4" />}>
                        Novo Nº de Série
                    </Button>
                ) : undefined}
            />

            {/* Filtros */}
            <div className="flex items-center gap-3 flex-wrap">
                <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-surface-400" />
                    <input
                        type="text"
                        placeholder="Buscar por número de série..."
                        value={search}
                        onChange={e => { setSearch(e.target.value); setPage(1); }}
                        className="w-full pl-10 pr-4 py-2 border border-default rounded-lg text-sm focus:ring-2 focus:ring-brand-500/15"
                    />
                </div>
                <div className="flex items-center gap-2">
                    <Filter className="h-4 w-4 text-surface-400" />
                    <select
                        value={statusFilter}
                        onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
                        className="rounded-md border border-default bg-surface-0 px-3 py-2 text-sm"
                        title="Filtrar por status"
                    >
                        <option value="">Todos os status</option>
                        <option value="available">Disponível</option>
                        <option value="in_use">Em uso</option>
                        <option value="returned">Devolvido</option>
                        <option value="defective">Defeituoso</option>
                    </select>
                </div>
            </div>

            {isLoading && (
                <div className="flex justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-brand-600" />
                </div>
            )}

            {!isLoading && (
                <div className="bg-surface-0 rounded-xl shadow-card overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-subtle">
                            <thead className="bg-surface-50">
                                <tr>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-surface-500 uppercase">Nº Série</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-surface-500 uppercase">Produto</th>
                                    <th className="px-4 py-3 text-center text-xs font-medium text-surface-500 uppercase">Status</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-surface-500 uppercase">Observações</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-surface-500 uppercase">Data</th>
                                    <th className="px-4 py-3 text-center text-xs font-medium text-surface-500 uppercase">Ações</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-surface-100">
                                {items.length === 0 && (
                                    <tr><td colSpan={6} className="px-4 py-12 text-center text-surface-400">
                                        <QrCode className="h-8 w-8 mx-auto mb-2 text-surface-300" />
                                        Nenhum número de série
                                    </td></tr>
                                )}
                                {items.map((item: any) => (
                                    <tr key={item.id} className="hover:bg-surface-50">
                                        <td className="px-4 py-3 text-sm font-mono font-bold">{item.serial}</td>
                                        <td className="px-4 py-3 text-sm">{item.product_name ?? `Produto #${item.product_id}`}</td>
                                        <td className="px-4 py-3 text-center">
                                            <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium',
                                                statusConfig[item.status]?.class ?? 'bg-surface-100 text-surface-600'
                                            )}>
                                                {statusConfig[item.status]?.label ?? item.status}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-sm text-surface-500 max-w-[200px] truncate">{item.notes || '—'}</td>
                                        <td className="px-4 py-3 text-sm">{formatDate(item.created_at)}</td>
                                        <td className="px-4 py-3 text-center">
                                            <button title="Ver detalhes" onClick={() => setDetailItem(item)} className="p-1.5 text-surface-500 hover:bg-surface-100 rounded">
                                                <Eye className="h-4 w-4" />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    {lastPage > 1 && (
                        <div className="flex items-center justify-between px-4 py-3 border-t border-subtle">
                            <span className="text-xs text-surface-500">{total} registros</span>
                            <div className="flex items-center gap-1">
                                <button title="Anterior" disabled={page <= 1} onClick={() => setPage(page - 1)} className="p-1.5 rounded hover:bg-surface-100 disabled:opacity-40"><ChevronLeft className="h-4 w-4" /></button>
                                <span className="text-sm px-2">{page} / {lastPage}</span>
                                <button title="Próxima" disabled={page >= lastPage} onClick={() => setPage(page + 1)} className="p-1.5 rounded hover:bg-surface-100 disabled:opacity-40"><ChevronRight className="h-4 w-4" /></button>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Detail Modal */}
            <Modal open={!!detailItem} onClose={() => setDetailItem(null)} title="Detalhes do Número de Série" size="md">
                {detailItem && (
                    <div className="space-y-3">
                        <div className="grid grid-cols-2 gap-3">
                            <div className="bg-surface-50 p-3 rounded-lg"><p className="text-xs text-surface-400 mb-0.5">Nº Série</p><p className="text-sm font-mono font-bold">{detailItem.serial}</p></div>
                            <div className="bg-surface-50 p-3 rounded-lg"><p className="text-xs text-surface-400 mb-0.5">Status</p><span className={cn('px-2 py-0.5 rounded-full text-xs font-medium', statusConfig[detailItem.status]?.class ?? 'bg-surface-100')}>{statusConfig[detailItem.status]?.label ?? detailItem.status}</span></div>
                            <div className="bg-surface-50 p-3 rounded-lg"><p className="text-xs text-surface-400 mb-0.5">Produto</p><p className="text-sm">{detailItem.product_name ?? `Produto #${detailItem.product_id}`}</p></div>
                            <div className="bg-surface-50 p-3 rounded-lg"><p className="text-xs text-surface-400 mb-0.5">Data</p><p className="text-sm">{formatDate(detailItem.created_at)}</p></div>
                        </div>
                        {detailItem.notes && (
                            <div className="bg-surface-50 p-3 rounded-lg"><p className="text-xs text-surface-400 mb-0.5">Observações</p><p className="text-sm">{detailItem.notes}</p></div>
                        )}
                    </div>
                )}
            </Modal>

            {/* Create Modal */}
            <Modal open={createOpen} onClose={() => { setCreateOpen(false); resetForm(); }} title="Novo Número de Série">
                <div className="space-y-4">
                    <div className="space-y-1.5">
                        <label className="block text-[13px] font-medium text-surface-700">Produto *</label>
                        <select
                            value={formProductId}
                            onChange={e => setFormProductId(e.target.value)}
                            className="w-full rounded-md border border-default bg-surface-50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/15"
                            title="Selecionar produto"
                        >
                            <option value="">Selecione um produto...</option>
                            {productOptions.map(p => <option key={p.id} value={p.id}>{p.name} {p.code ? `(${p.code})` : ''}</option>)}
                        </select>
                    </div>
                    <Input label="Número de Série *" value={formSerial} onChange={e => setFormSerial(e.target.value)} placeholder="Ex: SN-2025-001" />
                    <div className="space-y-1.5">
                        <label className="block text-[13px] font-medium text-surface-700">Status</label>
                        <select
                            value={formStatus}
                            onChange={e => setFormStatus(e.target.value)}
                            className="w-full rounded-md border border-default bg-surface-50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/15"
                            title="Selecionar status"
                        >
                            <option value="available">Disponível</option>
                            <option value="in_use">Em uso</option>
                            <option value="returned">Devolvido</option>
                            <option value="defective">Defeituoso</option>
                        </select>
                    </div>
                    <div className="space-y-1.5">
                        <label className="block text-[13px] font-medium text-surface-700">Observações</label>
                        <textarea
                            value={formNotes}
                            onChange={e => setFormNotes(e.target.value)}
                            rows={3}
                            className="w-full rounded-md border border-default bg-surface-50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/15"
                            placeholder="Observações opcionais..."
                        />
                    </div>
                </div>
                <div className="flex justify-end gap-2 mt-6">
                    <Button variant="outline" onClick={() => { setCreateOpen(false); resetForm(); }}>Cancelar</Button>
                    <Button onClick={handleCreate} loading={createMutation.isPending}>Registrar</Button>
                </div>
            </Modal>
        </div>
    );
}
