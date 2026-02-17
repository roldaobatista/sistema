import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
    Wrench, Scale, Search, QrCode, Calendar, CheckCircle2, AlertTriangle, XCircle,
    Loader2, ArrowLeft, Shield, Package,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import api from '@/lib/api'
import { toast } from 'sonner'

interface ToolCalibration {
    id: number
    tool_id?: number
    tool_name?: string
    tool_type?: string
    serial_number?: string
    last_calibration_date?: string
    next_due_date?: string
    status?: 'valid' | 'expiring' | 'expired'
}

interface StandardWeight {
    id: number
    value: number
    unit?: string
    serial_number?: string
    class?: string
    validity_date?: string
    status?: 'valid' | 'expiring' | 'expired'
}

const MS_PER_DAY = 86400000
const EXPIRING_DAYS = 30

function getCalibrationStatus(nextDue?: string): 'valid' | 'expiring' | 'expired' {
    if (!nextDue) return 'valid'
    const due = new Date(nextDue).getTime()
    const now = Date.now()
    const daysLeft = (due - now) / MS_PER_DAY
    if (daysLeft < 0) return 'expired'
    if (daysLeft < EXPIRING_DAYS) return 'expiring'
    return 'valid'
}

function formatDate(dateStr?: string) {
    if (!dateStr) return '—'
    return new Date(dateStr).toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
    })
}

export default function TechToolInventoryPage() {
    const navigate = useNavigate()
    const [tab, setTab] = useState<'tools' | 'weights'>('tools')
    const [search, setSearch] = useState('')
    const [tools, setTools] = useState<ToolCalibration[]>([])
    const [weights, setWeights] = useState<StandardWeight[]>([])
    const [loadingTools, setLoadingTools] = useState(true)
    const [loadingWeights, setLoadingWeights] = useState(true)
    const [toolsApiError, setToolsApiError] = useState(false)
    const [weightsApiError, setWeightsApiError] = useState(false)
    const [scanning, setScanning] = useState(false)

    useEffect(() => {
        async function fetchTools() {
            setLoadingTools(true)
            setToolsApiError(false)
            try {
                const endpoints = [
                    '/tool-calibrations?my=1',
                    '/fleet/tool-inventory?user_id=current',
                    '/fleet/tool-inventory?assigned_to_user=current',
                ]
                let data: any[] = []
                for (const ep of endpoints) {
                    try {
                        const { data: res } = await api.get(ep)
                        const items = res?.data ?? res?.tools ?? res ?? []
                        if (Array.isArray(items) && items.length > 0) {
                            data = items
                            break
                        }
                    } catch {
                        continue
                    }
                }
                const mapped: ToolCalibration[] = (data || []).map((t: any) => {
                    const nextDue = t.next_due_date ?? t.next_calibration_date ?? t.validity_date
                    const status = getCalibrationStatus(nextDue)
                    return {
                        id: t.id ?? t.tool_id,
                        tool_id: t.tool_id,
                        tool_name: t.name ?? t.tool_name ?? t.description ?? `Ferramenta #${t.id}`,
                        tool_type: t.type ?? t.tool_type ?? t.category,
                        serial_number: t.serial_number ?? t.serial,
                        last_calibration_date: t.last_calibration_date ?? t.calibration_date,
                        next_due_date: nextDue,
                        status,
                    }
                })
                setTools(mapped)
            } catch {
                setToolsApiError(true)
                setTools([])
                toast.error('Erro ao carregar ferramentas')
            } finally {
                setLoadingTools(false)
            }
        }
        fetchTools()
    }, [])

    useEffect(() => {
        async function fetchWeights() {
            setLoadingWeights(true)
            setWeightsApiError(false)
            try {
                const endpoints = [
                    '/standard-weights?assigned_to=current',
                    '/standard-weights?my=1',
                ]
                let data: any[] = []
                for (const ep of endpoints) {
                    try {
                        const { data: res } = await api.get(ep)
                        const items = res?.data ?? res?.weights ?? res ?? []
                        if (Array.isArray(items) && items.length > 0) {
                            data = items
                            break
                        }
                    } catch {
                        continue
                    }
                }
                const mapped: StandardWeight[] = (data || []).map((w: any) => {
                    const validity = w.validity_date ?? w.next_calibration_date ?? w.next_due_date
                    const status = getCalibrationStatus(validity)
                    return {
                        id: w.id,
                        value: w.value ?? w.nominal_value ?? 0,
                        unit: w.unit ?? 'kg',
                        serial_number: w.serial_number ?? w.serial,
                        class: w.class ?? w.weight_class ?? w.accuracy_class,
                        validity_date: validity,
                        status,
                    }
                })
                setWeights(mapped)
            } catch {
                setWeightsApiError(true)
                setWeights([])
                toast.error('Erro ao carregar pesos padrão')
            } finally {
                setLoadingWeights(false)
            }
        }
        fetchWeights()
    }, [])

    const filteredTools = tools.filter(
        (t) =>
            !search ||
            [t.tool_name, t.tool_type, t.serial_number].some(
                (v) => v?.toLowerCase().includes(search.toLowerCase())
            )
    )

    const totalTools = tools.length
    const calibratedCount = tools.filter((t) => t.status === 'valid').length
    const expiredCount = tools.filter((t) => t.status === 'expired').length

    const handleRequestReplacement = () => {
        toast.info('Solicitação de substituição enviada. Aguarde retorno.')
    }

    const handleScanWeight = () => {
        setScanning(true)
        toast.info('Funcionalidade de leitura de QR em desenvolvimento')
        setTimeout(() => setScanning(false), 500)
    }

    const StatusBadge = ({ status }: { status: 'valid' | 'expiring' | 'expired' }) => {
        const config = {
            valid: { label: 'Calibrado', className: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40', Icon: CheckCircle2 },
            expiring: { label: 'Vencendo', className: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40', Icon: AlertTriangle },
            expired: { label: 'Vencido', className: 'bg-red-100 text-red-700 dark:bg-red-900/40', Icon: XCircle },
        }[status]
        return (
            <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium', config.className)}>
                <config.Icon className="w-3.5 h-3.5" />
                {config.label}
            </span>
        )
    }

    return (
        <div className="flex flex-col h-full">
            <div className="bg-card px-4 pt-3 pb-4 border-b border-border">
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => navigate('/tech')}
                        className="p-1.5 -ml-1.5 rounded-lg hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors"
                    >
                        <ArrowLeft className="w-5 h-5 text-surface-600" />
                    </button>
                    <h1 className="text-lg font-bold text-foreground">
                        Minhas Ferramentas
                    </h1>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
                <div className="flex gap-2 p-1 bg-surface-100 rounded-xl">
                    <button
                        onClick={() => setTab('tools')}
                        className={cn(
                            'flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition-colors',
                            tab === 'tools'
                                ? 'bg-card shadow-sm text-foreground'
                                : 'text-surface-600'
                        )}
                    >
                        <Wrench className="w-4 h-4" />
                        Ferramentas
                    </button>
                    <button
                        onClick={() => setTab('weights')}
                        className={cn(
                            'flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition-colors',
                            tab === 'weights'
                                ? 'bg-card shadow-sm text-foreground'
                                : 'text-surface-600'
                        )}
                    >
                        <Scale className="w-4 h-4" />
                        Pesos Padrão
                    </button>
                </div>

                {tab === 'tools' && (
                    <>
                        {loadingTools ? (
                            <div className="flex flex-col items-center justify-center py-12 gap-3">
                                <Loader2 className="w-8 h-8 animate-spin text-brand-500" />
                                <p className="text-sm text-surface-500">Carregando ferramentas...</p>
                            </div>
                        ) : toolsApiError ? (
                            <div className="bg-card rounded-xl p-6 text-center">
                                <Shield className="w-12 h-12 text-surface-400 mx-auto mb-2" />
                                <p className="text-sm text-surface-600">
                                    Funcionalidade em configuração
                                </p>
                                <p className="text-xs text-surface-500 mt-1">
                                    Entre em contato com o administrador para ativar o inventário de ferramentas.
                                </p>
                            </div>
                        ) : (
                            <>
                                <div className="grid grid-cols-3 gap-3">
                                    <div className="bg-card rounded-xl p-4">
                                        <p className="text-xs text-surface-500">Total</p>
                                        <p className="text-lg font-bold text-foreground">{totalTools}</p>
                                    </div>
                                    <div className="bg-card rounded-xl p-4">
                                        <p className="text-xs text-surface-500">Calibradas</p>
                                        <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400">{calibratedCount}</p>
                                    </div>
                                    <div className="bg-card rounded-xl p-4">
                                        <p className="text-xs text-surface-500">Vencidas</p>
                                        <p className="text-lg font-bold text-red-600 dark:text-red-400">{expiredCount}</p>
                                    </div>
                                </div>

                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400" />
                                    <input
                                        type="text"
                                        placeholder="Buscar ferramenta..."
                                        value={search}
                                        onChange={(e) => setSearch(e.target.value)}
                                        className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-card border-0 text-sm focus:ring-2 focus:ring-brand-500/30 focus:outline-none"
                                    />
                                </div>

                                {filteredTools.length === 0 ? (
                                    <div className="bg-card rounded-xl p-8 text-center">
                                        <Package className="w-12 h-12 text-surface-300 mx-auto mb-2" />
                                        <p className="text-sm text-surface-600">
                                            Nenhuma ferramenta atribuída
                                        </p>
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        {filteredTools.map((tool) => (
                                            <div
                                                key={tool.id}
                                                className="bg-card rounded-xl p-4"
                                            >
                                                <div className="flex items-start justify-between gap-2">
                                                    <div className="flex-1 min-w-0">
                                                        <p className="font-medium text-foreground truncate">
                                                            {tool.tool_name}
                                                        </p>
                                                        <p className="text-xs text-surface-500 flex items-center gap-1 mt-0.5">
                                                            {tool.tool_type && <span>{tool.tool_type}</span>}
                                                            {tool.serial_number && (
                                                                <span>• S/N: {tool.serial_number}</span>
                                                            )}
                                                        </p>
                                                    </div>
                                                    <StatusBadge status={tool.status ?? 'valid'} />
                                                </div>
                                                <div className="flex items-center gap-4 mt-2 text-xs text-surface-500">
                                                    <span className="flex items-center gap-1">
                                                        <Calendar className="w-3.5 h-3.5" />
                                                        Última: {formatDate(tool.last_calibration_date)}
                                                    </span>
                                                    <span>Próxima: {formatDate(tool.next_due_date)}</span>
                                                </div>
                                                <button
                                                    onClick={handleRequestReplacement}
                                                    className="mt-3 w-full py-2 rounded-lg border border-surface-200 text-sm font-medium text-surface-700 hover:bg-surface-50 dark:hover:bg-surface-700 transition-colors"
                                                >
                                                    Solicitar Substituição
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </>
                        )}
                    </>
                )}

                {tab === 'weights' && (
                    <>
                        {loadingWeights ? (
                            <div className="flex flex-col items-center justify-center py-12 gap-3">
                                <Loader2 className="w-8 h-8 animate-spin text-brand-500" />
                                <p className="text-sm text-surface-500">Carregando pesos padrão...</p>
                            </div>
                        ) : weightsApiError ? (
                            <div className="bg-card rounded-xl p-6 text-center">
                                <Shield className="w-12 h-12 text-surface-400 mx-auto mb-2" />
                                <p className="text-sm text-surface-600">
                                    Funcionalidade em configuração
                                </p>
                            </div>
                        ) : weights.length === 0 ? (
                            <div className="bg-card rounded-xl p-8 text-center">
                                <Scale className="w-12 h-12 text-surface-300 mx-auto mb-2" />
                                <p className="text-sm text-surface-600">
                                    Nenhum peso padrão atribuído
                                </p>
                            </div>
                        ) : (
                            <>
                                <button
                                    onClick={handleScanWeight}
                                    disabled={scanning}
                                    className="w-full flex items-center justify-center gap-2 py-3 bg-brand-600 text-white rounded-xl font-medium disabled:opacity-50"
                                >
                                    {scanning ? (
                                        <Loader2 className="w-5 h-5 animate-spin" />
                                    ) : (
                                        <QrCode className="w-5 h-5" />
                                    )}
                                    Verificar peso por QR Code
                                </button>
                                <div className="space-y-3">
                                    {weights.map((w) => (
                                        <div
                                            key={w.id}
                                            className="bg-card rounded-xl p-4"
                                        >
                                            <div className="flex items-start justify-between gap-2">
                                                <p className="font-medium text-foreground">
                                                    {w.value} {w.unit ?? 'kg'}
                                                </p>
                                                <StatusBadge status={w.status ?? 'valid'} />
                                            </div>
                                            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-surface-500">
                                                {w.serial_number && <span>S/N: {w.serial_number}</span>}
                                                {w.class && <span>Classe: {w.class}</span>}
                                                <span className="flex items-center gap-1">
                                                    <Calendar className="w-3.5 h-3.5" />
                                                    Validade: {formatDate(w.validity_date)}
                                                </span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </>
                        )}
                    </>
                )}
            </div>
        </div>
    )
}
