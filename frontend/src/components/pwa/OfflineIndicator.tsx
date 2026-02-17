import { useState, useEffect, useCallback } from 'react'
import { Wifi, WifiOff, CloudOff, RefreshCw, CheckCircle2 } from 'lucide-react'

export default function OfflineIndicator() {
    const [isOnline, setIsOnline] = useState(navigator.onLine)
    const [queueCount, setQueueCount] = useState(0)
    const [syncing, setSyncing] = useState(false)
    const [showBanner, setShowBanner] = useState(false)

    const updateQueueCount = useCallback(async () => {
        try {
            if ('indexedDB' in window) {
                const request = indexedDB.open('kalibrium-offline', 1)
                request.onsuccess = () => {
                    const db = request.result
                    if (db.objectStoreNames.contains('offline-queue')) {
                        const tx = db.transaction('offline-queue', 'readonly')
                        const store = tx.objectStore('offline-queue')
                        const countReq = store.count()
                        countReq.onsuccess = () => setQueueCount(countReq.result)
                    }
                    db.close()
                }
            }
        } catch {
            // IndexedDB not available
        }
    }, [])

    useEffect(() => {
        const handleOnline = () => {
            setIsOnline(true)
            setShowBanner(true)
            setTimeout(() => setShowBanner(false), 3000)
        }
        const handleOffline = () => {
            setIsOnline(false)
            setShowBanner(true)
        }

        window.addEventListener('online', handleOnline)
        window.addEventListener('offline', handleOffline)

        // Listen for SW sync events
        const handleSyncMessage = (event: MessageEvent) => {
            if (event.data?.type === 'SYNC_COMPLETE') {
                setSyncing(false)
                updateQueueCount()
            }
            if (event.data?.type === 'SYNC_STARTED') {
                setSyncing(true)
            }
            if (event.data?.type === 'QUEUE_UPDATE') {
                setQueueCount(event.data.count ?? 0)
            }
        }

        navigator.serviceWorker?.addEventListener('message', handleSyncMessage)

        // Initial check for queued items
        updateQueueCount()

        return () => {
            window.removeEventListener('online', handleOnline)
            window.removeEventListener('offline', handleOffline)
            navigator.serviceWorker?.removeEventListener('message', handleSyncMessage)
        }
    }, [updateQueueCount])

    const forceSync = async () => {
        if (navigator.serviceWorker?.controller) {
            navigator.serviceWorker.controller.postMessage({ type: 'FORCE_SYNC' })
            setSyncing(true)
        }
    }

    // Don't show anything if online and no queue
    if (isOnline && queueCount === 0 && !showBanner && !syncing) {
        return null
    }

    return (
        <>
            {/* Offline Banner */}
            {!isOnline && (
                <div className="fixed bottom-0 left-0 right-0 z-50 bg-amber-600 px-4 py-2 text-center text-sm font-medium text-white shadow-lg">
                    <div className="flex items-center justify-center gap-2">
                        <WifiOff className="h-4 w-4" />
                        Você está offline. As alterações serão sincronizadas quando a conexão voltar.
                        {queueCount > 0 && (
                            <span className="rounded-full bg-white/20 px-2 py-0.5 text-xs">
                                {queueCount} pendente(s)
                            </span>
                        )}
                    </div>
                </div>
            )}

            {/* Back Online Banner */}
            {showBanner && isOnline && (
                <div className="fixed bottom-0 left-0 right-0 z-50 bg-emerald-600 px-4 py-2 text-center text-sm font-medium text-white shadow-lg animate-fade-in">
                    <div className="flex items-center justify-center gap-2">
                        <CheckCircle2 className="h-4 w-4" />
                        Conexão restaurada!
                    </div>
                </div>
            )}

            {/* Queue Indicator (small floating badge) */}
            {isOnline && queueCount > 0 && (
                <div className="fixed bottom-4 right-4 z-40">
                    <button
                        onClick={forceSync}
                        disabled={syncing}
                        className="flex items-center gap-2 rounded-full bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-lg hover:bg-blue-700 disabled:opacity-70"
                    >
                        <RefreshCw className={`h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />
                        {syncing ? 'Sincronizando...' : `Sincronizar (${queueCount})`}
                    </button>
                </div>
            )}

            {/* Syncing indicator */}
            {syncing && (
                <div className="fixed bottom-4 right-4 z-40 flex items-center gap-2 rounded-full bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-lg">
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    Sincronizando dados offline...
                </div>
            )}
        </>
    )
}
