import { useState, useEffect, useCallback, useRef } from 'react'
import { Bell, BellRing, Check, Clock, Wrench, AlertTriangle, UserCheck } from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import api from '@/lib/api'
import { isApiHealthy } from '@/lib/api-health'
import { useAuthStore } from '@/stores/auth-store'

interface Notification {
    id: string
    type: 'status_change' | 'assignment' | 'sla_warning' | 'comment' | 'approval' | 'completion'
    title: string
    message: string
    work_order_id?: number
    read: boolean
    created_at: string
}

const typeConfig: Record<string, { icon: any; color: string }> = {
    status_change: { icon: Clock, color: 'text-sky-500 bg-sky-50' },
    assignment: { icon: UserCheck, color: 'text-violet-500 bg-violet-50' },
    sla_warning: { icon: AlertTriangle, color: 'text-amber-500 bg-amber-50' },
    comment: { icon: Bell, color: 'text-surface-500 bg-surface-50' },
    approval: { icon: Check, color: 'text-emerald-500 bg-emerald-50' },
    completion: { icon: Wrench, color: 'text-brand-500 bg-brand-50' },
}

// Hook for real-time notifications
export function useOSNotifications() {
    const [notifications, setNotifications] = useState<Notification[]>([])
    const [unreadCount, setUnreadCount] = useState(0)
    const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null)
    const { token } = useAuthStore()

    // Fetch existing notifications
    const fetchNotifications = useCallback(async () => {
        if (!isApiHealthy() || !token) return
        try {
            const res = await api.get('/notifications', { params: { per_page: 20 } })
            const data: Notification[] = res.data?.data ?? []
            setNotifications(data)
            setUnreadCount(data.filter(n => !n.read).length)
        } catch {
            // silent fail
        }
    }, [token])

    // Try WebSocket first, fall back to polling
    useEffect(() => {
        if (!token) return
        fetchNotifications()

        // Real-time notifications handled by Laravel Echo (Reverb) on /app path.
        // Native WebSocket on /ws is not supported by the current Nginx config.
        // Use polling as the reliable fallback.
        startPolling()

        function startPolling() {
            if (!pollingRef.current) {
                pollingRef.current = setInterval(fetchNotifications, 30000)
            }
        }

        // Listen for API health recovery to resume polling
        const onHealthChange = (e: Event) => {
            const detail = (e as CustomEvent).detail
            if (detail?.healthy) fetchNotifications()
        }
        window.addEventListener('api:health-changed', onHealthChange)

        return () => {
            if (pollingRef.current) clearInterval(pollingRef.current)
            window.removeEventListener('api:health-changed', onHealthChange)
        }
    }, [fetchNotifications])

    const markAsRead = useCallback(async (id: string) => {
        try {
            await api.put(`/notifications/${id}/read`)
            setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n))
            setUnreadCount(prev => Math.max(0, prev - 1))
        } catch { /* silent */ }
    }, [])

    const markAllRead = useCallback(async () => {
        try {
            await api.put('/notifications/read-all')
            setNotifications(prev => prev.map(n => ({ ...n, read: true })))
            setUnreadCount(0)
        } catch { /* silent */ }
    }, [])

    const requestPermission = useCallback(async () => {
        if ('Notification' in window && Notification.permission === 'default') {
            await Notification.requestPermission()
        }
    }, [])

    return { notifications, unreadCount, markAsRead, markAllRead, requestPermission, refetch: fetchNotifications }
}

// Notification Bell Component
export default function NotificationBell() {
    const { notifications, unreadCount, markAsRead, markAllRead, requestPermission } = useOSNotifications()
    const [isOpen, setIsOpen] = useState(false)

    useEffect(() => {
        requestPermission()
    }, [requestPermission])

    const formatTimeAgo = (date: string) => {
        const diff = Date.now() - new Date(date).getTime()
        const mins = Math.floor(diff / 60000)
        if (mins < 1) return 'agora'
        if (mins < 60) return `${mins}min`
        const hours = Math.floor(mins / 60)
        if (hours < 24) return `${hours}h`
        return `${Math.floor(hours / 24)}d`
    }

    return (
        <div className="relative">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="relative rounded-lg p-2 text-surface-500 hover:bg-surface-100 hover:text-surface-700 transition-colors"
                aria-label="Notificações"
            >
                {unreadCount > 0 ? <BellRing className="h-5 w-5" /> : <Bell className="h-5 w-5" />}
                {unreadCount > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white">
                        {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                )}
            </button>

            {isOpen && (
                <>
                    <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
                    <div className="absolute right-0 top-full mt-2 z-50 w-80 rounded-2xl border border-default bg-surface-0 shadow-lg overflow-hidden">
                        {/* Header */}
                        <div className="flex items-center justify-between px-4 py-3 border-b border-subtle">
                            <h3 className="text-sm font-bold text-surface-900">Notificações</h3>
                            {unreadCount > 0 && (
                                <button
                                    onClick={markAllRead}
                                    className="text-[10px] font-medium text-brand-600 hover:text-brand-700"
                                >
                                    Marcar todas como lidas
                                </button>
                            )}
                        </div>

                        {/* Notification list */}
                        <div className="max-h-80 overflow-y-auto">
                            {notifications.length === 0 ? (
                                <div className="px-4 py-8 text-center">
                                    <Bell className="mx-auto h-8 w-8 text-surface-200 mb-2" />
                                    <p className="text-xs text-surface-400">Nenhuma notificação</p>
                                </div>
                            ) : (
                                notifications.map(notif => {
                                    const config = typeConfig[notif.type] ?? typeConfig.comment
                                    const Icon = config.icon

                                    return (
                                        <button
                                            key={notif.id}
                                            onClick={() => {
                                                markAsRead(notif.id)
                                                if (notif.work_order_id) {
                                                    window.location.href = `/os/${notif.work_order_id}`
                                                }
                                            }}
                                            className={cn(
                                                'w-full text-left flex gap-3 px-4 py-3 border-b border-subtle/50 hover:bg-surface-50 transition-colors',
                                                !notif.read && 'bg-brand-50/30'
                                            )}
                                        >
                                            <div className={cn('rounded-full p-2 flex-shrink-0', config.color)}>
                                                <Icon className="h-3.5 w-3.5" />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center justify-between">
                                                    <span className={cn('text-xs font-medium', notif.read ? 'text-surface-600' : 'text-surface-900')}>
                                                        {notif.title}
                                                    </span>
                                                    <span className="text-[9px] text-surface-400 flex-shrink-0 ml-2">
                                                        {formatTimeAgo(notif.created_at)}
                                                    </span>
                                                </div>
                                                <p className="text-[11px] text-surface-500 mt-0.5 truncate">{notif.message}</p>
                                            </div>
                                            {!notif.read && <div className="w-1.5 h-1.5 rounded-full bg-brand-500 flex-shrink-0 mt-2" />}
                                        </button>
                                    )
                                })
                            )}
                        </div>
                    </div>
                </>
            )}
        </div>
    )
}
