import { useEffect, useRef, useCallback, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'

interface WebSocketConfig {
    url?: string
    tenantId?: number | string
    userId?: number | string
    enabled?: boolean
}

interface WebSocketMessage {
    event?: string
    channel?: string
    data?: unknown
    [key: string]: unknown
}

export function useWebSocket(config: WebSocketConfig) {
    const { url, tenantId, userId, enabled = true } = config
    const wsRef = useRef<WebSocket | null>(null)
    const reconnectTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
    const reconnectAttempts = useRef(0)
    const connectRef = useRef<() => void>(() => { })
    const qc = useQueryClient()
    const [isConnected, setIsConnected] = useState(false)
    const [lastMessage, setLastMessage] = useState<WebSocketMessage | null>(null)

    const maxReconnectAttempts = 5
    const baseDelay = 2000

    const getReconnectDelay = useCallback(() => {
        return Math.min(baseDelay * Math.pow(2, reconnectAttempts.current), 30000)
    }, [])

    const connect = useCallback(() => {
        if (!enabled || !url) return

        try {
            const ws = new WebSocket(url)

            ws.onopen = () => {
                setIsConnected(true)
                reconnectAttempts.current = 0

                // Subscribe to channels
                if (tenantId) {
                    ws.send(JSON.stringify({
                        event: 'subscribe',
                        channel: `private-tenant.${tenantId}.notifications`,
                    }))
                }
                if (userId) {
                    ws.send(JSON.stringify({
                        event: 'subscribe',
                        channel: `private-user.${userId}.notifications`,
                    }))
                }
            }

            ws.onmessage = (event) => {
                try {
                    const message: WebSocketMessage = JSON.parse(event.data)
                    setLastMessage(message)

                    // Auto-invalidate notification queries when new notification arrives
                    if (message.event === 'notification.new') {
                        qc.invalidateQueries({ queryKey: ['notifications'] })
                        qc.invalidateQueries({ queryKey: ['notifications-unread'] })
                    }
                } catch {
                    // Ignore non-JSON messages (pings, etc.)
                }
            }

            ws.onclose = () => {
                setIsConnected(false)
                wsRef.current = null

                if (enabled && reconnectAttempts.current < maxReconnectAttempts) {
                    const delay = getReconnectDelay()
                    reconnectAttempts.current += 1
                    reconnectTimer.current = setTimeout(() => connectRef.current(), delay)
                }
            }

            ws.onerror = () => {
                // Silently close — errors are expected when WS server (Reverb) is not running
                ws.close()
            }

            wsRef.current = ws
        } catch {
            // WebSocket not available or URL invalid
        }
    }, [url, tenantId, userId, enabled, qc, getReconnectDelay])

    useEffect(() => {
        connectRef.current = connect
    }, [connect])

    const disconnect = useCallback(() => {
        if (reconnectTimer.current) {
            clearTimeout(reconnectTimer.current)
        }
        if (wsRef.current) {
            wsRef.current.close()
            wsRef.current = null
        }
        setIsConnected(false)
    }, [])

    const send = useCallback((data: unknown) => {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify(data))
        }
    }, [])

    useEffect(() => {
        connect()
        return () => disconnect()
    }, [connect, disconnect])

    return { isConnected, lastMessage, send, disconnect, reconnect: connect }
}
