import { useState , useMemo } from 'react'
import { toast } from 'sonner'
import { useQuery , useMutation, useQueryClient } from '@tanstack/react-query'
import { Search, Download, Eye, X, Clock, User, FileText, ArrowUpDown, Loader2, Minus, Plus, ChevronLeft, ChevronRight } from 'lucide-react'
import { format } from 'date-fns'
import api from '@/lib/api'
import { useAuthStore } from '@/stores/auth-store'

interface AuditEntry {
    id: number
    action: string
    auditable_type: string | null
    auditable_id: number | null
    description: string
    old_values: Record<string, unknown> | null
    new_values: Record<string, unknown> | null
    ip_address: string | null
    user: { id: number; name: string } | null
    created_at: string
}

interface DiffItem {
    field: string
    old: unknown
    new: unknown
}

const ACTION_COLORS: Record<string, string> = {
    created: 'bg-emerald-100 text-emerald-700',
    updated: 'bg-amber-100 text-amber-700',
    deleted: 'bg-red-100 text-red-700',
    login: 'bg-blue-100 text-blue-700',
    logout: 'bg-surface-100 text-surface-600',
    status_changed: 'bg-indigo-100 text-indigo-700',
}

const ACTION_LABELS: Record<string, string> = {
    created: 'Criado',
    updated: 'Atualizado',
    deleted: 'Excluído',
    login: 'Login',
    logout: 'Logout',
    status_changed: 'Status Alterado',
}

export function AuditLogPage() {

  // MVP: Delete mutation
  const queryClient = useQueryClient()
  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/audit-log/${id}`),
    onSuccess: () => { toast.success('Removido com sucesso');
                queryClient.invalidateQueries({ queryKey: ['audit-log'] }) },
    onError: (err: any) => { toast.error(err?.response?.data?.message || 'Erro ao remover') },
  })
  const handleDelete = (id: number) => { if (window.confirm('Tem certeza que deseja remover?')) deleteMutation.mutate(id) }
  const { hasPermission } = useAuthStore()

    const [action, setAction] = useState('')
    const [entityType, setEntityType] = useState('')
    const [search, setSearch] = useState('')
    const [from, setFrom] = useState('')
    const [to, setTo] = useState('')
    const [page, setPage] = useState(1)
    const [selectedEntry, setSelectedEntry] = useState<number | null>(null)

    const { data: actions } = useQuery<string[]>({
        queryKey: ['audit-actions'],
        queryFn: async () => {
            const res = await api.get('/audit-logs/actions')
            return res.data.data
        },
    })

    const { data: entityTypes } = useQuery<{ value: string; label: string }[]>({
        queryKey: ['audit-entity-types'],
        queryFn: async () => {
            const res = await api.get('/audit-logs/entity-types')
            return res.data.data
        },
    })

    const { data: logsData, isLoading } = useQuery({
        queryKey: ['audit-logs', action, entityType, search, from, to, page],
        queryFn: async () => {
            const params: Record<string, string | number> = { page, per_page: 20 }
            if (action) params.action = action
            if (entityType) params.auditable_type = entityType
            if (search) params.search = search
            if (from) params.from = from
            if (to) params.to = to
            const res = await api.get('/audit-logs', { params })
            return res.data
        },
    })

    const { data: detailData } = useQuery({
        queryKey: ['audit-log-detail', selectedEntry],
        queryFn: async () => {
            if (!selectedEntry) return null
            const res = await api.get(`/audit-logs/${selectedEntry}`)
            return res.data
        },
        enabled: !!selectedEntry,
    })

    const handleExport = async () => {
        const params: Record<string, string> = {}
        if (action) params.action = action
        if (entityType) params.auditable_type = entityType
        if (from) params.from = from
        if (to) params.to = to
        const res = await api.post('/audit-logs/export', params, { responseType: 'blob' })
        const url = window.URL.createObjectURL(new Blob([res.data]))
        const link = document.createElement('a')
        link.href = url
        link.setAttribute('download', 'audit_log.csv')
        document.body.appendChild(link)
        link.click()
        link.remove()
        window.URL.revokeObjectURL(url)
    }

    const logs: AuditEntry[] = logsData?.data ?? []
    const lastPage = logsData?.last_page ?? 1

    return (
        <div className="space-y-5">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-lg font-semibold text-surface-900 tracking-tight">Log de Auditoria</h1>
                    <p className="text-sm text-surface-500 mt-1">Rastreamento de todas as alterações no sistema</p>
                </div>
                <button
                    onClick={handleExport}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-brand-600 text-white hover:bg-brand-700 transition-colors"
                >
                    <Download className="w-4 h-4" />
                    Exportar CSV
                </button>
            </div>

            <div className="flex flex-wrap items-end gap-3 bg-surface-0 rounded-xl border border-default p-4">
                <div className="flex-1 min-w-[200px]">
                    <label className="block text-xs font-medium text-surface-500 mb-1">Buscar</label>
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400" />
                        <input
                            type="text"
                            value={search}
                            onChange={e => { setSearch(e.target.value); setPage(1) }}
                            placeholder="Pesquisar na descrição..."
                            className="w-full pl-10 pr-3 py-2 rounded-lg border border-default text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                        />
                    </div>
                </div>
                <div>
                    <label className="block text-xs font-medium text-surface-500 mb-1">Ação</label>
                    <select
                        value={action}
                        onChange={e => { setAction(e.target.value); setPage(1) }}
                        className="px-3 py-2 rounded-lg border border-default text-sm"
                    >
                        <option value="">Todas</option>
                        {actions?.map(a => (
                            <option key={a} value={a}>{ACTION_LABELS[a] ?? a}</option>
                        ))}
                    </select>
                </div>
                <div>
                    <label className="block text-xs font-medium text-surface-500 mb-1">Entidade</label>
                    <select
                        value={entityType}
                        onChange={e => { setEntityType(e.target.value); setPage(1) }}
                        className="px-3 py-2 rounded-lg border border-default text-sm"
                    >
                        <option value="">Todas</option>
                        {entityTypes?.map(t => (
                            <option key={t.value} value={t.value}>{t.label}</option>
                        ))}
                    </select>
                </div>
                <div>
                    <label className="block text-xs font-medium text-surface-500 mb-1">De</label>
                    <input type="date" value={from} onChange={e => { setFrom(e.target.value); setPage(1) }} className="px-3 py-2 rounded-lg border border-default text-sm" />
                </div>
                <div>
                    <label className="block text-xs font-medium text-surface-500 mb-1">Até</label>
                    <input type="date" value={to} onChange={e => { setTo(e.target.value); setPage(1) }} className="px-3 py-2 rounded-lg border border-default text-sm" />
                </div>
            </div>

            <div className="bg-surface-0 rounded-xl border border-default overflow-hidden">
                {isLoading ? (
                    <div className="flex justify-center py-12">
                        <Loader2 className="w-6 h-6 animate-spin text-surface-400" />
                    </div>
                ) : (
                    <table className="min-w-full divide-y divide-subtle">
                        <thead className="bg-surface-50">
                            <tr>
                                <th className="px-3.5 py-2.5 text-left text-xs font-medium text-surface-500 uppercase">
                                    <div className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" />Data</div>
                                </th>
                                <th className="px-3.5 py-2.5 text-left text-xs font-medium text-surface-500 uppercase">
                                    <div className="flex items-center gap-1"><User className="w-3.5 h-3.5" />Usuário</div>
                                </th>
                                <th className="px-3.5 py-2.5 text-left text-xs font-medium text-surface-500 uppercase">
                                    <div className="flex items-center gap-1"><ArrowUpDown className="w-3.5 h-3.5" />Ação</div>
                                </th>
                                <th className="px-3.5 py-2.5 text-left text-xs font-medium text-surface-500 uppercase">
                                    <div className="flex items-center gap-1"><FileText className="w-3.5 h-3.5" />Descrição</div>
                                </th>
                                <th className="px-3.5 py-2.5 text-right text-xs font-medium text-surface-500 uppercase">Detalhes</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-subtle">
                            {logs.map(entry => (
                                <tr key={entry.id} className="hover:bg-surface-50 transition-colors duration-100">
                                    <td className="px-4 py-3 text-sm text-surface-600 whitespace-nowrap">
                                        {format(new Date(entry.created_at), 'dd/MM/yyyy HH:mm')}
                                    </td>
                                    <td className="px-4 py-3 text-sm text-surface-700">
                                        {entry.user?.name ?? 'Sistema'}
                                    </td>
                                    <td className="px-4 py-3">
                                        <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${ACTION_COLORS[entry.action] ?? 'bg-surface-100 text-surface-600'}`}>
                                            {ACTION_LABELS[entry.action] ?? entry.action}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 text-sm text-surface-600 max-w-md truncate">
                                        {entry.description}
                                    </td>
                                    <td className="px-3.5 py-2.5 text-right">
                                        {(entry.old_values || entry.new_values) && (
                                            <button
                                                onClick={() => setSelectedEntry(entry.id)}
                                                className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded-md bg-brand-50 text-brand-600 hover:bg-brand-100 transition-colors"
                                            >
                                                <Eye className="w-3.5 h-3.5" />
                                                Ver Diff
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            ))}
                            {logs.length === 0 && (
                                <tr>
                                    <td colSpan={5} className="px-4 py-12 text-center text-sm text-surface-400">
                                        Nenhum registro encontrado.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                )}

                {lastPage > 1 && (
                    <div className="flex items-center justify-between px-4 py-3 border-t border-subtle">
                        <span className="text-sm text-surface-500">Página {page} de {lastPage}</span>
                        <div className="flex gap-2">
                            <button
                                onClick={() => setPage(p => Math.max(1, p - 1))}
                                disabled={page <= 1}
                                className="p-1.5 rounded-md border border-default disabled:opacity-50 hover:bg-surface-50"
                            >
                                <ChevronLeft className="w-4 h-4" />
                            </button>
                            <button
                                onClick={() => setPage(p => Math.min(lastPage, p + 1))}
                                disabled={page >= lastPage}
                                className="p-1.5 rounded-md border border-default disabled:opacity-50 hover:bg-surface-50"
                            >
                                <ChevronRight className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {selectedEntry && detailData && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
                    <div className="bg-surface-0 rounded-2xl shadow-xl w-full max-w-2xl max-h-[80vh] overflow-hidden">
                        <div className="flex items-center justify-between px-6 py-4 border-b border-subtle">
                            <h2 className="text-lg font-semibold text-surface-900">Diff de Alterações</h2>
                            <button onClick={() => setSelectedEntry(null)} className="p-1 rounded-md hover:bg-surface-100">
                                <X className="w-5 h-5 text-surface-400" />
                            </button>
                        </div>
                        <div className="p-6 overflow-y-auto max-h-[60vh]">
                            <p className="text-sm text-surface-500 mb-4">{detailData.data.description}</p>
                            {(detailData.diff as DiffItem[])?.length > 0 ? (
                                <div className="space-y-2">
                                    {(detailData.diff as DiffItem[]).map((d: DiffItem, i: number) => (
                                        <div key={i} className="rounded-lg border border-subtle p-2.5">
                                            <span className="text-xs font-mono font-semibold text-surface-700">{d.field}</span>
                                            <div className="mt-2 grid grid-cols-2 gap-3 text-sm">
                                                <div className="flex items-start gap-2">
                                                    <Minus className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
                                                    <span className="text-red-700 bg-red-50 px-2 py-1 rounded font-mono break-all">
                                                        {d.old !== null && d.old !== undefined ? String(d.old) : <em className="text-surface-400">null</em>}
                                                    </span>
                                                </div>
                                                <div className="flex items-start gap-2">
                                                    <Plus className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" />
                                                    <span className="text-emerald-700 bg-emerald-50 px-2 py-1 rounded font-mono break-all">
                                                        {d.new !== null && d.new !== undefined ? String(d.new) : <em className="text-surface-400">null</em>}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-sm text-surface-400">Sem alterações detalhadas disponíveis.</p>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
