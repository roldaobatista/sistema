import { useEffect, useRef, useCallback } from 'react'

interface SwipeConfig {
    onSwipeLeft?: () => void
    onSwipeRight?: () => void
    onSwipeDown?: () => void
    threshold?: number
    enabled?: boolean
}

export function useSwipeGesture(
    elementRef: React.RefObject<HTMLElement | null>,
    config: SwipeConfig
) {
    const { onSwipeLeft, onSwipeRight, onSwipeDown, threshold = 80, enabled = true } = config
    const startX = useRef(0)
    const startY = useRef(0)
    const startTime = useRef(0)

    const handleTouchStart = useCallback((e: TouchEvent) => {
        if (!enabled) return
        const touch = e.touches[0]
        startX.current = touch.clientX
        startY.current = touch.clientY
        startTime.current = Date.now()
    }, [enabled])

    const handleTouchEnd = useCallback((e: TouchEvent) => {
        if (!enabled) return

        const touch = e.changedTouches[0]
        const dx = touch.clientX - startX.current
        const dy = touch.clientY - startY.current
        const elapsed = Date.now() - startTime.current

        // Must be a fast swipe (under 500ms) to trigger
        if (elapsed > 500) return

        const absDx = Math.abs(dx)
        const absDy = Math.abs(dy)

        // Horizontal swipe (dx > dy and above threshold)
        if (absDx > absDy && absDx > threshold) {
            if (dx > 0) {
                onSwipeRight?.()
            } else {
                onSwipeLeft?.()
            }
            return
        }

        // Vertical swipe down (only at top of page)
        if (absDy > absDx && dy > threshold && window.scrollY <= 0) {
            onSwipeDown?.()
        }
    }, [enabled, threshold, onSwipeLeft, onSwipeRight, onSwipeDown])

    useEffect(() => {
        const el = elementRef.current
        if (!el || !enabled) return

        el.addEventListener('touchstart', handleTouchStart, { passive: true })
        el.addEventListener('touchend', handleTouchEnd, { passive: true })

        return () => {
            el.removeEventListener('touchstart', handleTouchStart)
            el.removeEventListener('touchend', handleTouchEnd)
        }
    }, [elementRef, enabled, handleTouchStart, handleTouchEnd])
}
