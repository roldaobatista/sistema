import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
    Scale, Plus, Trash2, CheckCircle2, XCircle, Save, ChevronDown, ChevronUp,
    Loader2, ArrowLeft, Gauge, FlaskConical,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import api from '@/lib/api'
import { toast } from 'sonner'

interface Equipment {
    id: number
    code?: string
    name?: string
    serial_number?: string
    brand?: string
    model?: string
}

interface ReadingRow {
    nominal: number | ''
    indication: number | ''
    unit: string
}

interface ExcentricityPositions {
    center: number | ''
    front: number | ''
    back: number | ''
    left: number | ''
    right: number | ''
}

const DEFAULT_TOLERANCE = 0.5

export default function TechCalibrationReadingsPage() {
    const { id } = useParams<{ id: string }>()
    const navigate = useNavigate()
    const [equipments, setEquipments] = useState<Equipment[]>([])
    const [selectedEquipment, setSelectedEquipment] = useState<Equipment | null>(null)
    const [calibrationId, setCalibrationId] = useState<number | null>(null)
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [readings, setReadings] = useState<ReadingRow[]>([
        { nominal: '', indication: '', unit: 'kg' },
    ])
    const [tolerance, setTolerance] = useState(DEFAULT_TOLERANCE)
    const [excentricityExpanded, setExcentricityExpanded] = useState(false)
    const [excentricityLoad, setExcentricityLoad] = useState<number | ''>('')
    const [excentricity, setExcentricity] = useState<ExcentricityPositions>({
        center: '', front: '', back: '', left: '', right: '',
    })

    const equipmentList = equipments.length > 0
        ? equipments
        : selectedEquipment
            ? [selectedEquipment]
            : []

    useEffect(() => {
        if (!id) return
        async function fetchWorkOrder() {
            try {
                setLoading(true)
                setError(null)
                const { data } = await api.get(`/work-orders/${id}`)
                const wo = data.data || data
                const list: Equipment[] = []
                if (wo.equipment?.id) list.push(wo.equipment)
                if (wo.equipmentsList?.length) {
                    wo.equipmentsList.forEach((e: any) => {
                        const eq = e.equipment || e
                        if (eq?.id && !list.some((x) => x.id === eq.id)) list.push(eq)
                    })
                }
                if (list.length > 0) setEquipments(list)
                else setError('Nenhum equipamento vinculado a esta OS')
            } catch (err: any) {
                setError(err?.response?.data?.message || 'Erro ao carregar OS')
                toast.error('Erro ao carregar dados da OS')
            } finally {
                setLoading(false)
            }
        }
        fetchWorkOrder()
    }, [id])

    const ensureCalibration = async (equipmentId: number): Promise<number | null> => {
        try {
            const { data } = await api.get(`/equipments/${equipmentId}/calibrations`)
            const calibs = data.calibrations || []
            const forWo = calibs.find((c: any) => c.work_order_id === Number(id))
            const latest = forWo || calibs[0]
            if (latest) return latest.id
            const today = new Date().toISOString().slice(0, 10)
            const { data: created } = await api.post(`/equipments/${equipmentId}/calibrations`, {
                calibration_date: today,
                calibration_type: 'interna',
                result: 'aprovado_com_ressalva',
                work_order_id: Number(id),
            })
            return created?.calibration?.id ?? null
        } catch {
            toast.error('Erro ao obter/criar calibração')
            return null
        }
    }

    const handleSelectEquipment = async (eq: Equipment) => {
        setSelectedEquipment(eq)
        const calId = await ensureCalibration(eq.id)
        setCalibrationId(calId)
        setReadings([{ nominal: '', indication: '', unit: 'kg' }])
        setExcentricityLoad('')
        setExcentricity({ center: '', front: '', back: '', left: '', right: '' })
    }

    const addReading = () => {
        setReadings((prev) => [...prev, { nominal: '', indication: '', unit: 'kg' }])
    }

    const removeReading = (index: number) => {
        if (readings.length <= 1) return
        setReadings((prev) => prev.filter((_, i) => i !== index))
    }

    const updateReading = (index: number, field: keyof ReadingRow, value: number | string) => {
        setReadings((prev) =>
            prev.map((r, i) => (i === index ? { ...r, [field]: value } : r))
        )
    }

    const updateExcentricity = (pos: keyof ExcentricityPositions, value: number | '') => {
        setExcentricity((prev) => ({ ...prev, [pos]: value }))
    }

    const calcError = (nominal: number | '', indication: number | '') => {
        if (nominal === '' || indication === '') return null
        const n = Number(nominal)
        const i = Number(indication)
        if (Number.isNaN(n) || Number.isNaN(i)) return null
        return i - n
    }

    const calcMaxExcentricityDiff = () => {
        const vals = [
            excentricity.center,
            excentricity.front,
            excentricity.back,
            excentricity.left,
            excentricity.right,
        ].filter((v) => v !== '') as number[]
        if (vals.length < 2) return null
        const nums = vals.map(Number).filter((n) => !Number.isNaN(n))
        if (nums.length < 2) return null
        return Math.max(...nums) - Math.min(...nums)
    }

    const maxReadingError = readings.reduce((max, r) => {
        const err = calcError(r.nominal, r.indication)
        if (err === null) return max
        return Math.max(max, Math.abs(err))
    }, 0)

    const maxExcentricity = calcMaxExcentricityDiff()
    const passed = maxReadingError <= tolerance && (maxExcentricity === null || maxExcentricity <= tolerance)

    const handleSave = async () => {
        if (!calibrationId || !selectedEquipment) return
        const validReadings = readings.filter((r) => r.nominal !== '' && r.indication !== '')
        if (validReadings.length === 0) {
            toast.error('Adicione pelo menos uma leitura')
            return
        }

        setSaving(true)
        try {
            await api.post(`/calibration/${calibrationId}/readings`, {
                readings: validReadings.map((r) => ({
                    reference_value: Number(r.nominal),
                    indication_increasing: Number(r.indication),
                    indication_decreasing: null,
                    k_factor: 2.0,
                    repetition: 1,
                    unit: r.unit,
                })),
            })

            const hasExcentricity = Object.values(excentricity).some((v) => v !== '')
            if (hasExcentricity && excentricityLoad !== '') {
                const load = Number(excentricityLoad)
                const positions = [
                    { key: 'center' as const },
                    { key: 'front' as const },
                    { key: 'back' as const },
                    { key: 'left' as const },
                    { key: 'right' as const },
                ]
                await api.post(`/calibration/${calibrationId}/excentricity`, {
                    tests: positions
                        .filter((p) => excentricity[p.key] !== '')
                        .map((p) => ({
                            position: p.key,
                            load_applied: load,
                            indication: Number(excentricity[p.key]),
                        })),
                })
            }

            toast.success('Leituras salvas com sucesso')
        } catch (err: any) {
            toast.error(err?.response?.data?.message || 'Erro ao salvar leituras')
        } finally {
            setSaving(false)
        }
    }

    const inputClass =
        'w-full px-3 py-2.5 rounded-lg bg-surface-100 dark:bg-surface-700 border-0 text-sm focus:ring-2 focus:ring-brand-500/30 focus:outline-none'

    return (
        <div className="flex flex-col h-full">
            <div className="bg-white dark:bg-surface-900 px-4 pt-3 pb-4 border-b border-surface-200 dark:border-surface-700">
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => navigate(`/tech/os/${id}`)}
                        className="p-1.5 -ml-1.5 rounded-lg hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors"
                    >
                        <ArrowLeft className="w-5 h-5 text-surface-600 dark:text-surface-400" />
                    </button>
                    <h1 className="text-lg font-bold text-surface-900 dark:text-surface-50">
                        Leituras de Calibração
                    </h1>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
                {loading ? (
                    <div className="flex flex-col items-center justify-center py-20 gap-3">
                        <Loader2 className="w-8 h-8 animate-spin text-brand-500" />
                        <p className="text-sm text-surface-500">Carregando equipamentos...</p>
                    </div>
                ) : error ? (
                    <div className="bg-white dark:bg-surface-800/80 rounded-xl p-4">
                        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
                    </div>
                ) : (
                    <>
                        <div>
                            <h2 className="text-sm font-medium text-surface-700 dark:text-surface-300 mb-2 flex items-center gap-2">
                                <Gauge className="w-4 h-4" />
                                Selecione o equipamento
                            </h2>
                            <div className="grid gap-2">
                                {equipmentList.map((eq) => (
                                    <button
                                        key={eq.id}
                                        onClick={() => handleSelectEquipment(eq)}
                                        className={cn(
                                            'bg-white dark:bg-surface-800/80 rounded-xl p-4 text-left transition-colors',
                                            selectedEquipment?.id === eq.id
                                                ? 'ring-2 ring-brand-500'
                                                : 'hover:bg-surface-50 dark:hover:bg-surface-700/80'
                                        )}
                                    >
                                        <div className="flex items-center gap-2">
                                            <Scale className="w-5 h-5 text-brand-500" />
                                            <div>
                                                <p className="font-medium text-surface-900 dark:text-surface-50">
                                                    {eq.code || eq.name || `Equipamento #${eq.id}`}
                                                </p>
                                                {(eq.serial_number || eq.model) && (
                                                    <p className="text-xs text-surface-500">
                                                        {[eq.serial_number, eq.model].filter(Boolean).join(' • ')}
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {selectedEquipment && calibrationId && (
                            <>
                                <div className="bg-white dark:bg-surface-800/80 rounded-xl p-4">
                                    <div className="flex items-center justify-between mb-3">
                                        <h3 className="text-sm font-medium text-surface-700 dark:text-surface-300 flex items-center gap-2">
                                            <FlaskConical className="w-4 h-4" />
                                            Pontos de leitura
                                        </h3>
                                        <button
                                            onClick={addReading}
                                            className="flex items-center gap-1 text-sm text-brand-600 dark:text-brand-400"
                                        >
                                            <Plus className="w-4 h-4" /> Adicionar Leitura
                                        </button>
                                    </div>
                                    <div className="space-y-3">
                                        {readings.map((r, i) => {
                                            const err = calcError(r.nominal, r.indication)
                                            return (
                                                <div
                                                    key={i}
                                                    className="flex flex-wrap items-end gap-2 p-3 rounded-lg bg-surface-50 dark:bg-surface-700/50"
                                                >
                                                    <div className="flex-1 min-w-[80px]">
                                                        <label className="text-xs text-surface-500 block mb-1">
                                                            Nominal
                                                        </label>
                                                        <input
                                                            type="number"
                                                            step="0.0001"
                                                            value={r.nominal}
                                                            onChange={(e) =>
                                                                updateReading(
                                                                    i,
                                                                    'nominal',
                                                                    e.target.value === ''
                                                                        ? ''
                                                                        : parseFloat(e.target.value)
                                                                )
                                                            }
                                                            className={inputClass}
                                                            placeholder="0"
                                                        />
                                                    </div>
                                                    <div className="flex-1 min-w-[80px]">
                                                        <label className="text-xs text-surface-500 block mb-1">
                                                            Indicação
                                                        </label>
                                                        <input
                                                            type="number"
                                                            step="0.0001"
                                                            value={r.indication}
                                                            onChange={(e) =>
                                                                updateReading(
                                                                    i,
                                                                    'indication',
                                                                    e.target.value === ''
                                                                        ? ''
                                                                        : parseFloat(e.target.value)
                                                                )
                                                            }
                                                            className={inputClass}
                                                            placeholder="0"
                                                        />
                                                    </div>
                                                    <div className="w-12">
                                                        <label className="text-xs text-surface-500 block mb-1">
                                                            Erro
                                                        </label>
                                                        <p className="text-sm font-mono text-surface-700 dark:text-surface-300 py-2">
                                                            {err !== null ? err.toFixed(4) : '—'}
                                                        </p>
                                                    </div>
                                                    <div className="w-14">
                                                        <label className="text-xs text-surface-500 block mb-1">
                                                            Unid.
                                                        </label>
                                                        <input
                                                            type="text"
                                                            value={r.unit}
                                                            onChange={(e) =>
                                                                updateReading(i, 'unit', e.target.value)
                                                            }
                                                            className={inputClass}
                                                        />
                                                    </div>
                                                    <button
                                                        onClick={() => removeReading(i)}
                                                        disabled={readings.length <= 1}
                                                        className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg disabled:opacity-40"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            )
                                        })}
                                    </div>
                                </div>

                                <div className="bg-white dark:bg-surface-800/80 rounded-xl p-4">
                                    <button
                                        onClick={() => setExcentricityExpanded((x) => !x)}
                                        className="w-full flex items-center justify-between text-left"
                                    >
                                        <span className="text-sm font-medium text-surface-700 dark:text-surface-300">
                                            Ensaio de Excentricidade
                                        </span>
                                        {excentricityExpanded ? (
                                            <ChevronUp className="w-5 h-5 text-surface-400" />
                                        ) : (
                                            <ChevronDown className="w-5 h-5 text-surface-400" />
                                        )}
                                    </button>
                                    {excentricityExpanded && (
                                        <div className="mt-3 space-y-3">
                                            <div>
                                                <label className="text-xs text-surface-500 block mb-1">
                                                    Carga aplicada (kg)
                                                </label>
                                                <input
                                                    type="number"
                                                    step="0.01"
                                                    value={excentricityLoad}
                                                    onChange={(e) =>
                                                        setExcentricityLoad(
                                                            e.target.value === ''
                                                                ? ''
                                                                : parseFloat(e.target.value)
                                                        )
                                                    }
                                                    className={inputClass}
                                                    placeholder="0"
                                                />
                                            </div>
                                            <div className="grid grid-cols-2 gap-3">
                                                {[
                                                    { key: 'center' as const, label: 'Centro' },
                                                    { key: 'front' as const, label: 'Frente' },
                                                    { key: 'back' as const, label: 'Traseira' },
                                                    { key: 'left' as const, label: 'Esquerda' },
                                                    { key: 'right' as const, label: 'Direita' },
                                                ].map(({ key, label }) => (
                                                <div key={key}>
                                                    <label className="text-xs text-surface-500 block mb-1">
                                                        {label}
                                                    </label>
                                                    <input
                                                        type="number"
                                                        step="0.01"
                                                        value={excentricity[key]}
                                                        onChange={(e) =>
                                                            updateExcentricity(
                                                                key,
                                                                e.target.value === ''
                                                                    ? ''
                                                                    : parseFloat(e.target.value)
                                                            )
                                                        }
                                                        className={inputClass}
                                                        placeholder="0"
                                                    />
                                                </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                    {maxExcentricity !== null && (
                                        <p className="mt-2 text-xs text-surface-500">
                                            Diferença máxima: {maxExcentricity.toFixed(4)}
                                        </p>
                                    )}
                                </div>

                                <div className="flex gap-2">
                                    <label className="text-sm text-surface-600 dark:text-surface-400">
                                        Tolerância:
                                    </label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        value={tolerance}
                                        onChange={(e) => setTolerance(parseFloat(e.target.value) || 0)}
                                        className={cn(inputClass, 'w-20')}
                                    />
                                </div>

                                <div
                                    className={cn(
                                        'rounded-xl p-4 flex items-center gap-3',
                                        passed
                                            ? 'bg-emerald-50 dark:bg-emerald-900/20'
                                            : 'bg-red-50 dark:bg-red-900/20'
                                    )}
                                >
                                    {passed ? (
                                        <>
                                            <CheckCircle2 className="w-8 h-8 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
                                            <div>
                                                <p className="font-medium text-emerald-800 dark:text-emerald-300">
                                                    APROVADO
                                                </p>
                                                <p className="text-sm text-emerald-600 dark:text-emerald-400">
                                                    Dentro da tolerância
                                                </p>
                                            </div>
                                        </>
                                    ) : (
                                        <>
                                            <XCircle className="w-8 h-8 text-red-600 dark:text-red-400 flex-shrink-0" />
                                            <div>
                                                <p className="font-medium text-red-800 dark:text-red-300">
                                                    REPROVADO
                                                </p>
                                                <p className="text-sm text-red-600 dark:text-red-400">
                                                    Erro acima da tolerância
                                                </p>
                                            </div>
                                        </>
                                    )}
                                </div>

                                <button
                                    onClick={handleSave}
                                    disabled={saving}
                                    className="w-full flex items-center justify-center gap-2 py-3 bg-brand-600 text-white rounded-xl font-medium disabled:opacity-50"
                                >
                                    {saving ? (
                                        <>
                                            <Loader2 className="w-5 h-5 animate-spin" />
                                            Salvando...
                                        </>
                                    ) : (
                                        <>
                                            <Save className="w-5 h-5" />
                                            Salvar Leituras
                                        </>
                                    )}
                                </button>
                            </>
                        )}
                    </>
                )}
            </div>
        </div>
    )
}
