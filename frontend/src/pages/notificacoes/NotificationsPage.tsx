import { useState } from 'react'
import { toast } from 'sonner'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Bell, Check, CheckCheck, AlertTriangle, Info, DollarSign, Wrench } from 'lucide-react'
import { cn } from '@/lib/utils'
import api from '@/lib/api'
import { useAuthStore } from '@/stores/auth-store'

interface Notification {
    id: number
    type: string
    title: string
    message: string
    read_at: string | null
    data: any
    created_at: string
}

const typeIcons: Record<string, React.ElementType> = {
    work_order: Wrench,
    financial: DollarSign,
    alert: AlertTriangle,
    info: Info,
    default: Bell,
}

const typeColors: Record<string, string> = {
    work_order: 'text-blue-600 bg-blue-50',
    financial: 'text-emerald-600 bg-emerald-50',
    alert: 'text-red-600 bg-red-50',
    info: 'text-sky-600 bg-sky-50',
    default: 'text-surface-600 bg-surface-100',
}

export function NotificationsPage() {
    const qc = useQueryClient()
    const [filter, setFilter] = useState<string>('')
    const { hasRole, hasPermission } = useAuthStore()
    const canViewNotifications = hasRole('super_admin') || hasPermission('notifications.notification.view')
    const canUpdateNotifications = hasRole('super_admin') || hasPermission('notifications.notification.update')

    const { data: res, isLoading, isError } = useQuery({
        queryKey: ['notifications-full'],
        queryFn: () => api.get('/notifications?limit=100'),
        enabled: canViewNotifications,
    })
    const allNotifications: Notification[] = res?.data?.notifications ?? []
    const unreadCount: number = res?.data?.unread_count ?? 0

    const notifications = filter
        ? allNotifications.filter(n => n.type === filter)
        : allNotifications

    const markReadMut = useMutation({
        mutationFn: (id: number) => api.put(`/notifications/${id}/read`),
        onSuccess: () => {
            toast.success('Operação realizada com sucesso')
                qc.invalidateQueries({ queryKey: ['notifications-full'] })
        },
    })

    const markAllMut = useMutation({
        mutationFn: () => api.put('/notifications/read-all'),
        onSuccess: () => {
            toast.success('Operação realizada com sucesso')
                qc.invalidateQueries({ queryKey: ['notifications-full'] })
        },
    })

    if (!canViewNotifications) {
        return (
            <div className="rounded-xl border border-default bg-surface-0 p-8 text-center shadow-card">
                <Bell className="mx-auto mb-3 h-10 w-10 text-surface-300" />
                <h1 className="text-base font-semibold text-surface-900">Sem acesso a notificações</h1>
                <p className="mt-1 text-sm text-surface-500">
                    Você não possui permissão para visualizar este módulo.
                </p>
            </div>
        )
    }

    const fmtDate = (d: string) => {
        const dt = new Date(d)
        const now = new Date()
        const diff = now.getTime() - dt.getTime()
        if (diff < 60000) return 'agora'
        if (diff < 3600000) return `${Math.floor(diff / 60000)}min`
        if (diff < 86400000) return `${Math.floor(diff / 3600000)}h`
        return dt.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
    }

    const filterTypes = [
        { key: '', label: 'Todos', count: allNotifications.length },
        { key: 'work_order', label: 'OS', count: allNotifications.filter(n => n.type === 'work_order').length },
        { key: 'financial', label: 'Financeiro', count: allNotifications.filter(n => n.type === 'financial').length },
        { key: 'alert', label: 'Alertas', count: allNotifications.filter(n => n.type === 'alert').length },
        { key: 'info', label: 'Info', count: allNotifications.filter(n => n.type === 'info').length },
    ].filter(f => f.key === '' || f.count > 0)

    return (
        <div className="space-y-5">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-lg font-semibold text-surface-900 tracking-tight">Notificações</h1>
                    <p className="text-sm text-surface-500 mt-1">
                        {unreadCount > 0 ? `${unreadCount} não lida${unreadCount > 1 ? 's' : ''}` : 'Todas lidas'}
                    </p>
                </div>
                {unreadCount > 0 && canUpdateNotifications && (
                    <button
                        onClick={() => markAllMut.mutate()}
                        disabled={markAllMut.isPending}
                        className="inline-flex items-center gap-2 rounded-lg border border-default px-4 py-2 text-sm font-medium text-surface-700 hover:bg-surface-50 transition-colors duration-100"
                    >
                        <CheckCheck className="h-4 w-4" /> Marcar todas como lidas
                    </button>
                )}
            </div>

            <div className="flex flex-wrap gap-2">
                {filterTypes.map(f => (
                    <button
                        key={f.key}
                        onClick={() => setFilter(f.key)}
                        className={cn(
                            'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-all',
                            filter === f.key
                                ? 'bg-brand-600 text-white shadow-sm'
                                : 'bg-surface-100 text-surface-600 hover:bg-surface-200'
                        )}
                    >
                        {f.label}
                        <span className={cn(
                            'rounded-full px-1.5 py-0.5 text-xs font-bold',
                            filter === f.key ? 'bg-white/20' : 'bg-surface-200'
                        )}>{f.count}</span>
                    </button>
                ))}
            </div>

            <div className="rounded-xl border border-default bg-surface-0 shadow-card overflow-hidden divide-y divide-subtle">
                {isLoading ? (
                    <div className="p-12 text-center text-surface-400">Carregando...</div>
                ) : isError ? (
                    <div className="p-12 text-center text-red-500">Erro ao carregar notificações. Tente novamente.</div>
                ) : notifications.length === 0 ? (
                    <div className="p-12 text-center text-surface-400">
                        <Bell className="h-10 w-10 mx-auto mb-3 text-surface-300" />
                        Nenhuma notificação encontrada.
                    </div>
                ) : (
                    notifications.map(n => {
                        const Icon = typeIcons[n.type] ?? typeIcons.default
                        const color = typeColors[n.type] ?? typeColors.default
                        const isUnread = !n.read_at

                        return (
                            <div
                                key={n.id}
                                className={cn(
                                    'flex items-start gap-4 px-5 py-4 transition-colors',
                                    isUnread ? 'bg-brand-50/30' : 'hover:bg-surface-50',
                                )}
                            >
                                <div className={cn('rounded-lg p-2 flex-shrink-0', color)}>
                                    <Icon className="h-4 w-4" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                        <p className={cn('text-sm', isUnread ? 'font-semibold text-surface-900' : 'text-surface-700')}>
                                            {n.title}
                                        </p>
                                        {isUnread && <span className="h-2 w-2 rounded-full bg-brand-500 flex-shrink-0" />}
                                    </div>
                                    <p className="text-sm text-surface-500 mt-0.5 line-clamp-2">{n.message}</p>
                                </div>
                                <div className="flex items-center gap-2 flex-shrink-0">
                                    <span className="text-xs text-surface-400">{fmtDate(n.created_at)}</span>
                                    {isUnread && canUpdateNotifications && (
                                        <button
                                            onClick={() => markReadMut.mutate(n.id)}
                                            className="text-brand-600 hover:text-brand-700 p-1 rounded"
                                            title="Marcar como lida"
                                        >
                                            <Check className="h-4 w-4" />
                                        </button>
                                    )}
                                </div>
                            </div>
                        )
                    })
                )}
            </div>
        </div>
    )
}
