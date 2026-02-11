import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate } from 'react-router-dom'
import {
    Search, Plus, FileText, Clock, User, AlertTriangle,
    Filter, ChevronDown,
} from 'lucide-react'
import api from '@/lib/api'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'

const statusConfig: Record<string, { label: string; variant: any; dot?: boolean }> = {
    open: { label: 'Aberta', variant: 'info', dot: true },
    in_progress: { label: 'Em Andamento', variant: 'warning', dot: true },
    waiting_parts: { label: 'Aguard. Peças', variant: 'warning' },
    waiting_approval: { label: 'Aguard. Aprovação', variant: 'brand' },
    completed: { label: 'Concluída', variant: 'success', dot: true },
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
    wo?.business_number ?? wo?.os_number ?? wo?.number ?? '—'

export function WorkOrdersListPage() {
    const navigate = useNavigate()
    const [search, setSearch] = useState('')
    const [statusFilter, setStatusFilter] = useState('')
    const [showFilters, setShowFilters] = useState(false)

    const { data: res, isLoading } = useQuery({
        queryKey: ['work-orders', search, statusFilter],
        queryFn: () => api.get('/work-orders', {
            params: { search, status: statusFilter || undefined, per_page: 50 },
        }),
    })
    const orders: WorkOrder[] = res?.data?.data ?? []

    const formatDate = (d: string) => new Date(d).toLocaleDateString('pt-BR', {
        day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit',
    })

    const formatBRL = (v: string) => parseFloat(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

    // Status stats
    const allOrders = res?.data?.data ?? []
    const openCount = allOrders.filter((o: any) => o.status === 'open').length
    const progressCount = allOrders.filter((o: any) => o.status === 'in_progress').length
    const waitingCount = allOrders.filter((o: any) => ['waiting_parts', 'waiting_approval'].includes(o.status)).length

    return (
        <div className="space-y-5">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-lg font-semibold text-surface-900 tracking-tight">Ordens de Serviço</h1>
                    <p className="mt-0.5 text-[13px] text-surface-500">Gerencie suas ordens de serviço</p>
                </div>
                <Button icon={<Plus className="h-4 w-4" />} onClick={() => navigate('/os/nova')}>
                    Nova OS
                </Button>
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {[
                    { label: 'Abertas', value: openCount, color: 'bg-sky-50 text-sky-700 border-sky-200' },
                    { label: 'Em Andamento', value: progressCount, color: 'bg-amber-50 text-amber-700 border-amber-200' },
                    { label: 'Aguardando', value: waitingCount, color: 'bg-brand-50 text-brand-700 border-brand-200' },
                    { label: 'Total', value: res?.data?.total ?? orders.length, color: 'bg-surface-50 text-surface-700 border-surface-200' },
                ].map(s => (
                    <div key={s.label} className={cn('rounded-xl border p-3 text-center', s.color)}>
                        <p className="text-2xl font-bold">{s.value}</p>
                        <p className="text-xs font-medium mt-0.5">{s.label}</p>
                    </div>
                ))}
            </div>

            {/* Status flow bar */}
            {orders.length > 0 && (() => {
                const groups = Object.entries(statusConfig).map(([k, v]) => ({
                    key: k, label: v.label, count: orders.filter(o => o.status === k).length,
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
                    <input type="text" value={search} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearch(e.target.value)}
                        placeholder="Buscar OS, cliente..."
                        className="w-full rounded-lg border border-default bg-surface-50 py-2.5 pl-10 pr-4 text-sm focus:border-brand-400 focus:bg-surface-0 focus:outline-none focus:ring-2 focus:ring-brand-500/15" />
                </div>
                <div className="flex gap-2">
                    <select value={statusFilter} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setStatusFilter(e.target.value)}
                        className="rounded-lg border border-default bg-surface-50 px-3 py-2 text-sm focus:border-brand-400 focus:bg-surface-0 focus:outline-none focus:ring-2 focus:ring-brand-500/15">
                        <option value="">Todos os status</option>
                        {Object.entries(statusConfig).map(([k, v]) => (
                            <option key={k} value={k}>{v.label}</option>
                        ))}
                    </select>
                </div>
            </div>

            {/* OS Cards/List */}
            <div className="space-y-3">
                {isLoading ? (
                    <div className="py-16 text-center text-[13px] text-surface-500">Carregando...</div>
                ) : orders.length === 0 ? (
                    <div className="py-16 text-center">
                        <FileText className="mx-auto h-12 w-12 text-surface-300" />
                        <p className="mt-3 text-[13px] text-surface-500">Nenhuma OS encontrada</p>
                        <Button className="mt-3" onClick={() => navigate('/os/nova')}>Criar primeira OS</Button>
                    </div>
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
                                            → {order.assignee.name}
                                        </span>
                                    )}
                                </div>
                            </div>
                            {/* Right */}
                            <div className="text-right shrink-0">
                                <p className="text-sm font-semibold text-surface-900">{formatBRL(order.total)}</p>
                                <p className="mt-1 flex items-center justify-end gap-1 text-xs text-surface-400">
                                    <Clock className="h-3 w-3" /> {formatDate(order.created_at)}
                                </p>
                            </div>
                        </div>
                    </Link>
                ))}
            </div>
        </div>
    )
}
