import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
    History, Scale, Wrench, FileText, Download, Calendar, CheckCircle2, XCircle,
    TrendingUp, AlertTriangle, Loader2, ArrowLeft, ChevronRight,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import api from '@/lib/api'
import { toast } from 'sonner'

interface Equipment {
    id: number
    name: string
    model?: string
    brand?: string
    serial_number?: string
    tag?: string
    customer?: { name: string }
    customer_name?: string
    equipment_class?: string
    precision?: string
}

interface Calibration {
    id: number
    calibration_date: string
    result: string
    certificate_number?: string
    certificate_pdf_path?: string
    certificate_url?: string
    performed_by?: number
    performer?: { name: string }
    readings_count?: number
}

interface WorkOrder {
    id: number
    os_number?: string
    number?: string
    status: string
    description?: string
    created_at?: string
    assignee?: { name: string }
    technicians?: { name: string }[]
}

const STATUS_BADGE: Record<string, string> = {
    pending: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    in_progress: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    completed: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
    cancelled: 'bg-surface-200 text-surface-600 dark:bg-surface-700 dark:text-surface-400',
}

export default function TechEquipmentHistoryPage() {
    const { id } = useParams<{ id: string }>()
    const navigate = useNavigate()
    const [equipment, setEquipment] = useState<Equipment | null>(null)
    const [calibrations, setCalibrations] = useState<Calibration[]>([])
    const [workOrders, setWorkOrders] = useState<WorkOrder[]>([])
    const [loading, setLoading] = useState(true)
    const [tab, setTab] = useState<'calibracoes' | 'manutencoes' | 'certificados'>('calibracoes')

    useEffect(() => {
        if (!id) return
        loadData()
    }, [id])

    async function loadData() {
        if (!id) return
        setLoading(true)
        try {
            const [eqRes, calRes, woRes] = await Promise.all([
                api.get(`/equipments/${id}`),
                api.get(`/equipments/${id}/calibrations`),
                api.get('/work-orders', { params: { equipment_id: id, per_page: 20 } }),
            ])
            const eqData = eqRes.data?.equipment ?? eqRes.data?.data ?? eqRes.data
            setEquipment(eqData)
            const calData = calRes.data?.calibrations ?? calRes.data?.data ?? calRes.data ?? []
            setCalibrations(Array.isArray(calData) ? calData : [])
            const woData = woRes.data?.data ?? woRes.data ?? []
            const woList = Array.isArray(woData) ? woData : woData?.data ?? []
            setWorkOrders(woList)
        } catch {
            toast.error('Erro ao carregar dados do equipamento')
        } finally {
            setLoading(false)
        }
    }

    const last3Cal = calibrations.slice(0, 3)
    const allPassed = last3Cal.length >= 3 && last3Cal.every((c) => c.result === 'aprovado' || c.result === 'approved' || c.result === 'aprovado_com_ressalva')
    const trendLabel = allPassed ? 'Tendência estável' : last3Cal.some((c) => c.result === 'reprovado' || c.result === 'rejected') ? 'Atenção' : null
    const trendColor = allPassed ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'

    const nextCalDate = equipment && (equipment as any).next_calibration_at
        ? new Date((equipment as any).next_calibration_at)
        : null

    const certificates = calibrations
        .filter((c) => c.certificate_number || c.certificate_pdf_path || c.certificate_url)
        .map((c) => ({
            id: c.id,
            number: c.certificate_number,
            date: c.calibration_date,
            hasPdf: !!c.certificate_pdf_path || !!c.certificate_url,
        }))

    async function openCertificatePdf(calId: number) {
        if (!id) return
        try {
            const { data } = await api.get(`/equipments/${id}/calibrations/${calId}/pdf`, { responseType: 'blob' })
            const url = URL.createObjectURL(data)
            window.open(url, '_blank')
            setTimeout(() => URL.revokeObjectURL(url), 60000)
        } catch {
            toast.error('Erro ao abrir certificado')
        }
    }

    if (loading) {
        return (
            <div className="flex flex-col h-full">
                <header className="bg-white dark:bg-surface-900 px-4 py-3 flex items-center gap-3 border-b border-surface-200 dark:border-surface-700">
                    <button onClick={() => navigate('/tech/equipamentos')} className="p-1">
                        <ArrowLeft className="w-5 h-5 text-surface-600 dark:text-surface-300" />
                    </button>
                    <h1 className="text-lg font-bold text-surface-900 dark:text-surface-50">Histórico do Equipamento</h1>
                </header>
                <div className="flex-1 flex items-center justify-center">
                    <Loader2 className="w-8 h-8 animate-spin text-brand-500" />
                </div>
            </div>
        )
    }

    if (!equipment) {
        return (
            <div className="flex flex-col h-full">
                <header className="bg-white dark:bg-surface-900 px-4 py-3 flex items-center gap-3 border-b border-surface-200 dark:border-surface-700">
                    <button onClick={() => navigate('/tech/equipamentos')} className="p-1">
                        <ArrowLeft className="w-5 h-5 text-surface-600 dark:text-surface-300" />
                    </button>
                    <h1 className="text-lg font-bold text-surface-900 dark:text-surface-50">Equipamento não encontrado</h1>
                </header>
                <div className="flex-1 flex items-center justify-center p-4">
                    <p className="text-sm text-surface-500">Equipamento não encontrado.</p>
                </div>
            </div>
        )
    }

    return (
        <div className="flex flex-col h-full">
            <header className="bg-white dark:bg-surface-900 px-4 py-3 flex items-center gap-3 border-b border-surface-200 dark:border-surface-700">
                <button onClick={() => navigate('/tech/equipamentos')} className="p-1">
                    <ArrowLeft className="w-5 h-5 text-surface-600 dark:text-surface-300" />
                </button>
                <History className="w-5 h-5 text-brand-600 dark:text-brand-400" />
                <h1 className="text-lg font-bold text-surface-900 dark:text-surface-50">Histórico do Equipamento</h1>
            </header>

            <div className="p-4">
                <div className="bg-white dark:bg-surface-800/80 rounded-xl p-4 space-y-2">
                    <span className="text-sm font-semibold text-surface-900 dark:text-surface-50">{equipment.name}</span>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-surface-500">
                        {equipment.model && <span>Modelo: {equipment.model}</span>}
                        {equipment.brand && <span>Marca: {equipment.brand}</span>}
                        {equipment.serial_number && <span>S/N: {equipment.serial_number}</span>}
                        {(equipment.customer?.name || equipment.customer_name) && (
                            <span>Cliente: {equipment.customer?.name || equipment.customer_name}</span>
                        )}
                        {(equipment.equipment_class || equipment.precision) && (
                            <span>Classe: {equipment.equipment_class || equipment.precision}</span>
                        )}
                    </div>
                </div>
            </div>

            <div className="flex border-b border-surface-200 dark:border-surface-700">
                <button
                    onClick={() => setTab('calibracoes')}
                    className={cn(
                        'flex-1 py-3 text-sm font-medium flex items-center justify-center gap-1',
                        tab === 'calibracoes'
                            ? 'text-brand-600 dark:text-brand-400 border-b-2 border-brand-500'
                            : 'text-surface-500 dark:text-surface-400'
                    )}
                >
                    <Scale className="w-4 h-4" /> Calibrações
                </button>
                <button
                    onClick={() => setTab('manutencoes')}
                    className={cn(
                        'flex-1 py-3 text-sm font-medium flex items-center justify-center gap-1',
                        tab === 'manutencoes'
                            ? 'text-brand-600 dark:text-brand-400 border-b-2 border-brand-500'
                            : 'text-surface-500 dark:text-surface-400'
                    )}
                >
                    <Wrench className="w-4 h-4" /> Manutenções
                </button>
                <button
                    onClick={() => setTab('certificados')}
                    className={cn(
                        'flex-1 py-3 text-sm font-medium flex items-center justify-center gap-1',
                        tab === 'certificados'
                            ? 'text-brand-600 dark:text-brand-400 border-b-2 border-brand-500'
                            : 'text-surface-500 dark:text-surface-400'
                    )}
                >
                    <FileText className="w-4 h-4" /> Certificados
                </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
                {tab === 'calibracoes' && (
                    <div className="space-y-4">
                        {trendLabel && (
                            <div className={cn('flex items-center gap-2 text-sm font-medium', trendColor)}>
                                {allPassed ? <TrendingUp className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
                                {trendLabel}
                            </div>
                        )}
                        {nextCalDate && (
                            <div className="flex items-center gap-2 text-sm text-surface-600 dark:text-surface-400">
                                <Calendar className="w-4 h-4" />
                                Próxima calibração: {nextCalDate.toLocaleDateString('pt-BR')}
                                {(() => {
                                    const diff = Math.ceil((nextCalDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
                                    return diff > 0 ? ` (em ${diff} dias)` : diff === 0 ? ' (hoje)' : ' (vencida)'
                                })()}
                            </div>
                        )}
                        <div className="space-y-2">
                            {calibrations.map((cal) => {
                                const pass = cal.result === 'aprovado' || cal.result === 'approved' || cal.result === 'aprovado_com_ressalva'
                                return (
                                    <div key={cal.id} className="bg-white dark:bg-surface-800/80 rounded-xl p-4 flex items-center justify-between">
                                        <div>
                                            <p className="text-sm font-medium text-surface-900 dark:text-surface-50">
                                                {new Date(cal.calibration_date).toLocaleDateString('pt-BR')}
                                            </p>
                                            <p className="text-xs text-surface-500">
                                                {cal.performer?.name || 'Técnico'} • {cal.readings_count ?? '—'} leituras
                                            </p>
                                        </div>
                                        <span className={cn(
                                            'px-2 py-0.5 rounded-full text-[10px] font-medium flex items-center gap-1',
                                            pass ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                                        )}>
                                            {pass ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                                            {pass ? 'Aprovado' : 'Reprovado'}
                                        </span>
                                    </div>
                                )
                            })}
                        </div>
                        {calibrations.length === 0 && (
                            <div className="flex flex-col items-center justify-center py-16 gap-2">
                                <Scale className="w-12 h-12 text-surface-300" />
                                <p className="text-sm text-surface-500">Nenhuma calibração registrada</p>
                            </div>
                        )}
                    </div>
                )}

                {tab === 'manutencoes' && (
                    <div className="space-y-2">
                        {workOrders.map((wo) => (
                            <button
                                key={wo.id}
                                onClick={() => navigate(`/tech/os/${wo.id}`)}
                                className="w-full text-left bg-white dark:bg-surface-800/80 rounded-xl p-4 flex items-center justify-between active:scale-[0.98]"
                            >
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-surface-900 dark:text-surface-50">
                                        OS {wo.os_number || wo.number || wo.id}
                                    </p>
                                    <p className="text-xs text-surface-500 mt-0.5">
                                        {wo.created_at ? new Date(wo.created_at).toLocaleDateString('pt-BR') : ''} • {wo.description?.slice(0, 50) || '—'}
                                    </p>
                                    <p className="text-xs text-surface-400 mt-0.5">
                                        {wo.assignee?.name || wo.technicians?.[0]?.name || '—'}
                                    </p>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className={cn('px-2 py-0.5 rounded-full text-[10px] font-medium', STATUS_BADGE[wo.status] || 'bg-surface-200 text-surface-600')}>
                                        {wo.status}
                                    </span>
                                    <ChevronRight className="w-4 h-4 text-surface-400" />
                                </div>
                            </button>
                        ))}
                        {workOrders.length === 0 && (
                            <div className="flex flex-col items-center justify-center py-16 gap-2">
                                <Wrench className="w-12 h-12 text-surface-300" />
                                <p className="text-sm text-surface-500">Nenhuma manutenção registrada</p>
                            </div>
                        )}
                    </div>
                )}

                {tab === 'certificados' && (
                    <div className="space-y-2">
                        {certificates.map((cert) => (
                            <div key={cert.id} className="bg-white dark:bg-surface-800/80 rounded-xl p-4 flex items-center justify-between">
                                <div>
                                    <p className="text-sm font-medium text-surface-900 dark:text-surface-50">
                                        {cert.number || `Certificado #${cert.id}`}
                                    </p>
                                    <p className="text-xs text-surface-500">
                                        {new Date(cert.date).toLocaleDateString('pt-BR')}
                                    </p>
                                </div>
                                {cert.hasPdf && (
                                    <button
                                        onClick={() => openCertificatePdf(cert.id)}
                                        className="flex items-center gap-2 px-3 py-2 rounded-lg bg-brand-100 dark:bg-brand-900/30 text-brand-700 dark:text-brand-400 text-sm font-medium"
                                    >
                                        <Download className="w-4 h-4" /> Baixar
                                    </button>
                                )}
                            </div>
                        ))}
                        {certificates.length === 0 && (
                            <div className="flex flex-col items-center justify-center py-16 gap-2">
                                <FileText className="w-12 h-12 text-surface-300" />
                                <p className="text-sm text-surface-500">Nenhum certificado disponível</p>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    )
}
