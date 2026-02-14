import { useState , useMemo } from 'react'
import { Fuel, Plus, Search, CheckCircle, XCircle, Clock, Trash2, Loader2, Car, MapPin } from 'lucide-react'
import { useFuelingLogs, useCreateFuelingLog, useApproveFuelingLog, useDeleteFuelingLog, FUEL_TYPES, type FuelingLogFormData } from '@/hooks/useFuelingLogs'
import { useAuthStore } from '@/stores/auth-store'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Modal } from '@/components/ui/modal'
import { toast } from 'sonner'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'

const statusConfig: Record<string, { label: string; color: string; icon: React.ElementType }> = {
    pending: { label: 'Pendente', color: 'bg-amber-100 text-amber-700 border-amber-200', icon: Clock },
    approved: { label: 'Aprovado', color: 'bg-green-100 text-green-700 border-green-200', icon: CheckCircle },
    rejected: { label: 'Rejeitado', color: 'bg-red-100 text-red-700 border-red-200', icon: XCircle },
}

const emptyForm: FuelingLogFormData = {
    vehicle_plate: '', odometer_km: 0, fuel_type: 'diesel',
    liters: 0, price_per_liter: 0, total_amount: 0, date: new Date().toISOString().split('T')[0],
    gas_station: '', notes: '', work_order_id: null,
}

export function FuelingLogsPage() {

  // MVP: Data fetching
  const { data: items, isLoading, isError, refetch } = useQuery({
    queryKey: ['fueling-logs'],
    queryFn: () => api.get('/fueling-logs').then(r => r.data?.data ?? r.data ?? []),
  })

  // MVP: Delete mutation
  const queryClient = useQueryClient()
  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/fueling-logs/${id}`),
    onSuccess: () => { toast.success('Removido com sucesso'); queryClient.invalidateQueries({ queryKey: ['fueling-logs'] }) },
    onError: (err: any) => { toast.error(err?.response?.data?.message || 'Erro ao remover') },
  })
  const handleDelete = (id: number) => { if (window.confirm('Tem certeza que deseja remover?')) deleteMutation.mutate(id) }
    const { hasPermission } = useAuthStore()
    const canCreate = hasPermission('expenses.fueling_log.create')
    const canApprove = hasPermission('expenses.fueling_log.approve')
    const canDelete = hasPermission('expenses.fueling_log.delete')

    const [search, setSearch] = useState('')
    const [statusFilter, setStatusFilter] = useState('')
    const [page, setPage] = useState(1)
    const [createOpen, setCreateOpen] = useState(false)
    const [deleteTarget, setDeleteTarget] = useState<number | null>(null)
    const [form, setForm] = useState<FuelingLogFormData>({ ...emptyForm })

    const { data, isLoading } = useFuelingLogs({ search, status: statusFilter, page, per_page: 25 })
    const createMutation = useCreateFuelingLog()
    const approveMutation = useApproveFuelingLog()
    const deleteMutation = useDeleteFuelingLog()

    const logs = data?.data ?? []
    const pagination = data ? { current_page: data.current_page, last_page: data.last_page, total: data.total } : null

    const handleCreate = () => {
        createMutation.mutate(form, {
            onSuccess: () => {
        toast.success('Operação realizada com sucesso') setCreateOpen(false); setForm({ ...emptyForm }) },
        })
    }

    const handleLitersChange = (liters: number) => {
        const total = parseFloat((liters * form.price_per_liter).toFixed(2))
        setForm(f => ({ ...f, liters, total_amount: total }))
    }

    const handlePriceChange = (price: number) => {
        const total = parseFloat((form.liters * price).toFixed(2))
        setForm(f => ({ ...f, price_per_liter: price, total_amount: total }))
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-xl font-bold text-surface-900 flex items-center gap-2">
                        <Fuel className="h-6 w-6 text-brand-600" /> Controle de Abastecimento
                    </h1>
                    <p className="text-sm text-surface-500 mt-1">
                        {pagination ? `${pagination.total} registros` : 'Carregando...'}
                    </p>
                </div>
                {canCreate && (
                    <Button onClick={() => setCreateOpen(true)}>
                        <Plus className="mr-1.5 h-4 w-4" /> Novo Abastecimento
                    </Button>
                )}
            </div>

            {/* Filtros */}
            <Card>
                <CardContent className="p-4">
                    <div className="flex flex-col sm:flex-row gap-3">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-surface-400" />
                            <input
                                type="text" placeholder="Buscar por placa ou posto..."
                                value={search} onChange={e => { setSearch(e.target.value); setPage(1) }}
                                className="w-full pl-10 pr-4 py-2 rounded-lg border border-surface-200 text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                            />
                        </div>
                        <select
                            value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1) }}
                            title="Filtrar por status"
                            className="px-3 py-2 rounded-lg border border-surface-200 text-sm"
                        >
                            <option value="">Todos os status</option>
                            <option value="pending">Pendente</option>
                            <option value="approved">Aprovado</option>
                            <option value="rejected">Rejeitado</option>
                        </select>
                    </div>
                </CardContent>
            </Card>

            {/* Tabela */}
            <Card>
                <CardContent className="p-0">
                    {isLoading ? (
                        <div className="p-12 text-center">
                            <Loader2 className="h-8 w-8 animate-spin text-brand-600 mx-auto" />
                            <p className="text-sm text-surface-500 mt-2">Carregando registros...</p>
                        </div>
                    ) : logs.length === 0 ? (
                        <div className="p-12 text-center">
                            <Fuel className="h-12 w-12 text-surface-300 mx-auto" />
                            <p className="text-surface-500 mt-3 font-medium">Nenhum abastecimento registrado</p>
                            {canCreate && (
                                <Button variant="outline" size="sm" className="mt-3" onClick={() => setCreateOpen(true)}>
                                    <Plus className="mr-1 h-4 w-4" /> Registrar primeiro abastecimento
                                </Button>
                            )}
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead className="bg-surface-50 border-b border-surface-200">
                                    <tr>
                                        <th className="text-left px-4 py-3 font-medium text-surface-600">Data</th>
                                        <th className="text-left px-4 py-3 font-medium text-surface-600">Motorista</th>
                                        <th className="text-left px-4 py-3 font-medium text-surface-600">Placa</th>
                                        <th className="text-left px-4 py-3 font-medium text-surface-600">Combustível</th>
                                        <th className="text-right px-4 py-3 font-medium text-surface-600">Litros</th>
                                        <th className="text-right px-4 py-3 font-medium text-surface-600">R$/L</th>
                                        <th className="text-right px-4 py-3 font-medium text-surface-600">Total</th>
                                        <th className="text-right px-4 py-3 font-medium text-surface-600">Km</th>
                                        <th className="text-center px-4 py-3 font-medium text-surface-600">Status</th>
                                        <th className="text-right px-4 py-3 font-medium text-surface-600">Ações</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-surface-100">
                                    {logs.map((log: any) => {
                                        const sc = statusConfig[log.status] || statusConfig.pending
                                        const StatusIcon = sc.icon
                                        return (
                                            <tr key={log.id} className="hover:bg-surface-50 transition-colors">
                                                <td className="px-4 py-3 whitespace-nowrap">{new Date(log.fueling_date || log.date).toLocaleDateString('pt-BR')}</td>
                                                <td className="px-4 py-3">{log.user?.name || '—'}</td>
                                                <td className="px-4 py-3 font-mono text-xs">{log.vehicle_plate}</td>
                                                <td className="px-4 py-3">{FUEL_TYPES.find(f => f.value === log.fuel_type)?.label || log.fuel_type}</td>
                                                <td className="px-4 py-3 text-right">{Number(log.liters).toFixed(2)}</td>
                                                <td className="px-4 py-3 text-right">{Number(log.price_per_liter).toFixed(4)}</td>
                                                <td className="px-4 py-3 text-right font-semibold">
                                                    {Number(log.total_amount).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                                </td>
                                                <td className="px-4 py-3 text-right">{Number(log.odometer_km).toLocaleString('pt-BR')}</td>
                                                <td className="px-4 py-3 text-center">
                                                    <Badge className={sc.color}>
                                                        <StatusIcon className="mr-1 h-3 w-3" /> {sc.label}
                                                    </Badge>
                                                </td>
                                                <td className="px-4 py-3 text-right">
                                                    <div className="flex items-center justify-end gap-1">
                                                        {canApprove && log.status === 'pending' && (
                                                            <>
                                                                <Button
                                                                    variant="ghost" size="sm"
                                                                    onClick={() => approveMutation.mutate({ id: log.id, action: 'approve' })}
                                                                    disabled={approveMutation.isPending}
                                                                    className="text-green-600 hover:bg-green-50"
                                                                    title="Aprovar"
                                                                >
                                                                    <CheckCircle className="h-4 w-4" />
                                                                </Button>
                                                                <Button
                                                                    variant="ghost" size="sm"
                                                                    onClick={() => approveMutation.mutate({ id: log.id, action: 'reject' })}
                                                                    disabled={approveMutation.isPending}
                                                                    className="text-red-600 hover:bg-red-50"
                                                                    title="Rejeitar"
                                                                >
                                                                    <XCircle className="h-4 w-4" />
                                                                </Button>
                                                            </>
                                                        )}
                                                        {canDelete && log.status === 'pending' && (
                                                            <Button
                                                                variant="ghost" size="sm"
                                                                onClick={() => setDeleteTarget(log.id)}
                                                                className="text-red-600 hover:bg-red-50"
                                                                title="Excluir"
                                                            >
                                                                <Trash2 className="h-4 w-4" />
                                                            </Button>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        )
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {/* Paginação */}
                    {pagination && pagination.last_page > 1 && (
                        <div className="flex items-center justify-between p-4 border-t border-surface-200">
                            <p className="text-sm text-surface-500">
                                Página {pagination.current_page} de {pagination.last_page}
                            </p>
                            <div className="flex gap-2">
                                <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>
                                    Anterior
                                </Button>
                                <Button variant="outline" size="sm" disabled={page === pagination.last_page} onClick={() => setPage(p => p + 1)}>
                                    Próxima
                                </Button>
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Modal Criar */}
            <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Registrar Abastecimento">
                <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-surface-700 mb-1">Placa do Veículo *</label>
                            <div className="relative">
                                <Car className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-surface-400" />
                                <input type="text" value={form.vehicle_plate}
                                    onChange={e => setForm(f => ({ ...f, vehicle_plate: e.target.value.toUpperCase() }))}
                                    placeholder="ABC-1234" maxLength={10}
                                    className="w-full pl-10 pr-3 py-2 rounded-lg border border-surface-200 text-sm" />
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-surface-700 mb-1">Data *</label>
                            <input type="date" value={form.date}
                                onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                                className="w-full px-3 py-2 rounded-lg border border-surface-200 text-sm" />
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-surface-700 mb-1">Combustível *</label>
                            <select value={form.fuel_type} title="Tipo de combustível"
                                onChange={e => setForm(f => ({ ...f, fuel_type: e.target.value }))}
                                className="w-full px-3 py-2 rounded-lg border border-surface-200 text-sm">
                                {FUEL_TYPES.map(ft => <option key={ft.value} value={ft.value}>{ft.label}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-surface-700 mb-1">Odômetro (km) *</label>
                            <input type="number" value={form.odometer_km || ''}
                                onChange={e => setForm(f => ({ ...f, odometer_km: Number(e.target.value) }))}
                                className="w-full px-3 py-2 rounded-lg border border-surface-200 text-sm" />
                        </div>
                    </div>
                    <div className="grid grid-cols-3 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-surface-700 mb-1">Litros *</label>
                            <input type="number" step="0.01" value={form.liters || ''}
                                onChange={e => handleLitersChange(Number(e.target.value))}
                                className="w-full px-3 py-2 rounded-lg border border-surface-200 text-sm" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-surface-700 mb-1">R$/Litro *</label>
                            <input type="number" step="0.0001" value={form.price_per_liter || ''}
                                onChange={e => handlePriceChange(Number(e.target.value))}
                                className="w-full px-3 py-2 rounded-lg border border-surface-200 text-sm" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-surface-700 mb-1">Total (R$)</label>
                            <input type="number" step="0.01" value={form.total_amount || ''} readOnly
                                className="w-full px-3 py-2 rounded-lg border border-surface-200 text-sm bg-surface-50 font-semibold" />
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-surface-700 mb-1">
                            <MapPin className="inline h-3.5 w-3.5 mr-1" /> Posto / Localização
                        </label>
                        <input type="text" value={form.gas_station || ''}
                            onChange={e => setForm(f => ({ ...f, gas_station: e.target.value }))}
                            placeholder="Nome do posto ou localização"
                            className="w-full px-3 py-2 rounded-lg border border-surface-200 text-sm" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-surface-700 mb-1">Observações</label>
                        <textarea value={form.notes || ''} rows={2}
                            onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                            className="w-full px-3 py-2 rounded-lg border border-surface-200 text-sm resize-none" />
                    </div>
                    <div className="flex justify-end gap-3 pt-2">
                        <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancelar</Button>
                        <Button onClick={handleCreate} disabled={createMutation.isPending || !form.vehicle_plate || !form.liters}>
                            {createMutation.isPending ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Plus className="mr-1.5 h-4 w-4" />}
                            Registrar
                        </Button>
                    </div>
                </div>
            </Modal>

            {/* Modal Excluir */}
            <Modal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Excluir Registro?">
                <p className="text-sm text-surface-600 mb-4">Tem certeza que deseja excluir este registro de abastecimento? Esta ação não pode ser desfeita.</p>
                <div className="flex justify-end gap-3">
                    <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancelar</Button>
                    <Button variant="danger" onClick={() => { if (deleteTarget) { deleteMutation.mutate(deleteTarget, { onSuccess: () => setDeleteTarget(null) }) } }}
                        disabled={deleteMutation.isPending}>
                        {deleteMutation.isPending ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Trash2 className="mr-1.5 h-4 w-4" />}
                        Excluir
                    </Button>
                </div>
            </Modal>
        </div>
    )
}

export default FuelingLogsPage
