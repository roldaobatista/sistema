import { useState, useEffect, useCallback, useRef } from 'react'
import { syncEngine, type SyncResult } from '@/lib/syncEngine'
import { getMutationQueueCount } from '@/lib/offlineDb'
import { usePWA } from '@/hooks/usePWA'

export function useSyncStatus() {
    const { isOnline } = usePWA()
    const [pendingCount, setPendingCount] = useState(0)
    const [lastSyncAt, setLastSyncAt] = useState<string | null>(null)
    const [isSyncing, setIsSyncing] = useState(false)
    const [lastResult, setLastResult] = useState<SyncResult | null>(null)
    const autoSyncTimerRef = useRef<number | null>(null)

    // Refresh pending count
    const refreshPendingCount = useCallback(async () => {
        const count = await getMutationQueueCount()
        setPendingCount(count)
    }, [])

    // Manual sync trigger
    const syncNow = useCallback(async () => {
        if (isSyncing || !isOnline) return null
        setIsSyncing(true)
        try {
            const result = await syncEngine.fullSync()
            setLastResult(result)
            setLastSyncAt(result.timestamp)
            await refreshPendingCount()
            return result
        } finally {
            setIsSyncing(false)
        }
    }, [isSyncing, isOnline, refreshPendingCount])

    // Listen for sync events from SW
    useEffect(() => {
        const handleMessage = (event: MessageEvent) => {
            if (event.data?.type === 'SYNC_COMPLETE') {
                refreshPendingCount()
                setLastSyncAt(new Date().toISOString())
            }
        }

        // Listen for localStorage requests from SW
        const handleSwMessage = (event: MessageEvent) => {
            if (event.data?.type === 'GET_LOCAL_STORAGE') {
                const value = localStorage.getItem(event.data.key)
                const parsed = value ? JSON.parse(value) : null
                event.ports[0]?.postMessage(parsed)
            }
        }

        navigator.serviceWorker?.addEventListener('message', handleMessage)
        navigator.serviceWorker?.addEventListener('message', handleSwMessage)

        return () => {
            navigator.serviceWorker?.removeEventListener('message', handleMessage)
            navigator.serviceWorker?.removeEventListener('message', handleSwMessage)
        }
    }, [refreshPendingCount])

    // Auto-sync when coming back online
    useEffect(() => {
        if (isOnline && pendingCount > 0) {
            syncNow()
        }
    }, [isOnline]) // eslint-disable-line react-hooks/exhaustive-deps

    // Periodic sync (every 5 minutes when online)
    useEffect(() => {
        if (isOnline) {
            autoSyncTimerRef.current = window.setInterval(() => {
                syncNow()
            }, 5 * 60 * 1000) // 5 minutes
        }

        return () => {
            if (autoSyncTimerRef.current) {
                clearInterval(autoSyncTimerRef.current)
                autoSyncTimerRef.current = null
            }
        }
    }, [isOnline, syncNow])

    // Initial refresh
    useEffect(() => {
        refreshPendingCount()
    }, [refreshPendingCount])

    // Listen for sync engine events
    useEffect(() => {
        return syncEngine.onSyncComplete((result) => {
            setLastResult(result)
            setLastSyncAt(result.timestamp)
            refreshPendingCount()
        })
    }, [refreshPendingCount])

    return {
        pendingCount,
        lastSyncAt,
        isSyncing,
        lastResult,
        isOnline,
        syncNow,
        refreshPendingCount,
    }
}
