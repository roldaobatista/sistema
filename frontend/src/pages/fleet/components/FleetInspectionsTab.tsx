import { useState , useMemo } from 'react'
import { toast } from 'sonner'
import { useQuery , useMutation, useQueryClient } from '@tanstack/react-query'
import { ClipboardList, Search, CheckCircle2, AlertCircle, XCircle, Eye } from 'lucide-react'
import api from '@/lib/api'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/stores/auth-store'

export function FleetInspectionsTab() {

  // MVP: Delete mutation
  const queryClient = useQueryClient()
  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/fleet-inspections/${id}`),
    onSuccess: () => { toast.success('Removido com sucesso'); queryClient.invalidateQueries({ queryKey: ['fleet-inspections'] }) },
    onError: (err: any) => { toast.error(err?.response?.data?.message || 'Erro ao remover') },
  })
  const handleDelete = (id: number) => { if (window.confirm('Tem certeza que deseja remover?')) deleteMutation.mutate(id) }
  const { hasPermission } = useAuthStore()

    const [statusFilter, setStatusFilter] = useState('')
    const { data: inspections, isLoading } = useQuery({
        queryKey: ['fleet-inspections', statusFilter],
        queryFn: () => api.get('/fleet/inspections', { params: { status: statusFilter || undefined } }).then(r => r.data)
    })

    const statusMap: Record<string, { label: string; variant: any; icon: any }> = {
        ok: { label: 'OK', variant: 'success', icon: <CheckCircle2 size={14} /> },
        issues_found: { label: 'Pendências', variant: 'warning', icon: <AlertCircle size={14} /> },
        critical: { label: 'Crítico', variant: 'danger', icon: <XCircle size={14} /> },
    }

    const statuses = [
        { value: '', label: 'Todos' },
        { value: 'ok', label: 'OK' },
        { value: 'issues_found', label: 'Pendências' },
        { value: 'critical', label: 'Crítico' },
    ]

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
                {statuses.map(s => (
                    <button
                        key={s.value}
                        onClick={() => setStatusFilter(s.value)}
                        className={cn(
                            "px-3 py-1.5 rounded-lg text-xs font-medium transition-all border",
                            statusFilter === s.value
                                ? "bg-brand-50 border-brand-300 text-brand-700"
                                : "bg-surface-0 border-default text-surface-500 hover:border-brand-200"
                        )}
                    >
                        {s.label}
                    </button>
                ))}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {isLoading && [1, 2, 3].map(i => <div key={i} className="h-44 bg-surface-100 animate-pulse rounded-2xl" />)}
                {inspections?.data?.map((insp: any) => {
                    const st = statusMap[insp.status] || statusMap.ok
                    return (
                        <div key={insp.id} className="p-5 rounded-2xl border border-default bg-surface-0 hover:shadow-card transition-all space-y-3">
                            <div className="flex items-center justify-between">
                                <Badge variant={st.variant} className="flex items-center gap-1">{st.icon} {st.label}</Badge>
                                <span className="text-[10px] text-surface-400">{new Date(insp.inspection_date).toLocaleDateString()}</span>
                            </div>

                            <div>
                                <p className="text-sm font-bold text-surface-900">{insp.vehicle?.plate} — {insp.vehicle?.model}</p>
                                <p className="text-xs text-surface-500">Inspetor: {insp.inspector?.name}</p>
                            </div>

                            <div className="grid grid-cols-2 gap-2 py-2 border-y border-subtle">
                                <div>
                                    <p className="text-[10px] uppercase text-surface-400 font-bold">Odômetro</p>
                                    <p className="text-xs font-mono text-surface-700">{Number(insp.odometer_km).toLocaleString()} km</p>
                                </div>
                                <div>
                                    <p className="text-[10px] uppercase text-surface-400 font-bold">Itens</p>
                                    <p className="text-xs text-surface-700">
                                        {insp.checklist_data ? Object.keys(insp.checklist_data).length : 0} verificados
                                    </p>
                                </div>
                            </div>

                            {insp.observations && (
                                <p className="text-[10px] text-surface-500 italic line-clamp-2">{insp.observations}</p>
                            )}

                            <Button size="xs" variant="outline" icon={<Eye size={12} />} className="w-full">Ver Checklist</Button>
                        </div>
                    )
                })}
                {!isLoading && (!inspections?.data || inspections.data.length === 0) && (
                    <div className="col-span-full py-20 text-center border-2 border-dashed border-surface-200 rounded-3xl">
                        <ClipboardList size={40} className="mx-auto text-surface-200 mb-4" />
                        <p className="text-surface-500 font-medium">Nenhuma inspeção encontrada</p>
                    </div>
                )}
            </div>
        </div>
    )
}
