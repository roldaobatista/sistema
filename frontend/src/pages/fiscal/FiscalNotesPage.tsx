import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
    FileText,
    Plus,
    Download,
    XCircle,
    Search,
    RefreshCw,
    CheckCircle2,
    Clock,
    AlertTriangle,
    Ban,
    Mail,
    Eye,
    WifiOff,
    Wifi,
    Send,
    Edit3,
    ChevronDown,
    ChevronUp,
    BarChart3,
} from 'lucide-react'
import api from '@/lib/api'
import { toast } from 'sonner'
import { useAuthStore } from '@/stores/auth-store'
import { PageHeader } from '@/components/ui/pageheader'
import FiscalEmitirDialog from './FiscalEmitirDialog'
import FiscalDetailPanel from './FiscalDetailPanel'
import FiscalDashboard from './FiscalDashboard'

interface FiscalNote {
    id: number
    type: 'nfe' | 'nfse'
    number: string | null
    series: string | null
    access_key: string | null
    reference: string | null
    status: 'pending' | 'processing' | 'authorized' | 'cancelled' | 'rejected'
    provider: string
    total_amount: string
    contingency_mode: boolean
    verification_code: string | null
    issued_at: string | null
    cancelled_at: string | null
    error_message: string | null
    pdf_url: string | null
    pdf_path: string | null
    xml_url: string | null
    xml_path: string | null
    nature_of_operation?: string | null
    cfop?: string | null
    cancel_reason?: string | null
    environment?: string | null
    protocol_number?: string | null
    customer?: { id: number; name: string; email?: string }
    work_order?: { id: number; number: string } | null
    quote?: { id: number } | null
    creator?: { id: number; name: string }
    created_at: string
}

const STATUS_CONFIG: Record<string, { label: string; icon: any; color: string }> = {
    pending: { label: 'Pendente', icon: Clock, color: 'text-amber-600 bg-amber-50 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800' },
    processing: { label: 'Processando', icon: RefreshCw, color: 'text-blue-600 bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800' },
    authorized: { label: 'Autorizada', icon: CheckCircle2, color: 'text-emerald-600 bg-emerald-50 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800' },
    cancelled: { label: 'Cancelada', icon: Ban, color: 'text-surface-500 bg-surface-50 border-surface-200 dark:bg-surface-800 dark:text-surface-400 dark:border-surface-700' },
    rejected: { label: 'Rejeitada', icon: AlertTriangle, color: 'text-red-600 bg-red-50 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800' },
}

export default function FiscalNotesPage() {
    const { user } = useAuthStore()
    const queryClient = useQueryClient()
    const [search, setSearch] = useState('')
    const [typeFilter, setTypeFilter] = useState<string>('')
    const [statusFilter, setStatusFilter] = useState<string>('')
    const [showEmitir, setShowEmitir] = useState<'nfe' | 'nfse' | null>(null)
    const [page, setPage] = useState(1)
    const [selectedNote, setSelectedNote] = useState<FiscalNote | null>(null)
    const [showDashboard, setShowDashboard] = useState(false)
    const [emailNoteId, setEmailNoteId] = useState<number | null>(null)
    const [emailAddress, setEmailAddress] = useState('')
    const [ccText, setCcText] = useState('')
    const [ccNoteId, setCcNoteId] = useState<number | null>(null)

    // Main query
    const { data, isLoading, isFetching } = useQuery({
        queryKey: ['fiscal-notes', { search, type: typeFilter, status: statusFilter, page }],
        queryFn: async () => {
            const params = new URLSearchParams()
            if (search) params.set('search', search)
            if (typeFilter) params.set('type', typeFilter)
            if (statusFilter) params.set('status', statusFilter)
            params.set('page', String(page))
            params.set('per_page', '20')
            const { data } = await api.get(`/fiscal/notas?${params}`)
            return data
        },
    })

    // Contingency status
    const { data: contingencyData } = useQuery({
        queryKey: ['fiscal-contingency-status'],
        queryFn: async () => {
            const { data } = await api.get('/fiscal/contingency/status')
            return data
        },
        refetchInterval: 60_000,
    })

    // Cancel mutation
    const cancelMutation = useMutation({
        mutationFn: async ({ id, justificativa }: { id: number; justificativa: string }) => {
            return api.post(`/fiscal/notas/${id}/cancelar`, { justificativa })
        },
        onSuccess: () => {
            toast.success('Nota cancelada com sucesso')
            queryClient.invalidateQueries({ queryKey: ['fiscal-notes'] })
        },
        onError: (error: any) => {
            toast.error(error.response?.data?.message || 'Erro ao cancelar nota')
        },
    })

    // Email mutation
    const emailMutation = useMutation({
        mutationFn: async ({ id, email }: { id: number; email?: string }) => {
            return api.post(`/fiscal/notas/${id}/email`, { email: email || undefined })
        },
        onSuccess: (_, vars) => {
            toast.success('Documentos enviados por e-mail')
            setEmailNoteId(null)
            setEmailAddress('')
        },
        onError: (error: any) => {
            toast.error(error.response?.data?.message || 'Erro ao enviar e-mail')
        },
    })

    // Carta de correção mutation
    const ccMutation = useMutation({
        mutationFn: async ({ id, texto }: { id: number; texto: string }) => {
            return api.post(`/fiscal/notas/${id}/carta-correcao`, { correcao: texto })
        },
        onSuccess: () => {
            toast.success('Carta de correção emitida com sucesso')
            setCcNoteId(null)
            setCcText('')
            queryClient.invalidateQueries({ queryKey: ['fiscal-notes'] })
        },
        onError: (error: any) => {
            toast.error(error.response?.data?.message || 'Erro na carta de correção')
        },
    })

    // Retransmit contingency
    const retransmitMutation = useMutation({
        mutationFn: async () => {
            return api.post('/fiscal/contingency/retransmit')
        },
        onSuccess: ({ data }) => {
            toast.success(`Retransmissão: ${data.success}/${data.total} notas enviadas`)
            queryClient.invalidateQueries({ queryKey: ['fiscal-notes'] })
            queryClient.invalidateQueries({ queryKey: ['fiscal-contingency-status'] })
        },
        onError: (error: any) => {
            toast.error(error.response?.data?.message || 'Erro na retransmissão')
        },
    })

    const handleCancel = (note: FiscalNote) => {
        const justificativa = window.prompt('Justificativa para cancelamento (mínimo 15 caracteres):')
        if (!justificativa || justificativa.length < 15) {
            toast.error('Justificativa deve ter no mínimo 15 caracteres')
            return
        }
        cancelMutation.mutate({ id: note.id, justificativa })
    }

    const handleDownloadPdf = async (note: FiscalNote) => {
        try {
            if (note.pdf_url) {
                window.open(note.pdf_url, '_blank')
                return
            }
            const { data } = await api.get(`/fiscal/notas/${note.id}/pdf`)
            if (data.pdf_base64) {
                const blob = new Blob([Uint8Array.from(atob(data.pdf_base64), c => c.charCodeAt(0))], { type: 'application/pdf' })
                const url = URL.createObjectURL(blob)
                window.open(url, '_blank')
            } else if (data.url) {
                window.open(data.url, '_blank')
            }
        } catch {
            toast.error('Erro ao baixar PDF')
        }
    }

    const handleDownloadXml = async (note: FiscalNote) => {
        try {
            if (note.xml_url) {
                window.open(note.xml_url, '_blank')
                return
            }
            const { data } = await api.get(`/fiscal/notas/${note.id}/xml`)
            if (data.xml) {
                const blob = new Blob([data.xml], { type: 'text/xml' })
                const url = URL.createObjectURL(blob)
                const a = document.createElement('a')
                a.href = url
                a.download = `nota-${note.number || note.id}.xml`
                a.click()
            } else if (data.url) {
                window.open(data.url, '_blank')
            }
        } catch {
            toast.error('Erro ao baixar XML')
        }
    }

    const notes: FiscalNote[] = data?.data ?? []
    const totalPages = data?.last_page ?? 1
    const total = data?.total ?? 0
    const pendingContingency = contingencyData?.pending_count ?? 0
    const sefazOk = contingencyData?.sefaz_available ?? true

    const canCreate = user?.all_permissions?.includes('fiscal.note.create')
    const canCancel = user?.all_permissions?.includes('fiscal.note.cancel')

    return (
        <div className="space-y-6">
            <PageHeader
                title="Notas Fiscais"
                subtitle={`${total} nota${total !== 1 ? 's' : ''} encontrada${total !== 1 ? 's' : ''}`}
                icon={FileText}
                actions={
                    <div className="flex items-center gap-2">
                        {/* SEFAZ Status Indicator */}
                        <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border ${sefazOk
                            ? 'text-emerald-600 bg-emerald-50 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400'
                            : 'text-red-600 bg-red-50 border-red-200 dark:bg-red-900/20 dark:text-red-400'
                            }`}>
                            {sefazOk ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
                            {sefazOk ? 'SEFAZ Online' : 'SEFAZ Offline'}
                        </div>

                        {/* Contingency Badge */}
                        {pendingContingency > 0 && (
                            <button
                                onClick={() => retransmitMutation.mutate()}
                                disabled={retransmitMutation.isPending}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border text-amber-600 bg-amber-50 border-amber-200 hover:bg-amber-100 dark:bg-amber-900/20 dark:text-amber-400 transition-colors"
                            >
                                {retransmitMutation.isPending ? (
                                    <RefreshCw className="w-3 h-3 animate-spin" />
                                ) : (
                                    <WifiOff className="w-3 h-3" />
                                )}
                                {pendingContingency} em contingência
                            </button>
                        )}

                        <button
                            onClick={() => setShowDashboard(!showDashboard)}
                            className="flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg border border-border hover:bg-surface-50 dark:hover:bg-surface-800 transition-colors"
                        >
                            <BarChart3 className="w-4 h-4" />
                            {showDashboard ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                        </button>

                        {canCreate && (
                            <>
                                <button
                                    onClick={() => setShowEmitir('nfe')}
                                    className="flex items-center gap-2 px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 transition-colors text-sm font-medium"
                                >
                                    <Plus className="w-4 h-4" />
                                    NF-e
                                </button>
                                <button
                                    onClick={() => setShowEmitir('nfse')}
                                    className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm font-medium"
                                >
                                    <Plus className="w-4 h-4" />
                                    NFS-e
                                </button>
                            </>
                        )}
                    </div>
                }
            />

            {/* Dashboard Toggle */}
            {showDashboard && <FiscalDashboard />}

            {/* Filters */}
            <div className="flex flex-wrap gap-3">
                <div className="relative flex-1 min-w-[240px]">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400" />
                    <input
                        type="text"
                        placeholder="Buscar por número, chave ou cliente..."
                        value={search}
                        onChange={(e) => { setSearch(e.target.value); setPage(1) }}
                        className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-border bg-card text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                    />
                </div>

                <select
                    value={typeFilter}
                    onChange={(e) => { setTypeFilter(e.target.value); setPage(1) }}
                    aria-label="Filtrar por tipo"
                    className="px-3 py-2.5 rounded-lg border border-border bg-card text-sm min-w-[140px]"
                >
                    <option value="">Todos os tipos</option>
                    <option value="nfe">NF-e</option>
                    <option value="nfse">NFS-e</option>
                </select>

                <select
                    value={statusFilter}
                    onChange={(e) => { setStatusFilter(e.target.value); setPage(1) }}
                    aria-label="Filtrar por status"
                    className="px-3 py-2.5 rounded-lg border border-border bg-card text-sm min-w-[160px]"
                >
                    <option value="">Todos os status</option>
                    <option value="authorized">Autorizada</option>
                    <option value="pending">Pendente</option>
                    <option value="processing">Processando</option>
                    <option value="cancelled">Cancelada</option>
                    <option value="rejected">Rejeitada</option>
                </select>

                {isFetching && <RefreshCw className="w-5 h-5 text-brand-500 animate-spin self-center" />}
            </div>

            {/* Table */}
            {isLoading ? (
                <div className="space-y-3">
                    {[...Array(5)].map((_, i) => (
                        <div key={i} className="h-16 bg-surface-100 dark:bg-surface-800 rounded-lg animate-pulse" />
                    ))}
                </div>
            ) : notes.length === 0 ? (
                <div className="text-center py-16">
                    <FileText className="w-16 h-16 text-surface-300 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold text-surface-700 dark:text-surface-300">
                        Nenhuma nota fiscal encontrada
                    </h3>
                    <p className="text-surface-500 mt-1">
                        {search || typeFilter || statusFilter
                            ? 'Tente ajustar os filtros'
                            : 'Emita sua primeira nota fiscal clicando no botão acima'}
                    </p>
                </div>
            ) : (
                <div className="bg-card rounded-xl border border-border overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="border-b border-border bg-surface-50 dark:bg-surface-800/50">
                                    <th className="text-left px-4 py-3 text-xs font-semibold text-surface-500 uppercase tracking-wider">Tipo</th>
                                    <th className="text-left px-4 py-3 text-xs font-semibold text-surface-500 uppercase tracking-wider">Número</th>
                                    <th className="text-left px-4 py-3 text-xs font-semibold text-surface-500 uppercase tracking-wider">Cliente</th>
                                    <th className="text-left px-4 py-3 text-xs font-semibold text-surface-500 uppercase tracking-wider">Status</th>
                                    <th className="text-right px-4 py-3 text-xs font-semibold text-surface-500 uppercase tracking-wider">Valor</th>
                                    <th className="text-left px-4 py-3 text-xs font-semibold text-surface-500 uppercase tracking-wider">Data</th>
                                    <th className="text-right px-4 py-3 text-xs font-semibold text-surface-500 uppercase tracking-wider">Ações</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-surface-100 dark:divide-surface-800">
                                {notes.map((note) => {
                                    const statusCfg = STATUS_CONFIG[note.status] ?? STATUS_CONFIG.pending
                                    const StatusIcon = statusCfg.icon
                                    return (
                                        <tr key={note.id} className="hover:bg-surface-50 dark:hover:bg-surface-800/30 transition-colors">
                                            <td className="px-4 py-3">
                                                <div className="flex items-center gap-1.5">
                                                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold ${note.type === 'nfe'
                                                        ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                                                        : 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400'
                                                        }`}>
                                                        {note.type === 'nfe' ? 'NF-e' : 'NFS-e'}
                                                    </span>
                                                    {note.contingency_mode && (
                                                        <WifiOff className="w-3.5 h-3.5 text-amber-500" aria-label="Em contingência" />
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 text-sm font-mono">
                                                {note.number || '—'}
                                                {note.series && <span className="text-surface-400 ml-1">({note.series})</span>}
                                            </td>
                                            <td className="px-4 py-3 text-sm">{note.customer?.name || '—'}</td>
                                            <td className="px-4 py-3">
                                                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${statusCfg.color}`}>
                                                    <StatusIcon className="w-3 h-3" />
                                                    {statusCfg.label}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-sm text-right font-medium">
                                                {Number(note.total_amount).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                            </td>
                                            <td className="px-4 py-3 text-sm text-surface-500">
                                                {note.issued_at
                                                    ? new Date(note.issued_at).toLocaleDateString('pt-BR')
                                                    : new Date(note.created_at).toLocaleDateString('pt-BR')}
                                            </td>
                                            <td className="px-4 py-3 text-right">
                                                <div className="flex items-center justify-end gap-1">
                                                    {/* Detail view */}
                                                    <button
                                                        onClick={() => setSelectedNote(note)}
                                                        className="p-1.5 rounded-md hover:bg-surface-100 dark:hover:bg-surface-700 text-surface-500 hover:text-brand-600 transition-colors"
                                                        title="Ver detalhes"
                                                        aria-label="Ver detalhes"
                                                    >
                                                        <Eye className="w-4 h-4" />
                                                    </button>

                                                    {note.status === 'authorized' && (
                                                        <>
                                                            <button
                                                                onClick={() => handleDownloadPdf(note)}
                                                                className="p-1.5 rounded-md hover:bg-surface-100 dark:hover:bg-surface-700 text-surface-500 hover:text-brand-600 transition-colors"
                                                                title="Baixar PDF"
                                                                aria-label="Baixar PDF"
                                                            >
                                                                <Download className="w-4 h-4" />
                                                            </button>
                                                            <button
                                                                onClick={() => handleDownloadXml(note)}
                                                                className="p-1.5 rounded-md hover:bg-surface-100 dark:hover:bg-surface-700 text-surface-500 hover:text-indigo-600 transition-colors"
                                                                title="Baixar XML"
                                                                aria-label="Baixar XML"
                                                            >
                                                                <FileText className="w-4 h-4" />
                                                            </button>
                                                            <button
                                                                onClick={() => {
                                                                    setEmailNoteId(note.id)
                                                                    setEmailAddress(note.customer?.email || '')
                                                                }}
                                                                className="p-1.5 rounded-md hover:bg-surface-100 dark:hover:bg-surface-700 text-surface-500 hover:text-emerald-600 transition-colors"
                                                                title="Enviar por e-mail"
                                                                aria-label="Enviar por e-mail"
                                                            >
                                                                <Mail className="w-4 h-4" />
                                                            </button>
                                                            {note.type === 'nfe' && (
                                                                <button
                                                                    onClick={() => setCcNoteId(note.id)}
                                                                    className="p-1.5 rounded-md hover:bg-surface-100 dark:hover:bg-surface-700 text-surface-500 hover:text-orange-600 transition-colors"
                                                                    title="Carta de Correção"
                                                                    aria-label="Carta de Correção"
                                                                >
                                                                    <Edit3 className="w-4 h-4" />
                                                                </button>
                                                            )}
                                                            {canCancel && (
                                                                <button
                                                                    onClick={() => handleCancel(note)}
                                                                    disabled={cancelMutation.isPending}
                                                                    className="p-1.5 rounded-md hover:bg-red-50 dark:hover:bg-red-900/20 text-surface-500 hover:text-red-600 transition-colors"
                                                                    title="Cancelar nota"
                                                                    aria-label="Cancelar nota"
                                                                >
                                                                    <XCircle className="w-4 h-4" />
                                                                </button>
                                                            )}
                                                        </>
                                                    )}
                                                    {note.status === 'rejected' && note.error_message && (
                                                        <span className="text-xs text-red-500 max-w-[200px] truncate" title={note.error_message}>
                                                            {note.error_message}
                                                        </span>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination */}
                    {totalPages > 1 && (
                        <div className="flex items-center justify-between px-4 py-3 border-t border-border">
                            <span className="text-sm text-surface-500">
                                Página {page} de {totalPages} ({total} registros)
                            </span>
                            <div className="flex gap-1">
                                <button
                                    disabled={page <= 1}
                                    onClick={() => setPage(p => Math.max(1, p - 1))}
                                    className="px-3 py-1.5 text-sm rounded-md border border-surface-200 dark:border-surface-700 hover:bg-surface-50 dark:hover:bg-surface-800 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    Anterior
                                </button>
                                <button
                                    disabled={page >= totalPages}
                                    onClick={() => setPage(p => p + 1)}
                                    className="px-3 py-1.5 text-sm rounded-md border border-surface-200 dark:border-surface-700 hover:bg-surface-50 dark:hover:bg-surface-800 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    Próxima
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Email Dialog */}
            {emailNoteId && (
                <div className="fixed inset-0 z-50 flex items-center justify-center">
                    <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setEmailNoteId(null)} />
                    <div className="relative bg-card rounded-xl shadow-2xl w-full max-w-md p-6 space-y-4">
                        <h3 className="text-lg font-semibold">Enviar Nota por E-mail</h3>
                        <div>
                            <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1">
                                E-mail do destinatário
                            </label>
                            <input
                                type="email"
                                value={emailAddress}
                                onChange={(e) => setEmailAddress(e.target.value)}
                                placeholder="email@exemplo.com"
                                className="w-full px-3 py-2.5 rounded-lg border border-border bg-card text-sm focus:ring-2 focus:ring-brand-500"
                            />
                            <p className="text-xs text-surface-400 mt-1">Deixe vazio para usar o e-mail do cliente cadastrado</p>
                        </div>
                        <div className="flex justify-end gap-3">
                            <button
                                onClick={() => setEmailNoteId(null)}
                                className="px-4 py-2 text-sm rounded-lg hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={() => emailMutation.mutate({ id: emailNoteId, email: emailAddress || undefined })}
                                disabled={emailMutation.isPending}
                                className="flex items-center gap-2 px-4 py-2 text-sm bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 transition-colors"
                            >
                                {emailMutation.isPending ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                                Enviar
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Carta de Correção Dialog */}
            {ccNoteId && (
                <div className="fixed inset-0 z-50 flex items-center justify-center">
                    <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setCcNoteId(null)} />
                    <div className="relative bg-card rounded-xl shadow-2xl w-full max-w-md p-6 space-y-4">
                        <h3 className="text-lg font-semibold">Carta de Correção (CC-e)</h3>
                        <div>
                            <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1">
                                Texto da correção <span className="text-red-500">*</span>
                            </label>
                            <textarea
                                value={ccText}
                                onChange={(e) => setCcText(e.target.value)}
                                placeholder="Descreva a correção (mínimo 15 caracteres)..."
                                rows={4}
                                className="w-full px-3 py-2.5 rounded-lg border border-border bg-card text-sm focus:ring-2 focus:ring-brand-500 resize-none"
                            />
                            <p className="text-xs text-surface-400 mt-1">
                                A CC-e não permite alterar: valores, impostos, dados do destinatário ou da mercadoria.
                            </p>
                        </div>
                        <div className="flex justify-end gap-3">
                            <button
                                onClick={() => { setCcNoteId(null); setCcText('') }}
                                className="px-4 py-2 text-sm rounded-lg hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={() => ccMutation.mutate({ id: ccNoteId, texto: ccText })}
                                disabled={ccMutation.isPending || ccText.length < 15}
                                className="flex items-center gap-2 px-4 py-2 text-sm bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50 transition-colors"
                            >
                                {ccMutation.isPending ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Edit3 className="w-4 h-4" />}
                                Emitir CC-e
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Detail Panel */}
            {selectedNote && (
                <FiscalDetailPanel
                    note={selectedNote}
                    onClose={() => setSelectedNote(null)}
                />
            )}

            {/* Emit Dialog */}
            {showEmitir && (
                <FiscalEmitirDialog
                    type={showEmitir}
                    onClose={() => setShowEmitir(null)}
                    onSuccess={() => {
                        setShowEmitir(null)
                        queryClient.invalidateQueries({ queryKey: ['fiscal-notes'] })
                    }}
                />
            )}
        </div>
    )
}
