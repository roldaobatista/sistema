import React, { useState, useMemo } from 'react'
import {
    DndContext,
    DragOverlay,
    closestCorners,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    type DragStartEvent,
    type DragOverEvent,
    type DragEndEvent,
    defaultDropAnimationSideEffects,
    type DropAnimation,
} from '@dnd-kit/core'
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    verticalListSortingStrategy,
    useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
    Search, Filter, Plus, Clock, User, AlertTriangle
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import api from '@/lib/api'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useAuthStore } from '@/stores/auth-store'
import { PageHeader } from '@/components/ui/pageheader'

// --- Types ---
interface WorkOrder {
    id: number
    number: string
    os_number?: string | null
    business_number?: string | null
    status: string
    priority: string
    description: string
    total: string
    created_at: string
    customer: { id: number; name: string }
    assignee: { id: number; name: string } | null
}

const statusConfig: Record<string, { label: string; variant: any; dot?: boolean }> = {
    open: { label: 'Aberta', variant: 'info', dot: true },
    awaiting_dispatch: { label: 'Aguard. Despacho', variant: 'warning', dot: true },
    in_progress: { label: 'Em Andamento', variant: 'warning', dot: true },
    waiting_parts: { label: 'Aguard. Peças', variant: 'warning' },
    waiting_approval: { label: 'Aguard. Aprovação', variant: 'brand' },
    completed: { label: 'Concluída', variant: 'success', dot: true },
    delivered: { label: 'Entregue', variant: 'success' },
    invoiced: { label: 'Faturada', variant: 'brand' },
    cancelled: { label: 'Cancelada', variant: 'danger' },
}

const priorityConfig: Record<string, { label: string; variant: any }> = {
    low: { label: 'Baixa', variant: 'default' },
    normal: { label: 'Normal', variant: 'info' },
    high: { label: 'Alta', variant: 'warning' },
    urgent: { label: 'Urgente', variant: 'danger' },
}

const columns = Object.keys(statusConfig)
const woIdentifier = (wo?: { number: string; os_number?: string | null; business_number?: string | null } | null) =>
    wo?.business_number ?? wo?.os_number ?? wo?.number ?? '—'

// Mirror backend WorkOrder::ALLOWED_TRANSITIONS
const ALLOWED_TRANSITIONS: Record<string, string[]> = {
    open: ['awaiting_dispatch', 'in_progress', 'cancelled'],
    awaiting_dispatch: ['in_progress', 'cancelled'],
    in_progress: ['waiting_parts', 'waiting_approval', 'completed', 'cancelled'],
    waiting_parts: ['in_progress', 'cancelled'],
    waiting_approval: ['in_progress', 'completed', 'cancelled'],
    completed: ['delivered', 'in_progress', 'cancelled'],
    delivered: ['invoiced'],
    invoiced: [],
    cancelled: ['open'],
}

// --- Sortable Item Component ---
function SortableItem({ id, workOrder, onClick }: { id: number; workOrder: WorkOrder; onClick: () => void }) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id })

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
    }

    const formatBRL = (v: string) => parseFloat(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

    return (
        <div
            ref={setNodeRef}
            style={style}
            {...attributes}
            {...listeners}
            onClick={onClick}
            className={cn(
                "bg-white p-3 rounded-lg border border-surface-200 shadow-sm hover:shadow-md transition-all cursor-grab active:cursor-grabbing mb-2",
                isDragging && "ring-2 ring-brand-500 ring-opacity-50 z-50"
            )}
        >
            <div className="flex justify-between items-start mb-2">
                <span className="text-xs font-bold text-brand-600">{woIdentifier(workOrder)}</span>
                {workOrder.priority !== 'normal' && (
                    <Badge variant={priorityConfig[workOrder.priority]?.variant ?? 'default'} className="px-1.5 py-0 text-[10px]">
                        {workOrder.priority === 'urgent' && <AlertTriangle className="h-3 w-3 mr-0.5 inline" />}
                        {priorityConfig[workOrder.priority]?.label}
                    </Badge>
                )}
            </div>
            <p className="text-[13px] font-medium text-surface-900 mb-2 line-clamp-2">{workOrder.description}</p>
            <div className="flex items-center gap-1.5 text-xs text-surface-500 mb-2">
                <User className="h-3 w-3" />
                <span className="truncate">{workOrder.customer.name}</span>
            </div>
            <div className="flex justify-between items-center text-xs pt-2 border-t border-surface-100">
                <span className="font-semibold text-surface-700">{formatBRL(workOrder.total)}</span>
                {workOrder.assignee && (
                    <span className="bg-surface-100 px-1.5 py-0.5 rounded text-surface-600 truncate max-w-[80px]">
                        {workOrder.assignee.name.split(' ')[0]}
                    </span>
                )}
            </div>
        </div>
    )
}

// --- Main Page Component ---
export function WorkOrderKanbanPage() {
    const navigate = useNavigate()
    const queryClient = useQueryClient()
    const [search, setSearch] = useState('')
    const [priorityFilter, setPriorityFilter] = useState('')
    const [activeId, setActiveId] = useState<number | null>(null)
    const { hasPermission } = useAuthStore()

    // Fetch Data
    const { data: res, isLoading, isError, refetch } = useQuery({
        queryKey: ['work-orders', 'kanban', search],
        const { data, isLoading, isError, refetch } = useQuery({
            queryFn: () => api.get('/work-orders', {
                params: { search, per_page: 100, status: columns.join(',') }, // Fetch mostly everything
            }),
        })

    // Process Data into Columns
    const items = useMemo(() => {
            const raw = (res?.data?.data ?? []) as WorkOrder[]
            const filtered = priorityFilter ? raw.filter(wo => wo.priority === priorityFilter) : raw
            const grouped: Record<string, WorkOrder[]> = {}
            columns.forEach(col => grouped[col] = [])
            filtered.forEach(wo => {
                if (grouped[wo.status]) {
                    grouped[wo.status].push(wo)
                }
            })
            return grouped
        }, [res, priorityFilter])

    const totalByCol = useMemo(() => {
            const totals: Record<string, number> = {}
            columns.forEach(col => {
                totals[col] = (items[col] ?? []).reduce((acc, wo) => acc + parseFloat(wo.total || '0'), 0)
            })
            return totals
        }, [items])

    // Mutation for status update
    const updateStatusMutation = useMutation({
            mutationFn: ({ id, status }: { id: number; status: string }) =>
                api.post(`/work-orders/${id}/status`, { status }),
            onSuccess: () => {
                queryClient.invalidateQueries({ queryKey: ['work-orders'] })
                toast.success('Status atualizado com sucesso!')
            },
            onError: (err: any) => toast.error(err?.response?.data?.message || 'Erro ao alterar status'),
        })

    // Drag & Drop Sensors
    const sensors = useSensors(
            useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
            useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
        )

    // Drag Handlers
    const handleDragStart = (event: DragStartEvent) => {
            setActiveId(event.active.id as number)
        }

    const handleDragOver = (event: DragOverEvent) => {
            // Optimization: We could handle optimistic UI updates here for smoother sorting
        }

    const handleDragEnd = (event: DragEndEvent) => {
            const { active, over } = event

            if (!over) return

            const activeId = active.id as number
            const overId = over.id

            // Find the work order and its current status
            let activeWorkOrder: WorkOrder | undefined
            let currentStatus = ''

            for (const col of columns) {
                const found = items[col].find(i => i.id === activeId)
                if (found) {
                    activeWorkOrder = found
                    currentStatus = col
                    break
                }
            }

            if (!activeWorkOrder) return

            let newStatus = ''

            // Check if dropped on a column container
            if (columns.includes(overId as string)) {
                newStatus = overId as string
            } else {
                // Find which column the "over" item belongs to
                for (const col of columns) {
                    if (items[col].find(i => i.id === overId)) {
                        newStatus = col
                        break
                    }
                }
            }

            if (newStatus && newStatus !== currentStatus) {
                const allowed = ALLOWED_TRANSITIONS[currentStatus] ?? []
                if (!allowed.includes(newStatus)) {
                    const fromLabel = statusConfig[currentStatus]?.label ?? currentStatus
                    const toLabel = statusConfig[newStatus]?.label ?? newStatus
                    toast.warning(`Transição não permitida: ${fromLabel} → ${toLabel}`)
                } else {
                    updateStatusMutation.mutate({ id: activeId, status: newStatus })
                }
            }

            setActiveId(null)
        }

    const dropAnimation: DropAnimation = {
            sideEffects: defaultDropAnimationSideEffects({
                styles: {
                    active: { opacity: '0.5' },
                },
            }),
        }

    return(
        <div className = "h-full flex flex-col overflow-hidden" >
                {/* Header */ }
                < div className = "flex-none px-6 py-4 border-b border-default bg-surface-0 space-y-3" >
                <PageHeader
                    title="Kanban de OS"
                    subtitle="Visualize e gerencie o fluxo de trabalho"
                    actions={hasPermission('os.work_order.create') ? [
                        {
                            label: 'Nova OS',
                            icon: <Plus className="h-4 w-4" />,
                            onClick: () => navigate('/os/nova'),
                        },
                    ] : []}
                />
                <div className="flex items-center gap-3">
                    <div className="relative w-64">
                        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-surface-400" />
                        <input
                            type="text"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Buscar..."
                            className="w-full rounded-lg border border-surface-300 pl-9 pr-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                        />
                    </div>
                    <select value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value)}
                        className="rounded-lg border border-default bg-surface-50 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none">
                        <option value="">Todas prioridades</option>
                        <option value="low">Baixa</option>
                        <option value="normal">Normal</option>
                        <option value="high">Alta</option>
                        <option value="urgent">Urgente</option>
                    </select>
                </div>
            </div >

        {/* Kanban Board */ }
        < div className = "flex-1 overflow-x-auto overflow-y-hidden bg-surface-50 p-6" >
        {
            isError?(
                    <div className = "flex flex-col items-center justify-center h-full" >
                        <AlertTriangle className="h-12 w-12 text-red-300" />
                        <p className="mt-3 text-sm text-surface-500">Erro ao carregar ordens de serviço</p>
                        <Button className="mt-3" variant="outline" onClick={() => refetch()}>Tentar novamente</Button>
                    </div>
                ) : (
        <DndContext
            sensors={sensors}
            collisionDetection={closestCorners}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragEnd={handleDragEnd}
        >
            <div className="flex h-full gap-4 min-w-max">
                {columns.map(colId => (
                    <div key={colId} className="w-72 flex flex-col rounded-xl bg-surface-100 border border-surface-200 h-full max-h-full">
                        {/* Column Header */}
                        <div className={cn(
                            "p-3 rounded-t-xl border-b border-default bg-surface-0 sticky top-0 z-10",
                            statusConfig[colId].variant === 'success' && "border-t-4 border-t-green-500",
                            statusConfig[colId].variant === 'warning' && "border-t-4 border-t-amber-500",
                            statusConfig[colId].variant === 'danger' && "border-t-4 border-t-red-500",
                            statusConfig[colId].variant === 'info' && "border-t-4 border-t-sky-500",
                            statusConfig[colId].variant === 'brand' && "border-t-4 border-t-brand-500",
                        )}>
                            <div className="flex justify-between items-center">
                                <h3 className="font-semibold text-surface-700 text-sm">{statusConfig[colId].label}</h3>
                                <Badge variant="outline" className="bg-surface-50 text-surface-600 border-surface-200">
                                    {items[colId]?.length ?? 0}
                                </Badge>
                            </div>
                            {(totalByCol[colId] ?? 0) > 0 && (
                                <p className="text-[10px] text-surface-400 mt-1 font-medium">
                                    {Number(totalByCol[colId]).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                </p>
                            )}
                        </div>

                        {/* Droppable Area */}
                        <SortableContext
                            id={colId} // Column ID acts as droppable container
                            items={items[colId]?.map(i => i.id) ?? []}
                            strategy={verticalListSortingStrategy}
                        >
                            <div className="flex-1 overflow-y-auto p-2 scrollbar-thin scrollbar-thumb-surface-300 scrollbar-track-transparent">
                                {isLoading ? (
                                    <div className="space-y-2 p-2">
                                        {[1, 2, 3].map(i => (
                                            <div key={i} className="animate-pulse rounded-lg bg-white p-3 border border-surface-200">
                                                <div className="flex justify-between mb-2">
                                                    <div className="h-3 w-16 rounded bg-surface-200" />
                                                    <div className="h-3 w-12 rounded bg-surface-100" />
                                                </div>
                                                <div className="h-4 w-full rounded bg-surface-100 mb-2" />
                                                <div className="h-3 w-2/3 rounded bg-surface-100" />
                                            </div>
                                        ))}
                                    </div>
                                ) : items[colId]?.length === 0 ? (
                                    <div className="p-4 text-center text-xs text-surface-400 border-2 border-dashed border-surface-200 rounded-lg m-2">
                                        Vazio
                                    </div>
                                ) : (
                                    items[colId]?.map(wo => (
                                        <SortableItem
                                            key={wo.id}
                                            id={wo.id}
                                            workOrder={wo}
                                            onClick={() => navigate(`/os/${wo.id}`)}
                                        />
                                    ))
                                )}
                            </div>
                        </SortableContext>
                    </div>
                ))}
            </div>

            {/* Drag Overlay */}
            <DragOverlay dropAnimation={dropAnimation}>
                {activeId ? (() => {
                    const activeWo = Object.values(items).flat().find(wo => wo.id === activeId)
                    return (
                        <div className="bg-white p-3 rounded-lg border border-brand-200 shadow-xl w-72 rotate-1 cursor-grabbing ring-2 ring-brand-500">
                            <div className="flex justify-between items-start mb-2">
                                <span className="text-xs font-bold text-brand-600">{activeWo ? woIdentifier(activeWo) : `#${activeId}`}</span>
                            </div>
                            {activeWo ? (
                                <>
                                    <p className="text-[13px] font-medium text-surface-900 mb-2 line-clamp-2">{activeWo.description}</p>
                                    <div className="flex items-center gap-1.5 text-xs text-surface-500">
                                        <User className="h-3 w-3" />
                                        <span className="truncate">{activeWo.customer.name}</span>
                                    </div>
                                </>
                            ) : (
                                <>
                                    <div className="h-4 bg-surface-100 rounded w-3/4 mb-2"></div>
                                    <div className="h-3 bg-surface-50 rounded w-1/2"></div>
                                </>
                            )}
                        </div>
                    )
                })() : null}
            </DragOverlay>
        </DndContext>
    )
}
            </div >
        </div >
    )
}
