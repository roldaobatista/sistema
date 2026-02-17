import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
    ArrowLeft, Search, Loader2, Gauge, Calendar, MapPin,
    AlertCircle, CheckCircle2, Clock, ChevronRight, QrCode, History,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import api from '@/lib/api'
import { toast } from 'sonner'

interface Equipment {
    id: number
    code: string
    type: string | null
    tag: string | null
    serial_number: string | null
    brand: string | null
    model: string | null
    customer?: { id: number; name: string } | null
    status: string
    calibration_status: string | null
    next_calibration_at: string | null
    location: string | null
}

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
    ativo: { label: 'Ativo', color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30' },
    em_calibracao: { label: 'Em Calibração', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
    em_manutencao: { label: 'Em Manutenção', color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30' },
    fora_de_uso: { label: 'Fora de Uso', color: 'bg-surface-200 text-surface-600' },
    descartado: { label: 'Descartado', color: 'bg-red-100 text-red-700 dark:bg-red-900/30' },
}

const CAL_STATUS: Record<string, { label: string; icon: typeof CheckCircle2; color: string }> = {
    em_dia: { label: 'Calibrado', icon: CheckCircle2, color: 'text-emerald-600 dark:text-emerald-400' },
    vence_em_breve: { label: 'Vencendo', icon: Clock, color: 'text-amber-600 dark:text-amber-400' },
    vencida: { label: 'Vencido', icon: AlertCircle, color: 'text-red-600 dark:text-red-400' },
    sem_data: { label: 'N/A', icon: CheckCircle2, color: 'text-surface-400' },
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
        const calStatus = CAL_STATUS[selectedEquipment.calibration_status ?? ''] || CAL_STATUS.sem_data
        const CalIcon = calStatus.icon
        const statusConf = STATUS_CONFIG[selectedEquipment.status] || STATUS_CONFIG.ativo

        return (
            <div className="flex flex-col h-full">
                <div className="bg-card px-4 pt-3 pb-4 border-b border-border">
                    <button onClick={() => { setSelectedEquipment(null); setDetail(null) }} className="flex items-center gap-1 text-sm text-brand-600 mb-2">
                        <ArrowLeft className="w-4 h-4" /> Voltar
                    </button>
                    <h1 className="text-lg font-bold text-foreground">{selectedEquipment.brand} {selectedEquipment.model}</h1>
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
                                <div className="bg-card rounded-xl p-3 text-center">
                                    <p className="text-[10px] text-surface-500 font-medium uppercase">Status</p>
                                    <span className={cn('mt-1 inline-block px-2 py-0.5 rounded-full text-xs font-medium', statusConf.color)}>
                                        {statusConf.label}
                                    </span>
                                </div>
                                <div className="bg-card rounded-xl p-3 text-center">
                                    <p className="text-[10px] text-surface-500 font-medium uppercase">Calibração</p>
                                    <span className={cn('mt-1 inline-flex items-center gap-1 text-xs font-medium', calStatus.color)}>
                                        <CalIcon className="w-3.5 h-3.5" /> {calStatus.label}
                                    </span>
                                </div>
                            </div>

                            {/* Info card */}
                            <div className="bg-card rounded-xl p-4 space-y-3">
                                <h3 className="text-xs font-semibold text-surface-400 uppercase">Informações</h3>
                                {[
                                    ['Nº Série', selectedEquipment.serial_number],
                                    ['Marca', selectedEquipment.brand],
                                    ['Modelo', selectedEquipment.model],
                                    ['Cliente', selectedEquipment.customer?.name],
                                    ['Localização', selectedEquipment.location || detail?.equipment?.location],
                                    ['Próx. Calibração', selectedEquipment.next_calibration_at
                                        ? new Date(selectedEquipment.next_calibration_at).toLocaleDateString('pt-BR')
                                        : null
                                    ],
                                ].filter(([, val]) => val).map(([label, val]) => (
                                    <div key={String(label)} className="flex items-center justify-between">
                                        <span className="text-xs text-surface-500">{label}</span>
                                        <span className="text-sm font-medium text-foreground">{val}</span>
                                    </div>
                                ))}
                            </div>

                            <button
                                onClick={() => navigate(`/tech/equipamento/${selectedEquipment.id}`)}
                                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-brand-500 text-brand-600 text-sm font-medium"
                            >
                                <History className="w-4 h-4" />
                                Ver histórico completo
                            </button>

                            {/* Recent calibrations */}
                            {detail?.calibrations?.length > 0 && (
                                <div className="bg-card rounded-xl p-4 space-y-3">
                                    <h3 className="text-xs font-semibold text-surface-400 uppercase">Últimas Calibrações</h3>
                                    {detail.calibrations.slice(0, 5).map((cal: any) => (
                                        <div key={cal.id} className="flex items-center justify-between py-1.5 border-b border-surface-100 last:border-0">
                                            <div>
                                                <p className="text-sm text-foreground">
                                                    {new Date(cal.calibration_date).toLocaleDateString('pt-BR')}
                                                </p>
                                                {cal.certificate_number && (
                                                    <p className="text-xs text-surface-500">Cert: {cal.certificate_number}</p>
                                                )}
                                            </div>
                                            <span className={cn(
                                                'px-2 py-0.5 rounded-full text-[10px] font-medium',
                                                cal.result === 'aprovado' || cal.result === 'aprovado_com_ressalva'
                                                    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30'
                                                    : 'bg-red-100 text-red-700'
                                            )}>
                                                {cal.result === 'aprovado' ? 'Aprovado' : cal.result === 'aprovado_com_ressalva' ? 'C/ Ressalva' : 'Reprovado'}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Recent work orders */}
                            {detail?.work_orders?.length > 0 && (
                                <div className="bg-card rounded-xl p-4 space-y-3">
                                    <h3 className="text-xs font-semibold text-surface-400 uppercase">Últimas OS</h3>
                                    {detail.work_orders.slice(0, 5).map((wo: any) => (
                                        <button
                                            key={wo.id}
                                            onClick={() => navigate(`/tech/os/${wo.id}`)}
                                            className="w-full text-left flex items-center justify-between py-1.5 border-b border-surface-100 last:border-0"
                                        >
                                            <div>
                                                <p className="text-sm font-medium text-foreground">{wo.os_number || wo.number}</p>
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
            <div className="bg-card px-4 pt-3 pb-4 border-b border-border">
                <button onClick={() => navigate('/tech')} className="flex items-center gap-1 text-sm text-brand-600 mb-2">
                    <ArrowLeft className="w-4 h-4" /> Voltar
                </button>
                <h1 className="text-lg font-bold text-foreground">Equipamentos</h1>
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
                        className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-card border-0 text-sm placeholder:text-surface-400 focus:ring-2 focus:ring-brand-500/30 focus:outline-none"
                    />
                    {loading && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-brand-500" />}
                </div>

                {/* Scanner shortcut */}
                <button
                    onClick={() => navigate('/tech/barcode')}
                    className="w-full flex items-center gap-3 bg-card rounded-xl p-3 active:scale-[0.98] transition-transform"
                >
                    <div className="w-9 h-9 rounded-lg bg-brand-100 flex items-center justify-center">
                        <QrCode className="w-5 h-5 text-brand-600" />
                    </div>
                    <div className="flex-1">
                        <p className="text-sm font-medium text-foreground">Escanear QR Code / Código de Barras</p>
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
                            const statusConf = STATUS_CONFIG[eq.status] || STATUS_CONFIG.ativo
                            return (
                                <button
                                    key={eq.id}
                                    onClick={() => openDetail(eq)}
                                    className="w-full text-left bg-card rounded-xl p-3 active:scale-[0.98] transition-transform"
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="w-9 h-9 rounded-lg bg-surface-100 flex items-center justify-center flex-shrink-0">
                                            <Gauge className="w-4 h-4 text-surface-500" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2">
                                                <p className="text-sm font-medium text-foreground truncate">{eq.brand} {eq.model}</p>
                                                <span className={cn('px-1.5 py-0.5 rounded-full text-[10px] font-medium flex-shrink-0', statusConf.color)}>
                                                    {statusConf.label}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-2 text-xs text-surface-500 mt-0.5">
                                                {eq.tag && <span>TAG: {eq.tag}</span>}
                                                {eq.serial_number && <span>S/N: {eq.serial_number}</span>}
                                            </div>
                                            {eq.customer?.name && (
                                                <p className="text-xs text-surface-400 truncate mt-0.5">{eq.customer.name}</p>
                                            )}
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation()
                                                    navigate(`/tech/equipamento/${eq.id}`)
                                                }}
                                                className="flex items-center gap-1 text-[11px] text-brand-600 font-medium mt-2"
                                            >
                                                <History className="w-3 h-3" /> Ver histórico
                                            </button>
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
