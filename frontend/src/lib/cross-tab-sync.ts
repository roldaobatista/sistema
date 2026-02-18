import { QueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

const CHANNEL_NAME = 'kalibrium-sync'

interface SyncMessage {
    type: 'invalidate'
    queryKeys: string[]
    source: string
    timestamp: number
}

let channel: BroadcastChannel | null = null

function getChannel(): BroadcastChannel | null {
    if (typeof BroadcastChannel === 'undefined') return null
    if (!channel) {
        channel = new BroadcastChannel(CHANNEL_NAME)
    }
    return channel
}

/**
 * Broadcast query invalidation to all other open tabs.
 * Call this in any mutation's onSuccess callback.
 *
 * @example
 * onSuccess: () => {
 *   qc.invalidateQueries({ queryKey: ['customers'] })
 *   broadcastQueryInvalidation(['customers', 'customers-search'], 'Cliente')
 * }
 */
export function broadcastQueryInvalidation(queryKeys: string[], source?: string) {
    const ch = getChannel()
    if (!ch) return

    const message: SyncMessage = {
        type: 'invalidate',
        queryKeys,
        source: source ?? '',
        timestamp: Date.now(),
    }
    ch.postMessage(message)
}

/**
 * Initialize the global cross-tab sync listener.
 * Call ONCE at the App level. Listens for invalidation
 * messages from other tabs and applies them to queryClient.
 */
export function initCrossTabSync(queryClient: QueryClient) {
    const ch = getChannel()
    if (!ch) return

    ch.onmessage = (event: MessageEvent<SyncMessage>) => {
        const data = event.data
        if (data?.type !== 'invalidate' || !Array.isArray(data.queryKeys)) return

        for (const key of data.queryKeys) {
            queryClient.invalidateQueries({ queryKey: [key] })
        }

        if (data.source) {
            toast.info(`${data.source} atualizado(a) em outra aba`, {
                duration: 2000,
                id: `sync-${data.timestamp}`,
            })
        }
    }
}

/**
 * Cleanup the BroadcastChannel. Call on app unmount.
 */
export function cleanupCrossTabSync() {
    if (channel) {
        channel.close()
        channel = null
    }
}
