import { useState, useEffect, useCallback, useRef } from 'react'
import api from '@/lib/api'

interface LocationState {
    isSharing: boolean
    lastPosition: { lat: number; lng: number } | null
    lastUpdate: string | null
    error: string | null
}

export function useLocationSharing() {
    const [state, setState] = useState<LocationState>({
        isSharing: false,
        lastPosition: null,
        lastUpdate: null,
        error: null,
    })
    const watchIdRef = useRef<number | null>(null)
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

    const sendLocation = useCallback(async (lat: number, lng: number) => {
        try {
            await api.post('/user/location', {
                latitude: lat,
                longitude: lng,
            })
            setState(prev => ({
                ...prev,
                lastPosition: { lat, lng },
                lastUpdate: new Date().toISOString(),
                error: null,
            }))
        } catch {
            // Silently fail - will retry on next interval
        }
    }, [])

    const startSharing = useCallback(() => {
        if (!navigator.geolocation) {
            setState(prev => ({ ...prev, error: 'GPS não suportado' }))
            return
        }

        setState(prev => ({ ...prev, isSharing: true, error: null }))

        navigator.geolocation.getCurrentPosition(
            (pos) => sendLocation(pos.coords.latitude, pos.coords.longitude),
            () => {},
            { enableHighAccuracy: true }
        )

        intervalRef.current = setInterval(() => {
            navigator.geolocation.getCurrentPosition(
                (pos) => sendLocation(pos.coords.latitude, pos.coords.longitude),
                () => {},
                { enableHighAccuracy: true, timeout: 10000 }
            )
        }, 5 * 60 * 1000)

        localStorage.setItem('location-sharing-active', 'true')
    }, [sendLocation])

    const stopSharing = useCallback(() => {
        if (watchIdRef.current !== null) {
            navigator.geolocation.clearWatch(watchIdRef.current)
            watchIdRef.current = null
        }
        if (intervalRef.current) {
            clearInterval(intervalRef.current)
            intervalRef.current = null
        }
        setState(prev => ({ ...prev, isSharing: false }))
        localStorage.removeItem('location-sharing-active')
    }, [])

    useEffect(() => {
        const wasSharing = localStorage.getItem('location-sharing-active') === 'true'
        if (wasSharing) {
            startSharing()
        }
        return () => {
            if (intervalRef.current) clearInterval(intervalRef.current)
            if (watchIdRef.current !== null) navigator.geolocation.clearWatch(watchIdRef.current)
        }
    }, []) // eslint-disable-line react-hooks/exhaustive-deps

    return {
        ...state,
        startSharing,
        stopSharing,
        toggle: () => state.isSharing ? stopSharing() : startSharing(),
    }
}
