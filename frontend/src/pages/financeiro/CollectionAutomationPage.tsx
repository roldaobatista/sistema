import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'
import { PageHeader } from '@/components/ui/pageheader'
import { EmptyState } from '@/components/ui/emptystate'
import { toast } from 'sonner'
import { Zap, Play, MessageSquare, Mail, Phone, AlertTriangle, CheckCircle2, Clock } from 'lucide-react'

interface CollectionAction {
    id: number
    account_receivable_id: number
    action_type: string
    channel: string
    status: string
    executed_at: string | null
    notes: string | null
    customer_name?: string
    receivable_description?: string
    amount?: number
}

interface CollectionSummary {
    total_overdue: number
    total_overdue_amount: number
    actions_today: number
    actions_pending: number
}

const channelIcons: Record<string, React.ElementType> = {
    whatsapp: Phone,
    email: Mail,
    sms: MessageSquare,
}

export default function CollectionAutomationPage() {
    const queryClient = useQueryClient()

    const { data: summary } = useQuery<CollectionSummary>({
        queryKey: ['collection-summary'],
        queryFn: () => api.get('/collection/summary').then(r => r.data.data ?? r.data),
    })

    const { data: actions, isLoading } = useQuery<CollectionAction[]>({
        queryKey: ['collection-actions'],
        queryFn: () => api.get('/collection/actions').then(r => r.data.data ?? r.data),
    })

    const runMutation = useMutation({
        mutationFn: () => api.post('/collection/run'),
        onSuccess: (res) => {
            const processed = res.data?.processed ?? 0
            toast.success(`Motor de cobrança executado. ${processed} ação(ões) processadas.`)
            queryClient.invalidateQueries({ queryKey: ['collection-actions'] })
            queryClient.invalidateQueries({ queryKey: ['collection-summary'] })
        },
        onError: () => toast.error('Erro ao executar motor de cobrança'),
    })

    const actionsList = actions ?? []
    const summaryData = summary ?? { total_overdue: 0, total_overdue_amount: 0, actions_today: 0, actions_pending: 0 }

    return (
        <div className="space-y-6">
            <PageHeader
                title="Automação de Cobrança"
                subtitle="Envio automático de lembretes e cobranças para contas vencidas"
                action={
                    <button
                        onClick={() => runMutation.mutate()}
                        disabled={runMutation.isPending}
                        className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                    >
                        {runMutation.isPending ? (
                            <Clock className="h-4 w-4 animate-spin" />
                        ) : (
                            <Play className="h-4 w-4" />
                        )}
                        {runMutation.isPending ? 'Executando...' : 'Executar Agora'}
                    </button>
                }
            />

            {/* Resumo */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
                <div className="rounded-xl border bg-card p-4">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <AlertTriangle className="h-4 w-4 text-red-500" /> Títulos Vencidos
                    </div>
                    <div className="mt-1 text-2xl font-bold text-red-600">{summaryData.total_overdue}</div>
                </div>
                <div className="rounded-xl border bg-card p-4">
                    <div className="text-sm text-muted-foreground">Valor Total Vencido</div>
                    <div className="mt-1 text-2xl font-bold">
                        R$ {summaryData.total_overdue_amount.toFixed(2).replace('.', ',')}
                    </div>
                </div>
                <div className="rounded-xl border bg-card p-4">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Zap className="h-4 w-4 text-amber-500" /> Ações Hoje
                    </div>
                    <div className="mt-1 text-2xl font-bold text-amber-600">{summaryData.actions_today}</div>
                </div>
                <div className="rounded-xl border bg-card p-4">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Clock className="h-4 w-4 text-blue-500" /> Pendentes
                    </div>
                    <div className="mt-1 text-2xl font-bold text-blue-600">{summaryData.actions_pending}</div>
                </div>
            </div>

            {/* Informação da automação */}
            <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 dark:border-blue-800">
                <div className="flex items-center gap-2 text-sm font-medium text-blue-700 dark:text-blue-400">
                    <Zap className="h-4 w-4" /> Automação Ativa
                </div>
                <p className="mt-1 text-xs text-blue-600 dark:text-blue-300">
                    O motor de cobrança roda automaticamente todos os dias às 09:00.
                    As regras configuradas determinam quando e como cada ação é disparada (WhatsApp, e-mail, SMS).
                </p>
            </div>

            {/* Tabela de ações */}
            {isLoading ? (
                <div className="flex justify-center py-12 text-muted-foreground">Carregando...</div>
            ) : actionsList.length === 0 ? (
                <EmptyState
                    icon={Zap}
                    title="Nenhuma ação registrada"
                    description="Nenhuma ação de cobrança foi executada ainda."
                />
            ) : (
                <div className="overflow-x-auto rounded-xl border bg-card">
                    <table className="w-full text-sm">
                        <thead className="border-b bg-muted/50">
                            <tr>
                                <th className="p-3 text-left font-medium">Cliente</th>
                                <th className="p-3 text-left font-medium">Descrição</th>
                                <th className="p-3 text-right font-medium">Valor</th>
                                <th className="p-3 text-center font-medium">Canal</th>
                                <th className="p-3 text-center font-medium">Tipo</th>
                                <th className="p-3 text-center font-medium">Status</th>
                                <th className="p-3 text-left font-medium">Data</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y">
                            {actionsList.map(action => {
                                const ChannelIcon = channelIcons[action.channel] ?? MessageSquare
                                return (
                                    <tr key={action.id}>
                                        <td className="p-3 font-medium">{action.customer_name ?? `#${action.account_receivable_id}`}</td>
                                        <td className="p-3 text-xs text-muted-foreground">{action.receivable_description ?? '—'}</td>
                                        <td className="p-3 text-right text-xs">
                                            {action.amount ? `R$ ${Number(action.amount).toFixed(2).replace('.', ',')}` : '—'}
                                        </td>
                                        <td className="p-3 text-center">
                                            <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs">
                                                <ChannelIcon className="h-3 w-3" /> {action.channel}
                                            </span>
                                        </td>
                                        <td className="p-3 text-center text-xs">{action.action_type}</td>
                                        <td className="p-3 text-center">
                                            <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
                                                action.status === 'sent'
                                                    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30'
                                                    : action.status === 'failed'
                                                    ? 'bg-red-100 text-red-700 dark:bg-red-900/30'
                                                    : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30'
                                            }`}>
                                                {action.status === 'sent' ? <CheckCircle2 className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
                                                {action.status === 'sent' ? 'Enviado' : action.status === 'failed' ? 'Falhou' : 'Pendente'}
                                            </span>
                                        </td>
                                        <td className="p-3 text-xs text-muted-foreground">
                                            {action.executed_at ? new Date(action.executed_at).toLocaleString('pt-BR') : '—'}
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
