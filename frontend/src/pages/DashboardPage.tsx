import { useQuery } from '@tanstack/react-query'
import {
    BarChart3, FileText, Users, DollarSign, TrendingUp,
    Clock, CheckCircle2, Wallet, Receipt, AlertCircle, Scale, AlertTriangle,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/stores/auth-store'
import { Badge } from '@/components/ui/Badge'
import api from '@/lib/api'

const fmtBRL = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

const statusConfig: Record<string, { label: string; variant: any; color: string }> = {
    pending: { label: 'Pendente', variant: 'warning', color: 'text-amber-600' },
    in_progress: { label: 'Em Andamento', variant: 'info', color: 'text-sky-600' },
    completed: { label: 'Concluída', variant: 'success', color: 'text-emerald-600' },
    cancelled: { label: 'Cancelada', variant: 'danger', color: 'text-red-600' },
}

export function DashboardPage() {
    const { user } = useAuthStore()

    const { data: statsRes, isLoading } = useQuery({
        queryKey: ['dashboard-stats'],
        queryFn: () => api.get('/dashboard-stats'),
        refetchInterval: 60_000,
    })

    const s = statsRes?.data ?? {}

    const cards = [
        { label: 'OS Abertas', value: s.open_os ?? 0, icon: FileText, color: 'text-brand-600 bg-brand-50' },
        { label: 'Em Andamento', value: s.in_progress_os ?? 0, icon: Clock, color: 'text-amber-600 bg-amber-50' },
        { label: 'Concluídas (mês)', value: s.completed_month ?? 0, icon: CheckCircle2, color: 'text-emerald-600 bg-emerald-50' },
        { label: 'Faturamento', value: fmtBRL(s.revenue_month ?? 0), icon: DollarSign, color: 'text-blue-600 bg-blue-50' },
    ]

    const cards2 = [
        { label: 'Comissões Pendentes', value: fmtBRL(s.pending_commissions ?? 0), icon: Wallet, color: 'text-sky-600 bg-sky-50' },
        { label: 'Despesas (mês)', value: fmtBRL(s.expenses_month ?? 0), icon: Receipt, color: 'text-red-600 bg-red-50' },
    ]

    const recentOs = s.recent_os ?? []
    const topTechs = s.top_technicians ?? []
    const eqAlerts = s.eq_alerts ?? []
    const eqOverdue = s.eq_overdue ?? 0
    const eqDue7 = s.eq_due_7 ?? 0

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-surface-900">Dashboard</h1>
                <p className="mt-1 text-sm text-surface-500">
                    Olá, {user?.name ?? 'Usuário'}. Aqui está o resumo do dia.
                </p>
            </div>

            {/* KPI Cards */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {cards.map((stat) => (
                    <div key={stat.label}
                        className="group rounded-xl border border-surface-200 bg-white p-5 shadow-card transition-all duration-200 hover:shadow-elevated hover:-translate-y-0.5">
                        <div className="flex items-start justify-between">
                            <div>
                                <p className="text-xs font-medium text-surface-500 uppercase tracking-wider">{stat.label}</p>
                                <p className="mt-2 text-2xl font-bold text-surface-900">{isLoading ? '…' : stat.value}</p>
                            </div>
                            <div className={cn('rounded-lg p-2.5', stat.color)}>
                                <stat.icon className="h-5 w-5" />
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Financial cards */}
            <div className="grid gap-4 sm:grid-cols-2">
                {cards2.map((stat) => (
                    <div key={stat.label} className="rounded-xl border border-surface-200 bg-white p-4 shadow-card">
                        <div className="flex items-center gap-3">
                            <div className={cn('rounded-lg p-2.5', stat.color)}>
                                <stat.icon className="h-5 w-5" />
                            </div>
                            <div>
                                <p className="text-xs text-surface-500">{stat.label}</p>
                                <p className="text-lg font-bold text-surface-900">{isLoading ? '…' : stat.value}</p>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Equipments Alerts Widget */}
            {(eqOverdue > 0 || eqDue7 > 0 || eqAlerts.length > 0) && (
                <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-5 shadow-card">
                    <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                            <Scale size={18} className="text-amber-600" />
                            <h2 className="text-sm font-semibold text-surface-900">Alertas de Calibração</h2>
                        </div>
                        <div className="flex gap-3 text-xs">
                            {eqOverdue > 0 && (
                                <span className="flex items-center gap-1 rounded-full bg-red-100 px-2.5 py-0.5 font-semibold text-red-700">
                                    <AlertTriangle size={12} />{eqOverdue} vencido{eqOverdue > 1 ? 's' : ''}
                                </span>
                            )}
                            {eqDue7 > 0 && (
                                <span className="flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 font-semibold text-amber-700">
                                    <Clock size={12} />{eqDue7} vence em 7d
                                </span>
                            )}
                        </div>
                    </div>
                    <div className="space-y-2">
                        {eqAlerts.map((eq: any) => {
                            const d = new Date(eq.next_calibration_at)
                            const diff = Math.ceil((d.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
                            const isPast = diff < 0
                            return (
                                <div key={eq.id} className="flex items-center justify-between rounded-lg bg-white px-4 py-2.5">
                                    <div className="flex items-center gap-3">
                                        <span className="font-mono text-xs font-medium text-brand-600">{eq.code}</span>
                                        <span className="text-sm text-surface-700">{eq.brand} {eq.model}</span>
                                        {eq.customer && <span className="text-xs text-surface-400">• {eq.customer.name}</span>}
                                    </div>
                                    <span className={cn('rounded-full px-2.5 py-0.5 text-xs font-semibold',
                                        isPast ? 'bg-red-100 text-red-700' : diff <= 7 ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'
                                    )}>
                                        {isPast ? `Vencido ${Math.abs(diff)}d` : `${diff}d restantes`}
                                    </span>
                                </div>
                            )
                        })}
                    </div>
                </div>
            )}

            <div className="grid gap-4 lg:grid-cols-3">
                {/* Recent OS */}
                <div className="lg:col-span-2 rounded-xl border border-surface-200 bg-white shadow-card">
                    <div className="flex items-center justify-between border-b border-surface-200 px-5 py-3">
                        <h2 className="text-sm font-semibold text-surface-900">Últimas Ordens de Serviço</h2>
                    </div>
                    <div className="divide-y divide-surface-100">
                        {isLoading ? (
                            <p className="py-8 text-center text-sm text-surface-400">Carregando...</p>
                        ) : recentOs.length === 0 ? (
                            <div className="py-12 text-center">
                                <AlertCircle className="mx-auto h-8 w-8 text-surface-300" />
                                <p className="mt-2 text-sm text-surface-400">Nenhuma OS encontrada</p>
                            </div>
                        ) : recentOs.map((os: any) => (
                            <div key={os.id} className="flex items-center justify-between px-5 py-3 hover:bg-surface-50 transition-colors">
                                <div className="flex items-center gap-3">
                                    <span className="text-sm font-bold text-brand-600">{os.number}</span>
                                    <span className="text-sm text-surface-700 truncate max-w-[200px]">{os.customer?.name}</span>
                                </div>
                                <div className="flex items-center gap-3">
                                    <span className="text-sm text-surface-500">{os.assignee?.name}</span>
                                    <Badge variant={statusConfig[os.status]?.variant ?? 'default'}>
                                        {statusConfig[os.status]?.label ?? os.status}
                                    </Badge>
                                    <span className="text-sm font-semibold text-surface-900">{fmtBRL(parseFloat(os.total ?? '0'))}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Top Technicians */}
                <div className="rounded-xl border border-surface-200 bg-white shadow-card">
                    <div className="border-b border-surface-200 px-5 py-3">
                        <h2 className="text-sm font-semibold text-surface-900">Top Técnicos (mês)</h2>
                    </div>
                    <div className="divide-y divide-surface-100">
                        {isLoading ? (
                            <p className="py-8 text-center text-sm text-surface-400">Carregando...</p>
                        ) : topTechs.length === 0 ? (
                            <p className="py-8 text-center text-sm text-surface-400">Sem dados</p>
                        ) : topTechs.map((t: any, i: number) => (
                            <div key={t.assignee_id} className="flex items-center justify-between px-5 py-3">
                                <div className="flex items-center gap-3">
                                    <span className={cn('flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold',
                                        i === 0 ? 'bg-amber-100 text-amber-700' : 'bg-surface-100 text-surface-600')}>
                                        {i + 1}
                                    </span>
                                    <span className="text-sm font-medium text-surface-800">{t.assignee?.name}</span>
                                </div>
                                <div className="text-right">
                                    <p className="text-sm font-bold text-surface-900">{t.os_count} OS</p>
                                    <p className="text-[10px] text-surface-400">{fmtBRL(parseFloat(t.total_revenue ?? '0'))}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    )
}
