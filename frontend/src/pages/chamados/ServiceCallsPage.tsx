import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useDebounce } from '@/hooks/useDebounce'
import { useNavigate } from 'react-router-dom'
import {
    Plus, Search, Phone, MapPin, AlertTriangle, Pencil, Trash2,
    Map, Calendar, Download, ChevronLeft, ChevronRight,
} from 'lucide-react'
import api from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Modal } from '@/components/ui/modal'
import { EmptyState } from '@/components/ui/emptystate'
import { PageHeader } from '@/components/ui/pageheader'
import { useAuthStore } from '@/stores/auth-store'
import { toast } from 'sonner'
import { serviceCallStatus, priorityConfig, getStatusEntry } from '@/lib/status-config'
import { cn } from '@/lib/utils'

export function ServiceCallsPage() {
    const navigate = useNavigate()
    const queryClient = useQueryClient()
    const { hasPermission, hasRole } = useAuthStore()
    const [search, setSearch] = useState('')
    const [statusFilter, setStatusFilter] = useState('')
    const [priorityFilter, setPriorityFilter] = useState('')
    const [technicianFilter, setTechnicianFilter] = useState('')
    const [dateFrom, setDateFrom] = useState('')
    const [dateTo, setDateTo] = useState('')
    const [page, setPage] = useState(1)
    const perPage = 30
    const debouncedSearch = useDebounce(search, 300)

    const [deleteTarget, setDeleteTarget] = useState<any>(null)

    const { data: assigneesRes } = useQuery({
        queryKey: ['service-call-assignees'],
        queryFn: () => api.get('/service-calls-assignees').then((r) => r.data),
    })

    const { data, isLoading } = useQuery({
        queryKey: ['service-calls', debouncedSearch, statusFilter, priorityFilter, technicianFilter, dateFrom, dateTo, page],
        queryFn: () =>
            api.get('/service-calls', {
                params: {
                    search: debouncedSearch || undefined,
                    status: statusFilter || undefined,
                    priority: priorityFilter || undefined,
                    technician_id: technicianFilter || undefined,
                    date_from: dateFrom || undefined,
                    date_to: dateTo || undefined,
                    page,
                    per_page: perPage,
                },
            }).then((r) => r.data),
    })

    const technicians = assigneesRes?.technicians ?? []

    const { data: summary } = useQuery({
        queryKey: ['service-calls-summary'],
        queryFn: () => api.get('/service-calls-summary').then((r) => r.data),
    })

    const deleteMutation = useMutation({
        mutationFn: (id: number) => api.delete(`/service-calls/${id}`),
        onSuccess: () => {
            toast.success('Chamado excluído com sucesso')
            queryClient.invalidateQueries({ queryKey: ['service-calls'] })
            queryClient.invalidateQueries({ queryKey: ['service-calls-summary'] })
            setDeleteTarget(null)
        },
        onError: (error: any) => {
            if (error.response?.status === 409) {
                toast.error(error.response.data?.message || 'Chamado possui OS vinculada')
            } else if (error.response?.status === 403) {
                toast.error('Sem permissão para excluir')
            } else {
                toast.error(error.response?.data?.message || 'Erro ao excluir chamado')
            }
            setDeleteTarget(null)
        },
    })

    const handleExport = async () => {
        try {
            const { data } = await api.get('/service-calls-export', {
                params: {
                    status: statusFilter || undefined,
                    priority: priorityFilter || undefined,
                    technician_id: technicianFilter || undefined,
                    date_from: dateFrom || undefined,
                    date_to: dateTo || undefined,
                },
            })
            const blob = new Blob([data.csv], { type: 'text/csv;charset=utf-8;' })
            const url = URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = data.filename
            a.click()
            URL.revokeObjectURL(url)
            toast.success('Exportação concluída')
        } catch {
            toast.error('Erro ao exportar')
        }
    }

    const calls = data?.data ?? []
    const pagination = data ? { current_page: data.current_page, last_page: data.last_page, total: data.total } : null

    const canCreate = hasRole('super_admin') || hasPermission('service_calls.service_call.create')
    const canUpdate = hasRole('super_admin') || hasPermission('service_calls.service_call.update')
    const canDelete = hasRole('super_admin') || hasPermission('service_calls.service_call.delete')

    return (
        <div className="space-y-6">
            <PageHeader
                title="Chamados Técnicos"
                count={pagination?.total}
                actions={[
                    { label: 'Mapa', icon: <Map className="h-4 w-4" />, variant: 'outline', onClick: () => navigate('/chamados/mapa') },
                    { label: 'Agenda', icon: <Calendar className="h-4 w-4" />, variant: 'outline', onClick: () => navigate('/chamados/agenda') },
                    { label: 'CSV', icon: <Download className="h-4 w-4" />, variant: 'outline', onClick: handleExport },
                    ...(canCreate ? [{ label: 'Novo Chamado', icon: <Plus className="h-4 w-4" />, onClick: () => navigate('/chamados/novo') }] : []),
                ]}
            />

            {summary && (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                    {[
                        { label: 'Abertos', value: summary.open, color: 'text-sky-600 bg-sky-50' },
                        { label: 'Agendados', value: summary.scheduled, color: 'text-amber-600 bg-amber-50' },
                        { label: 'Em Trânsito', value: summary.in_transit, color: 'text-indigo-600 bg-indigo-50' },
                        { label: 'Em Atendimento', value: summary.in_progress, color: 'text-orange-600 bg-orange-50' },
                        { label: 'Concluídos Hoje', value: summary.completed_today, color: 'text-emerald-600 bg-emerald-50' },
                        { label: 'SLA Estourado', value: summary.sla_breached_active, color: 'text-red-600 bg-red-50' },
                    ].map((item) => (
                        <div key={item.label} className={cn('rounded-xl p-3', item.color)}>
                            <p className="text-xs font-medium opacity-70">{item.label}</p>
                            <p className="text-xl font-bold tabular-nums">{item.value ?? 0}</p>
                        </div>
                    ))}
                </div>
            )}

            <div className="flex flex-col sm:flex-row sm:flex-wrap gap-3">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-surface-400" />
                    <input
                        type="text"
                        placeholder="Buscar por número ou cliente..."
                        value={search}
                        onChange={(e) => { setSearch(e.target.value); setPage(1) }}
                        className="w-full pl-10 pr-4 py-2 rounded-lg border border-default bg-surface-0 text-sm text-surface-900 placeholder:text-surface-400 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-500/15"
                    />
                </div>
                <select
                    aria-label="Filtrar por status"
                    value={statusFilter}
                    onChange={(e) => { setStatusFilter(e.target.value); setPage(1) }}
                    className="px-3 py-2 rounded-lg border border-default bg-surface-0 text-sm text-surface-700 focus:outline-none focus:ring-2 focus:ring-brand-500/15"
                >
                    <option value="">Todos os status</option>
                    {Object.entries(serviceCallStatus).map(([k, v]) => (
                        <option key={k} value={k}>{v.label}</option>
                    ))}
                </select>
                <select
                    aria-label="Filtrar por prioridade"
                    value={priorityFilter}
                    onChange={(e) => { setPriorityFilter(e.target.value); setPage(1) }}
                    className="px-3 py-2 rounded-lg border border-default bg-surface-0 text-sm text-surface-700 focus:outline-none focus:ring-2 focus:ring-brand-500/15"
                >
                    <option value="">Todas as prioridades</option>
                    {Object.entries(priorityConfig).map(([k, v]) => (
                        <option key={k} value={k}>{v.label}</option>
                    ))}
                </select>
                <select
                    aria-label="Filtrar por técnico"
                    value={technicianFilter}
                    onChange={(e) => { setTechnicianFilter(e.target.value); setPage(1) }}
                    className="px-3 py-2 rounded-lg border border-default bg-surface-0 text-sm text-surface-700 focus:outline-none focus:ring-2 focus:ring-brand-500/15"
                >
                    <option value="">Todos os técnicos</option>
                    {technicians.map((t: { id: number; name: string }) => (
                        <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                </select>
                <input
                    type="date"
                    aria-label="Data inicial"
                    value={dateFrom}
                    onChange={(e) => { setDateFrom(e.target.value); setPage(1) }}
                    className="px-3 py-2 rounded-lg border border-default bg-surface-0 text-sm text-surface-700 focus:outline-none focus:ring-2 focus:ring-brand-500/15"
                />
                <input
                    type="date"
                    aria-label="Data final"
                    value={dateTo}
                    onChange={(e) => { setDateTo(e.target.value); setPage(1) }}
                    className="px-3 py-2 rounded-lg border border-default bg-surface-0 text-sm text-surface-700 focus:outline-none focus:ring-2 focus:ring-brand-500/15"
                />
            </div>

            <div className="rounded-xl border border-default bg-surface-0 shadow-card overflow-hidden">
                {isLoading ? (
                    <div className="divide-y divide-subtle">
                        {Array.from({ length: 8 }).map((_, i) => (
                            <div key={i} className="flex items-center gap-4 p-4 animate-pulse">
                                <div className="h-4 w-20 rounded bg-surface-200" />
                                <div className="h-4 w-40 rounded bg-surface-100" />
                                <div className="h-4 w-24 rounded bg-surface-100" />
                                <div className="h-4 w-20 rounded bg-surface-100" />
                                <div className="h-4 rounded bg-surface-100 flex-1" />
                            </div>
                        ))}
                    </div>
                ) : calls.length === 0 ? (
                    <EmptyState
                        icon={Phone}
                        title="Nenhum chamado encontrado"
                        description={search || statusFilter || priorityFilter || technicianFilter || dateFrom || dateTo ? 'Tente alterar os filtros' : 'Crie seu primeiro chamado'}
                        action={canCreate && !search && !statusFilter && !priorityFilter && !technicianFilter && !dateFrom && !dateTo ? {
                            label: 'Novo Chamado',
                            onClick: () => navigate('/chamados/novo'),
                            icon: <Plus className="h-4 w-4" />,
                        } : undefined}
                    />
                ) : (
                    <>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead className="bg-surface-50">
                                    <tr>
                                        <th className="text-left px-4 py-3 text-xs font-medium text-surface-500">Nº</th>
                                        <th className="text-left px-4 py-3 text-xs font-medium text-surface-500">Cliente</th>
                                        <th className="text-left px-4 py-3 text-xs font-medium text-surface-500">Status</th>
                                        <th className="text-left px-4 py-3 text-xs font-medium text-surface-500">Prioridade</th>
                                        <th className="text-left px-4 py-3 text-xs font-medium text-surface-500">SLA</th>
                                        <th className="text-left px-4 py-3 text-xs font-medium text-surface-500">Técnico</th>
                                        <th className="text-left px-4 py-3 text-xs font-medium text-surface-500">Cidade</th>
                                        <th className="text-left px-4 py-3 text-xs font-medium text-surface-500">Agendado</th>
                                        <th className="text-left px-4 py-3 text-xs font-medium text-surface-500">Criado em</th>
                                        <th className="text-right px-4 py-3 text-xs font-medium text-surface-500">Ações</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-subtle">
                                    {calls.map((call: any) => {
                                        const sc = getStatusEntry(serviceCallStatus, call.status)
                                        const pc = priorityConfig[call.priority]
                                        const StatusIcon = sc.icon
                                        return (
                                            <tr
                                                key={call.id}
                                                className="hover:bg-surface-50 cursor-pointer transition-colors"
                                                onClick={() => navigate(`/chamados/${call.id}`)}
                                            >
                                                <td className="px-4 py-3 font-mono text-xs font-semibold text-surface-900">{call.call_number}</td>
                                                <td className="px-4 py-3 font-medium text-surface-900">{call.customer?.name || '—'}</td>
                                                <td className="px-4 py-3">
                                                    <Badge variant={sc.variant}>
                                                        <StatusIcon className="h-3 w-3" />
                                                        {sc.label}
                                                    </Badge>
                                                </td>
                                                <td className="px-4 py-3">
                                                    <Badge variant={pc?.variant || 'default'}>{pc?.label || call.priority}</Badge>
                                                </td>
                                                <td className="px-4 py-3">
                                                    {call.sla_breached ? (
                                                        <Badge variant="danger">
                                                            <AlertTriangle className="h-3 w-3" /> Estourado
                                                        </Badge>
                                                    ) : call.status !== 'completed' && call.status !== 'cancelled' ? (
                                                        <Badge variant="success">OK</Badge>
                                                    ) : (
                                                        <span className="text-surface-400">—</span>
                                                    )}
                                                </td>
                                                <td className="px-4 py-3 text-surface-600">
                                                    {call.technician?.name || (
                                                        <span className="text-surface-400 italic">Não atribuído</span>
                                                    )}
                                                </td>
                                                <td className="px-4 py-3 text-surface-600">
                                                    {call.city ? `${call.city}/${call.state}` : '—'}
                                                </td>
                                                <td className="px-4 py-3 text-surface-600 tabular-nums">
                                                    {call.scheduled_date
                                                        ? new Date(call.scheduled_date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })
                                                        : '—'}
                                                </td>
                                                <td className="px-4 py-3 text-surface-600 tabular-nums">
                                                    {call.created_at
                                                        ? new Date(call.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' })
                                                        : '—'}
                                                </td>
                                                <td className="px-4 py-3 text-right">
                                                    <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                                                        {canUpdate && (
                                                            <button
                                                                onClick={() => navigate(`/chamados/${call.id}/editar`)}
                                                                className="p-1.5 text-surface-400 hover:text-brand-600 rounded-lg hover:bg-brand-50 transition-colors"
                                                                title="Editar"
                                                            >
                                                                <Pencil className="h-4 w-4" />
                                                            </button>
                                                        )}
                                                        {canDelete && (
                                                            <button
                                                                onClick={() => setDeleteTarget(call)}
                                                                className="p-1.5 text-surface-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors"
                                                                title="Excluir"
                                                            >
                                                                <Trash2 className="h-4 w-4" />
                                                            </button>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        )
                                    })}
                                </tbody>
                            </table>
                        </div>

                        {pagination && pagination.last_page > 1 && (
                            <div className="flex items-center justify-between px-4 py-3 border-t border-subtle">
                                <p className="text-sm text-surface-500">
                                    Página {pagination.current_page} de {pagination.last_page}
                                </p>
                                <div className="flex gap-2">
                                    <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
                                        <ChevronLeft className="h-4 w-4" />
                                    </Button>
                                    <Button variant="outline" size="sm" disabled={page >= pagination.last_page} onClick={() => setPage((p) => p + 1)}>
                                        <ChevronRight className="h-4 w-4" />
                                    </Button>
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>

            <Modal
                open={!!deleteTarget}
                onOpenChange={(open) => !open && setDeleteTarget(null)}
                title="Excluir Chamado"
            >
                <div className="space-y-4">
                    <p className="text-sm text-surface-600">
                        Tem certeza que deseja excluir o chamado <strong>{deleteTarget?.call_number}</strong>?
                        Esta ação não pode ser desfeita.
                    </p>
                    <div className="flex justify-end gap-3">
                        <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancelar</Button>
                        <Button
                            variant="danger"
                            loading={deleteMutation.isPending}
                            onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
                        >
                            Excluir
                        </Button>
                    </div>
                </div>
            </Modal>
        </div>
    )
}
