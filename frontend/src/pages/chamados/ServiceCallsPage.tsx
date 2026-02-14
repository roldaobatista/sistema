import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import {
    Plus, Search, Phone, MapPin, UserCheck, ArrowRight, Trash2,
    AlertCircle, Clock, Truck, CheckCircle, XCircle, Map, Calendar,
    Download, ChevronLeft, ChevronRight, AlertTriangle, Pencil,
} from 'lucide-react'
import api from '@/lib/api'
import { SERVICE_CALL_STATUS } from '@/lib/constants'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Modal } from '@/components/ui/modal'
import { useAuthStore } from '@/stores/auth-store'
import { toast } from 'sonner'

const statusConfig: Record<string, { label: string; variant: any; icon: any }> = {
    [SERVICE_CALL_STATUS.OPEN]: { label: 'Aberto', variant: 'info', icon: AlertCircle },
    [SERVICE_CALL_STATUS.SCHEDULED]: { label: 'Agendado', variant: 'warning', icon: Clock },
    [SERVICE_CALL_STATUS.IN_TRANSIT]: { label: 'Em Trânsito', variant: 'info', icon: Truck },
    [SERVICE_CALL_STATUS.IN_PROGRESS]: { label: 'Em Atendimento', variant: 'warning', icon: ArrowRight },
    [SERVICE_CALL_STATUS.COMPLETED]: { label: 'Concluído', variant: 'success', icon: CheckCircle },
    [SERVICE_CALL_STATUS.CANCELLED]: { label: 'Cancelado', variant: 'danger', icon: XCircle },
}

const priorityConfig: Record<string, { label: string; variant: any }> = {
    low: { label: 'Baixa', variant: 'default' },
    normal: { label: 'Normal', variant: 'info' },
    high: { label: 'Alta', variant: 'warning' },
    urgent: { label: 'Urgente', variant: 'danger' },
}

export function ServiceCallsPage() {
    const navigate = useNavigate()
    const queryClient = useQueryClient()
    const { hasPermission, hasRole } = useAuthStore()
    const [search, setSearch] = useState('')
    const [statusFilter, setStatusFilter] = useState('')
    const [priorityFilter, setPriorityFilter] = useState('')
    const [page, setPage] = useState(1)
    const perPage = 30

    const [deleteTarget, setDeleteTarget] = useState<any>(null)

    const { data, isLoading } = useQuery({
        queryKey: ['service-calls', search, statusFilter, priorityFilter, page],
        queryFn: () =>
            api.get('/service-calls', {
                params: {
                    search: search || undefined,
                    status: statusFilter || undefined,
                    priority: priorityFilter || undefined,
                    page,
                    per_page: perPage,
                },
            }).then((r) => r.data),
    })

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
                params: { status: statusFilter || undefined, priority: priorityFilter || undefined },
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
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                        Chamados Técnicos
                        {pagination && (
                            <span className="ml-2 text-sm font-normal text-gray-500">
                                ({pagination.total} {pagination.total === 1 ? 'registro' : 'registros'})
                            </span>
                        )}
                    </h1>
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => navigate('/chamados/mapa')}>
                        <Map className="w-4 h-4 mr-1" /> Mapa
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => navigate('/chamados/agenda')}>
                        <Calendar className="w-4 h-4 mr-1" /> Agenda
                    </Button>
                    <Button variant="outline" size="sm" onClick={handleExport}>
                        <Download className="w-4 h-4 mr-1" /> CSV
                    </Button>
                    {canCreate && (
                        <Button onClick={() => navigate('/chamados/novo')}>
                            <Plus className="w-4 h-4 mr-1" /> Novo Chamado
                        </Button>
                    )}
                </div>
            </div>

            {/* Summary Cards */}
            {summary && (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                    {[
                        { label: 'Abertos', value: summary.open, color: 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
                        { label: 'Agendados', value: summary.scheduled, color: 'bg-yellow-50 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' },
                        { label: 'Em Trânsito', value: summary.in_transit, color: 'bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400' },
                        { label: 'Em Atendimento', value: summary.in_progress, color: 'bg-orange-50 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' },
                        { label: 'Concluídos Hoje', value: summary.completed_today, color: 'bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400' },
                        { label: 'SLA Estourado', value: summary.sla_breached_active, color: 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
                    ].map((item) => (
                        <div key={item.label} className={`rounded-xl p-3 ${item.color}`}>
                            <p className="text-xs font-medium opacity-80">{item.label}</p>
                            <p className="text-2xl font-bold">{item.value ?? 0}</p>
                        </div>
                    ))}
                </div>
            )}

            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                        type="text"
                        placeholder="Buscar por número ou cliente..."
                        value={search}
                        onChange={(e) => { setSearch(e.target.value); setPage(1) }}
                        className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    />
                </div>
                <select
                    aria-label="Filtrar por status"
                    value={statusFilter}
                    onChange={(e) => { setStatusFilter(e.target.value); setPage(1) }}
                    className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm"
                >
                    <option value="">Todos os status</option>
                    {Object.entries(statusConfig).map(([k, v]) => (
                        <option key={k} value={k}>{v.label}</option>
                    ))}
                </select>
                <select
                    aria-label="Filtrar por prioridade"
                    value={priorityFilter}
                    onChange={(e) => { setPriorityFilter(e.target.value); setPage(1) }}
                    className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm"
                >
                    <option value="">Todas as prioridades</option>
                    {Object.entries(priorityConfig).map(([k, v]) => (
                        <option key={k} value={k}>{v.label}</option>
                    ))}
                </select>
            </div>

            {/* Table */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
                {isLoading ? (
                    <div className="divide-y divide-gray-200 dark:divide-gray-700">
                        {Array.from({ length: 8 }).map((_, i) => (
                            <div key={i} className="flex items-center gap-4 p-4 animate-pulse">
                                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-20" />
                                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-40" />
                                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-24" />
                                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-20" />
                                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded flex-1" />
                            </div>
                        ))}
                    </div>
                ) : calls.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 text-gray-500 dark:text-gray-400">
                        <Phone className="w-12 h-12 mb-4 opacity-30" />
                        <p className="text-lg font-medium">Nenhum chamado encontrado</p>
                        <p className="text-sm mt-1">
                            {search || statusFilter || priorityFilter ? 'Tente alterar os filtros' : 'Crie seu primeiro chamado'}
                        </p>
                        {canCreate && !search && !statusFilter && !priorityFilter && (
                            <Button className="mt-4" onClick={() => navigate('/chamados/novo')}>
                                <Plus className="w-4 h-4 mr-1" /> Novo Chamado
                            </Button>
                        )}
                    </div>
                ) : (
                    <>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead className="bg-gray-50 dark:bg-gray-700/50">
                                    <tr>
                                        <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-400">Nº</th>
                                        <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-400">Cliente</th>
                                        <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-400">Status</th>
                                        <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-400">Prioridade</th>
                                        <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-400">SLA</th>
                                        <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-400">Técnico</th>
                                        <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-400">Cidade</th>
                                        <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-400">Agendado</th>
                                        <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-400">Criado em</th>
                                        <th className="text-right px-4 py-3 font-medium text-gray-600 dark:text-gray-400">Ações</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                                    {calls.map((call: any) => {
                                        const sc = statusConfig[call.status]
                                        const pc = priorityConfig[call.priority]
                                        const StatusIcon = sc?.icon || AlertCircle
                                        return (
                                            <tr
                                                key={call.id}
                                                className="hover:bg-gray-50 dark:hover:bg-gray-700/30 cursor-pointer transition-colors"
                                                onClick={() => navigate(`/chamados/${call.id}`)}
                                            >
                                                <td className="px-4 py-3 font-mono text-xs font-semibold">{call.call_number}</td>
                                                <td className="px-4 py-3 font-medium">{call.customer?.name || '—'}</td>
                                                <td className="px-4 py-3">
                                                    <Badge variant={sc?.variant || 'default'}>
                                                        <StatusIcon className="w-3 h-3 mr-1" />
                                                        {sc?.label || call.status}
                                                    </Badge>
                                                </td>
                                                <td className="px-4 py-3">
                                                    <Badge variant={pc?.variant || 'default'}>{pc?.label || call.priority}</Badge>
                                                </td>
                                                <td className="px-4 py-3">
                                                    {call.sla_breached ? (
                                                        <Badge variant="danger">
                                                            <AlertTriangle className="w-3 h-3 mr-1" /> Estourado
                                                        </Badge>
                                                    ) : call.status !== 'completed' && call.status !== 'cancelled' ? (
                                                        <Badge variant="success">OK</Badge>
                                                    ) : (
                                                        <span className="text-gray-400">—</span>
                                                    )}
                                                </td>
                                                <td className="px-4 py-3 text-gray-600 dark:text-gray-400">
                                                    {call.technician?.name || (
                                                        <span className="text-gray-400 italic">Não atribuído</span>
                                                    )}
                                                </td>
                                                <td className="px-4 py-3 text-gray-600 dark:text-gray-400">
                                                    {call.city ? `${call.city}/${call.state}` : '—'}
                                                </td>
                                                <td className="px-4 py-3 text-gray-600 dark:text-gray-400">
                                                    {call.scheduled_date
                                                        ? new Date(call.scheduled_date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })
                                                        : '—'}
                                                </td>
                                                <td className="px-4 py-3 text-gray-600 dark:text-gray-400">
                                                    {call.created_at
                                                        ? new Date(call.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' })
                                                        : '—'}
                                                </td>
                                                <td className="px-4 py-3 text-right">
                                                    <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                                                        {canUpdate && (
                                                            <button
                                                                onClick={() => navigate(`/chamados/${call.id}/editar`)}
                                                                className="p-1.5 text-gray-400 hover:text-primary-600 rounded-lg hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-colors"
                                                                title="Editar"
                                                            >
                                                                <Pencil className="w-4 h-4" />
                                                            </button>
                                                        )}
                                                        {canDelete && (
                                                            <button
                                                                onClick={() => setDeleteTarget(call)}
                                                                className="p-1.5 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                                                                title="Excluir"
                                                            >
                                                                <Trash2 className="w-4 h-4" />
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

                        {/* Pagination */}
                        {pagination && pagination.last_page > 1 && (
                            <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 dark:border-gray-700">
                                <p className="text-sm text-gray-600 dark:text-gray-400">
                                    Página {pagination.current_page} de {pagination.last_page}
                                </p>
                                <div className="flex gap-2">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        disabled={page <= 1}
                                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                                    >
                                        <ChevronLeft className="w-4 h-4" />
                                    </Button>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        disabled={page >= pagination.last_page}
                                        onClick={() => setPage((p) => p + 1)}
                                    >
                                        <ChevronRight className="w-4 h-4" />
                                    </Button>
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* Delete Confirmation Modal */}
            <Modal
                open={!!deleteTarget}
                onOpenChange={(open) => !open && setDeleteTarget(null)}
                title="Excluir Chamado"
            >
                <div className="space-y-4">
                    <p className="text-gray-600 dark:text-gray-400">
                        Tem certeza que deseja excluir o chamado <strong>{deleteTarget?.call_number}</strong>?
                        Esta ação não pode ser desfeita.
                    </p>
                    <div className="flex justify-end gap-3">
                        <Button variant="outline" onClick={() => setDeleteTarget(null)}>
                            Cancelar
                        </Button>
                        <Button
                            variant="danger"
                            loading={deleteMutation.isPending}
                            onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
                        >
                            <Trash2 className="w-4 h-4 mr-1" /> Excluir
                        </Button>
                    </div>
                </div>
            </Modal>
        </div>
    )
}
