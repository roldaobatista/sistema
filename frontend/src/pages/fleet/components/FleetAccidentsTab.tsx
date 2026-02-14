import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, Camera, Calendar, DollarSign, MapPin, Eye, Trash2 } from 'lucide-react'
import api from '@/lib/api'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { useAuthStore } from '@/stores/auth-store'

export function FleetAccidentsTab() {
  const { hasPermission } = useAuthStore()

    const queryClient = useQueryClient()
    const { data: accidents, isLoading } = useQuery({
        queryKey: ['fleet-accidents'],
        queryFn: () => api.get('/fleet/accidents').then(r => r.data)
    })

    const deleteMutation = useMutation({
        mutationFn: (id: number) => api.delete(`/fleet/accidents/${id}`),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['fleet-accidents'] })
            toast.success('Registro de sinistro removido')
        },
        onError: () => toast.error('Erro ao remover sinistro')
    })

    const statusMap: Record<string, { label: string; variant: any }> = {
        open: { label: 'Aberto', variant: 'danger' },
        investigating: { label: 'Em Investigação', variant: 'warning' },
        closed: { label: 'Encerrado', variant: 'secondary' },
    }

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-surface-700">Sinistros e Acidentes</h3>
                <Button size="sm" icon={<AlertTriangle size={14} />}>Registrar Sinistro</Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {isLoading && [1, 2].map(i => <div key={i} className="h-52 bg-surface-100 animate-pulse rounded-2xl" />)}
                {accidents?.data?.map((acc: any) => (
                    <div key={acc.id} className="group p-5 rounded-2xl border border-default bg-surface-0 hover:shadow-card transition-all space-y-4">
                        <div className="flex items-center justify-between">
                            <Badge variant={statusMap[acc.status]?.variant}>{statusMap[acc.status]?.label}</Badge>
                            <span className="text-[10px] text-surface-400 font-mono">B.O. {acc.report_number || '—'}</span>
                        </div>

                        <div>
                            <h4 className="font-bold text-surface-900">{acc.vehicle?.plate} — {acc.vehicle?.model}</h4>
                            <p className="text-xs text-surface-500">Motorista: {acc.driver?.name || 'Não identificado'}</p>
                        </div>

                        <div className="grid grid-cols-3 gap-3 py-3 border-y border-subtle">
                            <div>
                                <p className="text-[10px] uppercase text-surface-400 font-bold">Data</p>
                                <p className="text-xs font-medium text-surface-700 flex items-center gap-1">
                                    <Calendar size={12} className="text-surface-400" />
                                    {new Date(acc.accident_date).toLocaleDateString()}
                                </p>
                            </div>
                            <div>
                                <p className="text-[10px] uppercase text-surface-400 font-bold">Odômetro</p>
                                <p className="text-xs font-mono text-surface-700">{Number(acc.odometer_km).toLocaleString()} km</p>
                            </div>
                            <div>
                                <p className="text-[10px] uppercase text-surface-400 font-bold">Custo Est.</p>
                                <p className="text-xs font-bold text-red-600 flex items-center gap-1">
                                    <DollarSign size={12} /> {acc.cost ? `R$ ${Number(acc.cost).toLocaleString()}` : '—'}
                                </p>
                            </div>
                        </div>

                        {acc.description && <p className="text-xs text-surface-600 line-clamp-2">{acc.description}</p>}

                        {acc.photos && acc.photos.length > 0 && (
                            <div className="flex items-center gap-2 text-xs text-surface-500">
                                <Camera size={14} className="text-surface-400" />
                                {acc.photos.length} foto(s) anexada(s)
                            </div>
                        )}

                        <div className="flex gap-2 pt-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button size="xs" variant="outline" icon={<Eye size={12} />} className="flex-1">Detalhes</Button>
                            <Button size="xs" variant="ghost" className="text-red-400" onClick={() => {
                                if (confirm('Remover registro de sinistro?')) deleteMutation.mutate(acc.id)
                            }}>
                                <Trash2 size={12} />
                            </Button>
                        </div>
                    </div>
                ))}
                {!isLoading && (!accidents?.data || accidents.data.length === 0) && (
                    <div className="col-span-full py-20 text-center border-2 border-dashed border-surface-200 rounded-3xl">
                        <AlertTriangle size={40} className="mx-auto text-surface-200 mb-4" />
                        <p className="text-surface-500 font-medium">Nenhum sinistro registrado</p>
                    </div>
                )}
            </div>
        </div>
    )
}
