import { useState } from 'react'
import { toast } from 'sonner'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Edit2, Trash2, Shield, Clock, X, AlertTriangle } from 'lucide-react'
import api from '@/lib/api'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/stores/auth-store'

interface SlaPolicy {
    id: number
    name: string
    description: string | null
    priority: string
    response_time_hours: number
    resolution_time_hours: number
    is_active: boolean
}

const priorityConfig: Record<string, { label: string; color: string; icon: string }> = {
    low: { label: 'Baixa', color: 'text-surface-600 bg-surface-100', icon: 'ðŸŸ¢' },
    medium: { label: 'Média', color: 'text-amber-700 bg-amber-50', icon: 'ðŸŸ¡' },
    high: { label: 'Alta', color: 'text-orange-700 bg-orange-50', icon: 'ðŸŸ ' },
    critical: { label: 'Crítica', color: 'text-red-700 bg-red-50', icon: 'ðŸ”´' },
}

export function SlaPoliciesPage() {
    const { hasPermission } = useAuthStore()

    const qc = useQueryClient()
    const [modal, setModal] = useState<{ mode: 'create' | 'edit'; policy?: SlaPolicy } | null>(null)

    const { data: res, isLoading, isError } = useQuery({
        queryKey: ['sla-policies'],
        queryFn: () => api.get('/sla-policies'),
    })
    const policies: SlaPolicy[] = res?.data?.data ?? []

    const saveMut = useMutation({
        mutationFn: (data: any) =>
            data.id ? api.put(`/sla-policies/${data.id}`, data) : api.post('/sla-policies', data),
        onSuccess: () => {
            toast.success('Operação realizada com sucesso')
            qc.invalidateQueries({ queryKey: ['sla-policies'] })
            setModal(null)
        },
    })

    const deleteMut = useMutation({
        mutationFn: (id: number) => api.delete(`/sla-policies/${id}`),
        onSuccess: () => {
            toast.success('Operação realizada com sucesso')
            qc.invalidateQueries({ queryKey: ['sla-policies'] })
        },
    })

    const fmtHours = (h: number) => h >= 24 ? `${Math.floor(h / 24)}d ${h % 24}h` : `${h}h`

    return (
        <div className="space-y-5">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-lg font-semibold text-surface-900 tracking-tight">Políticas de SLA</h1>
                    <p className="mt-0.5 text-sm text-surface-500">Defina tempos de resposta e resolução por prioridade</p>
                </div>
                <button onClick={() => setModal({ mode: 'create' })}
                    className="flex items-center gap-2 rounded-xl bg-brand-500 px-4 py-2.5 text-sm font-semibold text-white shadow-md hover:bg-brand-600 transition-colors">
                    <Plus className="h-4 w-4" /> Nova Política
                </button>
            </div>

            {isLoading && <p className="text-sm text-surface-400 text-center py-8">Carregando...</p>}

            {!isLoading && isError && (
                <div className="rounded-xl border border-default bg-surface-0 p-12 text-center">
                    <AlertTriangle className="mx-auto h-12 w-12 text-red-300" />
                    <p className="mt-3 text-sm font-medium text-red-600">Erro ao carregar políticas de SLA</p>
                    <p className="text-xs text-surface-400 mt-1">Tente novamente mais tarde</p>
                </div>
            )}

            {!isLoading && !isError && policies.length === 0 && (
                <div className="rounded-xl border border-dashed border-default bg-surface-50 p-12 text-center">
                    <Shield className="mx-auto h-12 w-12 text-surface-300" />
                    <p className="mt-3 text-sm text-surface-500">Nenhuma política de SLA cadastrada</p>
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {policies.map(p => {
                    const pri = priorityConfig[p.priority] ?? priorityConfig.medium
                    return (
                        <div key={p.id} className={cn(
                            'rounded-xl border bg-surface-0 shadow-card p-5 transition-all hover:shadow-lg group',
                            !p.is_active && 'opacity-60'
                        )}>
                            <div className="flex items-start justify-between">
                                <div className="flex items-center gap-2">
                                    <span className="text-lg">{pri.icon}</span>
                                    <div>
                                        <h3 className="text-sm font-bold text-surface-900">{p.name}</h3>
                                        <span className={cn('inline-flex rounded-full px-2 py-0.5 text-xs font-medium mt-1', pri.color)}>
                                            {pri.label}
                                        </span>
                                    </div>
                                </div>
                                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button onClick={() => setModal({ mode: 'edit', policy: p })} className="rounded-lg p-1.5 hover:bg-surface-100">
                                        <Edit2 className="h-3.5 w-3.5 text-surface-500" />
                                    </button>
                                    <button onClick={() => { if (confirm('Excluir esta política?')) deleteMut.mutate(p.id) }} className="rounded-lg p-1.5 hover:bg-red-50">
                                        <Trash2 className="h-3.5 w-3.5 text-red-500" />
                                    </button>
                                </div>
                            </div>

                            {p.description && (
                                <p className="mt-2 text-xs text-surface-500 line-clamp-2">{p.description}</p>
                            )}

                            <div className="mt-4 grid grid-cols-2 gap-3">
                                <div className="rounded-lg bg-blue-50 p-3 text-center">
                                    <Clock className="mx-auto h-4 w-4 text-blue-500 mb-1" />
                                    <p className="text-xs text-blue-600 font-medium">Resposta</p>
                                    <p className="text-sm font-semibold tabular-nums text-blue-700">{fmtHours(p.response_time_hours)}</p>
                                </div>
                                <div className="rounded-lg bg-emerald-50 p-3 text-center">
                                    <AlertTriangle className="mx-auto h-4 w-4 text-emerald-500 mb-1" />
                                    <p className="text-xs text-emerald-600 font-medium">Resolução</p>
                                    <p className="text-sm font-semibold tabular-nums text-emerald-700">{fmtHours(p.resolution_time_hours)}</p>
                                </div>
                            </div>

                            {!p.is_active && (
                                <p className="mt-3 text-xs text-surface-400 text-center">Inativa</p>
                            )}
                        </div>
                    )
                })}
            </div>

            {modal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setModal(null)}>
                    <div className="w-full max-w-md rounded-2xl bg-surface-0 p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between">
                            <h3 className="text-sm font-semibold tabular-nums text-surface-900">{modal.mode === 'edit' ? 'Editar Política' : 'Nova Política SLA'}</h3>
                            <button onClick={() => setModal(null)}><X className="h-5 w-5 text-surface-400" /></button>
                        </div>
                        <form onSubmit={e => {
                            e.preventDefault()
                            const fd = new FormData(e.currentTarget)
                            saveMut.mutate({
                                id: modal.policy?.id,
                                name: fd.get('name'),
                                description: fd.get('description') || null,
                                priority: fd.get('priority'),
                                response_time_hours: Number(fd.get('response_time_hours')),
                                resolution_time_hours: Number(fd.get('resolution_time_hours')),
                                is_active: fd.get('is_active') === 'on',
                            })
                        }} className="mt-4 space-y-3">
                            <div>
                                <label className="text-xs font-medium text-surface-700">Nome</label>
                                <input name="name" required defaultValue={modal.policy?.name} className="mt-1 block w-full rounded-lg border border-surface-300 px-3 py-2 text-sm" />
                            </div>
                            <div>
                                <label className="text-xs font-medium text-surface-700">Descrição</label>
                                <textarea name="description" rows={2} defaultValue={modal.policy?.description ?? ''} className="mt-1 block w-full rounded-lg border border-surface-300 px-3 py-2 text-sm" />
                            </div>
                            <div>
                                <label className="text-xs font-medium text-surface-700">Prioridade</label>
                                <select name="priority" required defaultValue={modal.policy?.priority ?? 'medium'} className="mt-1 block w-full rounded-lg border border-surface-300 px-3 py-2 text-sm">
                                    {Object.entries(priorityConfig).map(([k, v]) => <option key={k} value={k}>{v.icon} {v.label}</option>)}
                                </select>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-xs font-medium text-surface-700">Resposta (horas)</label>
                                    <input name="response_time_hours" type="number" min={1} required defaultValue={modal.policy?.response_time_hours ?? 4}
                                        className="mt-1 block w-full rounded-lg border border-surface-300 px-3 py-2 text-sm" />
                                </div>
                                <div>
                                    <label className="text-xs font-medium text-surface-700">Resolução (horas)</label>
                                    <input name="resolution_time_hours" type="number" min={1} required defaultValue={modal.policy?.resolution_time_hours ?? 24}
                                        className="mt-1 block w-full rounded-lg border border-surface-300 px-3 py-2 text-sm" />
                                </div>
                            </div>
                            <label className="flex items-center gap-2 text-sm text-surface-700">
                                <input name="is_active" type="checkbox" defaultChecked={modal.policy?.is_active ?? true} className="rounded" />
                                Ativa
                            </label>
                            <div className="flex gap-2 pt-2">
                                <button type="button" onClick={() => setModal(null)} className="flex-1 rounded-xl border border-surface-300 px-4 py-2 text-sm font-medium">Cancelar</button>
                                <button type="submit" disabled={saveMut.isPending}
                                    className="flex-1 rounded-xl bg-brand-500 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-50">
                                    {saveMut.isPending ? 'Salvando...' : 'Salvar'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    )
}
