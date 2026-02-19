import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'
import { PageHeader } from '@/components/ui/pageheader'
import { EmptyState } from '@/components/ui/emptystate'
import { toast } from 'sonner'
import { ArrowLeftRight, Plus, RotateCcw, User, Truck } from 'lucide-react'

interface WeightAssignment {
    id: number
    standard_weight_id: number
    assigned_to_type: string
    assigned_to_id: number
    assigned_at: string
    returned_at: string | null
    notes: string | null
    weight?: { code: string; nominal_value: number; unit: string }
    assignee_name?: string
}

export default function WeightAssignmentsPage() {
    const queryClient = useQueryClient()
    const [showDialog, setShowDialog] = useState(false)
    const [form, setForm] = useState({
        standard_weight_id: '',
        assigned_to_type: 'user',
        assigned_to_id: '',
        notes: '',
    })

    const { data, isLoading } = useQuery<WeightAssignment[]>({
        queryKey: ['weight-assignments'],
        queryFn: () => api.get('/weight-assignments').then(r => r.data.data ?? r.data),
    })

    const assignMutation = useMutation({
        mutationFn: (payload: typeof form) => api.post('/weight-assignments', payload),
        onSuccess: () => {
            toast.success('Peso atribuído com sucesso')
            queryClient.invalidateQueries({ queryKey: ['weight-assignments'] })
            setShowDialog(false)
            setForm({ standard_weight_id: '', assigned_to_type: 'user', assigned_to_id: '', notes: '' })
        },
        onError: () => toast.error('Erro ao atribuir peso'),
    })

    const returnMutation = useMutation({
        mutationFn: (id: number) => api.post(`/weight-assignments/${id}/return`),
        onSuccess: () => {
            toast.success('Peso devolvido com sucesso')
            queryClient.invalidateQueries({ queryKey: ['weight-assignments'] })
        },
        onError: () => toast.error('Erro ao devolver peso'),
    })

    const assignments = data ?? []
    const active = assignments.filter(a => !a.returned_at)
    const returned = assignments.filter(a => a.returned_at)

    return (
        <div className="space-y-6">
            <PageHeader
                title="Atribuição de Pesos Padrão"
                subtitle="Controle de empréstimo e devolução de pesos padrão para técnicos e veículos"
                action={
                    <button
                        onClick={() => setShowDialog(true)}
                        className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                    >
                        <Plus className="h-4 w-4" /> Atribuir Peso
                    </button>
                }
            />

            {/* Resumo */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div className="rounded-xl border bg-card p-4">
                    <div className="text-sm text-muted-foreground">Atribuídos</div>
                    <div className="mt-1 text-2xl font-bold text-amber-600">{active.length}</div>
                </div>
                <div className="rounded-xl border bg-card p-4">
                    <div className="text-sm text-muted-foreground">Devolvidos</div>
                    <div className="mt-1 text-2xl font-bold text-emerald-600">{returned.length}</div>
                </div>
                <div className="rounded-xl border bg-card p-4">
                    <div className="text-sm text-muted-foreground">Total Registros</div>
                    <div className="mt-1 text-2xl font-bold">{assignments.length}</div>
                </div>
            </div>

            {/* Tabela */}
            {isLoading ? (
                <div className="flex justify-center py-12 text-muted-foreground">Carregando...</div>
            ) : assignments.length === 0 ? (
                <EmptyState
                    icon={ArrowLeftRight}
                    title="Nenhuma atribuição"
                    description="Nenhum peso padrão foi atribuído ainda."
                />
            ) : (
                <div className="overflow-x-auto rounded-xl border bg-card">
                    <table className="w-full text-sm">
                        <thead className="border-b bg-muted/50">
                            <tr>
                                <th className="p-3 text-left font-medium">Peso Padrão</th>
                                <th className="p-3 text-left font-medium">Tipo</th>
                                <th className="p-3 text-left font-medium">Atribuído a</th>
                                <th className="p-3 text-left font-medium">Data Saída</th>
                                <th className="p-3 text-left font-medium">Data Devolução</th>
                                <th className="p-3 text-left font-medium">Observações</th>
                                <th className="p-3 text-center font-medium">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y">
                            {assignments.map(a => (
                                <tr key={a.id} className={a.returned_at ? 'opacity-60' : ''}>
                                    <td className="p-3 font-medium">
                                        {a.weight?.code ?? `#${a.standard_weight_id}`}
                                        {a.weight && (
                                            <span className="ml-2 text-xs text-muted-foreground">
                                                {a.weight.nominal_value} {a.weight.unit}
                                            </span>
                                        )}
                                    </td>
                                    <td className="p-3">
                                        <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs">
                                            {a.assigned_to_type === 'user' ? <User className="h-3 w-3" /> : <Truck className="h-3 w-3" />}
                                            {a.assigned_to_type === 'user' ? 'Técnico' : 'Veículo'}
                                        </span>
                                    </td>
                                    <td className="p-3">{a.assignee_name ?? `#${a.assigned_to_id}`}</td>
                                    <td className="p-3 text-xs">{new Date(a.assigned_at).toLocaleDateString('pt-BR')}</td>
                                    <td className="p-3 text-xs">
                                        {a.returned_at ? new Date(a.returned_at).toLocaleDateString('pt-BR') : (
                                            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-900/30">
                                                Em campo
                                            </span>
                                        )}
                                    </td>
                                    <td className="p-3 text-xs text-muted-foreground">{a.notes ?? '—'}</td>
                                    <td className="p-3 text-center">
                                        {!a.returned_at && (
                                            <button
                                                onClick={() => returnMutation.mutate(a.id)}
                                                className="inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-xs hover:bg-muted"
                                            >
                                                <RotateCcw className="h-3 w-3" /> Devolver
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Dialog Atribuir */}
            {showDialog && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowDialog(false)}>
                    <div className="w-full max-w-md rounded-xl bg-card p-6 shadow-xl" onClick={e => e.stopPropagation()}>
                        <h3 className="text-lg font-semibold">Atribuir Peso Padrão</h3>
                        <div className="mt-4 space-y-4">
                            <div>
                                <label className="mb-1 block text-sm font-medium">ID do Peso Padrão</label>
                                <input
                                    type="number"
                                    className="w-full rounded-lg border bg-background px-3 py-2 text-sm"
                                    value={form.standard_weight_id}
                                    onChange={e => setForm(p => ({ ...p, standard_weight_id: e.target.value }))}
                                    placeholder="ID do peso padrão"
                                />
                            </div>
                            <div>
                                <label className="mb-1 block text-sm font-medium">Tipo</label>
                                <select
                                    aria-label="Tipo de atribuição"
                                    className="w-full rounded-lg border bg-background px-3 py-2 text-sm"
                                    value={form.assigned_to_type}
                                    onChange={e => setForm(p => ({ ...p, assigned_to_type: e.target.value }))}
                                >
                                    <option value="user">Técnico (Usuário)</option>
                                    <option value="vehicle">Veículo</option>
                                </select>
                            </div>
                            <div>
                                <label className="mb-1 block text-sm font-medium">ID Destino</label>
                                <input
                                    type="number"
                                    className="w-full rounded-lg border bg-background px-3 py-2 text-sm"
                                    value={form.assigned_to_id}
                                    onChange={e => setForm(p => ({ ...p, assigned_to_id: e.target.value }))}
                                    placeholder="ID do técnico ou veículo"
                                />
                            </div>
                            <div>
                                <label className="mb-1 block text-sm font-medium">Observações</label>
                                <textarea
                                    className="w-full rounded-lg border bg-background px-3 py-2 text-sm"
                                    value={form.notes}
                                    onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
                                    rows={2}
                                    placeholder="Observações sobre a atribuição"
                                />
                            </div>
                        </div>
                        <div className="mt-6 flex justify-end gap-3">
                            <button onClick={() => setShowDialog(false)} className="rounded-lg border px-4 py-2 text-sm hover:bg-muted">
                                Cancelar
                            </button>
                            <button
                                onClick={() => assignMutation.mutate(form)}
                                disabled={assignMutation.isPending || !form.standard_weight_id || !form.assigned_to_id}
                                className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                            >
                                {assignMutation.isPending ? 'Atribuindo...' : 'Atribuir'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
