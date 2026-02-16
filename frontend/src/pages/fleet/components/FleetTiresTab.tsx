import { useState , useMemo } from 'react'
import { toast } from 'sonner'
import { useQuery , useMutation, useQueryClient } from '@tanstack/react-query'
import { Disc, Plus, Search, MapPin, Gauge, AlertCircle } from 'lucide-react'
import api from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/stores/auth-store'

export function FleetTiresTab() {

  // MVP: Delete mutation
  const queryClient = useQueryClient()
  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/fleet-tires/${id}`),
    onSuccess: () => { toast.success('Removido com sucesso');
                queryClient.invalidateQueries({ queryKey: ['fleet-tires'] }) },
    onError: (err: any) => { toast.error(err?.response?.data?.message || 'Erro ao remover') },
  })
  const handleDelete = (id: number) => { if (window.confirm('Tem certeza que deseja remover?')) deleteMutation.mutate(id) }
  const { hasPermission } = useAuthStore()

    const [vehicleId, setVehicleId] = useState<number | null>(null)

    const { data: tires, isLoading } = useQuery({
        queryKey: ['fleet-tires', vehicleId],
        queryFn: () => api.get('/fleet/tires', { params: { fleet_vehicle_id: vehicleId || undefined } }).then(r => r.data)
    })

    // Mock layout dos pneus para caminhão 2 eixos
    const positions = [
        { id: 'E1', label: 'Dianteiro Esquerdo', x: '25%', y: '15%' },
        { id: 'D1', label: 'Dianteiro Direito', x: '65%', y: '15%' },
        { id: 'E2', label: 'Traseiro Esquerdo Ext.', x: '20%', y: '75%' },
        { id: 'E3', label: 'Traseiro Esquerdo Int.', x: '30%', y: '75%' },
        { id: 'D3', label: 'Traseiro Direito Int.', x: '60%', y: '75%' },
        { id: 'D2', label: 'Traseiro Direito Ext.', x: '70%', y: '75%' },
        { id: 'S1', label: 'Estepe', x: '45%', y: '90%' },
    ]

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-4">
                <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-semibold text-surface-700">Mapa de Posições</h3>
                    <Button size="sm" variant="outline" icon={<Plus size={14} />}>Registrar Troca</Button>
                </div>

                <div className="relative aspect-[3/4] max-w-sm mx-auto bg-surface-50 border border-default rounded-3xl p-8 overflow-hidden shadow-inner">
                    <div className="absolute inset-x-12 inset-y-8 border-4 border-surface-200 rounded-lg" />
                    <div className="absolute top-4 inset-x-16 h-8 bg-surface-300 rounded-t-xl" />

                    {positions.map(pos => {
                        const tire = tires?.data?.find((t: any) => t.position === pos.id)
                        return (
                            <TireMarker
                                key={pos.id}
                                pos={pos}
                                tire={tire}
                                onClick={() => {}}
                            />
                        )
                    })}
                </div>
            </div>

            <div className="space-y-4">
                <h3 className="text-sm font-semibold text-surface-700">Alertas de Desgaste</h3>
                <div className="space-y-3">
                    {isLoading && [1, 2].map(i => <div key={i} className="h-24 bg-surface-100 animate-pulse rounded-xl" />)}
                    {tires?.data?.filter((t: any) => t.tread_depth < 3).map((t: any) => (
                        <div key={t.id} className="p-4 rounded-xl border border-red-200 bg-red-50 space-y-2">
                            <div className="flex items-center justify-between">
                                <Badge variant="danger">{t.position}</Badge>
                                <span className="text-xs font-mono text-red-600 font-bold">{t.tread_depth}mm</span>
                            </div>
                            <p className="text-xs font-medium text-red-800">{t.vehicle?.plate} - {t.brand}</p>
                            <p className="text-xs text-red-600">Sulco abaixo do limite de segurança (3mm).</p>
                        </div>
                    ))}
                    {tires?.data?.length === 0 && <p className="text-center text-xs text-surface-500 py-10">Nenhum pneu registrado.</p>}
                </div>
            </div>
        </div>
    )
}

function TireMarker({ pos, tire, onClick }: any) {
    const isCritical = tire?.tread_depth < 3;
    const isWarning = tire?.tread_depth >= 3 && tire?.tread_depth < 5;

    return (
        <button
            onClick={onClick}
            className="absolute group transition-transform hover:scale-110"
            style={{ left: pos.x, top: pos.y }}
        >
            <div className={cn(
                "relative h-14 w-8 rounded-md flex flex-col items-center justify-center border-2 transition-all shadow-sm",
                tire ? (isCritical ? "bg-red-500 border-red-700 text-white" : isWarning ? "bg-amber-400 border-amber-600 text-amber-950" : "bg-surface-900 border-black text-white")
                    : "bg-surface-200 border-surface-300 text-surface-400 border-dashed"
            )}>
                <span className="text-xs font-bold">{pos.id}</span>
                {tire && <span className="text-xs opacity-80">{tire.tread_depth}mm</span>}

                <div className="absolute bottom-full mb-2 hidden group-hover:block z-20 w-32 bg-surface-900 text-white p-2 rounded-lg text-left shadow-xl border border-surface-700">
                    <p className="text-xs font-bold border-b border-surface-700 pb-1 mb-1">{pos.label}</p>
                    {tire ? (
                        <>
                            <p className="text-xs">Marca: {tire.brand}</p>
                            <p className="text-xs">Sulco: {tire.tread_depth}mm</p>
                            <p className="text-xs">Recap: {tire.retread_count}</p>
                        </>
                    ) : (
                        <p className="text-xs">Não instalado</p>
                    )}
                </div>
            </div>
        </button>
    )
}
