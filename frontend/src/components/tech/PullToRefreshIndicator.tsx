import { RefreshCw } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Props {
    pullDistance: number
    isRefreshing: boolean
    threshold?: number
}

export function PullToRefreshIndicator({ pullDistance, isRefreshing, threshold = 80 }: Props) {
    if (pullDistance === 0 && !isRefreshing) return null

    const progress = Math.min(pullDistance / threshold, 1)
    const rotation = progress * 360

    return (
        <div
            role="status"
            aria-live="polite"
            aria-label={isRefreshing ? 'Atualizando...' : 'Puxe para atualizar'}
            className="flex items-center justify-center overflow-hidden transition-all"
            style={{ height: isRefreshing ? 40 : pullDistance > 0 ? pullDistance * 0.5 : 0 }}
        >
            <RefreshCw
                className={cn(
                    'w-5 h-5 text-brand-500 transition-transform',
                    isRefreshing && 'animate-spin'
                )}
                style={{ transform: isRefreshing ? undefined : `rotate(${rotation}deg)` }}
            />
        </div>
    )
}
