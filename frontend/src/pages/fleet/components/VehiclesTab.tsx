import { useState } from 'react'
import { toast } from 'sonner'
import { useQuery } from '@tanstack/react-query'
import { Search, Plus, Eye, User, Trash2, Truck } from 'lucide-react'
import api from '@/lib/api'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { IconButton } from '@/components/ui/iconbutton'
import { Button } from '@/components/ui/button'
import { useAuthStore } from '@/stores/auth-store'

export function VehiclesTab() {
  const { hasPermission } = useAuthStore()

    const [search, setSearch] = useState('')
    const [page, setPage] = useState(1)

    const { data: vehiclesData, isLoading } = useQuery({
        queryKey: ['fleet-vehicles', search, page],
        queryFn: () => api.get('/fleet/vehicles', { params: { search: search || undefined, page, per_page: 20 } }).then(r => r.data),
    })

    const vehicles = vehiclesData?.data ?? []

    return (
        <div className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
                <div className="relative w-full sm:max-w-xs">
                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-400" />
                    <input
                        type="text"
                        placeholder="Buscar placa ou modelo..."
                        value={search}
                        onChange={e => { setSearch(e.target.value); setPage(1) }}
                        className="w-full rounded-xl border border-default bg-surface-0 py-2.5 pl-10 pr-4 text-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100 transition-all font-medium"
                    />
                </div>
                <Button icon={<Plus size={16} />} className="w-full sm:w-auto">Cadastrar Veículo</Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {isLoading && [1, 2, 3].map(i => <div key={i} className="h-48 bg-surface-100 animate-pulse rounded-2xl" />)}
                {vehicles.map((v: any) => (
                    <div key={v.id} className="group p-5 rounded-2xl border border-default bg-surface-0 hover:border-brand-300 hover:shadow-card transition-all space-y-4">
                        <div className="flex items-center justify-between">
                            <div className="px-3 py-1 bg-surface-900 rounded border-2 border-surface-700 shadow-sm">
                                <span className="text-xs font-mono font-bold text-white tracking-widest">{v.license_plate}</span>
                            </div>
                            <Badge variant={v.status === 'active' ? 'success' : v.status === 'maintenance' ? 'warning' : 'secondary'}>
                                {v.status === 'active' ? 'Ativo' : v.status === 'maintenance' ? 'Manutenção' : v.status}
                            </Badge>
                        </div>

                        <div>
                            <h4 className="font-bold text-surface-900">{v.brand} {v.model}</h4>
                            <p className="text-xs text-surface-500">{v.year} • {v.fuel_type}</p>
                        </div>

                        <div className="grid grid-cols-2 gap-2 py-3 border-y border-subtle">
                            <div>
                                <p className="text-[10px] uppercase text-surface-400 font-bold">Odômetro</p>
                                <p className="text-xs font-semibold text-surface-700">{v.current_mileage_km?.toLocaleString()} km</p>
                            </div>
                            <div>
                                <p className="text-[10px] uppercase text-surface-400 font-bold">Custo/KM</p>
                                <p className="text-xs font-semibold text-brand-600">R$ {Number(v.cost_per_km || 0).toFixed(2)}</p>
                            </div>
                        </div>

                        <div className="flex items-center justify-between pt-1">
                            <div className="flex items-center gap-2">
                                <div className="h-8 w-8 rounded-full bg-surface-100 flex items-center justify-center">
                                    <User size={14} className="text-surface-500" />
                                </div>
                                <span className="text-[11px] text-surface-600 font-medium truncate max-w-[100px]">
                                    {v.assigned_driver?.name ?? 'Sem motorista'}
                                </span>
                            </div>
                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <IconButton icon={<Eye size={14} />} variant="ghost" label="Ver" />
                                <IconButton icon={<Trash2 size={14} />} variant="ghost" label="Excluir" className="text-red-400" />
                            </div>
                        </div>
                    </div>
                ))}
                {!isLoading && vehicles.length === 0 && (
                    <div className="col-span-full py-20 text-center border-2 border-dashed border-surface-200 rounded-3xl">
                        <Truck size={40} className="mx-auto text-surface-200 mb-4" />
                        <p className="text-surface-500">Nenhum veículo encontrado</p>
                    </div>
                )}
            </div>
        </div>
    )
}
