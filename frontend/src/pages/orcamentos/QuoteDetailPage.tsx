import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
    ArrowLeft, Send, CheckCircle, XCircle, Copy, ArrowRight, Package, Wrench,
    FileText, Calendar, User, DollarSign, MessageSquare, Download,
} from 'lucide-react'
import api from '@/lib/api'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'

const statusConfig: Record<string, { label: string; variant: any }> = {
    draft: { label: 'Rascunho', variant: 'default' },
    sent: { label: 'Enviado', variant: 'info' },
    approved: { label: 'Aprovado', variant: 'success' },
    rejected: { label: 'Rejeitado', variant: 'danger' },
    expired: { label: 'Expirado', variant: 'warning' },
    invoiced: { label: 'Faturado', variant: 'info' },
}

export function QuoteDetailPage() {
    const { id } = useParams()
    const navigate = useNavigate()
    const qc = useQueryClient()

    const { data: quoteRes, isLoading } = useQuery({
        queryKey: ['quote', id],
        queryFn: () => api.get(`/quotes/${id}`),
        enabled: !!id,
    })
    const quote = quoteRes?.data

    const sendMut = useMutation({ mutationFn: () => api.post(`/quotes/${id}/send`), onSuccess: () => qc.invalidateQueries({ queryKey: ['quote', id] }) })
    const approveMut = useMutation({ mutationFn: () => api.post(`/quotes/${id}/approve`), onSuccess: () => qc.invalidateQueries({ queryKey: ['quote', id] }) })
    const rejectMut = useMutation({ mutationFn: () => api.post(`/quotes/${id}/reject`), onSuccess: () => qc.invalidateQueries({ queryKey: ['quote', id] }) })
    const duplicateMut = useMutation({
        mutationFn: () => api.post(`/quotes/${id}/duplicate`),
        onSuccess: (res) => navigate(`/orcamentos/${res.data.id}`),
    })
    const convertMut = useMutation({
        mutationFn: () => api.post(`/quotes/${id}/convert-to-os`),
        onSuccess: (res) => { qc.invalidateQueries({ queryKey: ['quote', id] }); navigate(`/ordens-de-servico/${res.data.id}`) },
    })

    if (isLoading || !quote) return <div className="flex items-center justify-center h-64 text-surface-500">Carregando...</div>

    const sc = statusConfig[quote.status] ?? statusConfig.draft

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <button onClick={() => navigate('/orcamentos')} className="rounded-lg p-1.5 text-surface-500 hover:bg-surface-100">
                        <ArrowLeft className="h-5 w-5" />
                    </button>
                    <div>
                        <div className="flex items-center gap-3">
                            <h1 className="text-2xl font-bold text-surface-900">{quote.quote_number}</h1>
                            <Badge variant={sc.variant}>{sc.label}</Badge>
                        </div>
                        <p className="text-sm text-surface-500">Criado em {new Date(quote.created_at).toLocaleDateString('pt-BR')}</p>
                    </div>
                </div>
                <div className="flex gap-2">
                    {quote.status === 'draft' && <Button variant="outline" icon={<Send className="h-4 w-4" />} onClick={() => sendMut.mutate()}>Enviar</Button>}
                    {quote.status === 'sent' && (
                        <>
                            <Button variant="outline" icon={<XCircle className="h-4 w-4" />} onClick={() => rejectMut.mutate()} className="text-red-600">Rejeitar</Button>
                            <Button icon={<CheckCircle className="h-4 w-4" />} onClick={() => approveMut.mutate()}>Aprovar</Button>
                        </>
                    )}
                    {quote.status === 'approved' && <Button icon={<ArrowRight className="h-4 w-4" />} onClick={() => convertMut.mutate()}>Converter em OS</Button>}
                    <Button variant="outline" icon={<Download className="h-4 w-4" />}
                        onClick={() => window.open(`${api.defaults.baseURL}/quotes/${id}/pdf`, '_blank')}>
                        Baixar PDF
                    </Button>
                    <Button variant="outline" icon={<Copy className="h-4 w-4" />} onClick={() => duplicateMut.mutate()}>Duplicar</Button>
                </div>
            </div>

            {/* Info cards */}
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                <div className="rounded-xl border border-surface-200 bg-white p-5 shadow-card space-y-3">
                    <h3 className="flex items-center gap-2 text-sm font-semibold text-surface-700"><User className="h-4 w-4 text-brand-500" />Cliente</h3>
                    <p className="text-lg font-semibold text-surface-900">{quote.customer?.name}</p>
                    <p className="text-sm text-surface-500">{quote.customer?.document}</p>
                    {quote.customer?.contacts?.[0] && <p className="text-sm text-surface-500">{quote.customer.contacts[0].phone}</p>}
                </div>
                <div className="rounded-xl border border-surface-200 bg-white p-5 shadow-card space-y-3">
                    <h3 className="flex items-center gap-2 text-sm font-semibold text-surface-700"><FileText className="h-4 w-4 text-brand-500" />Detalhes</h3>
                    <div className="space-y-1 text-sm">
                        <div className="flex justify-between"><span className="text-surface-500">Vendedor</span><span className="font-medium">{quote.seller?.name}</span></div>
                        <div className="flex justify-between"><span className="text-surface-500">Validade</span><span className="font-medium">{quote.valid_until ? new Date(quote.valid_until).toLocaleDateString('pt-BR') : '—'}</span></div>
                        <div className="flex justify-between"><span className="text-surface-500">Equipamentos</span><span className="font-medium">{quote.equipments?.length ?? 0}</span></div>
                    </div>
                </div>
                <div className="rounded-xl border border-surface-200 bg-white p-5 shadow-card space-y-3">
                    <h3 className="flex items-center gap-2 text-sm font-semibold text-surface-700"><DollarSign className="h-4 w-4 text-brand-500" />Valores</h3>
                    <div className="space-y-1 text-sm">
                        <div className="flex justify-between"><span className="text-surface-500">Subtotal</span><span>{Number(quote.subtotal).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span></div>
                        {Number(quote.discount_amount) > 0 && (
                            <div className="flex justify-between"><span className="text-red-500">Desconto</span><span className="text-red-500">-{Number(quote.discount_amount).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span></div>
                        )}
                        <div className="flex justify-between border-t pt-1 text-lg font-bold"><span>Total</span><span className="text-brand-700">{Number(quote.total).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span></div>
                    </div>
                </div>
            </div>

            {/* Observations */}
            {quote.observations && (
                <div className="rounded-xl border border-surface-200 bg-white p-5 shadow-card">
                    <h3 className="flex items-center gap-2 mb-2 text-sm font-semibold text-surface-700"><MessageSquare className="h-4 w-4 text-brand-500" />Observações</h3>
                    <p className="text-sm text-surface-600 whitespace-pre-wrap">{quote.observations}</p>
                </div>
            )}

            {/* Equipments + Items */}
            {quote.equipments?.map((eq: any) => (
                <div key={eq.id} className="rounded-xl border border-surface-200 bg-white shadow-card overflow-hidden">
                    <div className="border-b border-surface-200 bg-surface-50 px-5 py-3">
                        <h4 className="font-semibold text-surface-900">{eq.equipment?.name || eq.equipment?.model || `Equip. #${eq.equipment_id}`}</h4>
                        {eq.description && <p className="mt-1 text-sm text-surface-500">{eq.description}</p>}
                    </div>
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b text-left text-xs text-surface-500">
                                <th className="px-5 py-2">Tipo</th><th className="px-5 py-2">Item</th><th className="px-5 py-2 text-right">Qtd</th>
                                <th className="px-5 py-2 text-right">Preço Unit.</th><th className="px-5 py-2 text-right">Desc.</th><th className="px-5 py-2 text-right">Subtotal</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-surface-100">
                            {eq.items?.map((it: any) => (
                                <tr key={it.id}>
                                    <td className="px-5 py-3">{it.type === 'product' ? <Package className="h-4 w-4 text-blue-500" /> : <Wrench className="h-4 w-4 text-emerald-500" />}</td>
                                    <td className="px-5 py-3 font-medium text-surface-900">{it.product?.name || it.service?.name || it.custom_description}</td>
                                    <td className="px-5 py-3 text-right">{Number(it.quantity).toFixed(2)}</td>
                                    <td className="px-5 py-3 text-right">{Number(it.unit_price).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                                    <td className="px-5 py-3 text-right">{Number(it.discount_percentage) > 0 ? `${it.discount_percentage}%` : '—'}</td>
                                    <td className="px-5 py-3 text-right font-semibold">{Number(it.subtotal).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            ))}

            {/* Rejection reason */}
            {quote.status === 'rejected' && quote.rejection_reason && (
                <div className="rounded-xl border border-red-200 bg-red-50 p-5">
                    <h4 className="text-sm font-semibold text-red-700">Motivo da Rejeição</h4>
                    <p className="mt-1 text-sm text-red-600">{quote.rejection_reason}</p>
                </div>
            )}
        </div>
    )
}
