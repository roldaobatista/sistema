import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate } from 'react-router-dom'
import {
    Search, Plus, FileText, Clock, User, AlertTriangle,
    Filter, ChevronDown, ChevronLeft, ChevronRight, RefreshCw, Download, Trash2,
} from 'lucide-react'
import api from '@/lib/api'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { IconButton } from '@/components/ui/iconbutton'
import { Badge } from '@/components/ui/badge'
import { Modal } from '@/components/ui/modal'
import { PageHeader } from '@/components/ui/pageheader'
import { EmptyState } from '@/components/ui/emptystate'
import { useAuthStore } from '@/stores/auth-store'
import { toast } from 'sonner'

const statusConfig: Record<string, { label: string; variant: any; dot?: boolean }> = {
    open: { label: 'Aberta', variant: 'info', dot: true },
    in_progress: { label: 'Em Andamento', variant: 'warning', dot: true },
    waiting_parts: { label: 'Aguard. PeÃ§as', variant: 'warning' },
    waiting_approval: { label: 'Aguard. AprovaÃ§Ã£o', variant: 'brand' },
    completed: { label: 'ConcluÃ­da', variant: 'success', dot: true },
    delivered: { label: 'Entregue', variant: 'success' },
    invoiced: { label: 'Faturada', variant: 'brand' },
    cancelled: { label: 'Cancelada', variant: 'danger' },
}

const priorityConfig: Record<string, { label: string; variant: any }> = {
    low: { label: 'Baixa', variant: 'default' },
    normal: { label: 'Normal', variant: 'info' },
    high: { label: 'Alta', variant: 'warning' },
    urgent: { label: 'Urgente', variant: 'danger' },
}

interface WorkOrder {
    id: number; number: string; os_number?: string | null; business_number?: string | null; status: string; priority: string
    description: string; total: string; created_at: string
    customer: { id: number; name: string; phone: string | null }
    assignee: { id: number; name: string } | null
    equipment: { id: number; type: string; brand: string | null; model: string | null } | null
}
const woIdentifier = (wo?: { number: string; os_number?: string | null; business_number?: string | null } | null) =>
    wo?.business_number ?? wo?.os_number ?? wo?.number ?? 'â€”'

export function WorkOrdersListPage() {
    const navigate = useNavigate()
    const qc = useQueryClient()
    const [search, setSearch] = useState('')
    const [statusFilter, setStatusFilter] = useState('')
    const [priorityFilter, setPriorityFilter] = useState('')
    const [dateFrom, setDateFrom] = useState('')
    const [dateTo, setDateTo] = useState('')
    const [showFilters, setShowFilters] = useState(false)
    const [page, setPage] = useState(1)
    const [deleteId, setDeleteId] = useState<number | null>(null)
    const { hasPermission } = useAuthStore()

    const { data: res, isLoading, isError, refetch } = useQuery({
        queryKey: ['work-orders', search, statusFilter, priorityFilter, dateFrom, dateTo, page],
        queryFn: () => api.get('/work-orders', {
            params: {
                search, status: statusFilter || undefined, priority: priorityFilter || undefined,
                date_from: dateFrom || undefined, date_to: dateTo || undefined,
                per_page: 20, page,
            },
        }),
    })
    const orders: WorkOrder[] = res?.data?.data ?? []
    const totalPages = res?.data?.last_page ?? 1

    const formatDate = (d: string) => new Date(d).toLocaleDateString('pt-BR', {
        day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit',
    })

    const formatBRL = (v: string) => parseFloat(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

    // Status stats â€” from backend status_counts (global, not paginated)
    const statusCounts: Record<string, number> = res?.data?.status_counts ?? {}
    const totalRecords = res?.data?.total ?? 0
    const openCount = statusCounts['open'] ?? 0
    const progressCount = statusCounts['in_progress'] ?? 0
    const waitingCount = (statusCounts['waiting_parts'] ?? 0) + (statusCounts['waiting_approval'] ?? 0)

    // Reset page when filters change
    const handleSearch = (val: string) => { setSearch(val); setPage(1) }
    const handleStatusFilter = (val: string) => { setStatusFilter(val); setPage(1) }
    const handlePriorityFilter = (val: string) => { setPriorityFilter(val); setPage(1) }

    // Delete mutation
    const deleteMut = useMutation({
        mutationFn: (id: number) => api.delete(`/work-orders/${id}`),
        onSuccess: () => {
            toast.success('OS excluÃ­da com sucesso')
            qc.invalidateQueries({ queryKey: ['work-orders'] })
            setDeleteId(null)
        },
        onError: (err: any) => {
            toast.error(err?.response?.data?.message || 'Erro ao excluir OS')
            setDeleteId(null)
        },
    })

    // Export CSV
    const handleExport = async () => {
        try {
            const response = await api.get('/work-orders-export', {
                params: {
                    status: statusFilter || undefined, priority: priorityFilter || undefined,
                    date_from: dateFrom || undefined, date_to: dateTo || undefined,
                },
                responseType: 'blob',
            })
            const url = window.URL.createObjectURL(new Blob([response.data]))
            const link = document.createElement('a')
            link.href = url
            link.setAttribute('download', `os_export_${new Date().toISOString().slice(0, 10)}.csv`)
            document.body.appendChild(link)
            link.click()
            link.remove()
            window.URL.revokeObjectURL(url)
            toast.success('ExportaÃ§Ã£o concluÃ­da')
        } catch {
            toast.error('Erro ao exportar CSV')
        }
    }

    return (
        <div className="space-y-5">
            {/* Header */}
            <PageHeader
                title="Ordens de ServiÃ§o"
                subtitle="Gerencie suas ordens de serviÃ§o"
                count={totalRecords}
                actions={[
                    ...(hasPermission('os.work_order.export') ? [{ label: 'Exportar', onClick: handleExport, icon: <Download className="h-4 w-4" />, variant: 'outline' as const }] : []),
                    ...(hasPermission('os.work_order.create') ? [{ label: 'Nova OS', onClick: () => navigate('/os/nova'), icon: <Plus className="h-4 w-4" /> }] : []),
                ]}
            />

            {/* Quick Stats */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {[
                    { label: 'Abertas', value: openCount, color: 'bg-sky-50 text-sky-700 border-sky-200' },
                    { label: 'Em Andamento', value: progressCount, color: 'bg-amber-50 text-amber-700 border-amber-200' },
                    { label: 'Aguardando', value: waitingCount, color: 'bg-brand-50 text-brand-700 border-brand-200' },
                    { label: 'Total', value: totalRecords, color: 'bg-surface-50 text-surface-700 border-surface-200' },
                ].map(s => (
                    <div key={s.label} className={cn('rounded-xl border p-3 text-center', s.color)}>
                        <p className="text-2xl font-bold">{s.value}</p>
                        <p className="text-xs font-medium mt-0.5">{s.label}</p>
                    </div>
                ))}
            </div>

            {/* Status flow bar â€” uses global status_counts */}
            {Object.keys(statusCounts).length > 0 && (() => {
                const groups = Object.entries(statusConfig).map(([k, v]) => ({
                    key: k, label: v.label, count: statusCounts[k] ?? 0,
                })).filter(g => g.count > 0)
                const gtotal = groups.reduce((s, g) => s + g.count, 0)
                const colors: Record<string, string> = {
                    open: 'bg-sky-500', in_progress: 'bg-amber-500', waiting_parts: 'bg-amber-300',
                    waiting_approval: 'bg-brand-400', completed: 'bg-emerald-500', delivered: 'bg-emerald-300',
                    invoiced: 'bg-brand-500', cancelled: 'bg-red-400',
                }
                return (
                    <div className="rounded-xl border border-default bg-surface-0 p-4 shadow-card">
                        <div className="flex h-5 overflow-hidden rounded-full">
                            {groups.map(g => (
                                <div key={g.key} className={cn('transition-all', colors[g.key] ?? 'bg-surface-300')}
                                    style={{ width: `${(g.count / gtotal) * 100}%` }} />
                            ))}
                        </div>
                        <div className="mt-2 flex flex-wrap gap-3">
                            {groups.map(g => (
                                <span key={g.key} className="flex items-center gap-1 text-xs text-surface-600">
                                    <span className={cn('h-2 w-2 rounded-full', colors[g.key] ?? 'bg-surface-300')} />
                                    {g.label}: <strong>{g.count}</strong> ({Math.round((g.count / gtotal) * 100)}%)
                                </span>
                            ))}
                        </div>
                    </div>
                )
            })()}

            {/* Search & Filters */}
            <div className="flex flex-col gap-3 sm:flex-row">
                <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-surface-400" />
                    <input type="text" value={search} onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleSearch(e.target.value)}
                        placeholder="Buscar OS, cliente..."
                        className="w-full rounded-lg border border-default bg-surface-50 py-2.5 pl-10 pr-4 text-sm focus:border-brand-400 focus:bg-surface-0 focus:outline-none focus:ring-2 focus:ring-brand-500/15" />
                </div>
                <div className="flex gap-2">
                    <select value={statusFilter} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => handleStatusFilter(e.target.value)}
                        aria-label="Filtrar por status"
                        className="cursor-pointer rounded-lg border border-default bg-surface-50 px-3 py-2 text-sm focus:border-brand-400 focus:bg-surface-0 focus:outline-none focus:ring-2 focus:ring-brand-500/15">
                        <option value="">Todos os status</option>
                        {Object.entries(statusConfig).map(([k, v]) => (
                            <option key={k} value={k}>{v.label}</option>
                        ))}
                    </select>
                    <select value={priorityFilter} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => handlePriorityFilter(e.target.value)}
                        aria-label="Filtrar por prioridade"
                        className="cursor-pointer rounded-lg border border-default bg-surface-50 px-3 py-2 text-sm focus:border-brand-400 focus:bg-surface-0 focus:outline-none focus:ring-2 focus:ring-brand-500/15">
                        <option value="">Todas prioridades</option>
                        {Object.entries(priorityConfig).map(([k, v]) => (
                            <option key={k} value={k}>{v.label}</option>
                        ))}
                    </select>
                    <input type="date" value={dateFrom} onChange={(e: React.ChangeEvent<HTMLInputElement>) => { setDateFrom(e.target.value); setPage(1) }}
                        className="rounded-lg border border-default bg-surface-50 px-3 py-2 text-sm focus:border-brand-400 focus:bg-surface-0 focus:outline-none focus:ring-2 focus:ring-brand-500/15" title="Data inÃ­cio" />
                    <input type="date" value={dateTo} onChange={(e: React.ChangeEvent<HTMLInputElement>) => { setDateTo(e.target.value); setPage(1) }}
                        className="rounded-lg border border-default bg-surface-50 px-3 py-2 text-sm focus:border-brand-400 focus:bg-surface-0 focus:outline-none focus:ring-2 focus:ring-brand-500/15" title="Data fim" />
                </div>
            </div>

            {/* OS Cards/List */}
            <div className="space-y-3">
                {isLoading ? (
                    <div className="space-y-3">
                        {[1, 2, 3, 4, 5].map(i => (
                            <div key={i} className="animate-pulse rounded-xl border border-default bg-surface-0 p-4 shadow-card">
                                <div className="flex items-start justify-between gap-4">
                                    <div className="flex-1 space-y-2">
                                        <div className="flex items-center gap-2">
                                            <div className="h-4 w-20 rounded bg-surface-200" />
                                            <div className="h-5 w-24 rounded-full bg-surface-200" />
                                        </div>
                                        <div className="h-4 w-3/4 rounded bg-surface-100" />
                                        <div className="flex gap-4">
                                            <div className="h-3 w-28 rounded bg-surface-100" />
                                            <div className="h-3 w-20 rounded bg-surface-100" />
                                        </div>
                                    </div>
                                    <div className="space-y-1 text-right">
                                        <div className="h-4 w-20 rounded bg-surface-200 ml-auto" />
                                        <div className="h-3 w-24 rounded bg-surface-100 ml-auto" />
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : isError ? (
                    <div className="py-16 text-center">
                        <RefreshCw className="mx-auto h-12 w-12 text-red-300" />
                        <p className="mt-3 text-[13px] text-surface-500">Erro ao carregar ordens de serviÃ§o</p>
                        <Button className="mt-3" variant="outline" onClick={() => refetch()}>Tentar novamente</Button>
                    </div>
                ) : orders.length === 0 ? (
                    <EmptyState
                        icon={<FileText className="h-5 w-5 text-surface-300" />}
                        message="Nenhuma OS encontrada"
                        action={hasPermission('os.work_order.create') ? { label: 'Criar primeira OS', onClick: () => navigate('/os/nova'), icon: <Plus className="h-4 w-4" /> } : undefined}
                    />
                ) : orders.map(order => (
                    <Link
                        key={order.id}
                        to={`/os/${order.id}`}
                        className="group block rounded-xl border border-default bg-surface-0 p-4 shadow-card hover:shadow-elevated hover:border-brand-200 transition-all duration-200"
                    >
                        <div className="flex items-start justify-between gap-4">
                            {/* Left */}
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                    <span className="text-sm font-bold text-brand-600">{woIdentifier(order)}</span>
                                    <Badge variant={statusConfig[order.status]?.variant ?? 'default'} dot={statusConfig[order.status]?.dot}>
                                        {statusConfig[order.status]?.label ?? order.status}
                                    </Badge>
                                    {order.priority !== 'normal' && (
                                        <Badge variant={priorityConfig[order.priority]?.variant ?? 'default'}>
                                            {order.priority === 'urgent' && <AlertTriangle className="h-3 w-3 mr-0.5" />}
                                            {priorityConfig[order.priority]?.label}
                                        </Badge>
                                    )}
                                </div>
                                <p className="mt-1.5 text-sm text-surface-700 truncate">{order.description}</p>
                                <div className="mt-2 flex items-center gap-4 text-xs text-surface-500">
                                    <span className="flex items-center gap-1">
                                        <User className="h-3 w-3" /> {order.customer.name}
                                    </span>
                                    {order.equipment && (
                                        <span>{order.equipment.type} {order.equipment.brand ?? ''}</span>
                                    )}
                                    {order.assignee && (
                                        <span className="flex items-center gap-1">
                                            â†’ {order.assignee.name}
                                        </span>
                                    )}
                                </div>
                            </div>
                            {/* Right */}
                            <div className="flex items-start gap-2">
                                <div className="text-right shrink-0">
                                    <p className="text-sm font-semibold text-surface-900">{formatBRL(order.total)}</p>
                                    <p className="mt-1 flex items-center justify-end gap-1 text-xs text-surface-400">
                                        <Clock className="h-3 w-3" /> {formatDate(order.created_at)}
                                    </p>
                                </div>
                                {hasPermission('os.work_order.delete') && (
                                    <IconButton
                                        label="Excluir OS"
                                        icon={<Trash2 className="h-4 w-4" />}
                                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setDeleteId(order.id) }}
                                        className="opacity-0 group-hover:opacity-100 hover:bg-red-50 hover:text-red-500"
                                    />
                                )}
                            </div>
                        </div>
                    </Link>
                ))}
            </div>

            {/* Pagination */}
            {!isLoading && !isError && totalPages > 1 && (
                <div className="flex items-center justify-between rounded-xl border border-default bg-surface-0 px-4 py-3 shadow-card">
                    <p className="text-xs text-surface-500">
                        PÃ¡gina {page} de {totalPages} â€” {res?.data?.total ?? 0} registros
                    </p>
                    <div className="flex gap-2">
                        <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}
                            icon={<ChevronLeft className="h-4 w-4" />}>Anterior</Button>
                        <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}
                            icon={<ChevronRight className="h-4 w-4" />}>PrÃ³ximo</Button>
                    </div>
                </div>
            )}

            {/* Delete Confirmation Modal */}
            <Modal open={deleteId !== null} onOpenChange={(open) => { if (!open) setDeleteId(null) }} title="Confirmar ExclusÃ£o">
                <div className="space-y-4">
                    <p className="text-sm text-surface-600">Tem certeza que deseja excluir esta OS? Esta aÃ§Ã£o nÃ£o pode ser desfeita.</p>
                    <div className="flex justify-end gap-2">
                        <Button variant="outline" onClick={() => setDeleteId(null)}>Cancelar</Button>
                        <Button
                            variant="danger"
                            onClick={() => { if (deleteId) { if (window.confirm('Deseja realmente excluir este registro?')) deleteMut.mutate(deleteId) } }}
                            loading={deleteMut.isPending}
                        >
                            Excluir
                        </Button>
                    </div>
                </div>
            </Modal>
        </div>
    )
}