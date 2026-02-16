import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'
import { PageHeader } from '@/components/ui/pageheader'
import { EmptyState } from '@/components/ui/emptystate'
import { toast } from 'sonner'
import { Wrench, Plus, AlertTriangle, CheckCircle2 } from 'lucide-react'

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

export default function ToolCalibrationsPage() {
    const queryClient = useQueryClient()
    const [showDialog, setShowDialog] = useState(false)
    const [form, setForm] = useState({
        inventory_item_id: '',
        calibration_date: new Date().toISOString().split('T')[0],
        next_due_date: '',
        certificate_number: '',
        laboratory: '',
        result: 'approved',
        cost: '',
        notes: '',
    })

    const { data, isLoading } = useQuery<ToolCalibration[]>({
        queryKey: ['tool-calibrations'],
        queryFn: () => api.get('/api/v1/tool-calibrations').then(r => r.data.data ?? r.data),
    })

    const { data: expiringData } = useQuery<ToolCalibration[]>({
        queryKey: ['tool-calibrations-expiring'],
        queryFn: () => api.get('/api/v1/tool-calibrations/expiring').then(r => r.data.data ?? r.data),
    })

    const createMutation = useMutation({
        mutationFn: (payload: typeof form) => api.post('/api/v1/tool-calibrations', payload),
        onSuccess: () => {
            toast.success('Calibração registrada com sucesso')
            queryClient.invalidateQueries({ queryKey: ['tool-calibrations'] })
            queryClient.invalidateQueries({ queryKey: ['tool-calibrations-expiring'] })
            setShowDialog(false)
            setForm({
                inventory_item_id: '', calibration_date: new Date().toISOString().split('T')[0],
                next_due_date: '', certificate_number: '', laboratory: '', result: 'approved', cost: '', notes: '',
            })
        },
        onError: () => toast.error('Erro ao registrar calibração'),
    })

    const calibrations = data ?? []
    const expiring = expiringData ?? []

    return (
        <div className="space-y-6">
            <PageHeader
                title="Calibração de Ferramentas"
                subtitle="Registro de calibrações de ferramentas e instrumentos do estoque"
                action={
                    <button
                        onClick={() => setShowDialog(true)}
                        className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                    >
                        <Plus className="h-4 w-4" /> Registrar Calibração
                    </button>
                }
            />

            {/* Alertas de vencimento */}
            {expiring.length > 0 && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950/30">
                    <div className="flex items-center gap-2 text-sm font-medium text-amber-700 dark:text-amber-400">
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

            {/* Resumo */}
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

            {/* Tabela */}
            {isLoading ? (
                <div className="flex justify-center py-12 text-muted-foreground">Carregando...</div>
            ) : calibrations.length === 0 ? (
                <EmptyState
                    icon={Wrench}
                    title="Nenhuma calibração"
                    description="Nenhuma calibração de ferramenta foi registrada."
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
                            </tr>
                        </thead>
                        <tbody className="divide-y">
                            {calibrations.map(c => {
                                const isExpiring = c.next_due_date && new Date(c.next_due_date) < new Date(Date.now() + 30 * 86400000)
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
                                            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                                                c.result === 'approved'
                                                    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                                                    : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                                            }`}>
                                                {c.result === 'approved' ? 'Aprovado' : 'Reprovado'}
                                            </span>
                                        </td>
                                        <td className="p-3 text-right text-xs">
                                            {c.cost ? `R$ ${Number(c.cost).toFixed(2).replace('.', ',')}` : '—'}
                                        </td>
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Dialog */}
            {showDialog && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowDialog(false)}>
                    <div className="w-full max-w-lg rounded-xl bg-card p-6 shadow-xl" onClick={e => e.stopPropagation()}>
                        <h3 className="text-lg font-semibold">Registrar Calibração de Ferramenta</h3>
                        <div className="mt-4 grid grid-cols-2 gap-4">
                            <div className="col-span-2">
                                <label className="mb-1 block text-sm font-medium">ID do Item do Estoque</label>
                                <input
                                    type="number"
                                    className="w-full rounded-lg border bg-background px-3 py-2 text-sm"
                                    value={form.inventory_item_id}
                                    onChange={e => setForm(p => ({ ...p, inventory_item_id: e.target.value }))}
                                />
                            </div>
                            <div>
                                <label className="mb-1 block text-sm font-medium">Data da Calibração</label>
                                <input
                                    type="date"
                                    className="w-full rounded-lg border bg-background px-3 py-2 text-sm"
                                    value={form.calibration_date}
                                    onChange={e => setForm(p => ({ ...p, calibration_date: e.target.value }))}
                                />
                            </div>
                            <div>
                                <label className="mb-1 block text-sm font-medium">Próximo Vencimento</label>
                                <input
                                    type="date"
                                    className="w-full rounded-lg border bg-background px-3 py-2 text-sm"
                                    value={form.next_due_date}
                                    onChange={e => setForm(p => ({ ...p, next_due_date: e.target.value }))}
                                />
                            </div>
                            <div>
                                <label className="mb-1 block text-sm font-medium">Nº Certificado</label>
                                <input
                                    type="text"
                                    className="w-full rounded-lg border bg-background px-3 py-2 text-sm"
                                    value={form.certificate_number}
                                    onChange={e => setForm(p => ({ ...p, certificate_number: e.target.value }))}
                                />
                            </div>
                            <div>
                                <label className="mb-1 block text-sm font-medium">Laboratório</label>
                                <input
                                    type="text"
                                    className="w-full rounded-lg border bg-background px-3 py-2 text-sm"
                                    value={form.laboratory}
                                    onChange={e => setForm(p => ({ ...p, laboratory: e.target.value }))}
                                />
                            </div>
                            <div>
                                <label className="mb-1 block text-sm font-medium">Resultado</label>
                                <select
                                    className="w-full rounded-lg border bg-background px-3 py-2 text-sm"
                                    value={form.result}
                                    onChange={e => setForm(p => ({ ...p, result: e.target.value }))}
                                >
                                    <option value="approved">Aprovado</option>
                                    <option value="rejected">Reprovado</option>
                                </select>
                            </div>
                            <div>
                                <label className="mb-1 block text-sm font-medium">Custo (R$)</label>
                                <input
                                    type="number"
                                    step="0.01"
                                    className="w-full rounded-lg border bg-background px-3 py-2 text-sm"
                                    value={form.cost}
                                    onChange={e => setForm(p => ({ ...p, cost: e.target.value }))}
                                />
                            </div>
                            <div className="col-span-2">
                                <label className="mb-1 block text-sm font-medium">Observações</label>
                                <textarea
                                    className="w-full rounded-lg border bg-background px-3 py-2 text-sm"
                                    value={form.notes}
                                    onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
                                    rows={2}
                                />
                            </div>
                        </div>
                        <div className="mt-6 flex justify-end gap-3">
                            <button onClick={() => setShowDialog(false)} className="rounded-lg border px-4 py-2 text-sm hover:bg-muted">
                                Cancelar
                            </button>
                            <button
                                onClick={() => createMutation.mutate(form)}
                                disabled={createMutation.isPending || !form.inventory_item_id}
                                className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                            >
                                {createMutation.isPending ? 'Salvando...' : 'Registrar'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
