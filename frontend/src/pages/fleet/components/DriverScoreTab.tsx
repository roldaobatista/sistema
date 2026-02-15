import { useQuery , useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Award, TrendingUp, TrendingDown, Minus, Fuel, AlertTriangle, ClipboardCheck, Shield } from 'lucide-react'
import api from '@/lib/api'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/stores/auth-store'

export function DriverScoreTab() {

  // MVP: Delete mutation
  const queryClient = useQueryClient()
  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/driver-score/${id}`),
    onSuccess: () => { toast.success('Removido com sucesso');
                queryClient.invalidateQueries({ queryKey: ['driver-score'] }) },
    onError: (err: any) => { toast.error(err?.response?.data?.message || 'Erro ao remover') },
  })
  const handleDelete = (id: number) => { if (window.confirm('Tem certeza que deseja remover?')) deleteMutation.mutate(id) }

  // MVP: Search
  const [searchTerm, setSearchTerm] = useState('')
  const { hasPermission } = useAuthStore()

    const { data: ranking, isLoading } = useQuery({
        queryKey: ['fleet-driver-ranking'],
        const { data, isLoading } = useQuery({
        queryFn: () => api.get('/fleet/driver-ranking').then(r => r.data?.data)
    })

    return (
        <div className="space-y-6">
            <div className="text-center mb-4">
                <h3 className="text-sm font-semibold text-surface-700">Ranking de Motoristas</h3>
                <p className="text-xs text-surface-500">Pontuação baseada em multas, acidentes, inspeções e eficiência</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {isLoading && [1, 2, 3].map(i => <div key={i} className="h-56 bg-surface-100 animate-pulse rounded-2xl" />)}
                {ranking?.map((driver: any, idx: number) => (
                    <div key={driver.driver_id} className="p-5 rounded-2xl border border-default bg-surface-0 hover:shadow-card transition-all space-y-4">
                        {/* Header com posição e nota */}
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className={cn(
                                    "h-10 w-10 rounded-full flex items-center justify-center font-bold text-lg",
                                    idx === 0 ? "bg-yellow-100 text-yellow-700" :
                                        idx === 1 ? "bg-gray-100 text-gray-600" :
                                            idx === 2 ? "bg-amber-100 text-amber-700" :
                                                "bg-surface-100 text-surface-500"
                                )}>
                                    {idx + 1}°
                                </div>
                                <div>
                                    <p className="font-bold text-surface-900 text-sm">{driver.driver_id}</p>
                                    <p className="text-[10px] text-surface-400">ID do motorista</p>
                                </div>
                            </div>

                            {/* Score Circular */}
                            <div className="relative h-16 w-16">
                                <svg className="h-16 w-16 -rotate-90" viewBox="0 0 64 64">
                                    <circle cx="32" cy="32" r="28" fill="none" stroke="#e5e7eb" strokeWidth="4" />
                                    <circle
                                        cx="32" cy="32" r="28" fill="none"
                                        stroke={driver.score >= 75 ? '#10b981' : driver.score >= 50 ? '#f59e0b' : '#ef4444'}
                                        strokeWidth="4"
                                        strokeDasharray={`${(driver.score / 100) * 175.9} 175.9`}
                                        strokeLinecap="round"
                                    />
                                </svg>
                                <div className="absolute inset-0 flex flex-col items-center justify-center">
                                    <span className="text-lg font-bold text-surface-900">{driver.score}</span>
                                    <span className="text-[8px] font-bold text-surface-400">{driver.grade}</span>
                                </div>
                            </div>
                        </div>

                        {/* Breakdown */}
                        <div className="space-y-2 pt-2 border-t border-subtle">
                            {driver.breakdown && Object.entries(driver.breakdown).map(([key, val]: [string, any]) => (
                                <div key={key} className="flex items-center justify-between text-xs">
                                    <div className="flex items-center gap-2 text-surface-600">
                                        {key === 'fines' && <AlertTriangle size={12} className="text-red-400" />}
                                        {key === 'accidents' && <Shield size={12} className="text-red-400" />}
                                        {key === 'inspections' && <ClipboardCheck size={12} className="text-emerald-400" />}
                                        {key === 'fuel_efficiency' && <Fuel size={12} className="text-blue-400" />}
                                        {val.label}
                                    </div>
                                    <span className={cn(
                                        "font-bold font-mono",
                                        (val.penalty && val.penalty < 0) || (val.score && val.score < 0) ? "text-red-500" : "text-emerald-500"
                                    )}>
                                        {val.penalty ? val.penalty : val.bonus ? `+${val.bonus}` : val.score > 0 ? `+${val.score}` : val.score}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
                {!isLoading && (!ranking || ranking.length === 0) && (
                    <div className="col-span-full py-20 text-center border-2 border-dashed border-surface-200 rounded-3xl">
                        <Award size={40} className="mx-auto text-surface-200 mb-4" />
                        <p className="text-surface-500 font-medium">Nenhum motorista com score calculado</p>
                    </div>
                )}
            </div>
        </div>
    )
}
