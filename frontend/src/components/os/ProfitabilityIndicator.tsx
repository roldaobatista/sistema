import { DollarSign, TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ProfitabilityProps {
    revenue: number
    totalCost: number
}

export default function ProfitabilityIndicator({ revenue, totalCost }: ProfitabilityProps) {
    const profit = revenue - totalCost
    const margin = revenue > 0 ? (profit / revenue) * 100 : 0
    const isPositive = profit > 0
    const isNeutral = profit === 0

    const formatBRL = (v: number) =>
        v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

    return (
        <div className="rounded-xl border border-default bg-surface-0 p-4 shadow-card">
            <h3 className="text-sm font-semibold text-surface-900 mb-3 flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-brand-500" />
                Rentabilidade
            </h3>

            <div className="flex items-center gap-3 mb-3">
                <div className={cn(
                    'flex items-center gap-1 text-lg font-bold',
                    isPositive ? 'text-emerald-600' : isNeutral ? 'text-surface-500' : 'text-red-600'
                )}>
                    {isPositive ? <TrendingUp className="h-4 w-4" /> : isNeutral ? <Minus className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                    {formatBRL(Math.abs(profit))}
                </div>
                <span className={cn(
                    'rounded-full px-2 py-0.5 text-xs font-semibold',
                    isPositive ? 'bg-emerald-100 text-emerald-700' : isNeutral ? 'bg-surface-100 text-surface-600' : 'bg-red-100 text-red-700'
                )}>
                    {margin.toFixed(1)}%
                </span>
            </div>

            {/* Breakdown */}
            <div className="space-y-1.5 text-xs">
                <div className="flex justify-between">
                    <span className="text-surface-500">Receita</span>
                    <span className="font-medium text-surface-700">{formatBRL(revenue)}</span>
                </div>
                <div className="flex justify-between">
                    <span className="text-surface-500">Custo Total</span>
                    <span className="font-medium text-surface-700">{formatBRL(totalCost)}</span>
                </div>
                <div className="flex justify-between border-t border-subtle pt-1.5">
                    <span className="font-medium text-surface-900">Lucro</span>
                    <span className={cn('font-bold', isPositive ? 'text-emerald-600' : 'text-red-600')}>
                        {formatBRL(profit)}
                    </span>
                </div>
            </div>

            {/* Margin bar */}
            <div className="mt-3">
                <div className="h-2 rounded-full bg-surface-100 overflow-hidden">
                    <div
                        className={cn('h-full rounded-full transition-all', isPositive ? 'bg-emerald-500' : 'bg-red-500')}
                        style={{ width: `${Math.min(Math.abs(margin), 100)}%` }}
                    />
                </div>
            </div>
        </div>
    )
}
