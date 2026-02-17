import React, { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Save, Loader2, Scale, Plus, X } from 'lucide-react'
import api from '@/lib/api'
import {
    Dialog, DialogContent, DialogHeader, DialogBody, DialogFooter,
    DialogTitle, DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

interface QuickEquipmentModalProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    customerId: number
    customerName?: string
}

/**
 * Inline component: select with existing options + "+" button to add new value.
 */
function SelectWithAdd({
    label, required, value, onChange, options, placeholder,
}: {
    label: string; required?: boolean; value: string
    onChange: (v: string) => void; options: string[]; placeholder?: string
}) {
    const [adding, setAdding] = useState(false)
    const [customValue, setCustomValue] = useState('')

    const handleAdd = () => {
        if (customValue.trim()) {
            onChange(customValue.trim())
            setCustomValue('')
            setAdding(false)
        }
    }

    return (
        <div>
            <label className="mb-1 block text-xs font-medium text-surface-600">
                {label}{required && ' *'}
            </label>
            {adding ? (
                <div className="flex gap-1.5">
                    <input
                        autoFocus
                        value={customValue}
                        onChange={e => setCustomValue(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAdd() } }}
                        placeholder={placeholder || `Novo ${label.toLowerCase()}...`}
                        className="flex-1 rounded-lg border border-brand-300 bg-surface-0 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none ring-1 ring-brand-200"
                    />
                    <button
                        type="button"
                        onClick={handleAdd}
                        className="rounded-lg bg-brand-600 px-2.5 text-white hover:bg-brand-700 transition-colors"
                        title="Confirmar"
                    >
                        <Save size={14} />
                    </button>
                    <button
                        type="button"
                        onClick={() => { setAdding(false); setCustomValue('') }}
                        className="rounded-lg border border-surface-200 px-2.5 text-surface-500 hover:bg-surface-50 transition-colors"
                        title="Cancelar"
                    >
                        <X size={14} />
                    </button>
                </div>
            ) : (
                <div className="flex gap-1.5">
                    <select
                        value={value}
                        onChange={e => onChange(e.target.value)}
                        required={required}
                        title={label}
                        className="flex-1 rounded-lg border border-surface-200 bg-surface-50 px-3 py-2.5 text-sm focus:border-brand-500 focus:outline-none"
                    >
                        <option value="">Selecione...</option>
                        {options.map(opt => (
                            <option key={opt} value={opt}>{opt}</option>
                        ))}
                        {/* Show current value if it's custom and not in list */}
                        {value && !options.includes(value) && (
                            <option value={value}>{value}</option>
                        )}
                    </select>
                    <button
                        type="button"
                        onClick={() => setAdding(true)}
                        title={`Adicionar novo ${label.toLowerCase()}`}
                        className="flex items-center justify-center rounded-lg border border-dashed border-brand-300 bg-brand-50 px-2.5 text-brand-600 hover:bg-brand-100 hover:border-brand-400 transition-colors"
                    >
                        <Plus size={16} />
                    </button>
                </div>
            )}
        </div>
    )
}

export default function QuickEquipmentModal({
    open, onOpenChange, customerId, customerName,
}: QuickEquipmentModalProps) {
    const qc = useQueryClient()

    const { data: constants } = useQuery({
        queryKey: ['equipments-constants'],
        queryFn: () => api.get('/equipments-constants').then(r => r.data),
        enabled: open,
    })

    const cats = constants?.categories ?? {}
    const existingTypes: string[] = constants?.types ?? ['Balança', 'Termômetro', 'Manômetro']
    const existingBrands: string[] = constants?.brands ?? []
    const existingModels: string[] = constants?.models ?? []

    const [form, setForm] = useState({
        type: 'Balança',
        category: 'balanca_plataforma',
        brand: '',
        model: '',
        serial_number: '',
        capacity: '',
        capacity_unit: 'kg',
        resolution: '',
        location: '',
        tag: '',
    })

    const update = (key: string, val: any) => setForm(f => ({ ...f, [key]: val }))

    const mutation = useMutation({
        mutationFn: (data: any) => api.post('/equipments', data),
        onSuccess: () => {
            toast.success('Equipamento cadastrado com sucesso!')
            qc.invalidateQueries({ queryKey: ['equipments-for-customer', customerId] })
            qc.invalidateQueries({ queryKey: ['customer'] })
            qc.invalidateQueries({ queryKey: ['equipments-constants'] })
            onOpenChange(false)
            setForm({
                type: 'Balança', category: 'balanca_plataforma', brand: '', model: '',
                serial_number: '', capacity: '', capacity_unit: 'kg', resolution: '',
                location: '', tag: '',
            })
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

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        mutation.mutate({
            customer_id: customerId,
            type: form.type,
            category: form.category,
            brand: form.brand || null,
            model: form.model || null,
            serial_number: form.serial_number || null,
            capacity: form.capacity ? +form.capacity : null,
            capacity_unit: form.capacity_unit,
            resolution: form.resolution ? +form.resolution : null,
            location: form.location || null,
            tag: form.tag || null,
            calibration_interval_months: 12,
        })
    }

    // Category needs special handling since it's key-value
    const [addingCategory, setAddingCategory] = useState(false)
    const [customCategory, setCustomCategory] = useState('')

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent size="lg">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Scale size={18} className="text-brand-500" />
                        Cadastro Rápido de Equipamento
                    </DialogTitle>
                    <DialogDescription>
                        {customerName
                            ? `Equipamento será vinculado ao cliente: ${customerName}`
                            : 'Preencha os dados essenciais do equipamento'}
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit}>
                    <DialogBody>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {/* Tipo — select com + */}
                            <SelectWithAdd
                                label="Tipo"
                                required
                                value={form.type}
                                onChange={v => update('type', v)}
                                options={existingTypes}
                                placeholder="Ex: Balança, Termômetro..."
                            />

                            {/* Categoria — select com + */}
                            <div>
                                <label className="mb-1 block text-xs font-medium text-surface-600">Categoria</label>
                                {addingCategory ? (
                                    <div className="flex gap-1.5">
                                        <input
                                            autoFocus
                                            value={customCategory}
                                            onChange={e => setCustomCategory(e.target.value)}
                                            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); if (customCategory.trim()) { update('category', customCategory.trim()); setCustomCategory(''); setAddingCategory(false) } } }}
                                            placeholder="Nova categoria..."
                                            className="flex-1 rounded-lg border border-brand-300 bg-surface-0 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none ring-1 ring-brand-200"
                                        />
                                        <button type="button" onClick={() => { if (customCategory.trim()) { update('category', customCategory.trim()); setCustomCategory(''); setAddingCategory(false) } }} className="rounded-lg bg-brand-600 px-2.5 text-white hover:bg-brand-700 transition-colors" title="Confirmar">
                                            <Save size={14} />
                                        </button>
                                        <button type="button" onClick={() => { setAddingCategory(false); setCustomCategory('') }} className="rounded-lg border border-surface-200 px-2.5 text-surface-500 hover:bg-surface-50 transition-colors" title="Cancelar">
                                            <X size={14} />
                                        </button>
                                    </div>
                                ) : (
                                    <div className="flex gap-1.5">
                                        <select
                                            value={form.category}
                                            onChange={(e: React.ChangeEvent<HTMLSelectElement>) => update('category', e.target.value)}
                                            title="Categoria"
                                            className="flex-1 rounded-lg border border-surface-200 bg-surface-50 px-3 py-2.5 text-sm focus:border-brand-500 focus:outline-none"
                                        >
                                            {Object.entries(cats).map(([k, v]) => (
                                                <option key={k} value={k}>{v as string}</option>
                                            ))}
                                        </select>
                                        <button type="button" onClick={() => setAddingCategory(true)} title="Adicionar nova categoria" className="flex items-center justify-center rounded-lg border border-dashed border-brand-300 bg-brand-50 px-2.5 text-brand-600 hover:bg-brand-100 hover:border-brand-400 transition-colors">
                                            <Plus size={16} />
                                        </button>
                                    </div>
                                )}
                            </div>

                            {/* Marca — select com + */}
                            <SelectWithAdd
                                label="Marca"
                                value={form.brand}
                                onChange={v => update('brand', v)}
                                options={existingBrands}
                                placeholder="Ex: Toledo, Marte..."
                            />

                            {/* Modelo — select com + */}
                            <SelectWithAdd
                                label="Modelo"
                                value={form.model}
                                onChange={v => update('model', v)}
                                options={existingModels}
                                placeholder="Ex: 2098..."
                            />

                            <div>
                                <label className="mb-1 block text-xs font-medium text-surface-600">Nº Série</label>
                                <input
                                    value={form.serial_number}
                                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => update('serial_number', e.target.value)}
                                    className="w-full rounded-lg border border-surface-200 bg-surface-50 px-3 py-2.5 text-sm focus:border-brand-500 focus:outline-none"
                                    placeholder="Número de série"
                                />
                            </div>
                            <div>
                                <label className="mb-1 block text-xs font-medium text-surface-600">Tag / Patrimônio</label>
                                <input
                                    value={form.tag}
                                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => update('tag', e.target.value)}
                                    className="w-full rounded-lg border border-surface-200 bg-surface-50 px-3 py-2.5 text-sm focus:border-brand-500 focus:outline-none"
                                    placeholder="Tag ou patrimônio"
                                />
                            </div>
                            <div>
                                <label className="mb-1 block text-xs font-medium text-surface-600">Capacidade</label>
                                <div className="flex gap-2">
                                    <input
                                        type="number"
                                        step="any"
                                        value={form.capacity}
                                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => update('capacity', e.target.value)}
                                        className="flex-1 rounded-lg border border-surface-200 bg-surface-50 px-3 py-2.5 text-sm focus:border-brand-500 focus:outline-none"
                                        placeholder="0"
                                    />
                                    <select
                                        value={form.capacity_unit}
                                        onChange={(e: React.ChangeEvent<HTMLSelectElement>) => update('capacity_unit', e.target.value)}
                                        title="Unidade de capacidade"
                                        className="w-20 rounded-lg border border-surface-200 bg-surface-50 px-2 py-2.5 text-sm focus:border-brand-500 focus:outline-none"
                                    >
                                        <option>kg</option><option>g</option><option>mg</option><option>t</option>
                                    </select>
                                </div>
                            </div>
                            <div>
                                <label className="mb-1 block text-xs font-medium text-surface-600">Resolução</label>
                                <input
                                    type="number"
                                    step="any"
                                    value={form.resolution}
                                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => update('resolution', e.target.value)}
                                    className="w-full rounded-lg border border-surface-200 bg-surface-50 px-3 py-2.5 text-sm focus:border-brand-500 focus:outline-none"
                                    placeholder="0"
                                />
                            </div>
                            <div className="sm:col-span-2">
                                <label className="mb-1 block text-xs font-medium text-surface-600">Localização</label>
                                <input
                                    value={form.location}
                                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => update('location', e.target.value)}
                                    className="w-full rounded-lg border border-surface-200 bg-surface-50 px-3 py-2.5 text-sm focus:border-brand-500 focus:outline-none"
                                    placeholder="Ex: Galpão 2, Setor de Produção"
                                />
                            </div>
                        </div>
                    </DialogBody>

                    <DialogFooter>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => onOpenChange(false)}
                            disabled={mutation.isPending}
                        >
                            Cancelar
                        </Button>
                        <Button
                            type="submit"
                            loading={mutation.isPending}
                            icon={mutation.isPending ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                        >
                            {mutation.isPending ? 'Salvando...' : 'Salvar Equipamento'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}
