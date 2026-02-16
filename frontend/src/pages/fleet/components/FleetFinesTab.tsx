import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { FileWarning, DollarSign, Calendar, User, Plus, X } from 'lucide-react'
import { useState } from 'react'
import api from '@/lib/api'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/stores/auth-store'

const initialForm = {
  fleet_vehicle_id: '',
  driver_id: '',
  fine_date: '',
  infraction_code: '',
  description: '',
  amount: '',
  points: '',
  due_date: '',
}

export function FleetFinesTab() {
  const queryClient = useQueryClient()
  const { hasPermission } = useAuthStore()

  const [statusFilter, setStatusFilter] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(initialForm)

  const { data: finesData, isLoading } = useQuery({
    queryKey: ['fleet-fines', statusFilter],
    queryFn: () => api.get('/fleet/fines', { params: { status: statusFilter || undefined } }).then(r => r.data),
  })

  const { data: vehiclesData } = useQuery({
    queryKey: ['fleet-vehicles-select'],
    queryFn: () => api.get('/fleet/vehicles', { params: { per_page: 100 } }).then(r => r.data),
    enabled: showForm,
  })

  const { data: usersData } = useQuery({
    queryKey: ['users-select-fines'],
    queryFn: () => api.get('/users', { params: { per_page: 100 } }).then(r => r.data),
    enabled: showForm,
  })

  const createMutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) => api.post('/fleet/fines', payload),
    onSuccess: () => {
      toast.success('Multa registrada com sucesso')
      queryClient.invalidateQueries({ queryKey: ['fleet-fines'] })
      setShowForm(false)
      setForm(initialForm)
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      toast.error(msg || 'Erro ao registrar multa')
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/fleet/fines/${id}`),
    onSuccess: () => {
      toast.success('Removido com sucesso')
      queryClient.invalidateQueries({ queryKey: ['fleet-fines'] })
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      toast.error(msg || 'Erro ao remover')
    },
  })
  const handleDelete = (id: number) => { if (window.confirm('Tem certeza que deseja remover?')) deleteMutation.mutate(id) }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const payload = {
      fleet_vehicle_id: Number(form.fleet_vehicle_id),
      driver_id: form.driver_id ? Number(form.driver_id) : null,
      fine_date: form.fine_date,
      infraction_code: form.infraction_code || null,
      description: form.description || null,
      amount: Number(form.amount),
      points: form.points ? Number(form.points) : null,
      due_date: form.due_date || null,
    }
    createMutation.mutate(payload)
  }

  const vehicles = vehiclesData?.data ?? []
  const users = usersData?.data ?? []

    const statusMap: Record<string, { label: string; variant: any }> = {
        pending: { label: 'Pendente', variant: 'warning' },
        paid: { label: 'Pago', variant: 'success' },
        contested: { label: 'Contestado', variant: 'info' },
        cancelled: { label: 'Cancelado', variant: 'secondary' },
    }

    const severityLabels: Record<string, string> = {
        light: 'Leve', medium: 'Média', serious: 'Grave', very_serious: 'Gravíssima'
    }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 mb-2">
        {[{ v: '', l: 'Todas' }, { v: 'pending', l: 'Pendentes' }, { v: 'paid', l: 'Pagas' }, { v: 'contested', l: 'Contestadas' }].map(s => (
          <button
            key={s.v}
            onClick={() => setStatusFilter(s.v)}
            className={cn(
              'px-3 py-1.5 rounded-lg text-xs font-medium transition-all border',
              statusFilter === s.v ? 'bg-brand-50 border-brand-300 text-brand-700' : 'bg-surface-0 border-default text-surface-500 hover:border-brand-200'
            )}
          >
            {s.l}
          </button>
        ))}
        {hasPermission('fleet.fine.create') && (
          <Button
            icon={<Plus size={16} />}
            onClick={() => setShowForm(true)}
            className="ml-auto"
          >
            Registrar Multa
          </Button>
        )}
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-surface-0 rounded-2xl border border-default shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-surface-900">Registrar Multa</h3>
              <button
                type="button"
                onClick={() => { setShowForm(false); setForm(initialForm) }}
                className="p-1.5 rounded-lg hover:bg-surface-100 text-surface-500"
              >
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-surface-600 mb-1">Veículo *</label>
                  <select
                    required
                    value={form.fleet_vehicle_id}
                    onChange={e => setForm(f => ({ ...f, fleet_vehicle_id: e.target.value }))}
                    className="w-full rounded-xl border border-default bg-surface-0 py-2 px-3 text-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
                  >
                    <option value="">Selecione</option>
                    {vehicles.map((v: { id: number; plate?: string; license_plate?: string }) => (
                      <option key={v.id} value={v.id}>
                        {v.plate ?? v.license_plate ?? `#${v.id}`}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-surface-600 mb-1">Motorista</label>
                  <select
                    value={form.driver_id}
                    onChange={e => setForm(f => ({ ...f, driver_id: e.target.value }))}
                    className="w-full rounded-xl border border-default bg-surface-0 py-2 px-3 text-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
                  >
                    <option value="">Nenhum</option>
                    {users.map((u: { id: number; name: string }) => (
                      <option key={u.id} value={u.id}>{u.name}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-surface-600 mb-1">Data da Multa *</label>
                  <input
                    type="date"
                    required
                    value={form.fine_date}
                    onChange={e => setForm(f => ({ ...f, fine_date: e.target.value }))}
                    className="w-full rounded-xl border border-default bg-surface-0 py-2 px-3 text-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-surface-600 mb-1">Vencimento</label>
                  <input
                    type="date"
                    value={form.due_date}
                    onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))}
                    className="w-full rounded-xl border border-default bg-surface-0 py-2 px-3 text-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-surface-600 mb-1">Código da Infração</label>
                <input
                  type="text"
                  maxLength={30}
                  value={form.infraction_code}
                  onChange={e => setForm(f => ({ ...f, infraction_code: e.target.value }))}
                  placeholder="Ex: 5.1.40"
                  className="w-full rounded-xl border border-default bg-surface-0 py-2 px-3 text-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-surface-600 mb-1">Descrição</label>
                <textarea
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  rows={2}
                  className="w-full rounded-xl border border-default bg-surface-0 py-2 px-3 text-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-surface-600 mb-1">Valor (R$) *</label>
                  <input
                    type="number"
                    required
                    step="0.01"
                    min="0"
                    value={form.amount}
                    onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                    className="w-full rounded-xl border border-default bg-surface-0 py-2 px-3 text-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-surface-600 mb-1">Pontos</label>
                  <input
                    type="number"
                    min="0"
                    value={form.points}
                    onChange={e => setForm(f => ({ ...f, points: e.target.value }))}
                    className="w-full rounded-xl border border-default bg-surface-0 py-2 px-3 text-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
                  />
                </div>
              </div>
              <div className="flex gap-2 pt-2">
                <Button
                  type="submit"
                  loading={createMutation.isPending}
                  disabled={createMutation.isPending}
                  className="flex-1"
                >
                  Salvar
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => { setShowForm(false); setForm(initialForm) }}
                >
                  Cancelar
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {isLoading && [1, 2].map(i => <div key={i} className="h-44 bg-surface-100 animate-pulse rounded-2xl" />)}
        {finesData?.data?.map((fine: any) => (
          <div key={fine.id} className="p-5 rounded-2xl border border-default bg-surface-0 transition-all space-y-3">
            <div className="flex items-center justify-between">
              <Badge variant={statusMap[fine.status]?.variant}>{statusMap[fine.status]?.label}</Badge>
              {fine.severity && (
                <span className={cn(
                  'text-xs font-bold px-2 py-0.5 rounded',
                  fine.severity === 'very_serious' ? 'bg-red-100 text-red-700' :
                    fine.severity === 'serious' ? 'bg-orange-100 text-orange-700' :
                      fine.severity === 'medium' ? 'bg-amber-100 text-amber-700' : 'bg-yellow-100 text-yellow-700'
                )}>
                  {severityLabels[fine.severity] || fine.severity}
                </span>
              )}
            </div>

            <div>
              <p className="text-sm font-bold text-surface-900">{fine.description || 'Infração de trânsito'}</p>
              <p className="text-xs text-surface-500">Art. {fine.infraction_code || '—'}</p>
            </div>

            <div className="grid grid-cols-3 gap-2 py-2 border-y border-subtle">
              <div>
                <p className="text-xs uppercase text-surface-400 font-bold">Veículo</p>
                <span className="px-2 py-0.5 bg-surface-900 text-white text-xs font-mono rounded font-bold tracking-wider">
                  {fine.vehicle?.plate || '—'}
                </span>
              </div>
              <div>
                <p className="text-xs uppercase text-surface-400 font-bold">Data</p>
                <p className="text-xs text-surface-700 flex items-center gap-1">
                  <Calendar size={10} className="text-surface-400" />
                  {(fine.fine_date || fine.infraction_date) ? new Date(fine.fine_date || fine.infraction_date).toLocaleDateString() : '—'}
                </p>
              </div>
              <div>
                <p className="text-xs uppercase text-surface-400 font-bold">Valor</p>
                <p className="text-xs font-bold text-red-600 flex items-center gap-1">
                  <DollarSign size={10} /> R$ {Number(fine.amount ?? fine.fine_value ?? 0).toFixed(2)}
                </p>
              </div>
            </div>

            {fine.driver && (
              <p className="text-xs text-surface-500 flex items-center gap-1">
                <User size={10} className="text-surface-400" /> Motorista: {fine.driver.name}
              </p>
            )}
          </div>
        ))}
        {!isLoading && (!finesData?.data || finesData.data.length === 0) && (
          <div className="col-span-full py-20 text-center border-2 border-dashed border-surface-200 rounded-3xl">
            <FileWarning size={40} className="mx-auto text-surface-200 mb-4" />
            <p className="text-surface-500 font-medium">Nenhuma multa registrada</p>
          </div>
        )}
      </div>
    </div>
  )
}
