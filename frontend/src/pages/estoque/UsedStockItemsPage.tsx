import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import api from '@/lib/api';
import { useAuthStore } from '@/stores/auth-store';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/ui/pageheader';
import {
    Package, Loader2, Search, Eye, Check, RotateCcw, Trash2,
    ChevronLeft, ChevronRight, AlertTriangle, Filter,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const statusConfig: Record<string, { label: string; class: string }> = {
    pending_return: { label: 'Pend. Retorno', class: 'bg-yellow-100 text-yellow-700' },
    pending_confirmation: { label: 'Pend. Confirmação', class: 'bg-orange-100 text-orange-700' },
    returned: { label: 'Devolvido', class: 'bg-green-100 text-green-700' },
    written_off_no_return: { label: 'Baixado', class: 'bg-red-100 text-red-700' },
};

const formatDate = (d: string) => d ? new Date(d).toLocaleDateString('pt-BR') : '—';

export default function UsedStockItemsPage() {
    const { hasPermission } = useAuthStore();
    const canManage = hasPermission('estoque.movement.create');
    const queryClient = useQueryClient();

    const [statusFilter, setStatusFilter] = useState('');
    const [page, setPage] = useState(1);
    const [detailItem, setDetailItem] = useState<any>(null);
    const [reportModal, setReportModal] = useState<any>(null);
    const [reportDisposition, setReportDisposition] = useState<'return' | 'write_off'>('return');
    const [reportNotes, setReportNotes] = useState('');
    const [confirmAction, setConfirmAction] = useState<{
        id: number; type: 'confirm-return' | 'confirm-write-off'; label: string;
    } | null>(null);

    const { data, isLoading } = useQuery({
        queryKey: ['used-stock-items', statusFilter, page],
        queryFn: () => api.get('/stock/used-items', {
            params: { status: statusFilter || undefined, page, per_page: 20 },
        }).then(r => r.data),
    });

    const reportMutation = useMutation({
        mutationFn: ({ id, disposition_type, disposition_notes }: any) =>
            api.post(`/stock/used-items/${id}/report`, { disposition_type, disposition_notes }),
        onSuccess: () => {
            toast.success('Informação registrada');
            queryClient.invalidateQueries({ queryKey: ['used-stock-items'] });
            setReportModal(null);
            setReportNotes('');
        },
        onError: () => toast.error('Erro ao registrar informação'),
    });

    const confirmReturnMutation = useMutation({
        mutationFn: (id: number) => api.post(`/stock/used-items/${id}/confirm-return`),
        onSuccess: () => {
            toast.success('Devolução confirmada e estoque atualizado');
            queryClient.invalidateQueries({ queryKey: ['used-stock-items'] });
            setConfirmAction(null);
        },
        onError: () => toast.error('Erro ao confirmar devolução'),
    });

    const confirmWriteOffMutation = useMutation({
        mutationFn: (id: number) => api.post(`/stock/used-items/${id}/confirm-write-off`),
        onSuccess: () => {
            toast.success('Baixa registrada');
            queryClient.invalidateQueries({ queryKey: ['used-stock-items'] });
            setConfirmAction(null);
        },
        onError: () => toast.error('Erro ao confirmar baixa'),
    });

    const items = data?.data ?? [];
    const lastPage = data?.last_page ?? 1;
    const total = data?.total ?? 0;

    const handleReport = () => {
        if (!reportModal) return;
        reportMutation.mutate({
            id: reportModal.id,
            disposition_type: reportDisposition,
            disposition_notes: reportNotes || undefined,
        });
    };

    const handleConfirmAction = () => {
        if (!confirmAction) return;
        if (confirmAction.type === 'confirm-return') {
            confirmReturnMutation.mutate(confirmAction.id);
        } else {
            confirmWriteOffMutation.mutate(confirmAction.id);
        }
    };

    return (
        <div className="space-y-6">
            <PageHeader
                title="Peças Usadas em OS"
                description="Controle de peças/materiais utilizados em ordens de serviço pelo técnico"
                icon={Package}
            />

            {/* Filtros */}
            <div className="flex items-center gap-3 flex-wrap">
                <div className="flex items-center gap-2">
                    <Filter className="h-4 w-4 text-surface-400" />
                    <select
                        value={statusFilter}
                        onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
                        className="rounded-md border border-default bg-surface-0 px-3 py-2 text-sm"
                        title="Filtrar por status"
                    >
                        <option value="">Todos os status</option>
                        <option value="pending_return">Pendente retorno</option>
                        <option value="pending_confirmation">Pend. confirmação</option>
                        <option value="returned">Devolvido</option>
                        <option value="written_off_no_return">Baixado</option>
                    </select>
                </div>
                <span className="text-xs text-surface-400">{total} registros</span>
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
                                    <th className="px-4 py-3 text-left text-xs font-medium text-surface-500 uppercase">Produto</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-surface-500 uppercase">OS</th>
                                    <th className="px-4 py-3 text-center text-xs font-medium text-surface-500 uppercase">Qtd</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-surface-500 uppercase">Técnico</th>
                                    <th className="px-4 py-3 text-center text-xs font-medium text-surface-500 uppercase">Status</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-surface-500 uppercase">Data</th>
                                    <th className="px-4 py-3 text-center text-xs font-medium text-surface-500 uppercase">Ações</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-surface-100">
                                {items.length === 0 && (
                                    <tr><td colSpan={7} className="px-4 py-12 text-center text-surface-400">
                                        <Package className="h-8 w-8 mx-auto mb-2 text-surface-300" />
                                        Nenhuma peça usada encontrada
                                    </td></tr>
                                )}
                                {items.map((item: any) => (
                                    <tr key={item.id} className="hover:bg-surface-50">
                                        <td className="px-4 py-3">
                                            <div className="text-sm font-medium">{item.product?.name ?? '—'}</div>
                                            {item.product?.code && <div className="text-xs text-surface-400">{item.product.code}</div>}
                                        </td>
                                        <td className="px-4 py-3 text-sm font-mono">{item.work_order?.os_number ?? item.work_order?.number ?? '—'}</td>
                                        <td className="px-4 py-3 text-sm text-center font-bold">{item.quantity}</td>
                                        <td className="px-4 py-3 text-sm">{item.technician_warehouse?.user?.name ?? '—'}</td>
                                        <td className="px-4 py-3 text-center">
                                            <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium',
                                                statusConfig[item.status]?.class ?? 'bg-surface-100 text-surface-600'
                                            )}>
                                                {statusConfig[item.status]?.label ?? item.status}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-sm">{formatDate(item.created_at)}</td>
                                        <td className="px-4 py-3 text-center">
                                            <div className="flex justify-center gap-1">
                                                <button title="Ver detalhes" onClick={() => setDetailItem(item)} className="p-1.5 text-surface-500 hover:bg-surface-100 rounded">
                                                    <Eye className="h-4 w-4" />
                                                </button>
                                                {canManage && item.status === 'pending_return' && (
                                                    <button title="Informar disposição" onClick={() => { setReportModal(item); setReportDisposition('return'); setReportNotes(''); }}
                                                        className="p-1.5 text-blue-600 hover:bg-blue-50 rounded">
                                                        <RotateCcw className="h-4 w-4" />
                                                    </button>
                                                )}
                                                {canManage && item.status === 'pending_confirmation' && item.disposition_type === 'return' && (
                                                    <button title="Confirmar devolução" onClick={() => setConfirmAction({ id: item.id, type: 'confirm-return', label: 'confirmar a devolução desta peça' })}
                                                        className="p-1.5 text-green-600 hover:bg-green-50 rounded">
                                                        <Check className="h-4 w-4" />
                                                    </button>
                                                )}
                                                {canManage && item.status === 'pending_confirmation' && item.disposition_type === 'write_off' && (
                                                    <button title="Confirmar baixa" onClick={() => setConfirmAction({ id: item.id, type: 'confirm-write-off', label: 'confirmar a baixa sem devolução' })}
                                                        className="p-1.5 text-orange-600 hover:bg-orange-50 rounded">
                                                        <Trash2 className="h-4 w-4" />
                                                    </button>
                                                )}
                                            </div>
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
            <Modal open={!!detailItem} onClose={() => setDetailItem(null)} title="Detalhes da Peça Usada" size="md">
                {detailItem && (
                    <div className="space-y-3">
                        <div className="grid grid-cols-2 gap-3">
                            <div className="bg-surface-50 p-3 rounded-lg"><p className="text-xs text-surface-400 mb-0.5">Produto</p><p className="text-sm font-medium">{detailItem.product?.name ?? '—'}</p></div>
                            <div className="bg-surface-50 p-3 rounded-lg"><p className="text-xs text-surface-400 mb-0.5">Quantidade</p><p className="text-sm font-bold">{detailItem.quantity}</p></div>
                            <div className="bg-surface-50 p-3 rounded-lg"><p className="text-xs text-surface-400 mb-0.5">OS</p><p className="text-sm font-mono">{detailItem.work_order?.os_number ?? '—'}</p></div>
                            <div className="bg-surface-50 p-3 rounded-lg"><p className="text-xs text-surface-400 mb-0.5">Status</p><span className={cn('px-2 py-0.5 rounded-full text-xs font-medium', statusConfig[detailItem.status]?.class ?? 'bg-surface-100')}>{statusConfig[detailItem.status]?.label ?? detailItem.status}</span></div>
                            <div className="bg-surface-50 p-3 rounded-lg"><p className="text-xs text-surface-400 mb-0.5">Técnico</p><p className="text-sm">{detailItem.technician_warehouse?.user?.name ?? '—'}</p></div>
                            <div className="bg-surface-50 p-3 rounded-lg"><p className="text-xs text-surface-400 mb-0.5">Data</p><p className="text-sm">{formatDate(detailItem.created_at)}</p></div>
                        </div>
                        {detailItem.disposition_type && (
                            <div className="bg-surface-50 p-3 rounded-lg">
                                <p className="text-xs text-surface-400 mb-0.5">Disposição</p>
                                <p className="text-sm font-medium">{detailItem.disposition_type === 'return' ? 'Devolução' : 'Baixa sem devolução'}</p>
                                {detailItem.disposition_notes && <p className="text-xs text-surface-500 mt-1">{detailItem.disposition_notes}</p>}
                            </div>
                        )}
                        {detailItem.reported_at && (
                            <div className="grid grid-cols-2 gap-3">
                                <div className="bg-surface-50 p-3 rounded-lg"><p className="text-xs text-surface-400 mb-0.5">Informado em</p><p className="text-sm">{formatDate(detailItem.reported_at)}</p></div>
                                {detailItem.confirmed_at && <div className="bg-surface-50 p-3 rounded-lg"><p className="text-xs text-surface-400 mb-0.5">Confirmado em</p><p className="text-sm">{formatDate(detailItem.confirmed_at)}</p></div>}
                            </div>
                        )}
                    </div>
                )}
            </Modal>

            {/* Report Modal */}
            <Modal open={!!reportModal} onClose={() => setReportModal(null)} title="Informar Disposição" size="sm">
                <div className="space-y-4">
                    <p className="text-sm text-surface-600">
                        Informe o destino da peça <strong>{reportModal?.product?.name}</strong> (Qtd: {reportModal?.quantity}).
                    </p>
                    <div className="space-y-1.5">
                        <label className="block text-[13px] font-medium text-surface-700">Tipo</label>
                        <select
                            value={reportDisposition}
                            onChange={e => setReportDisposition(e.target.value as any)}
                            className="w-full rounded-md border border-default bg-surface-50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/15"
                            title="Tipo de disposição"
                        >
                            <option value="return">Devolução ao estoque</option>
                            <option value="write_off">Baixa (cliente ficou / descarte)</option>
                        </select>
                    </div>
                    <div className="space-y-1.5">
                        <label className="block text-[13px] font-medium text-surface-700">Observações</label>
                        <textarea
                            value={reportNotes}
                            onChange={e => setReportNotes(e.target.value)}
                            rows={3}
                            className="w-full rounded-md border border-default bg-surface-50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/15"
                            placeholder="Observações opcionais..."
                        />
                    </div>
                </div>
                <div className="flex justify-end gap-2 mt-6">
                    <Button variant="outline" onClick={() => setReportModal(null)}>Cancelar</Button>
                    <Button onClick={handleReport} loading={reportMutation.isPending}>Registrar</Button>
                </div>
            </Modal>

            {/* Confirm Modal */}
            <Modal open={!!confirmAction} onClose={() => setConfirmAction(null)} title="Confirmar Ação" size="sm">
                <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 p-2 bg-amber-50 rounded-full">
                        <AlertTriangle className="h-5 w-5 text-amber-600" />
                    </div>
                    <p className="text-sm text-surface-600 pt-1.5">
                        Tem certeza que deseja <strong>{confirmAction?.label}</strong>?
                    </p>
                </div>
                <div className="flex justify-end gap-2 mt-6">
                    <Button variant="outline" onClick={() => setConfirmAction(null)}>Voltar</Button>
                    <Button onClick={handleConfirmAction} loading={confirmReturnMutation.isPending || confirmWriteOffMutation.isPending}>Confirmar</Button>
                </div>
            </Modal>
        </div>
    );
}
