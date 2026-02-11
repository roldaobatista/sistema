import React, { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useParams, Link } from 'react-router-dom'
import {
    DndContext, closestCorners, PointerSensor, useSensor, useSensors,
    type DragEndEvent, type DragStartEvent, DragOverlay,
} from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { useDroppable } from '@dnd-kit/core'
import { Plus, ArrowLeft, Filter, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/Button'
import { DealCard } from '@/components/crm/DealCard'
import { DealDetailDrawer } from '@/components/crm/DealDetailDrawer'
import { NewDealModal } from '@/components/crm/NewDealModal'
import { crmApi, type CrmDeal, type CrmPipeline, type CrmPipelineStage } from '@/lib/crm-api'
import { toast } from 'sonner'

const fmtBRL = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

export function CrmPipelinePage() {
    const { id: routeId } = useParams()
    const queryClient = useQueryClient()
    const [selectedDealId, setSelectedDealId] = useState<number | null>(null)
    const [drawerOpen, setDrawerOpen] = useState(false)
    const [newDealOpen, setNewDealOpen] = useState(false)
    const [newDealStageId, setNewDealStageId] = useState<number | null>(null)
    const [activeDeal, setActiveDeal] = useState<CrmDeal | null>(null)
    const [statusFilter, setStatusFilter] = useState<string>('open')

    // Fetch pipelines to find current pipeline
    const { data: pipelines = [], isLoading: pipelinesLoading } = useQuery({
        queryKey: ['crm', 'pipelines'],
        queryFn: () => crmApi.getPipelines().then(r => r.data),
    })

    const pipelineId = routeId ? Number(routeId) : pipelines.find(p => p.is_default)?.id ?? pipelines[0]?.id
    const pipeline = pipelines.find(p => p.id === pipelineId)

    // Fetch deals for pipeline
    const { data: dealsResponse, isLoading: dealsLoading } = useQuery({
        queryKey: ['crm', 'deals', pipelineId, statusFilter],
        queryFn: () => crmApi.getDeals({ pipeline_id: pipelineId, status: statusFilter, per_page: 200 }).then(r => r.data),
        enabled: !!pipelineId,
    })

    const deals = dealsResponse?.data ?? []

    // Group deals by stage
    const dealsByStage = useMemo(() => {
        const map = new Map<number, CrmDeal[]>()
        if (pipeline) {
            pipeline.stages.forEach(s => map.set(s.id, []))
        }
        deals.forEach(d => {
            const list = map.get(d.stage_id)
            if (list) list.push(d)
        })
        return map
    }, [deals, pipeline])

    // DnD
    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
    )

    const stageMutation = useMutation({
        mutationFn: ({ dealId, stageId }: { dealId: number; stageId: number }) =>
            crmApi.updateDealStage(dealId, stageId),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['crm'] })
        },
        onError: (error: any) => {
            queryClient.invalidateQueries({ queryKey: ['crm', 'deals'] })
            toast.error(error.response?.data?.message || 'Erro ao mover deal de estágio')
        },
    })

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

        // The "over" could be a deal or a stage droppable
        let targetStageId: number | null = null

        // If dropped over a stage column
        if (typeof over.id === 'string' && over.id.startsWith('stage-')) {
            targetStageId = Number(over.id.replace('stage-', ''))
        } else {
            // Dropped over another deal — find its stage
            const overDeal = deals.find(d => d.id === over.id)
            if (overDeal) targetStageId = overDeal.stage_id
        }

        if (targetStageId && targetStageId !== deal.stage_id) {
            // Optimistic update
            queryClient.setQueryData(['crm', 'deals', pipelineId, statusFilter], (old: any) => {
                if (!old?.data) return old
                return {
                    ...old,
                    data: old.data.map((d: CrmDeal) =>
                        d.id === dealId ? { ...d, stage_id: targetStageId! } : d
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

    if (pipelinesLoading) {
        return (
            <div className="flex h-full items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-brand-500" />
            </div>
        )
    }

    return (
        <div className="flex h-full flex-col -m-4 lg:-m-6">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-default bg-surface-0 px-5 py-3">
                <div className="flex items-center gap-3">
                    <Link to="/crm" className="rounded-lg p-1.5 text-surface-400 hover:bg-surface-100 hover:text-surface-600 transition-colors">
                        <ArrowLeft className="h-5 w-5" />
                    </Link>
                    <div>
                        <h1 className="text-[15px] font-semibold tabular-nums text-surface-900">{pipeline?.name ?? 'Pipeline'}</h1>
                        <p className="text-xs text-surface-500">{deals.length} deal(s)</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    {/* Pipeline Tabs */}
                    <div className="hidden sm:flex items-center gap-1 rounded-lg border border-surface-200 bg-surface-50 p-0.5">
                        {pipelines.map(p => (
                            <Link
                                key={p.id}
                                to={`/crm/pipeline/${p.id}`}
                                className={cn(
                                    'rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
                                    p.id === pipelineId
                                        ? 'bg-white text-surface-900 shadow-sm'
                                        : 'text-surface-500 hover:text-surface-700'
                                )}
                            >
                                {p.name}
                            </Link>
                        ))}
                    </div>

                    {/* Status filter */}
                    <select
                        value={statusFilter}
                        onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setStatusFilter(e.target.value)}
                        className="rounded-lg border border-default bg-surface-0 px-3 py-1.5 text-xs font-medium text-surface-700 focus:outline-none focus:ring-2 focus:ring-brand-500/30"
                    >
                        <option value="open">Abertos</option>
                        <option value="won">Ganhos</option>
                        <option value="lost">Perdidos</option>
                    </select>
                </div>
            </div>

            {/* Kanban Board */}
            <div className="flex-1 overflow-x-auto">
                <DndContext
                    sensors={sensors}
                    collisionDetection={closestCorners}
                    onDragStart={handleDragStart}
                    onDragEnd={handleDragEnd}
                >
                    <div className="flex h-full gap-3 p-4" style={{ minWidth: pipeline ? `${pipeline.stages.length * 280}px` : undefined }}>
                        {pipeline?.stages.filter(s => !s.is_won && !s.is_lost).map(stage => (
                            <KanbanColumn
                                key={stage.id}
                                stage={stage}
                                deals={dealsByStage.get(stage.id) ?? []}
                                isLoading={dealsLoading}
                                onDealClick={openDealDetail}
                                onAddDeal={() => openNewDeal(stage.id)}
                            />
                        ))}
                        {/* Won / Lost columns (condensed) */}
                        {pipeline?.stages.filter(s => s.is_won || s.is_lost).map(stage => (
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
    const { setNodeRef, isOver } = useDroppable({ id: `stage-${stage.id}` })
    const totalValue = deals.reduce((sum, d) => sum + Number(d.value), 0)

    return (
        <div
            ref={setNodeRef}
            className={cn(
                'flex flex-col rounded-xl bg-surface-50/80 border border-surface-200/60 transition-colors',
                condensed ? 'w-56 shrink-0' : 'w-72 shrink-0',
                isOver && 'bg-brand-50/50 border-brand-200'
            )}
        >
            {/* Column header */}
            <div className="flex items-center justify-between px-3 py-2.5 border-b border-subtle/60">
                <div className="flex items-center gap-2 min-w-0">
                    <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: stage.color || '#94a3b8' }} />
                    <span className="text-xs font-semibold text-surface-700 truncate">{stage.name}</span>
                    <span className="rounded-full bg-surface-200 px-1.5 py-0.5 text-[10px] font-bold text-surface-600">{deals.length}</span>
                </div>
                {!condensed && (
                    <button
                        onClick={onAddDeal}
                        className="rounded p-0.5 text-surface-400 hover:bg-surface-200 hover:text-surface-600 transition-colors"
                    >
                        <Plus className="h-4 w-4" />
                    </button>
                )}
            </div>

            {/* Total value */}
            {totalValue > 0 && (
                <div className="px-3 py-1.5 text-[10px] font-medium text-surface-400">
                    {fmtBRL(totalValue)}
                </div>
            )}

            {/* Cards */}
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
