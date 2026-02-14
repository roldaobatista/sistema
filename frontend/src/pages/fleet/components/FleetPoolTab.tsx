import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Calendar, User, Clock, CheckCircle2, XCircle, Play, Info, Plus } from 'lucide-react'
import api from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

export function FleetPoolTab() {
    const queryClient = useQueryClient()
    const { data: requests, isLoading } = useQuery({
        queryKey: ['fleet-pool-requests'],
        queryFn: () => api.get('/fleet/pool-requests').then(r => r.data)
    })

    const statusMap: Record<string, { label: string; variant: any; icon: any }> = {
        pending: { label: 'Pendente', variant: 'warning', icon: <Clock size={14} /> },
        approved: { label: 'Aprovado', variant: 'brand', icon: <CheckCircle2 size={14} /> },
        in_use: { label: 'Em Uso', variant: 'success', icon: <Play size={14} /> },
        completed: { label: 'Concluído', variant: 'info', icon: <CheckCircle2 size={14} /> },
        rejected: { label: 'Rejeitado', variant: 'danger', icon: <XCircle size={14} /> },
    }

    const updateStatus = useMutation({
        mutationFn: ({ id, status }: any) => api.patch(`/fleet/pool-requests/${id}/status`, { status }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['fleet-pool-requests'] })
            toast.success('Status atualizado')
        }
    })

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-surface-700">Solicitações de Backup / Pool</h3>
                <Button size="sm" icon={<Plus size={14} />}>Nova Solicitação</Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {isLoading && [1, 2, 3].map(i => <div key={i} className="h-40 bg-surface-100 animate-pulse rounded-2xl" />)}
                {requests?.data?.map((req: any) => (
                    <div key={req.id} className="p-5 rounded-2xl border border-default bg-surface-0 shadow-sm space-y-4 hover:shadow-card transition-all">
                        <div className="flex items-center justify-between">
                            <Badge variant={statusMap[req.status]?.variant} className="flex items-center gap-1">
                                {statusMap[req.status]?.icon}
                                {statusMap[req.status]?.label}
                            </Badge>
                            <span className="text-[10px] text-surface-400 font-mono">#{req.id}</span>
                        </div>

                        <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-full bg-brand-50 flex items-center justify-center text-brand-700">
                                <User size={18} />
                            </div>
                            <div>
                                <p className="text-sm font-bold text-surface-900">{req.user?.name}</p>
                                <p className="text-xs text-surface-500">{req.vehicle?.plate} • {req.vehicle?.model}</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4 py-2 border-y border-subtle">
                            <div className="space-y-1">
                                <p className="text-[10px] uppercase text-surface-400 font-bold">Início</p>
                                <p className="text-[11px] font-medium text-surface-700 flex items-center gap-1">
                                    <Calendar size={12} className="text-surface-400" />
                                    {new Date(req.start_at).toLocaleDateString()}
                                </p>
                            </div>
                            <div className="space-y-1">
                                <p className="text-[10px] uppercase text-surface-400 font-bold">Retorno Est.</p>
                                <p className="text-[11px] font-medium text-surface-700 flex items-center gap-1">
                                    <Clock size={12} className="text-surface-400" />
                                    {new Date(req.end_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </p>
                            </div>
                        </div>

                        <div className="flex items-center gap-2 pt-1">
                            {req.status === 'pending' && (
                                <>
                                    <Button size="xs" variant="brand" className="flex-1" onClick={() => updateStatus.mutate({ id: req.id, status: 'approved' })}>Aprovar</Button>
                                    <Button size="xs" variant="ghost" onClick={() => updateStatus.mutate({ id: req.id, status: 'rejected' })} className="text-red-500 hover:text-red-600">Rejeitar</Button>
                                </>
                            )}
                            {req.status === 'approved' && (
                                <Button size="xs" variant="brand" className="w-full" onClick={() => updateStatus.mutate({ id: req.id, status: 'in_use' })}>Registrar Saída</Button>
                            )}
                            {req.status === 'in_use' && (
                                <Button size="xs" variant="success" className="w-full" onClick={() => updateStatus.mutate({ id: req.id, status: 'completed' })}>Registrar Devolução</Button>
                            )}
                            {(req.status === 'completed' || req.status === 'rejected') && (
                                <Button size="xs" variant="outline" icon={<Info size={12} />} className="w-full">Ver Detalhes</Button>
                            )}
                        </div>
                    </div>
                ))}
                {requests?.data?.length === 0 && (
                    <div className="col-span-full py-20 text-center border-2 border-dashed border-surface-200 rounded-3xl">
                        <Calendar size={40} className="mx-auto text-surface-200 mb-4" />
                        <p className="text-surface-500 font-medium">Nenhuma solicitação no período</p>
                    </div>
                )}
            </div>
        </div>
    )
}
