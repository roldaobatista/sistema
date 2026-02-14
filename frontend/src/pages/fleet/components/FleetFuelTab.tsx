import { useState , useMemo } from 'react'
import { toast } from 'sonner'
import { useQuery , useMutation, useQueryClient } from '@tanstack/react-query'
import { Fuel, TrendingUp, Calendar, Search } from 'lucide-react'
import api from '@/lib/api'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/stores/auth-store'

export function FleetFuelTab() {

  // MVP: Delete mutation
  const queryClient = useQueryClient()
  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/fleet-fuel/${id}`),
    onSuccess: () => { toast.success('Removido com sucesso'); queryClient.invalidateQueries({ queryKey: ['fleet-fuel'] }) },
    onError: (err: any) => { toast.error(err?.response?.data?.message || 'Erro ao remover') },
  })
  const handleDelete = (id: number) => { if (window.confirm('Tem certeza que deseja remover?')) deleteMutation.mutate(id) }
  const { hasPermission } = useAuthStore()

    const [vehicleFilter, setVehicleFilter] = useState('')
    const { data: fuelLogs, isLoading } = useQuery({
        queryKey: ['fleet-fuel-logs', vehicleFilter],
        queryFn: () => api.get('/fleet/fuel-logs', { params: { search: vehicleFilter || undefined } }).then(r => r.data)
    })

    const fuelTypeLabels: Record<string, string> = {
        flex: 'Flex', diesel: 'Diesel', gasoline: 'Gasolina', ethanol: 'Etanol', electric: 'Elétrico'
    }

    return (
        <div className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
                <div className="relative w-full sm:max-w-xs">
                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-400" />
                    <input
                        type="text"
                        placeholder="Filtrar por placa..."
                        value={vehicleFilter}
                        onChange={e => setVehicleFilter(e.target.value)}
                        className="w-full rounded-xl border border-default bg-surface-0 py-2.5 pl-10 pr-4 text-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100 transition-all"
                    />
                </div>
            </div>

            <div className="overflow-x-auto rounded-2xl border border-default">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="bg-surface-50 border-b border-default">
                            <th className="px-4 py-3 text-left text-[10px] uppercase font-bold text-surface-500">Data</th>
                            <th className="px-4 py-3 text-left text-[10px] uppercase font-bold text-surface-500">Veículo</th>
                            <th className="px-4 py-3 text-left text-[10px] uppercase font-bold text-surface-500">Combustível</th>
                            <th className="px-4 py-3 text-right text-[10px] uppercase font-bold text-surface-500">Litros</th>
                            <th className="px-4 py-3 text-right text-[10px] uppercase font-bold text-surface-500">R$/L</th>
                            <th className="px-4 py-3 text-right text-[10px] uppercase font-bold text-surface-500">Total</th>
                            <th className="px-4 py-3 text-right text-[10px] uppercase font-bold text-surface-500">Odômetro</th>
                        </tr>
                    </thead>
                    <tbody>
                        {isLoading && [1, 2, 3].map(i => (
                            <tr key={i}><td colSpan={7} className="px-4 py-3"><div className="h-4 bg-surface-100 animate-pulse rounded" /></td></tr>
                        ))}
                        {fuelLogs?.data?.map((log: any) => (
                            <tr key={log.id} className="border-b border-subtle hover:bg-surface-50 transition-colors">
                                <td className="px-4 py-3 text-surface-700 font-medium flex items-center gap-2">
                                    <Calendar size={14} className="text-surface-400" />
                                    {new Date(log.log_date).toLocaleDateString()}
                                </td>
                                <td className="px-4 py-3">
                                    <span className="px-2 py-0.5 bg-surface-900 text-white text-[10px] font-mono rounded font-bold tracking-wider">
                                        {log.vehicle?.plate || '—'}
                                    </span>
                                </td>
                                <td className="px-4 py-3">
                                    <Badge variant="info">{fuelTypeLabels[log.fuel_type] || log.fuel_type}</Badge>
                                </td>
                                <td className="px-4 py-3 text-right font-mono text-surface-700">{Number(log.liters).toFixed(1)}L</td>
                                <td className="px-4 py-3 text-right font-mono text-surface-500">R$ {Number(log.price_per_liter).toFixed(3)}</td>
                                <td className="px-4 py-3 text-right font-bold text-brand-600">R$ {Number(log.total_price).toFixed(2)}</td>
                                <td className="px-4 py-3 text-right font-mono text-surface-500">{Number(log.odometer_km).toLocaleString()} km</td>
                            </tr>
                        ))}
                        {!isLoading && (!fuelLogs?.data || fuelLogs.data.length === 0) && (
                            <tr>
                                <td colSpan={7} className="py-16 text-center text-surface-400">
                                    <Fuel size={32} className="mx-auto mb-3 text-surface-200" />
                                    Nenhum abastecimento registrado
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    )
}
