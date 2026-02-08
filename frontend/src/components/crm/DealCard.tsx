import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { DollarSign, User, Calendar, GripVertical } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { CrmDeal } from '@/lib/crm-api'

const fmtBRL = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

interface DealCardProps {
    deal: CrmDeal
    onClick?: () => void
}

export function DealCard({ deal, onClick }: DealCardProps) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
        id: deal.id,
        data: { type: 'deal', deal },
    })

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
    }

    return (
        <div
            ref={setNodeRef}
            style={style}
            className={cn(
                'group rounded-lg border border-surface-200 bg-white p-3 shadow-card cursor-pointer',
                'transition-all duration-200 hover:shadow-elevated hover:-translate-y-0.5',
                isDragging && 'opacity-50 shadow-elevated rotate-2 z-50'
            )}
            onClick={onClick}
        >
            {/* Drag handle + Title */}
            <div className="flex items-start gap-2">
                <button
                    className="mt-0.5 cursor-grab opacity-0 group-hover:opacity-100 transition-opacity text-surface-300 hover:text-surface-500"
                    {...attributes}
                    {...listeners}
                >
                    <GripVertical className="h-4 w-4" />
                </button>
                <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-surface-900 truncate">{deal.title}</p>
                    <p className="text-xs text-surface-500 truncate mt-0.5">{deal.customer?.name}</p>
                </div>
            </div>

            {/* Meta */}
            <div className="mt-3 flex items-center justify-between">
                <div className="flex items-center gap-1 text-emerald-600">
                    <DollarSign className="h-3.5 w-3.5" />
                    <span className="text-xs font-bold">{fmtBRL(deal.value)}</span>
                </div>
                <div className="flex items-center gap-2">
                    {deal.expected_close_date && (
                        <span className="flex items-center gap-1 text-xs text-surface-400">
                            <Calendar className="h-3 w-3" />
                            {new Date(deal.expected_close_date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                        </span>
                    )}
                    {deal.assignee && (
                        <span className="flex items-center gap-1 text-xs text-surface-400">
                            <User className="h-3 w-3" />
                            {deal.assignee.name.split(' ')[0]}
                        </span>
                    )}
                </div>
            </div>

            {/* Probability bar */}
            <div className="mt-2.5">
                <div className="h-1 w-full rounded-full bg-surface-100 overflow-hidden">
                    <div
                        className="h-full rounded-full bg-brand-500 transition-all duration-500"
                        style={{ width: `${deal.probability}%` }}
                    />
                </div>
            </div>
        </div>
    )
}
