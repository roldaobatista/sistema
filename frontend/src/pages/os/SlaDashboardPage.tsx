import { useQuery , useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Shield, AlertTriangle, CheckCircle, Clock, TrendingUp } from 'lucide-react'
import api from '@/lib/api'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/stores/auth-store'

const priorityConfig: Record<string, { label: string; icon: string; color: string }> = {
    low: { label: 'Baixa', icon: '🟢', color: 'text-surface-600' },
    medium: { label: 'Média', icon: '🟡', color: 'text-amber-600' },
    high: { label: 'Alta', icon: '🟠', color: 'text-orange-600' },
    critical: { label: 'Crítica', icon: '🔴', color: 'text-red-600' },
}
const woIdentifier = (wo?: { number: string; os_number?: string | null; business_number?: string | null } | null) =>
    wo?.business_number ?? wo?.os_number ?? wo?.number ?? '—'

export function SlaDashboardPage() {

  // MVP: Action feedback
  const handleAction = () => { toast.success('Ação realizada com sucesso') }

  // MVP: Search
  const [searchTerm, setSearchTerm] = useState('')
  const { hasPermission } = useAuthStore()

    const { data: overview, isLoading } = useQuery({
        queryKey: ['sla-dashboard-overview'],
        queryFn: () => api.get('/sla-dashboard/overview'),
    })
    const { data: byPolicy } = useQuery({
        queryKey: ['sla-dashboard-by-policy'],
        queryFn: () => api.get('/sla-dashboard/by-policy'),
    })
    const { data: breached } = useQuery({
        queryKey: ['sla-dashboard-breached'],
        queryFn: () => api.get('/sla-dashboard/breached'),
    })

    const ov = overview?.data
    const policies = byPolicy?.data ?? []
    const breachedOrders = breached?.data?.data ?? []

    if (isLoading) return <p className="text-center py-12 text-surface-400">Carregando...</p>

    return (
        <div className="space-y-5">
            <div>
                <h1 className="text-lg font-semibold text-surface-900 tracking-tight">Dashboard SLA</h1>
                <p className="mt-0.5 text-[13px] text-surface-500">Acompanhamento de cumprimento de SLA em tempo real</p>
            </div>

            {/* KPIs */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <KpiCard icon={<Shield className="h-5 w-5 text-brand-500" />} label="Total com SLA" value={ov?.total_com_sla ?? 0} />
                <KpiCard icon={<CheckCircle className="h-5 w-5 text-emerald-500" />} label="Resposta OK" value={`${ov?.response?.taxa ?? 0}%`} sub={`${ov?.response?.cumprido ?? 0} de ${(ov?.response?.cumprido ?? 0) + (ov?.response?.estourado ?? 0)}`} />
                <KpiCard icon={<AlertTriangle className="h-5 w-5 text-red-500" />} label="Resposta Estourada" value={ov?.response?.estourado ?? 0} danger />
                <KpiCard icon={<TrendingUp className="h-5 w-5 text-emerald-500" />} label="Resolução OK" value={`${ov?.resolution?.taxa ?? 0}%`} sub={`${ov?.resolution?.cumprido ?? 0} resolvidas`} />
                <KpiCard icon={<Clock className="h-5 w-5 text-amber-500" />} label="Em Risco" value={ov?.em_risco ?? 0} warning />
            </div>

            {/* Por Política */}
            <div className="rounded-xl border border-default bg-surface-0 shadow-card">
                <div className="border-b border-surface-100 px-5 py-3">
                    <h2 className="text-sm font-bold text-surface-900">Compliance por Política</h2>
                </div>
                <div className="divide-y divide-surface-50">
                    {policies.map((p: any) => {
                        const pri = priorityConfig[p.priority] ?? priorityConfig.medium
                        return (
                            <div key={p.id} className="flex items-center justify-between px-5 py-3">
                                <div className="flex items-center gap-3">
                                    <span className="text-lg">{pri.icon}</span>
                                    <div>
                                        <p className="text-[13px] font-medium text-surface-900">{p.name}</p>
                                        <p className="text-xs text-surface-500">{p.total} OS • {p.breached} estouradas</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <div className="w-32 h-2 rounded-full bg-surface-100 overflow-hidden">
                                        <div className={cn('h-full rounded-full transition-all', p.compliance_rate >= 90 ? 'bg-emerald-500' : p.compliance_rate >= 70 ? 'bg-amber-500' : 'bg-red-500')}
                                            style={{ width: `${p.compliance_rate}%` }} />
                                    </div>
                                    <span className={cn('text-sm font-bold w-14 text-right', p.compliance_rate >= 90 ? 'text-emerald-600' : p.compliance_rate >= 70 ? 'text-amber-600' : 'text-red-600')}>
                                        {p.compliance_rate}%
                                    </span>
                                </div>
                            </div>
                        )
                    })}
                    {policies.length === 0 && (
                        <p className="px-5 py-6 text-sm text-surface-400 text-center">Nenhuma política com OS associadas</p>
                    )}
                </div>
            </div>

            {/* OS com SLA estourado */}
            <div className="rounded-xl border border-default bg-surface-0 shadow-card">
                <div className="border-b border-surface-100 px-5 py-3">
                    <h2 className="text-sm font-bold text-surface-900">OS com SLA Estourado</h2>
                </div>
                {breachedOrders.length === 0 ? (
                    <p className="px-5 py-8 text-sm text-surface-400 text-center">🎉 Nenhuma OS com SLA estourado!</p>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead><tr className="bg-surface-50 text-surface-500">
                                <th className="px-4 py-2 text-left font-medium">OS</th>
                                <th className="px-4 py-2 text-left font-medium">Cliente</th>
                                <th className="px-4 py-2 text-left font-medium">Técnico</th>
                                <th className="px-4 py-2 text-left font-medium">SLA</th>
                                <th className="px-4 py-2 text-left font-medium">Breach</th>
                            </tr></thead>
                            <tbody className="divide-y divide-surface-50">
                                {breachedOrders.map((wo: any) => (
                                    <tr key={wo.id} className="hover:bg-red-50/30">
                                        <td className="px-4 py-2 font-mono text-brand-600">{woIdentifier(wo)}</td>
                                        <td className="px-4 py-2">{wo.customer?.name ?? '—'}</td>
                                        <td className="px-4 py-2">{wo.assignee?.name ?? '—'}</td>
                                        <td className="px-4 py-2">{wo.sla_policy?.name ?? '—'}</td>
                                        <td className="px-4 py-2">
                                            {wo.sla_response_breached && <span className="inline-flex mr-1 rounded-full bg-red-100 px-2 py-0.5 text-xs text-red-700">Resposta</span>}
                                            {wo.sla_resolution_breached && <span className="inline-flex rounded-full bg-orange-100 px-2 py-0.5 text-xs text-orange-700">Resolução</span>}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    )
}

function KpiCard({ icon, label, value, sub, danger, warning }: { icon: React.ReactNode; label: string; value: string | number; sub?: string; danger?: boolean; warning?: boolean }) {
    return (
        <div className={cn('rounded-xl border bg-white p-4 shadow-card', danger && 'border-red-200', warning && 'border-amber-200')}>
            <div className="flex items-center gap-2 mb-2">{icon}<span className="text-xs text-surface-500">{label}</span></div>
            <p className={cn('text-2xl font-bold', danger ? 'text-red-600' : warning ? 'text-amber-600' : 'text-surface-900')}>{value}</p>
            {sub && <p className="text-xs text-surface-400 mt-0.5">{sub}</p>}
        </div>
    )
}
