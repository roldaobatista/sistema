import { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useNavigate } from 'react-router-dom'
import {
    FileText, DollarSign, Clock, CheckCircle, AlertCircle,
    ArrowRight, Package, TrendingUp,
} from 'lucide-react'
import api from '@/lib/api'
import { cn } from '@/lib/utils'
import { WORK_ORDER_STATUS, QUOTE_STATUS } from '@/lib/constants'

const statusConfig: Record<string, { label: string; color: string; bg: string }> = {
    open: { label: 'Aberta', color: 'text-sky-600', bg: 'bg-sky-100' },
    in_progress: { label: 'Em Andamento', color: 'text-amber-600', bg: 'bg-amber-100' },
    waiting_parts: { label: 'Aguardando', color: 'text-orange-600', bg: 'bg-orange-100' },
    completed: { label: 'Concluída', color: 'text-emerald-600', bg: 'bg-emerald-100' },
    cancelled: { label: 'Cancelada', color: 'text-red-600', bg: 'bg-red-100' },
}

const fmtBRL = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

export function PortalDashboardPage() {
    const navigate = useNavigate()

    const { data: workOrders, isLoading: loadingWorkOrders, isError: errorWO } = useQuery({
        queryKey: ['portal-dashboard-os'],
        queryFn: () => api.get('/portal/work-orders').then(res => res.data),
    })

    const { data: quotes, isLoading: loadingQuotes, isError: errorQuotes } = useQuery({
        queryKey: ['portal-dashboard-quotes'],
        queryFn: () => api.get('/portal/quotes').then(res => res.data),
    })

    const { data: financials, isLoading: loadingFinancials, isError: errorFin } = useQuery({
        queryKey: ['portal-dashboard-financials'],
        queryFn: () => api.get('/portal/financials').then(res => res.data),
    })

    useEffect(() => {
        if (errorWO) toast.error('Erro ao carregar ordens de serviço')
        if (errorQuotes) toast.error('Erro ao carregar orçamentos')
        if (errorFin) toast.error('Erro ao carregar financeiro')
    }, [errorWO, errorQuotes, errorFin])

    const osList: any[] = workOrders?.data ?? []
    const quoteList: any[] = quotes?.data ?? []
    const finList: any[] = financials ?? []
    const isLoading = loadingWorkOrders || loadingQuotes || loadingFinancials

    const openOS = osList.filter(os => os.status !== WORK_ORDER_STATUS.COMPLETED && os.status !== WORK_ORDER_STATUS.CANCELLED).length
    const completedOS = osList.filter(os => os.status === WORK_ORDER_STATUS.COMPLETED).length
    const pendingQuotes = quoteList.filter((q: any) => q.status === QUOTE_STATUS.SENT).length
    const pendingFinancials = finList.length
    const totalPending = finList.reduce((acc: number, f: any) => acc + parseFloat(f.amount ?? 0), 0)

    const cards = [
        { label: 'OS Abertas', value: openOS, icon: FileText, color: 'text-brand-600 bg-brand-50', link: '/portal/os' },
        { label: 'OS Concluídas', value: completedOS, icon: CheckCircle, color: 'text-emerald-600 bg-emerald-50', link: '/portal/os' },
        { label: 'Orçamentos', value: pendingQuotes, icon: Package, color: 'text-amber-600 bg-amber-50', link: '/portal/orcamentos' },
        { label: 'Faturas', value: fmtBRL(totalPending), icon: DollarSign, color: 'text-red-600 bg-red-50', link: '/portal/financeiro' },
    ]

    // Recent 5 OS
    const recentOS = osList.slice(0, 5)

    // Status tracking steps
    const trackingSteps = ['open', 'in_progress', 'completed']

    return (
        <div className="space-y-5">
            <div>
                <h1 className="text-lg font-semibold text-surface-900 tracking-tight">Portal do Cliente</h1>
                <p className="mt-0.5 text-[13px] text-surface-500">Acompanhe suas ordens de serviço, orçamentos e faturas.</p>
            </div>
            {isLoading && (
                <div className="rounded-xl border border-default bg-surface-0 p-5 shadow-card text-sm text-surface-500">
                    Carregando dados do portal...
                </div>
            )}

            {/* KPI Cards */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {cards.map(c => (
                    <button key={c.label} onClick={() => navigate(c.link)}
                        className="rounded-xl border border-default bg-surface-0 p-5 shadow-card text-left transition-all hover:shadow-elevated hover:-translate-y-0.5 group">
                        <div className="flex items-start justify-between">
                            <div>
                                <p className="text-xs font-medium text-surface-500 uppercase tracking-wider">{c.label}</p>
                                <p className="mt-2 text-lg font-semibold text-surface-900 tracking-tight">{c.value}</p>
                            </div>
                            <div className={cn('rounded-lg p-2.5', c.color)}>
                                <c.icon className="h-5 w-5" />
                            </div>
                        </div>
                        <div className="mt-3 flex items-center text-xs text-brand-600 font-medium group-hover:underline">
                            Ver detalhes <ArrowRight className="h-3 w-3 ml-1" />
                        </div>
                    </button>
                ))}
            </div>

            {/* Recent OS with Status Tracking */}
            <div className="rounded-xl border border-default bg-surface-0 shadow-card">
                <div className="flex items-center justify-between border-b border-subtle px-5 py-3">
                    <h2 className="text-sm font-semibold text-surface-900">Ãšltimas Ordens de Serviço</h2>
                    <button onClick={() => navigate('/portal/os')} className="text-xs text-brand-600 font-medium hover:underline">
                        Ver todas â†’
                    </button>
                </div>
                {recentOS.length === 0 ? (
                    <div className="py-12 text-center">
                        <AlertCircle className="mx-auto h-8 w-8 text-surface-300" />
                        <p className="mt-2 text-sm text-surface-400">Nenhuma OS encontrada</p>
                    </div>
                ) : (
                    <div className="divide-y divide-subtle">
                        {recentOS.map((os: any) => {
                            const currentIdx = trackingSteps.indexOf(
                                os.status === WORK_ORDER_STATUS.COMPLETED ? 'completed' :
                                    os.status === WORK_ORDER_STATUS.IN_PROGRESS || os.status === WORK_ORDER_STATUS.WAITING_PARTS ? 'in_progress' : 'open'
                            )
                            return (
                                <div key={os.id} className="px-5 py-4 hover:bg-surface-50 transition-colors duration-100">
                                    <div className="flex items-center justify-between mb-3">
                                        <div className="flex items-center gap-3">
                                            <span className="text-sm font-bold text-brand-600">{os.number}</span>
                                            <span className="text-sm text-surface-700 truncate max-w-xs">{os.description}</span>
                                        </div>
                                        <span className={cn('text-xs font-semibold px-2.5 py-1 rounded-full',
                                            statusConfig[os.status]?.bg ?? 'bg-surface-100',
                                            statusConfig[os.status]?.color ?? 'text-surface-600'
                                        )}>
                                            {statusConfig[os.status]?.label ?? os.status}
                                        </span>
                                    </div>
                                    {/* Tracking Progress */}
                                    <div className="flex items-center gap-1">
                                        {trackingSteps.map((step, i) => (
                                            <div key={step} className="flex items-center flex-1">
                                                <div className={cn(
                                                    'h-2 w-2 rounded-full flex-shrink-0 transition-colors',
                                                    i <= currentIdx ? 'bg-brand-500' : 'bg-surface-300'
                                                )} />
                                                <div className={cn(
                                                    'flex-1 h-0.5 mx-1',
                                                    i < currentIdx ? 'bg-brand-500' : 'bg-surface-200',
                                                    i === trackingSteps.length - 1 && 'hidden'
                                                )} />
                                            </div>
                                        ))}
                                    </div>
                                    <div className="flex items-center justify-between mt-2 text-[10px] text-surface-400">
                                        <span>Aberta</span>
                                        <span>Em Andamento</span>
                                        <span>Concluída</span>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                )}
            </div>

            {/* Quick Links */}
            <div className="grid gap-3 sm:grid-cols-3">
                <button onClick={() => navigate('/portal/chamados/novo')} className="rounded-xl border border-default bg-surface-0 p-5 shadow-card text-left hover:shadow-elevated transition-all group">
                    <Clock className="h-6 w-6 text-sky-500 mb-2" />
                    <p className="font-semibold text-surface-900 text-sm">Abrir Chamado</p>
                    <p className="text-xs text-surface-400 mt-0.5">Solicite assistência técnica</p>
                </button>
                <button onClick={() => navigate('/portal/orcamentos')} className="rounded-xl border border-default bg-surface-0 p-5 shadow-card text-left hover:shadow-elevated transition-all group">
                    <TrendingUp className="h-6 w-6 text-amber-500 mb-2" />
                    <p className="font-semibold text-surface-900 text-sm">Orçamentos</p>
                    <p className="text-xs text-surface-400 mt-0.5">Veja propostas e aprove</p>
                </button>
                <button onClick={() => navigate('/portal/financeiro')} className="rounded-xl border border-default bg-surface-0 p-5 shadow-card text-left hover:shadow-elevated transition-all group">
                    <DollarSign className="h-6 w-6 text-emerald-500 mb-2" />
                    <p className="font-semibold text-surface-900 text-sm">Financeiro</p>
                    <p className="text-xs text-surface-400 mt-0.5">Faturas e pagamentos</p>
                </button>
            </div>
        </div>
    )
}

