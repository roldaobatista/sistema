import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, Camera, Calendar, DollarSign, MapPin, Eye, Trash2, X, Plus } from 'lucide-react'
import api from '@/lib/api'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'

const initialFormData = {
  fleet_vehicle_id: '',
  occurrence_date: new Date().toISOString().slice(0, 10),
  location: '',
  description: '',
  third_party_involved: false,
  third_party_info: '',
  police_report_number: '',
  estimated_cost: '',
  status: 'investigating' as const,
}

const STATUS_OPTIONS = [
  { value: 'investigating', label: 'Em Investigação' },
  { value: 'insurance_claim', label: 'Sinistro Seguro' },
  { value: 'repaired', label: 'Reparado' },
  { value: 'loss', label: 'Perda Total' },
]

export function FleetAccidentsTab() {
  const queryClient = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [formData, setFormData] = useState(initialFormData)
  const [detailAccident, setDetailAccident] = useState<any>(null)
  const { data: accidents, isLoading } = useQuery({
    queryKey: ['fleet-accidents'],
    queryFn: () => api.get('/fleet/accidents').then(r => r.data),
  })

  const { data: vehiclesData } = useQuery({
    queryKey: ['fleet-vehicles-select'],
    queryFn: () => api.get('/fleet/vehicles', { params: { per_page: 100 } }).then(r => r.data),
    enabled: showForm,
  })

  const createMutation = useMutation({
    mutationFn: (payload: typeof initialFormData) =>
      api.post('/fleet/accidents', {
        fleet_vehicle_id: Number(payload.fleet_vehicle_id),
        occurrence_date: payload.occurrence_date,
        location: payload.location || undefined,
        description: payload.description,
        third_party_involved: payload.third_party_involved,
        third_party_info: payload.third_party_involved ? payload.third_party_info : undefined,
        police_report_number: payload.police_report_number || undefined,
        estimated_cost: payload.estimated_cost ? Number(payload.estimated_cost) : undefined,
        status: payload.status,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fleet-accidents'] })
      toast.success('Sinistro registrado com sucesso')
      closeForm()
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.message
      const errors = err?.response?.data?.errors
      if (errors) {
        const first = Object.values(errors).flat()[0]
        toast.error(typeof first === 'string' ? first : 'Validação falhou')
      } else {
        toast.error(msg || 'Erro ao registrar sinistro')
      }
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/fleet/accidents/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fleet-accidents'] })
      toast.success('Registro de sinistro removido')
    },
    onError: () => toast.error('Erro ao remover sinistro'),
  })

  const statusMap: Record<string, { label: string; variant: any }> = {
    open: { label: 'Aberto', variant: 'danger' },
    investigating: { label: 'Em Investigação', variant: 'warning' },
    insurance_claim: { label: 'Sinistro Seguro', variant: 'warning' },
    repaired: { label: 'Reparado', variant: 'success' },
    loss: { label: 'Perda Total', variant: 'danger' },
    closed: { label: 'Encerrado', variant: 'secondary' },
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
    if (!formData.occurrence_date) {
      toast.error('Informe a data da ocorrência')
      return
    }
    if (!formData.description?.trim()) {
      toast.error('Informe a descrição')
      return
    }
    createMutation.mutate(formData)
  }

  const vehicles = vehiclesData?.data ?? []
  const isSaving = createMutation.isPending

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-surface-700">Sinistros e Acidentes</h3>
        <Button size="sm" icon={<Plus size={14} />} onClick={openCreate}>
          Registrar Sinistro
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {isLoading && [1, 2].map(i => <div key={i} className="h-52 bg-surface-100 animate-pulse rounded-2xl" />)}
        {accidents?.data?.map((acc: any) => {
          const dateVal = acc.occurrence_date || acc.accident_date
          const reportVal = acc.police_report_number || acc.report_number
          const costVal = acc.estimated_cost ?? acc.cost
          return (
            <div key={acc.id} className="group p-5 rounded-2xl border border-default bg-surface-0 transition-all space-y-4">
              <div className="flex items-center justify-between">
                <Badge variant={statusMap[acc.status]?.variant}>{statusMap[acc.status]?.label}</Badge>
                <span className="text-xs text-surface-400 font-mono">B.O. {reportVal || '—'}</span>
              </div>

              <div>
                <h4 className="font-bold text-surface-900">{acc.vehicle?.plate} — {acc.vehicle?.model}</h4>
                <p className="text-xs text-surface-500">Motorista: {acc.driver?.name || 'Não identificado'}</p>
              </div>

              <div className="grid grid-cols-3 gap-3 py-3 border-y border-subtle">
                <div>
                  <p className="text-xs uppercase text-surface-400 font-bold">Data</p>
                  <p className="text-xs font-medium text-surface-700 flex items-center gap-1">
                    <Calendar size={12} className="text-surface-400" />
                    {dateVal ? new Date(dateVal).toLocaleDateString() : '—'}
                  </p>
                </div>
                <div>
                  <p className="text-xs uppercase text-surface-400 font-bold">Odômetro</p>
                  <p className="text-xs font-mono text-surface-700">{acc.odometer_km ? `${Number(acc.odometer_km).toLocaleString()} km` : '—'}</p>
                </div>
                <div>
                  <p className="text-xs uppercase text-surface-400 font-bold">Custo Est.</p>
                  <p className="text-xs font-bold text-red-600 flex items-center gap-1">
                    <DollarSign size={12} /> {costVal != null ? `R$ ${Number(costVal).toLocaleString()}` : '—'}
                  </p>
                </div>
              </div>

              {acc.description && <p className="text-xs text-surface-600 line-clamp-2">{acc.description}</p>}

              {acc.photos && acc.photos.length > 0 && (
                <div className="flex items-center gap-2 text-xs text-surface-500">
                  <Camera size={14} className="text-surface-400" />
                  {acc.photos.length} foto(s) anexada(s)
                </div>
              )}

              <div className="flex gap-2 pt-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <Button size="xs" variant="outline" icon={<Eye size={12} />} className="flex-1" onClick={() => setDetailAccident(acc)}>
                  Detalhes
                </Button>
                <Button size="xs" variant="ghost" className="text-red-400" onClick={() => {
                  if (confirm('Remover registro de sinistro?')) deleteMutation.mutate(acc.id)
                }}>
                  <Trash2 size={12} />
                </Button>
              </div>
            </div>
          )
        })}
        {!isLoading && (!accidents?.data || accidents.data.length === 0) && (
          <div className="col-span-full py-20 text-center border-2 border-dashed border-surface-200 rounded-3xl">
            <AlertTriangle size={40} className="mx-auto text-surface-200 mb-4" />
            <p className="text-surface-500 font-medium">Nenhum sinistro registrado</p>
          </div>
        )}
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-surface-0 rounded-2xl border border-default shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-surface-900">Registrar Sinistro</h3>
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
                    required
                    className="w-full rounded-xl border border-default bg-surface-0 py-2 px-3 text-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
                  >
                    <option value="">Selecione...</option>
                    {vehicles.map((v: any) => (
                      <option key={v.id} value={v.id}>{v.plate} — {v.brand} {v.model}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-surface-600 mb-1">Data da Ocorrência *</label>
                  <input
                    type="date"
                    value={formData.occurrence_date}
                    onChange={e => setFormData(f => ({ ...f, occurrence_date: e.target.value }))}
                    required
                    className="w-full rounded-xl border border-default bg-surface-0 py-2 px-3 text-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-surface-600 mb-1">Local</label>
                <input
                  type="text"
                  value={formData.location}
                  onChange={e => setFormData(f => ({ ...f, location: e.target.value }))}
                  placeholder="Endereço ou local do acidente"
                  className="w-full rounded-xl border border-default bg-surface-0 py-2 px-3 text-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-surface-600 mb-1">Descrição *</label>
                <textarea
                  value={formData.description}
                  onChange={e => setFormData(f => ({ ...f, description: e.target.value }))}
                  required
                  rows={3}
                  placeholder="Descreva o ocorrido..."
                  className="w-full rounded-xl border border-default bg-surface-0 py-2 px-3 text-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100 resize-none"
                />
              </div>

              <div>
                <label className="flex items-center gap-2 text-sm text-surface-700">
                  <input
                    type="checkbox"
                    checked={formData.third_party_involved}
                    onChange={e => setFormData(f => ({ ...f, third_party_involved: e.target.checked }))}
                    className="rounded border-default"
                  />
                  Terceiros Envolvidos
                </label>
              </div>

              {formData.third_party_involved && (
                <div>
                  <label className="block text-xs font-semibold text-surface-600 mb-1">Informações Terceiros</label>
                  <input
                    type="text"
                    value={formData.third_party_info}
                    onChange={e => setFormData(f => ({ ...f, third_party_info: e.target.value }))}
                    placeholder="Dados dos terceiros envolvidos"
                    className="w-full rounded-xl border border-default bg-surface-0 py-2 px-3 text-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-surface-600 mb-1">Nº Boletim de Ocorrência</label>
                  <input
                    type="text"
                    value={formData.police_report_number}
                    onChange={e => setFormData(f => ({ ...f, police_report_number: e.target.value }))}
                    placeholder="Número do B.O."
                    className="w-full rounded-xl border border-default bg-surface-0 py-2 px-3 text-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-surface-600 mb-1">Custo Estimado (R$)</label>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={formData.estimated_cost}
                    onChange={e => setFormData(f => ({ ...f, estimated_cost: e.target.value }))}
                    placeholder="0,00"
                    className="w-full rounded-xl border border-default bg-surface-0 py-2 px-3 text-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-surface-600 mb-1">Status *</label>
                <select
                  value={formData.status}
                  onChange={e => setFormData(f => ({ ...f, status: e.target.value as typeof formData.status }))}
                  required
                  className="w-full rounded-xl border border-default bg-surface-0 py-2 px-3 text-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
                >
                  {STATUS_OPTIONS.map(s => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
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

      {detailAccident && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-surface-0 rounded-2xl border border-default shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-surface-900">Detalhes do Sinistro</h3>
              <button
                type="button"
                onClick={() => setDetailAccident(null)}
                className="p-2 rounded-lg hover:bg-surface-100 text-surface-500 hover:text-surface-700"
              >
                <X size={20} />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs uppercase text-surface-400 font-bold mb-1">Veículo</p>
                <p className="text-sm font-medium text-surface-900">{detailAccident.vehicle?.plate} — {detailAccident.vehicle?.model}</p>
              </div>
              <div>
                <p className="text-xs uppercase text-surface-400 font-bold mb-1">Motorista</p>
                <p className="text-sm text-surface-700">{detailAccident.driver?.name || 'Não identificado'}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs uppercase text-surface-400 font-bold mb-1">Data da Ocorrência</p>
                <p className="text-sm text-surface-700 flex items-center gap-1">
                  <Calendar size={14} className="text-surface-400" />
                  {(detailAccident.occurrence_date || detailAccident.accident_date)
                    ? new Date(detailAccident.occurrence_date || detailAccident.accident_date).toLocaleDateString()
                    : '—'}
                </p>
              </div>
              <div>
                <p className="text-xs uppercase text-surface-400 font-bold mb-1">Status</p>
                <Badge variant={statusMap[detailAccident.status]?.variant}>{statusMap[detailAccident.status]?.label}</Badge>
              </div>
            </div>

            {detailAccident.location && (
              <div>
                <p className="text-xs uppercase text-surface-400 font-bold mb-1">Local</p>
                <p className="text-sm text-surface-700 flex items-center gap-1">
                  <MapPin size={14} className="text-surface-400 shrink-0" />
                  {detailAccident.location}
                </p>
              </div>
            )}

            <div>
              <p className="text-xs uppercase text-surface-400 font-bold mb-1">Descrição</p>
              <p className="text-sm text-surface-700 whitespace-pre-wrap">{detailAccident.description || '—'}</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs uppercase text-surface-400 font-bold mb-1">Custo Estimado</p>
                <p className="text-sm font-bold text-red-600 flex items-center gap-1">
                  <DollarSign size={14} />
                  {(detailAccident.estimated_cost ?? detailAccident.cost) != null
                    ? `R$ ${Number(detailAccident.estimated_cost ?? detailAccident.cost).toLocaleString()}`
                    : '—'}
                </p>
              </div>
              <div>
                <p className="text-xs uppercase text-surface-400 font-bold mb-1">Nº Boletim de Ocorrência</p>
                <p className="text-sm text-surface-700 font-mono">{detailAccident.police_report_number || detailAccident.report_number || '—'}</p>
              </div>
            </div>

            {detailAccident.third_party_involved && (
              <div>
                <p className="text-xs uppercase text-surface-400 font-bold mb-1">Terceiros Envolvidos</p>
                <p className="text-sm text-surface-700">{detailAccident.third_party_info || 'Sim (sem detalhes)'}</p>
              </div>
            )}

            {detailAccident.photos && detailAccident.photos.length > 0 && (
              <div>
                <p className="text-xs uppercase text-surface-400 font-bold mb-1">Fotos</p>
                <div className="flex items-center gap-2 text-sm text-surface-600">
                  <Camera size={16} className="text-surface-400" />
                  {detailAccident.photos.length} foto(s) anexada(s)
                </div>
              </div>
            )}

            <Button variant="outline" onClick={() => setDetailAccident(null)} className="w-full">
              Fechar
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
