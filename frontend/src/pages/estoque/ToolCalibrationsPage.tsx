import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'
import { PageHeader } from '@/components/ui/pageheader'
import { EmptyState } from '@/components/ui/emptystate'
import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'
import { Wrench, Plus, AlertTriangle, CheckCircle2, Pencil, Trash2, Search } from 'lucide-react'
import { useAuthStore } from '@/stores/auth-store'

interface ToolCalibration {
    id: number
    inventory_item_id: number
    calibration_date: string
    next_due_date: string | null
    certificate_number: string | null
    laboratory: string | null
    result: string
    cost: number | null
    notes: string | null
    item_name?: string
}

interface Product {
    id: number
    name: string
}

type ResultFilter = 'all' | 'approved' | 'rejected'

const emptyForm = {
    inventory_item_id: '',
    calibration_date: new Date().toISOString().split('T')[0],
    next_due_date: '',
    certificate_number: '',
    laboratory: '',
    result: 'approved',
    cost: '',
    notes: '',
}

export default function ToolCalibrationsPage() {
    const queryClient = useQueryClient()
    const { hasPermission } = useAuthStore()
    const canManage = hasPermission('estoque.manage')
    const [showFormModal, setShowFormModal] = useState(false)
    const [editingId, setEditingId] = useState<number | null>(null)
    const [deleteTarget, setDeleteTarget] = useState<ToolCalibration | null>(null)
    const [search, setSearch] = useState('')
    const [resultFilter, setResultFilter] = useState<ResultFilter>('all')
    const [form, setForm] = useState(emptyForm)

    const { data, isLoading } = useQuery<ToolCalibration[]>({
        queryKey: ['tool-calibrations'],
        queryFn: () => api.get('/tool-calibrations').then(r => r.data.data ?? r.data),
    })

    const { data: expiringData } = useQuery<ToolCalibration[]>({
        queryKey: ['tool-calibrations-expiring'],
        queryFn: () => api.get('/tool-calibrations/expiring').then(r => r.data.data ?? r.data),
    })

    const { data: productsData } = useQuery<Product[]>({
        queryKey: ['products-for-calibration'],
        queryFn: () => api.get('/products', { params: { per_page: 200 } }).then(r => r.data.data ?? r.data),
    })

    const products = productsData ?? []

    const invalidateCalibrations = () => {
        queryClient.invalidateQueries({ queryKey: ['tool-calibrations'] })
        queryClient.invalidateQueries({ queryKey: ['tool-calibrations-expiring'] })
    }

    const resetAndCloseForm = () => {
        setShowFormModal(false)
        setEditingId(null)
        setForm(emptyForm)
    }

    const createMutation = useMutation({
        mutationFn: (payload: typeof form) => api.post('/tool-calibrations', payload),
        onSuccess: () => {
            toast.success('Calibração registrada com sucesso')
            invalidateCalibrations()
            resetAndCloseForm()
        },
        onError: () => toast.error('Erro ao registrar calibração'),
    })

    const updateMutation = useMutation({
        mutationFn: ({ id, payload }: { id: number; payload: typeof form }) =>
            api.put(`/tool-calibrations/${id}`, payload),
        onSuccess: () => {
            toast.success('Calibração atualizada com sucesso')
            invalidateCalibrations()
            resetAndCloseForm()
        },
        onError: () => toast.error('Erro ao atualizar calibração'),
    })

    const deleteMutation = useMutation({
        mutationFn: (id: number) => api.delete(`/tool-calibrations/${id}`),
        onSuccess: () => {
            toast.success('Calibração excluída com sucesso')
            invalidateCalibrations()
            setDeleteTarget(null)
        },
        onError: () => toast.error('Erro ao excluir calibração'),
    })

    const handleSubmit = () => {
        if (editingId) {
            updateMutation.mutate({ id: editingId, payload: form })
        } else {
            createMutation.mutate(form)
        }
    }

    const handleEdit = (c: ToolCalibration) => {
        setEditingId(c.id)
        setForm({
            inventory_item_id: String(c.inventory_item_id),
            calibration_date: c.calibration_date?.split('T')[0] ?? '',
            next_due_date: c.next_due_date?.split('T')[0] ?? '',
            certificate_number: c.certificate_number ?? '',
            laboratory: c.laboratory ?? '',
            result: c.result,
            cost: c.cost ? String(c.cost) : '',
            notes: c.notes ?? '',
        })
        setShowFormModal(true)
    }

    const handleOpenCreate = () => {
        setEditingId(null)
        setForm(emptyForm)
        setShowFormModal(true)
    }

    const isSaving = createMutation.isPending || updateMutation.isPending

    const calibrations = data ?? []
    const expiring = expiringData ?? []

    const filteredCalibrations = useMemo(() => {
        let list = calibrations

        if (resultFilter !== 'all') {
            list = list.filter(c => c.result === resultFilter)
        }

        if (search.trim()) {
            const q = search.toLowerCase()
            list = list.filter(c =>
                (c.item_name ?? '').toLowerCase().includes(q) ||
                (c.certificate_number ?? '').toLowerCase().includes(q) ||
                (c.laboratory ?? '').toLowerCase().includes(q)
            )
        }

        return list
    }, [calibrations, resultFilter, search])

    return (
        <div className="space-y-6">
            <PageHeader
                title="Calibração de Ferramentas"
                subtitle="Registro de calibrações de ferramentas e instrumentos do estoque"
                action={canManage ? (
                    <Button onClick={handleOpenCreate} icon={<Plus className="h-4 w-4" />}>
                        Registrar Calibração
                    </Button>
                ) : undefined}
            />

            {expiring.length > 0 && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                    <div className="flex items-center gap-2 text-sm font-medium text-amber-700">
                        <AlertTriangle className="h-4 w-4" />
                        {expiring.length} ferramenta(s) com calibração vencendo nos próximos 30 dias
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2">
                        {expiring.slice(0, 5).map(e => (
                            <span key={e.id} className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-800 dark:bg-amber-900 dark:text-amber-300">
                                {e.item_name ?? `Item #${e.inventory_item_id}`} — {e.next_due_date ? new Date(e.next_due_date).toLocaleDateString('pt-BR') : ''}
                            </span>
                        ))}
                        {expiring.length > 5 && (
                            <span className="text-xs text-amber-600">+{expiring.length - 5} mais</span>
                        )}
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div className="rounded-xl border bg-card p-4">
                    <div className="text-sm text-muted-foreground">Total Calibrações</div>
                    <div className="mt-1 text-2xl font-bold">{calibrations.length}</div>
                </div>
                <div className="rounded-xl border bg-card p-4">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <CheckCircle2 className="h-4 w-4 text-emerald-500" /> Aprovadas
                    </div>
                    <div className="mt-1 text-2xl font-bold text-emerald-600">
                        {calibrations.filter(c => c.result === 'approved').length}
                    </div>
                </div>
                <div className="rounded-xl border bg-card p-4">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <AlertTriangle className="h-4 w-4 text-amber-500" /> Vencendo
                    </div>
                    <div className="mt-1 text-2xl font-bold text-amber-600">{expiring.length}</div>
                </div>
            </div>

            {/* Search and filters */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="relative max-w-sm flex-1">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-surface-400" />
                    <Input
                        placeholder="Buscar por ferramenta, certificado ou laboratório..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        className="pl-9"
                    />
                </div>
                <div className="flex gap-1.5">
                    {([
                        { key: 'all', label: 'Todos' },
                        { key: 'approved', label: 'Aprovados' },
                        { key: 'rejected', label: 'Reprovados' },
                    ] as const).map(f => (
                        <Button
                            key={f.key}
                            variant={resultFilter === f.key ? 'primary' : 'outline'}
                            size="sm"
                            onClick={() => setResultFilter(f.key)}
                        >
                            {f.label}
                        </Button>
                    ))}
                </div>
            </div>

            {isLoading ? (
                <div className="flex justify-center py-12 text-muted-foreground">Carregando...</div>
            ) : filteredCalibrations.length === 0 ? (
                <EmptyState
                    icon={Wrench}
                    title="Nenhuma calibração"
                    description={search || resultFilter !== 'all'
                        ? 'Nenhuma calibração encontrada com os filtros aplicados.'
                        : 'Nenhuma calibração de ferramenta foi registrada.'}
                />
            ) : (
                <div className="overflow-x-auto rounded-xl border bg-card">
                    <table className="w-full text-sm">
                        <thead className="border-b bg-muted/50">
                            <tr>
                                <th className="p-3 text-left font-medium">Ferramenta</th>
                                <th className="p-3 text-left font-medium">Data</th>
                                <th className="p-3 text-left font-medium">Próx. Vencimento</th>
                                <th className="p-3 text-left font-medium">Certificado</th>
                                <th className="p-3 text-left font-medium">Laboratório</th>
                                <th className="p-3 text-center font-medium">Resultado</th>
                                <th className="p-3 text-right font-medium">Custo</th>
                                <th className="p-3 text-center font-medium">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y">
                            {filteredCalibrations.map(c => {
                                const isExpiring = c.next_due_date && new Date(c.next_due_date) < new Date(new Date().getTime() + 30 * 86400000)
                                return (
                                    <tr key={c.id}>
                                        <td className="p-3 font-medium">{c.item_name ?? `Item #${c.inventory_item_id}`}</td>
                                        <td className="p-3 text-xs">{new Date(c.calibration_date).toLocaleDateString('pt-BR')}</td>
                                        <td className="p-3 text-xs">
                                            {c.next_due_date ? (
                                                <span className={isExpiring ? 'font-medium text-amber-600' : ''}>
                                                    {new Date(c.next_due_date).toLocaleDateString('pt-BR')}
                                                </span>
                                            ) : '—'}
                                        </td>
                                        <td className="p-3 text-xs">{c.certificate_number ?? '—'}</td>
                                        <td className="p-3 text-xs">{c.laboratory ?? '—'}</td>
                                        <td className="p-3 text-center">
                                            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${c.result === 'approved'
                                                ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30'
                                                : 'bg-red-100 text-red-700 dark:bg-red-900/30'
                                                }`}>
                                                {c.result === 'approved' ? 'Aprovado' : 'Reprovado'}
                                            </span>
                                        </td>
                                        <td className="p-3 text-right text-xs">
                                            {c.cost ? `R$ ${Number(c.cost).toFixed(2).replace('.', ',')}` : '—'}
                                        </td>
                                        <td className="p-3">
                                            <div className="flex items-center justify-center gap-1">
                                                {canManage && (
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        onClick={() => handleEdit(c)}
                                                        title="Editar"
                                                    >
                                                        <Pencil className="h-3.5 w-3.5" />
                                                    </Button>
                                                )}
                                                {canManage && (
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        onClick={() => setDeleteTarget(c)}
                                                        title="Excluir"
                                                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                                    >
                                                        <Trash2 className="h-3.5 w-3.5" />
                                                    </Button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Form Modal (Create / Edit) */}
            <Modal
                open={showFormModal}
                onClose={resetAndCloseForm}
                title={editingId ? 'Editar Calibração' : 'Registrar Calibração de Ferramenta'}
                size="lg"
                footer={
                    <div className="flex justify-end gap-3">
                        <Button variant="outline" onClick={resetAndCloseForm}>
                            Cancelar
                        </Button>
                        <Button
                            onClick={handleSubmit}
                            loading={isSaving}
                            disabled={!form.inventory_item_id}
                        >
                            {editingId ? 'Salvar Alterações' : 'Registrar'}
                        </Button>
                    </div>
                }
            >
                <div className="grid grid-cols-2 gap-4">
                    <div className="col-span-2 space-y-1.5">
                        <label htmlFor="cal-product" className="block text-[13px] font-medium text-surface-700">Produto / Ferramenta</label>
                        <select
                            id="cal-product"
                            className="w-full rounded-md border border-default bg-surface-50 px-3 py-2 text-sm text-surface-900 focus:outline-none focus:ring-2 focus:ring-brand-500/15 focus:border-brand-400 transition-all duration-150"
                            value={form.inventory_item_id}
                            onChange={e => setForm(p => ({ ...p, inventory_item_id: e.target.value }))}
                        >
                            <option value="">Selecione um produto...</option>
                            {products.map(p => (
                                <option key={p.id} value={p.id}>{p.name}</option>
                            ))}
                        </select>
                    </div>
                    <Input
                        label="Data da Calibração"
                        type="date"
                        value={form.calibration_date}
                        onChange={e => setForm(p => ({ ...p, calibration_date: e.target.value }))}
                    />
                    <Input
                        label="Próximo Vencimento"
                        type="date"
                        value={form.next_due_date}
                        onChange={e => setForm(p => ({ ...p, next_due_date: e.target.value }))}
                    />
                    <Input
                        label="Nº Certificado"
                        value={form.certificate_number}
                        onChange={e => setForm(p => ({ ...p, certificate_number: e.target.value }))}
                    />
                    <Input
                        label="Laboratório"
                        value={form.laboratory}
                        onChange={e => setForm(p => ({ ...p, laboratory: e.target.value }))}
                    />
                    <div className="space-y-1.5">
                        <label htmlFor="cal-result" className="block text-[13px] font-medium text-surface-700">Resultado</label>
                        <select
                            id="cal-result"
                            className="w-full rounded-md border border-default bg-surface-50 px-3 py-2 text-sm text-surface-900 focus:outline-none focus:ring-2 focus:ring-brand-500/15 focus:border-brand-400 transition-all duration-150"
                            value={form.result}
                            onChange={e => setForm(p => ({ ...p, result: e.target.value }))}
                        >
                            <option value="approved">Aprovado</option>
                            <option value="rejected">Reprovado</option>
                        </select>
                    </div>
                    <Input
                        label="Custo (R$)"
                        type="number"
                        step="0.01"
                        value={form.cost}
                        onChange={e => setForm(p => ({ ...p, cost: e.target.value }))}
                    />
                    <div className="col-span-2 space-y-1.5">
                        <label htmlFor="cal-notes" className="block text-[13px] font-medium text-surface-700">Observações</label>
                        <textarea
                            id="cal-notes"
                            className="w-full rounded-md border border-default bg-surface-50 px-3 py-2 text-sm text-surface-900 focus:outline-none focus:ring-2 focus:ring-brand-500/15 focus:border-brand-400 transition-all duration-150"
                            value={form.notes}
                            onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
                            rows={2}
                        />
                    </div>
                </div>
            </Modal>

            {/* Delete Confirmation Modal */}
            <Modal
                open={!!deleteTarget}
                onClose={() => setDeleteTarget(null)}
                title="Confirmar Exclusão"
                size="sm"
                footer={
                    <div className="flex justify-end gap-3">
                        <Button variant="outline" onClick={() => setDeleteTarget(null)}>
                            Cancelar
                        </Button>
                        <Button
                            variant="danger"
                            loading={deleteMutation.isPending}
                            onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
                        >
                            Excluir
                        </Button>
                    </div>
                }
            >
                <p className="text-sm text-surface-600">
                    Tem certeza que deseja excluir a calibração de{' '}
                    <strong>{deleteTarget?.item_name ?? `Item #${deleteTarget?.inventory_item_id}`}</strong>?
                    Esta ação não pode ser desfeita.
                </p>
            </Modal>
        </div>
    )
}
