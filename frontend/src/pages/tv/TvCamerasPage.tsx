import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import api from '@/lib/api';
import { PageHeader } from '@/components/ui/pageheader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/emptystate';
import {
    Camera as CameraIcon,
    Plus,
    Pencil,
    Trash2,
    GripVertical,
    Wifi,
    WifiOff,
    Loader2,
    CheckCircle,
    XCircle,
    Video,
} from 'lucide-react';
import type { Camera } from '@/types/tv';

const defaultForm: Partial<Camera> = {
    name: '',
    stream_url: '',
    location: '',
    type: 'ip',
    is_active: true,
};

export default function TvCamerasPage() {
    const queryClient = useQueryClient();
    const [showForm, setShowForm] = useState(false);
    const [editing, setEditing] = useState<Camera | null>(null);
    const [form, setForm] = useState<Partial<Camera>>(defaultForm);
    const [showConfirmDelete, setShowConfirmDelete] = useState<Camera | null>(null);
    const [testResult, setTestResult] = useState<'idle' | 'testing' | 'ok' | 'fail'>('idle');

    const { data, isLoading } = useQuery<{ cameras: Camera[] }>({
        queryKey: ['tv-cameras'],
        queryFn: async () => (await api.get('/tv/cameras')).data,
    });

    const cameras = data?.cameras ?? [];

    const saveMut = useMutation({
        mutationFn: async (payload: Partial<Camera>) => {
            if (editing) {
                return (await api.put(`/tv/cameras/${editing.id}`, payload)).data;
            }
            return (await api.post('/tv/cameras', payload)).data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['tv-cameras'] });
            queryClient.invalidateQueries({ queryKey: ['tv-dashboard'] });
            toast.success(editing ? 'Câmera atualizada' : 'Câmera criada');
            closeForm();
        },
        onError: () => toast.error('Erro ao salvar câmera'),
    });

    const deleteMut = useMutation({
        mutationFn: async (id: number) => (await api.delete(`/tv/cameras/${id}`)).data,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['tv-cameras'] });
            queryClient.invalidateQueries({ queryKey: ['tv-dashboard'] });
            toast.success('Câmera removida');
            setShowConfirmDelete(null);
        },
        onError: () => toast.error('Erro ao remover câmera'),
    });

    const reorderMut = useMutation({
        mutationFn: async (order: number[]) => (await api.post('/tv/cameras/reorder', { order })).data,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['tv-cameras'] });
            toast.success('Ordem atualizada');
        },
    });

    const openCreate = () => {
        setEditing(null);
        setForm(defaultForm);
        setTestResult('idle');
        setShowForm(true);
    };

    const openEdit = (cam: Camera) => {
        setEditing(cam);
        setForm({ name: cam.name, stream_url: cam.stream_url, location: cam.location, type: cam.type, is_active: cam.is_active });
        setTestResult('idle');
        setShowForm(true);
    };

    const closeForm = () => {
        setShowForm(false);
        setEditing(null);
        setForm(defaultForm);
        setTestResult('idle');
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        saveMut.mutate(form);
    };

    const handleTestConnection = async () => {
        if (!form.stream_url) return;
        setTestResult('testing');
        try {
            const res = await api.post('/tv/cameras/test-connection', { stream_url: form.stream_url });
            setTestResult(res.data.reachable ? 'ok' : 'fail');
        } catch {
            setTestResult('fail');
        }
    };

    const moveCamera = (index: number, direction: 'up' | 'down') => {
        const order = cameras.map(c => c.id);
        const newIndex = direction === 'up' ? index - 1 : index + 1;
        if (newIndex < 0 || newIndex >= order.length) return;
        [order[index], order[newIndex]] = [order[newIndex], order[index]];
        reorderMut.mutate(order);
    };

    return (
        <div className="space-y-6">
            <PageHeader
                title="Câmeras"
                subtitle="Gerenciamento de câmeras do TV Dashboard"
                icon={Video}
                count={cameras.length}
                actions={[{
                    label: 'Nova Câmera',
                    icon: <Plus className="h-4 w-4" />,
                    onClick: openCreate,
                }]}
            />

            {isLoading ? (
                <div className="flex items-center justify-center py-20">
                    <Loader2 className="h-6 w-6 animate-spin text-surface-400" />
                </div>
            ) : cameras.length === 0 ? (
                <EmptyState
                    icon={CameraIcon}
                    title="Nenhuma câmera cadastrada"
                    description="Adicione câmeras para visualizar no TV Dashboard"
                    action={{ label: 'Adicionar câmera', onClick: openCreate }}
                />
            ) : (
                <div className="rounded-xl border border-default bg-surface-0 overflow-hidden">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-default bg-surface-50">
                                <th className="px-4 py-3 text-left font-medium text-surface-500 w-10">#</th>
                                <th className="px-4 py-3 text-left font-medium text-surface-500">Nome</th>
                                <th className="px-4 py-3 text-left font-medium text-surface-500">URL</th>
                                <th className="px-4 py-3 text-left font-medium text-surface-500">Local</th>
                                <th className="px-4 py-3 text-left font-medium text-surface-500">Tipo</th>
                                <th className="px-4 py-3 text-center font-medium text-surface-500">Status</th>
                                <th className="px-4 py-3 text-center font-medium text-surface-500">Ordem</th>
                                <th className="px-4 py-3 text-right font-medium text-surface-500">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-default">
                            {cameras.map((cam, idx) => (
                                <tr key={cam.id} className="hover:bg-surface-50 transition-colors">
                                    <td className="px-4 py-3 text-surface-400 font-mono text-xs">{idx + 1}</td>
                                    <td className="px-4 py-3 font-medium text-surface-900">{cam.name}</td>
                                    <td className="px-4 py-3 text-surface-500 font-mono text-xs truncate max-w-[200px]" title={cam.stream_url}>
                                        {cam.stream_url}
                                    </td>
                                    <td className="px-4 py-3 text-surface-500">{cam.location || '—'}</td>
                                    <td className="px-4 py-3">
                                        <Badge variant="outline" className="text-xs">{cam.type || 'ip'}</Badge>
                                    </td>
                                    <td className="px-4 py-3 text-center">
                                        {cam.is_active ? (
                                            <Badge className="bg-green-100 text-green-700 text-xs"><Wifi className="h-3 w-3 mr-1" /> Ativa</Badge>
                                        ) : (
                                            <Badge className="bg-neutral-100 text-neutral-500 text-xs"><WifiOff className="h-3 w-3 mr-1" /> Inativa</Badge>
                                        )}
                                    </td>
                                    <td className="px-4 py-3 text-center">
                                        <div className="flex items-center justify-center gap-1">
                                            <button
                                                onClick={() => moveCamera(idx, 'up')}
                                                disabled={idx === 0}
                                                className="p-1 rounded hover:bg-surface-100 disabled:opacity-30 transition-colors"
                                            >
                                                <GripVertical className="h-4 w-4 text-surface-400 rotate-180" />
                                            </button>
                                            <span className="text-xs text-surface-400 font-mono w-6 text-center">{cam.position}</span>
                                            <button
                                                onClick={() => moveCamera(idx, 'down')}
                                                disabled={idx === cameras.length - 1}
                                                className="p-1 rounded hover:bg-surface-100 disabled:opacity-30 transition-colors"
                                            >
                                                <GripVertical className="h-4 w-4 text-surface-400" />
                                            </button>
                                        </div>
                                    </td>
                                    <td className="px-4 py-3 text-right">
                                        <div className="flex items-center justify-end gap-1">
                                            <Button variant="ghost" size="icon" onClick={() => openEdit(cam)}>
                                                <Pencil className="h-4 w-4" />
                                            </Button>
                                            <Button variant="ghost" size="icon" onClick={() => setShowConfirmDelete(cam)}>
                                                <Trash2 className="h-4 w-4 text-red-500" />
                                            </Button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Create/Edit Modal */}
            <Modal
                open={showForm}
                onClose={closeForm}
                title={editing ? 'Editar Câmera' : 'Nova Câmera'}
                size="md"
            >
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="text-sm font-medium text-surface-700 mb-1 block">Nome *</label>
                        <Input
                            value={form.name ?? ''}
                            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                            placeholder="Ex: Recepção Principal"
                            required
                        />
                    </div>

                    <div>
                        <label className="text-sm font-medium text-surface-700 mb-1 block">URL do Stream *</label>
                        <div className="flex gap-2">
                            <Input
                                value={form.stream_url ?? ''}
                                onChange={e => { setForm(f => ({ ...f, stream_url: e.target.value })); setTestResult('idle'); }}
                                placeholder="rtsp://192.168.1.100:554/stream"
                                className="flex-1"
                                required
                            />
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={handleTestConnection}
                                disabled={!form.stream_url || testResult === 'testing'}
                            >
                                {testResult === 'testing' ? <Loader2 className="h-4 w-4 animate-spin" /> :
                                 testResult === 'ok' ? <CheckCircle className="h-4 w-4 text-green-500" /> :
                                 testResult === 'fail' ? <XCircle className="h-4 w-4 text-red-500" /> :
                                 <Wifi className="h-4 w-4" />}
                                <span className="ml-1">Testar</span>
                            </Button>
                        </div>
                        {testResult === 'ok' && <p className="text-xs text-green-600 mt-1">Conexão OK</p>}
                        {testResult === 'fail' && <p className="text-xs text-red-500 mt-1">Não foi possível conectar</p>}
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="text-sm font-medium text-surface-700 mb-1 block">Localização</label>
                            <Input
                                value={form.location ?? ''}
                                onChange={e => setForm(f => ({ ...f, location: e.target.value }))}
                                placeholder="Ex: Galpão A"
                            />
                        </div>
                        <div>
                            <label className="text-sm font-medium text-surface-700 mb-1 block">Tipo</label>
                            <select
                                value={form.type ?? 'ip'}
                                onChange={e => setForm(f => ({ ...f, type: e.target.value }))}
                                className="w-full h-9 rounded-md border border-default bg-surface-0 px-3 text-sm"
                            >
                                <option value="ip">IP</option>
                                <option value="usb">USB</option>
                                <option value="analog">Analógica</option>
                                <option value="wifi">Wi-Fi</option>
                            </select>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <input
                            type="checkbox"
                            id="cam-active"
                            checked={form.is_active ?? true}
                            onChange={e => setForm(f => ({ ...f, is_active: e.target.checked }))}
                            className="rounded border-default"
                        />
                        <label htmlFor="cam-active" className="text-sm text-surface-700">Câmera ativa</label>
                    </div>

                    <div className="flex justify-end gap-2 pt-2">
                        <Button type="button" variant="outline" onClick={closeForm}>Cancelar</Button>
                        <Button type="submit" loading={saveMut.isPending}>
                            {editing ? 'Salvar' : 'Criar'}
                        </Button>
                    </div>
                </form>
            </Modal>

            {/* Delete Confirmation */}
            <Modal
                open={!!showConfirmDelete}
                onClose={() => setShowConfirmDelete(null)}
                title="Remover Câmera"
                size="sm"
            >
                <p className="text-sm text-surface-600">
                    Tem certeza que deseja remover a câmera <strong>{showConfirmDelete?.name}</strong>?
                </p>
                <div className="flex justify-end gap-2 mt-4">
                    <Button variant="outline" onClick={() => setShowConfirmDelete(null)}>Cancelar</Button>
                    <Button
                        variant="danger"
                        loading={deleteMut.isPending}
                        onClick={() => showConfirmDelete && deleteMut.mutate(showConfirmDelete.id)}
                    >
                        Remover
                    </Button>
                </div>
            </Modal>
        </div>
    );
}
