import React, { useState } from 'react'
import { toast } from 'sonner'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation } from '@tanstack/react-query'
import { ArrowLeft, Save, Loader2, Scale } from 'lucide-react'
import api from '@/lib/api'
import { cn } from '@/lib/utils'
import { PageHeader } from '@/components/ui/pageheader'

export default function EquipmentCreatePage() {
    const navigate = useNavigate()

    const { data: constants, isError: constantsError } = useQuery({
        queryKey: ['equipments-constants'],
        queryFn: () => api.get('/equipments-constants').then(r => r.data),
        meta: { errorMessage: 'Erro ao carregar constantes de equipamentos' },
    })

    const { data: customers, isError: customersError } = useQuery({
        queryKey: ['customers-list'],
        queryFn: () => api.get('/customers?per_page=100').then(r => r.data.data),
        meta: { errorMessage: 'Erro ao carregar lista de clientes' },
    })

    const [form, setForm] = useState({
        customer_id: '',
        type: 'Balança',
        category: 'balanca_plataforma',
        brand: '',
        manufacturer: '',
        model: '',
        serial_number: '',
        capacity: '',
        capacity_unit: 'kg',
        resolution: '',
        precision_class: '',
        location: '',
        calibration_interval_months: '12',
        inmetro_number: '',
        tag: '',
        is_critical: false,
        notes: '',
        purchase_value: '',
    })

    const mutation = useMutation({
        mutationFn: (data: any) => api.post('/equipments', data),
        onSuccess: (r) => {
            toast.success('Equipamento criado com sucesso!')
            navigate(`/equipamentos/${r.data.equipment.id}`)
        },
        onError: (err: any) => {
            if (err.response?.status === 422) {
                const errors = err.response.data?.errors
                if (errors) {
                    const firstError = Object.values(errors).flat()[0] as string
                    toast.error(firstError || 'Verifique os campos obrigatórios')
                } else {
                    toast.error('Verifique os campos obrigatórios')
                }
            } else if (err.response?.status === 403) {
                toast.error('Sem permissão para criar equipamentos')
            } else {
                toast.error(err.response?.data?.message || 'Erro ao criar equipamento')
            }
        },
    })

    const update = (key: string, val: any) => setForm(f => ({ ...f, [key]: val }))

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        mutation.mutate({
            ...form,
            customer_id: +form.customer_id || undefined,
            capacity: form.capacity ? +form.capacity : null,
            resolution: form.resolution ? +form.resolution : null,
            purchase_value: form.purchase_value ? +form.purchase_value : null,
            calibration_interval_months: form.calibration_interval_months ? +form.calibration_interval_months : null,
        })
    }

    const cats = constants?.categories ?? {}
    const classes = constants?.precision_classes ?? {}

    return (
        <div className="space-y-5">
            <PageHeader
                title="Novo Equipamento"
                subtitle="Cadastrar equipamento / instrumento de medição"
                backTo="/equipamentos"
            />

            <form onSubmit={handleSubmit} className="space-y-5">
                {/* Identificação */}
                <div className="rounded-xl border border-default bg-surface-0 p-6 shadow-card">
                    <h3 className="mb-4 flex items-center gap-2 font-semibold text-surface-900">
                        <Scale size={18} className="text-brand-500" />
                        Identificação
                    </h3>
                    <div className="grid grid-cols-3 gap-4">
                        <div>
                            <label className="mb-1 block text-xs font-medium text-surface-600">Cliente *</label>
                            <select value={form.customer_id} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => update('customer_id', e.target.value)} required className="w-full rounded-lg border border-surface-200 px-3 py-2.5 text-sm">
                                <option value="">Selecione...</option>
                                {(customers ?? []).map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="mb-1 block text-xs font-medium text-surface-600">Tipo *</label>
                            <input value={form.type} onChange={(e: React.ChangeEvent<HTMLInputElement>) => update('type', e.target.value)} required className="w-full rounded-lg border border-surface-200 px-3 py-2.5 text-sm" placeholder="Ex: Balança, Termômetro" />
                        </div>
                        <div>
                            <label className="mb-1 block text-xs font-medium text-surface-600">Categoria</label>
                            <select value={form.category} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => update('category', e.target.value)} className="w-full rounded-lg border border-surface-200 px-3 py-2.5 text-sm">
                                {Object.entries(cats).map(([k, v]) => <option key={k} value={k}>{v as string}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="mb-1 block text-xs font-medium text-surface-600">Marca</label>
                            <input value={form.brand} onChange={(e: React.ChangeEvent<HTMLInputElement>) => update('brand', e.target.value)} className="w-full rounded-lg border border-surface-200 px-3 py-2.5 text-sm" placeholder="Ex: Toledo, Marte" />
                        </div>
                        <div>
                            <label className="mb-1 block text-xs font-medium text-surface-600">Fabricante</label>
                            <input value={form.manufacturer} onChange={(e: React.ChangeEvent<HTMLInputElement>) => update('manufacturer', e.target.value)} className="w-full rounded-lg border border-surface-200 px-3 py-2.5 text-sm" />
                        </div>
                        <div>
                            <label className="mb-1 block text-xs font-medium text-surface-600">Modelo</label>
                            <input value={form.model} onChange={(e: React.ChangeEvent<HTMLInputElement>) => update('model', e.target.value)} className="w-full rounded-lg border border-surface-200 px-3 py-2.5 text-sm" placeholder="Ex: 2098" />
                        </div>
                        <div>
                            <label className="mb-1 block text-xs font-medium text-surface-600">NÂº Série</label>
                            <input value={form.serial_number} onChange={(e: React.ChangeEvent<HTMLInputElement>) => update('serial_number', e.target.value)} className="w-full rounded-lg border border-surface-200 px-3 py-2.5 text-sm" />
                        </div>
                        <div>
                            <label className="mb-1 block text-xs font-medium text-surface-600">Tag / Patrimônio</label>
                            <input value={form.tag} onChange={(e: React.ChangeEvent<HTMLInputElement>) => update('tag', e.target.value)} className="w-full rounded-lg border border-surface-200 px-3 py-2.5 text-sm" />
                        </div>
                        <div>
                            <label className="mb-1 block text-xs font-medium text-surface-600">Localização</label>
                            <input value={form.location} onChange={(e: React.ChangeEvent<HTMLInputElement>) => update('location', e.target.value)} className="w-full rounded-lg border border-surface-200 px-3 py-2.5 text-sm" />
                        </div>
                    </div>
                </div>

                {/* Especificações Técnicas */}
                <div className="rounded-xl border border-default bg-surface-0 p-6 shadow-card">
                    <h3 className="mb-4 font-semibold text-surface-900">Especificações Técnicas</h3>
                    <div className="grid grid-cols-3 gap-4">
                        <div>
                            <label className="mb-1 block text-xs font-medium text-surface-600">Capacidade</label>
                            <div className="flex gap-2">
                                <input type="number" step="any" value={form.capacity} onChange={(e: React.ChangeEvent<HTMLInputElement>) => update('capacity', e.target.value)} className="flex-1 rounded-lg border border-surface-200 px-3 py-2.5 text-sm" />
                                <select value={form.capacity_unit} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => update('capacity_unit', e.target.value)} className="w-20 rounded-lg border border-surface-200 px-2 py-2.5 text-sm">
                                    <option>kg</option><option>g</option><option>mg</option><option>t</option>
                                </select>
                            </div>
                        </div>
                        <div>
                            <label className="mb-1 block text-xs font-medium text-surface-600">Resolução</label>
                            <input type="number" step="any" value={form.resolution} onChange={(e: React.ChangeEvent<HTMLInputElement>) => update('resolution', e.target.value)} className="w-full rounded-lg border border-surface-200 px-3 py-2.5 text-sm" />
                        </div>
                        <div>
                            <label className="mb-1 block text-xs font-medium text-surface-600">Classe de Precisão</label>
                            <select value={form.precision_class} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => update('precision_class', e.target.value)} className="w-full rounded-lg border border-surface-200 px-3 py-2.5 text-sm">
                                <option value="">â€”</option>
                                {Object.entries(classes).map(([k, v]) => <option key={k} value={k}>{v as string}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="mb-1 block text-xs font-medium text-surface-600">NÂº INMETRO</label>
                            <input value={form.inmetro_number} onChange={(e: React.ChangeEvent<HTMLInputElement>) => update('inmetro_number', e.target.value)} className="w-full rounded-lg border border-surface-200 px-3 py-2.5 text-sm" />
                        </div>
                        <div>
                            <label className="mb-1 block text-xs font-medium text-surface-600">Intervalo Calibração (meses)</label>
                            <input type="number" value={form.calibration_interval_months} onChange={(e: React.ChangeEvent<HTMLInputElement>) => update('calibration_interval_months', e.target.value)} className="w-full rounded-lg border border-surface-200 px-3 py-2.5 text-sm" />
                        </div>
                        <div className="flex items-end">
                            <label className="flex cursor-pointer items-center gap-2">
                                <input type="checkbox" checked={form.is_critical} onChange={(e: React.ChangeEvent<HTMLInputElement>) => update('is_critical', e.target.checked)} className="accent-red-600" />
                                <span className="text-[13px] font-medium text-surface-700">Equipamento Crítico</span>
                            </label>
                        </div>
                    </div>
                </div>

                {/* Observações */}
                <div className="rounded-xl border border-default bg-surface-0 p-6 shadow-card">
                    <h3 className="mb-4 font-semibold text-surface-900">Observações</h3>
                    <textarea
                        value={form.notes}
                        onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => update('notes', e.target.value)}
                        rows={3}
                        className="w-full rounded-lg border border-surface-200 px-3 py-2.5 text-sm"
                        placeholder="Observações gerais sobre o equipamento..."
                    />
                </div>

                {/* Actions */}
                <div className="flex justify-end gap-3">
                    <button type="button" onClick={() => navigate('/equipamentos')} className="rounded-lg border border-surface-200 px-4 py-2.5 text-sm hover:bg-surface-50">
                        Cancelar
                    </button>
                    <button
                        type="submit"
                        disabled={mutation.isPending || !form.customer_id}
                        className="flex items-center gap-2 rounded-lg bg-brand-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
                    >
                        {mutation.isPending ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                        Salvar Equipamento
                    </button>
                </div>
            </form>
        </div>
    )
}