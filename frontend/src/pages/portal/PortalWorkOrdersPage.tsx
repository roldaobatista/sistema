import { useState, useMemo } from 'react'
import { toast } from 'sonner'
import { useQuery , useMutation, useQueryClient } from '@tanstack/react-query'
import { FileText, Search, Clock, CheckCircle, AlertCircle, Wrench, Package, RefreshCw } from 'lucide-react'
import api from '@/lib/api'
import { cn } from '@/lib/utils'
import { WORK_ORDER_STATUS } from '@/lib/constants'
import { useAuthStore } from '@/stores/auth-store'

const statusConfig: Record<string, { label: string; color: string; bg: string; icon: any }> = {
    open: { label: 'Aberta', color: 'text-sky-600', bg: 'bg-sky-100', icon: Clock },
    in_progress: { label: 'Em Andamento', color: 'text-amber-600', bg: 'bg-amber-100', icon: Wrench },
    waiting_parts: { label: 'Aguard. Peças', color: 'text-orange-600', bg: 'bg-orange-100', icon: Package },
    waiting_approval: { label: 'Aguard. Aprovação', color: 'text-violet-600', bg: 'bg-violet-100', icon: AlertCircle },
    completed: { label: 'Concluída', color: 'text-emerald-600', bg: 'bg-emerald-100', icon: CheckCircle },
    delivered: { label: 'Entregue', color: 'text-teal-600', bg: 'bg-teal-100', icon: CheckCircle },
    invoiced: { label: 'Faturada', color: 'text-indigo-600', bg: 'bg-indigo-100', icon: FileText },
    cancelled: { label: 'Cancelada', color: 'text-red-600', bg: 'bg-red-100', icon: AlertCircle },
}

const trackingSteps = [WORK_ORDER_STATUS.OPEN, WORK_ORDER_STATUS.IN_PROGRESS, WORK_ORDER_STATUS.COMPLETED]
const fmtDate = (d: string) => new Date(d).toLocaleDateString('pt-BR')
const fmtBRL = (v: string | number) => Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

export function PortalWorkOrdersPage() {

  // MVP: Delete mutation
  const queryClient = useQueryClient()
  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/portal-work-orders/${id}`),
    onSuccess: () => { toast.success('Removido com sucesso');
                queryClient.invalidateQueries({ queryKey: ['portal-work-orders'] }) },
    onError: (err: any) => { toast.error(err?.response?.data?.message || 'Erro ao remover') },
  })
  const handleDelete = (id: number) => { if (window.confirm('Tem certeza que deseja remover?')) deleteMutation.mutate(id) }
  const { hasPermission } = useAuthStore()

    const [search, setSearch] = useState('')
    const [statusFilter, setStatusFilter] = useState('')

    const { data, isLoading, isError, refetch } = useQuery({
        queryKey: ['portal-work-orders'],
        queryFn: () => api.get('/portal/work-orders').then(res => res.data),
    })

    const all: any[] = data?.data ?? []

    const filtered = useMemo(() => {
        let list = all
        if (statusFilter) list = list.filter(os => os.status === statusFilter)
        if (search) {
            const q = search.toLowerCase()
            list = list.filter(os =>
                (os.number ?? '').toLowerCase().includes(q) ||
                (os.description ?? '').toLowerCase().includes(q)
            )
        }
        return list
    }, [all, statusFilter, search])

    const counts = useMemo(() => {
        const c: Record<string, number> = {}
        Object.keys(statusConfig).forEach(k => c[k] = 0)
        all.forEach(os => { if (c[os.status] !== undefined) c[os.status]++ })
        return c
    }, [all])

    const getStepIndex = (status: string) => {
        if (status === WORK_ORDER_STATUS.DELIVERED || status === WORK_ORDER_STATUS.INVOICED) return 2
        if (status === WORK_ORDER_STATUS.COMPLETED) return 2
        if (status === WORK_ORDER_STATUS.IN_PROGRESS || status === WORK_ORDER_STATUS.WAITING_PARTS || status === WORK_ORDER_STATUS.WAITING_APPROVAL) return 1
        return 0
    }

    return (
        <div className="space-y-5">
            <div>
                <h1 className="text-lg font-semibold text-surface-900 tracking-tight">Minhas Ordens de Serviço</h1>
                <p className="mt-0.5 text-sm text-surface-500">Acompanhe o progresso dos seus serviços</p>
            </div>

            <div className="flex flex-wrap gap-2">
                <button onClick={() => setStatusFilter('')}
                    className={cn('px-3 py-1.5 rounded-full text-xs font-medium border transition-colors',
                        !statusFilter ? 'bg-brand-600 text-white border-brand-600' : 'bg-surface-0 text-surface-600 border-default hover:bg-surface-50'
                    )}>
                    Todas ({all.length})
                </button>
                {Object.entries(statusConfig).map(([key, cfg]) => (
                    counts[key] > 0 && (
                        <button key={key} onClick={() => setStatusFilter(statusFilter === key ? '' : key)}
                            className={cn('px-3 py-1.5 rounded-full text-xs font-medium border transition-colors',
                                statusFilter === key ? `${cfg.bg} ${cfg.color} border-current` : 'bg-surface-0 text-surface-600 border-default hover:bg-surface-50'
                            )}>
                            {cfg.label} ({counts[key]})
                        </button>
                    )
                ))}
            </div>

            <div className="relative max-w-sm">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-surface-400" />
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar OS..."
                    className="w-full rounded-lg border border-default bg-surface-50 py-2.5 pl-10 pr-4 text-sm focus:border-brand-500 focus:outline-none" />
            </div>

            {isLoading ? (
                <div className="space-y-3">
                    {[1, 2, 3].map(i => (
                        <div key={i} className="animate-pulse rounded-xl border border-default bg-surface-0 p-5 shadow-card">
                            <div className="flex items-start justify-between mb-3">
                                <div className="flex items-center gap-3">
                                    <div className="h-9 w-9 rounded-lg bg-surface-200" />
                                    <div className="space-y-1">
                                        <div className="h-4 w-16 rounded bg-surface-200" />
                                        <div className="h-3 w-20 rounded bg-surface-100" />
                                    </div>
                                </div>
                                <div className="h-6 w-24 rounded-full bg-surface-200" />
                            </div>
                            <div className="h-4 w-3/4 rounded bg-surface-100 mb-3" />
                            <div className="flex gap-6">
                                <div className="h-3 w-24 rounded bg-surface-100" />
                                <div className="h-3 w-20 rounded bg-surface-100" />
                            </div>
                        </div>
                    ))}
                </div>
            ) : isError ? (
                <div className="text-center py-12">
                    <RefreshCw className="mx-auto h-10 w-10 text-red-300" />
                    <p className="mt-2 text-sm text-surface-400">Erro ao carregar ordens de serviço</p>
                    <button onClick={() => refetch()} className="mt-3 text-sm text-brand-600 hover:text-brand-700 font-medium">Tentar novamente</button>
                </div>
            ) : filtered.length === 0 ? (
                <div className="text-center py-12">
                    <FileText className="mx-auto h-10 w-10 text-surface-300" />
                    <p className="mt-2 text-sm text-surface-400">Nenhuma OS encontrada</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {filtered.map((os: any) => {
                        const cfg = statusConfig[os.status] ?? statusConfig.open
                        const stepIdx = getStepIndex(os.status)
                        const StatusIcon = cfg.icon
                        return (
                            <div key={os.id} className="rounded-xl border border-default bg-surface-0 p-5 shadow-card hover:shadow-elevated transition-all">
                                <div className="flex items-start justify-between mb-3">
                                    <div className="flex items-center gap-3">
                                        <div className={cn('rounded-lg p-2', cfg.bg)}>
                                            <StatusIcon className={cn('h-4 w-4', cfg.color)} />
                                        </div>
                                        <div>
                                            <p className="text-sm font-bold text-brand-600">{os.number ?? `#${os.id}`}</p>
                                            <p className="text-xs text-surface-400">{fmtDate(os.created_at)}</p>
                                        </div>
                                    </div>
                                    <span className={cn('text-xs font-semibold px-2.5 py-1 rounded-full', cfg.bg, cfg.color)}>
                                        {cfg.label}
                                    </span>
                                </div>

                                {os.description && (
                                    <p className="text-sm text-surface-700 mb-3 line-clamp-2">{os.description}</p>
                                )}

                                <div className="flex flex-wrap gap-4 text-xs text-surface-500 mb-4">
                                    {os.assignee?.name && <span>Técnico: <strong className="text-surface-700">{os.assignee.name}</strong></span>}
                                    {os.total && parseFloat(os.total) > 0 && <span>Valor: <strong className="text-surface-700">{fmtBRL(os.total)}</strong></span>}
                                </div>

                                {os.status !== 'cancelled' && (
                                    <div>
                                        <div className="flex items-center gap-1">
                                            {trackingSteps.map((step, i) => (
                                                <div key={step} className="flex items-center flex-1">
                                                    <div className={cn(
                                                        'h-2.5 w-2.5 rounded-full flex-shrink-0 transition-colors border-2',
                                                        i <= stepIdx ? 'bg-brand-500 border-brand-500' : 'bg-surface-0 border-default'
                                                    )} />
                                                    {i < trackingSteps.length - 1 && (
                                                        <div className={cn(
                                                            'flex-1 h-0.5 mx-1',
                                                            i < stepIdx ? 'bg-brand-500' : 'bg-surface-200'
                                                        )} />
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                        <div className="flex justify-between mt-1.5 text-xs text-surface-400">
                                            <span>Aberta</span>
                                            <span>Em Andamento</span>
                                            <span>Concluída</span>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )
                    })}
                </div>
            )}
        </div>
    )
}
