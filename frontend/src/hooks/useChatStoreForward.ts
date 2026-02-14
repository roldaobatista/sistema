import { useState, useCallback, useEffect } from 'react'
import { getDb, generateUlid } from '@/lib/offlineDb'

export interface ChatMessage {
    id: string
    work_order_id: number
    sender_id: number
    sender_name: string
    body: string
    type: 'text' | 'image' | 'voice'
    synced: boolean
    created_at: string
}

const STORE_KEY = 'chat-messages'

export function useChatStoreForward(workOrderId: number) {
    const [messages, setMessages] = useState<ChatMessage[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [pendingCount, setPendingCount] = useState(0)

    const refresh = useCallback(async () => {
        setIsLoading(true)
        try {
            // Load from localStorage (no need for more IndexedDB stores)
            const stored = localStorage.getItem(`${STORE_KEY}-${workOrderId}`)
            const parsed: ChatMessage[] = stored ? JSON.parse(stored) : []
            setMessages(parsed.sort((a, b) => a.created_at.localeCompare(b.created_at)))
            setPendingCount(parsed.filter(m => !m.synced).length)
        } catch {
            setMessages([])
        } finally {
            setIsLoading(false)
        }
    }, [workOrderId])

    useEffect(() => {
        refresh()
    }, [refresh])

    const sendMessage = useCallback(async (
        body: string,
        senderId: number,
        senderName: string,
        type: ChatMessage['type'] = 'text'
    ) => {
        const msg: ChatMessage = {
            id: generateUlid(),
            work_order_id: workOrderId,
            sender_id: senderId,
            sender_name: senderName,
            body,
            type,
            synced: false,
            created_at: new Date().toISOString(),
        }

        const stored = localStorage.getItem(`${STORE_KEY}-${workOrderId}`)
        const existing: ChatMessage[] = stored ? JSON.parse(stored) : []
        existing.push(msg)
        localStorage.setItem(`${STORE_KEY}-${workOrderId}`, JSON.stringify(existing))

        // Also enqueue for sync
        try {
            const { enqueueMutation } = await import('@/lib/offlineDb')
            await enqueueMutation('POST', `/api/v1/work-orders/${workOrderId}/chat`, {
                body: msg.body,
                type: msg.type,
                local_id: msg.id,
            })
        } catch {
            // Will be synced later
        }

        await refresh()
    }, [workOrderId, refresh])

    const markSynced = useCallback(async (messageIds: string[]) => {
        const stored = localStorage.getItem(`${STORE_KEY}-${workOrderId}`)
        const existing: ChatMessage[] = stored ? JSON.parse(stored) : []

        for (const msg of existing) {
            if (messageIds.includes(msg.id)) {
                msg.synced = true
            }
        }

        localStorage.setItem(`${STORE_KEY}-${workOrderId}`, JSON.stringify(existing))
        await refresh()
    }, [workOrderId, refresh])

    const mergeServerMessages = useCallback(async (serverMessages: ChatMessage[]) => {
        const stored = localStorage.getItem(`${STORE_KEY}-${workOrderId}`)
        const local: ChatMessage[] = stored ? JSON.parse(stored) : []
        const localIds = new Set(local.map(m => m.id))

        const newMsgs = serverMessages.filter(m => !localIds.has(m.id))
        const merged = [...local, ...newMsgs].sort((a, b) => a.created_at.localeCompare(b.created_at))

        localStorage.setItem(`${STORE_KEY}-${workOrderId}`, JSON.stringify(merged))
        await refresh()
    }, [workOrderId, refresh])

    return {
        messages,
        isLoading,
        pendingCount,
        sendMessage,
        markSynced,
        mergeServerMessages,
        refresh,
    }
}
