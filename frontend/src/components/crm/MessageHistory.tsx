import { useQuery } from '@tanstack/react-query'
import { crmApi } from '@/lib/crm-api'
import type { CrmMessage } from '@/lib/crm-api'
import { MESSAGE_STATUS } from '@/lib/constants'
import { cn } from '@/lib/utils'
import { MessageCircle, Mail, Check, CheckCheck, Clock, AlertCircle, Eye } from 'lucide-react'

interface Props {
    customerId: number
    dealId?: number
}

const STATUS_ICONS: Record<string, { icon: React.ElementType; color: string; label: string }> = {
    pending: { icon: Clock, color: 'text-surface-400', label: 'Pendente' },
    sent: { icon: Check, color: 'text-surface-500', label: 'Enviada' },
    delivered: { icon: CheckCheck, color: 'text-surface-500', label: 'Entregue' },
    read: { icon: Eye, color: 'text-blue-500', label: 'Lida' },
    failed: { icon: AlertCircle, color: 'text-red-500', label: 'Falhou' },
}

const CHANNEL_CONFIG = {
    whatsapp: { icon: MessageCircle, color: 'bg-green-500', label: 'WhatsApp' },
    email: { icon: Mail, color: 'bg-blue-500', label: 'E-mail' },
    sms: { icon: MessageCircle, color: 'bg-amber-500', label: 'SMS' },
}

function fmtTime(dateStr: string) {
    const d = new Date(dateStr)
    const now = new Date()
    const diffMs = now.getTime() - d.getTime()
    const diffDays = Math.floor(diffMs / 86400000)

    const time = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })

    if (diffDays === 0) return time
    if (diffDays === 1) return `Ontem ${time}`
    if (diffDays < 7) return `${d.toLocaleDateString('pt-BR', { weekday: 'short' })} ${time}`
    return `${d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} ${time}`
}

export function MessageHistory({ customerId, dealId }: Props) {
    const params: Record<string, unknown> = { customer_id: customerId, per_page: 50 }
    if (dealId) params.deal_id = dealId

    const { data, isLoading } = useQuery({
        queryKey: ['crm', 'messages', customerId, dealId],
        queryFn: () => crmApi.getMessages(params).then(r => r.data),
    })

    const messages: CrmMessage[] = (data as any)?.data ?? []

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-12">
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
            </div>
        )
    }

    if (messages.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="rounded-full bg-surface-100 p-4 mb-3">
                    <MessageCircle className="h-6 w-6 text-surface-400" />
                </div>
                <p className="text-sm text-surface-500">Nenhuma mensagem</p>
                <p className="text-xs text-surface-400 mt-1">Use o botão acima para enviar a primeira mensagem</p>
            </div>
        )
    }

    // Group messages by date
    const grouped: Record<string, CrmMessage[]> = {}
    for (const msg of messages) {
        const date = new Date(msg.created_at).toLocaleDateString('pt-BR')
        if (!grouped[date]) grouped[date] = []
        grouped[date].push(msg)
    }

    return (
        <div className="space-y-4">
            {Object.entries(grouped).map(([date, msgs]) => (
                <div key={date}>
                    {/* Date separator */}
                    <div className="flex items-center gap-3 mb-3">
                        <div className="h-px flex-1 bg-surface-200" />
                        <span className="text-[10px] font-medium text-surface-400 uppercase tracking-wider">{date}</span>
                        <div className="h-px flex-1 bg-surface-200" />
                    </div>

                    {/* Messages */}
                    <div className="space-y-2">
                        {msgs.map(msg => {
                            const isOutbound = msg.direction === 'outbound'
                            const channelCfg = CHANNEL_CONFIG[msg.channel]
                            const statusCfg = STATUS_ICONS[msg.status]
                            const StatusIcon = statusCfg?.icon ?? Check

                            return (
                                <div
                                    key={msg.id}
                                    className={cn('flex', isOutbound ? 'justify-end' : 'justify-start')}
                                >
                                    <div className={cn(
                                        'max-w-[80%] rounded-2xl px-4 py-2.5 shadow-sm',
                                        isOutbound
                                            ? 'bg-brand-50 border border-brand-100 rounded-br-md'
                                            : 'bg-white border border-default rounded-bl-md'
                                    )}>
                                        {/* Channel + direction */}
                                        <div className="flex items-center gap-1.5 mb-1">
                                            <div className={cn('flex h-4 w-4 items-center justify-center rounded-full', channelCfg.color)}>
                                                <channelCfg.icon className="h-2.5 w-2.5 text-white" />
                                            </div>
                                            <span className="text-[10px] font-medium text-surface-500">
                                                {channelCfg.label} • {isOutbound ? 'Enviada' : 'Recebida'}
                                            </span>
                                            {msg.user?.name && (
                                                <span className="text-[10px] text-surface-400">por {msg.user.name}</span>
                                            )}
                                        </div>

                                        {/* Subject (email) */}
                                        {msg.subject && (
                                            <p className="text-xs font-semibold text-surface-700 mb-1">{msg.subject}</p>
                                        )}

                                        {/* Body */}
                                        <p className="text-sm text-surface-800 whitespace-pre-wrap break-words leading-relaxed">
                                            {msg.body}
                                        </p>

                                        {/* Attachments */}
                                        {msg.attachments && msg.attachments.length > 0 && (
                                            <div className="mt-2 flex flex-wrap gap-1">
                                                {msg.attachments.map((att, i) => (
                                                    <span
                                                        key={i}
                                                        className="inline-flex items-center gap-1 rounded-md bg-surface-100 px-2 py-0.5 text-[10px] font-medium text-surface-600"
                                                    >
                                                        📎 {att.name}
                                                    </span>
                                                ))}
                                            </div>
                                        )}

                                        {/* Footer: time + status */}
                                        <div className="flex items-center justify-end gap-1.5 mt-1.5">
                                            <span className="text-[10px] text-surface-400">{fmtTime(msg.created_at)}</span>
                                            {isOutbound && (
                                                <StatusIcon className={cn('h-3 w-3', statusCfg?.color ?? 'text-surface-400')} />
                                            )}
                                        </div>

                                        {/* Error message */}
                                        {msg.status === MESSAGE_STATUS.FAILED && msg.error_message && (
                                            <div className="mt-1.5 rounded-md bg-red-50 px-2 py-1 text-[10px] text-red-600">
                                                ⚠ {msg.error_message}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                </div>
            ))}
        </div>
    )
}
