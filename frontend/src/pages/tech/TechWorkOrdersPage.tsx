import { useEffect, useState, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
    ClipboardList, MapPin, Clock, ChevronRight, Search,
    AlertCircle, Wrench, CheckCircle2, WifiOff,
    PlayCircle, Navigation2, Phone, Timer, Pin,
} from 'lucide-react'
import { toast } from 'sonner'
import { useOfflineStore } from '@/hooks/useOfflineStore'
import { cn } from '@/lib/utils'
import api from '@/lib/api'
import type { OfflineWorkOrder } from '@/lib/offlineDb'
import { ListSkeleton } from '@/components/tech/TechSkeleton'
import { usePullToRefresh } from '@/hooks/usePullToRefresh'
import { PullToRefreshIndicator } from '@/components/tech/PullToRefreshIndicator'

function getSlaInfo(slaDueAt: string | null | undefined, status: string): { label: string; color: string } | null {
    if (!slaDueAt || status === 'completed' || status === 'cancelled') return null
    const now = new Date()
    const due = new Date(slaDueAt)
    const diffMs = due.getTime() - now.getTime()
    const diffHours = diffMs / (1000 * 60 * 60)

    if (diffHours < 0) return { label: 'SLA Estourado', color: 'bg-red-500 text-white' }
    if (diffHours < 2) return { label: `${Math.ceil(diffHours * 60)}min`, color: 'bg-red-100 text-red-700 dark:bg-red-900/30' }
    if (diffHours < 24) return { label: `${Math.ceil(diffHours)}h`, color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30' }
    return { label: `${Math.ceil(diffHours / 24)}d`, color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30' }
}

const STATUS_MAP: Record<string, { label: string; color: string; icon: typeof Clock }> = {
    pending: { label: 'Pendente', color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30', icon: Clock },
    in_progress: { label: 'Em Andamento', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400', icon: Wrench },
    completed: { label: 'Concluída', color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30', icon: CheckCircle2 },
    cancelled: { label: 'Cancelada', color: 'bg-red-100 text-red-700 dark:bg-red-900/30', icon: AlertCircle },
}

const PRIORITY_COLORS: Record<string, string> = {
    low: 'border-l-surface-300',
    normal: 'border-l-blue-400',
    high: 'border-l-amber-500',
    urgent: 'border-l-red-500',
}

export default function TechWorkOrdersPage() {

    const navigate = useNavigate()
    const { items: offlineOrders, putMany, isLoading: offlineLoading } = useOfflineStore('work-orders')
    const [pinnedIds, setPinnedIds] = useState<Set<number>>(() => {
        try {
            const saved = localStorage.getItem('tech-pinned-os')
            return new Set(saved ? JSON.parse(saved) : [])
        } catch { return new Set() }
    })
    const [search, setSearch] = useState('')
    const [statusFilter, setStatusFilter] = useState<string>('active')
    const [isOnline] = useState(() => navigator.onLine)
    const [isFetching, setIsFetching] = useState(false)
    const [selectionMode, setSelectionMode] = useState(false)
    const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
    const [batchLoading, setBatchLoading] = useState(false)

    const handleRefresh = useCallback(async () => {
        if (!navigator.onLine) return
        setIsFetching(true)
        try {
            const { data } = await api.get('/tech/sync?since=1970-01-01T00:00:00Z')
            if (data.work_orders?.length > 0) {
                await putMany(data.work_orders as OfflineWorkOrder[])
            }
        } catch {
            toast.error('Não foi possível atualizar a lista. Verifique a conexão.')
        } finally { setIsFetching(false) }
    }, [putMany])

    const { containerRef, isRefreshing, pullDistance } = usePullToRefresh({ onRefresh: handleRefresh })

    // Fetch from API when online, use IndexedDB when offline
    useEffect(() => {
        if (!isOnline) return

        async function fetchAndCache() {
            setIsFetching(true)
            try {
                const { data } = await api.get('/tech/sync?since=1970-01-01T00:00:00Z')
                if (data.work_orders?.length > 0) {
                    await putMany(data.work_orders as OfflineWorkOrder[])
                }
            } catch {
                toast.error('Não foi possível atualizar. Exibindo dados em cache.')
            } finally {
                setIsFetching(false)
            }
        }
        fetchAndCache()
    }, []) // eslint-disable-line react-hooks/exhaustive-deps

    const filtered = offlineOrders.filter((wo) => {
        const matchesSearch = !search || [
            wo.number, wo.os_number, wo.customer_name, wo.description,
        ].some((f) => f?.toLowerCase().includes(search.toLowerCase()))

        const matchesStatus = statusFilter === 'all'
            || (statusFilter === 'active' && !['completed', 'cancelled'].includes(wo.status))
            || wo.status === statusFilter

        return matchesSearch && matchesStatus
    })

    const sorted = useMemo(() => {
        return [...filtered].sort((a, b) => {
            const aPinned = pinnedIds.has(a.id) ? 1 : 0
            const bPinned = pinnedIds.has(b.id) ? 1 : 0
            return bPinned - aPinned
        })
    }, [filtered, pinnedIds])

    const togglePin = (id: number, e: React.MouseEvent) => {
        e.stopPropagation()
        setPinnedIds(prev => {
            const next = new Set(prev)
            if (next.has(id)) next.delete(id)
            else next.add(id)
            localStorage.setItem('tech-pinned-os', JSON.stringify([...next]))
            return next
        })
    }

    const statusFilters = [
        { key: 'active', label: 'Ativas' },
        { key: 'pending', label: 'Pendentes' },
        { key: 'in_progress', label: 'Em Andamento' },
        { key: 'completed', label: 'Concluídas' },
        { key: 'all', label: 'Todas' },
    ]

    const handleQuickStart = async (order: OfflineWorkOrder) => {
        try {
            const updated = { ...order, status: 'in_progress', updated_at: new Date().toISOString() }
            await putMany([updated])
            toast.success(`OS ${order.os_number || order.number} iniciada!`)
        } catch {
            toast.error('Erro ao iniciar OS')
        }
    }

    const toggleSelection = (id: number) => {
        setSelectedIds((prev: Set<number>) => {
            const next = new Set(prev)
            if (next.has(id)) next.delete(id)
            else next.add(id)
            return next
        })
    }

    const handleBatchStart = async () => {
        setBatchLoading(true)
        try {
            const updates = offlineOrders
                .filter(wo => selectedIds.has(wo.id) && wo.status === 'pending')
                .map(wo => ({ ...wo, status: 'in_progress', updated_at: new Date().toISOString() }))
            if (updates.length > 0) await putMany(updates as OfflineWorkOrder[])
            toast.success(`${updates.length} OS iniciadas!`)
            setSelectionMode(false)
            setSelectedIds(new Set())
        } catch {
            toast.error('Erro ao iniciar OS')
        } finally {
            setBatchLoading(false)
        }
    }

    const handleBatchComplete = async () => {
        setBatchLoading(true)
        try {
            const updates = offlineOrders
                .filter(wo => selectedIds.has(wo.id) && wo.status === 'in_progress')
                .map(wo => ({ ...wo, status: 'completed', updated_at: new Date().toISOString() }))
            if (updates.length > 0) await putMany(updates as OfflineWorkOrder[])
            toast.success(`${updates.length} OS concluídas!`)
            setSelectionMode(false)
            setSelectedIds(new Set())
        } catch {
            toast.error('Erro ao concluir OS')
        } finally {
            setBatchLoading(false)
        }
    }

    const loading = offlineLoading || isFetching

    return (
        <div className="flex flex-col h-full">
            {/* Search */}
            <div className="sticky top-0 z-10 bg-card px-4 pt-4 pb-2 space-y-3">
                <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                        <h1 className="text-lg font-bold text-foreground">
                            Ordens de Serviço
                        </h1>
                        {!isOnline && (
                            <span className="inline-flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400">
                                <WifiOff className="w-3 h-3" />offline
                            </span>
                        )}
                    </div>
                    <button
                        onClick={() => { setSelectionMode(!selectionMode); setSelectedIds(new Set()) }}
                        className={cn(
                            'px-2.5 py-1 rounded-lg text-xs font-medium transition-colors',
                            selectionMode
                                ? 'bg-brand-600 text-white'
                                : 'bg-surface-100 text-surface-600'
                        )}
                    >
                        {selectionMode ? `${selectedIds.size} selecionadas` : 'Selecionar'}
                    </button>
                </div>

                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400" />
                    <input
                        type="text"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Buscar OS, cliente..."
                        className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-surface-100 border-0 text-sm placeholder:text-surface-400 focus:ring-2 focus:ring-brand-500/30 focus:outline-none"
                    />
                </div>

                {/* Status filter chips */}
                <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 no-scrollbar">
                    {statusFilters.map((f) => (
                        <button
                            key={f.key}
                            onClick={() => setStatusFilter(f.key)}
                            className={cn(
                                'px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors',
                                statusFilter === f.key
                                    ? 'bg-brand-600 text-white'
                                    : 'bg-surface-100 text-surface-600'
                            )}
                        >
                            {f.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Content */}
            <div ref={containerRef} className="flex-1 overflow-y-auto px-4 pb-4 space-y-2">
                <PullToRefreshIndicator pullDistance={pullDistance} isRefreshing={isRefreshing} />
                {loading && sorted.length === 0 ? (
                    <ListSkeleton count={4} />
                ) : sorted.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 gap-3">
                        <ClipboardList className="w-12 h-12 text-surface-300" />
                        <p className="text-sm text-surface-500">
                            {search ? 'Nenhuma OS encontrada' : 'Nenhuma OS atribuída'}
                        </p>
                    </div>
                ) : (
                    sorted.map((wo) => {
                        const status = STATUS_MAP[wo.status] || STATUS_MAP.pending
                        const StatusIcon = status.icon
                        const priorityKey = wo.priority ?? 'normal'
                        const slaInfo = getSlaInfo(wo.sla_due_at, wo.status)

                        return (
                            <div
                                key={wo.id}
                                role="button"
                                tabIndex={0}
                                onClick={() => selectionMode ? toggleSelection(wo.id) : navigate(`/tech/os/${wo.id}`)}
                                onKeyDown={(e) => e.key === 'Enter' && (selectionMode ? toggleSelection(wo.id) : navigate(`/tech/os/${wo.id}`))}
                                className={cn(
                                    'w-full text-left bg-card rounded-xl p-4 border-l-4 shadow-sm cursor-pointer',
                                    'active:scale-[0.98] transition-transform',
                                    PRIORITY_COLORS[priorityKey] || PRIORITY_COLORS.normal,
                                )}
                            >
                                <div className="flex items-start justify-between gap-2">
                                    {selectionMode && (
                                        <div
                                            className={cn(
                                                'w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5 transition-colors',
                                                selectedIds.has(wo.id)
                                                    ? 'bg-brand-600 border-brand-600'
                                                    : 'border-surface-300'
                                            )}
                                        >
                                            {selectedIds.has(wo.id) && <CheckCircle2 className="w-3 h-3 text-white" />}
                                        </div>
                                    )}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                                            <span className="font-semibold text-sm text-foreground">
                                                {wo.os_number || wo.number}
                                            </span>
                                            <span className={cn(
                                                'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium',
                                                status.color,
                                            )}>
                                                <StatusIcon className="w-3 h-3" />
                                                {status.label}
                                            </span>
                                            {slaInfo && (
                                                <span className={cn('inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-medium', slaInfo.color)}>
                                                    <Timer className="w-2.5 h-2.5" />
                                                    {slaInfo.label}
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-xs text-surface-500 truncate">
                                            {wo.customer_name || 'Cliente não informado'}
                                        </p>
                                        {wo.description && (
                                            <p className="text-xs text-surface-400 line-clamp-1 mt-0.5">
                                                {wo.description}
                                            </p>
                                        )}
                                        <div className="flex items-center gap-3 mt-2 text-[11px] text-surface-400">
                                            {wo.scheduled_date && (
                                                <span className="flex items-center gap-1">
                                                    <Clock className="w-3 h-3" />
                                                    {new Date(wo.scheduled_date).toLocaleDateString('pt-BR')}
                                                </span>
                                            )}
                                            {wo.city && (
                                                <span className="flex items-center gap-1">
                                                    <MapPin className="w-3 h-3" />
                                                    {wo.city}
                                                </span>
                                            )}
                                        </div>
                                        {!['completed', 'cancelled'].includes(wo.status) && (
                                            <div className="flex items-center gap-2 mt-2.5 pt-2.5 border-t border-surface-100">
                                                {wo.status === 'pending' && (
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); handleQuickStart(wo) }}
                                                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-brand-50 text-brand-600 text-[11px] font-medium active:scale-95 transition-all"
                                                    >
                                                        <PlayCircle className="w-3.5 h-3.5" /> Iniciar
                                                    </button>
                                                )}
                                                {wo.customer_address && (
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation()
                                                            const addr = encodeURIComponent(`${wo.customer_address || ''} ${wo.city || ''}`)
                                                            window.open(`https://www.google.com/maps/dir/?api=1&destination=${addr}`, '_blank')
                                                        }}
                                                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-50 text-emerald-600 dark:text-emerald-400 text-[11px] font-medium active:scale-95 transition-all"
                                                    >
                                                        <Navigation2 className="w-3.5 h-3.5" /> Navegar
                                                    </button>
                                                )}
                                                {wo.customer_phone && (
                                                    <a
                                                        href={`tel:${wo.customer_phone}`}
                                                        onClick={(e) => e.stopPropagation()}
                                                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-blue-50 text-blue-600 dark:text-blue-400 text-[11px] font-medium active:scale-95 transition-all"
                                                    >
                                                        <Phone className="w-3.5 h-3.5" /> Ligar
                                                    </a>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-1 flex-shrink-0">
                                        <button
                                            onClick={(e) => togglePin(wo.id, e)}
                                            className="p-1 rounded-lg"
                                        >
                                            <Pin className={cn('w-3.5 h-3.5', pinnedIds.has(wo.id) ? 'text-brand-600 fill-brand-600' : 'text-surface-300')} />
                                        </button>
                                        <ChevronRight className="w-5 h-5 text-surface-300 mt-1" />
                                    </div>
                                </div>
                            </div>
                        )
                    })
                )}
            </div>

            {selectionMode && selectedIds.size > 0 && (
                <div className="sticky bottom-0 p-3 bg-card border-t border-border flex gap-2 safe-area-bottom">
                    <button
                        onClick={handleBatchStart}
                        disabled={batchLoading}
                        className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-brand-600 text-white text-xs font-medium"
                    >
                        <PlayCircle className="w-4 h-4" /> Iniciar Todas
                    </button>
                    <button
                        onClick={handleBatchComplete}
                        disabled={batchLoading}
                        className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-emerald-600 text-white text-xs font-medium"
                    >
                        <CheckCircle2 className="w-4 h-4" /> Concluir Todas
                    </button>
                </div>
            )}
        </div>
    )
}
