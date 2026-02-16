import { useEffect, useRef, useCallback } from 'react'
import api from '@/lib/api'

const TRACKING_INTERVAL_MS = 10 * 60 * 1000 // 10 min

export function useDisplacementTracking(workOrderId: number | undefined, isActive: boolean) {
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

    const sendLocation = useCallback(async () => {
        if (!workOrderId || !navigator.geolocation) return

        navigator.geolocation.getCurrentPosition(
            async (pos) => {
                try {
                    await api.post(`/work-orders/${workOrderId}/displacement/location`, {
                        latitude: pos.coords.latitude,
                        longitude: pos.coords.longitude,
                    })
                } catch {
                    // Silently fail, will retry on next interval
                }
            },
            () => {},
            { enableHighAccuracy: true, timeout: 10000 }
        )
    }, [workOrderId])

    useEffect(() => {
        if (!workOrderId || !isActive) {
            if (intervalRef.current) {
                clearInterval(intervalRef.current)
                intervalRef.current = null
            }
            return
        }

        sendLocation()

        intervalRef.current = setInterval(sendLocation, TRACKING_INTERVAL_MS)

        return () => {
            if (intervalRef.current) {
                clearInterval(intervalRef.current)
                intervalRef.current = null
            }
        }
    }, [workOrderId, isActive, sendLocation])
}
