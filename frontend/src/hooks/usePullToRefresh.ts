import { useRef, useCallback, useEffect, useState } from 'react'

interface PullToRefreshOptions {
    onRefresh: () => Promise<void>
    threshold?: number
    disabled?: boolean
}

export function usePullToRefresh({ onRefresh, threshold = 80, disabled = false }: PullToRefreshOptions) {
    const [isRefreshing, setIsRefreshing] = useState(false)
    const [pullDistance, setPullDistance] = useState(0)
    const startY = useRef(0)
    const containerRef = useRef<HTMLDivElement>(null)

    const handleTouchStart = useCallback((e: TouchEvent) => {
        if (disabled || isRefreshing) return
        const container = containerRef.current
        if (!container || container.scrollTop > 0) return
        startY.current = e.touches[0].clientY
    }, [disabled, isRefreshing])

    const handleTouchMove = useCallback((e: TouchEvent) => {
        if (disabled || isRefreshing || !startY.current) return
        const container = containerRef.current
        if (!container || container.scrollTop > 0) return
        
        const deltaY = e.touches[0].clientY - startY.current
        if (deltaY > 0) {
            const distance = Math.min(deltaY * 0.5, threshold * 1.5)
            setPullDistance(distance)
        }
    }, [disabled, isRefreshing, threshold])

    const handleTouchEnd = useCallback(async () => {
        if (disabled || isRefreshing) return
        if (pullDistance >= threshold) {
            setIsRefreshing(true)
            try {
                await onRefresh()
            } finally {
                setIsRefreshing(false)
            }
        }
        setPullDistance(0)
        startY.current = 0
    }, [disabled, isRefreshing, pullDistance, threshold, onRefresh])

    useEffect(() => {
        const container = containerRef.current
        if (!container) return

        container.addEventListener('touchstart', handleTouchStart, { passive: true })
        container.addEventListener('touchmove', handleTouchMove, { passive: true })
        container.addEventListener('touchend', handleTouchEnd)

        return () => {
            container.removeEventListener('touchstart', handleTouchStart)
            container.removeEventListener('touchmove', handleTouchMove)
            container.removeEventListener('touchend', handleTouchEnd)
        }
    }, [handleTouchStart, handleTouchMove, handleTouchEnd])

    return { containerRef, isRefreshing, pullDistance, isPulling: pullDistance > 0 }
}
