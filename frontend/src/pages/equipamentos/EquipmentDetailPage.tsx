import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
    Edit, Scale, Wrench, FileText, Download,
    Calendar, User, MapPin, Hash, CheckCircle2, AlertTriangle,
    XCircle, Clock, Activity, Plus, X, Search, Loader2
} from 'lucide-react'
import api from '@/lib/api'
import { cn } from '@/lib/utils'
import { PageHeader } from '@/components/ui/pageheader'
import { useAuthStore } from '@/stores/auth-store'
import { toast } from 'sonner'

/* ═══════════ Types ═══════════ */

interface StandardWeight {
    id: number
    code: string
    nominal_value: string
    unit: string
    precision_class: string
    certificate_status?: string
}

interface Calibration {
    id: number
    calibration_date: string
    next_due_date: string | null
    calibration_type: string
    result: string
    laboratory: string | null
    certificate_number: string | null
    uncertainty: string | null
    error_found: string | null
    performer?: { id: number; name: string }
    standard_weights?: StandardWeight[]
    notes: string | null
}

interface Maintenance {
    id: number
    maintenance_date: string
    maintenance_type: string
    description: string
    cost: string | null
    performer?: { id: number; name: string }
}

interface Equipment {
    id: number
    code: string
    type: string | null
    brand: string
    model: string
    serial_number: string | null
    capacity: string | null
    capacity_unit: string | null
    resolution: string | null
    precision_class: string | null
    location: string | null
    tag: string | null
    status: string
    status_label: string
    inmetro_number: string | null
    last_calibration_at: string | null
    next_calibration_at: string | null
    calibration_interval_months: number | null
    calibration_status: string | null
    certificate_number: string | null
    notes: string | null
    customer?: { id: number; name: string; document: string | null; phone: string | null }
    responsible?: { id: number; name: string }
    calibrations: Calibration[]
    maintenances: Maintenance[]
    documents: { id: number; name: string; file_path: string; type: string; created_at: string }[]
    created_at: string
}

/* ═══════════ Constants ═══════════ */

const statusColors: Record<string, string> = {
    active: 'bg-emerald-100 text-emerald-700',
    inactive: 'bg-surface-200 text-surface-600',
    in_calibration: 'bg-blue-100 text-blue-700',
    maintenance: 'bg-amber-100 text-amber-700',
    decommissioned: 'bg-red-100 text-red-700',
}

const resultColors: Record<string, string> = {
    aprovado: 'bg-emerald-100 text-emerald-700',
    aprovado_com_ressalva: 'bg-amber-100 text-amber-700',
    reprovado: 'bg-red-100 text-red-700',
}

const resultLabels: Record<string, string> = {
    aprovado: 'Aprovado',
    aprovado_com_ressalva: 'C/ Ressalva',
    reprovado: 'Reprovado',
}

const typeLabels: Record<string, string> = {
    interna: 'Interna',
    externa: 'Externa',
    rastreada_rbc: 'Rastreada RBC',
}

function fmtDate(d: string | null | undefined) {
    if (!d) return '—'
    return new Date(d).toLocaleDateString('pt-BR')
}

function calibrationBadge(status: string | null) {
    if (!status) return null
    if (status === 'overdue') return <span className="inline-flex items-center gap-1 text-[11px] font-medium text-red-600"><XCircle className="h-3 w-3" /> Vencida</span>
    if (status === 'due_soon') return <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-600"><AlertTriangle className="h-3 w-3" /> Vencendo</span>
    if (status === 'ok') return <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-600"><CheckCircle2 className="h-3 w-3" /> Em dia</span>
    return null
}

/* ═══════════ Calibration Form Type ═══════════ */

interface CalibrationForm {
    calibration_date: string
    calibration_type: string
    result: string
    laboratory: string
    certificate_number: string
    standard_used: string
    standard_weight_ids: number[]
    uncertainty: string
    error_found: string
    temperature: string
    humidity: string
    pressure: string
    technician_notes: string
    notes: string
}

const emptyCalForm: CalibrationForm = {
    calibration_date: new Date().toISOString().split('T')[0],
    calibration_type: 'interna',
    result: 'aprovado',
    laboratory: '',
    certificate_number: '',
    standard_used: '',
    standard_weight_ids: [],
    uncertainty: '',
    error_found: '',
    temperature: '',
    humidity: '',
    pressure: '',
    technician_notes: '',
    notes: '',
}

/* ═══════════ Main Component ═══════════ */

export default function EquipmentDetailPage() {
    const { id } = useParams()
    const navigate = useNavigate()
    const queryClient = useQueryClient()
    const { hasPermission, hasRole } = useAuthStore()
    const canEdit = hasRole('super_admin') || hasPermission('equipments.equipment.update')
    const canCalibrate = hasRole('super_admin') || hasPermission('equipments.equipment.update')
    const [activeTab, setActiveTab] = useState<'calibrations' | 'maintenances' | 'documents'>('calibrations')
    const [showCalModal, setShowCalModal] = useState(false)

    const { data, isLoading, error } = useQuery<{ equipment: Equipment }>({
        queryKey: ['equipment', id],
        const { data, isLoading } = useQuery({
        queryFn: () => api.get(`/equipments/${id}`).then(r => r.data),
        enabled: !!id,
    })

    const equipment = data?.equipment

    const handleDownloadCertificate = async (calibration: Calibration) => {
        try {
            const res = await api.get(`/equipments/${id}/calibrations/${calibration.id}/pdf`, {
                responseType: 'blob',
            })
            const url = URL.createObjectURL(res.data)
            const a = document.createElement('a')
            a.href = url
            a.download = `Certificado-${calibration.certificate_number ?? `CAL-${calibration.id}`}.pdf`
            a.click()
            URL.revokeObjectURL(url)
            toast.success('Certificado baixado com sucesso!')
        } catch (err: any) {
            if (err.response?.status === 403) {
                toast.error('Sem permissão para baixar o certificado')
            } else {
                toast.error('Erro ao gerar certificado')
            }
        }
    }

    if (isLoading) {
        return (
            <div className="space-y-5">
                <PageHeader title="Carregando..." backTo="/equipamentos" />
                <div className="flex justify-center p-12">
                    <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
                </div>
            </div>
        )
    }

    if (error || !equipment) {
        return (
            <div className="space-y-5">
                <PageHeader title="Equipamento não encontrado" backTo="/equipamentos" />
                <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center">
                    <XCircle className="mx-auto h-10 w-10 text-red-400 mb-2" />
                    <p className="text-sm text-red-600">Não foi possível carregar os dados do equipamento.</p>
                    <button onClick={() => navigate('/equipamentos')} className="btn-primary text-xs mt-3">Voltar</button>
                </div>
            </div>
        )
    }

    return (
        <div className="space-y-5">
            {/* Header */}
            <PageHeader
                title={equipment.code}
                subtitle={`${equipment.brand} ${equipment.model}`}
                backTo="/equipamentos"
                icon={Scale}
                actions={
                    <div className="flex items-center gap-2">
                        {calibrationBadge(equipment.calibration_status)}
                        <span className={cn('inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold', statusColors[equipment.status] ?? 'bg-surface-100 text-surface-600')}>
                            {equipment.status_label ?? equipment.status}
                        </span>
                        {canEdit && (
                            <button onClick={() => navigate(`/equipamentos/${id}/editar`)} className="btn-ghost text-xs gap-1.5">
                                <Edit className="h-3.5 w-3.5" /> Editar
                            </button>
                        )}
                    </div>
                }
            />

            {/* Info Cards */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Equipment Details */}
                <div className="rounded-xl border border-default bg-surface-0 shadow-card overflow-hidden">
                    <div className="border-b border-default bg-surface-50 px-4 py-2.5">
                        <h3 className="text-xs font-semibold text-surface-700 uppercase tracking-wider">Dados do Equipamento</h3>
                    </div>
                    <div className="p-4 space-y-2">
                        <InfoRow icon={Hash} label="Código" value={equipment.code} />
                        <InfoRow icon={Scale} label="Tipo" value={equipment.type} />
                        <InfoRow icon={Activity} label="Marca / Modelo" value={`${equipment.brand} ${equipment.model}`} />
                        <InfoRow icon={Hash} label="Nº Série" value={equipment.serial_number} />
                        <InfoRow icon={Scale} label="Capacidade" value={equipment.capacity ? `${equipment.capacity} ${equipment.capacity_unit ?? ''}` : null} />
                        <InfoRow icon={Activity} label="Resolução" value={equipment.resolution} />
                        <InfoRow icon={Hash} label="Classe de Precisão" value={equipment.precision_class} />
                        {equipment.inmetro_number && <InfoRow icon={Hash} label="INMETRO" value={equipment.inmetro_number} />}
                        {equipment.tag && <InfoRow icon={Hash} label="Tag" value={equipment.tag} />}
                        <InfoRow icon={MapPin} label="Localização" value={equipment.location} />
                    </div>
                </div>

                {/* Customer + Calibration Info */}
                <div className="space-y-4">
                    {equipment.customer && (
                        <div className="rounded-xl border border-default bg-surface-0 shadow-card overflow-hidden">
                            <div className="border-b border-default bg-surface-50 px-4 py-2.5">
                                <h3 className="text-xs font-semibold text-surface-700 uppercase tracking-wider">Cliente</h3>
                            </div>
                            <div className="p-4 space-y-2">
                                <InfoRow icon={User} label="Nome" value={equipment.customer.name} />
                                <InfoRow icon={Hash} label="CPF/CNPJ" value={equipment.customer.document} />
                                {equipment.customer.phone && <InfoRow icon={Activity} label="Telefone" value={equipment.customer.phone} />}
                            </div>
                        </div>
                    )}

                    <div className="rounded-xl border border-default bg-surface-0 shadow-card overflow-hidden">
                        <div className="border-b border-default bg-surface-50 px-4 py-2.5">
                            <h3 className="text-xs font-semibold text-surface-700 uppercase tracking-wider">Calibração</h3>
                        </div>
                        <div className="p-4 space-y-2">
                            <InfoRow icon={Calendar} label="Última Calibração" value={fmtDate(equipment.last_calibration_at)} />
                            <InfoRow icon={Calendar} label="Próxima Calibração" value={fmtDate(equipment.next_calibration_at)} />
                            <InfoRow icon={Clock} label="Intervalo" value={equipment.calibration_interval_months ? `${equipment.calibration_interval_months} meses` : null} />
                            <InfoRow icon={FileText} label="Nº Certificado" value={equipment.certificate_number} />
                            {equipment.responsible && <InfoRow icon={User} label="Responsável" value={equipment.responsible.name} />}
                        </div>
                    </div>
                </div>
            </div>

            {/* Notes */}
            {equipment.notes && (
                <div className="rounded-xl border border-default bg-surface-0 shadow-card p-4">
                    <h3 className="text-xs font-semibold text-surface-700 uppercase tracking-wider mb-2">Observações</h3>
                    <p className="text-sm text-surface-600">{equipment.notes}</p>
                </div>
            )}

            {/* Tabs */}
            <div className="rounded-xl border border-default bg-surface-0 shadow-card overflow-hidden">
                <div className="flex items-center justify-between border-b border-default pr-3">
                    <div className="flex">
                        <TabButton active={activeTab === 'calibrations'} onClick={() => setActiveTab('calibrations')} count={equipment.calibrations?.length}>
                            <Scale className="h-3.5 w-3.5" /> Calibrações
                        </TabButton>
                        <TabButton active={activeTab === 'maintenances'} onClick={() => setActiveTab('maintenances')} count={equipment.maintenances?.length}>
                            <Wrench className="h-3.5 w-3.5" /> Manutenções
                        </TabButton>
                        <TabButton active={activeTab === 'documents'} onClick={() => setActiveTab('documents')} count={equipment.documents?.length}>
                            <FileText className="h-3.5 w-3.5" /> Documentos
                        </TabButton>
                    </div>
                    {activeTab === 'calibrations' && canCalibrate && (
                        <button onClick={() => setShowCalModal(true)} className="btn-primary text-xs gap-1 py-1.5 px-3">
                            <Plus className="h-3 w-3" /> Nova Calibração
                        </button>
                    )}
                </div>

                <div className="p-4">
                    {activeTab === 'calibrations' && (
                        <CalibrationTab
                            calibrations={equipment.calibrations}
                            onDownloadCertificate={handleDownloadCertificate}
                        />
                    )}
                    {activeTab === 'maintenances' && (
                        <MaintenanceTab maintenances={equipment.maintenances} />
                    )}
                    {activeTab === 'documents' && (
                        <DocumentTab documents={equipment.documents} />
                    )}
                </div>
            </div>

            {/* Calibration Modal */}
            {showCalModal && (
                <CalibrationModal
                    equipmentId={Number(id)}
                    onClose={() => setShowCalModal(false)}
                    onSuccess={() => {
                        setShowCalModal(false)
                        queryClient.invalidateQueries({ queryKey: ['equipment', id] })
                    }}
                />
            )}
        </div>
    )
}

/* ═══════════ Sub-components ═══════════ */

function InfoRow({ icon: Icon, label, value }: { icon: any; label: string; value: string | null | undefined }) {
    return (
        <div className="flex items-center gap-2 text-sm">
            <Icon className="h-3.5 w-3.5 text-surface-400 shrink-0" />
            <span className="text-surface-500 w-32 shrink-0">{label}:</span>
            <span className="text-surface-800 font-medium">{value || '—'}</span>
        </div>
    )
}

function TabButton({ active, onClick, children, count }: { active: boolean; onClick: () => void; children: React.ReactNode; count?: number }) {
    return (
        <button
            onClick={onClick}
            className={cn(
                'flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium transition-colors border-b-2 -mb-px',
                active
                    ? 'text-brand-600 border-brand-500 bg-brand-50/50'
                    : 'text-surface-500 border-transparent hover:text-surface-700 hover:bg-surface-50'
            )}
        >
            {children}
            {count !== undefined && count > 0 && (
                <span className={cn('rounded-full px-1.5 py-0.5 text-[10px] font-semibold', active ? 'bg-brand-100 text-brand-700' : 'bg-surface-100 text-surface-500')}>
                    {count}
                </span>
            )}
        </button>
    )
}

/* ═══════════ Calibration Tab ═══════════ */

function CalibrationTab({ calibrations, onDownloadCertificate }: { calibrations: Calibration[]; onDownloadCertificate: (c: Calibration) => void }) {
    if (!calibrations?.length) {
        return (
            <div className="text-center py-8 text-surface-400">
                <Scale className="mx-auto h-10 w-10 mb-2 opacity-40" />
                <p className="text-sm font-medium">Nenhuma calibração registrada</p>
                <p className="text-xs mt-1">Clique em "Nova Calibração" para registrar</p>
            </div>
        )
    }

    return (
        <div className="space-y-3">
            {calibrations.map(cal => (
                <div key={cal.id} className="rounded-lg border border-default p-3 hover:bg-surface-50 transition-colors">
                    <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-xs font-mono font-semibold text-brand-600">
                                    {cal.certificate_number ?? `#${cal.id}`}
                                </span>
                                <span className={cn('inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold', resultColors[cal.result] ?? 'bg-surface-100 text-surface-600')}>
                                    {resultLabels[cal.result] ?? cal.result}
                                </span>
                                <span className="text-[10px] text-surface-400 bg-surface-100 rounded px-1.5 py-0.5">
                                    {typeLabels[cal.calibration_type] ?? cal.calibration_type}
                                </span>
                            </div>
                            <div className="flex items-center gap-4 mt-1.5 text-xs text-surface-500">
                                <span className="flex items-center gap-1">
                                    <Calendar className="h-3 w-3" /> {fmtDate(cal.calibration_date)}
                                </span>
                                {cal.next_due_date && (
                                    <span className="flex items-center gap-1">
                                        <Clock className="h-3 w-3" /> Próxima: {fmtDate(cal.next_due_date)}
                                    </span>
                                )}
                                {cal.performer && (
                                    <span className="flex items-center gap-1">
                                        <User className="h-3 w-3" /> {cal.performer.name}
                                    </span>
                                )}
                            </div>
                            {(cal.uncertainty || cal.error_found) && (
                                <div className="flex items-center gap-4 mt-1 text-xs text-surface-400">
                                    {cal.error_found && <span>Erro: {cal.error_found}</span>}
                                    {cal.uncertainty && <span>Incerteza: ±{cal.uncertainty}</span>}
                                </div>
                            )}
                            {cal.standard_weights && cal.standard_weights.length > 0 && (
                                <div className="flex items-center gap-1 mt-1 flex-wrap">
                                    {cal.standard_weights.map(sw => (
                                        <span key={sw.id} className="inline-flex items-center gap-0.5 text-[10px] bg-blue-50 text-blue-600 rounded px-1.5 py-0.5">
                                            <Scale className="h-2.5 w-2.5" /> {sw.code} ({sw.nominal_value}{sw.unit})
                                        </span>
                                    ))}
                                </div>
                            )}
                        </div>
                        <button
                            onClick={() => onDownloadCertificate(cal)}
                            className="rounded-md p-1.5 text-surface-400 hover:bg-brand-50 hover:text-brand-600 transition-colors shrink-0"
                            title="Baixar Certificado PDF"
                        >
                            <Download className="h-4 w-4" />
                        </button>
                    </div>
                </div>
            ))}
        </div>
    )
}

/* ═══════════ Calibration Modal ═══════════ */

function CalibrationModal({ equipmentId, onClose, onSuccess }: { equipmentId: number; onClose: () => void; onSuccess: () => void }) {

    const set = <K extends keyof CalibrationForm>(key: K, value: CalibrationForm[K]) =>
        setForm(prev => ({ ...prev, [key]: value }))

    // Fetch standard weights
    const { data: swData } = useQuery<{ data: StandardWeight[] }>({
        queryKey: ['standard-weights-list'],
        const { data } = useQuery({
        queryFn: () => api.get('/standard-weights?per_page=200').then(r => r.data),
    })
    const allWeights = swData?.data ?? []
    const filteredWeights = allWeights.filter(sw =>
        !form.standard_weight_ids.includes(sw.id) &&
        (sw.code.toLowerCase().includes(swSearch.toLowerCase()) ||
            sw.nominal_value.includes(swSearch))
    )
    const selectedWeights = allWeights.filter(sw => form.standard_weight_ids.includes(sw.id))

    const mutation = useMutation({
        mutationFn: (data: CalibrationForm) => {
            const payload: Record<string, any> = {
                calibration_date: data.calibration_date,
                calibration_type: data.calibration_type,
                result: data.result,
            }
            if (data.laboratory) payload.laboratory = data.laboratory
            if (data.certificate_number) payload.certificate_number = data.certificate_number
            if (data.standard_used) payload.standard_used = data.standard_used
            if (data.standard_weight_ids.length) payload.standard_weight_ids = data.standard_weight_ids
            if (data.uncertainty) payload.uncertainty = parseFloat(data.uncertainty)
            if (data.error_found) payload.error_found = parseFloat(data.error_found)
            if (data.temperature) payload.temperature = parseFloat(data.temperature)
            if (data.humidity) payload.humidity = parseFloat(data.humidity)
            if (data.pressure) payload.pressure = parseFloat(data.pressure)
            if (data.technician_notes) payload.technician_notes = data.technician_notes
            if (data.notes) payload.notes = data.notes

            return api.post(`/equipments/${equipmentId}/calibrations`, payload)
        },
        onSuccess: () => {
            toast.success('Calibração registrada com sucesso!')
            onSuccess()
        },
        onError: (error: any) => {
            if (error.response?.status === 422) {
                setFieldErrors(error.response.data.errors ?? {})
                toast.error('Corrija os campos destacados')
            } else if (error.response?.status === 403) {
                toast.error('Sem permissão para registrar calibração')
            } else {
                toast.error(error.response?.data?.message ?? 'Erro ao registrar calibração')
            }
        },
    })

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        setFieldErrors({})
        mutation.mutate(form)
    }

    const toggleWeight = (id: number) => {
        set('standard_weight_ids',
            form.standard_weight_ids.includes(id)
                ? form.standard_weight_ids.filter(x => x !== id)
                : [...form.standard_weight_ids, id]
        )
    }

    return (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-8 bg-black/40 backdrop-blur-sm overflow-y-auto" onClick={onClose}>
            <div className="bg-surface-0 rounded-xl shadow-xl border border-default w-full max-w-2xl my-8" onClick={e => e.stopPropagation()}>
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-3 border-b border-default">
                    <div>
                        <h2 className="text-sm font-semibold text-surface-800">Nova Calibração</h2>
                        <p className="text-xs text-surface-500 mt-0.5">Registrar calibração com pesos padrão</p>
                    </div>
                    <button onClick={onClose} className="p-1 rounded-md hover:bg-surface-100 text-surface-400">
                        <X className="h-4 w-4" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
                    {/* Row 1: Date + Type + Result */}
                    <div className="grid grid-cols-3 gap-3">
                        <FormField label="Data *" error={fieldErrors.calibration_date}>
                            <input type="date" value={form.calibration_date} onChange={e => set('calibration_date', e.target.value)}
                                className="form-input" required />
                        </FormField>
                        <FormField label="Tipo *" error={fieldErrors.calibration_type}>
                            <select value={form.calibration_type} onChange={e => set('calibration_type', e.target.value)} className="form-input">
                                <option value="interna">Interna</option>
                                <option value="externa">Externa</option>
                                <option value="rastreada_rbc">Rastreada RBC</option>
                            </select>
                        </FormField>
                        <FormField label="Resultado *" error={fieldErrors.result}>
                            <select value={form.result} onChange={e => set('result', e.target.value)} className="form-input">
                                <option value="aprovado">Aprovado</option>
                                <option value="aprovado_com_ressalva">Aprovado c/ Ressalva</option>
                                <option value="reprovado">Reprovado</option>
                            </select>
                        </FormField>
                    </div>

                    {/* Row 2: Lab + Certificate */}
                    <div className="grid grid-cols-2 gap-3">
                        <FormField label="Laboratório" error={fieldErrors.laboratory}>
                            <input type="text" value={form.laboratory} onChange={e => set('laboratory', e.target.value)}
                                placeholder="Nome do laboratório" className="form-input" />
                        </FormField>
                        <FormField label="Nº Certificado" error={fieldErrors.certificate_number}>
                            <input type="text" value={form.certificate_number} onChange={e => set('certificate_number', e.target.value)}
                                placeholder="Auto-gerado se vazio" className="form-input" />
                        </FormField>
                    </div>

                    {/* Row 3: Metrological Data */}
                    <div className="grid grid-cols-2 gap-3">
                        <FormField label="Erro Encontrado" error={fieldErrors.error_found}>
                            <input type="number" step="0.0001" value={form.error_found} onChange={e => set('error_found', e.target.value)}
                                placeholder="0.0000" className="form-input" />
                        </FormField>
                        <FormField label="Incerteza (±)" error={fieldErrors.uncertainty}>
                            <input type="number" step="0.0001" value={form.uncertainty} onChange={e => set('uncertainty', e.target.value)}
                                placeholder="0.0000" className="form-input" />
                        </FormField>
                    </div>

                    {/* Row 4: Environmental Conditions */}
                    <div>
                        <p className="text-[11px] font-semibold text-surface-500 uppercase tracking-wider mb-2">Condições Ambientais</p>
                        <div className="grid grid-cols-3 gap-3">
                            <FormField label="Temp. (°C)" error={fieldErrors.temperature}>
                                <input type="number" step="0.01" value={form.temperature} onChange={e => set('temperature', e.target.value)}
                                    placeholder="20.00" className="form-input" />
                            </FormField>
                            <FormField label="Umidade (%)" error={fieldErrors.humidity}>
                                <input type="number" step="0.01" value={form.humidity} onChange={e => set('humidity', e.target.value)}
                                    placeholder="50.00" className="form-input" />
                            </FormField>
                            <FormField label="Pressão (hPa)" error={fieldErrors.pressure}>
                                <input type="number" step="0.01" value={form.pressure} onChange={e => set('pressure', e.target.value)}
                                    placeholder="1013.25" className="form-input" />
                            </FormField>
                        </div>
                    </div>

                    {/* Standard Weights Picker */}
                    <div>
                        <p className="text-[11px] font-semibold text-surface-500 uppercase tracking-wider mb-2">
                            Pesos Padrão Utilizados
                        </p>

                        {/* Selected Weights */}
                        {selectedWeights.length > 0 && (
                            <div className="flex flex-wrap gap-1.5 mb-2">
                                {selectedWeights.map(sw => (
                                    <span key={sw.id} className="inline-flex items-center gap-1 bg-brand-50 text-brand-700 rounded-md px-2 py-1 text-xs font-medium border border-brand-200">
                                        <Scale className="h-3 w-3" />
                                        {sw.code} ({sw.nominal_value}{sw.unit}) — {sw.precision_class}
                                        <button type="button" onClick={() => toggleWeight(sw.id)} className="ml-0.5 hover:text-red-600">
                                            <X className="h-3 w-3" />
                                        </button>
                                    </span>
                                ))}
                            </div>
                        )}

                        {/* Search + Picker */}
                        <div className="relative">
                            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-surface-400 pointer-events-none" />
                            <input
                                type="text"
                                value={swSearch}
                                onChange={e => setSwSearch(e.target.value)}
                                placeholder="Buscar peso padrão por código ou valor..."
                                className="form-input pl-8 text-xs"
                            />
                        </div>

                        {/* Available Weights */}
                        {(swSearch || allWeights.length <= 10) && filteredWeights.length > 0 && (
                            <div className="mt-1.5 max-h-32 overflow-y-auto rounded-lg border border-default divide-y divide-default">
                                {filteredWeights.slice(0, 20).map(sw => (
                                    <button
                                        key={sw.id}
                                        type="button"
                                        onClick={() => toggleWeight(sw.id)}
                                        className="w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-brand-50 transition-colors text-left"
                                    >
                                        <Scale className="h-3 w-3 text-surface-400 shrink-0" />
                                        <span className="font-medium text-surface-700">{sw.code}</span>
                                        <span className="text-surface-500">{sw.nominal_value} {sw.unit}</span>
                                        <span className="text-surface-400 ml-auto">{sw.precision_class}</span>
                                        {sw.certificate_status === 'expired' && (
                                            <span className="text-[9px] bg-red-100 text-red-600 rounded px-1 font-semibold">Vencido</span>
                                        )}
                                    </button>
                                ))}
                            </div>
                        )}
                        {swSearch && filteredWeights.length === 0 && (
                            <p className="text-[11px] text-surface-400 mt-1">Nenhum peso padrão encontrado</p>
                        )}
                    </div>

                    {/* Standard Used (text) */}
                    <FormField label="Padrão Utilizado (texto livre)" error={fieldErrors.standard_used}>
                        <input type="text" value={form.standard_used} onChange={e => set('standard_used', e.target.value)}
                            placeholder="Descrição do padrão utilizado" className="form-input" />
                    </FormField>

                    {/* Notes */}
                    <div className="grid grid-cols-2 gap-3">
                        <FormField label="Notas Técnicas" error={fieldErrors.technician_notes}>
                            <textarea value={form.technician_notes} onChange={e => set('technician_notes', e.target.value)}
                                rows={2} placeholder="Observações técnicas" className="form-input resize-none" />
                        </FormField>
                        <FormField label="Observações Gerais" error={fieldErrors.notes}>
                            <textarea value={form.notes} onChange={e => set('notes', e.target.value)}
                                rows={2} placeholder="Observações gerais" className="form-input resize-none" />
                        </FormField>
                    </div>

                    {/* Actions */}
                    <div className="flex justify-end gap-2 pt-2 border-t border-default">
                        <button type="button" onClick={onClose} className="btn-ghost text-xs py-2 px-4">Cancelar</button>
                        <button type="submit" disabled={mutation.isPending} className="btn-primary text-xs py-2 px-5 gap-1.5">
                            {mutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                            Registrar Calibração
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}

function FormField({ label, error, children }: { label: string; error?: string[]; children: React.ReactNode }) {
    return (
        <div>
            <label className="block text-[11px] font-medium text-surface-600 mb-1">{label}</label>
            {children}
            {error?.map((e, i) => <p key={i} className="text-[10px] text-red-500 mt-0.5">{e}</p>)}
        </div>
    )
}

/* ═══════════ Maintenance Tab ═══════════ */

function MaintenanceTab({ maintenances }: { maintenances: Maintenance[] }) {
    if (!maintenances?.length) {
        return (
            <div className="text-center py-8 text-surface-400">
                <Wrench className="mx-auto h-10 w-10 mb-2 opacity-40" />
                <p className="text-sm font-medium">Nenhuma manutenção registrada</p>
            </div>
        )
    }

    return (
        <div className="space-y-3">
            {maintenances.map(m => (
                <div key={m.id} className="rounded-lg border border-default p-3 hover:bg-surface-50 transition-colors">
                    <div className="flex items-center gap-2 text-xs">
                        <span className="font-medium text-surface-800">{m.maintenance_type}</span>
                        <span className="text-surface-400">•</span>
                        <span className="text-surface-500">{fmtDate(m.maintenance_date)}</span>
                        {m.performer && (
                            <>
                                <span className="text-surface-400">•</span>
                                <span className="text-surface-500">{m.performer.name}</span>
                            </>
                        )}
                        {m.cost && (
                            <>
                                <span className="text-surface-400">•</span>
                                <span className="font-medium text-surface-700">R$ {Number(m.cost).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                            </>
                        )}
                    </div>
                    {m.description && <p className="text-xs text-surface-500 mt-1">{m.description}</p>}
                </div>
            ))}
        </div>
    )
}

/* ═══════════ Document Tab ═══════════ */

function DocumentTab({ documents }: { documents: Equipment['documents'] }) {
    if (!documents?.length) {
        return (
            <div className="text-center py-8 text-surface-400">
                <FileText className="mx-auto h-10 w-10 mb-2 opacity-40" />
                <p className="text-sm font-medium">Nenhum documento anexado</p>
            </div>
        )
    }

    return (
        <div className="space-y-2">
            {documents.map(doc => (
                <div key={doc.id} className="flex items-center justify-between rounded-lg border border-default p-3 hover:bg-surface-50 transition-colors">
                    <div className="flex items-center gap-2 text-xs">
                        <FileText className="h-4 w-4 text-surface-400" />
                        <span className="font-medium text-surface-800">{doc.name}</span>
                        <span className="text-surface-400">{doc.type}</span>
                        <span className="text-surface-400">{fmtDate(doc.created_at)}</span>
                    </div>
                    <a href={doc.file_path} target="_blank" rel="noopener noreferrer" className="rounded-md p-1 text-surface-400 hover:text-brand-600">
                        <Download className="h-3.5 w-3.5" />
                    </a>
                </div>
            ))}
        </div>
    )
}
