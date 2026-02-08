import React, { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
    ArrowLeft, Scale, CheckCircle2, AlertTriangle, Clock,
    Plus, FileText, Wrench, Award, Upload, Trash2, Loader2, Download
} from 'lucide-react'
import api from '@/lib/api'
import { cn } from '@/lib/utils'

type Tab = 'dados' | 'calibracoes' | 'manutencoes' | 'documentos'

const tabs: { key: Tab; label: string; icon: any }[] = [
    { key: 'dados', label: 'Dados', icon: Scale },
    { key: 'calibracoes', label: 'Calibrações', icon: Award },
    { key: 'manutencoes', label: 'Manutenções', icon: Wrench },
    { key: 'documentos', label: 'Documentos', icon: FileText },
]

const resultColors: Record<string, string> = {
    aprovado: 'bg-emerald-100 text-emerald-700',
    aprovado_com_ressalva: 'bg-amber-100 text-amber-700',
    reprovado: 'bg-red-100 text-red-700',
}

export default function EquipmentDetailPage() {
    const { id } = useParams()
    const navigate = useNavigate()
    const qc = useQueryClient()
    const [tab, setTab] = useState<Tab>('dados')
    const [showCalForm, setShowCalForm] = useState(false)
    const [showMaintForm, setShowMaintForm] = useState(false)

    const { data, isLoading } = useQuery({
        queryKey: ['equipment', id],
        queryFn: () => api.get(`/equipments/${id}`).then(r => r.data.equipment),
        enabled: !!id,
    })

    const { data: constants } = useQuery({
        queryKey: ['equipments-constants'],
        queryFn: () => api.get('/equipments-constants').then(r => r.data),
    })

    const calMutation = useMutation({
        mutationFn: (formData: any) => api.post(`/equipments/${id}/calibrations`, formData),
        onSuccess: () => { qc.invalidateQueries({ queryKey: ['equipment', id] }); setShowCalForm(false) },
    })

    const maintMutation = useMutation({
        mutationFn: (formData: any) => api.post(`/equipments/${id}/maintenances`, formData),
        onSuccess: () => { qc.invalidateQueries({ queryKey: ['equipment', id] }); setShowMaintForm(false) },
    })

    const docMutation = useMutation({
        mutationFn: (formData: FormData) => api.post(`/equipments/${id}/documents`, formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
        }),
        onSuccess: () => qc.invalidateQueries({ queryKey: ['equipment', id] }),
    })

    if (isLoading) return <div className="flex items-center justify-center py-20"><Loader2 className="animate-spin text-brand-500" size={32} /></div>
    if (!data) return <div className="py-20 text-center text-surface-500">Equipamento não encontrado</div>

    const eq = data
    const cats = constants?.categories ?? {}
    const classes = constants?.precision_classes ?? {}

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center gap-4">
                <button onClick={() => navigate('/equipamentos')} className="rounded-lg border border-surface-200 p-2 hover:bg-surface-50">
                    <ArrowLeft size={18} />
                </button>
                <div className="flex-1">
                    <div className="flex items-center gap-3">
                        <h1 className="text-2xl font-bold text-surface-900">
                            {eq.brand} {eq.model}
                        </h1>
                        <span className="rounded-full bg-brand-100 px-3 py-0.5 text-xs font-semibold text-brand-700">
                            {eq.code}
                        </span>
                        {eq.is_critical && (
                            <span className="rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-semibold text-red-700">
                                CRÍTICO
                            </span>
                        )}
                    </div>
                    <p className="text-sm text-surface-500">
                        {eq.type} • Série: {eq.serial_number || '—'} • {cats[eq.category] || eq.category}
                    </p>
                </div>
            </div>

            {/* Status Cards */}
            <div className="grid grid-cols-4 gap-3">
                <div className="rounded-xl border border-surface-200 bg-white p-4 shadow-card">
                    <p className="text-xs font-medium text-surface-500">Status</p>
                    <p className={cn('mt-1 inline-block rounded-full px-3 py-0.5 text-sm font-semibold',
                        eq.status === 'ativo' ? 'bg-emerald-100 text-emerald-700' : 'bg-surface-200 text-surface-600')}>
                        {eq.status}
                    </p>
                </div>
                <div className="rounded-xl border border-surface-200 bg-white p-4 shadow-card">
                    <p className="text-xs font-medium text-surface-500">Última Calibração</p>
                    <p className="mt-1 text-sm font-semibold text-surface-900">
                        {eq.last_calibration_at ? new Date(eq.last_calibration_at).toLocaleDateString('pt-BR') : '—'}
                    </p>
                </div>
                <div className="rounded-xl border border-surface-200 bg-white p-4 shadow-card">
                    <p className="text-xs font-medium text-surface-500">Próxima Calibração</p>
                    <p className="mt-1 text-sm font-semibold text-surface-900">
                        {eq.next_calibration_at ? new Date(eq.next_calibration_at).toLocaleDateString('pt-BR') : '—'}
                    </p>
                </div>
                <div className="rounded-xl border border-surface-200 bg-white p-4 shadow-card">
                    <p className="text-xs font-medium text-surface-500">Cliente</p>
                    <p className="mt-1 truncate text-sm font-semibold text-surface-900">
                        {eq.customer?.name || '—'}
                    </p>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 rounded-xl bg-surface-100 p-1">
                {tabs.map(t => (
                    <button
                        key={t.key}
                        onClick={() => setTab(t.key)}
                        className={cn(
                            'flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-all',
                            tab === t.key
                                ? 'bg-white text-surface-900 shadow-sm'
                                : 'text-surface-500 hover:text-surface-700'
                        )}
                    >
                        <t.icon size={16} />
                        {t.label}
                    </button>
                ))}
            </div>

            {/* Tab: Dados */}
            {tab === 'dados' && (
                <div className="rounded-xl border border-surface-200 bg-white p-6 shadow-card">
                    <div className="grid grid-cols-3 gap-x-8 gap-y-4">
                        <Field label="Fabricante" value={eq.manufacturer} />
                        <Field label="Marca" value={eq.brand} />
                        <Field label="Modelo" value={eq.model} />
                        <Field label="Nº Série" value={eq.serial_number} />
                        <Field label="Categoria" value={cats[eq.category] || eq.category} />
                        <Field label="Classe de Precisão" value={classes[eq.precision_class] || eq.precision_class} />
                        <Field label="Capacidade" value={eq.capacity ? `${eq.capacity} ${eq.capacity_unit || ''}` : null} />
                        <Field label="Resolução" value={eq.resolution} />
                        <Field label="Localização" value={eq.location} />
                        <Field label="Nº INMETRO" value={eq.inmetro_number} />
                        <Field label="Tag/Patrimônio" value={eq.tag} />
                        <Field label="Intervalo Calibração" value={eq.calibration_interval_months ? `${eq.calibration_interval_months} meses` : null} />
                        <Field label="Data Aquisição" value={eq.purchase_date ? new Date(eq.purchase_date).toLocaleDateString('pt-BR') : null} />
                        <Field label="Valor Aquisição" value={eq.purchase_value ? `R$ ${Number(eq.purchase_value).toFixed(2)}` : null} />
                        <Field label="Garantia até" value={eq.warranty_expires_at ? new Date(eq.warranty_expires_at).toLocaleDateString('pt-BR') : null} />
                        <Field label="Responsável" value={eq.responsible?.name} />
                        <div className="col-span-3">
                            <Field label="Observações" value={eq.notes} />
                        </div>
                    </div>
                </div>
            )}

            {/* Tab: Calibrações */}
            {tab === 'calibracoes' && (
                <div className="space-y-4">
                    <div className="flex justify-end">
                        <button
                            onClick={() => setShowCalForm(!showCalForm)}
                            className="flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
                        >
                            <Plus size={16} />
                            Nova Calibração
                        </button>
                    </div>

                    {showCalForm && (
                        <CalibrationForm
                            constants={constants}
                            onSubmit={(d: any) => calMutation.mutate(d)}
                            loading={calMutation.isPending}
                        />
                    )}

                    <div className="space-y-3">
                        {(eq.calibrations ?? []).map((c: any) => (
                            <div key={c.id} className="rounded-xl border border-surface-200 bg-white p-5 shadow-card">
                                <div className="flex items-start justify-between">
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <span className={cn('rounded-full px-2.5 py-0.5 text-xs font-semibold', resultColors[c.result] || 'bg-surface-100')}>
                                                {c.result}
                                            </span>
                                            <span className="text-sm font-medium text-surface-900">
                                                {new Date(c.calibration_date).toLocaleDateString('pt-BR')}
                                            </span>
                                            <span className="text-xs text-surface-500">• {c.calibration_type}</span>
                                        </div>
                                        {c.laboratory && <p className="mt-1 text-sm text-surface-600">Lab: {c.laboratory}</p>}
                                        {c.certificate_number && <p className="text-sm text-surface-600">Certificado: {c.certificate_number}</p>}
                                        {c.uncertainty && <p className="text-sm text-surface-600">Incerteza: {c.uncertainty}</p>}
                                        {c.notes && <p className="mt-1 text-sm text-surface-500">{c.notes}</p>}
                                    </div>
                                    <div className="flex flex-col items-end gap-1 text-right text-xs text-surface-500">
                                        {c.performer?.name && <p>Por: {c.performer.name}</p>}
                                        {c.cost && <p>R$ {Number(c.cost).toFixed(2)}</p>}
                                        <button
                                            onClick={() => window.open(`${api.defaults.baseURL}/equipments/${id}/calibrations/${c.id}/pdf`, '_blank')}
                                            className="mt-1 flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-100 transition-colors"
                                        >
                                            <Download size={12} />
                                            Certificado
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                        {(eq.calibrations ?? []).length === 0 && (
                            <p className="py-8 text-center text-sm text-surface-400">Nenhuma calibração registrada</p>
                        )}
                    </div>
                </div>
            )}

            {/* Tab: Manutenções */}
            {tab === 'manutencoes' && (
                <div className="space-y-4">
                    <div className="flex justify-end">
                        <button
                            onClick={() => setShowMaintForm(!showMaintForm)}
                            className="flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
                        >
                            <Plus size={16} />
                            Nova Manutenção
                        </button>
                    </div>

                    {showMaintForm && (
                        <MaintenanceForm
                            constants={constants}
                            onSubmit={(d: any) => maintMutation.mutate(d)}
                            loading={maintMutation.isPending}
                        />
                    )}

                    <div className="space-y-3">
                        {(eq.maintenances ?? []).map((m: any) => (
                            <div key={m.id} className="rounded-xl border border-surface-200 bg-white p-5 shadow-card">
                                <div className="flex items-start justify-between">
                                    <div>
                                        <span className="rounded-full bg-surface-100 px-2.5 py-0.5 text-xs font-medium text-surface-700">{m.type}</span>
                                        <p className="mt-1 text-sm text-surface-900">{m.description}</p>
                                        {m.parts_replaced && <p className="text-sm text-surface-500">Peças: {m.parts_replaced}</p>}
                                    </div>
                                    <div className="text-right text-xs text-surface-500">
                                        {m.performer?.name && <p>Por: {m.performer.name}</p>}
                                        {m.cost && <p>R$ {Number(m.cost).toFixed(2)}</p>}
                                        {m.downtime_hours && <p>{m.downtime_hours}h parado</p>}
                                        <p>{new Date(m.created_at).toLocaleDateString('pt-BR')}</p>
                                    </div>
                                </div>
                            </div>
                        ))}
                        {(eq.maintenances ?? []).length === 0 && (
                            <p className="py-8 text-center text-sm text-surface-400">Nenhuma manutenção registrada</p>
                        )}
                    </div>
                </div>
            )}

            {/* Tab: Documentos */}
            {tab === 'documentos' && (
                <div className="space-y-4">
                    <div className="flex justify-end">
                        <label className="flex cursor-pointer items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700">
                            <Upload size={16} />
                            Upload Documento
                            <input
                                type="file"
                                className="hidden"
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                                    const file = e.target.files?.[0]
                                    if (!file) return
                                    const name = prompt('Nome do documento:')
                                    const type = prompt('Tipo (certificado, manual, foto, laudo, relatorio):') || 'certificado'
                                    if (!name) return
                                    const fd = new FormData()
                                    fd.append('file', file)
                                    fd.append('name', name)
                                    fd.append('type', type)
                                    docMutation.mutate(fd)
                                }}
                            />
                        </label>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        {(eq.documents ?? []).map((d: any) => (
                            <div key={d.id} className="flex items-center justify-between rounded-xl border border-surface-200 bg-white p-4 shadow-card">
                                <div className="flex items-center gap-3">
                                    <FileText size={20} className="text-brand-500" />
                                    <div>
                                        <p className="font-medium text-surface-900">{d.name}</p>
                                        <p className="text-xs text-surface-500">{d.type} • {new Date(d.created_at).toLocaleDateString('pt-BR')}</p>
                                    </div>
                                </div>
                            </div>
                        ))}
                        {(eq.documents ?? []).length === 0 && (
                            <p className="col-span-2 py-8 text-center text-sm text-surface-400">Nenhum documento anexado</p>
                        )}
                    </div>
                </div>
            )}
        </div>
    )
}

// ─── Componentes auxiliares ─────────────────────────────

function Field({ label, value }: { label: string; value: any }) {
    return (
        <div>
            <p className="text-xs font-medium text-surface-500">{label}</p>
            <p className="mt-0.5 text-sm text-surface-900">{value || '—'}</p>
        </div>
    )
}

function CalibrationForm({ constants, onSubmit, loading }: any) {
    const [form, setForm] = useState({
        calibration_date: new Date().toISOString().slice(0, 10),
        calibration_type: 'externa',
        result: 'aprovado',
        laboratory: '',
        certificate_number: '',
        uncertainty: '',
        cost: '',
        notes: '',
    })

    return (
        <div className="rounded-xl border border-brand-200 bg-brand-50/30 p-5">
            <h3 className="mb-3 font-semibold text-surface-900">Registrar Calibração</h3>
            <div className="grid grid-cols-3 gap-3">
                <input type="date" value={form.calibration_date} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm(f => ({ ...f, calibration_date: e.target.value }))} className="rounded-lg border border-surface-200 px-3 py-2 text-sm" />
                <select value={form.calibration_type} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setForm(f => ({ ...f, calibration_type: e.target.value }))} className="rounded-lg border border-surface-200 px-3 py-2 text-sm">
                    {Object.entries(constants?.calibration_types ?? {}).map(([k, v]) => <option key={k} value={k}>{v as string}</option>)}
                </select>
                <select value={form.result} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setForm(f => ({ ...f, result: e.target.value }))} className="rounded-lg border border-surface-200 px-3 py-2 text-sm">
                    {Object.entries(constants?.calibration_results ?? {}).map(([k, v]) => <option key={k} value={k}>{v as string}</option>)}
                </select>
                <input placeholder="Laboratório" value={form.laboratory} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm(f => ({ ...f, laboratory: e.target.value }))} className="rounded-lg border border-surface-200 px-3 py-2 text-sm" />
                <input placeholder="Nº Certificado" value={form.certificate_number} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm(f => ({ ...f, certificate_number: e.target.value }))} className="rounded-lg border border-surface-200 px-3 py-2 text-sm" />
                <input placeholder="Incerteza" value={form.uncertainty} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm(f => ({ ...f, uncertainty: e.target.value }))} className="rounded-lg border border-surface-200 px-3 py-2 text-sm" />
                <input type="number" placeholder="Custo (R$)" value={form.cost} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm(f => ({ ...f, cost: e.target.value }))} className="rounded-lg border border-surface-200 px-3 py-2 text-sm" />
                <input placeholder="Observações" value={form.notes} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm(f => ({ ...f, notes: e.target.value }))} className="col-span-2 rounded-lg border border-surface-200 px-3 py-2 text-sm" />
            </div>
            <div className="mt-3 flex justify-end">
                <button
                    onClick={() => onSubmit({ ...form, cost: form.cost ? +form.cost : undefined })}
                    disabled={loading}
                    className="flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
                >
                    {loading ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                    Salvar
                </button>
            </div>
        </div>
    )
}

function MaintenanceForm({ constants, onSubmit, loading }: any) {
    const [form, setForm] = useState({
        type: 'corretiva',
        description: '',
        parts_replaced: '',
        cost: '',
        downtime_hours: '',
    })

    return (
        <div className="rounded-xl border border-brand-200 bg-brand-50/30 p-5">
            <h3 className="mb-3 font-semibold text-surface-900">Registrar Manutenção</h3>
            <div className="grid grid-cols-3 gap-3">
                <select value={form.type} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setForm(f => ({ ...f, type: e.target.value }))} className="rounded-lg border border-surface-200 px-3 py-2 text-sm">
                    {Object.entries(constants?.maintenance_types ?? {}).map(([k, v]) => <option key={k} value={k}>{v as string}</option>)}
                </select>
                <input type="number" placeholder="Custo (R$)" value={form.cost} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm(f => ({ ...f, cost: e.target.value }))} className="rounded-lg border border-surface-200 px-3 py-2 text-sm" />
                <input type="number" placeholder="Horas parado" value={form.downtime_hours} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm(f => ({ ...f, downtime_hours: e.target.value }))} className="rounded-lg border border-surface-200 px-3 py-2 text-sm" />
                <input placeholder="Descrição do serviço" value={form.description} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm(f => ({ ...f, description: e.target.value }))} className="col-span-2 rounded-lg border border-surface-200 px-3 py-2 text-sm" />
                <input placeholder="Peças substituídas" value={form.parts_replaced} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm(f => ({ ...f, parts_replaced: e.target.value }))} className="rounded-lg border border-surface-200 px-3 py-2 text-sm" />
            </div>
            <div className="mt-3 flex justify-end">
                <button
                    onClick={() => onSubmit({
                        ...form,
                        cost: form.cost ? +form.cost : undefined,
                        downtime_hours: form.downtime_hours ? +form.downtime_hours : undefined,
                    })}
                    disabled={loading || !form.description}
                    className="flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
                >
                    {loading ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                    Salvar
                </button>
            </div>
        </div>
    )
}
