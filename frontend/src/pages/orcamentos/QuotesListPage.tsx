import { useState, useRef, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/stores/auth-store'
import { toast } from 'sonner'
import api from '@/lib/api'
import { useAuvoExport } from '@/hooks/useAuvoExport'
import { QUOTE_STATUS } from '@/lib/constants'
import { QUOTE_STATUS_CONFIG } from '@/features/quotes/constants'
import type { Quote, QuoteSummary } from '@/types/quote'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'
import {
    Plus, Search, Send, CheckCircle, Copy, ArrowRightLeft,
    Trash2, FileText, X, RefreshCw, Download, UploadCloud
} from 'lucide-react'

const STATUS_FILTERS = [
    { value: '', label: 'Todos' },
    { value: QUOTE_STATUS.DRAFT, label: 'Rascunho' },
    { value: QUOTE_STATUS.PENDING_INTERNAL, label: 'Aguard. Aprov. Interna' },
    { value: QUOTE_STATUS.INTERNALLY_APPROVED, label: 'Aprovado Internamente' },
    { value: QUOTE_STATUS.SENT, label: 'Enviado' },
    { value: QUOTE_STATUS.APPROVED, label: 'Aprovado' },
    { value: QUOTE_STATUS.REJECTED, label: 'Rejeitado' },
    { value: QUOTE_STATUS.EXPIRED, label: 'Expirado' },
    { value: QUOTE_STATUS.INVOICED, label: 'Faturado' },
]

const formatCurrency = (v: number | string) => {
    const n = typeof v === 'string' ? parseFloat(v) : v
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(n || 0)
}

export function QuotesListPage() {
    const navigate = useNavigate()
    const qc = useQueryClient()
    const { hasPermission } = useAuthStore()
    const { exportQuote } = useAuvoExport()

    const [search, setSearch] = useState('')
    const [debouncedSearch, setDebouncedSearch] = useState('')
    const [status, setStatus] = useState('')
    const [page, setPage] = useState(1)
    const [deleteTarget, setDeleteTarget] = useState<Quote | null>(null)
    const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined)

    const canCreate = hasPermission('quotes.quote.create')
    const canUpdate = hasPermission('quotes.quote.update')
    const canDelete = hasPermission('quotes.quote.delete')
    const canSend = hasPermission('quotes.quote.send')
    const canApprove = hasPermission('quotes.quote.approve')

    useEffect(() => {
        if (debounceRef.current) {
            clearTimeout(debounceRef.current)
        }
        debounceRef.current = setTimeout(() => {
            setDebouncedSearch(search)
            setPage(1)
        }, 300)
        return () => {
            if (debounceRef.current) {
                clearTimeout(debounceRef.current)
            }
        }
    }, [search])

    const { data: summary } = useQuery<QuoteSummary>({
        queryKey: ['quotes-summary'],
        queryFn: () => api.get('/quotes-summary').then(r => r.data),
    })

    const { data: listData, isLoading } = useQuery({
        queryKey: ['quotes', debouncedSearch, status, page],
        queryFn: () => api.get('/quotes', { params: { search: debouncedSearch || undefined, status: status || undefined, page } }).then(r => r.data),
    })
    const quotes: Quote[] = listData?.data ?? []
    const pagination = listData

    const invalidateAll = () => {
        qc.invalidateQueries({ queryKey: ['quotes'] })
        qc.invalidateQueries({ queryKey: ['quotes-summary'] })
    }

    const sendMut = useMutation({
        mutationFn: (id: number) => api.post(`/quotes/${id}/send`),
        onSuccess: () => { toast.success('Orçamento enviado com sucesso!'); invalidateAll() },
        onError: (err: any) => toast.error(err?.response?.data?.message || 'Erro ao enviar orçamento'),
    })

    const approveMut = useMutation({
        mutationFn: (id: number) => api.post(`/quotes/${id}/approve`),
        onSuccess: () => { toast.success('Orçamento aprovado!'); invalidateAll() },
        onError: (err: any) => toast.error(err?.response?.data?.message || 'Erro ao aprovar orçamento'),
    })

    const convertMut = useMutation({
        mutationFn: (id: number) => api.post(`/quotes/${id}/convert-to-os`),
        onSuccess: () => { toast.success('OS criada a partir do orçamento!'); invalidateAll() },
        onError: (err: any) => toast.error(err?.response?.data?.message || 'Erro ao converter em OS'),
    })

    const duplicateMut = useMutation({
        mutationFn: (id: number) => api.post(`/quotes/${id}/duplicate`),
        onSuccess: () => { toast.success('Orçamento duplicado!'); invalidateAll() },
        onError: (err: any) => toast.error(err?.response?.data?.message || 'Erro ao duplicar orçamento'),
    })

    const deleteMut = useMutation({
        mutationFn: (id: number) => api.delete(`/quotes/${id}`),
        onSuccess: () => { toast.success('Orçamento excluído!'); setDeleteTarget(null); invalidateAll() },
        onError: (err: any) => { toast.error(err?.response?.data?.message || 'Erro ao excluir orçamento'); setDeleteTarget(null) },
    })

    const reopenMut = useMutation({
        mutationFn: (id: number) => api.post(`/quotes/${id}/reopen`),
        onSuccess: () => { toast.success('Orçamento reaberto!'); invalidateAll() },
        onError: (err: any) => toast.error(err?.response?.data?.message || 'Erro ao reabrir orçamento'),
    })

    const handleExportCsv = async () => {
        try {
            const res = await api.get('/quotes-export', { params: { status: status || undefined }, responseType: 'blob' })
            const url = URL.createObjectURL(new Blob([res.data]))
            const a = document.createElement('a'); a.href = url; a.download = `orcamentos_${new Date().toISOString().slice(0, 10)}.csv`; a.click()
            URL.revokeObjectURL(url)
            toast.success('Exportação concluída!')
        } catch {
            toast.error('Erro ao exportar orçamentos')
        }
    }

    const summaryCards = summary ? [
        { label: 'Rascunho', value: summary.draft, color: 'text-content-secondary' },
        { label: 'Enviados', value: summary.sent, color: 'text-blue-600' },
        { label: 'Aprovados', value: summary.approved, color: 'text-green-600' },
        { label: 'Rejeitados', value: summary.rejected ?? 0, color: 'text-red-600' },
        { label: 'Faturados', value: summary.invoiced, color: 'text-violet-600' },
        { label: 'Total do Mês', value: formatCurrency(summary.total_month ?? 0), color: 'text-emerald-600', isCurrency: true },
    ] : []

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold text-content-primary">Orçamentos</h1>
                <div className="flex gap-2">
                    <Button variant="outline" size="sm" icon={<Download className="h-4 w-4" />} onClick={handleExportCsv}>Exportar CSV</Button>
                    {canCreate && (
                        <Button icon={<Plus className="h-4 w-4" />} onClick={() => navigate('/orcamentos/novo')}>Novo Orçamento</Button>
                    )}
                </div>
            </div>

            {summaryCards.length > 0 && (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                    {summaryCards.map((c) => (
                        <Card key={c.label} className="p-4 text-center">
                            <p className="text-xs text-content-secondary mb-1">{c.label}</p>
                            <p className={`text-xl font-bold ${c.color}`}>{c.isCurrency ? c.value : c.value}</p>
                        </Card>
                    ))}
                </div>
            )}

            <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-content-tertiary" />
                    <Input
                        placeholder="Buscar por número ou cliente..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="pl-10"
                    />
                </div>
                <div className="flex gap-2 flex-wrap">
                    {STATUS_FILTERS.map((f) => (
                        <button
                            key={f.value}
                            onClick={() => { setStatus(f.value); setPage(1) }}
                            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${status === f.value
                                ? 'bg-brand-600 text-white'
                                : 'bg-surface-100 text-content-secondary hover:bg-surface-200'
                                }`}
                        >
                            {f.label}
                        </button>
                    ))}
                </div>
            </div>

            <div className="bg-surface-0 rounded-xl border border-default shadow-card overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-subtle">
                        <thead className="bg-surface-50">
                            <tr>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-content-secondary uppercase">Número</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-content-secondary uppercase">Cliente</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-content-secondary uppercase">Status</th>
                                <th className="px-4 py-3 text-right text-xs font-semibold text-content-secondary uppercase">Total</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-content-secondary uppercase">Validade</th>
                                <th className="px-4 py-3 text-right text-xs font-semibold text-content-secondary uppercase">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-subtle">
                            {isLoading ? (
                                Array.from({ length: 5 }).map((_, i) => (
                                    <tr key={i}>
                                        {Array.from({ length: 6 }).map((_, j) => (
                                            <td key={j} className="px-4 py-3"><div className="h-4 bg-surface-100 rounded animate-pulse" /></td>
                                        ))}
                                    </tr>
                                ))
                            ) : quotes.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="px-4 py-16 text-center">
                                        <FileText className="h-12 w-12 text-content-tertiary mx-auto mb-3" />
                                        <p className="text-content-secondary font-medium">Nenhum orçamento encontrado</p>
                                        <p className="text-sm text-content-tertiary mt-1">
                                            {debouncedSearch || status ? 'Tente alterar os filtros' : 'Crie seu primeiro orçamento'}
                                        </p>
                                        {canCreate && !debouncedSearch && !status && (
                                            <Button variant="outline" size="sm" className="mt-4" onClick={() => navigate('/orcamentos/novo')}>
                                                <Plus className="h-4 w-4 mr-1" /> Novo Orçamento
                                            </Button>
                                        )}
                                    </td>
                                </tr>
                            ) : (
                                quotes.map((q) => {
                                    const cfg = QUOTE_STATUS_CONFIG[q.status] ?? { label: q.status, variant: 'default', icon: FileText }
                                    const isDraft = q.status === QUOTE_STATUS.DRAFT
                                    const isInternallyApproved = q.status === QUOTE_STATUS.INTERNALLY_APPROVED
                                    const isSent = q.status === QUOTE_STATUS.SENT
                                    const isApproved = q.status === QUOTE_STATUS.APPROVED
                                    const isRejected = q.status === QUOTE_STATUS.REJECTED
                                    const isExpired = q.status === QUOTE_STATUS.EXPIRED
                                    const isMutable = isDraft || isRejected

                                    return (
                                        <tr key={q.id} className="hover:bg-surface-50 transition-colors duration-100 cursor-pointer" onClick={() => navigate(`/orcamentos/${q.id}`)}>
                                            <td className="px-4 py-3">
                                                <span className="font-medium text-brand-600">{q.quote_number}</span>
                                                {q.revision > 1 && <span className="text-xs text-content-tertiary ml-1">rev.{q.revision}</span>}
                                            </td>
                                            <td className="px-4 py-3 text-content-primary">{q.customer?.name ?? '—'}</td>
                                            <td className="px-4 py-3"><Badge variant={cfg.variant}>{cfg.label}</Badge></td>
                                            <td className="px-4 py-3 text-right font-medium">{formatCurrency(q.total)}</td>
                                            <td className="px-4 py-3 text-content-secondary text-sm">
                                                {q.valid_until ? new Date(q.valid_until).toLocaleDateString('pt-BR') : '—'}
                                            </td>
                                            <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                                                <div className="flex gap-1 justify-end">
                                                    {canSend && isDraft && (
                                                        <button title="Solicitar Aprovação Interna" onClick={() => sendMut.mutate(q.id)} className="p-1.5 rounded hover:bg-surface-100 text-amber-600">
                                                            <Send className="h-4 w-4" />
                                                        </button>
                                                    )}
                                                    {canSend && isInternallyApproved && (
                                                        <button title="Enviar ao Cliente" onClick={() => sendMut.mutate(q.id)} className="p-1.5 rounded hover:bg-surface-100 text-blue-600">
                                                            <Send className="h-4 w-4" />
                                                        </button>
                                                    )}
                                                    <button title="Exportar para Auvo" onClick={() => exportQuote.mutate(q.id)} className="p-1.5 rounded hover:bg-surface-100 text-cyan-600" disabled={exportQuote.isPending}>
                                                        <UploadCloud className="h-4 w-4" />
                                                    </button>
                                                    {canApprove && isSent && (
                                                        <button title="Aprovar" onClick={() => approveMut.mutate(q.id)} className="p-1.5 rounded hover:bg-surface-100 text-green-600">
                                                            <CheckCircle className="h-4 w-4" />
                                                        </button>
                                                    )}
                                                    {canUpdate && isApproved && (
                                                        <button title="Converter em OS" onClick={() => convertMut.mutate(q.id)} className="p-1.5 rounded hover:bg-surface-100 text-violet-600">
                                                            <ArrowRightLeft className="h-4 w-4" />
                                                        </button>
                                                    )}
                                                    {canUpdate && (isRejected || isExpired) && (
                                                        <button title="Reabrir" onClick={() => reopenMut.mutate(q.id)} className="p-1.5 rounded hover:bg-surface-100 text-amber-600">
                                                            <RefreshCw className="h-4 w-4" />
                                                        </button>
                                                    )}
                                                    {canCreate && (
                                                        <button title="Duplicar" onClick={() => duplicateMut.mutate(q.id)} className="p-1.5 rounded hover:bg-surface-100 text-content-secondary">
                                                            <Copy className="h-4 w-4" />
                                                        </button>
                                                    )}
                                                    {canDelete && isMutable && (
                                                        <button title="Excluir" onClick={() => setDeleteTarget(q)} className="p-1.5 rounded hover:bg-red-50 text-red-600">
                                                            <Trash2 className="h-4 w-4" />
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    )
                                })
                            )}
                        </tbody>
                    </table>
                </div>

                {pagination && pagination.last_page > 1 && (
                    <div className="flex items-center justify-between px-4 py-3 border-t border-default">
                        <span className="text-sm text-content-secondary">
                            Mostrando {pagination.from}–{pagination.to} de {pagination.total}
                        </span>
                        <div className="flex gap-1">
                            {Array.from({ length: pagination.last_page }, (_, i) => i + 1).slice(
                                Math.max(0, page - 3), Math.min(pagination.last_page, page + 2)
                            ).map((p) => (
                                <button
                                    key={p}
                                    onClick={() => setPage(p)}
                                    className={`px-3 py-1 rounded text-sm ${page === p ? 'bg-brand-600 text-white' : 'hover:bg-surface-100 text-content-secondary'}`}
                                >
                                    {p}
                                </button>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {deleteTarget && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setDeleteTarget(null)}>
                    <div className="bg-surface-0 rounded-xl p-6 max-w-sm mx-4 shadow-elevated" onClick={(e) => e.stopPropagation()}>
                        <h3 className="text-lg font-semibold text-content-primary mb-2">Excluir Orçamento</h3>
                        <p className="text-content-secondary text-sm mb-6">
                            Tem certeza que deseja excluir o orçamento <strong>{deleteTarget.quote_number}</strong>? Esta ação não pode ser desfeita.
                        </p>
                        <div className="flex gap-3 justify-end">
                            <Button variant="outline" size="sm" onClick={() => setDeleteTarget(null)}>Cancelar</Button>
                            <Button
                                variant="danger"
                                size="sm"
                                onClick={() => deleteMut.mutate(deleteTarget.id)}
                                disabled={deleteMut.isPending}
                            >
                                {deleteMut.isPending ? 'Excluindo...' : 'Excluir'}
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
