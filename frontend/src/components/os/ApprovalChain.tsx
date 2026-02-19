import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ShieldCheck, UserCheck, Clock, CheckCircle2, XCircle, Send, ChevronDown, ChevronUp } from 'lucide-react'
import api from '@/lib/api'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'

interface Approver {
    id: number
    user_id: number
    user_name: string
    role: string
    status: 'pending' | 'approved' | 'rejected'
    comment?: string
    decided_at?: string
    order: number
}

interface ApprovalChain {
    id: number
    work_order_id: number
    status: 'pending' | 'approved' | 'rejected' | 'partially_approved'
    approvers: Approver[]
    created_at: string
}

interface ApprovalChainProps {
    workOrderId: number
    currentUserId: number
}

const statusConfig = {
    pending: { label: 'Pendente', icon: Clock, color: 'text-amber-600 bg-amber-50' },
    approved: { label: 'Aprovado', icon: CheckCircle2, color: 'text-emerald-600 bg-emerald-50' },
    rejected: { label: 'Rejeitado', icon: XCircle, color: 'text-red-600 bg-red-50' },
    partially_approved: { label: 'Parcial', icon: ShieldCheck, color: 'text-sky-600 bg-sky-50' },
}

export default function ApprovalChainView({ workOrderId, currentUserId }: ApprovalChainProps) {
    const qc = useQueryClient()
    const [expanded, setExpanded] = useState(true)
    const [comment, setComment] = useState('')
    const [showCommentFor, setShowCommentFor] = useState<number | null>(null)

    const { data: chainRes } = useQuery({
        queryKey: ['approval-chain', workOrderId],
        queryFn: () => api.get(`/work-orders/${workOrderId}/approvals`),
    })
    const chain: ApprovalChain | null = chainRes?.data?.data ?? null

    const approveMut = useMutation({
        mutationFn: ({ approverId, action }: { approverId: number; action: 'approve' | 'reject' }) =>
            api.post(`/work-orders/${workOrderId}/approvals/${approverId}/${action}`, { comment }),
        onSuccess: (_, { action }) => {
            qc.invalidateQueries({ queryKey: ['approval-chain', workOrderId] })
            qc.invalidateQueries({ queryKey: ['work-order', workOrderId] })
            toast.success(action === 'approve' ? 'Aprovado com sucesso!' : 'Rejeitado')
            setComment('')
            setShowCommentFor(null)
        },
        onError: () => toast.error('Erro ao processar aprovação'),
    })

    const requestMut = useMutation({
        mutationFn: () => api.post(`/work-orders/${workOrderId}/approvals/request`),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['approval-chain', workOrderId] })
            toast.success('Solicitação de aprovação enviada!')
        },
        onError: () => toast.error('Erro ao solicitar aprovação'),
    })

    if (!chain) {
        return (
            <div className="rounded-xl border border-default bg-surface-0 p-4 shadow-card">
                <h3 className="text-sm font-semibold text-surface-900 flex items-center gap-2 mb-3">
                    <ShieldCheck className="h-4 w-4 text-brand-500" />
                    Aprovação
                </h3>
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => requestMut.mutate()}
                    loading={requestMut.isPending}
                    icon={<Send className="h-3.5 w-3.5" />}
                >
                    <span>Solicitar Aprovação</span>
                </Button>
            </div>
        )
    }

    const chainStatus = statusConfig[chain.status] ?? statusConfig.pending
    const ChainIcon = chainStatus.icon

    return (
        <div className="rounded-xl border border-default bg-surface-0 p-4 shadow-card">
            <button
                onClick={() => setExpanded(!expanded)}
                className="w-full flex items-center justify-between"
            >
                <h3 className="text-sm font-semibold text-surface-900 flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4 text-brand-500" />
                    Cadeia de Aprovação
                </h3>
                <div className="flex items-center gap-2">
                    <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold', chainStatus.color)}>
                        <ChainIcon className="h-3 w-3" />
                        {chainStatus.label}
                    </span>
                    {expanded ? <ChevronUp className="h-3 w-3 text-surface-400" /> : <ChevronDown className="h-3 w-3 text-surface-400" />}
                </div>
            </button>

            {expanded && (
                <div className="mt-3 space-y-0">
                    {chain.approvers
                        .sort((a, b) => a.order - b.order)
                        .map((approver, idx) => {
                            const isCurrentUser = approver.user_id === currentUserId
                            const canAct = isCurrentUser && approver.status === 'pending'
                            const st = statusConfig[approver.status] ?? statusConfig.pending
                            const StIcon = st.icon

                            return (
                                <div key={approver.id}>
                                    {/* Connector line */}
                                    {idx > 0 && (
                                        <div className="flex justify-center">
                                            <div className={cn(
                                                'w-0.5 h-4',
                                                approver.status === 'approved' ? 'bg-emerald-300' :
                                                    approver.status === 'rejected' ? 'bg-red-300' : 'bg-surface-200'
                                            )} />
                                        </div>
                                    )}

                                    <div className={cn(
                                        'rounded-lg border px-3 py-2.5 transition-colors',
                                        canAct ? 'border-brand-300 bg-brand-50/50 ring-1 ring-brand-200' : 'border-subtle bg-surface-50'
                                    )}>
                                        <div className="flex items-center gap-2">
                                            <div className={cn('rounded-full p-1', st.color)}>
                                                <StIcon className="h-3 w-3" />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <span className="text-xs font-medium text-surface-800">{approver.user_name}</span>
                                                <span className="text-[10px] text-surface-400 ml-1.5">{approver.role}</span>
                                            </div>
                                            <span className={cn('text-[10px] font-medium', st.color.split(' ')[0])}>
                                                Etapa {approver.order}
                                            </span>
                                        </div>

                                        {approver.comment && (
                                            <p className="mt-1.5 text-[11px] text-surface-500 italic border-l-2 border-surface-200 pl-2 ml-6">
                                                "{approver.comment}"
                                            </p>
                                        )}

                                        {approver.decided_at && (
                                            <p className="text-[9px] text-surface-400 ml-6 mt-0.5">
                                                {new Date(approver.decided_at).toLocaleString('pt-BR', {
                                                    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
                                                })}
                                            </p>
                                        )}

                                        {/* Action buttons for current user */}
                                        {canAct && (
                                            <div className="mt-2 ml-6 space-y-2">
                                                {showCommentFor === approver.id ? (
                                                    <div className="space-y-1.5">
                                                        <textarea
                                                            value={comment}
                                                            onChange={e => setComment(e.target.value)}
                                                            placeholder="Comentário (opcional)..."
                                                            aria-label="Comentário de aprovação"
                                                            className="w-full rounded-lg border border-subtle bg-white px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-brand-500/20 resize-none"
                                                            rows={2}
                                                        />
                                                        <div className="flex gap-1.5">
                                                            <Button
                                                                size="sm"
                                                                onClick={() => approveMut.mutate({ approverId: approver.id, action: 'approve' })}
                                                                loading={approveMut.isPending}
                                                                icon={<CheckCircle2 className="h-3 w-3" />}
                                                            >
                                                                <span>Aprovar</span>
                                                            </Button>
                                                            <Button
                                                                variant="destructive"
                                                                size="sm"
                                                                onClick={() => approveMut.mutate({ approverId: approver.id, action: 'reject' })}
                                                                loading={approveMut.isPending}
                                                                icon={<XCircle className="h-3 w-3" />}
                                                            >
                                                                <span>Rejeitar</span>
                                                            </Button>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <button
                                                        onClick={() => setShowCommentFor(approver.id)}
                                                        className="text-xs font-medium text-brand-600 hover:text-brand-700"
                                                    >
                                                        Responder →
                                                    </button>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )
                        })}
                </div>
            )}
        </div>
    )
}
