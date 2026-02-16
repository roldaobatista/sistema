import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Calendar, User, Clock, CheckCircle2, XCircle, Play, Info, Plus, X } from 'lucide-react'
import api from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { useAuthStore } from '@/stores/auth-store'

const emptyForm = {
  fleet_vehicle_id: '' as string | number,
  requested_start: '',
  requested_end: '',
  purpose: '',
}

export function FleetPoolTab() {
  const { hasPermission } = useAuthStore()
  const [showForm, setShowForm] = useState(false)
  const [formData, setFormData] = useState(emptyForm)
  const [detailRequest, setDetailRequest] = useState<any>(null)

  const queryClient = useQueryClient()
  const { data: requests, isLoading } = useQuery({
    queryKey: ['fleet-pool-requests'],
    queryFn: () => api.get('/fleet/pool-requests').then(r => r.data)
  })

  const { data: vehiclesData } = useQuery({
    queryKey: ['fleet-vehicles-select'],
    queryFn: () => api.get('/fleet/vehicles', { params: { per_page: 100 } }).then(r => r.data),
    enabled: showForm,
  })

  const createMutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) => api.post('/fleet/pool-requests', payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fleet-pool-requests'] })
      toast.success('Solicitação criada com sucesso')
      setShowForm(false)
      setFormData(emptyForm)
    },
    onError: (err: any) => {
      const data = err?.response?.data
      let msg = data?.message || 'Erro ao criar solicitação'
      if (data?.errors && typeof data.errors === 'object') {
        msg = Object.values(data.errors as Record<string, string[]>).flat().join(', ')
      }
      toast.error(msg)
    },
  })

  const statusMap: Record<string, { label: string; variant: any; icon: any }> = {
        pending: { label: 'Pendente', variant: 'warning', icon: <Clock size={14} /> },
        approved: { label: 'Aprovado', variant: 'brand', icon: <CheckCircle2 size={14} /> },
        in_use: { label: 'Em Uso', variant: 'success', icon: <Play size={14} /> },
        completed: { label: 'Concluído', variant: 'info', icon: <CheckCircle2 size={14} /> },
        rejected: { label: 'Rejeitado', variant: 'danger', icon: <XCircle size={14} /> },
    }

  const updateStatus = useMutation({
    mutationFn: ({ id, status }: any) => api.patch(`/fleet/pool-requests/${id}/status`, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fleet-pool-requests'] })
      toast.success('Status atualizado')
    }
  })

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const payload: Record<string, unknown> = {
      requested_start: formData.requested_start,
      requested_end: formData.requested_end,
      purpose: formData.purpose || null,
    }
    if (formData.fleet_vehicle_id) payload.fleet_vehicle_id = Number(formData.fleet_vehicle_id)
    createMutation.mutate(payload)
  }

  const vehicles = vehiclesData?.data ?? []

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-surface-700">Solicitações de Backup / Pool</h3>
        <Button size="sm" icon={<Plus size={14} />} onClick={() => setShowForm(true)}>Nova Solicitação</Button>
      </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {isLoading && [1, 2, 3].map(i => <div key={i} className="h-40 bg-surface-100 animate-pulse rounded-2xl" />)}
                {requests?.data?.map((req: any) => (
                    <div key={req.id} className="p-5 rounded-2xl border border-default bg-surface-0 shadow-sm space-y-4 transition-all">
                        <div className="flex items-center justify-between">
                            <Badge variant={statusMap[req.status]?.variant} className="flex items-center gap-1">
                                {statusMap[req.status]?.icon}
                                {statusMap[req.status]?.label}
                            </Badge>
                            <span className="text-xs text-surface-400 font-mono">#{req.id}</span>
                        </div>

                        <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-full bg-brand-50 flex items-center justify-center text-brand-700">
                                <User size={18} />
                            </div>
                            <div>
                                <p className="text-sm font-bold text-surface-900">{req.user?.name}</p>
                                <p className="text-xs text-surface-500">{req.vehicle ? `${req.vehicle.plate} • ${req.vehicle.model}` : 'Sem veículo definido'}</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4 py-2 border-y border-subtle">
                            <div className="space-y-1">
                                <p className="text-xs uppercase text-surface-400 font-bold">Início</p>
                                <p className="text-xs font-medium text-surface-700 flex items-center gap-1">
                                    <Calendar size={12} className="text-surface-400" />
                                    {new Date(req.requested_start ?? req.start_at).toLocaleDateString()}
                                </p>
                            </div>
                            <div className="space-y-1">
                                <p className="text-xs uppercase text-surface-400 font-bold">Retorno Est.</p>
                                <p className="text-xs font-medium text-surface-700 flex items-center gap-1">
                                    <Clock size={12} className="text-surface-400" />
                                    {new Date(req.requested_end ?? req.end_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </p>
                            </div>
                        </div>

                        <div className="flex items-center gap-2 pt-1">
                            {req.status === 'pending' && (
                                <>
                                    <Button size="xs" variant="brand" className="flex-1" onClick={() => updateStatus.mutate({ id: req.id, status: 'approved' })}>Aprovar</Button>
                                    <Button size="xs" variant="ghost" onClick={() => updateStatus.mutate({ id: req.id, status: 'rejected' })} className="text-red-500 hover:text-red-600">Rejeitar</Button>
                                </>
                            )}
                            {req.status === 'approved' && (
                                <Button size="xs" variant="brand" className="w-full" onClick={() => updateStatus.mutate({ id: req.id, status: 'in_use' })}>Registrar Saída</Button>
                            )}
                            {req.status === 'in_use' && (
                                <Button size="xs" variant="success" className="w-full" onClick={() => updateStatus.mutate({ id: req.id, status: 'completed' })}>Registrar Devolução</Button>
                            )}
                            {(req.status === 'completed' || req.status === 'rejected') && (
                                <Button size="xs" variant="outline" icon={<Info size={12} />} className="w-full" onClick={() => setDetailRequest(req)}>Ver Detalhes</Button>
                            )}
                        </div>
                    </div>
                ))}
                {requests?.data?.length === 0 && (
                    <div className="col-span-full py-20 text-center border-2 border-dashed border-surface-200 rounded-3xl">
                        <Calendar size={40} className="mx-auto text-surface-200 mb-4" />
                        <p className="text-surface-500 font-medium">Nenhuma solicitação no período</p>
                    </div>
                )}
            </div>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-surface-0 rounded-2xl border border-default shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-surface-900">Nova Solicitação de Pool</h3>
              <button
                type="button"
                onClick={() => { setShowForm(false); setFormData(emptyForm) }}
                className="p-1 rounded-lg hover:bg-surface-100 text-surface-500 hover:text-surface-700"
              >
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-surface-600 mb-1">Veículo Preferido</label>
                <select
                  value={formData.fleet_vehicle_id}
                  onChange={(e) => setFormData({ ...formData, fleet_vehicle_id: e.target.value })}
                  className="w-full rounded-xl border border-default bg-surface-0 py-2 px-3 text-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
                >
                  <option value="">Nenhum (qualquer disponível)</option>
                  {vehicles.map((v: any) => (
                    <option key={v.id} value={v.id}>{v.plate} • {v.brand} {v.model}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-surface-600 mb-1">Data/Hora Início</label>
                  <input
                    type="datetime-local"
                    required
                    value={formData.requested_start}
                    onChange={(e) => setFormData({ ...formData, requested_start: e.target.value })}
                    className="w-full rounded-xl border border-default bg-surface-0 py-2 px-3 text-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-surface-600 mb-1">Data/Hora Fim</label>
                  <input
                    type="datetime-local"
                    required
                    value={formData.requested_end}
                    onChange={(e) => setFormData({ ...formData, requested_end: e.target.value })}
                    className="w-full rounded-xl border border-default bg-surface-0 py-2 px-3 text-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-surface-600 mb-1">Finalidade</label>
                <textarea
                  value={formData.purpose}
                  onChange={(e) => setFormData({ ...formData, purpose: e.target.value })}
                  rows={3}
                  placeholder="Descreva o motivo da solicitação..."
                  className="w-full rounded-xl border border-default bg-surface-0 py-2 px-3 text-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100 resize-none"
                />
              </div>
              <div className="flex gap-2 pt-2">
                <Button type="submit" variant="brand" disabled={createMutation.isPending} className="flex-1">
                  {createMutation.isPending ? 'Salvando...' : 'Salvar'}
                </Button>
                <Button type="button" variant="outline" onClick={() => { setShowForm(false); setFormData(emptyForm) }} disabled={createMutation.isPending}>
                  Cancelar
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {detailRequest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-surface-0 rounded-2xl border border-default shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-surface-900">Detalhes da Solicitação #{detailRequest.id}</h3>
              <button
                type="button"
                onClick={() => setDetailRequest(null)}
                className="p-1 rounded-lg hover:bg-surface-100 text-surface-500 hover:text-surface-700"
              >
                <X size={20} />
              </button>
            </div>
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-3 rounded-xl bg-surface-50">
                <div className="h-10 w-10 rounded-full bg-brand-50 flex items-center justify-center text-brand-700">
                  <User size={18} />
                </div>
                <div>
                  <p className="text-sm font-bold text-surface-900">{detailRequest.user?.name}</p>
                  <p className="text-xs text-surface-500">
                    {detailRequest.vehicle ? `${detailRequest.vehicle.plate} • ${detailRequest.vehicle.model}` : 'Sem veículo definido'}
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 py-2 border-y border-subtle">
                <div>
                  <p className="text-xs uppercase text-surface-400 font-bold mb-1">Início</p>
                  <p className="text-sm font-medium text-surface-700">
                    {new Date(detailRequest.requested_start ?? detailRequest.start_at).toLocaleString()}
                  </p>
                </div>
                <div>
                  <p className="text-xs uppercase text-surface-400 font-bold mb-1">Fim</p>
                  <p className="text-sm font-medium text-surface-700">
                    {new Date(detailRequest.requested_end ?? detailRequest.end_at).toLocaleString()}
                  </p>
                </div>
              </div>
              {detailRequest.purpose && (
                <div>
                  <p className="text-xs uppercase text-surface-400 font-bold mb-1">Finalidade</p>
                  <p className="text-sm text-surface-700 whitespace-pre-wrap">{detailRequest.purpose}</p>
                </div>
              )}
              <div>
                <p className="text-xs uppercase text-surface-400 font-bold mb-1">Status</p>
                <Badge variant={statusMap[detailRequest.status]?.variant} className="flex items-center gap-1 w-fit">
                  {statusMap[detailRequest.status]?.icon}
                  {statusMap[detailRequest.status]?.label}
                </Badge>
              </div>
            </div>
          </div>
        </div>
      )}
        </div>
    )
}
