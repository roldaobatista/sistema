import { useState } from 'react'
import { useQuery , useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { MapPin, Navigation, Clock, Wifi, WifiOff, RefreshCw } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import api from '@/lib/api'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/stores/auth-store'

export function GpsLiveTab() {

  // MVP: Delete mutation
  const queryClient = useQueryClient()
  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/gps-live/${id}`),
    onSuccess: () => { toast.success('Removido com sucesso');
                queryClient.invalidateQueries({ queryKey: ['gps-live'] }) },
    onError: (err: any) => { toast.error(err?.response?.data?.message || 'Erro ao remover') },
  })
  const handleDelete = (id: number) => { if (window.confirm('Tem certeza que deseja remover?')) deleteMutation.mutate(id) }

  // MVP: Search
  const [searchTerm, setSearchTerm] = useState('')
  const { hasPermission } = useAuthStore()

    const { data: positions, isLoading, refetch, isFetching } = useQuery({
        queryKey: ['fleet-gps-live'],
        queryFn: () => api.get('/fleet/gps/live').then(r => r.data?.data),
        refetchInterval: 30000, // Auto-refresh a cada 30s
    })

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-sm font-semibold text-surface-700">Rastreamento em Tempo Real</h3>
                    <p className="text-xs text-surface-400">Atualização automática a cada 30 segundos</p>
                </div>
                <Button size="sm" variant="outline" onClick={() => refetch()} disabled={isFetching} icon={<RefreshCw size={14} className={cn(isFetching && 'animate-spin')} />}>
                    Atualizar
                </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {isLoading && [1, 2, 3].map(i => <div key={i} className="h-36 bg-surface-100 animate-pulse rounded-2xl" />)}
                {positions?.map((v: any) => {
                    const now = new Date()
                    const isRecent = v.last_gps_at && new Date(v.last_gps_at) > new Date(now.getTime() - 5 * 60 * 1000)
                    return (
                        <div key={v.id} className="p-5 rounded-2xl border border-default bg-surface-0 transition-all space-y-3">
                            <div className="flex items-center justify-between">
                                <div className="px-3 py-1 bg-surface-900 rounded border-2 border-surface-700 shadow-sm">
                                    <span className="text-xs font-mono font-bold text-white tracking-widest">{v.plate}</span>
                                </div>
                                <Badge variant={isRecent ? 'success' : 'secondary'} className="flex items-center gap-1">
                                    {isRecent ? <Wifi size={10} /> : <WifiOff size={10} />}
                                    {isRecent ? 'Online' : 'Offline'}
                                </Badge>
                            </div>

                            <div className="flex items-center gap-2">
                                <div className={cn("h-3 w-3 rounded-full", isRecent ? "bg-emerald-500 animate-pulse" : "bg-surface-300")} />
                                <p className="text-xs text-surface-600">{v.brand} {v.model}</p>
                            </div>

                            <div className="grid grid-cols-2 gap-2 py-2 border-t border-subtle">
                                <div>
                                    <p className="text-xs uppercase text-surface-400 font-bold">Coordenadas</p>
                                    <p className="text-xs font-mono text-surface-600">
                                        {Number(v.last_gps_lat).toFixed(5)}, {Number(v.last_gps_lng).toFixed(5)}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-xs uppercase text-surface-400 font-bold">Última Posição</p>
                                    <p className="text-xs text-surface-600 flex items-center gap-1">
                                        <Clock size={10} className="text-surface-400" />
                                        {v.last_gps_at ? new Date(v.last_gps_at).toLocaleTimeString() : '—'}
                                    </p>
                                </div>
                            </div>

                            <a
                                href={`https://www.google.com/maps?q=${v.last_gps_lat},${v.last_gps_lng}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center justify-center gap-2 w-full py-2 rounded-xl bg-brand-50 text-brand-700 text-xs font-medium hover:bg-brand-100 transition-colors"
                            >
                                <Navigation size={12} /> Abrir no Google Maps
                            </a>
                        </div>
                    )
                })}
                {!isLoading && (!positions || positions.length === 0) && (
                    <div className="col-span-full py-20 text-center border-2 border-dashed border-surface-200 rounded-3xl">
                        <MapPin size={40} className="mx-auto text-surface-200 mb-4" />
                        <p className="text-surface-500 font-medium">Nenhum veículo com GPS ativo</p>
                        <p className="text-xs text-surface-400 mt-1">Veículos precisam enviar posição pelo app mobile</p>
                    </div>
                )}
            </div>
        </div>
    )
}
