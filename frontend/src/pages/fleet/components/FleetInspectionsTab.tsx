import { useState } from 'react'
import { toast } from 'sonner'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ClipboardList, CheckCircle2, AlertCircle, XCircle, Eye, Plus, X } from 'lucide-react'
import api from '@/lib/api'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/stores/auth-store'

const CHECKLIST_ITEMS = [
  { key: 'pneus', label: 'Pneus' },
  { key: 'freios', label: 'Freios' },
  { key: 'luzes', label: 'Luzes' },
  { key: 'fluidos', label: 'Fluidos' },
  { key: 'motor', label: 'Motor' },
  { key: 'carroceria', label: 'Carroceria' },
  { key: 'interior', label: 'Interior' },
  { key: 'documentacao', label: 'Documentação' },
] as const

const initialChecklist = Object.fromEntries(CHECKLIST_ITEMS.map(i => [i.key, 'na'])) as Record<string, 'ok' | 'nok' | 'na'>

const initialFormData = {
  fleet_vehicle_id: '',
  inspection_date: new Date().toISOString().slice(0, 10),
  odometer_km: '',
  status: 'ok' as 'ok' | 'issues_found' | 'critical',
  checklist_data: { ...initialChecklist },
  observations: '',
}

export function FleetInspectionsTab() {
  const queryClient = useQueryClient()
  const { hasPermission } = useAuthStore()

  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null)
  const confirmDelete = () => { if (confirmDeleteId !== null) { deleteMutation.mutate(confirmDeleteId); setConfirmDeleteId(null) } }
  const [statusFilter, setStatusFilter] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [formData, setFormData] = useState(initialFormData)
  const [detailInspection, setDetailInspection] = useState<any>(null)

  const { data: inspections, isLoading } = useQuery({
    queryKey: ['fleet-inspections', statusFilter],
    queryFn: () => api.get('/fleet/inspections', { params: { status: statusFilter || undefined } }).then(r => r.data),
  })

  const { data: vehiclesData } = useQuery({
    queryKey: ['fleet-vehicles-select'],
    queryFn: () => api.get('/fleet/vehicles', { params: { per_page: 100 } }).then(r => r.data),
    enabled: showForm,
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/fleet/inspections/${id}`),
    onSuccess: () => {
      toast.success('Removido com sucesso')
      queryClient.invalidateQueries({ queryKey: ['fleet-inspections'] })
    },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Erro ao remover'),
  })

  const createMutation = useMutation({
    mutationFn: (payload: typeof initialFormData) =>
      api.post('/fleet/inspections', {
        fleet_vehicle_id: Number(payload.fleet_vehicle_id),
        inspection_date: payload.inspection_date,
        odometer_km: Number(payload.odometer_km),
        status: payload.status,
        checklist_data: payload.checklist_data,
        observations: payload.observations || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fleet-inspections'] })
      toast.success('Inspeção registrada com sucesso')
      closeForm()
    },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Erro ao registrar inspeção'),
  })

  const handleDelete = (id: number) => {
    setConfirmDeleteId(id)
  }

  const closeForm = () => {
    setShowForm(false)
    setFormData(initialFormData)
  }

  const openCreate = () => {
    setFormData(initialFormData)
    setShowForm(true)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.fleet_vehicle_id) {
      toast.error('Selecione o veículo')
      return
    }
    if (!formData.inspection_date) {
      toast.error('Informe a data da inspeção')
      return
    }
    const odometer = Number(formData.odometer_km)
    if (!formData.odometer_km || isNaN(odometer) || odometer < 0) {
      toast.error('Informe o odômetro válido (km)')
      return
    }
    createMutation.mutate(formData)
  }

  const statusMap: Record<string, { label: string; variant: any; icon: any }> = {
    ok: { label: 'OK', variant: 'success', icon: <CheckCircle2 size={14} /> },
    issues_found: { label: 'Pendências', variant: 'warning', icon: <AlertCircle size={14} /> },
    critical: { label: 'Crítico', variant: 'danger', icon: <XCircle size={14} /> },
  }

  const checklistBadgeVariant: Record<string, string> = {
    ok: 'bg-emerald-100 text-emerald-800',
    nok: 'bg-red-100 text-red-800',
    na: 'bg-surface-100 text-surface-600',
  }

  const statuses = [
    { value: '', label: 'Todos' },
    { value: 'ok', label: 'OK' },
    { value: 'issues_found', label: 'Pendências' },
    { value: 'critical', label: 'Crítico' },
  ]

  const vehicles = vehiclesData?.data ?? []
  const isSaving = createMutation.isPending

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-2">
          {statuses.map(s => (
            <button
              key={s.value}
              onClick={() => setStatusFilter(s.value)}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-medium transition-all border',
                statusFilter === s.value
                  ? 'bg-brand-50 border-brand-300 text-brand-700'
                  : 'bg-surface-0 border-default text-surface-500 hover:border-brand-200'
              )}
            >
              {s.label}
            </button>
          ))}
        </div>
        <Button size="sm" icon={<Plus size={14} />} onClick={openCreate}>
          Nova Inspeção
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {isLoading && [1, 2, 3].map(i => <div key={i} className="h-44 bg-surface-100 animate-pulse rounded-2xl" />)}
                {inspections?.data?.map((insp: any) => {
                    const st = statusMap[insp.status] || statusMap.ok
                    return (
                        <div key={insp.id} className="p-5 rounded-2xl border border-default bg-surface-0 transition-all space-y-3">
                            <div className="flex items-center justify-between">
                                <Badge variant={st.variant} className="flex items-center gap-1">{st.icon} {st.label}</Badge>
                                <span className="text-xs text-surface-400">{new Date(insp.inspection_date).toLocaleDateString()}</span>
                            </div>

                            <div>
                                <p className="text-sm font-bold text-surface-900">{insp.vehicle?.plate} — {insp.vehicle?.model}</p>
                                <p className="text-xs text-surface-500">Inspetor: {insp.inspector?.name}</p>
                            </div>

                            <div className="grid grid-cols-2 gap-2 py-2 border-y border-subtle">
                                <div>
                                    <p className="text-xs uppercase text-surface-400 font-bold">Odômetro</p>
                                    <p className="text-xs font-mono text-surface-700">{Number(insp.odometer_km).toLocaleString()} km</p>
                                </div>
                                <div>
                                    <p className="text-xs uppercase text-surface-400 font-bold">Itens</p>
                                    <p className="text-xs text-surface-700">
                                        {insp.checklist_data ? Object.keys(insp.checklist_data).length : 0} verificados
                                    </p>
                                </div>
                            </div>

                            {insp.observations && (
                                <p className="text-xs text-surface-500 italic line-clamp-2">{insp.observations}</p>
                            )}

                            <Button size="xs" variant="outline" icon={<Eye size={12} />} className="w-full" onClick={() => setDetailInspection(insp)}>
                                Ver Checklist
                              </Button>
                        </div>
                    )
                })}
        {!isLoading && (!inspections?.data || inspections.data.length === 0) && (
          <div className="col-span-full py-20 text-center border-2 border-dashed border-surface-200 rounded-3xl">
            <ClipboardList size={40} className="mx-auto text-surface-200 mb-4" />
            <p className="text-surface-500 font-medium">Nenhuma inspeção encontrada</p>
          </div>
        )}
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-surface-0 rounded-2xl border border-default shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-surface-900">Nova Inspeção</h3>
              <button
                type="button"
                onClick={closeForm}
                className="p-2 rounded-lg hover:bg-surface-100 text-surface-500 hover:text-surface-700"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-surface-600 mb-1">Veículo *</label>
                <select
                  value={formData.fleet_vehicle_id}
                  onChange={e => setFormData(f => ({ ...f, fleet_vehicle_id: e.target.value }))}
                  required
                  className="w-full rounded-xl border border-default bg-surface-0 py-2 px-3 text-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
                >
                  <option value="">Selecione...</option>
                  {vehicles.map((v: any) => (
                    <option key={v.id} value={v.id}>{v.plate} — {v.brand} {v.model}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-surface-600 mb-1">Data da Inspeção *</label>
                  <input
                    type="date"
                    value={formData.inspection_date}
                    onChange={e => setFormData(f => ({ ...f, inspection_date: e.target.value }))}
                    required
                    className="w-full rounded-xl border border-default bg-surface-0 py-2 px-3 text-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-surface-600 mb-1">Odômetro (km) *</label>
                  <input
                    type="number"
                    min={0}
                    value={formData.odometer_km}
                    onChange={e => setFormData(f => ({ ...f, odometer_km: e.target.value }))}
                    required
                    placeholder="0"
                    className="w-full rounded-xl border border-default bg-surface-0 py-2 px-3 text-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-surface-600 mb-1">Status *</label>
                <select
                  value={formData.status}
                  onChange={e => setFormData(f => ({ ...f, status: e.target.value as 'ok' | 'issues_found' | 'critical' }))}
                  required
                  className="w-full rounded-xl border border-default bg-surface-0 py-2 px-3 text-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
                >
                  <option value="ok">OK</option>
                  <option value="issues_found">Pendências</option>
                  <option value="critical">Crítico</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-surface-600 mb-2">Checklist</label>
                <div className="grid grid-cols-2 gap-3">
                  {CHECKLIST_ITEMS.map(({ key, label }) => (
                    <div key={key}>
                      <label className="block text-xs text-surface-500 mb-0.5">{label}</label>
                      <select
                        value={formData.checklist_data[key] ?? 'na'}
                        onChange={e => setFormData(f => ({
                          ...f,
                          checklist_data: { ...f.checklist_data, [key]: e.target.value as 'ok' | 'nok' | 'na' },
                        }))}
                        className="w-full rounded-xl border border-default bg-surface-0 py-1.5 px-2 text-xs focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
                      >
                        <option value="ok">OK</option>
                        <option value="nok">NOK</option>
                        <option value="na">N/A</option>
                      </select>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-surface-600 mb-1">Observações</label>
                <textarea
                  value={formData.observations}
                  onChange={e => setFormData(f => ({ ...f, observations: e.target.value }))}
                  rows={3}
                  placeholder="Observações adicionais..."
                  className="w-full rounded-xl border border-default bg-surface-0 py-2 px-3 text-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100 resize-none"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <Button type="button" variant="outline" onClick={closeForm} className="flex-1">
                  Cancelar
                </Button>
                <Button type="submit" disabled={isSaving} className="flex-1">
                  {isSaving ? 'Salvando...' : 'Salvar'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {detailInspection && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-surface-0 rounded-2xl border border-default shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-surface-900">Checklist da Inspeção</h3>
              <button
                type="button"
                onClick={() => setDetailInspection(null)}
                className="p-2 rounded-lg hover:bg-surface-100 text-surface-500 hover:text-surface-700"
              >
                <X size={20} />
              </button>
            </div>

            <div>
              <p className="text-sm font-bold text-surface-900">{detailInspection.vehicle?.plate} — {detailInspection.vehicle?.model}</p>
              <p className="text-xs text-surface-500">{new Date(detailInspection.inspection_date).toLocaleDateString()} • {Number(detailInspection.odometer_km).toLocaleString()} km</p>
            </div>

            {detailInspection.checklist_data && Object.keys(detailInspection.checklist_data).length > 0 ? (
              <div className="grid grid-cols-2 gap-2">
                {(Object.keys(detailInspection.checklist_data) as string[]).map(key => {
                  const label = CHECKLIST_ITEMS.find(i => i.key === key)?.label ?? key
                  const val = detailInspection.checklist_data[key] || 'na'
                  return (
                    <div key={key} className="flex items-center justify-between py-2 border-b border-subtle last:border-0">
                      <span className="text-sm text-surface-700">{label}</span>
                      <span className={cn('px-2 py-0.5 rounded-md text-xs font-medium', checklistBadgeVariant[val] || checklistBadgeVariant.na)}>
                        {val === 'ok' ? 'OK' : val === 'nok' ? 'NOK' : 'N/A'}
                      </span>
                    </div>
                  )
                })}
              </div>
            ) : (
              <p className="text-sm text-surface-500 italic">Nenhum item de checklist registrado.</p>
            )}

            {detailInspection.observations && (
              <div>
                <p className="text-xs font-semibold text-surface-600 mb-1">Observações</p>
                <p className="text-sm text-surface-700 whitespace-pre-wrap">{detailInspection.observations}</p>
              </div>
            )}

            <Button variant="outline" onClick={() => setDetailInspection(null)} className="w-full">
              Fechar
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
