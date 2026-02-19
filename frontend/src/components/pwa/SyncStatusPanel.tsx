import { useState, useEffect, useCallback } from 'react'
import { RefreshCw, Trash2, Clock, AlertCircle, CheckCircle2, X, CloudOff } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

interface QueueItem {
    id: number
    url: string
    method: string
    timestamp: number
    status?: 'pending' | 'syncing' | 'error'
}

function formatRelativeTime(timestamp: number): string {
    const diff = Date.now() - timestamp
    const seconds = Math.floor(diff / 1000)
    if (seconds < 60) return 'agora'
    const minutes = Math.floor(seconds / 60)
    if (minutes < 60) return `${minutes}min atrás`
    const hours = Math.floor(minutes / 60)
    if (hours < 24) return `${hours}h atrás`
    return `${Math.floor(hours / 24)}d atrás`
}

function extractEndpoint(url: string): string {
    try {
        const pathname = new URL(url).pathname
        const parts = pathname.replace('/api/v1/', '').split('/')
        return parts[0] ?? pathname
    } catch {
        return url
    }
}

const METHOD_LABELS: Record<string, string> = {
    POST: 'Criar',
    PUT: 'Atualizar',
    PATCH: 'Atualizar',
    DELETE: 'Excluir',
}

export function SyncStatusPanel() {
    const [open, setOpen] = useState(false)
    const [items, setItems] = useState<QueueItem[]>([])
    const [syncing, setSyncing] = useState(false)
    const [isOnline, setIsOnline] = useState(navigator.onLine)

    const loadQueue = useCallback(async () => {
        try {
            if (!('indexedDB' in window)) return
            const request = indexedDB.open('kalibrium-offline', 1)
            request.onupgradeneeded = () => {
                const db = request.result
                if (!db.objectStoreNames.contains('sync-queue')) {
                    db.createObjectStore('sync-queue', { keyPath: 'id', autoIncrement: true })
                }
            }
            request.onsuccess = () => {
                const db = request.result
                if (!db.objectStoreNames.contains('sync-queue')) {
                    db.close()
                    return
                }
                const tx = db.transaction('sync-queue', 'readonly')
                const store = tx.objectStore('sync-queue')
                const getAll = store.getAll()
                getAll.onsuccess = () => {
                    setItems(
                        (getAll.result as QueueItem[]).map(item => ({
                            ...item,
                            status: item.status ?? 'pending',
                        }))
                    )
                }
                db.close()
            }
        } catch {
            // IndexedDB not available
        }
    }, [])

    useEffect(() => {
        if (open) loadQueue()
    }, [open, loadQueue])

    useEffect(() => {
        const handleOnline = () => setIsOnline(true)
        const handleOffline = () => setIsOnline(false)
        window.addEventListener('online', handleOnline)
        window.addEventListener('offline', handleOffline)

        const handleSyncMessage = (event: MessageEvent) => {
            if (event.data?.type === 'SYNC_COMPLETE') {
                setSyncing(false)
                loadQueue()
            }
            if (event.data?.type === 'SYNC_STARTED') setSyncing(true)
        }
        navigator.serviceWorker?.addEventListener('message', handleSyncMessage)

        return () => {
            window.removeEventListener('online', handleOnline)
            window.removeEventListener('offline', handleOffline)
            navigator.serviceWorker?.removeEventListener('message', handleSyncMessage)
        }
    }, [loadQueue])

    const forceSync = () => {
        if (navigator.serviceWorker?.controller) {
            navigator.serviceWorker.controller.postMessage({ type: 'FORCE_SYNC' })
            setSyncing(true)
        }
    }

    const clearQueue = async () => {
        try {
            const request = indexedDB.open('kalibrium-offline', 1)
            request.onsuccess = () => {
                const db = request.result
                if (!db.objectStoreNames.contains('sync-queue')) {
                    db.close()
                    return
                }
                const tx = db.transaction('sync-queue', 'readwrite')
                tx.objectStore('sync-queue').clear()
                tx.oncomplete = () => {
                    setItems([])
                    db.close()
                }
            }
        } catch {
            // ignore
        }
    }

    const count = items.length

    if (count === 0 && !syncing) return null

    return (
        <div className="relative">
            <button
                onClick={() => setOpen(!open)}
                className={cn(
                    'relative flex items-center gap-1.5 rounded-[var(--radius-md)] px-2 py-1.5 text-xs font-medium transition-colors',
                    syncing
                        ? 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-500/10'
                        : 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10 hover:bg-amber-100 dark:hover:bg-amber-500/15'
                )}
                title={`${count} operação(ões) pendente(s)`}
            >
                <CloudOff className={cn('h-3.5 w-3.5', syncing && 'animate-pulse')} />
                <span className="tabular-nums">{count}</span>
                {syncing && <RefreshCw className="h-3 w-3 animate-spin" />}
            </button>

            {open && (
                <>
                    <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
                    <div className="absolute right-0 top-full mt-2 z-50 w-80 rounded-xl border border-surface-200 dark:border-white/10 bg-white dark:bg-surface-900 shadow-2xl overflow-hidden">
                        {/* Header */}
                        <div className="flex items-center justify-between px-4 py-3 border-b border-surface-100 dark:border-white/6">
                            <h3 className="text-sm font-semibold text-surface-900 dark:text-white">
                                Fila de Sincronização
                            </h3>
                            <button onClick={() => setOpen(false)} className="p-1 rounded-md hover:bg-surface-100 dark:hover:bg-white/5" aria-label="Fechar painel">
                                <X className="h-3.5 w-3.5 text-surface-400" />
                            </button>
                        </div>

                        {/* Status */}
                        <div className="px-4 py-2 bg-surface-50 dark:bg-white/[0.02] border-b border-surface-100 dark:border-white/6">
                            <div className="flex items-center gap-2 text-xs">
                                {isOnline ? (
                                    <><CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /> <span className="text-emerald-600 dark:text-emerald-400 font-medium">Online</span></>
                                ) : (
                                    <><AlertCircle className="h-3.5 w-3.5 text-amber-500" /> <span className="text-amber-600 dark:text-amber-400 font-medium">Offline</span></>
                                )}
                                <span className="text-surface-400 ml-auto">{count} pendente(s)</span>
                            </div>
                        </div>

                        {/* Items */}
                        <div className="max-h-60 overflow-y-auto divide-y divide-surface-100 dark:divide-white/6">
                            {items.length === 0 ? (
                                <div className="px-4 py-6 text-center text-sm text-surface-400">
                                    Nenhum item na fila
                                </div>
                            ) : (
                                items.map((item) => (
                                    <div key={item.id} className="px-4 py-2.5 flex items-start gap-3">
                                        <div className={cn(
                                            'mt-0.5 rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide',
                                            item.method === 'DELETE' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                                                : item.method === 'POST' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                                                    : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                                        )}>
                                            {METHOD_LABELS[item.method] ?? item.method}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-xs font-medium text-surface-700 dark:text-surface-200 truncate">
                                                {extractEndpoint(item.url)}
                                            </p>
                                            <p className="text-[10px] text-surface-400 flex items-center gap-1 mt-0.5">
                                                <Clock className="h-2.5 w-2.5" />
                                                {formatRelativeTime(item.timestamp)}
                                            </p>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>

                        {/* Actions */}
                        <div className="flex gap-2 px-4 py-3 border-t border-surface-100 dark:border-white/6 bg-surface-50 dark:bg-white/[0.02]">
                            <Button
                                size="sm"
                                variant="default"
                                className="flex-1 gap-1.5 text-xs"
                                onClick={forceSync}
                                disabled={syncing || !isOnline || count === 0}
                            >
                                <RefreshCw className={cn('h-3 w-3', syncing && 'animate-spin')} />
                                {syncing ? 'Sincronizando...' : 'Sincronizar'}
                            </Button>
                            <Button
                                size="sm"
                                variant="outline"
                                className="gap-1.5 text-xs text-red-600 hover:text-red-700 dark:text-red-400"
                                onClick={clearQueue}
                                disabled={count === 0}
                            >
                                <Trash2 className="h-3 w-3" />
                                Limpar
                            </Button>
                        </div>
                    </div>
                </>
            )}
        </div>
    )
}
