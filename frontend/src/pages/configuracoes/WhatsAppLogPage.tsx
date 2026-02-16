import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'
import { PageHeader } from '@/components/ui/pageheader'
import { EmptyState } from '@/components/ui/emptystate'
import { MessageSquare, CheckCircle2, XCircle, Clock, Phone, Search } from 'lucide-react'

interface WhatsAppLog {
    id: number
    phone: string
    message_type: string
    direction: string
    content: string | null
    template_name: string | null
    status: string
    error_message: string | null
    sent_at: string | null
    created_at: string
}

const statusConfig: Record<string, { label: string; icon: React.ElementType; color: string }> = {
    sent: { label: 'Enviado', icon: CheckCircle2, color: 'text-emerald-600 bg-emerald-100 dark:bg-emerald-900/30 dark:text-emerald-400' },
    delivered: { label: 'Entregue', icon: CheckCircle2, color: 'text-blue-600 bg-blue-100 dark:bg-blue-900/30 dark:text-blue-400' },
    read: { label: 'Lido', icon: CheckCircle2, color: 'text-indigo-600 bg-indigo-100 dark:bg-indigo-900/30 dark:text-indigo-400' },
    failed: { label: 'Falhou', icon: XCircle, color: 'text-red-600 bg-red-100 dark:bg-red-900/30 dark:text-red-400' },
    pending: { label: 'Pendente', icon: Clock, color: 'text-amber-600 bg-amber-100 dark:bg-amber-900/30 dark:text-amber-400' },
}

export default function WhatsAppLogPage() {
    const [search, setSearch] = useState('')
    const [statusFilter, setStatusFilter] = useState('')

    const { data, isLoading } = useQuery<WhatsAppLog[]>({
        queryKey: ['whatsapp-logs', search, statusFilter],
        queryFn: () => api.get('/api/v1/whatsapp/logs', {
            params: { search, status: statusFilter || undefined },
        }).then(r => r.data.data ?? r.data),
    })

    const logs = data ?? []

    return (
        <div className="space-y-6">
            <PageHeader
                title="Log de Mensagens WhatsApp"
                subtitle="Histórico de mensagens enviadas e recebidas via WhatsApp"
            />

            {/* Filtros */}
            <div className="flex flex-wrap items-center gap-3">
                <div className="relative flex-1 min-w-[200px]">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <input
                        type="text"
                        placeholder="Buscar por telefone ou conteúdo..."
                        className="w-full rounded-lg border bg-background pl-9 pr-3 py-2 text-sm"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                    />
                </div>
                <select
                    className="rounded-lg border bg-background px-3 py-2 text-sm"
                    value={statusFilter}
                    onChange={e => setStatusFilter(e.target.value)}
                >
                    <option value="">Todos os Status</option>
                    <option value="sent">Enviado</option>
                    <option value="delivered">Entregue</option>
                    <option value="read">Lido</option>
                    <option value="failed">Falhou</option>
                    <option value="pending">Pendente</option>
                </select>
            </div>

            {/* Resumo */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
                {Object.entries(statusConfig).map(([key, cfg]) => {
                    const count = logs.filter(l => l.status === key).length
                    const Icon = cfg.icon
                    return (
                        <div key={key} className="rounded-xl border bg-card p-3 text-center">
                            <Icon className={`mx-auto h-5 w-5 ${cfg.color.split(' ')[0]}`} />
                            <div className="mt-1 text-lg font-bold">{count}</div>
                            <div className="text-xs text-muted-foreground">{cfg.label}</div>
                        </div>
                    )
                })}
            </div>

            {/* Tabela */}
            {isLoading ? (
                <div className="flex justify-center py-12 text-muted-foreground">Carregando...</div>
            ) : logs.length === 0 ? (
                <EmptyState
                    icon={MessageSquare}
                    title="Nenhuma mensagem"
                    description="Nenhuma mensagem WhatsApp foi registrada."
                />
            ) : (
                <div className="overflow-x-auto rounded-xl border bg-card">
                    <table className="w-full text-sm">
                        <thead className="border-b bg-muted/50">
                            <tr>
                                <th className="p-3 text-left font-medium">Telefone</th>
                                <th className="p-3 text-left font-medium">Tipo</th>
                                <th className="p-3 text-left font-medium">Direção</th>
                                <th className="p-3 text-left font-medium">Conteúdo</th>
                                <th className="p-3 text-center font-medium">Status</th>
                                <th className="p-3 text-left font-medium">Data</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y">
                            {logs.map(log => {
                                const sc = statusConfig[log.status] ?? statusConfig.pending
                                const Icon = sc.icon
                                return (
                                    <tr key={log.id}>
                                        <td className="p-3">
                                            <span className="flex items-center gap-1.5">
                                                <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                                                {log.phone}
                                            </span>
                                        </td>
                                        <td className="p-3 text-xs">
                                            <span className="rounded-full bg-muted px-2 py-0.5">
                                                {log.message_type}
                                            </span>
                                        </td>
                                        <td className="p-3 text-xs">
                                            <span className={`rounded-full px-2 py-0.5 ${
                                                log.direction === 'outgoing'
                                                    ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                                                    : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                                            }`}>
                                                {log.direction === 'outgoing' ? 'Enviada' : 'Recebida'}
                                            </span>
                                        </td>
                                        <td className="p-3 text-xs max-w-[300px] truncate">
                                            {log.template_name ? (
                                                <span className="text-muted-foreground italic">Template: {log.template_name}</span>
                                            ) : (
                                                log.content ?? '—'
                                            )}
                                        </td>
                                        <td className="p-3 text-center">
                                            <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${sc.color}`}>
                                                <Icon className="h-3 w-3" /> {sc.label}
                                            </span>
                                            {log.error_message && (
                                                <div className="mt-1 text-xs text-red-500 max-w-[200px] truncate" title={log.error_message}>
                                                    {log.error_message}
                                                </div>
                                            )}
                                        </td>
                                        <td className="p-3 text-xs text-muted-foreground">
                                            {new Date(log.created_at).toLocaleString('pt-BR')}
                                        </td>
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    )
}
