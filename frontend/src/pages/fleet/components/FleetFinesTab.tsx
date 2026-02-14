import { useQuery , useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { FileWarning, DollarSign, Calendar, User, MapPin, Search } from 'lucide-react'
import { useState , useMemo } from 'react'
import api from '@/lib/api'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/stores/auth-store'

export function FleetFinesTab() {

  // MVP: Delete mutation
  const queryClient = useQueryClient()
  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/fleet-fines/${id}`),
    onSuccess: () => { toast.success('Removido com sucesso'); queryClient.invalidateQueries({ queryKey: ['fleet-fines'] }) },
    onError: (err: any) => { toast.error(err?.response?.data?.message || 'Erro ao remover') },
  })
  const handleDelete = (id: number) => { if (window.confirm('Tem certeza que deseja remover?')) deleteMutation.mutate(id) }
  const { hasPermission } = useAuthStore()

    const [statusFilter, setStatusFilter] = useState('')
    const { data: finesData, isLoading } = useQuery({
        queryKey: ['fleet-fines', statusFilter],
        queryFn: () => api.get('/fleet/vehicles/fines', { params: { status: statusFilter || undefined } }).then(r => r.data)
    })

    const statusMap: Record<string, { label: string; variant: any }> = {
        pending: { label: 'Pendente', variant: 'warning' },
        paid: { label: 'Pago', variant: 'success' },
        contested: { label: 'Contestado', variant: 'info' },
        cancelled: { label: 'Cancelado', variant: 'secondary' },
    }

    const severityLabels: Record<string, string> = {
        light: 'Leve', medium: 'Média', serious: 'Grave', very_serious: 'Gravíssima'
    }

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap gap-2 mb-2">
                {[{ v: '', l: 'Todas' }, { v: 'pending', l: 'Pendentes' }, { v: 'paid', l: 'Pagas' }, { v: 'contested', l: 'Contestadas' }].map(s => (
                    <button
                        key={s.v}
                        onClick={() => setStatusFilter(s.v)}
                        className={cn(
                            "px-3 py-1.5 rounded-lg text-xs font-medium transition-all border",
                            statusFilter === s.v ? "bg-brand-50 border-brand-300 text-brand-700" : "bg-surface-0 border-default text-surface-500 hover:border-brand-200"
                        )}
                    >
                        {s.l}
                    </button>
                ))}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {isLoading && [1, 2].map(i => <div key={i} className="h-44 bg-surface-100 animate-pulse rounded-2xl" />)}
                {finesData?.data?.map((fine: any) => (
                    <div key={fine.id} className="p-5 rounded-2xl border border-default bg-surface-0 hover:shadow-card transition-all space-y-3">
                        <div className="flex items-center justify-between">
                            <Badge variant={statusMap[fine.status]?.variant}>{statusMap[fine.status]?.label}</Badge>
                            <span className={cn(
                                "text-[10px] font-bold px-2 py-0.5 rounded",
                                fine.severity === 'very_serious' ? "bg-red-100 text-red-700" :
                                    fine.severity === 'serious' ? "bg-orange-100 text-orange-700" :
                                        fine.severity === 'medium' ? "bg-amber-100 text-amber-700" : "bg-yellow-100 text-yellow-700"
                            )}>
                                {severityLabels[fine.severity] || fine.severity}
                            </span>
                        </div>

                        <div>
                            <p className="text-sm font-bold text-surface-900">{fine.description || 'Infração de trânsito'}</p>
                            <p className="text-xs text-surface-500">Art. {fine.infraction_code || '—'}</p>
                        </div>

                        <div className="grid grid-cols-3 gap-2 py-2 border-y border-subtle">
                            <div>
                                <p className="text-[10px] uppercase text-surface-400 font-bold">Veículo</p>
                                <span className="px-2 py-0.5 bg-surface-900 text-white text-[10px] font-mono rounded font-bold tracking-wider">
                                    {fine.vehicle?.plate || '—'}
                                </span>
                            </div>
                            <div>
                                <p className="text-[10px] uppercase text-surface-400 font-bold">Data</p>
                                <p className="text-xs text-surface-700 flex items-center gap-1">
                                    <Calendar size={10} className="text-surface-400" />
                                    {fine.infraction_date ? new Date(fine.infraction_date).toLocaleDateString() : '—'}
                                </p>
                            </div>
                            <div>
                                <p className="text-[10px] uppercase text-surface-400 font-bold">Valor</p>
                                <p className="text-xs font-bold text-red-600 flex items-center gap-1">
                                    <DollarSign size={10} /> R$ {Number(fine.fine_value || 0).toFixed(2)}
                                </p>
                            </div>
                        </div>

                        {fine.driver && (
                            <p className="text-[10px] text-surface-500 flex items-center gap-1">
                                <User size={10} className="text-surface-400" /> Motorista: {fine.driver.name}
                            </p>
                        )}
                    </div>
                ))}
                {!isLoading && (!finesData?.data || finesData.data.length === 0) && (
                    <div className="col-span-full py-20 text-center border-2 border-dashed border-surface-200 rounded-3xl">
                        <FileWarning size={40} className="mx-auto text-surface-200 mb-4" />
                        <p className="text-surface-500 font-medium">Nenhuma multa registrada</p>
                    </div>
                )}
            </div>
        </div>
    )
}
