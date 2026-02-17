import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
    FileText,
    Plus,
    Download,
    XCircle,
    Search,
    Filter,
    RefreshCw,
    CheckCircle2,
    Clock,
    AlertTriangle,
    Ban,
} from 'lucide-react'
import api from '@/lib/api'
import { toast } from 'sonner'
import { useAuthStore } from '@/stores/auth-store'
import { PageHeader } from '@/components/ui/pageheader'
import FiscalEmitirDialog from './FiscalEmitirDialog'

interface FiscalNote {
    id: number
    type: 'nfe' | 'nfse'
    number: string | null
    series: string | null
    access_key: string | null
    status: 'pending' | 'authorized' | 'cancelled' | 'rejected'
    provider: string
    total_amount: string
    issued_at: string | null
    cancelled_at: string | null
    error_message: string | null
    pdf_url: string | null
    xml_url?: string | null
    customer?: { id: number; name: string }
    work_order?: { id: number; number: string } | null
    creator?: { id: number; name: string }
    created_at: string
}

const STATUS_CONFIG = {
    pending: { label: 'Pendente', icon: Clock, color: 'text-amber-600 bg-amber-50 border-amber-200' },
    authorized: { label: 'Autorizada', icon: CheckCircle2, color: 'text-emerald-600 bg-emerald-50 border-emerald-200' },
    cancelled: { label: 'Cancelada', icon: Ban, color: 'text-surface-500 bg-surface-50 border-surface-200' },
    rejected: { label: 'Rejeitada', icon: AlertTriangle, color: 'text-red-600 bg-red-50 border-red-200' },
}

export default function FiscalNotesPage() {
  const { hasPermission } = useAuthStore()

    const { user } = useAuthStore()
    const queryClient = useQueryClient()
    const [search, setSearch] = useState('')
    const [typeFilter, setTypeFilter] = useState<string>('')
    const [statusFilter, setStatusFilter] = useState<string>('')
    const [showEmitir, setShowEmitir] = useState<'nfe' | 'nfse' | null>(null)
    const [page, setPage] = useState(1)

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

    const canCreate = user?.all_permissions?.includes('fiscal.note.create')
    const canCancel = user?.all_permissions?.includes('fiscal.note.cancel')

    return (
        <div className="space-y-6">
            <PageHeader
                title="Notas Fiscais"
                subtitle={`${total} nota${total !== 1 ? 's' : ''} encontrada${total !== 1 ? 's' : ''}`}
                icon={FileText}
                actions={
                    canCreate ? (
                        <div className="flex gap-2">
                            <button
                                onClick={() => setShowEmitir('nfe')}
                                className="flex items-center gap-2 px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 transition-colors text-sm font-medium"
                            >
                                <Plus className="w-4 h-4" />
                                Emitir NF-e
                            </button>
                            <button
                                onClick={() => setShowEmitir('nfse')}
                                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm font-medium"
                            >
                                <Plus className="w-4 h-4" />
                                Emitir NFS-e
                            </button>
                        </div>
                    ) : undefined
                }
            />

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
                    <option value="cancelled">Cancelada</option>
                    <option value="rejected">Rejeitada</option>
                </select>

                {isFetching && <RefreshCw className="w-5 h-5 text-brand-500 animate-spin self-center" />}
            </div>

            {/* Table */}
            {isLoading ? (
                <div className="space-y-3">
                    {[...Array(5)].map((_, i) => (
                        <div key={i} className="h-16 bg-surface-100 rounded-lg animate-pulse" />
                    ))}
                </div>
            ) : notes.length === 0 ? (
                <div className="text-center py-16">
                    <FileText className="w-16 h-16 text-surface-300 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold text-surface-700">
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
                                <tr className="border-b border-border bg-surface-50">
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
                                    const statusCfg = STATUS_CONFIG[note.status]
                                    const StatusIcon = statusCfg.icon
                                    return (
                                        <tr key={note.id} className="hover:bg-surface-50 dark:hover:bg-surface-800/30 transition-colors">
                                            <td className="px-4 py-3">
                                                <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold ${note.type === 'nfe'
                                                    ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                                                    : 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400'
                                                    }`}>
                                                    {note.type.toUpperCase()}
                                                </span>
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
                                    className="px-3 py-1.5 text-sm rounded-md border border-surface-200 hover:bg-surface-50 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    Anterior
                                </button>
                                <button
                                    disabled={page >= totalPages}
                                    onClick={() => setPage(p => p + 1)}
                                    className="px-3 py-1.5 text-sm rounded-md border border-surface-200 hover:bg-surface-50 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    Próxima
                                </button>
                            </div>
                        </div>
                    )}
                </div>
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
