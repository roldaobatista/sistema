import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { X, DollarSign, User, Calendar, FileText, Phone, Mail, MessageCircle, CheckCircle2, XCircle, Loader2 } from 'lucide-react'
import { useState } from 'react'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { crmApi, type CrmDeal, type CrmActivity } from '@/lib/crm-api'
import { SendMessageModal } from '@/components/crm/SendMessageModal'
import { MessageHistory } from '@/components/crm/MessageHistory'

const fmtBRL = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

const typeIcons: Record<string, React.ElementType> = {
    ligacao: Phone,
    email: Mail,
    whatsapp: MessageCircle,
    nota: FileText,
    system: FileText,
    reuniao: User,
    visita: User,
    tarefa: CheckCircle2,
}

interface Props {
    dealId: number | null
    open: boolean
    onClose: () => void
}

export function DealDetailDrawer({ dealId, open, onClose }: Props) {
    const queryClient = useQueryClient()
    const [lostReason, setLostReason] = useState('')
    const [showLostForm, setShowLostForm] = useState(false)
    const [sendMessageOpen, setSendMessageOpen] = useState(false)

    const { data: deal, isLoading } = useQuery({
        queryKey: ['crm-deal', dealId],
        queryFn: () => crmApi.getDeal(dealId!).then(r => r.data),
        enabled: !!dealId && open,
    })

    const wonMutation = useMutation({
        mutationFn: (id: number) => crmApi.markDealWon(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['crm'] })
            queryClient.invalidateQueries({ queryKey: ['crm-deal', dealId] })
        },
    })

    const lostMutation = useMutation({
        mutationFn: ({ id, reason }: { id: number; reason: string }) => crmApi.markDealLost(id, reason),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['crm'] })
            queryClient.invalidateQueries({ queryKey: ['crm-deal', dealId] })
            setShowLostForm(false)
            setLostReason('')
        },
    })

    if (!open) return null

    return (
        <>
            {/* Backdrop */}
            <div className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm" onClick={onClose} />

            {/* Drawer */}
            <div className={cn(
                'fixed right-0 top-0 z-50 flex h-full w-full max-w-lg flex-col border-l border-surface-200 bg-white shadow-modal',
                'animate-in slide-in-from-right duration-300'
            )}>
                {/* Header */}
                <div className="flex items-center justify-between border-b border-surface-200 px-5 py-4">
                    <h2 className="text-lg font-semibold text-surface-900 truncate">
                        {isLoading ? 'Carregando…' : deal?.title}
                    </h2>
                    <button
                        onClick={onClose}
                        className="rounded-lg p-1.5 text-surface-400 hover:bg-surface-100 hover:text-surface-600 transition-colors"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                {isLoading ? (
                    <div className="flex flex-1 items-center justify-center">
                        <Loader2 className="h-8 w-8 animate-spin text-brand-500" />
                    </div>
                ) : deal ? (
                    <div className="flex-1 overflow-y-auto">
                        {/* Status + Actions */}
                        <div className="border-b border-surface-200 px-5 py-4">
                            <div className="flex items-center gap-2 mb-4">
                                <Badge variant={deal.status === 'won' ? 'success' : deal.status === 'lost' ? 'danger' : 'info'} dot>
                                    {deal.status === 'won' ? 'Ganho' : deal.status === 'lost' ? 'Perdido' : 'Aberto'}
                                </Badge>
                                {deal.stage && (
                                    <span className="rounded-full px-2.5 py-0.5 text-xs font-medium"
                                        style={{ backgroundColor: `${deal.stage.color}20`, color: deal.stage.color || undefined }}>
                                        {deal.stage.name}
                                    </span>
                                )}
                            </div>

                            {deal.status === 'open' && (
                                <div className="flex gap-2">
                                    <Button
                                        size="sm"
                                        variant="primary"
                                        onClick={() => wonMutation.mutate(deal.id)}
                                        disabled={wonMutation.isPending}
                                    >
                                        <CheckCircle2 className="h-4 w-4 mr-1" />
                                        Marcar Ganho
                                    </Button>
                                    <Button
                                        size="sm"
                                        variant="ghost"
                                        className="text-red-600 hover:bg-red-50"
                                        onClick={() => setShowLostForm(!showLostForm)}
                                    >
                                        <XCircle className="h-4 w-4 mr-1" />
                                        Marcar Perdido
                                    </Button>
                                </div>
                            )}

                            {deal.status === 'open' && deal.customer && (
                                <div className="mt-2">
                                    <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={() => setSendMessageOpen(true)}
                                    >
                                        <MessageCircle className="h-4 w-4 mr-1" />
                                        Enviar Mensagem
                                    </Button>
                                </div>
                            )}

                            {showLostForm && (
                                <div className="mt-3 space-y-2">
                                    <textarea
                                        value={lostReason}
                                        onChange={e => setLostReason(e.target.value)}
                                        placeholder="Motivo da perda (opcional)"
                                        className="w-full rounded-lg border border-surface-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30"
                                        rows={2}
                                    />
                                    <Button
                                        size="sm"
                                        variant="danger"
                                        onClick={() => lostMutation.mutate({ id: deal.id, reason: lostReason })}
                                        disabled={lostMutation.isPending}
                                    >
                                        Confirmar Perda
                                    </Button>
                                </div>
                            )}
                        </div>

                        {/* Info Grid */}
                        <div className="border-b border-surface-200 px-5 py-4 space-y-3">
                            <InfoRow icon={DollarSign} label="Valor" value={fmtBRL(deal.value)} />
                            <InfoRow icon={User} label="Cliente" value={deal.customer?.name ?? '—'} />
                            <InfoRow icon={User} label="Responsável" value={deal.assignee?.name ?? 'Não atribuído'} />
                            <InfoRow icon={Calendar} label="Previsão" value={
                                deal.expected_close_date
                                    ? new Date(deal.expected_close_date).toLocaleDateString('pt-BR')
                                    : 'Não definida'
                            } />
                            {deal.source && <InfoRow icon={FileText} label="Origem" value={deal.source} />}
                            {deal.quote && (
                                <InfoRow icon={FileText} label="Orçamento" value={`#${deal.quote.quote_number} — ${fmtBRL(deal.quote.total)}`} />
                            )}
                            {deal.workOrder && (
                                <InfoRow icon={FileText} label="OS" value={`#${deal.workOrder.number} — ${deal.workOrder.status}`} />
                            )}
                            {deal.equipment && (
                                <InfoRow icon={FileText} label="Equipamento" value={`${deal.equipment.code} — ${deal.equipment.brand} ${deal.equipment.model}`} />
                            )}
                        </div>

                        {/* Notes */}
                        {deal.notes && (
                            <div className="border-b border-surface-200 px-5 py-4">
                                <p className="text-xs font-medium text-surface-500 mb-1">Observações</p>
                                <p className="text-sm text-surface-700 whitespace-pre-wrap">{deal.notes}</p>
                            </div>
                        )}

                        {/* Messages */}
                        {deal.customer && (
                            <div className="border-b border-surface-200 px-5 py-4">
                                <div className="flex items-center justify-between mb-3">
                                    <h3 className="text-xs font-semibold text-surface-500 uppercase tracking-wider">Mensagens</h3>
                                    <button
                                        onClick={() => setSendMessageOpen(true)}
                                        className="text-xs font-medium text-brand-600 hover:text-brand-700"
                                    >
                                        + Nova
                                    </button>
                                </div>
                                <MessageHistory customerId={deal.customer.id} dealId={deal.id} />
                            </div>
                        )}

                        {/* Timeline */}
                        <div className="px-5 py-4">
                            <h3 className="text-xs font-semibold text-surface-500 uppercase tracking-wider mb-3">Atividades</h3>
                            <div className="space-y-3">
                                {(deal.activities ?? []).length === 0 ? (
                                    <p className="text-sm text-surface-400 text-center py-4">Nenhuma atividade registrada</p>
                                ) : (
                                    (deal.activities ?? []).map((act: CrmActivity) => {
                                        const Icon = typeIcons[act.type] ?? FileText
                                        return (
                                            <div key={act.id} className="flex gap-3">
                                                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface-100 text-surface-500">
                                                    <Icon className="h-4 w-4" />
                                                </div>
                                                <div className="min-w-0 flex-1">
                                                    <p className="text-sm font-medium text-surface-800">{act.title}</p>
                                                    <div className="flex items-center gap-2 text-xs text-surface-400 mt-0.5">
                                                        {act.user?.name && <span>{act.user.name}</span>}
                                                        <span>•</span>
                                                        <span>{new Date(act.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
                                                    </div>
                                                    {act.description && (
                                                        <p className="text-xs text-surface-500 mt-1">{act.description}</p>
                                                    )}
                                                </div>
                                            </div>
                                        )
                                    })
                                )}
                            </div>
                        </div>
                    </div>
                ) : null}
            </div>

            {/* Send Message Modal */}
            {deal?.customer && (
                <SendMessageModal
                    open={sendMessageOpen}
                    onClose={() => setSendMessageOpen(false)}
                    customerId={deal.customer.id}
                    customerName={deal.customer.name}
                    customerPhone={deal.customer.phone}
                    customerEmail={deal.customer.email}
                    dealId={deal.id}
                />
            )}
        </>
    )
}

function InfoRow({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
    return (
        <div className="flex items-center gap-3">
            <Icon className="h-4 w-4 text-surface-400" />
            <div className="flex items-baseline gap-2">
                <span className="text-xs text-surface-500 w-24 shrink-0">{label}</span>
                <span className="text-sm font-medium text-surface-800">{value}</span>
            </div>
        </div>
    )
}
