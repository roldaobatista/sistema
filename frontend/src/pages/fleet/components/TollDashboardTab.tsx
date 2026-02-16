import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Receipt, Plus, DollarSign, Calendar, MapPin, Trash2 } from 'lucide-react'
import api from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { useAuthStore } from '@/stores/auth-store'

export function TollDashboardTab() {
  const { hasPermission } = useAuthStore()

    const queryClient = useQueryClient()
    const [vehicleFilter, setVehicleFilter] = useState('')

    const { data: tolls, isLoading } = useQuery({
        queryKey: ['fleet-tolls', vehicleFilter],
        queryFn: () => api.get('/fleet/tolls', { params: { fleet_vehicle_id: vehicleFilter || undefined } }).then(r => r.data)
    })

    const { data: summary } = useQuery({
        queryKey: ['fleet-tolls-summary'],
        queryFn: () => api.get('/fleet/tolls/summary').then(r => r.data)
    })

    const deleteMutation = useMutation({
        mutationFn: (id: number) => api.delete(`/fleet/tolls/${id}`),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['fleet-tolls'] })
            queryClient.invalidateQueries({ queryKey: ['fleet-tolls-summary'] })
            toast.success('Pedágio removido')
        },
        onError: () => toast.error('Erro ao remover')
    })

    return (
        <div className="space-y-6">
            {summary && (
                <div className="p-5 rounded-2xl bg-gradient-to-r from-brand-50 to-surface-50 border border-brand-200">
                    <div className="flex items-center justify-between mb-4">
                        <h4 className="text-sm font-semibold text-surface-700">Totalização por Veículo</h4>
                        <span className="text-lg font-bold text-brand-700">R$ {Number(summary.grand_total || 0).toLocaleString()}</span>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                        {summary.data?.map((v: any) => (
                            <div key={v.id} className="p-3 bg-surface-0 rounded-xl border border-default shadow-sm">
                                <div className="px-2 py-0.5 bg-surface-900 rounded text-white text-xs font-mono font-bold tracking-wider inline-block mb-2">
                                    {v.plate}
                                </div>
                                <p className="text-sm font-bold text-brand-600">R$ {Number(v.total_value).toLocaleString()}</p>
                                <p className="text-xs text-surface-400">{v.total_passages} passagens</p>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-surface-700">Registros de Pedágio</h3>
                <Button size="sm" icon={<Plus size={14} />}>Novo Pedágio</Button>
            </div>

            <div className="overflow-x-auto rounded-2xl border border-default">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="bg-surface-50 border-b border-default">
                            <th className="px-4 py-3 text-left text-xs uppercase font-bold text-surface-500">Data</th>
                            <th className="px-4 py-3 text-left text-xs uppercase font-bold text-surface-500">Veículo</th>
                            <th className="px-4 py-3 text-left text-xs uppercase font-bold text-surface-500">Praça</th>
                            <th className="px-4 py-3 text-left text-xs uppercase font-bold text-surface-500">Rodovia</th>
                            <th className="px-4 py-3 text-right text-xs uppercase font-bold text-surface-500">Valor</th>
                            <th className="px-4 py-3 text-center text-xs uppercase font-bold text-surface-500">Tag</th>
                            <th className="px-4 py-3 w-10"></th>
                        </tr>
                    </thead>
                    <tbody>
                        {isLoading && [1, 2, 3].map(i => (
                            <tr key={i}><td colSpan={7} className="px-4 py-3"><div className="h-4 bg-surface-100 animate-pulse rounded" /></td></tr>
                        ))}
                        {tolls?.data?.map((t: any) => (
                            <tr key={t.id} className="border-b border-subtle hover:bg-surface-50 transition-colors">
                                <td className="px-4 py-3 text-surface-700 font-medium flex items-center gap-2">
                                    <Calendar size={14} className="text-surface-400" />
                                    {new Date(t.passage_date).toLocaleDateString()}
                                </td>
                                <td className="px-4 py-3">
                                    <span className="px-2 py-0.5 bg-surface-900 text-white text-xs font-mono rounded font-bold tracking-wider">
                                        {t.plate}
                                    </span>
                                </td>
                                <td className="px-4 py-3 text-surface-700 flex items-center gap-1">
                                    <MapPin size={12} className="text-surface-400" /> {t.toll_plaza}
                                </td>
                                <td className="px-4 py-3 text-surface-500">{t.highway || '—'}</td>
                                <td className="px-4 py-3 text-right font-bold text-brand-600">R$ {Number(t.value).toFixed(2)}</td>
                                <td className="px-4 py-3 text-center">
                                    {t.tag_number ? <Badge variant="info">{t.tag_number}</Badge> : <span className="text-surface-300">—</span>}
                                </td>
                                <td className="px-4 py-3">
                                    <button onClick={() => { if (confirm('Remover pedágio?')) deleteMutation.mutate(t.id) }} className="text-red-400 hover:text-red-600 transition-colors">
                                        <Trash2 size={14} />
                                    </button>
                                </td>
                            </tr>
                        ))}
                        {!isLoading && (!tolls?.data || tolls.data.length === 0) && (
                            <tr>
                                <td colSpan={7} className="py-16 text-center text-surface-400">
                                    <Receipt size={32} className="mx-auto mb-3 text-surface-200" />
                                    Nenhum pedágio registrado
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    )
}
