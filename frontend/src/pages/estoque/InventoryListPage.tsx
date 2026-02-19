import { useState } from 'react'
import {
    PackageSearch, Plus, Filter,
    Calendar, Warehouse, User,
    CheckCircle2, Clock, XCircle, Loader2
} from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import api from '@/lib/api'
import { cn } from '@/lib/utils'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { useAuthStore } from '@/stores/auth-store'

export default function InventoryListPage() {
    const { hasPermission } = useAuthStore()
    const navigate = useNavigate()
    const [statusFilter, setStatusFilter] = useState('')
    const [warehouseFilter, setWarehouseFilter] = useState('')

    const { data: warehousesRes } = useQuery({
        queryKey: ['warehouses'],
        queryFn: () => api.get('/inventory/warehouses')
    })
    const warehouses = warehousesRes?.data?.data || []

    const { data: inventoriesRes, isLoading } = useQuery({
        queryKey: ['inventories', statusFilter, warehouseFilter],
        queryFn: () => api.get('/inventory/inventories', {
            params: { status: statusFilter, warehouse_id: warehouseFilter }
        })
    })
    const inventories = inventoriesRes?.data?.data || []

    const getStatusInfo = (status: string) => {
        switch (status) {
            case 'open': return { label: 'Aberto', color: 'bg-blue-100 text-blue-700', icon: Clock };
            case 'completed': return { label: 'Concluído', color: 'bg-emerald-100 text-emerald-700', icon: CheckCircle2 };
            case 'cancelled': return { label: 'Cancelado', color: 'bg-red-100 text-red-700', icon: XCircle };
            default: return { label: status, color: 'bg-surface-100 text-surface-600', icon: Clock };
        }
    }

    return (
        <div className="p-6 space-y-6 max-w-7xl mx-auto">
            <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-surface-900 flex items-center gap-2">
                        <PackageSearch className="w-7 h-7 text-brand-500" />
                        Inventários de Estoque
                    </h1>
                    <p className="text-surface-500 text-sm">Controle de perdas e acuracidade (Blind Audit).</p>
                </div>
                <button
                    onClick={() => navigate('/estoque/inventarios/novo')}
                    className="flex items-center justify-center gap-2 bg-brand-600 hover:bg-brand-700 text-white px-4 py-2.5 rounded-xl font-semibold transition-all shadow-lg active:scale-95"
                >
                    <Plus className="w-4 h-4" /> Novo Inventário
                </button>
            </header>

            <div className="bg-surface-0 p-4 rounded-2xl border border-default shadow-card flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2 text-sm text-surface-400 mr-2">
                    <Filter className="w-4 h-4" /> Filtros:
                </div>

                <select
                    value={warehouseFilter}
                    onChange={(e) => setWarehouseFilter(e.target.value)}
                    className="px-4 py-2 rounded-xl border border-default bg-surface-50 text-sm focus:outline-none"
                    title="Depósito"
                >
                    <option value="">Todos os Depósitos</option>
                    {warehouses.map((w: any) => (
                        <option key={w.id} value={w.id}>{w.name}</option>
                    ))}
                </select>

                <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="px-4 py-2 rounded-xl border border-default bg-surface-50 text-sm focus:outline-none"
                    title="Status"
                >
                    <option value="">Todos os Status</option>
                    <option value="open">Aberto</option>
                    <option value="completed">Concluído</option>
                    <option value="cancelled">Cancelado</option>
                </select>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {isLoading ? (
                    Array.from({ length: 3 }).map((_, i) => (
                        <div key={i} className="h-48 bg-surface-100 rounded-2xl animate-pulse" />
                    ))
                ) : inventories.length === 0 ? (
                    <div className="col-span-full py-20 text-center bg-surface-0 rounded-2xl border border-dashed border-default">
                        <PackageSearch className="w-12 h-12 text-surface-300 mx-auto mb-3" />
                        <p className="text-surface-500">Nenhum inventário encontrado.</p>
                    </div>
                ) : inventories.map((inv: any) => {
                    const status = getStatusInfo(inv.status)
                    const StatusIcon = status.icon
                    return (
                        <button
                            key={inv.id}
                            onClick={() => navigate(`/estoque/inventarios/${inv.id}`)}
                            className="bg-surface-0 p-5 rounded-2xl border border-default shadow-card hover:border-brand-500/50 transition-all text-left flex flex-col group"
                        >
                            <div className="flex items-center justify-between mb-4">
                                <div className={cn("px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider flex items-center gap-1.5", status.color)}>
                                    <StatusIcon className="w-3 h-3" />
                                    {status.label}
                                </div>
                                <span className="text-xs font-medium text-surface-400">#{inv.id}</span>
                            </div>

                            <h3 className="font-bold text-surface-900 text-lg mb-1 group-hover:text-brand-600 transition-colors">
                                {inv.reference || `Inventário ${inv.id}`}
                            </h3>

                            <div className="space-y-2 mt-auto pt-4 border-t border-subtle">
                                <div className="flex items-center gap-2 text-xs text-surface-500">
                                    <Warehouse className="w-3.5 h-3.5" />
                                    {inv.warehouse?.name}
                                </div>
                                <div className="flex items-center gap-2 text-xs text-surface-500">
                                    <Calendar className="w-3.5 h-3.5" />
                                    {format(new Date(inv.created_at), "dd 'de' MMMM, yyyy", { locale: ptBR })}
                                </div>
                                <div className="flex items-center gap-2 text-xs text-surface-500">
                                    <User className="w-3.5 h-3.5" />
                                    {inv.creator?.name}
                                </div>
                            </div>
                        </button>
                    )
                })}
            </div>
        </div>
    )
}
