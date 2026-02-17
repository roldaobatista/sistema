import { TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { cn } from '@/lib/utils'

interface MetricCompareProps {
    current: number
    previous: number
    invert?: boolean
    className?: string
}

export function MetricCompare({ current, previous, invert = false, className }: MetricCompareProps) {
    if (previous === 0 && current === 0) return null

    const pct = previous === 0
        ? (current > 0 ? 100 : 0)
        : Math.round(((current - previous) / Math.abs(previous)) * 1000) / 10

    const isPositive = pct > 0
    const isNegative = pct < 0
    const isNeutral = pct === 0

    const isGood = invert ? isNegative : isPositive
    const isBad = invert ? isPositive : isNegative

    if (isNeutral) {
        return (
            <span className={cn('inline-flex items-center gap-0.5 text-xs font-medium text-surface-400', className)}>
                <Minus className="h-3 w-3" />
                0%
            </span>
        )
    }

    return (
        <span className={cn(
            'inline-flex items-center gap-0.5 text-xs font-semibold',
            isGood && 'text-emerald-600',
            isBad && 'text-red-600',
            className,
        )}>
            {isPositive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
            {isPositive ? '+' : ''}{pct}%
        </span>
    )
}
