import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { crmFeaturesApi, CrmInteractiveProposal } from '@/lib/crm-features-api'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { PageHeader } from '@/components/ui/pageheader'
import { toast } from 'sonner'
import {
    FileText, Plus, Search, Copy, Eye, Clock, Loader2, AlertCircle,
    CheckCircle, XCircle, ExternalLink, Send,
} from 'lucide-react'

const fmtBRL = (v: number | string) =>
    Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const fmtDate = (d: string | null) =>
    d ? new Date(d).toLocaleDateString('pt-BR') : '—'
const fmtTime = (seconds: number) => {
    if (seconds < 60) return `${seconds}s`
    if (seconds < 3600) return `${Math.floor(seconds / 60)}min`
    return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}min`
}

const STATUS_MAP: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
    draft: { label: 'Rascunho', variant: 'secondary' },
    sent: { label: 'Enviada', variant: 'default' },
    viewed: { label: 'Visualizada', variant: 'outline' },
    accepted: { label: 'Aceita', variant: 'default' },
    rejected: { label: 'Rejeitada', variant: 'destructive' },
    expired: { label: 'Expirada', variant: 'secondary' },
}

export function CrmProposalsPage() {
    const queryClient = useQueryClient()
    const [search, setSearch] = useState('')
    const [createOpen, setCreateOpen] = useState(false)
    const [quoteId, setQuoteId] = useState('')
    const [dealId, setDealId] = useState('')
    const [expiresAt, setExpiresAt] = useState('')

    const { data: res, isLoading, isError, refetch } = useQuery({
        queryKey: ['crm-proposals'],
        queryFn: () => crmFeaturesApi.getProposals(),
    })

    const proposals: CrmInteractiveProposal[] = Array.isArray(res?.data) ? res.data : (res?.data as { data?: CrmInteractiveProposal[] })?.data ?? []

    const createMutation = useMutation({
        mutationFn: (data: { quote_id: number; deal_id?: number; expires_at?: string }) =>
            crmFeaturesApi.createProposal(data),
        onSuccess: () => {
            toast.success('Proposta criada com sucesso!')
            queryClient.invalidateQueries({ queryKey: ['crm-proposals'] })
            setCreateOpen(false)
            resetForm()
        },
        onError: (error: any) => {
            const message = error?.response?.data?.message || 'Erro ao criar proposta. Tente novamente.'
            toast.error(message)
        },
    })

    function resetForm() {
        setQuoteId('')
        setDealId('')
        setExpiresAt('')
    }

    function handleCreate() {
        if (!quoteId || isNaN(Number(quoteId))) {
            toast.error('Informe um ID de orçamento válido.')
            return
        }
        createMutation.mutate({
            quote_id: Number(quoteId),
            deal_id: dealId ? Number(dealId) : undefined,
            expires_at: expiresAt || undefined,
        })
    }

    function copyLink(token: string) {
        const url = `${window.location.origin}/propostas/${token}`
        navigator.clipboard.writeText(url).then(
            () => toast.success('Link copiado para a área de transferência!'),
            () => toast.error('Erro ao copiar link.'),
        )
    }

    const filtered = proposals.filter((p) => {
        if (!search) return true
        const q = search.toLowerCase()
        return (
            p.quote?.quote_number?.toLowerCase().includes(q) ||
            p.deal?.title?.toLowerCase().includes(q) ||
            p.token?.toLowerCase().includes(q) ||
            STATUS_MAP[p.status]?.label.toLowerCase().includes(q)
        )
    })

    const totalViews = proposals.reduce((s, p) => s + (p.view_count ?? 0), 0)
    const acceptedCount = proposals.filter((p) => p.status === 'accepted').length
    const avgTimeSpent =
        proposals.length > 0
            ? proposals.reduce((s, p) => s + (p.time_spent_seconds ?? 0), 0) / proposals.length
            : 0

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-20">
                <Loader2 className="h-8 w-8 animate-spin text-primary-500" />
            </div>
        )
    }

    if (isError) {
        return (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
                <AlertCircle className="h-10 w-10 text-red-500" />
                <p className="text-surface-600">Erro ao carregar propostas.</p>
                <Button variant="outline" onClick={() => refetch()}>Tentar novamente</Button>
            </div>
        )
    }

    return (
        <div className="space-y-6">
            <PageHeader
                title="Propostas Interativas"
                subtitle="Gerencie propostas com rastreamento de visualização e interação."
                icon={FileText}
            >
                <Dialog open={createOpen} onOpenChange={(open) => { setCreateOpen(open); if (!open) resetForm() }}>
                    <DialogTrigger asChild>
                        <Button variant="primary" size="sm" icon={<Plus className="h-4 w-4" />}>
                            Nova Proposta
                        </Button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Criar Proposta a partir de Orçamento</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4 mt-4">
                            <div>
                                <label className="text-sm font-medium text-surface-700 mb-1 block">
                                    ID do Orçamento *
                                </label>
                                <Input
                                    type="number"
                                    placeholder="Ex: 123"
                                    value={quoteId}
                                    onChange={(e) => setQuoteId(e.target.value)}
                                />
                            </div>
                            <div>
                                <label className="text-sm font-medium text-surface-700 mb-1 block">
                                    ID do Negócio (opcional)
                                </label>
                                <Input
                                    type="number"
                                    placeholder="Ex: 456"
                                    value={dealId}
                                    onChange={(e) => setDealId(e.target.value)}
                                />
                            </div>
                            <div>
                                <label className="text-sm font-medium text-surface-700 mb-1 block">
                                    Data de Expiração (opcional)
                                </label>
                                <Input
                                    type="date"
                                    value={expiresAt}
                                    onChange={(e) => setExpiresAt(e.target.value)}
                                />
                            </div>
                            <div className="flex justify-end gap-2 pt-2">
                                <Button variant="outline" onClick={() => setCreateOpen(false)}>
                                    Cancelar
                                </Button>
                                <Button
                                    variant="primary"
                                    onClick={handleCreate}
                                    disabled={createMutation.isPending}
                                    icon={createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                                >
                                    {createMutation.isPending ? 'Criando...' : 'Criar Proposta'}
                                </Button>
                            </div>
                        </div>
                    </DialogContent>
                </Dialog>
            </PageHeader>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Card>
                    <CardContent className="pt-6">
                        <div className="flex items-start justify-between">
                            <div>
                                <p className="text-sm text-surface-500">Total de Propostas</p>
                                <p className="text-2xl font-bold mt-1">{proposals.length}</p>
                            </div>
                            <div className="rounded-lg p-2.5 text-blue-600 bg-blue-50">
                                <FileText className="h-5 w-5" />
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="pt-6">
                        <div className="flex items-start justify-between">
                            <div>
                                <p className="text-sm text-surface-500">Visualizações Totais</p>
                                <p className="text-2xl font-bold mt-1">{totalViews}</p>
                                <p className="text-xs text-surface-400 mt-1">
                                    Tempo médio: {fmtTime(Math.round(avgTimeSpent))}
                                </p>
                            </div>
                            <div className="rounded-lg p-2.5 text-green-600 bg-green-50">
                                <Eye className="h-5 w-5" />
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="pt-6">
                        <div className="flex items-start justify-between">
                            <div>
                                <p className="text-sm text-surface-500">Aceitas</p>
                                <p className="text-2xl font-bold mt-1">{acceptedCount}</p>
                                <p className="text-xs text-surface-400 mt-1">
                                    Taxa: {proposals.length ? ((acceptedCount / proposals.length) * 100).toFixed(1) : 0}%
                                </p>
                            </div>
                            <div className="rounded-lg p-2.5 text-purple-600 bg-purple-50">
                                <CheckCircle className="h-5 w-5" />
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            <Card>
                <CardHeader>
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                        <CardTitle className="flex items-center gap-2">
                            <FileText className="h-5 w-5" />
                            Propostas
                        </CardTitle>
                        <div className="relative w-full sm:w-72">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-surface-400" />
                            <Input
                                placeholder="Buscar proposta..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                className="pl-9"
                            />
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    {!filtered.length ? (
                        <div className="flex flex-col items-center py-10 text-surface-400">
                            <FileText className="h-10 w-10 mb-2" />
                            <p>{search ? 'Nenhuma proposta encontrada para a busca.' : 'Nenhuma proposta cadastrada. Crie a primeira!'}</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b text-left text-surface-500">
                                        <th className="pb-3 pr-4 font-medium">Orçamento</th>
                                        <th className="pb-3 pr-4 font-medium">Negócio</th>
                                        <th className="pb-3 pr-4 font-medium">Status</th>
                                        <th className="pb-3 pr-4 font-medium text-right">Valor</th>
                                        <th className="pb-3 pr-4 font-medium text-center">Visualizações</th>
                                        <th className="pb-3 pr-4 font-medium text-center">Tempo</th>
                                        <th className="pb-3 pr-4 font-medium">Expira em</th>
                                        <th className="pb-3 font-medium text-right">Ações</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filtered.map((proposal) => {
                                        const st = STATUS_MAP[proposal.status] ?? { label: proposal.status, variant: 'secondary' as const }
                                        return (
                                            <tr key={proposal.id} className="border-b last:border-0 hover:bg-surface-50">
                                                <td className="py-3 pr-4">
                                                    <span className="font-medium">
                                                        {proposal.quote?.quote_number ?? `#${proposal.quote_id}`}
                                                    </span>
                                                </td>
                                                <td className="py-3 pr-4 text-surface-600">
                                                    {proposal.deal?.title ?? '—'}
                                                </td>
                                                <td className="py-3 pr-4">
                                                    <Badge variant={st.variant}>{st.label}</Badge>
                                                </td>
                                                <td className="py-3 pr-4 text-right tabular-nums">
                                                    {proposal.quote?.total != null ? fmtBRL(proposal.quote.total) : '—'}
                                                </td>
                                                <td className="py-3 pr-4 text-center">
                                                    <div className="flex items-center justify-center gap-1">
                                                        <Eye className="h-3.5 w-3.5 text-surface-400" />
                                                        <span className="tabular-nums">{proposal.view_count}</span>
                                                    </div>
                                                </td>
                                                <td className="py-3 pr-4 text-center">
                                                    <div className="flex items-center justify-center gap-1">
                                                        <Clock className="h-3.5 w-3.5 text-surface-400" />
                                                        <span className="tabular-nums">
                                                            {fmtTime(proposal.time_spent_seconds)}
                                                        </span>
                                                    </div>
                                                </td>
                                                <td className="py-3 pr-4 text-surface-600">
                                                    {fmtDate(proposal.expires_at)}
                                                </td>
                                                <td className="py-3 text-right">
                                                    <div className="flex items-center justify-end gap-1">
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={() => copyLink(proposal.token)}
                                                            title="Copiar link"
                                                        >
                                                            <Copy className="h-4 w-4" />
                                                        </Button>
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={() => window.open(`/propostas/${proposal.token}`, '_blank')}
                                                            title="Abrir proposta"
                                                        >
                                                            <ExternalLink className="h-4 w-4" />
                                                        </Button>
                                                    </div>
                                                </td>
                                            </tr>
                                        )
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}
