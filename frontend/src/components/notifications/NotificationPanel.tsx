import { useState, useRef, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import {
    Bell, CheckCheck, AlertTriangle, Clock,
    Scale, FileText, Wrench, X,
    type LucideIcon,
} from 'lucide-react'
import api from '@/lib/api'
import { cn } from '@/lib/utils'
import { useWebSocket } from '@/hooks/useWebSocket'

interface NotificationItem {
    id: number
    title: string
    message?: string | null
    icon?: string | null
    color?: string | null
    link?: string | null
    read_at?: string | null
    created_at: string
}

interface NotificationCountResponse {
    unread_count: number
}

interface NotificationListResponse {
    notifications: NotificationItem[]
}

const iconMap: Record<string, LucideIcon> = {
    'alert-triangle': AlertTriangle,
    'clock': Clock,
    'scale': Scale,
    'file-text': FileText,
    'wrench': Wrench,
}

const colorMap: Record<string, string> = {
    red: 'bg-red-100 text-red-600',
    amber: 'bg-amber-100 text-amber-600',
    blue: 'bg-blue-100 text-blue-600',
    green: 'bg-emerald-100 text-emerald-600',
    brand: 'bg-brand-100 text-brand-600',
}

export default function NotificationPanel() {
    const [open, setOpen] = useState(false)
    const [nowTs, setNowTs] = useState(() => Date.now())
    const ref = useRef<HTMLDivElement>(null)
    const navigate = useNavigate()
    const qc = useQueryClient()

    // WebSocket real-time connection
    const wsUrl = import.meta.env.VITE_WS_URL || undefined
    const { isConnected } = useWebSocket({
        url: wsUrl,
        enabled: !!wsUrl,
    })

    // Poll unread count every 30s (fallback when no WebSocket)
    const { data: countData } = useQuery<NotificationCountResponse>({
        queryKey: ['notifications-count'],
        queryFn: async () => (await api.get('/notifications/unread-count')).data,
        refetchInterval: isConnected ? 60_000 : 30_000, // slower poll when WS active
    })

    // Full list when panel open
    const { data: listData } = useQuery<NotificationListResponse>({
        queryKey: ['notifications'],
        queryFn: async () => (await api.get('/notifications')).data,
        enabled: open,
    })

    const markRead = useMutation({
        mutationFn: (id: number) => api.put(`/notifications/${id}/read`),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['notifications'] })
            qc.invalidateQueries({ queryKey: ['notifications-count'] })
        },
    })

    const markAllRead = useMutation({
        mutationFn: () => api.put('/notifications/read-all'),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['notifications'] })
            qc.invalidateQueries({ queryKey: ['notifications-count'] })
        },
    })

    // Close on outside click
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
        }
        document.addEventListener('mousedown', handler)
        return () => document.removeEventListener('mousedown', handler)
    }, [])

    // Update relative timestamps without using impure calls during render
    useEffect(() => {
        const timer = setInterval(() => setNowTs(Date.now()), 60_000)
        return () => clearInterval(timer)
    }, [])

    const unread = countData?.unread_count ?? 0
    const notifications: NotificationItem[] = listData?.notifications ?? []

    const handleClick = (n: NotificationItem) => {
        if (!n.read_at) markRead.mutate(n.id)
        if (n.link) {
            navigate(n.link)
            setOpen(false)
        }
    }

    const timeAgo = (date: string, now: number) => {
        const mins = Math.floor((now - new Date(date).getTime()) / 60000)
        if (mins < 1) return 'agora'
        if (mins < 60) return `${mins}min`
        const hrs = Math.floor(mins / 60)
        if (hrs < 24) return `${hrs}h`
        const days = Math.floor(hrs / 24)
        return `${days}d`
    }

    return (
        <div ref={ref} className="relative">
            <button
                onClick={() => setOpen(!open)}
                className="relative rounded-lg p-2 text-surface-500 hover:bg-surface-100 hover:text-surface-700 transition-colors"
            >
                <Bell size={20} />
                {unread > 0 && (
                    <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                        {unread > 99 ? '99+' : unread}
                    </span>
                )}
            </button>

            {open && (
                <div className="absolute right-0 top-full mt-2 w-96 overflow-hidden rounded-xl border border-default bg-white shadow-elevated z-50">
                    {/* Header */}
                    <div className="flex items-center justify-between border-b border-subtle px-4 py-3">
                        <h3 className="text-sm font-semibold text-surface-900">
                            Notificações
                            {unread > 0 && (
                                <span className="ml-2 rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-600">
                                    {unread}
                                </span>
                            )}
                        </h3>
                        <div className="flex items-center gap-1">
                            {unread > 0 && (
                                <button
                                    onClick={() => markAllRead.mutate()}
                                    className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-brand-600 hover:bg-brand-50"
                                    title="Marcar todas como lidas"
                                >
                                    <CheckCheck size={14} />
                                    Ler todas
                                </button>
                            )}
                            <button
                                onClick={() => setOpen(false)}
                                className="rounded-md p-1 text-surface-400 hover:bg-surface-100"
                            >
                                <X size={14} />
                            </button>
                        </div>
                    </div>

                    {/* List */}
                    <div className="max-h-[400px] overflow-y-auto">
                        {notifications.length === 0 && (
                            <p className="py-12 text-center text-sm text-surface-400">
                                Nenhuma notificação
                            </p>
                        )}
                        {notifications.map((n) => {
                            const iconKey = n.icon ?? ''
                            const colorKey = n.color ?? ''
                            const Icon = iconMap[iconKey] || Bell
                            const bgColor = colorMap[colorKey] || 'bg-surface-100 text-surface-600'
                            return (
                                <button
                                    key={n.id}
                                    onClick={() => handleClick(n)}
                                    className={cn(
                                        'flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-surface-50',
                                        !n.read_at && 'bg-brand-50/30'
                                    )}
                                >
                                    <div className={cn('mt-0.5 rounded-lg p-1.5', bgColor)}>
                                        <Icon size={14} />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className={cn(
                                            'text-sm leading-snug',
                                            !n.read_at ? 'font-medium text-surface-900' : 'text-surface-600'
                                        )}>
                                            {n.title}
                                        </p>
                                        {n.message && (
                                            <p className="mt-0.5 truncate text-xs text-surface-500">
                                                {n.message}
                                            </p>
                                        )}
                                        <p className="mt-1 text-[11px] text-surface-400">
                                            {timeAgo(n.created_at, nowTs)}
                                        </p>
                                    </div>
                                    {!n.read_at && (
                                        <div className="mt-2 h-2 w-2 shrink-0 rounded-full bg-brand-500" />
                                    )}
                                </button>
                            )
                        })}
                    </div>
                </div>
            )}
        </div>
    )
}
