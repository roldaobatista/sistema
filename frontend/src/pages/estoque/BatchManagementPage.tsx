import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Package, Search, Plus, Calendar, BarChart3, AlertTriangle, CheckCircle2, Loader2, Edit2, Trash2 } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Modal } from '@/components/ui/modal'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import api from '@/lib/api'
import { useAuthStore } from '@/stores/auth-store'

interface Batch {
    id: number
    code?: string
    batch_number?: string
    product_id: number
    product?: { id: number; name: string; code?: string }
    expires_at: string | null
    manufacturing_date?: string | null
    cost_price?: number
    status?: string
    created_at?: string
}

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
    active: { label: 'Ativo', color: 'bg-emerald-100 text-emerald-700' },
    expired: { label: 'Vencido', color: 'bg-red-100 text-red-700' },
    quarantine: { label: 'Quarentena', color: 'bg-amber-100 text-amber-700' },
    consumed: { label: 'Consumido', color: 'bg-surface-100 text-surface-600' },
}

const emptyForm = {
    product_id: '' as string | number,
    batch_number: '',
    manufacturing_date: '',
    expires_at: '',
}

export default function BatchManagementPage() {
    const { hasPermission } = useAuthStore()
    const canManage = hasPermission('estoque.manage')
    const qc = useQueryClient()
    const [search, setSearch] = useState('')
    const [statusFilter, setStatusFilter] = useState<string>('all')
    const [showForm, setShowForm] = useState(false)
    const [editing, setEditing] = useState<Batch | null>(null)
    const [form, setForm] = useState(emptyForm)
    const [deleteConfirm, setDeleteConfirm] = useState<Batch | null>(null)
    const [page, setPage] = useState(1)

    const { data: res, isLoading } = useQuery({
        queryKey: ['batches', search, statusFilter, page],
        queryFn: () => api.get('/batches', {
            params: {
                search: search || undefined,
                active_only: statusFilter === 'active' ? true : statusFilter === 'all' ? undefined : false,
                page,
                per_page: 25,
            },
        }),
    })
    const batches: Batch[] = res?.data?.data ?? []
    const pagination = { last_page: res?.data?.last_page ?? 1, current_page: res?.data?.current_page ?? 1, total: res?.data?.total ?? 0 }

    const { data: productsRes } = useQuery({
        queryKey: ['products-for-batch'],
        queryFn: () => api.get('/products', { params: { per_page: 200 } }),
    })
    const products = productsRes?.data?.data ?? []

    const saveMut = useMutation({
        mutationFn: (data: typeof form) =>
            editing
                ? api.put(`/batches/${editing.id}`, data)
                : api.post('/batches', data),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['batches'] })
            toast.success(editing ? 'Lote atualizado!' : 'Lote criado!')
            setShowForm(false)
            setEditing(null)
            setForm(emptyForm)
        },
        onError: (err: any) => toast.error(err?.response?.data?.message || 'Erro ao salvar lote'),
    })

    const deleteMut = useMutation({
        mutationFn: (id: number) => api.delete(`/batches/${id}`),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['batches'] })
            toast.success('Lote excluído!')
            setDeleteConfirm(null)
        },
        onError: (err: any) => toast.error(err?.response?.data?.message || 'Erro ao excluir lote'),
    })

    const handleEdit = (b: Batch) => {
        setEditing(b)
        setForm({
            product_id: b.product_id,
            batch_number: b.batch_number || b.code || '',
            manufacturing_date: b.manufacturing_date || '',
            expires_at: b.expires_at || '',
        })
        setShowForm(true)
    }

    const getBatchStatus = (b: Batch): string => {
        if (b.expires_at && new Date(b.expires_at) < new Date()) return 'expired'
        return 'active'
    }

    const filteredBatches = batches.filter(b => {
        if (statusFilter === 'all') return true
        return getBatchStatus(b) === statusFilter
    })

    const activeCount = batches.filter(b => getBatchStatus(b) === 'active').length
    const expiredCount = batches.filter(b => getBatchStatus(b) === 'expired').length

    return (
        <div className="p-6 space-y-6 max-w-7xl mx-auto">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-surface-900 flex items-center gap-2">
                        <Package className="w-6 h-6 text-brand-600" />
                        Gestão de Lotes
                    </h1>
                    <p className="text-sm text-surface-500 mt-1">Controle de lotes de produtos com rastreabilidade e validade</p>
                </div>
                {canManage && (
                    <Button onClick={() => { setEditing(null); setForm(emptyForm); setShowForm(true) }} className="gap-2">
                        <Plus className="w-4 h-4" />
                        Novo Lote
                    </Button>
                )}
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400" />
                    <Input
                        placeholder="Buscar por código do lote..."
                        value={search}
                        onChange={e => { setSearch(e.target.value); setPage(1) }}
                        className="pl-10"
                    />
                </div>
                <div className="flex gap-2 flex-wrap">
                    {['all', 'active', 'expired'].map(s => (
                        <button
                            key={s}
                            onClick={() => { setStatusFilter(s); setPage(1) }}
                            className={cn(
                                'px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
                                statusFilter === s
                                    ? 'bg-brand-600 text-white'
                                    : 'bg-surface-100 text-surface-600 hover:bg-surface-200'
                            )}
                        >
                            {s === 'all' ? 'Todos' : STATUS_CONFIG[s]?.label || s}
                        </button>
                    ))}
                </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                    { label: 'Total de Lotes', value: pagination.total, icon: Package, color: 'text-brand-600' },
                    { label: 'Ativos', value: activeCount, icon: CheckCircle2, color: 'text-emerald-600' },
                    { label: 'Vencidos', value: expiredCount, icon: AlertTriangle, color: 'text-red-600' },
                    { label: 'Nesta Página', value: batches.length, icon: BarChart3, color: 'text-amber-600' },
                ].map(stat => (
                    <div key={stat.label} className="bg-surface-0 rounded-xl p-4 border border-default">
                        <div className="flex items-center gap-2 mb-2">
                            <stat.icon className={cn('w-4 h-4', stat.color)} />
                            <span className="text-xs text-surface-500">{stat.label}</span>
                        </div>
                        <p className="text-2xl font-bold text-surface-900">{stat.value}</p>
                    </div>
                ))}
            </div>

            <div className="bg-surface-0 rounded-xl border border-default overflow-hidden shadow-card">
                {isLoading ? (
                    <div className="flex justify-center py-12">
                        <Loader2 className="h-8 w-8 animate-spin text-brand-500" />
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-subtle bg-surface-50">
                                    <th className="text-left px-4 py-3 text-xs font-semibold text-surface-500 uppercase">Código</th>
                                    <th className="text-left px-4 py-3 text-xs font-semibold text-surface-500 uppercase">Produto</th>
                                    <th className="text-left px-4 py-3 text-xs font-semibold text-surface-500 uppercase">Fabricação</th>
                                    <th className="text-left px-4 py-3 text-xs font-semibold text-surface-500 uppercase">Validade</th>
                                    <th className="text-left px-4 py-3 text-xs font-semibold text-surface-500 uppercase">Status</th>
                                    <th className="text-right px-4 py-3 text-xs font-semibold text-surface-500 uppercase">Ações</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-subtle">
                                {filteredBatches.map(batch => {
                                    const status = getBatchStatus(batch)
                                    const st = STATUS_CONFIG[status] || STATUS_CONFIG.active
                                    return (
                                        <tr key={batch.id} className="hover:bg-surface-50 transition-colors">
                                            <td className="px-4 py-3 font-mono text-xs font-semibold text-surface-900">
                                                {batch.batch_number || batch.code || `#${batch.id}`}
                                            </td>
                                            <td className="px-4 py-3 text-surface-700">{batch.product?.name || '—'}</td>
                                            <td className="px-4 py-3 text-surface-500 text-xs">
                                                <div className="flex items-center gap-1">
                                                    <Calendar className="w-3.5 h-3.5" />
                                                    {batch.manufacturing_date ? new Date(batch.manufacturing_date).toLocaleDateString('pt-BR') : '—'}
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 text-surface-500 text-xs">
                                                {batch.expires_at ? new Date(batch.expires_at).toLocaleDateString('pt-BR') : 'Sem validade'}
                                            </td>
                                            <td className="px-4 py-3">
                                                <Badge className={cn('text-[10px]', st.color)}>{st.label}</Badge>
                                            </td>
                                            <td className="px-4 py-3 text-right">
                                                <div className="flex items-center justify-end gap-1">
                                                    {canManage && (
                                                        <button onClick={() => handleEdit(batch)} className="p-1.5 rounded-md hover:bg-surface-100 text-surface-500 hover:text-brand-600" title="Editar">
                                                            <Edit2 className="w-3.5 h-3.5" />
                                                        </button>
                                                    )}
                                                    {canManage && (
                                                        <button onClick={() => setDeleteConfirm(batch)} className="p-1.5 rounded-md hover:bg-red-50 text-surface-500 hover:text-red-600" title="Excluir">
                                                            <Trash2 className="w-3.5 h-3.5" />
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    )
                                })}
                                {filteredBatches.length === 0 && (
                                    <tr>
                                        <td colSpan={6} className="text-center py-12 text-surface-400">
                                            <Package className="w-10 h-10 mx-auto mb-2 opacity-40" />
                                            <p>Nenhum lote encontrado</p>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                )}

                {pagination.last_page > 1 && (
                    <div className="flex items-center justify-between border-t border-subtle px-4 py-3">
                        <p className="text-xs text-surface-500">Página {pagination.current_page} de {pagination.last_page} ({pagination.total} registros)</p>
                        <div className="flex gap-1">
                            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Anterior</Button>
                            <Button variant="outline" size="sm" disabled={page >= pagination.last_page} onClick={() => setPage(p => p + 1)}>Próxima</Button>
                        </div>
                    </div>
                )}
            </div>

            <Modal open={showForm} onOpenChange={setShowForm} title={editing ? 'Editar Lote' : 'Novo Lote'} size="md">
                <form onSubmit={e => { e.preventDefault(); saveMut.mutate(form) }} className="space-y-4 pt-2">
                    <div>
                        <label className="mb-1.5 block text-sm font-medium text-surface-700">Produto</label>
                        <select
                            title="Selecionar produto"
                            value={form.product_id}
                            onChange={e => setForm(p => ({ ...p, product_id: e.target.value }))}
                            required
                            disabled={!!editing}
                            className="w-full rounded-lg border border-default bg-surface-50 px-3.5 py-2.5 text-sm focus:border-brand-400 focus:bg-surface-0 focus:outline-none focus:ring-2 focus:ring-brand-500/15 disabled:opacity-60"
                        >
                            <option value="">Selecione um produto</option>
                            {products.map((p: any) => (
                                <option key={p.id} value={p.id}>{p.name}{p.code ? ` (${p.code})` : ''}</option>
                            ))}
                        </select>
                    </div>
                    <Input
                        label="Código do Lote"
                        value={form.batch_number}
                        onChange={e => setForm(p => ({ ...p, batch_number: e.target.value }))}
                        required
                        placeholder="Ex: LOT-2026-001"
                    />
                    <div className="grid grid-cols-2 gap-4">
                        <Input
                            label="Data de Fabricação"
                            type="date"
                            value={form.manufacturing_date}
                            onChange={e => setForm(p => ({ ...p, manufacturing_date: e.target.value }))}
                        />
                        <Input
                            label="Data de Validade"
                            type="date"
                            value={form.expires_at}
                            onChange={e => setForm(p => ({ ...p, expires_at: e.target.value }))}
                        />
                    </div>
                    <div className="flex items-center justify-end gap-3 border-t border-subtle pt-4">
                        <Button variant="outline" type="button" onClick={() => setShowForm(false)}>Cancelar</Button>
                        <Button type="submit" loading={saveMut.isPending}>{editing ? 'Atualizar' : 'Criar Lote'}</Button>
                    </div>
                </form>
            </Modal>

            <Modal open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)} title="Confirmar Exclusão" size="sm">
                <div className="space-y-4 pt-2">
                    <p className="text-sm text-surface-600">
                        Tem certeza que deseja excluir o lote <strong>{deleteConfirm?.batch_number || deleteConfirm?.code}</strong>?
                        Lotes com estoque ativo não podem ser excluídos.
                    </p>
                    <div className="flex items-center justify-end gap-3 border-t border-subtle pt-4">
                        <Button variant="outline" onClick={() => setDeleteConfirm(null)}>Cancelar</Button>
                        <Button
                            variant="destructive"
                            loading={deleteMut.isPending}
                            onClick={() => deleteConfirm && deleteMut.mutate(deleteConfirm.id)}
                        >
                            Excluir
                        </Button>
                    </div>
                </div>
            </Modal>
        </div>
    )
}
