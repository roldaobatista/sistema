import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '@/stores/auth-store'
import { toast } from 'sonner'
import api from '@/lib/api'
import { crmFeaturesApi } from '@/lib/crm-features-api'
import { QUOTE_STATUS } from '@/lib/constants'
import { QUOTE_STATUS_CONFIG } from '@/features/quotes/constants'
import type { Quote } from '@/types/quote'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import {
    ArrowLeft, Pencil, Send, CheckCircle, XCircle, Copy,
    ArrowRightLeft, FileDown, Trash2, RefreshCw, Link as LinkIcon, Clock, History, Phone, FileText
} from 'lucide-react'

const formatCurrency = (v: number | string) => {
    const n = typeof v === 'string' ? parseFloat(v) : v
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(n || 0)
}

export function QuoteDetailPage() {
    const { id } = useParams<{ id: string }>()
    const navigate = useNavigate()
    const qc = useQueryClient()
    const { hasPermission } = useAuthStore()

    const [rejectOpen, setRejectOpen] = useState(false)
    const [rejectReason, setRejectReason] = useState('')
    const [deleteOpen, setDeleteOpen] = useState(false)
    const [proposalOpen, setProposalOpen] = useState(false)
    const [proposalExpires, setProposalExpires] = useState('')

    const canUpdate = hasPermission('quotes.quote.update')
    const canDelete = hasPermission('quotes.quote.delete')
    const canSend = hasPermission('quotes.quote.send')
    const canApprove = hasPermission('quotes.quote.approve')
    const canInternalApprove = hasPermission('quotes.quote.internal_approve')
    const canCreate = hasPermission('quotes.quote.create')
    const canConvert = hasPermission('quotes.quote.convert')
    const canProposalView = hasPermission('crm.proposal.view')
    const canProposalManage = hasPermission('crm.proposal.manage')

    const { data: quote, isLoading } = useQuery<Quote>({
        queryKey: ['quote', id],
        queryFn: () => api.get(`/quotes/${id}`).then(r => r.data),
        enabled: !!id,
    })

    const { data: timelineData } = useQuery<{ id: number; action: string; description: string; user_id?: number; created_at: string }[]>({
        queryKey: ['quote-timeline', id],
        queryFn: () => api.get(`/quotes/${id}/timeline`).then(r => r.data),
        enabled: !!id,
    })
    const timeline = Array.isArray(timelineData) ? timelineData : []

    const { data: proposalsRes } = useQuery({
        queryKey: ['crm-proposals-by-quote', id],
        queryFn: () => crmFeaturesApi.getProposals({ quote_id: Number(id), per_page: 1 }),
        enabled: !!id && !!canProposalView,
    })
    const proposalList = proposalsRes?.data?.data ?? (Array.isArray(proposalsRes?.data) ? proposalsRes.data : [])
    const hasProposal = Array.isArray(proposalList) && proposalList.length > 0

    const createProposalMut = useMutation({
        mutationFn: (data: { quote_id: number; expires_at?: string }) => crmFeaturesApi.createProposal(data),
        onSuccess: () => {
            toast.success('Proposta interativa criada!')
            qc.invalidateQueries({ queryKey: ['crm-proposals-by-quote', id] })
            qc.invalidateQueries({ queryKey: ['crm-proposals'] })
            setProposalOpen(false)
            setProposalExpires('')
        },
        onError: (err: any) => toast.error(err?.response?.data?.message || 'Erro ao criar proposta'),
    })

    const invalidateAll = () => {
        qc.invalidateQueries({ queryKey: ['quote', id] })
        qc.invalidateQueries({ queryKey: ['quotes'] })
        qc.invalidateQueries({ queryKey: ['quotes-summary'] })
    }

    const requestInternalApprovalMut = useMutation({
        mutationFn: () => api.post(`/quotes/${id}/request-internal-approval`),
        onSuccess: () => { toast.success('Solicitação de aprovação interna enviada!'); invalidateAll() },
        onError: (err: any) => toast.error(err?.response?.data?.message || 'Erro ao solicitar aprovação'),
    })

    const internalApproveMut = useMutation({
        mutationFn: () => api.post(`/quotes/${id}/internal-approve`),
        onSuccess: () => { toast.success('Orçamento aprovado internamente!'); invalidateAll() },
        onError: (err: any) => toast.error(err?.response?.data?.message || 'Erro ao aprovar internamente'),
    })

    const sendMut = useMutation({
        mutationFn: () => api.post(`/quotes/${id}/send`),
        onSuccess: () => { toast.success('Orçamento enviado!'); invalidateAll() },
        onError: (err: any) => toast.error(err?.response?.data?.message || 'Erro ao enviar'),
    })

    const approveMut = useMutation({
        mutationFn: () => api.post(`/quotes/${id}/approve`),
        onSuccess: () => { toast.success('Orçamento aprovado!'); invalidateAll() },
        onError: (err: any) => toast.error(err?.response?.data?.message || 'Erro ao aprovar'),
    })

    const rejectMut = useMutation({
        mutationFn: () => api.post(`/quotes/${id}/reject`, { reason: rejectReason }),
        onSuccess: () => { toast.success('Orçamento rejeitado'); setRejectOpen(false); setRejectReason(''); invalidateAll() },
        onError: (err: any) => toast.error(err?.response?.data?.message || 'Erro ao rejeitar'),
    })

    const convertMut = useMutation({
        mutationFn: () => api.post(`/quotes/${id}/convert-to-os`),
        onSuccess: (res: any) => {
            toast.success('OS criada a partir do orçamento!')
            invalidateAll()
            const woId = res?.data?.id ?? res?.data?.data?.id
            if (woId) navigate(`/os/${woId}`)
        },
        onError: (err: any) => toast.error(err?.response?.data?.message || 'Erro ao converter'),
    })

    const convertToChamadoMut = useMutation({
        mutationFn: () => api.post(`/quotes/${id}/convert-to-chamado`),
        onSuccess: (res: any) => {
            toast.success('Chamado criado a partir do orçamento!')
            invalidateAll()
            const callId = res?.data?.id ?? res?.data?.data?.id
            if (callId) navigate(`/chamados/${callId}`)
        },
        onError: (err: any) => toast.error(err?.response?.data?.message || 'Erro ao converter em chamado'),
    })

    const duplicateMut = useMutation({
        mutationFn: () => api.post(`/quotes/${id}/duplicate`),
        onSuccess: (res: any) => { toast.success('Orçamento duplicado!'); navigate(`/orcamentos/${res.data.id}`) },
        onError: (err: any) => toast.error(err?.response?.data?.message || 'Erro ao duplicar'),
    })

    const deleteMut = useMutation({
        mutationFn: () => api.delete(`/quotes/${id}`),
        onSuccess: () => { toast.success('Orçamento excluído!'); navigate('/orcamentos') },
        onError: (err: any) => { toast.error(err?.response?.data?.message || 'Erro ao excluir'); setDeleteOpen(false) },
    })

    const reopenMut = useMutation({
        mutationFn: () => api.post(`/quotes/${id}/reopen`),
        onSuccess: () => { toast.success('Orçamento reaberto!'); invalidateAll() },
        onError: (err: any) => toast.error(err?.response?.data?.message || 'Erro ao reabrir'),
    })

    const handleDownloadPdf = async () => {
        try {
            const res = await api.get(`/quotes/${id}/pdf`, { responseType: 'blob' })
            const url = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }))
            const a = document.createElement('a')
            a.href = url; a.download = `orçamento_${quote?.quote_number ?? id}.pdf`; a.click()
            URL.revokeObjectURL(url)
            toast.success('PDF baixado!')
        } catch {
            toast.error('Erro ao gerar PDF')
        }
    }

    const handleCopyApprovalLink = () => {
        if (!quote?.approval_url) {
            toast.error('Link de aprovação não disponível')
            return
        }
        navigator.clipboard.writeText(quote.approval_url)
        toast.success('Link copiado para a área de transferência!')
    }

    if (isLoading) {
        return (
            <div className="space-y-6">
                <div className="h-8 w-48 bg-surface-100 rounded animate-pulse" />
                <div className="grid gap-6 md:grid-cols-3">
                    {[1, 2, 3].map(i => <div key={i} className="h-40 bg-surface-100 rounded-xl animate-pulse" />)}
                </div>
            </div>
        )
    }

    if (!quote) {
        return (
            <div className="text-center py-20">
                <p className="text-content-secondary">Orçamento não encontrado</p>
                <Button variant="outline" className="mt-4" onClick={() => navigate('/orcamentos')}>Voltar</Button>
            </div>
        )
    }

    const cfg = QUOTE_STATUS_CONFIG[quote.status] ?? { label: quote.status, variant: 'default' }
    const isDraft = quote.status === QUOTE_STATUS.DRAFT
    const isPendingInternal = quote.status === QUOTE_STATUS.PENDING_INTERNAL
    const isInternallyApproved = quote.status === QUOTE_STATUS.INTERNALLY_APPROVED
    const isSent = quote.status === QUOTE_STATUS.SENT
    const isApproved = quote.status === QUOTE_STATUS.APPROVED
    const isRejected = quote.status === QUOTE_STATUS.REJECTED
    const isExpired = quote.status === QUOTE_STATUS.EXPIRED
    const isMutable = isDraft || isPendingInternal || isRejected

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between flex-wrap gap-4">
                <div className="flex items-center gap-3">
                    <Button variant="ghost" size="icon" onClick={() => navigate('/orcamentos')}>
                        <ArrowLeft className="h-5 w-5" />
                    </Button>
                    <div>
                        <h1 className="text-2xl font-bold text-content-primary">
                            Orçamento {quote.quote_number}
                            {quote.revision > 1 && <span className="text-base text-content-tertiary ml-2">rev.{quote.revision}</span>}
                        </h1>
                        <Badge variant={cfg.variant} className="mt-1">{cfg.label}</Badge>
                    </div>
                </div>
                <div className="flex gap-2 flex-wrap">
                    {canUpdate && isMutable && (
                        <Button variant="outline" size="sm" icon={<Pencil className="h-4 w-4" />} onClick={() => navigate(`/orcamentos/${id}/editar`)}>Editar</Button>
                    )}
                    {canSend && isDraft && (
                        <Button size="sm" variant="outline" icon={<Send className="h-4 w-4" />} onClick={() => requestInternalApprovalMut.mutate()} disabled={requestInternalApprovalMut.isPending}>
                            {requestInternalApprovalMut.isPending ? 'Solicitando...' : 'Solicitar Aprovação Interna'}
                        </Button>
                    )}
                    {(canInternalApprove && (isDraft || isPendingInternal)) && (
                        <Button size="sm" variant="outline" icon={<CheckCircle className="h-4 w-4" />} onClick={() => internalApproveMut.mutate()} disabled={internalApproveMut.isPending}>
                            {internalApproveMut.isPending ? 'Aprovando...' : 'Aprovar internamente'}
                        </Button>
                    )}
                    {canSend && isInternallyApproved && (
                        <Button size="sm" icon={<Send className="h-4 w-4" />} onClick={() => sendMut.mutate()} disabled={sendMut.isPending}>
                            {sendMut.isPending ? 'Enviando...' : 'Enviar ao Cliente'}
                        </Button>
                    )}
                    {canApprove && isSent && (
                        <>
                            <Button size="sm" variant="success" icon={<CheckCircle className="h-4 w-4" />} onClick={() => approveMut.mutate()} disabled={approveMut.isPending}>
                                Aprovar
                            </Button>
                            <Button size="sm" variant="danger" icon={<XCircle className="h-4 w-4" />} onClick={() => setRejectOpen(true)}>
                                Rejeitar
                            </Button>
                        </>
                    )}
                    {canConvert && isApproved && (
                        <>
                            <Button size="sm" icon={<ArrowRightLeft className="h-4 w-4" />} onClick={() => convertMut.mutate()} disabled={convertMut.isPending}>
                                {convertMut.isPending ? 'Convertendo...' : 'Converter em OS'}
                            </Button>
                            <Button size="sm" variant="outline" icon={<Phone className="h-4 w-4" />} onClick={() => convertToChamadoMut.mutate()} disabled={convertToChamadoMut.isPending}>
                                {convertToChamadoMut.isPending ? 'Convertendo...' : 'Converter em Chamado'}
                            </Button>
                        </>
                    )}
                    {canUpdate && (isRejected || isExpired) && (
                        <Button size="sm" variant="outline" icon={<RefreshCw className="h-4 w-4" />} onClick={() => reopenMut.mutate()} disabled={reopenMut.isPending}>
                            Reabrir
                        </Button>
                    )}
                    <Button variant="outline" size="sm" icon={<FileDown className="h-4 w-4" />} onClick={handleDownloadPdf}>PDF</Button>
                    {isSent && quote.approval_url && (
                        <Button variant="outline" size="sm" icon={<LinkIcon className="h-4 w-4" />} onClick={handleCopyApprovalLink}>
                            Copiar Link
                        </Button>
                    )}
                    {canProposalView && hasProposal && (
                        <Badge variant="outline" className="text-xs">Proposta interativa enviada</Badge>
                    )}
                    {canProposalManage && !hasProposal && (
                        <Button variant="outline" size="sm" icon={<FileText className="h-4 w-4" />} onClick={() => setProposalOpen(true)}>
                            Criar proposta interativa
                        </Button>
                    )}
                    {canCreate && (
                        <Button variant="outline" size="sm" icon={<Copy className="h-4 w-4" />} onClick={() => duplicateMut.mutate()} disabled={duplicateMut.isPending}>
                            Duplicar
                        </Button>
                    )}
                    {canDelete && isMutable && (
                        <Button variant="danger" size="sm" icon={<Trash2 className="h-4 w-4" />} onClick={() => setDeleteOpen(true)}>
                            Excluir
                        </Button>
                    )}
                </div>
            </div>

            {isRejected && quote.rejection_reason && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                    <p className="text-sm font-medium text-red-800">Motivo da rejeição:</p>
                    <p className="text-sm text-red-700 mt-1">{quote.rejection_reason}</p>
                </div>
            )}

            <div className="grid gap-6 md:grid-cols-3">
                <Card className="p-5">
                    <h3 className="text-sm font-semibold text-content-secondary mb-3">Cliente</h3>
                    <p className="font-medium text-content-primary">{quote.customer?.name ?? '—'}</p>
                    {quote.customer?.document && <p className="text-sm text-content-secondary mt-1">{quote.customer.document}</p>}
                    {quote.customer?.email && <p className="text-sm text-content-secondary">{quote.customer.email}</p>}
                    {quote.customer?.phone && <p className="text-sm text-content-secondary">{quote.customer.phone}</p>}
                </Card>

                <Card className="p-5">
                    <h3 className="text-sm font-semibold text-content-secondary mb-3">Resumo Financeiro</h3>
                    <div className="space-y-2">
                        <div className="flex justify-between"><span className="text-sm text-content-secondary">Subtotal</span><span className="font-medium">{formatCurrency(quote.subtotal)}</span></div>
                        {(parseFloat(String(quote.discount_amount)) > 0 || parseFloat(String(quote.discount_percentage)) > 0) && (
                            <div className="flex justify-between text-red-600">
                                <span className="text-sm">Desconto {parseFloat(String(quote.discount_percentage)) > 0 ? `(${quote.discount_percentage}%)` : ''}</span>
                                <span className="font-medium">- {formatCurrency(quote.discount_amount)}</span>
                            </div>
                        )}
                        {parseFloat(String(quote.displacement_value)) > 0 && (
                            <div className="flex justify-between text-content-secondary">
                                <span className="text-sm">Deslocamento</span>
                                <span className="font-medium">+ {formatCurrency(quote.displacement_value)}</span>
                            </div>
                        )}
                        <div className="flex justify-between border-t border-default pt-2">
                            <span className="font-semibold">Total</span>
                            <span className="text-xl font-bold text-brand-600">{formatCurrency(quote.total)}</span>
                        </div>
                    </div>
                </Card>

                <Card className="p-5">
                    <h3 className="text-sm font-semibold text-content-secondary mb-3">Informações</h3>
                    <div className="space-y-2 text-sm">
                        <div className="flex justify-between"><span className="text-content-secondary">Vendedor</span><span>{quote.seller?.name ?? '—'}</span></div>
                        {quote.source && <div className="flex justify-between"><span className="text-content-secondary">Origem</span><span className="capitalize">{quote.source.replace('_', ' ')}</span></div>}
                        <div className="flex justify-between"><span className="text-content-secondary">Validade</span><span>{quote.valid_until ? new Date(quote.valid_until).toLocaleDateString('pt-BR') : '—'}</span></div>
                        <div className="flex justify-between"><span className="text-content-secondary">Criado em</span><span>{quote.created_at ? new Date(quote.created_at).toLocaleDateString('pt-BR') : '—'}</span></div>
                        {quote.internal_approved_at && (
                            <div className="flex justify-between"><span className="text-content-secondary">Aprovação interna</span><span>{new Date(quote.internal_approved_at).toLocaleDateString('pt-BR')}</span></div>
                        )}
                        {quote.sent_at && <div className="flex justify-between"><span className="text-content-secondary">Enviado em</span><span>{new Date(quote.sent_at).toLocaleDateString('pt-BR')}</span></div>}
                        {quote.approved_at && <div className="flex justify-between"><span className="text-content-secondary">Aprovado em</span><span>{new Date(quote.approved_at).toLocaleDateString('pt-BR')}</span></div>}
                    </div>
                </Card>
            </div>

            {quote.equipments && quote.equipments.length > 0 && (
                <Card className="p-5">
                    <h3 className="text-sm font-semibold text-content-secondary mb-4">Equipamentos e Itens</h3>
                    <div className="space-y-6">
                        {quote.equipments.map((eq) => (
                            <div key={eq.id} className="border border-default rounded-lg p-4">
                                <div className="flex items-center gap-2 mb-3">
                                    <span className="font-medium text-content-primary">{eq.equipment?.tag || eq.equipment?.model || 'Equipamento'}</span>
                                    {eq.description && <span className="text-sm text-content-secondary">— {eq.description}</span>}
                                </div>
                                {eq.items && eq.items.length > 0 && (
                                    <table className="w-full text-sm">
                                        <thead>
                                            <tr className="text-content-secondary">
                                                <th className="text-left py-1">Item</th>
                                                <th className="text-right py-1">Qtd</th>
                                                <th className="text-right py-1">Preço Unit.</th>
                                                <th className="text-right py-1">Desc.</th>
                                                <th className="text-right py-1">Subtotal</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {eq.items.map((item) => (
                                                <tr key={item.id} className="border-t border-default/50">
                                                    <td className="py-2">{item.custom_description || item.product?.name || item.service?.name || '—'}</td>
                                                    <td className="text-right py-2">{item.quantity}</td>
                                                    <td className="text-right py-2">{formatCurrency(item.unit_price)}</td>
                                                    <td className="text-right py-2">{parseFloat(String(item.discount_percentage)) > 0 ? `${item.discount_percentage}%` : '—'}</td>
                                                    <td className="text-right py-2 font-medium">{formatCurrency(item.subtotal)}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                )}
                            </div>
                        ))}
                    </div>
                </Card>
            )}
            {(!quote.equipments || quote.equipments.length === 0) && (
                <Card className="p-5">
                    <h3 className="text-sm font-semibold text-content-secondary mb-2">Equipamentos e Itens</h3>
                    <p className="text-sm text-content-secondary">Sem dados de itens neste orçamento.</p>
                </Card>
            )}

            {/* Observações */}
            {(quote.observations || quote.internal_notes) && (
                <div className="grid gap-6 md:grid-cols-2">
                    {quote.observations && (
                        <Card className="p-5">
                            <h3 className="text-sm font-semibold text-content-secondary mb-2">Observações</h3>
                            <p className="text-sm text-content-primary whitespace-pre-line">{quote.observations}</p>
                        </Card>
                    )}
                    {quote.internal_notes && (
                        <Card className="p-5">
                            <h3 className="text-sm font-semibold text-content-secondary mb-2">Notas Internas</h3>
                            <p className="text-sm text-content-primary whitespace-pre-line">{quote.internal_notes}</p>
                        </Card>
                    )}
                </div>
            )}

            <Card className="p-5">
                <h3 className="text-sm font-semibold text-content-secondary mb-3 flex items-center gap-2">
                    <History className="h-4 w-4" /> Histórico
                </h3>
                {timeline.length === 0 ? (
                    <p className="text-sm text-content-tertiary">Nenhum evento registrado.</p>
                ) : (
                    <ul className="space-y-2">
                        {timeline.map((log) => (
                            <li key={log.id} className="flex flex-wrap items-baseline gap-2 text-sm border-b border-default/50 pb-2 last:border-0 last:pb-0">
                                <span className="text-content-secondary shrink-0">
                                    {log.created_at ? new Date(log.created_at).toLocaleString('pt-BR') : '—'}
                                </span>
                                <span className="text-content-primary">{log.description || log.action}</span>
                            </li>
                        ))}
                    </ul>
                )}
            </Card>

            {proposalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setProposalOpen(false)}>
                    <div className="bg-surface-0 rounded-xl p-6 max-w-md mx-4 shadow-elevated w-full" onClick={(e) => e.stopPropagation()}>
                        <h3 className="text-lg font-semibold text-content-primary mb-2">Criar proposta interativa</h3>
                        <p className="text-content-secondary text-sm mb-4">Envie este orçamento como proposta pelo CRM (link para o cliente ver e aceitar).</p>
                        <label htmlFor="quote-proposal-expires" className="block text-sm font-medium text-content-secondary mb-1">Validade da proposta (opcional)</label>
                        <input
                            id="quote-proposal-expires"
                            type="date"
                            value={proposalExpires}
                            onChange={(e) => setProposalExpires(e.target.value)}
                            className="w-full rounded-lg border border-default bg-surface-0 px-3 py-2 text-sm mb-4"
                            aria-label="Validade da proposta"
                        />
                        <div className="flex gap-3 justify-end">
                            <Button variant="outline" size="sm" onClick={() => { setProposalOpen(false); setProposalExpires('') }}>Cancelar</Button>
                            <Button size="sm" onClick={() => createProposalMut.mutate({ quote_id: Number(id), expires_at: proposalExpires || undefined })} disabled={createProposalMut.isPending}>
                                {createProposalMut.isPending ? 'Criando...' : 'Criar'}
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {rejectOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setRejectOpen(false)}>
                    <div className="bg-surface-0 rounded-xl p-6 max-w-md mx-4 shadow-elevated w-full" onClick={(e) => e.stopPropagation()}>
                        <h3 className="text-lg font-semibold text-content-primary mb-2">Rejeitar Orçamento</h3>
                        <p className="text-content-secondary text-sm mb-4">Informe o motivo da rejeição (opcional):</p>
                        <textarea
                            className="w-full rounded-lg border border-default p-3 text-sm min-h-[100px] focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                            placeholder="Motivo da rejeição..."
                            value={rejectReason}
                            onChange={(e) => setRejectReason(e.target.value)}
                        />
                        <div className="flex gap-3 justify-end mt-4">
                            <Button variant="outline" size="sm" onClick={() => setRejectOpen(false)}>Cancelar</Button>
                            <Button variant="danger" size="sm" onClick={() => rejectMut.mutate()} disabled={rejectMut.isPending}>
                                {rejectMut.isPending ? 'Rejeitando...' : 'Rejeitar'}
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {deleteOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setDeleteOpen(false)}>
                    <div className="bg-surface-0 rounded-xl p-6 max-w-sm mx-4 shadow-elevated" onClick={(e) => e.stopPropagation()}>
                        <h3 className="text-lg font-semibold text-content-primary mb-2">Excluir Orçamento</h3>
                        <p className="text-content-secondary text-sm mb-6">
                            Tem certeza que deseja excluir o orçamento <strong>{quote.quote_number}</strong>? Esta ação não pode ser desfeita.
                        </p>
                        <div className="flex gap-3 justify-end">
                            <Button variant="outline" size="sm" onClick={() => setDeleteOpen(false)}>Cancelar</Button>
                            <Button variant="danger" size="sm" onClick={() => deleteMut.mutate()} disabled={deleteMut.isPending}>
                                {deleteMut.isPending ? 'Excluindo...' : 'Excluir'}
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
