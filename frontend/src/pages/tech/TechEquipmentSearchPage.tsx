import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
    ArrowLeft, Search, Loader2, Gauge, Calendar, MapPin,
    AlertCircle, CheckCircle2, Clock, ChevronRight, QrCode,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import api from '@/lib/api'
import { toast } from 'sonner'

interface Equipment {
    id: number
    tag: string | null
    serial_number: string | null
    name: string
    brand: string | null
    model: string | null
    customer_name: string | null
    customer_id: number | null
    status: string
    calibration_status: string | null
    next_calibration_date: string | null
    location: string | null
}

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
    active: { label: 'Ativo', color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' },
    inactive: { label: 'Inativo', color: 'bg-surface-200 text-surface-600 dark:bg-surface-700 dark:text-surface-400' },
    maintenance: { label: 'Manutenção', color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' },
    calibrating: { label: 'Calibrando', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
    condemned: { label: 'Condenado', color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
}

const CAL_STATUS: Record<string, { label: string; icon: typeof CheckCircle2; color: string }> = {
    valid: { label: 'Calibrado', icon: CheckCircle2, color: 'text-emerald-600 dark:text-emerald-400' },
    expiring: { label: 'Vencendo', icon: Clock, color: 'text-amber-600 dark:text-amber-400' },
    expired: { label: 'Vencido', icon: AlertCircle, color: 'text-red-600 dark:text-red-400' },
    not_required: { label: 'N/A', icon: CheckCircle2, color: 'text-surface-400' },
}

export default function TechEquipmentSearchPage() {
    const navigate = useNavigate()
    const [search, setSearch] = useState('')
    const [equipments, setEquipments] = useState<Equipment[]>([])
    const [loading, setLoading] = useState(false)
    const [hasSearched, setHasSearched] = useState(false)
    const [selectedEquipment, setSelectedEquipment] = useState<Equipment | null>(null)
    const [detail, setDetail] = useState<any>(null)
    const [loadingDetail, setLoadingDetail] = useState(false)

    useEffect(() => {
        if (search.length < 2) {
            if (hasSearched && search.length === 0) {
                setEquipments([])
                setHasSearched(false)
            }
            return
        }
        const timer = setTimeout(searchEquipments, 400)
        return () => clearTimeout(timer)
    }, [search])

    async function searchEquipments() {
        setLoading(true)
        setHasSearched(true)
        try {
            const { data } = await api.get('/equipments', {
                params: { search, per_page: 20 }
            })
            setEquipments(data.data ?? data ?? [])
        } catch {
            toast.error('Erro ao buscar equipamentos')
        } finally {
            setLoading(false)
        }
    }

    async function openDetail(eq: Equipment) {
        setSelectedEquipment(eq)
        setLoadingDetail(true)
        try {
            const { data } = await api.get(`/equipments/${eq.id}`)
            setDetail(data.data ?? data)
        } catch {
            toast.error('Erro ao carregar detalhes')
        } finally {
            setLoadingDetail(false)
        }
    }

    if (selectedEquipment) {
        const calStatus = CAL_STATUS[selectedEquipment.calibration_status ?? ''] || CAL_STATUS.not_required
        const CalIcon = calStatus.icon
        const statusConf = STATUS_CONFIG[selectedEquipment.status] || STATUS_CONFIG.active

        return (
            <div className="flex flex-col h-full">
                <div className="bg-white dark:bg-surface-900 px-4 pt-3 pb-4 border-b border-surface-200 dark:border-surface-700">
                    <button onClick={() => { setSelectedEquipment(null); setDetail(null) }} className="flex items-center gap-1 text-sm text-brand-600 dark:text-brand-400 mb-2">
                        <ArrowLeft className="w-4 h-4" /> Voltar
                    </button>
                    <h1 className="text-lg font-bold text-surface-900 dark:text-surface-50">{selectedEquipment.name}</h1>
                    {selectedEquipment.tag && (
                        <p className="text-xs text-surface-500 mt-0.5">TAG: {selectedEquipment.tag}</p>
                    )}
                </div>

                <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
                    {loadingDetail ? (
                        <div className="flex justify-center py-12">
                            <Loader2 className="w-8 h-8 animate-spin text-brand-500" />
                        </div>
                    ) : (
                        <>
                            {/* Status cards */}
                            <div className="grid grid-cols-2 gap-2">
                                <div className="bg-white dark:bg-surface-800/80 rounded-xl p-3 text-center">
                                    <p className="text-[10px] text-surface-500 font-medium uppercase">Status</p>
                                    <span className={cn('mt-1 inline-block px-2 py-0.5 rounded-full text-xs font-medium', statusConf.color)}>
                                        {statusConf.label}
                                    </span>
                                </div>
                                <div className="bg-white dark:bg-surface-800/80 rounded-xl p-3 text-center">
                                    <p className="text-[10px] text-surface-500 font-medium uppercase">Calibração</p>
                                    <span className={cn('mt-1 inline-flex items-center gap-1 text-xs font-medium', calStatus.color)}>
                                        <CalIcon className="w-3.5 h-3.5" /> {calStatus.label}
                                    </span>
                                </div>
                            </div>

                            {/* Info card */}
                            <div className="bg-white dark:bg-surface-800/80 rounded-xl p-4 space-y-3">
                                <h3 className="text-xs font-semibold text-surface-400 uppercase">Informações</h3>
                                {[
                                    ['Nº Série', selectedEquipment.serial_number],
                                    ['Marca', selectedEquipment.brand],
                                    ['Modelo', selectedEquipment.model],
                                    ['Cliente', selectedEquipment.customer_name],
                                    ['Localização', selectedEquipment.location || detail?.location],
                                    ['Próx. Calibração', selectedEquipment.next_calibration_date
                                        ? new Date(selectedEquipment.next_calibration_date).toLocaleDateString('pt-BR')
                                        : null
                                    ],
                                ].filter(([, val]) => val).map(([label, val]) => (
                                    <div key={String(label)} className="flex items-center justify-between">
                                        <span className="text-xs text-surface-500">{label}</span>
                                        <span className="text-sm font-medium text-surface-900 dark:text-surface-50">{val}</span>
                                    </div>
                                ))}
                            </div>

                            {/* Recent calibrations */}
                            {detail?.calibrations?.length > 0 && (
                                <div className="bg-white dark:bg-surface-800/80 rounded-xl p-4 space-y-3">
                                    <h3 className="text-xs font-semibold text-surface-400 uppercase">Últimas Calibrações</h3>
                                    {detail.calibrations.slice(0, 5).map((cal: any) => (
                                        <div key={cal.id} className="flex items-center justify-between py-1.5 border-b border-surface-100 dark:border-surface-700 last:border-0">
                                            <div>
                                                <p className="text-sm text-surface-900 dark:text-surface-50">
                                                    {new Date(cal.calibration_date).toLocaleDateString('pt-BR')}
                                                </p>
                                                {cal.certificate_number && (
                                                    <p className="text-xs text-surface-500">Cert: {cal.certificate_number}</p>
                                                )}
                                            </div>
                                            <span className={cn(
                                                'px-2 py-0.5 rounded-full text-[10px] font-medium',
                                                cal.result === 'approved' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-red-100 text-red-700'
                                            )}>
                                                {cal.result === 'approved' ? 'Aprovado' : cal.result}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Recent work orders */}
                            {detail?.work_orders?.length > 0 && (
                                <div className="bg-white dark:bg-surface-800/80 rounded-xl p-4 space-y-3">
                                    <h3 className="text-xs font-semibold text-surface-400 uppercase">Últimas OS</h3>
                                    {detail.work_orders.slice(0, 5).map((wo: any) => (
                                        <button
                                            key={wo.id}
                                            onClick={() => navigate(`/tech/os/${wo.id}`)}
                                            className="w-full text-left flex items-center justify-between py-1.5 border-b border-surface-100 dark:border-surface-700 last:border-0"
                                        >
                                            <div>
                                                <p className="text-sm font-medium text-surface-900 dark:text-surface-50">{wo.os_number || wo.number}</p>
                                                <p className="text-xs text-surface-500">{wo.description?.slice(0, 50)}</p>
                                            </div>
                                            <ChevronRight className="w-4 h-4 text-surface-400" />
                                        </button>
                                    ))}
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>
        )
    }

    return (
        <div className="flex flex-col h-full">
            <div className="bg-white dark:bg-surface-900 px-4 pt-3 pb-4 border-b border-surface-200 dark:border-surface-700">
                <button onClick={() => navigate('/tech')} className="flex items-center gap-1 text-sm text-brand-600 dark:text-brand-400 mb-2">
                    <ArrowLeft className="w-4 h-4" /> Voltar
                </button>
                <h1 className="text-lg font-bold text-surface-900 dark:text-surface-50">Equipamentos</h1>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
                {/* Search */}
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400" />
                    <input
                        type="text"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Buscar por TAG, nº série, nome..."
                        className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-white dark:bg-surface-800 border-0 text-sm placeholder:text-surface-400 focus:ring-2 focus:ring-brand-500/30 focus:outline-none"
                    />
                    {loading && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-brand-500" />}
                </div>

                {/* Scanner shortcut */}
                <button
                    onClick={() => navigate('/tech/barcode')}
                    className="w-full flex items-center gap-3 bg-white dark:bg-surface-800/80 rounded-xl p-3 active:scale-[0.98] transition-transform"
                >
                    <div className="w-9 h-9 rounded-lg bg-brand-100 dark:bg-brand-900/30 flex items-center justify-center">
                        <QrCode className="w-5 h-5 text-brand-600 dark:text-brand-400" />
                    </div>
                    <div className="flex-1">
                        <p className="text-sm font-medium text-surface-900 dark:text-surface-50">Escanear QR Code / Código de Barras</p>
                        <p className="text-xs text-surface-500">Use a câmera para buscar</p>
                    </div>
                    <ChevronRight className="w-5 h-5 text-surface-400" />
                </button>

                {/* Results */}
                {loading ? (
                    <div className="flex justify-center py-8">
                        <Loader2 className="w-6 h-6 animate-spin text-brand-500" />
                    </div>
                ) : !hasSearched ? (
                    <div className="flex flex-col items-center justify-center py-16 gap-3">
                        <Gauge className="w-12 h-12 text-surface-300" />
                        <p className="text-sm text-surface-500">Digite para buscar equipamentos</p>
                    </div>
                ) : equipments.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 gap-3">
                        <Gauge className="w-12 h-12 text-surface-300" />
                        <p className="text-sm text-surface-500">Nenhum equipamento encontrado</p>
                    </div>
                ) : (
                    <div className="space-y-2">
                        {equipments.map(eq => {
                            const statusConf = STATUS_CONFIG[eq.status] || STATUS_CONFIG.active
                            return (
                                <button
                                    key={eq.id}
                                    onClick={() => openDetail(eq)}
                                    className="w-full text-left bg-white dark:bg-surface-800/80 rounded-xl p-3 active:scale-[0.98] transition-transform"
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="w-9 h-9 rounded-lg bg-surface-100 dark:bg-surface-700 flex items-center justify-center flex-shrink-0">
                                            <Gauge className="w-4 h-4 text-surface-500" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2">
                                                <p className="text-sm font-medium text-surface-900 dark:text-surface-50 truncate">{eq.name}</p>
                                                <span className={cn('px-1.5 py-0.5 rounded-full text-[10px] font-medium flex-shrink-0', statusConf.color)}>
                                                    {statusConf.label}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-2 text-xs text-surface-500 mt-0.5">
                                                {eq.tag && <span>TAG: {eq.tag}</span>}
                                                {eq.serial_number && <span>S/N: {eq.serial_number}</span>}
                                            </div>
                                            {eq.customer_name && (
                                                <p className="text-xs text-surface-400 truncate mt-0.5">{eq.customer_name}</p>
                                            )}
                                        </div>
                                        <ChevronRight className="w-5 h-5 text-surface-300 flex-shrink-0" />
                                    </div>
                                </button>
                            )
                        })}
                    </div>
                )}
            </div>
        </div>
    )
}
