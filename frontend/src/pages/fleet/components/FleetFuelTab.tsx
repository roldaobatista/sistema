import { useState, useMemo, useEffect } from 'react'
import { toast } from 'sonner'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Fuel, Calendar, Search, Plus, X } from 'lucide-react'
import api from '@/lib/api'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

const FUEL_TYPES = [
  { value: 'flex', label: 'Flex' },
  { value: 'diesel', label: 'Diesel' },
  { value: 'gasoline', label: 'Gasolina' },
  { value: 'ethanol', label: 'Etanol' },
  { value: 'electric', label: 'Elétrico' },
] as const

const initialForm = {
  fleet_vehicle_id: '',
  date: new Date().toISOString().slice(0, 10),
  odometer_km: '',
  liters: '',
  price_per_liter: '',
  total_value: '',
  fuel_type: 'flex',
  gas_station: '',
}

export function FleetFuelTab() {
  const queryClient = useQueryClient()

  const [vehicleFilter, setVehicleFilter] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(initialForm)

  const { data: fuelLogs, isLoading } = useQuery({
    queryKey: ['fleet-fuel-logs', vehicleFilter],
    queryFn: () => api.get('/fleet/fuel-logs', { params: { search: vehicleFilter || undefined } }).then(r => r.data),
  })

  const { data: vehiclesData } = useQuery({
    queryKey: ['fleet-vehicles-select'],
    queryFn: () => api.get('/fleet/vehicles', { params: { per_page: 100 } }).then(r => r.data),
    enabled: showForm,
  })

  const vehicles = vehiclesData?.data ?? []

  const createMutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) => api.post('/fleet/fuel-logs', payload),
    onSuccess: () => {
      toast.success('Abastecimento registrado com sucesso')
      queryClient.invalidateQueries({ queryKey: ['fleet-fuel-logs'] })
      setShowForm(false)
      setForm(initialForm)
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { message?: string; errors?: Record<string, string[]> } } })?.response?.data
      const message = msg?.message || (msg?.errors ? Object.values(msg.errors).flat().join(', ') : 'Erro ao registrar abastecimento')
      toast.error(message)
    },
  })

  const totalValue = useMemo(() => {
    const l = parseFloat(form.liters) || 0
    const p = parseFloat(form.price_per_liter) || 0
    return (l * p).toFixed(2)
  }, [form.liters, form.price_per_liter])

  useEffect(() => {
    setForm(prev => ({ ...prev, total_value: totalValue }))
  }, [totalValue])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const payload = {
      fleet_vehicle_id: Number(form.fleet_vehicle_id),
      date: form.date,
      odometer_km: Number(form.odometer_km),
      liters: Number(form.liters),
      price_per_liter: Number(form.price_per_liter),
      total_value: Number(form.total_value),
      fuel_type: form.fuel_type,
      gas_station: form.gas_station || undefined,
    }
    createMutation.mutate(payload)
  }

  const fuelTypeLabels: Record<string, string> = {
    flex: 'Flex', diesel: 'Diesel', gasoline: 'Gasolina', ethanol: 'Etanol', electric: 'Elétrico',
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="relative w-full sm:max-w-xs">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-400" />
          <input
            type="text"
            placeholder="Filtrar por placa..."
            value={vehicleFilter}
            onChange={e => setVehicleFilter(e.target.value)}
            className="w-full rounded-xl border border-default bg-surface-0 py-2.5 pl-10 pr-4 text-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100 transition-all"
          />
        </div>
        <Button icon={<Plus size={16} />} onClick={() => setShowForm(true)} className="w-full sm:w-auto">
          Novo Abastecimento
        </Button>
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-surface-0 rounded-2xl border border-default shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-surface-900">Novo Abastecimento</h3>
              <button
                type="button"
                onClick={() => { setShowForm(false); setForm(initialForm) }}
                className="p-1.5 rounded-lg hover:bg-surface-100 text-surface-500 hover:text-surface-700"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-xs font-semibold text-surface-600 mb-1">Veículo *</label>
                  <select
                    required
                    value={form.fleet_vehicle_id}
                    onChange={e => setForm(prev => ({ ...prev, fleet_vehicle_id: e.target.value }))}
                    className="w-full rounded-xl border border-default bg-surface-0 py-2 px-3 text-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
                  >
                    <option value="">Selecione...</option>
                    {vehicles.map((v: { id: number; plate?: string; license_plate?: string; brand?: string; model?: string }) => (
                      <option key={v.id} value={v.id}>
                        {(v.plate || v.license_plate || '')} - {(v.brand || '')} {(v.model || '')}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-surface-600 mb-1">Data *</label>
                  <input
                    type="date"
                    required
                    value={form.date}
                    onChange={e => setForm(prev => ({ ...prev, date: e.target.value }))}
                    className="w-full rounded-xl border border-default bg-surface-0 py-2 px-3 text-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-surface-600 mb-1">Odômetro (km) *</label>
                  <input
                    type="number"
                    required
                    min={0}
                    step={1}
                    value={form.odometer_km}
                    onChange={e => setForm(prev => ({ ...prev, odometer_km: e.target.value }))}
                    className="w-full rounded-xl border border-default bg-surface-0 py-2 px-3 text-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-surface-600 mb-1">Litros *</label>
                  <input
                    type="number"
                    required
                    min={0}
                    step={0.01}
                    value={form.liters}
                    onChange={e => setForm(prev => ({ ...prev, liters: e.target.value }))}
                    className="w-full rounded-xl border border-default bg-surface-0 py-2 px-3 text-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-surface-600 mb-1">Preço/Litro (R$) *</label>
                  <input
                    type="number"
                    required
                    min={0}
                    step={0.001}
                    value={form.price_per_liter}
                    onChange={e => setForm(prev => ({ ...prev, price_per_liter: e.target.value }))}
                    className="w-full rounded-xl border border-default bg-surface-0 py-2 px-3 text-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-surface-600 mb-1">Valor Total (R$) *</label>
                  <input
                    type="text"
                    readOnly
                    value={form.total_value ? `R$ ${form.total_value}` : ''}
                    className="w-full rounded-xl border border-default bg-surface-50 py-2 px-3 text-sm text-surface-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-surface-600 mb-1">Combustível</label>
                  <select
                    value={form.fuel_type}
                    onChange={e => setForm(prev => ({ ...prev, fuel_type: e.target.value }))}
                    className="w-full rounded-xl border border-default bg-surface-0 py-2 px-3 text-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
                  >
                    {FUEL_TYPES.map(t => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </div>

                <div className="md:col-span-2">
                  <label className="block text-xs font-semibold text-surface-600 mb-1">Posto</label>
                  <input
                    type="text"
                    value={form.gas_station}
                    onChange={e => setForm(prev => ({ ...prev, gas_station: e.target.value }))}
                    placeholder="Nome do posto"
                    className="w-full rounded-xl border border-default bg-surface-0 py-2 px-3 text-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <Button type="submit" loading={createMutation.isPending} className="flex-1">
                  Salvar
                </Button>
                <Button type="button" variant="outline" onClick={() => { setShowForm(false); setForm(initialForm) }}>
                  Cancelar
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

            <div className="overflow-x-auto rounded-2xl border border-default">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="bg-surface-50 border-b border-default">
                            <th className="px-4 py-3 text-left text-xs uppercase font-bold text-surface-500">Data</th>
                            <th className="px-4 py-3 text-left text-xs uppercase font-bold text-surface-500">Veículo</th>
                            <th className="px-4 py-3 text-left text-xs uppercase font-bold text-surface-500">Combustível</th>
                            <th className="px-4 py-3 text-right text-xs uppercase font-bold text-surface-500">Litros</th>
                            <th className="px-4 py-3 text-right text-xs uppercase font-bold text-surface-500">R$/L</th>
                            <th className="px-4 py-3 text-right text-xs uppercase font-bold text-surface-500">Total</th>
                            <th className="px-4 py-3 text-right text-xs uppercase font-bold text-surface-500">Odômetro</th>
                        </tr>
                    </thead>
                    <tbody>
                        {isLoading && [1, 2, 3].map(i => (
                            <tr key={i}><td colSpan={7} className="px-4 py-3"><div className="h-4 bg-surface-100 animate-pulse rounded" /></td></tr>
                        ))}
                        {fuelLogs?.data?.map((log: any) => (
                            <tr key={log.id} className="border-b border-subtle hover:bg-surface-50 transition-colors">
                                <td className="px-4 py-3 text-surface-700 font-medium flex items-center gap-2">
                                    <Calendar size={14} className="text-surface-400" />
                                    {new Date(log.log_date).toLocaleDateString()}
                                </td>
                                <td className="px-4 py-3">
                                    <span className="px-2 py-0.5 bg-surface-900 text-white text-xs font-mono rounded font-bold tracking-wider">
                                        {log.vehicle?.plate || '—'}
                                    </span>
                                </td>
                                <td className="px-4 py-3">
                                    <Badge variant="info">{fuelTypeLabels[log.fuel_type] || log.fuel_type}</Badge>
                                </td>
                                <td className="px-4 py-3 text-right font-mono text-surface-700">{Number(log.liters).toFixed(1)}L</td>
                                <td className="px-4 py-3 text-right font-mono text-surface-500">R$ {Number(log.price_per_liter).toFixed(3)}</td>
                                <td className="px-4 py-3 text-right font-bold text-brand-600">R$ {Number(log.total_price).toFixed(2)}</td>
                                <td className="px-4 py-3 text-right font-mono text-surface-500">{Number(log.odometer_km).toLocaleString()} km</td>
                            </tr>
                        ))}
                        {!isLoading && (!fuelLogs?.data || fuelLogs.data.length === 0) && (
                            <tr>
                                <td colSpan={7} className="py-16 text-center text-surface-400">
                                    <Fuel size={32} className="mx-auto mb-3 text-surface-200" />
                                    Nenhum abastecimento registrado
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    )
}
