import { useEffect, useRef } from 'react'
import { useAppMode } from '@/hooks/useAppMode'
import { useAuthStore } from '@/stores/auth-store'
import { usePWA } from '@/hooks/usePWA'

const MODE_URLS: Record<string, string[]> = {
    gestao: [
        '/api/v1/me',
        '/api/v1/dashboard/stats',
        '/api/v1/work-orders?per_page=50',
        '/api/v1/customers?per_page=100',
        '/api/v1/products?per_page=100',
        '/api/v1/services?per_page=100',
    ],
    tecnico: [
        '/api/v1/me',
        '/api/v1/work-orders?status=in_progress&per_page=50',
        '/api/v1/equipments?per_page=100',
        '/api/v1/standard-weights?per_page=100',
        '/api/v1/checklists?per_page=50',
        '/api/v1/customers?per_page=100',
        '/api/v1/services?per_page=100',
        '/api/v1/products?per_page=100',
    ],
    vendedor: [
        '/api/v1/me',
        '/api/v1/crm/deals?per_page=50',
        '/api/v1/customers?per_page=100',
        '/api/v1/quotes?per_page=50',
        '/api/v1/products?per_page=100',
        '/api/v1/services?per_page=100',
    ],
}

export function usePrefetchCriticalData() {
    const { currentMode } = useAppMode()
    const { token } = useAuthStore()
    const { isOnline, swRegistration } = usePWA()
    const lastPrefetch = useRef<string>('')

    useEffect(() => {
        if (!isOnline || !swRegistration || !token) return

        const cacheKey = `${currentMode}-${token.substring(0, 8)}`
        if (lastPrefetch.current === cacheKey) return

        const urls = MODE_URLS[currentMode] ?? MODE_URLS.gestao
        const baseUrl = window.location.origin

        if (navigator.serviceWorker?.controller) {
            navigator.serviceWorker.controller.postMessage({
                type: 'CACHE_API_DATA',
                urls: urls.map(u => `${baseUrl}${u}`),
                headers: {
                    Authorization: `Bearer ${token}`,
                    Accept: 'application/json',
                },
            })
            lastPrefetch.current = cacheKey
            console.log(`[PWA] Pre-caching data for mode: ${currentMode}`)
        }
    }, [currentMode, isOnline, swRegistration, token])
}
