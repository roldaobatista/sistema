import { useEffect, useCallback, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'

const CHANNEL_NAME = 'kalibrium-sync'

interface SyncMessage {
    type: 'invalidate'
    queryKeys: string[]
    timestamp: number
}

/**
 * Cross-tab synchronization via BroadcastChannel API.
 * When a mutation succeeds, call `broadcast([...keys])` to invalidate
 * those React Query keys in all other open tabs.
 *
 * Also pairs with `refetchOnWindowFocus: true` in QueryClient as fallback.
 */
export function useCrossTabSync() {
    const queryClient = useQueryClient()
    const channelRef = useRef<BroadcastChannel | null>(null)

    useEffect(() => {
        if (typeof BroadcastChannel === 'undefined') return

        const channel = new BroadcastChannel(CHANNEL_NAME)
        channelRef.current = channel

        channel.onmessage = (event: MessageEvent<SyncMessage>) => {
            if (event.data?.type === 'invalidate' && Array.isArray(event.data.queryKeys)) {
                for (const key of event.data.queryKeys) {
                    queryClient.invalidateQueries({ queryKey: [key] })
                }
            }
        }

        return () => {
            channel.close()
            channelRef.current = null
        }
    }, [queryClient])

    const broadcast = useCallback((queryKeys: string[]) => {
        if (channelRef.current) {
            const message: SyncMessage = {
                type: 'invalidate',
                queryKeys,
                timestamp: Date.now(),
            }
            channelRef.current.postMessage(message)
        }
    }, [])

    return { broadcast }
}
