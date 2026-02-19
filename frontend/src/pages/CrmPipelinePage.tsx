import React, { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useParams, Link } from 'react-router-dom'
import {
    DndContext, closestCorners, PointerSensor, useSensor, useSensors,
    type DragEndEvent, type DragStartEvent, DragOverlay,
} from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { useDroppable } from '@dnd-kit/core'
import {
    Plus, ArrowLeft, Loader2, LayoutGrid, List, Search, X,
    ArrowUpDown, ArrowUp, ArrowDown, Trash2, Trophy, Ban, MoveRight,
    Download, Upload,
} from 'lucide-react'
import { cn, formatCurrency } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { DealCard } from '@/components/crm/DealCard'
import { DealDetailDrawer } from '@/components/crm/DealDetailDrawer'
import { NewDealModal } from '@/components/crm/NewDealModal'
import { crmApi, type CrmDeal, type CrmPipeline, type CrmPipelineStage } from '@/lib/crm-api'
import { crmFeaturesApi } from '@/lib/crm-features-api'
import { toast } from 'sonner'
import { broadcastQueryInvalidation } from '@/lib/cross-tab-sync'
import { useAuthStore } from '@/stores/auth-store'

type ViewMode = 'kanban' | 'table'
type SortField = 'title' | 'value' | 'probability' | 'expected_close_date' | 'updated_at'
type SortDir = 'asc' | 'desc'

export function CrmPipelinePage() {
    const { hasPermission } = useAuthStore()

    const { id: routeId } = useParams()
    const queryClient = useQueryClient()
    const [selectedDealId, setSelectedDealId] = useState<number | null>(null)
    const [drawerOpen, setDrawerOpen] = useState(false)
    const [newDealOpen, setNewDealOpen] = useState(false)
    const [newDealStageId, setNewDealStageId] = useState<number | null>(null)
    const [activeDeal, setActiveDeal] = useState<CrmDeal | null>(null)
    const [statusFilter, setStatusFilter] = useState<string>('open')
    const [viewMode, setViewMode] = useState<ViewMode>('kanban')
    const [searchQuery, setSearchQuery] = useState('')
    const [sortField, setSortField] = useState<SortField>('updated_at')
    const [sortDir, setSortDir] = useState<SortDir>('desc')
    const [selectedDealIds, setSelectedDealIds] = useState<Set<number>>(new Set())

    const { data: pipelines = [], isLoading: pipelinesLoading } = useQuery({
        queryKey: ['crm', 'pipelines'],
        queryFn: () => crmApi.getPipelines().then(r => r.data),
    })

    const pipelineId = routeId ? Number(routeId) : pipelines.find((p: any) => p.is_default)?.id ?? pipelines[0]?.id
    const pipeline = pipelines.find((p: any) => p.id === pipelineId)

    const { data: dealsResponse, isLoading: dealsLoading } = useQuery({
        queryKey: ['crm', 'deals', pipelineId, statusFilter],
        queryFn: () => crmApi.getDeals({ pipeline_id: pipelineId, status: statusFilter, per_page: 200 }).then(r => r.data),
        enabled: !!pipelineId,
    })

    const deals = dealsResponse?.data ?? []

    // Filtered and sorted deals for table view
    const filteredDeals = useMemo(() => {
        let result = [...deals]
        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase()
            result = result.filter(d =>
                d.title?.toLowerCase().includes(q) ||
                (d as any).customer?.name?.toLowerCase().includes(q),
            )
        }
        result.sort((a, b) => {
            let aVal: any, bVal: any
            switch (sortField) {
                case 'title': aVal = a.title?.toLowerCase() ?? ''; bVal = b.title?.toLowerCase() ?? ''; break
                case 'value': aVal = Number(a.value) || 0; bVal = Number(b.value) || 0; break
                case 'probability': aVal = a.probability ?? 0; bVal = b.probability ?? 0; break
                case 'expected_close_date': aVal = a.expected_close_date ?? ''; bVal = b.expected_close_date ?? ''; break
                case 'updated_at': aVal = (a as any).updated_at ?? ''; bVal = (b as any).updated_at ?? ''; break
                default: aVal = ''; bVal = ''
            }
            if (aVal < bVal) return sortDir === 'asc' ? -1 : 1
            if (aVal > bVal) return sortDir === 'asc' ? 1 : -1
            return 0
        })
        return result
    }, [deals, searchQuery, sortField, sortDir])

    // Group deals by stage for kanban
    const dealsByStage = useMemo(() => {
        const map = new Map<number, CrmDeal[]>()
        if (pipeline) {
            (pipeline as any).stages.forEach((s: any) => map.set(s.id, []))
        }
        deals.forEach(d => {
            const list = map.get(d.stage_id)
            if (list) list.push(d)
        })
        return map
    }, [deals, pipeline])

    // DnD
    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    )

    const stageMutation = useMutation({
        mutationFn: ({ dealId, stageId }: { dealId: number; stageId: number }) =>
            crmApi.updateDealStage(dealId, stageId),
        onSuccess: () => {
            toast.success('Operação realizada com sucesso')
            queryClient.invalidateQueries({ queryKey: ['crm'] })
            broadcastQueryInvalidation(['crm'], 'Deal')
        },
        onError: (error: any) => {
            queryClient.invalidateQueries({ queryKey: ['crm', 'deals'] })
            toast.error(error.response?.data?.message || 'Erro ao mover deal de estágio')
        },
    })

    const bulkMutation = useMutation({
        mutationFn: (data: Parameters<typeof crmApi.dealsBulkUpdate>[0]) =>
            crmApi.dealsBulkUpdate(data),
        onSuccess: (res) => {
            toast.success(res.data.message)
            setSelectedDealIds(new Set())
            queryClient.invalidateQueries({ queryKey: ['crm'] })
            broadcastQueryInvalidation(['crm'], 'Deals')
        },
        onError: (error: any) => {
            toast.error(error.response?.data?.message || 'Erro na operação em massa')
        },
    })

    const handleBulkAction = (action: 'move_stage' | 'mark_won' | 'mark_lost' | 'delete', stageId?: number) => {
        const ids = Array.from(selectedDealIds)
        if (ids.length === 0) return
        if (action === 'delete' && !confirm(`Excluir ${ids.length} deal(s) permanentemente?`)) return
        bulkMutation.mutate({ deal_ids: ids, action, ...(stageId ? { stage_id: stageId } : {}) })
    }

    const toggleSelectDeal = (id: number) => {
        setSelectedDealIds(prev => {
            const next = new Set(prev)
            next.has(id) ? next.delete(id) : next.add(id)
            return next
        })
    }

    const toggleSelectAll = () => {
        if (selectedDealIds.size === filteredDeals.length) {
            setSelectedDealIds(new Set())
        } else {
            setSelectedDealIds(new Set(filteredDeals.map(d => d.id)))
        }
    }

    const handleDragStart = (event: DragStartEvent) => {
        const deal = event.active.data?.current?.deal as CrmDeal | undefined
        setActiveDeal(deal ?? null)
    }

    const handleDragEnd = (event: DragEndEvent) => {
        setActiveDeal(null)
        const { active, over } = event
        if (!over) return

        const dealId = active.id as number
        const deal = deals.find(d => d.id === dealId)
        if (!deal) return

        let targetStageId: number | null = null
        if (typeof over.id === 'string' && over.id.startsWith('stage-')) {
            targetStageId = Number(over.id.replace('stage-', ''))
        } else {
            const overDeal = deals.find(d => d.id === over.id)
            if (overDeal) targetStageId = overDeal.stage_id
        }

        if (targetStageId && targetStageId !== deal.stage_id) {
            queryClient.setQueryData(['crm', 'deals', pipelineId, statusFilter], (old: any) => {
                if (!old?.data) return old
                return {
                    ...old,
                    data: old.data.map((d: CrmDeal) =>
                        d.id === dealId ? { ...d, stage_id: targetStageId! } : d,
                    ),
                }
            })
            stageMutation.mutate({ dealId, stageId: targetStageId })
        }
    }

    const openDealDetail = (dealId: number) => {
        setSelectedDealId(dealId)
        setDrawerOpen(true)
    }

    const openNewDeal = (stageId: number) => {
        setNewDealStageId(stageId)
        setNewDealOpen(true)
    }

    const toggleSort = (field: SortField) => {
        if (sortField === field) {
            setSortDir(prev => prev === 'asc' ? 'desc' : 'asc')
        } else {
            setSortField(field)
            setSortDir('desc')
        }
    }

    const SortIcon = ({ field }: { field: SortField }) => {
        if (sortField !== field) return <ArrowUpDown className="h-3 w-3 opacity-30" />
        return sortDir === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
    }

    if (pipelinesLoading) {
        return (
            <div className="flex h-full items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-brand-500" />
            </div>
        )
    }

    return (
        <div className="flex h-full flex-col -m-4 lg:-m-6">
            <div className="flex items-center justify-between border-b border-default bg-surface-0 px-5 py-3">
                <div className="flex items-center gap-3">
                    <Link to="/crm" className="rounded-lg p-1.5 text-surface-400 hover:bg-surface-100 hover:text-surface-600 transition-colors">
                        <ArrowLeft className="h-5 w-5" />
                    </Link>
                    <div>
                        <h1 className="text-sm font-semibold tabular-nums text-surface-900">{pipeline?.name ?? 'Pipeline'}</h1>
                        <p className="text-xs text-surface-500">{deals.length} deal(s)</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    {/* View Mode Toggle */}
                    <div className="flex rounded-lg border border-default bg-surface-50 p-0.5">
                        <button
                            onClick={() => setViewMode('kanban')}
                            className={cn(
                                'flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors',
                                viewMode === 'kanban'
                                    ? 'bg-surface-0 text-surface-900 shadow-sm'
                                    : 'text-surface-500 hover:text-surface-700',
                            )}
                        >
                            <LayoutGrid className="h-3.5 w-3.5" /> Kanban
                        </button>
                        <button
                            onClick={() => setViewMode('table')}
                            className={cn(
                                'flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors',
                                viewMode === 'table'
                                    ? 'bg-surface-0 text-surface-900 shadow-sm'
                                    : 'text-surface-500 hover:text-surface-700',
                            )}
                        >
                            <List className="h-3.5 w-3.5" /> Tabela
                        </button>
                    </div>

                    {/* Pipeline Tabs */}
                    <div className="hidden md:flex items-center gap-1 rounded-lg border border-default bg-surface-50 p-0.5">
                        {pipelines.map((p: any) => (
                            <Link
                                key={p.id}
                                to={`/crm/pipeline/${p.id}`}
                                className={cn(
                                    'rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
                                    p.id === pipelineId
                                        ? 'bg-surface-0 text-surface-900 shadow-sm'
                                        : 'text-surface-500 hover:text-surface-700',
                                )}
                            >
                                {p.name}
                            </Link>
                        ))}
                    </div>

                    <select
                        value={statusFilter}
                        onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setStatusFilter(e.target.value)}
                        title="Filtrar por status"
                        aria-label="Filtrar por status"
                        className="rounded-lg border border-default bg-surface-0 px-3 py-1.5 text-xs font-medium text-surface-700 focus:outline-none focus:ring-2 focus:ring-brand-500/30"
                    >
                        <option value="open">Abertos</option>
                        <option value="won">Ganhos</option>
                        <option value="lost">Perdidos</option>
                    </select>

                    {/* CSV Export / Import (#15) */}
                    <div className="hidden sm:flex items-center gap-1">
                        <button
                            onClick={async () => {
                                try {
                                    const res = await crmFeaturesApi.exportDealsCsv({ pipeline_id: pipelineId ? Number(pipelineId) : undefined })
                                    const blob = new Blob([res.data], { type: 'text/csv;charset=utf-8' })
                                    const url = URL.createObjectURL(blob)
                                    const a = document.createElement('a')
                                    a.href = url
                                    a.download = `deals_${new Date().toISOString().slice(0, 10)}.csv`
                                    a.click()
                                    URL.revokeObjectURL(url)
                                    toast.success('CSV exportado com sucesso')
                                } catch { toast.error('Erro ao exportar CSV') }
                            }}
                            title="Exportar CSV"
                            className="rounded-lg border border-default bg-surface-0 p-2 text-surface-500 hover:bg-surface-50 hover:text-surface-700 transition-colors"
                        >
                            <Download className="h-4 w-4" />
                        </button>
                        <label
                            title="Importar CSV"
                            className="rounded-lg border border-default bg-surface-0 p-2 text-surface-500 hover:bg-surface-50 hover:text-surface-700 transition-colors cursor-pointer"
                        >
                            <Upload className="h-4 w-4" />
                            <input
                                type="file"
                                accept=".csv"
                                title="Selecionar arquivo CSV para importação"
                                className="hidden"
                                onChange={async (e) => {
                                    const file = e.target.files?.[0]
                                    if (!file) return
                                    try {
                                        const res = await crmFeaturesApi.importDealsCsv(file)
                                        const { imported, errors } = res.data
                                        toast.success(`${imported} deal(s) importado(s)`)
                                        if (errors?.length) toast.warning(`${errors.length} erro(s) encontrado(s)`)
                                        queryClient.invalidateQueries({ queryKey: ['crm'] })
                                        broadcastQueryInvalidation(['crm'], 'Deals')
                                    } catch { toast.error('Erro ao importar CSV') }
                                    e.target.value = ''
                                }}
                            />
                        </label>
                    </div>
                </div>
            </div>

            {/* Table View */}
            {viewMode === 'table' && (
                <div className="flex-1 overflow-auto bg-surface-0">
                    {/* Search Bar + Bulk Actions */}
                    <div className="border-b border-subtle px-5 py-3">
                        <div className="flex items-center gap-4">
                            <div className="relative max-w-md flex-1">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-surface-400" />
                                <Input
                                    placeholder="Buscar por título ou cliente..."
                                    value={searchQuery}
                                    onChange={e => setSearchQuery(e.target.value)}
                                    className="pl-9 h-9 text-sm"
                                />
                                {searchQuery && (
                                    <button onClick={() => setSearchQuery('')} title="Limpar busca" className="absolute right-3 top-1/2 -translate-y-1/2 text-surface-400 hover:text-surface-600">
                                        <X className="h-3.5 w-3.5" />
                                    </button>
                                )}
                            </div>

                            {/* Bulk Actions Toolbar */}
                            {selectedDealIds.size > 0 && (
                                <div className="flex items-center gap-2 rounded-lg border border-brand-200 bg-brand-50 px-3 py-1.5 animate-in fade-in slide-in-from-top-2">
                                    <span className="text-xs font-semibold text-brand-700">{selectedDealIds.size} selecionado(s)</span>
                                    <div className="h-4 w-px bg-brand-200" />

                                    {/* Move to Stage dropdown */}
                                    <select
                                        defaultValue=""
                                        title="Mover para etapa"
                                        onChange={(e) => {
                                            if (e.target.value) handleBulkAction('move_stage', Number(e.target.value))
                                            e.target.value = ''
                                        }}
                                        className="h-7 rounded-md border border-brand-200 bg-white px-2 text-xs font-medium text-surface-700 focus:outline-none focus:ring-2 focus:ring-brand-500/30"
                                    >
                                        <option value="" disabled>Mover para...</option>
                                        {pipeline?.stages?.filter((s: any) => !s.is_won && !s.is_lost).map((s: any) => (
                                            <option key={s.id} value={s.id}>{s.name}</option>
                                        ))}
                                    </select>

                                    <button
                                        onClick={() => handleBulkAction('mark_won')}
                                        title="Marcar como ganho"
                                        className="flex items-center gap-1 rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-100 transition-colors"
                                    >
                                        <Trophy className="h-3 w-3" /> Ganho
                                    </button>
                                    <button
                                        onClick={() => handleBulkAction('mark_lost')}
                                        title="Marcar como perdido"
                                        className="flex items-center gap-1 rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-xs font-medium text-amber-700 hover:bg-amber-100 transition-colors"
                                    >
                                        <Ban className="h-3 w-3" /> Perdido
                                    </button>
                                    <button
                                        onClick={() => handleBulkAction('delete')}
                                        title="Excluir selecionados"
                                        className="flex items-center gap-1 rounded-md border border-red-200 bg-red-50 px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-100 transition-colors"
                                    >
                                        <Trash2 className="h-3 w-3" />
                                    </button>

                                    <button
                                        onClick={() => setSelectedDealIds(new Set())}
                                        title="Limpar seleção"
                                        className="ml-1 rounded-md p-1 text-brand-400 hover:text-brand-700 hover:bg-brand-100 transition-colors"
                                    >
                                        <X className="h-3.5 w-3.5" />
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>

                    {dealsLoading ? (
                        <div className="flex items-center justify-center py-12">
                            <Loader2 className="h-6 w-6 animate-spin text-surface-400" />
                        </div>
                    ) : filteredDeals.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 text-surface-400">
                            <p className="text-sm font-medium">Nenhum deal encontrado</p>
                            {searchQuery && <p className="text-xs mt-1">Tente refinar sua busca</p>}
                        </div>
                    ) : (
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-subtle bg-surface-50/80">
                                    <th className="w-10 px-3 py-2.5 text-center">
                                        <input
                                            type="checkbox"
                                            checked={selectedDealIds.size === filteredDeals.length && filteredDeals.length > 0}
                                            onChange={toggleSelectAll}
                                            className="h-3.5 w-3.5 rounded border-surface-300 text-brand-600 focus:ring-brand-500/30 cursor-pointer"
                                            title="Selecionar todos"
                                        />
                                    </th>
                                    <th className="px-5 py-2.5 text-left">
                                        <button onClick={() => toggleSort('title')} className="flex items-center gap-1.5 text-xs font-semibold text-surface-500 uppercase tracking-wider hover:text-surface-700">
                                            Título <SortIcon field="title" />
                                        </button>
                                    </th>
                                    <th className="px-3 py-2.5 text-left text-xs font-semibold text-surface-500 uppercase tracking-wider">Cliente</th>
                                    <th className="px-3 py-2.5 text-left text-xs font-semibold text-surface-500 uppercase tracking-wider">Etapa</th>
                                    <th className="px-3 py-2.5 text-right">
                                        <button onClick={() => toggleSort('value')} className="flex items-center gap-1.5 text-xs font-semibold text-surface-500 uppercase tracking-wider hover:text-surface-700 ml-auto">
                                            Valor <SortIcon field="value" />
                                        </button>
                                    </th>
                                    <th className="px-3 py-2.5 text-right">
                                        <button onClick={() => toggleSort('probability')} className="flex items-center gap-1.5 text-xs font-semibold text-surface-500 uppercase tracking-wider hover:text-surface-700 ml-auto">
                                            Prob. <SortIcon field="probability" />
                                        </button>
                                    </th>
                                    <th className="px-3 py-2.5 text-left">
                                        <button onClick={() => toggleSort('expected_close_date')} className="flex items-center gap-1.5 text-xs font-semibold text-surface-500 uppercase tracking-wider hover:text-surface-700">
                                            Fech. Previsto <SortIcon field="expected_close_date" />
                                        </button>
                                    </th>
                                    <th className="px-3 py-2.5 text-left text-xs font-semibold text-surface-500 uppercase tracking-wider">Responsável</th>
                                    <th className="px-3 py-2.5 text-left text-xs font-semibold text-surface-500 uppercase tracking-wider">Fonte</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-subtle">
                                {filteredDeals.map(deal => {
                                    const stage = pipeline?.stages.find((s: any) => s.id === deal.stage_id)
                                    return (
                                        <tr
                                            key={deal.id}
                                            className={cn(
                                                'hover:bg-surface-50/80 cursor-pointer transition-colors',
                                                selectedDealIds.has(deal.id) && 'bg-brand-50/60',
                                            )}
                                        >
                                            <td className="w-10 px-3 py-3 text-center" onClick={e => e.stopPropagation()}>
                                                <input
                                                    type="checkbox"
                                                    checked={selectedDealIds.has(deal.id)}
                                                    onChange={() => toggleSelectDeal(deal.id)}
                                                    className="h-3.5 w-3.5 rounded border-surface-300 text-brand-600 focus:ring-brand-500/30 cursor-pointer"
                                                    aria-label={`Selecionar ${deal.title}`}
                                                />
                                            </td>
                                            <td className="px-5 py-3" onClick={() => openDealDetail(deal.id)}>
                                                <p className="font-medium text-surface-800 truncate max-w-[200px]">{deal.title}</p>
                                            </td>
                                            <td className="px-3 py-3 text-surface-600 truncate max-w-[150px]" onClick={() => openDealDetail(deal.id)}>
                                                {(deal as any).customer?.name ?? '—'}
                                            </td>
                                            <td className="px-3 py-3" onClick={() => openDealDetail(deal.id)}>
                                                {stage && (
                                                    <Badge variant="outline" className="text-[10px] gap-1">
                                                        <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: stage.color || '#94a3b8' }} />
                                                        {stage.name}
                                                    </Badge>
                                                )}
                                            </td>
                                            <td className="px-3 py-3 text-right font-semibold tabular-nums text-surface-900" onClick={() => openDealDetail(deal.id)}>
                                                {formatCurrency(Number(deal.value) || 0)}
                                            </td>
                                            <td className="px-3 py-3 text-right tabular-nums text-surface-600" onClick={() => openDealDetail(deal.id)}>
                                                {deal.probability ?? 0}%
                                            </td>
                                            <td className="px-3 py-3 text-surface-600 tabular-nums text-xs" onClick={() => openDealDetail(deal.id)}>
                                                {deal.expected_close_date
                                                    ? new Date(deal.expected_close_date).toLocaleDateString('pt-BR')
                                                    : '—'}
                                            </td>
                                            <td className="px-3 py-3 text-surface-600 text-xs truncate max-w-[100px]" onClick={() => openDealDetail(deal.id)}>
                                                {(deal as any).assignee?.name ?? '—'}
                                            </td>
                                            <td className="px-3 py-3 text-surface-400 text-xs" onClick={() => openDealDetail(deal.id)}>
                                                {deal.source ?? '—'}
                                            </td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                            <tfoot>
                                <tr className="bg-surface-50/80 border-t border-default">
                                    <td colSpan={4} className="px-5 py-2.5 text-xs font-semibold text-surface-600">
                                        {filteredDeals.length} deal(s)
                                    </td>
                                    <td className="px-3 py-2.5 text-right text-xs font-bold text-surface-900">
                                        {formatCurrency(filteredDeals.reduce((sum, d) => sum + (Number(d.value) || 0), 0))}
                                    </td>
                                    <td className="px-3 py-2.5 text-right text-xs font-semibold text-surface-600">
                                        {filteredDeals.length > 0
                                            ? Math.round(filteredDeals.reduce((sum, d) => sum + (d.probability ?? 0), 0) / filteredDeals.length)
                                            : 0}% avg
                                    </td>
                                    <td colSpan={3} />
                                </tr>
                            </tfoot>
                        </table>
                    )}
                </div>
            )}

            {/* Kanban View */}
            {viewMode === 'kanban' && (
                <div className="flex-1 overflow-x-auto scroll-smooth snap-x snap-mandatory md:snap-none touch-pan-x">
                    <DndContext
                        sensors={sensors}
                        collisionDetection={closestCorners}
                        onDragStart={handleDragStart}
                        onDragEnd={handleDragEnd}
                    >
                        <div className="flex h-full gap-3 p-4 pb-6 md:pb-4" style={{ minWidth: pipeline ? `${(pipeline as any).stages.length * 280}px` : undefined }}>
                            {(pipeline as any)?.stages.filter((s: any) => !s.is_won && !s.is_lost).map((stage: any) => (
                                <KanbanColumn
                                    key={stage.id}
                                    stage={stage}
                                    deals={dealsByStage.get(stage.id) ?? []}
                                    isLoading={dealsLoading}
                                    onDealClick={openDealDetail}
                                    onAddDeal={() => openNewDeal(stage.id)}
                                />
                            ))}
                            {(pipeline as any)?.stages.filter((s: any) => s.is_won || s.is_lost).map((stage: any) => (
                                <KanbanColumn
                                    key={stage.id}
                                    stage={stage}
                                    deals={dealsByStage.get(stage.id) ?? []}
                                    isLoading={dealsLoading}
                                    onDealClick={openDealDetail}
                                    onAddDeal={() => openNewDeal(stage.id)}
                                    condensed
                                />
                            ))}
                        </div>

                        <DragOverlay>
                            {activeDeal && <DealCard deal={activeDeal} />}
                        </DragOverlay>
                    </DndContext>
                </div>
            )}

            {/* Drawers & Modals */}
            <DealDetailDrawer
                dealId={selectedDealId}
                open={drawerOpen}
                onClose={() => setDrawerOpen(false)}
            />

            {newDealOpen && pipeline && (
                <NewDealModal
                    open={newDealOpen}
                    onClose={() => setNewDealOpen(false)}
                    pipelineId={pipeline.id}
                    stageId={newDealStageId!}
                />
            )}
        </div>
    )
}

// ─── Kanban Column ──────────────────────────────────

interface KanbanColumnProps {
    stage: CrmPipelineStage
    deals: CrmDeal[]
    isLoading: boolean
    onDealClick: (id: number) => void
    onAddDeal: () => void
    condensed?: boolean
}

function KanbanColumn({ stage, deals, isLoading, onDealClick, onAddDeal, condensed }: KanbanColumnProps) {
    const { setNodeRef, isOver } = useDroppable({ id: stage.id })
    const totalValue = deals.reduce((sum, d) => sum + Number(d.value), 0)

    return (
        <div
            ref={setNodeRef}
            className={cn(
                'flex flex-col rounded-xl bg-surface-50/80 border border-surface-200/60 transition-colors snap-center',
                condensed ? 'w-56 shrink-0' : 'w-[75vw] sm:w-72 shrink-0',
                isOver && 'bg-brand-50/50 border-brand-200',
            )}
        >
            <div className="flex items-center justify-between px-3 py-2.5 border-b border-subtle/60">
                <div className="flex items-center gap-2 min-w-0">
                    <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: stage.color || '#94a3b8' }} />
                    <span className="text-xs font-semibold text-surface-700 truncate">{stage.name}</span>
                    <span className="rounded-full bg-surface-200 px-1.5 py-0.5 text-xs font-bold text-surface-600">{deals.length}</span>
                </div>
                {!condensed && (
                    <button
                        onClick={onAddDeal}
                        title="Adicionar deal"
                        aria-label="Adicionar deal"
                        className="rounded p-0.5 text-surface-400 hover:bg-surface-200 hover:text-surface-600 transition-colors"
                    >
                        <Plus className="h-4 w-4" />
                    </button>
                )}
            </div>

            {totalValue > 0 && (
                <div className="px-3 py-1.5 text-xs font-medium text-surface-400">
                    {formatCurrency(totalValue)}
                </div>
            )}

            <div className="flex-1 overflow-y-auto p-2 space-y-2">
                <SortableContext items={deals.map(d => d.id)} strategy={verticalListSortingStrategy}>
                    {isLoading ? (
                        <div className="flex items-center justify-center py-4">
                            <Loader2 className="h-5 w-5 animate-spin text-surface-300" />
                        </div>
                    ) : deals.length === 0 ? (
                        <div className="rounded-lg border-2 border-dashed border-surface-200 py-6 text-center opacity-60">
                            <p className="text-xs text-surface-400">Sem deals</p>
                        </div>
                    ) : (
                        deals.map(deal => (
                            <DealCard key={deal.id} deal={deal} onClick={() => onDealClick(deal.id)} />
                        ))
                    )}
                </SortableContext>
            </div>
        </div>
    )
}
