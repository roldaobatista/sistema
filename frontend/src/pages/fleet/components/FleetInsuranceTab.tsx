import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Shield, Plus, X, AlertTriangle, Calendar, DollarSign, Phone, Trash2, Eye } from 'lucide-react'
import api from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { useAuthStore } from '@/stores/auth-store'

const initialFormData = {
    fleet_vehicle_id: '',
    insurer: '',
    policy_number: '',
    coverage_type: 'comprehensive' as const,
    premium_value: '',
    deductible_value: '',
    start_date: '',
    end_date: '',
    broker_name: '',
    broker_phone: '',
    status: 'active' as const,
    notes: '',
}

export function FleetInsuranceTab() {
    const { hasPermission } = useAuthStore()
    const [showForm, setShowForm] = useState(false)
    const [editingInsurance, setEditingInsurance] = useState<any>(null)
    const [formData, setFormData] = useState(initialFormData)

    const queryClient = useQueryClient()
    const { data: insurances, isLoading } = useQuery({
        queryKey: ['fleet-insurances'],
        queryFn: () => api.get('/fleet/insurances').then(r => r.data)
    })

    const { data: vehiclesData } = useQuery({
        queryKey: ['fleet-vehicles-select'],
        queryFn: () => api.get('/fleet/vehicles', { params: { per_page: 100 } }).then(r => r.data),
        enabled: showForm,
    })

    const { data: alerts } = useQuery({
        queryKey: ['fleet-insurance-alerts'],
        queryFn: () => api.get('/fleet/insurances/alerts').then(r => r.data)
    })

    const deleteMutation = useMutation({
        mutationFn: (id: number) => api.delete(`/fleet/insurances/${id}`),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['fleet-insurances'] })
            toast.success('Seguro removido')
        },
        onError: () => toast.error('Erro ao remover seguro')
    })

    const createMutation = useMutation({
        mutationFn: (payload: typeof initialFormData) => api.post('/fleet/insurances', payload),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['fleet-insurances'] })
            queryClient.invalidateQueries({ queryKey: ['fleet-insurance-alerts'] })
            toast.success('Apólice cadastrada com sucesso')
            closeForm()
        },
        onError: (err: any) => toast.error(err?.response?.data?.message || 'Erro ao cadastrar apólice')
    })

    const updateMutation = useMutation({
        mutationFn: ({ id, payload }: { id: number; payload: Partial<typeof initialFormData> }) =>
            api.put(`/fleet/insurances/${id}`, payload),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['fleet-insurances'] })
            queryClient.invalidateQueries({ queryKey: ['fleet-insurance-alerts'] })
            toast.success('Apólice atualizada')
            closeForm()
        },
        onError: (err: any) => toast.error(err?.response?.data?.message || 'Erro ao atualizar apólice')
    })

    const closeForm = () => {
        setShowForm(false)
        setEditingInsurance(null)
        setFormData(initialFormData)
    }

    const openCreate = () => {
        setEditingInsurance(null)
        setFormData(initialFormData)
        setShowForm(true)
    }

    const openEdit = (ins: any) => {
        setEditingInsurance(ins)
        setFormData({
            fleet_vehicle_id: String(ins.fleet_vehicle_id ?? ''),
            insurer: ins.insurer ?? '',
            policy_number: ins.policy_number ?? '',
            coverage_type: ins.coverage_type ?? 'comprehensive',
            premium_value: ins.premium_value != null ? String(ins.premium_value) : '',
            deductible_value: ins.deductible_value != null ? String(ins.deductible_value) : '',
            start_date: ins.start_date ? ins.start_date.slice(0, 10) : '',
            end_date: ins.end_date ? ins.end_date.slice(0, 10) : '',
            broker_name: ins.broker_name ?? '',
            broker_phone: ins.broker_phone ?? '',
            status: ins.status ?? 'active',
            notes: ins.notes ?? '',
        })
        setShowForm(true)
    }

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        if (!editingInsurance && !formData.fleet_vehicle_id) {
            toast.error('Selecione o veículo')
            return
        }
        if (!formData.insurer?.trim()) {
            toast.error('Informe a seguradora')
            return
        }
        if (!formData.premium_value || Number(formData.premium_value) < 0) {
            toast.error('Informe o valor do prêmio')
            return
        }
        if (!formData.start_date || !formData.end_date) {
            toast.error('Informe início e fim da vigência')
            return
        }
        const payload = {
            ...formData,
            fleet_vehicle_id: formData.fleet_vehicle_id ? Number(formData.fleet_vehicle_id) : undefined,
            premium_value: Number(formData.premium_value),
            deductible_value: formData.deductible_value ? Number(formData.deductible_value) : undefined,
        }
        if (editingInsurance) {
            const { fleet_vehicle_id: _, ...updatePayload } = payload
            updateMutation.mutate({ id: editingInsurance.id, payload: updatePayload as any })
        } else {
            createMutation.mutate(payload as any)
        }
    }

    const isSaving = createMutation.isPending || updateMutation.isPending
    const vehicles = vehiclesData?.data ?? []

    const statusMap: Record<string, { label: string; variant: any }> = {
        active: { label: 'Ativo', variant: 'success' },
        expired: { label: 'Vencido', variant: 'danger' },
        cancelled: { label: 'Cancelado', variant: 'secondary' },
        pending: { label: 'Pendente', variant: 'warning' },
    }

    const coverageLabels: Record<string, string> = {
        comprehensive: 'Compreensivo',
        third_party: 'Terceiros',
        total_loss: 'Perda Total',
    }

    return (
        <div className="space-y-6">
            {alerts && (alerts.expired?.length > 0 || alerts.expiring_soon?.length > 0) && (
                <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 space-y-2">
                    <div className="flex items-center gap-2 text-amber-700 font-semibold text-sm">
                        <AlertTriangle size={16} /> Alertas de Seguro
                    </div>
                    {alerts.expired?.map((ins: any) => (
                        <p key={ins.id} className="text-xs text-red-700">🔴 {ins.vehicle?.plate} — Seguro VENCIDO ({ins.insurer})</p>
                    ))}
                    {alerts.expiring_soon?.map((ins: any) => (
                        <p key={ins.id} className="text-xs text-amber-700">🟡 {ins.vehicle?.plate} — Vence em {new Date(ins.end_date).toLocaleDateString()} ({ins.insurer})</p>
                    ))}
                </div>
            )}

            <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-surface-700">Apólices de Seguro</h3>
                <Button size="sm" icon={<Plus size={14} />} onClick={openCreate}>Nova Apólice</Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {isLoading && [1, 2, 3].map(i => <div key={i} className="h-52 bg-surface-100 animate-pulse rounded-2xl" />)}
                {insurances?.data?.map((ins: any) => (
                    <div key={ins.id} className="group p-5 rounded-2xl border border-default bg-surface-0 transition-all space-y-4">
                        <div className="flex items-center justify-between">
                            <Badge variant={statusMap[ins.status]?.variant}>{statusMap[ins.status]?.label}</Badge>
                            <span className="text-xs text-surface-400 font-mono">#{ins.id}</span>
                        </div>

                        <div>
                            <h4 className="font-bold text-surface-900">{ins.insurer}</h4>
                            <p className="text-xs text-surface-500">{ins.vehicle?.plate} — {coverageLabels[ins.coverage_type] || ins.coverage_type}</p>
                            {ins.policy_number && <p className="text-xs text-surface-400 mt-1">Apólice: {ins.policy_number}</p>}
                        </div>

                        <div className="grid grid-cols-2 gap-3 py-3 border-y border-subtle">
                            <div>
                                <p className="text-xs uppercase text-surface-400 font-bold">Prêmio</p>
                                <p className="text-xs font-semibold text-brand-600 flex items-center gap-1">
                                    <DollarSign size={12} /> R$ {Number(ins.premium_value).toLocaleString()}
                                </p>
                            </div>
                            <div>
                                <p className="text-xs uppercase text-surface-400 font-bold">Vigência</p>
                                <p className="text-xs font-medium text-surface-700 flex items-center gap-1">
                                    <Calendar size={12} className="text-surface-400" />
                                    {new Date(ins.start_date).toLocaleDateString()} — {new Date(ins.end_date).toLocaleDateString()}
                                </p>
                            </div>
                        </div>

                        {ins.broker_name && (
                            <div className="flex items-center gap-2 text-xs text-surface-600">
                                <Phone size={12} className="text-surface-400" />
                                {ins.broker_name} {ins.broker_phone && `• ${ins.broker_phone}`}
                            </div>
                        )}

                        <div className="flex gap-2 pt-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button size="xs" variant="outline" icon={<Eye size={12} />} className="flex-1" onClick={() => openEdit(ins)}>Detalhes</Button>
                            <Button size="xs" variant="ghost" className="text-red-400" onClick={() => {
                                if (confirm('Remover esta apólice?')) deleteMutation.mutate(ins.id)
                            }}>
                                <Trash2 size={12} />
                            </Button>
                        </div>
                    </div>
                ))}
                {!isLoading && (!insurances?.data || insurances.data.length === 0) && (
                    <div className="col-span-full py-20 text-center border-2 border-dashed border-surface-200 rounded-3xl">
                        <Shield size={40} className="mx-auto text-surface-200 mb-4" />
                        <p className="text-surface-500 font-medium">Nenhuma apólice cadastrada</p>
                        <Button size="sm" variant="outline" className="mt-3" icon={<Plus size={14} />} onClick={openCreate}>Cadastrar Seguro</Button>
                    </div>
                )}
            </div>

            {showForm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                    <div className="bg-surface-0 rounded-2xl border border-default shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6 space-y-4">
                        <div className="flex items-center justify-between">
                            <h3 className="text-lg font-semibold text-surface-900">
                                {editingInsurance ? 'Editar Apólice' : 'Nova Apólice'}
                            </h3>
                            <button
                                type="button"
                                onClick={closeForm}
                                className="p-2 rounded-lg hover:bg-surface-100 text-surface-500 hover:text-surface-700"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-semibold text-surface-600 mb-1">Veículo *</label>
                                    <select
                                        value={formData.fleet_vehicle_id}
                                        onChange={e => setFormData(f => ({ ...f, fleet_vehicle_id: e.target.value }))}
                                        required={!editingInsurance}
                                        disabled={!!editingInsurance}
                                        className="w-full rounded-xl border border-default bg-surface-0 py-2 px-3 text-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100 disabled:opacity-60 disabled:cursor-not-allowed"
                                    >
                                        <option value="">Selecione...</option>
                                        {vehicles.map((v: any) => (
                                            <option key={v.id} value={v.id}>{v.plate} — {v.brand} {v.model}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-surface-600 mb-1">Seguradora *</label>
                                    <input
                                        value={formData.insurer}
                                        onChange={e => setFormData(f => ({ ...f, insurer: e.target.value }))}
                                        required
                                        className="w-full rounded-xl border border-default bg-surface-0 py-2 px-3 text-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
                                        placeholder="Nome da seguradora"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-surface-600 mb-1">Nº Apólice</label>
                                    <input
                                        value={formData.policy_number}
                                        onChange={e => setFormData(f => ({ ...f, policy_number: e.target.value }))}
                                        className="w-full rounded-xl border border-default bg-surface-0 py-2 px-3 text-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
                                        placeholder="Número da apólice"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-surface-600 mb-1">Tipo Cobertura *</label>
                                    <select
                                        value={formData.coverage_type}
                                        onChange={e => setFormData(f => ({ ...f, coverage_type: e.target.value as any }))}
                                        required
                                        className="w-full rounded-xl border border-default bg-surface-0 py-2 px-3 text-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
                                    >
                                        <option value="comprehensive">Compreensivo</option>
                                        <option value="third_party">Terceiros</option>
                                        <option value="total_loss">Perda Total</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-surface-600 mb-1">Valor do Prêmio (R$) *</label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        value={formData.premium_value}
                                        onChange={e => setFormData(f => ({ ...f, premium_value: e.target.value }))}
                                        required
                                        className="w-full rounded-xl border border-default bg-surface-0 py-2 px-3 text-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
                                        placeholder="0,00"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-surface-600 mb-1">Valor Franquia (R$)</label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        value={formData.deductible_value}
                                        onChange={e => setFormData(f => ({ ...f, deductible_value: e.target.value }))}
                                        className="w-full rounded-xl border border-default bg-surface-0 py-2 px-3 text-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
                                        placeholder="0,00"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-surface-600 mb-1">Início Vigência *</label>
                                    <input
                                        type="date"
                                        value={formData.start_date}
                                        onChange={e => setFormData(f => ({ ...f, start_date: e.target.value }))}
                                        required
                                        className="w-full rounded-xl border border-default bg-surface-0 py-2 px-3 text-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-surface-600 mb-1">Fim Vigência *</label>
                                    <input
                                        type="date"
                                        value={formData.end_date}
                                        onChange={e => setFormData(f => ({ ...f, end_date: e.target.value }))}
                                        required
                                        className="w-full rounded-xl border border-default bg-surface-0 py-2 px-3 text-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-surface-600 mb-1">Nome do Corretor</label>
                                    <input
                                        value={formData.broker_name}
                                        onChange={e => setFormData(f => ({ ...f, broker_name: e.target.value }))}
                                        className="w-full rounded-xl border border-default bg-surface-0 py-2 px-3 text-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
                                        placeholder="Nome do corretor"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-surface-600 mb-1">Telefone do Corretor</label>
                                    <input
                                        value={formData.broker_phone}
                                        onChange={e => setFormData(f => ({ ...f, broker_phone: e.target.value }))}
                                        className="w-full rounded-xl border border-default bg-surface-0 py-2 px-3 text-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
                                        placeholder="(00) 00000-0000"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-surface-600 mb-1">Status</label>
                                    <select
                                        value={formData.status}
                                        onChange={e => setFormData(f => ({ ...f, status: e.target.value as any }))}
                                        className="w-full rounded-xl border border-default bg-surface-0 py-2 px-3 text-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
                                    >
                                        <option value="active">Ativo</option>
                                        <option value="expired">Vencido</option>
                                        <option value="cancelled">Cancelado</option>
                                        <option value="pending">Pendente</option>
                                    </select>
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-surface-600 mb-1">Observações</label>
                                <textarea
                                    value={formData.notes}
                                    onChange={e => setFormData(f => ({ ...f, notes: e.target.value }))}
                                    rows={3}
                                    className="w-full rounded-xl border border-default bg-surface-0 py-2 px-3 text-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100 resize-none"
                                    placeholder="Observações adicionais"
                                />
                            </div>
                            <div className="flex gap-3 pt-2">
                                <Button type="submit" disabled={isSaving}>
                                    {isSaving ? 'Salvando...' : 'Salvar'}
                                </Button>
                                <Button type="button" variant="outline" onClick={closeForm} disabled={isSaving}>
                                    Cancelar
                                </Button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    )
}
