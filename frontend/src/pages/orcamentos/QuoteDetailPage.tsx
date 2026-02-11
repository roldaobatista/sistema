import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
    ArrowLeft, Send, CheckCircle, XCircle, Copy, ArrowRight, Package, Wrench,
    FileText, User, DollarSign, MessageSquare, Download,
    ChevronLeft, Pencil, Printer, Mail,
} from 'lucide-react'
import api from '@/lib/api'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { QUOTE_STATUS } from '@/lib/constants'
import { QUOTE_STATUS_CONFIG } from '@/features/quotes/constants'

// Localized strings
const STRINGS = {
    loading: 'Carregando...',
    dateFormat: 'pt-BR',
    createdOn: 'Criado em',
    send: 'Enviar',
    reject: 'Rejeitar',
    approve: 'Aprovar',
    convertToOs: 'Converter em OS',
    downloadPdf: 'Baixar PDF',
    duplicate: 'Duplicar',
    customer: 'Cliente',
    details: 'Detalhes',
    values: 'Valores',
    seller: 'Vendedor',
    validity: 'Validade',
    equipments: 'Equipamentos',
    observations: 'Observações',
    rejectionReason: 'Motivo da Rejeição',
    confirmRejection: 'Confirmar Rejeição',
    cancel: 'Cancelar',
    rejectionPlaceholder: 'Motivo da rejeição (opcional)',
}

export function QuoteDetailPage() {
    const { id } = useParams()
    const navigate = useNavigate()
    const qc = useQueryClient()
    const [showRejectModal, setShowRejectModal] = useState(false)
    const [rejectionReason, setRejectionReason] = useState('')

    const { data: quoteRes, isLoading } = useQuery({
        queryKey: ['quote', id],
        queryFn: () => api.get(`/quotes/${id}`),
        enabled: !!id,
    })
    const quote = quoteRes?.data

    const sendMut = useMutation({
        mutationFn: () => api.post(`/quotes/${id}/send`),
        onSuccess: () => { qc.invalidateQueries({ queryKey: ['quote', id] }); }
    })

    const approveMut = useMutation({
        mutationFn: () => api.post(`/quotes/${id}/approve`),
        onSuccess: () => { qc.invalidateQueries({ queryKey: ['quote', id] }); }
    })

    const rejectMut = useMutation({
        mutationFn: () => api.post(`/quotes/${id}/reject`, { reason: rejectionReason }),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['quote', id] });
            setShowRejectModal(false);
            setRejectionReason('');
        }
    })

    const convertMut = useMutation({
        mutationFn: () => api.post(`/quotes/${id}/convert-to-os`),
        onSuccess: (res) => {
            qc.invalidateQueries({ queryKey: ['quote', id] });
            navigate(`/ordens-servico/${res.data.id}`);
        },
        onError: (err: any) => {
            if (err.response?.status === 409 && err.response?.data?.work_order) {
                navigate(`/ordens-servico/${err.response.data.work_order.id}`);
            } else {
                alert(err.response?.data?.message || 'Erro ao converter');
            }
        }
    })

    if (isLoading) return <div className="flex h-96 items-center justify-center text-surface-500">Carregando detalhes...</div>
    if (!quote) return <div className="flex h-96 items-center justify-center text-surface-500">Orçamento não encontrado</div>

    const sc = QUOTE_STATUS_CONFIG[quote.status] ?? QUOTE_STATUS_CONFIG[QUOTE_STATUS.DRAFT]

    return (
        <div className="space-y-6 max-w-5xl mx-auto pb-20">
            {/* Header */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                    <Button variant="ghost" size="icon" onClick={() => navigate('/orcamentos')}>
                        <ChevronLeft className="h-5 w-5" />
                    </Button>
                    <div>
                        <div className="flex items-center gap-3">
                            <h1 className="text-2xl font-bold text-surface-900">{quote.quote_number}</h1>
                            <Badge variant={sc.variant} className="gap-1.5 px-2.5 py-0.5">
                                {sc.label}
                            </Badge>
                        </div>
                        <p className="mt-1 text-sm text-surface-500">
                            Criado em {new Date(quote.created_at).toLocaleDateString('pt-BR')} • Válido até {quote.valid_until ? new Date(quote.valid_until).toLocaleDateString('pt-BR') : '—'}
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" icon={<Download className="h-4 w-4" />}>PDF</Button>

                    {quote.status === QUOTE_STATUS.DRAFT && (
                        <>
                            <Button variant="outline" size="sm" icon={<Pencil className="h-4 w-4" />} onClick={() => navigate(`/orcamentos/${id}/editar`)}>Editar</Button>
                            <Button variant="primary" size="sm" icon={<Send className="h-4 w-4" />} onClick={() => sendMut.mutate()}>Enviar</Button>
                        </>
                    )}

                    {quote.status === QUOTE_STATUS.SENT && (
                        <>
                            <Button variant="danger" size="sm" icon={<XCircle className="h-4 w-4" />} onClick={() => setShowRejectModal(true)}>Rejeitar</Button>
                            <Button variant="success" size="sm" icon={<CheckCircle className="h-4 w-4" />} onClick={() => approveMut.mutate()}>Aprovar</Button>
                        </>
                    )}

                    {quote.status === QUOTE_STATUS.APPROVED && (
                        <Button variant="primary" size="sm" icon={<ArrowRight className="h-4 w-4" />} onClick={() => convertMut.mutate()}>Gerar OS</Button>
                    )}
                </div>
            </div>

            {/* Content Grid */}
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">

                {/* Main Info */}
                <div className="lg:col-span-2 space-y-6">

                    {/* Customer Card */}
                    <div className="rounded-xl border border-default bg-surface-0 p-5 shadow-card">
                        <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-surface-900">
                            <User className="h-4 w-4 text-brand-500" />
                            Dados do Cliente
                        </h3>
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                            <div>
                                <p className="text-xs text-surface-500">Cliente</p>
                                <p className="font-medium text-surface-900">{quote.customer?.name}</p>
                            </div>
                            <div>
                                <p className="text-xs text-surface-500">Documento</p>
                                <p className="font-medium text-surface-900">{quote.customer?.document || '—'}</p>
                            </div>
                            {/* Add more customer fields as needed */}
                        </div>
                    </div>

                    {/* Equipments & Items */}
                    <div className="rounded-xl border border-default bg-surface-0 shadow-card overflow-hidden">
                        <div className="border-b border-subtle bg-surface-50 px-5 py-3">
                            <h3 className="flex items-center gap-2 text-sm font-semibold text-surface-900">
                                <FileText className="h-4 w-4 text-brand-500" />
                                Itens do Orçamento
                            </h3>
                        </div>

                        <div className="divide-y divide-subtle">
                            {quote.equipments?.map((eq: any) => (
                                <div key={eq.id} className="p-5">
                                    <div className="mb-3 flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <Badge variant="outline" className="bg-surface-100 text-surface-700">Equipamento</Badge>
                                            <span className="font-medium text-surface-900">
                                                {eq.equipment?.name || eq.description || 'Equipamento sem nome'}
                                            </span>
                                        </div>
                                    </div>

                                    <div className="rounded-lg border border-subtle overflow-hidden">
                                        <table className="w-full text-sm">
                                            <thead className="bg-surface-50">
                                                <tr>
                                                    <th className="px-3 py-2 text-left font-medium text-surface-600">Item</th>
                                                    <th className="px-3 py-2 text-right font-medium text-surface-600 w-20">Qtd</th>
                                                    <th className="px-3 py-2 text-right font-medium text-surface-600 w-32">Unitário</th>
                                                    <th className="px-3 py-2 text-right font-medium text-surface-600 w-32">Total</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-subtle">
                                                {eq.items?.map((item: any) => (
                                                    <tr key={item.id}>
                                                        <td className="px-3 py-2 text-surface-900">
                                                            {item.product?.name || item.service?.name || item.custom_description || 'Item sem nome'}
                                                        </td>
                                                        <td className="px-3 py-2 text-right text-surface-600">{item.quantity}</td>
                                                        <td className="px-3 py-2 text-right text-surface-600">
                                                            {Number(item.unit_price).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                                        </td>
                                                        <td className="px-3 py-2 text-right font-medium text-surface-900">
                                                            {Number(item.subtotal).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            ))}
                            {(!quote.equipments || quote.equipments.length === 0) && (
                                <div className="p-8 text-center text-surface-500 text-sm">
                                    Nenhum item adicionado
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Sidebar */}
                <div className="space-y-6">
                    {/* Values Summary */}
                    <div className="rounded-xl border border-default bg-surface-0 p-5 shadow-card">
                        <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-surface-900">
                            <DollarSign className="h-4 w-4 text-brand-500" />
                            Resumo Financeiro
                        </h3>
                        <div className="space-y-3">
                            <div className="flex justify-between text-sm">
                                <span className="text-surface-500">Subtotal</span>
                                <span className="text-surface-900">{Number(quote.subtotal).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-surface-500">Desconto</span>
                                <span className="text-red-600">- {Number(quote.discount_amount).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                            </div>
                            <div className="border-t border-dashed border-subtle pt-3 mt-3">
                                <div className="flex justify-between items-baseline">
                                    <span className="font-semibold text-surface-900">Total</span>
                                    <span className="text-xl font-bold text-brand-600">{Number(quote.total).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Additional Info */}
                    <div className="rounded-xl border border-default bg-surface-0 p-5 shadow-card">
                        <h3 className="mb-4 text-sm font-semibold text-surface-900">Informações Adicionais</h3>
                        <div className="space-y-4">
                            <div>
                                <p className="text-xs text-surface-500 mb-1">Vendedor</p>
                                <div className="flex items-center gap-2">
                                    <div className="h-6 w-6 rounded-full bg-brand-100 flex items-center justify-center text-[10px] font-bold text-brand-700">
                                        {quote.seller?.name?.substring(0, 2).toUpperCase()}
                                    </div>
                                    <span className="text-sm text-surface-900">{quote.seller?.name}</span>
                                </div>
                            </div>
                            {quote.internal_notes && (
                                <div>
                                    <p className="text-xs text-surface-500 mb-1">Notas Internas</p>
                                    <p className="text-sm text-surface-700 bg-surface-50 p-2 rounded border border-subtle">
                                        {quote.internal_notes}
                                    </p>
                                </div>
                            )}
                            {quote.rejection_reason && (
                                <div>
                                    <p className="text-xs text-red-500 mb-1 font-medium">Motivo da Rejeição</p>
                                    <p className="text-sm text-red-700 bg-red-50 p-2 rounded border border-red-100">
                                        {quote.rejection_reason}
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Reject Modal */}
            {showRejectModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                    <div className="w-full max-w-md bg-surface-0 rounded-xl shadow-2xl p-6">
                        <h3 className="text-lg font-bold text-surface-900 mb-2">Rejeitar Orçamento</h3>
                        <p className="text-sm text-surface-500 mb-4">Por favor, informe o motivo da rejeição deste orçamento.</p>

                        <textarea
                            className="w-full h-32 rounded-lg border border-default bg-surface-50 p-3 text-sm focus:border-brand-500 focus:outline-none resize-none mb-4"
                            placeholder="Motivo da rejeição..."
                            value={rejectionReason}
                            onChange={(e) => setRejectionReason(e.target.value)}
                        />

                        <div className="flex justify-end gap-2">
                            <Button variant="outline" onClick={() => setShowRejectModal(false)}>Cancelar</Button>
                            <Button variant="danger" onClick={() => rejectMut.mutate()} disabled={!rejectionReason.trim()}>
                                Confirmar Rejeição
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
