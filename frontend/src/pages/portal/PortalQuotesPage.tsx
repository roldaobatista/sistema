import { useState } from 'react'
import { toast } from 'sonner'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { DollarSign, Check, X, FileText, Clock, CheckCircle, XCircle } from 'lucide-react'
import api from '@/lib/api'
import { cn } from '@/lib/utils'
import { QUOTE_STATUS } from '@/lib/constants'
import { useAuthStore } from '@/stores/auth-store'

const fmtBRL = (v: string | number) => Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const fmtDate = (d: string) => new Date(d).toLocaleDateString('pt-BR')

const statusCfg: Record<string, { label: string; color: string; bg: string; icon: any }> = {
    [QUOTE_STATUS.DRAFT]: { label: 'Pendente', color: 'text-amber-600', bg: 'bg-amber-100', icon: Clock },
    [QUOTE_STATUS.SENT]: { label: 'Enviado', color: 'text-sky-600', bg: 'bg-sky-100', icon: FileText },
    [QUOTE_STATUS.APPROVED]: { label: 'Aprovado', color: 'text-emerald-600', bg: 'bg-emerald-100', icon: CheckCircle },
    [QUOTE_STATUS.REJECTED]: { label: 'Rejeitado', color: 'text-red-600', bg: 'bg-red-100', icon: XCircle },
    [QUOTE_STATUS.EXPIRED]: { label: 'Expirado', color: 'text-amber-700', bg: 'bg-amber-100', icon: Clock },
    [QUOTE_STATUS.INVOICED]: { label: 'Faturado', color: 'text-purple-700', bg: 'bg-purple-100', icon: DollarSign },
}

export function PortalQuotesPage() {
  const { hasPermission } = useAuthStore()

    const qc = useQueryClient()
    const [rejectingId, setRejectingId] = useState<number | null>(null)
    const [rejectReason, setRejectReason] = useState('')

    const { data, isLoading, isError, refetch } = useQuery({
        queryKey: ['portal-quotes'],
        queryFn: () => api.get('/portal/quotes').then(res => res.data),
    })

    const approveMut = useMutation({
        mutationFn: (id: number) => api.post(`/portal/quotes/${id}/status`, { action: 'approve' }),
        onSuccess: () => {
            toast.success('Operação realizada com sucesso')
                qc.invalidateQueries({ queryKey: ['portal-quotes'] })
        },
    })

    const rejectMut = useMutation({
        mutationFn: ({ id, comments }: { id: number; comments?: string }) =>
            api.post(`/portal/quotes/${id}/status`, { action: 'reject', comments }),
        onSuccess: () => {
            toast.success('Operação realizada com sucesso')
                qc.invalidateQueries({ queryKey: ['portal-quotes'] })
        },
    })

    const quotes: any[] = data?.data ?? []
    const pendingCount = quotes.filter(q => q.status === QUOTE_STATUS.DRAFT || q.status === QUOTE_STATUS.SENT).length

    const content = (
        <div className="space-y-5">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-lg font-semibold text-surface-900 tracking-tight">Orçamentos</h1>
                    <p className="mt-0.5 text-sm text-surface-500">
                        {pendingCount > 0 ? `${pendingCount} orçamento(s) aguardando aprovação` : 'Todos os orçamentos'}
                    </p>
                </div>
            </div>

            {isLoading ? (
                <div className="text-center text-surface-400 py-12">Carregando...</div>
            ) : quotes.length === 0 ? (
                <div className="text-center py-12">
                    <FileText className="mx-auto h-10 w-10 text-surface-300" />
                    <p className="mt-2 text-sm text-surface-400">Nenhum orçamento encontrado</p>
                </div>
            ) : (
                <div className="grid gap-4 sm:grid-cols-2">
                    {quotes.map((q: any) => {
                        const cfg = statusCfg[q.status] ?? statusCfg[QUOTE_STATUS.DRAFT]
                        const StatusIcon = cfg.icon
                        const isPending = q.status === QUOTE_STATUS.DRAFT || q.status === QUOTE_STATUS.SENT
                        const isAnyMutating = approveMut.isPending || rejectMut.isPending
                        return (
                            <div key={q.id} className={cn(
                                'rounded-xl border bg-surface-0 shadow-card overflow-hidden transition-all',
                                isPending ? 'border-brand-200' : 'border-surface-200'
                            )}>
                                <div className="p-5">
                                    <div className="flex items-start justify-between mb-3">
                                        <div className="flex items-center gap-3">
                                            <div className={cn('rounded-lg p-2', cfg.bg)}>
                                                <StatusIcon className={cn('h-4 w-4', cfg.color)} />
                                            </div>
                                            <div>
                                                <p className="text-sm font-bold text-surface-900">Orçamento #{q.quote_number ?? q.id}</p>
                                                <p className="text-xs text-surface-400">{fmtDate(q.created_at)}</p>
                                            </div>
                                        </div>
                                        <span className={cn('text-xs font-semibold px-2.5 py-1 rounded-full', cfg.bg, cfg.color)}>
                                            {cfg.label}
                                        </span>
                                    </div>

                                    {(() => {
                                        const allItems = q.equipments?.flatMap((e: any) => e.items) ?? []
                                        return allItems.length > 0 && (
                                            <div className="mb-3 space-y-1">
                                                {allItems.slice(0, 3).map((item: any, i: number) => (
                                                    <div key={i} className="flex items-center justify-between text-xs">
                                                        <span className="text-surface-600 truncate max-w-[60%]">{item.product?.name || item.service?.name || item.custom_description}</span>
                                                        <span className="text-surface-500 font-medium">{fmtBRL(item.subtotal ?? 0)}</span>
                                                    </div>
                                                ))}
                                                {allItems.length > 3 && (
                                                    <p className="text-xs text-surface-400 italic">+{allItems.length - 3} item(ns)</p>
                                                )}
                                            </div>
                                        )
                                    })()}

                                    <div className="border-t border-subtle pt-3 flex items-center justify-between">
                                        <span className="text-xs text-surface-500">Total</span>
                                        <span className="text-sm font-semibold tabular-nums text-surface-900">{fmtBRL(q.total_amount ?? q.total ?? 0)}</span>
                                    </div>
                                </div>

                                {isPending && (
                                    <div className="border-t border-subtle bg-surface-50 px-5 py-3 flex gap-2 justify-end">
                                        <button
                                            onClick={() => { setRejectingId(q.id); setRejectReason('') }}
                                            disabled={isAnyMutating}
                                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
                                        >
                                            <X className="h-3.5 w-3.5" /> Rejeitar
                                        </button>
                                        <button
                                            onClick={() => approveMut.mutate(q.id)}
                                            disabled={isAnyMutating}
                                            className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-medium bg-brand-600 text-white hover:bg-brand-700 transition-colors disabled:opacity-50"
                                        >
                                            <Check className="h-3.5 w-3.5" /> Aprovar
                                        </button>
                                    </div>
                                )}
                            </div>
                        )
                    })}
                </div>
            )}
        </div>
    )

    return (
        <>
            {content}

            {rejectingId !== null && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
                    <div className="bg-surface-0 rounded-xl shadow-xl w-full max-w-md mx-4 p-6">
                        <h3 className="text-lg font-semibold text-surface-900 mb-3">Rejeitar Orçamento</h3>
                        <textarea
                            value={rejectReason}
                            onChange={e => setRejectReason(e.target.value)}
                            placeholder="Motivo da rejeição (opcional)..."
                            rows={3}
                            className="w-full rounded-lg border border-surface-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 mb-4"
                        />
                        <div className="flex justify-end gap-2">
                            <button
                                onClick={() => setRejectingId(null)}
                                className="px-4 py-2 text-sm rounded-lg text-surface-600 hover:bg-surface-100 transition-colors"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={() => {
                                    if (!rejectReason.trim()) return
                                    rejectMut.mutate({ id: rejectingId, comments: rejectReason })
                                    setRejectingId(null)
                                }}
                                disabled={!rejectReason.trim() || rejectMut.isPending}
                                className="px-4 py-2 text-sm rounded-lg bg-red-600 text-white hover:bg-red-700 transition-colors disabled:opacity-50"
                            >
                                Confirmar Rejeição
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    )
}
