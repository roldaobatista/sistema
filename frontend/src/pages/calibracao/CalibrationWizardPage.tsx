import { useState, useEffect, useCallback } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query'
import api from '@/lib/api'
import { PageHeader } from '@/components/ui/pageheader'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { toast } from 'sonner'
import {
    ArrowLeft, ArrowRight, Check, ChevronRight, Wand2, FileCheck,
    RefreshCw, Save, Sparkles, AlertTriangle, CheckCircle, XCircle,
    Thermometer, Droplets, Wind, Scale, Target, RotateCcw,
    Info, Plus, Trash2, ToggleLeft, ToggleRight, Printer, ClipboardCheck,
} from 'lucide-react'
import {
    useCalibrationCalculations,
    calculateReadingError,
    isConforming,
    calculateRepeatability,
} from '@/hooks/useCalibrationCalculations'
import {
    useCalibrationPrefill,
    useCalibrationSuggestedPoints,
    saveRepeatabilityTest,
    validateIso17025,
} from '@/hooks/useCalibrationPrefill'

// ─── Types ────────────────────────────────────────────────────────
interface WizardState {
    // Step 1: Equipment identification
    equipmentId: number | null
    calibrationId: number | null
    precisionClass: string
    eValue: string
    maxCapacity: string
    capacityUnit: string
    verificationType: 'initial' | 'subsequent' | 'in_use'

    // Step 2: Environmental conditions
    temperature: string
    humidity: string
    pressure: string
    calibrationLocation: string
    calibrationLocationType: 'laboratory' | 'field' | 'customer'
    calibrationMethod: string
    receivedDate: string
    issuedDate: string
    calibrationDate: string

    // Step 3: Standard weights
    standardUsed: string
    weightIds: number[]

    // Step 4: Measurement readings
    readings: ReadingRow[]

    // Step 5: Eccentricity test
    eccentricityTests: EccentricityRow[]

    // Step 6: Repeatability
    repeatabilityLoad: string
    repeatabilityMeasurements: string[]
}

interface ReadingRow {
    referenceValue: string
    indicationIncreasing: string
    indicationDecreasing: string
    kFactor: string
    unit: string
}

interface EccentricityRow {
    position: string
    loadApplied: string
    indication: string
}

const PRECISION_CLASSES = ['I', 'II', 'III', 'IIII']

const STEP_LABELS = [
    { key: 'identification', label: 'Equipamento', icon: Scale },
    { key: 'environment', label: 'Condições', icon: Thermometer },
    { key: 'standards', label: 'Padrões', icon: Target },
    { key: 'readings', label: 'Leituras', icon: ChevronRight },
    { key: 'eccentricity', label: 'Excentricidade', icon: RotateCcw },
    { key: 'repeatability', label: 'Repetibilidade', icon: RefreshCw },
]

function emptyState(): WizardState {
    return {
        equipmentId: null,
        calibrationId: null,
        precisionClass: 'III',
        eValue: '',
        maxCapacity: '',
        capacityUnit: 'kg',
        verificationType: 'initial',
        temperature: '',
        humidity: '',
        pressure: '',
        calibrationLocation: '',
        calibrationLocationType: 'laboratory',
        calibrationMethod: 'Comparação direta',
        receivedDate: '',
        issuedDate: '',
        calibrationDate: new Date().toISOString().split('T')[0],
        standardUsed: '',
        weightIds: [],
        readings: [emptyReading()],
        eccentricityTests: defaultEccentricityRows(),
        repeatabilityLoad: '',
        repeatabilityMeasurements: ['', '', '', '', '', '', '', '', '', ''],
    }
}

function emptyReading(): ReadingRow {
    return { referenceValue: '', indicationIncreasing: '', indicationDecreasing: '', kFactor: '2.00', unit: 'kg' }
}

function defaultEccentricityRows(): EccentricityRow[] {
    return ['Centro', 'Frente', 'Trás', 'Esquerda', 'Direita'].map((pos) => ({
        position: pos,
        loadApplied: '',
        indication: '',
    }))
}

// ─── CalibrationWizardPage ────────────────────────────────────────
export default function CalibrationWizardPage() {
    const navigate = useNavigate()
    const { equipmentId: paramEquipId, calibrationId: paramCalId } = useParams()
    const [searchParams] = useSearchParams()
    const qc = useQueryClient()

    const [step, setStep] = useState(0)
    const [state, setState] = useState<WizardState>(emptyState)
    const [isAdvancedMode, setIsAdvancedMode] = useState(false)
    const [validationResult, setValidationResult] = useState<any>(null)
    const [isPrefillApplied, setIsPrefillApplied] = useState(false)

    // Resolve equipment
    const equipmentIdNum = paramEquipId ? parseInt(paramEquipId) : null

    const { data: equipment } = useQuery({
        queryKey: ['equipment-detail', equipmentIdNum],
        queryFn: () => api.get(`/equipment/${equipmentIdNum}`).then((r) => r.data?.data ?? r.data),
        enabled: !!equipmentIdNum,
    })

    // Pre-fill from previous calibration
    const { data: prefillResponse, isLoading: isPrefillLoading } = useCalibrationPrefill(equipmentIdNum)
    const { data: suggestedPoints } = useCalibrationSuggestedPoints(equipmentIdNum)

    // Calculations hook
    const calculations = useCalibrationCalculations({
        precisionClass: state.precisionClass,
        eValue: parseFloat(state.eValue) || 0,
        maxCapacity: parseFloat(state.maxCapacity) || 0,
        verificationType: state.verificationType,
    })

    // Initialize state from equipment
    useEffect(() => {
        if (!equipment) return
        setState((prev) => ({
            ...prev,
            equipmentId: equipment.id,
            calibrationId: paramCalId ? parseInt(paramCalId) : null,
            precisionClass: equipment.precision_class || 'III',
            eValue: String(equipment.resolution ?? ''),
            maxCapacity: String(equipment.capacity ?? ''),
            capacityUnit: equipment.capacity_unit || 'kg',
        }))
    }, [equipment, paramCalId])

    // Apply prefill when available
    const applyPrefill = useCallback(() => {
        if (!prefillResponse?.prefilled || !prefillResponse.data) return
        const d = prefillResponse.data
        setState((prev) => ({
            ...prev,
            temperature: d.temperature != null ? String(d.temperature) : prev.temperature,
            humidity: d.humidity != null ? String(d.humidity) : prev.humidity,
            pressure: d.pressure != null ? String(d.pressure) : prev.pressure,
            calibrationLocation: d.calibration_location ?? prev.calibrationLocation,
            calibrationLocationType: (d.calibration_location_type as any) ?? prev.calibrationLocationType,
            calibrationMethod: d.calibration_method ?? prev.calibrationMethod,
            standardUsed: d.standard_used ?? prev.standardUsed,
            verificationType: (d.verification_type as any) ?? prev.verificationType,
            eValue: d.verification_division_e != null ? String(d.verification_division_e) : prev.eValue,
            weightIds: d.weight_ids ?? prev.weightIds,
            readings: d.reading_structure?.length
                ? d.reading_structure.map((r) => ({
                    referenceValue: String(r.reference_value),
                    indicationIncreasing: '',
                    indicationDecreasing: '',
                    kFactor: '2.00',
                    unit: r.unit || 'kg',
                }))
                : prev.readings,
        }))
        setIsPrefillApplied(true)
        toast.success(
            `Dados pré-preenchidos da calibração anterior (Cert. ${d.previous_certificate || d.previous_id})`
        )
    }, [prefillResponse])

    // Apply suggested points
    const applySuggestedPoints = useCallback(() => {
        if (!suggestedPoints?.points?.length) return
        setState((prev) => ({
            ...prev,
            readings: suggestedPoints.points.map((p) => ({
                referenceValue: String(p.load),
                indicationIncreasing: '',
                indicationDecreasing: '',
                kFactor: '2.00',
                unit: prev.capacityUnit,
            })),
            eccentricityTests: prev.eccentricityTests.map((t) => ({
                ...t,
                loadApplied: String(suggestedPoints.eccentricity_load),
            })),
            repeatabilityLoad: String(suggestedPoints.repeatability_load),
        }))
        toast.info('Pontos de medição sugeridos aplicados')
    }, [suggestedPoints])

    // ─── Mutations ──────────────────────────────────────────
    const saveReadingsMutation = useMutation({
        mutationFn: (data: { readings: any[] }) =>
            api.post(`/calibration/${state.calibrationId}/readings`, data).then((r) => r.data),
        onSuccess: () => {
            toast.success('Leituras salvas')
            qc.invalidateQueries({ queryKey: ['calibration-readings'] })
        },
        onError: () => toast.error('Erro ao salvar leituras'),
    })

    const saveEccentricityMutation = useMutation({
        mutationFn: (data: { tests: any[] }) =>
            api.post(`/calibration/${state.calibrationId}/excentricity`, data).then((r) => r.data),
        onSuccess: () => {
            toast.success('Ensaio de excentricidade salvo')
            qc.invalidateQueries({ queryKey: ['calibration-eccentricity'] })
        },
        onError: () => toast.error('Erro ao salvar excentricidade'),
    })

    const generateCertMutation = useMutation({
        mutationFn: () =>
            api.post(`/calibration/${state.calibrationId}/generate-certificate`).then((r) => r.data),
        onSuccess: (data) => {
            toast.success(`Certificado ${data.certificate_number} gerado!`)
            qc.invalidateQueries({ queryKey: ['calibrations'] })
            navigate(`/calibracoes/${state.calibrationId}`)
        },
        onError: (err: any) => toast.error(err.response?.data?.message || 'Erro ao gerar certificado'),
    })

    // ─── Step Navigation ──────────────────────────────────────
    const canNext = step < STEP_LABELS.length - 1
    const canPrev = step > 0

    const goNext = useCallback(() => {
        // Save current step data before advancing
        if (step === 3 && state.calibrationId) {
            const validReadings = state.readings.filter((r) => r.referenceValue)
            if (validReadings.length) {
                saveReadingsMutation.mutate({ readings: validReadings })
            }
        }
        if (step === 4 && state.calibrationId) {
            const validTests = state.eccentricityTests.filter((t) => t.loadApplied && t.indication)
            if (validTests.length) {
                saveEccentricityMutation.mutate({
                    tests: validTests.map((t) => ({
                        position: t.position,
                        load_applied: parseFloat(t.loadApplied),
                        indication: parseFloat(t.indication),
                    })),
                })
            }
        }
        if (canNext) setStep((s) => s + 1)
    }, [step, canNext, state, saveReadingsMutation, saveEccentricityMutation])

    const goPrev = useCallback(() => {
        if (canPrev) setStep((s) => s - 1)
    }, [canPrev])

    // Final step: validate + generate
    const handleFinish = useCallback(async () => {
        if (!state.calibrationId) {
            toast.error('Nenhuma calibração selecionada')
            return
        }

        // Save repeatability
        const validMeasurements = state.repeatabilityMeasurements
            .map((v) => parseFloat(v))
            .filter((v) => !isNaN(v))
        if (validMeasurements.length >= 2) {
            try {
                await saveRepeatabilityTest(
                    state.calibrationId,
                    parseFloat(state.repeatabilityLoad) || 0,
                    validMeasurements,
                    state.capacityUnit
                )
            } catch {
                toast.error('Erro ao salvar repetibilidade')
            }
        }

        // Validate ISO 17025
        try {
            const result = await validateIso17025(state.calibrationId)
            setValidationResult(result)
            if (!result.complete) {
                toast.warning(`Certificado incompleto: ${result.missing_fields.length} campos faltando`)
                return
            }
        } catch {
            // Continue even if validation fails
        }

        generateCertMutation.mutate()
    }, [state, generateCertMutation])

    // Save draft without generating certificate
    const handleSaveDraft = useCallback(async () => {
        if (!state.calibrationId) {
            toast.error('Nenhuma calibração selecionada')
            return
        }
        const validReadings = state.readings.filter((r) => r.referenceValue)
        if (validReadings.length) {
            saveReadingsMutation.mutate({ readings: validReadings })
        }
        const validTests = state.eccentricityTests.filter((t) => t.loadApplied && t.indication)
        if (validTests.length) {
            saveEccentricityMutation.mutate({
                tests: validTests.map((t) => ({
                    position: t.position,
                    load_applied: parseFloat(t.loadApplied),
                    indication: parseFloat(t.indication),
                })),
            })
        }
        const validMeasurements = state.repeatabilityMeasurements.map((v) => parseFloat(v)).filter((v) => !isNaN(v))
        if (validMeasurements.length >= 2) {
            try {
                await saveRepeatabilityTest(
                    state.calibrationId,
                    parseFloat(state.repeatabilityLoad) || 0,
                    validMeasurements,
                    state.capacityUnit
                )
            } catch { /* silent */ }
        }
        toast.success('Rascunho salvo com sucesso')
    }, [state, saveReadingsMutation, saveEccentricityMutation])

    // Generate and print
    const handleGenerateAndPrint = useCallback(async () => {
        await handleFinish()
        // The print will be triggered by navigation to the certificate page
    }, [handleFinish])

    // ─── Render ──────────────────────────────────────────
    const update = (field: keyof WizardState, value: any) =>
        setState((prev) => ({ ...prev, [field]: value }))

    const updateReading = (index: number, field: keyof ReadingRow, value: string) =>
        setState((prev) => ({
            ...prev,
            readings: prev.readings.map((r, i) => (i === index ? { ...r, [field]: value } : r)),
        }))

    const updateEccentricity = (index: number, field: keyof EccentricityRow, value: string) =>
        setState((prev) => ({
            ...prev,
            eccentricityTests: prev.eccentricityTests.map((t, i) =>
                i === index ? { ...t, [field]: value } : t
            ),
        }))

    const updateRepMeasurement = (index: number, value: string) =>
        setState((prev) => ({
            ...prev,
            repeatabilityMeasurements: prev.repeatabilityMeasurements.map((m, i) =>
                i === index ? value : m
            ),
        }))

    // ─── Step Content Components ──────────────────────────
    const renderStep1 = () => (
        <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {equipment && (
                    <Card className="col-span-full bg-muted/30">
                        <CardContent className="pt-4">
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                                <div>
                                    <span className="text-muted-foreground">Marca:</span>
                                    <p className="font-medium">{equipment.brand || '—'}</p>
                                </div>
                                <div>
                                    <span className="text-muted-foreground">Modelo:</span>
                                    <p className="font-medium">{equipment.model || '—'}</p>
                                </div>
                                <div>
                                    <span className="text-muted-foreground">Nº Série:</span>
                                    <p className="font-medium">{equipment.serial_number || '—'}</p>
                                </div>
                                <div>
                                    <span className="text-muted-foreground">Código:</span>
                                    <p className="font-medium">{equipment.code || '—'}</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                )}

                <div className="space-y-2">
                    <Label htmlFor="precisionClass">Classe de Exatidão</Label>
                    <select
                        id="precisionClass"
                        value={state.precisionClass}
                        onChange={(e) => update('precisionClass', e.target.value)}
                        className="w-full border rounded-md px-3 py-2 text-sm bg-background"
                        aria-label="Classe de Exatidão"
                    >
                        {PRECISION_CLASSES.map((c) => (
                            <option key={c} value={c}>
                                Classe {c}
                            </option>
                        ))}
                    </select>
                </div>

                <div className="space-y-2">
                    <Label htmlFor="eValue">Divisão de Verificação (e)</Label>
                    <Input
                        id="eValue"
                        type="number"
                        step="0.0001"
                        value={state.eValue}
                        onChange={(e) => update('eValue', e.target.value)}
                        placeholder="Ex: 0.001"
                    />
                </div>

                <div className="space-y-2">
                    <Label htmlFor="maxCapacity">Capacidade Máxima (Max)</Label>
                    <div className="flex gap-2">
                        <Input
                            id="maxCapacity"
                            type="number"
                            step="0.01"
                            value={state.maxCapacity}
                            onChange={(e) => update('maxCapacity', e.target.value)}
                            placeholder="Ex: 150"
                            className="flex-1"
                        />
                        <select
                            value={state.capacityUnit}
                            onChange={(e) => update('capacityUnit', e.target.value)}
                            className="border rounded-md px-3 py-2 text-sm bg-background w-20"
                            aria-label="Unidade de capacidade"
                        >
                            <option value="kg">kg</option>
                            <option value="g">g</option>
                            <option value="mg">mg</option>
                            <option value="t">t</option>
                        </select>
                    </div>
                </div>

                <div className="space-y-2">
                    <Label htmlFor="verificationType">Tipo de Verificação</Label>
                    <select
                        id="verificationType"
                        value={state.verificationType}
                        onChange={(e) => update('verificationType', e.target.value as any)}
                        className="w-full border rounded-md px-3 py-2 text-sm bg-background"
                        aria-label="Tipo de Verificação"
                    >
                        <option value="initial">Verificação Inicial</option>
                        <option value="subsequent">Verificação Subsequente</option>
                        <option value="in_use">Verificação em Uso (Fiscalização)</option>
                    </select>
                </div>
            </div>

            {/* Prefill Banner */}
            {prefillResponse?.prefilled && (
                <Card className="border-blue-200 bg-blue-50 dark:bg-blue-950/20 dark:border-blue-800">
                    <CardContent className="pt-4 flex items-center gap-3">
                        <Sparkles className="h-5 w-5 text-blue-600 shrink-0" />
                        <div className="flex-1">
                            <p className="font-medium text-blue-800 dark:text-blue-300">
                                Calibração anterior encontrada!
                            </p>
                            <p className="text-sm text-blue-600 dark:text-blue-400">
                                Use os dados da última calibração para pré-preencher ~90% do certificado.
                            </p>
                        </div>
                        <Button size="sm" onClick={applyPrefill} disabled={isPrefillLoading}>
                            <Wand2 className="h-4 w-4 mr-1" /> Aplicar Memória
                        </Button>
                    </CardContent>
                </Card>
            )}
        </div>
    )

    const renderStep2 = () => (
        <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                    <Label htmlFor="temperature" className="flex items-center gap-2">
                        <Thermometer className="h-4 w-4 text-orange-500" /> Temperatura (°C)
                    </Label>
                    <Input
                        id="temperature"
                        type="number"
                        step="0.1"
                        value={state.temperature}
                        onChange={(e) => update('temperature', e.target.value)}
                        placeholder="23.0"
                    />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="humidity" className="flex items-center gap-2">
                        <Droplets className="h-4 w-4 text-blue-500" /> Umidade (%RH)
                    </Label>
                    <Input
                        id="humidity"
                        type="number"
                        step="0.1"
                        value={state.humidity}
                        onChange={(e) => update('humidity', e.target.value)}
                        placeholder="50.0"
                    />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="pressure" className="flex items-center gap-2">
                        <Wind className="h-4 w-4 text-gray-500" /> Pressão (hPa)
                    </Label>
                    <Input
                        id="pressure"
                        type="number"
                        step="0.1"
                        value={state.pressure}
                        onChange={(e) => update('pressure', e.target.value)}
                        placeholder="1013.25"
                    />
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label htmlFor="calibrationLocation">Local da Calibração</Label>
                    <Input
                        id="calibrationLocation"
                        value={state.calibrationLocation}
                        onChange={(e) => update('calibrationLocation', e.target.value)}
                        placeholder="Endereço ou nome do laboratório"
                    />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="locationType">Tipo de Local</Label>
                    <select
                        id="locationType"
                        value={state.calibrationLocationType}
                        onChange={(e) => update('calibrationLocationType', e.target.value)}
                        className="w-full border rounded-md px-3 py-2 text-sm bg-background"
                        aria-label="Tipo de Local"
                    >
                        <option value="laboratory">Laboratório</option>
                        <option value="field">Campo</option>
                        <option value="customer">Nas dependências do cliente</option>
                    </select>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                    <Label htmlFor="calibrationDate">Data da Calibração</Label>
                    <Input
                        id="calibrationDate"
                        type="date"
                        value={state.calibrationDate}
                        onChange={(e) => update('calibrationDate', e.target.value)}
                    />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="receivedDate">Data de Recebimento</Label>
                    <Input
                        id="receivedDate"
                        type="date"
                        value={state.receivedDate}
                        onChange={(e) => update('receivedDate', e.target.value)}
                    />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="issuedDate">Data de Emissão</Label>
                    <Input
                        id="issuedDate"
                        type="date"
                        value={state.issuedDate}
                        onChange={(e) => update('issuedDate', e.target.value)}
                    />
                </div>
            </div>

            <div className="space-y-2">
                <Label htmlFor="calibrationMethod">Método de Calibração</Label>
                <Input
                    id="calibrationMethod"
                    value={state.calibrationMethod}
                    onChange={(e) => update('calibrationMethod', e.target.value)}
                    placeholder="Comparação direta"
                />
            </div>
        </div>
    )

    const renderStep3 = () => (
        <div className="space-y-6">
            <div className="space-y-2">
                <Label htmlFor="standardUsed">Padrão(ões) Utilizado(s)</Label>
                <textarea
                    id="standardUsed"
                    className="w-full min-h-[80px] border rounded-md px-3 py-2 text-sm bg-background resize-y"
                    value={state.standardUsed}
                    onChange={(e) => update('standardUsed', e.target.value)}
                    placeholder="Descreva os padrões/pesos utilizados, certificados de referência, etc."
                />
            </div>

            <Card className="bg-muted/20">
                <CardContent className="pt-4">
                    <div className="flex items-start gap-2">
                        <Info className="h-5 w-5 text-blue-500 shrink-0 mt-0.5" />
                        <div className="text-sm text-muted-foreground">
                            <p className="font-medium text-foreground mb-1">ISO 17025 — Rastreabilidade</p>
                            <p>
                                Identifique os pesos padrão ou massas utilizados com seus certificados de calibração.
                                Inclua: nº certificado, laboratório, data de validade, incerteza expandida (U) e
                                fator de abrangência (k).
                            </p>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    )

    const renderStep4 = () => {
        const eVal = parseFloat(state.eValue) || 0
        return (
            <div className="space-y-4">
                <div className="flex items-center gap-2 justify-between flex-wrap">
                    <div className="flex gap-2">
                        <Button size="sm" variant="outline" onClick={applySuggestedPoints} disabled={!suggestedPoints}>
                            <Wand2 className="h-4 w-4 mr-1" /> Sugerir Pontos
                        </Button>
                        <Button
                            size="sm"
                            variant="outline"
                            onClick={() =>
                                setState((prev) => ({ ...prev, readings: [...prev.readings, emptyReading()] }))
                            }
                        >
                            <Plus className="h-4 w-4 mr-1" /> Adicionar
                        </Button>
                    </div>
                    {calculations.emaResults.length > 0 && eVal > 0 && (
                        <p className="text-xs text-muted-foreground">
                            e = {eVal} {state.capacityUnit} | Classe {state.precisionClass} |{' '}
                            {state.verificationType === 'in_use' ? 'Em Uso (2×)' : 'Inicial/Subsequente'}
                        </p>
                    )}
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b text-left">
                                <th className="p-2 w-10">#</th>
                                <th className="p-2">Ref. ({state.capacityUnit})</th>
                                <th className="p-2">Indicação ↑</th>
                                <th className="p-2">Indicação ↓</th>
                                <th className="p-2">Fator k</th>
                                <th className="p-2">Erro</th>
                                <th className="p-2">EMA</th>
                                <th className="p-2">Status</th>
                                <th className="p-2 w-10"></th>
                            </tr>
                        </thead>
                        <tbody>
                            {state.readings.map((r, i) => {
                                const ref = parseFloat(r.referenceValue) || 0
                                const ind = parseFloat(r.indicationIncreasing) || 0
                                const error = r.indicationIncreasing ? calculateReadingError(ind, ref) : null
                                const ema = eVal > 0 && ref > 0 ? calculations.calculateEmaForLoad(ref) : null
                                const conforming = error !== null && ema !== null ? isConforming(error, ema) : null

                                return (
                                    <tr key={i} className="border-b hover:bg-muted/50">
                                        <td className="p-2 text-muted-foreground">{i + 1}</td>
                                        <td className="p-2">
                                            <Input
                                                type="number"
                                                step="0.0001"
                                                value={r.referenceValue}
                                                onChange={(e) => updateReading(i, 'referenceValue', e.target.value)}
                                                className="w-28"
                                                placeholder="0.0000"
                                                aria-label={`Valor de referência ${i + 1}`}
                                            />
                                        </td>
                                        <td className="p-2">
                                            <Input
                                                type="number"
                                                step="0.0001"
                                                value={r.indicationIncreasing}
                                                onChange={(e) => updateReading(i, 'indicationIncreasing', e.target.value)}
                                                className="w-28"
                                                placeholder="0.0000"
                                                aria-label={`Indicação crescente ${i + 1}`}
                                            />
                                        </td>
                                        <td className="p-2">
                                            <Input
                                                type="number"
                                                step="0.0001"
                                                value={r.indicationDecreasing}
                                                onChange={(e) => updateReading(i, 'indicationDecreasing', e.target.value)}
                                                className="w-28"
                                                placeholder="0.0000"
                                                aria-label={`Indicação decrescente ${i + 1}`}
                                            />
                                        </td>
                                        <td className="p-2">
                                            <Input
                                                type="number"
                                                step="0.01"
                                                value={r.kFactor}
                                                onChange={(e) => updateReading(i, 'kFactor', e.target.value)}
                                                className="w-20"
                                                aria-label={`Fator k ${i + 1}`}
                                            />
                                        </td>
                                        <td className="p-2 font-mono text-right">
                                            {error !== null ? error.toFixed(4) : '—'}
                                        </td>
                                        <td className="p-2 font-mono text-right text-muted-foreground">
                                            {ema !== null ? `±${ema.toFixed(4)}` : '—'}
                                        </td>
                                        <td className="p-2 text-center">
                                            {conforming === null ? (
                                                <span className="text-muted-foreground">—</span>
                                            ) : conforming ? (
                                                <CheckCircle className="h-4 w-4 text-green-600 inline-block" />
                                            ) : (
                                                <XCircle className="h-4 w-4 text-red-600 inline-block" />
                                            )}
                                        </td>
                                        <td className="p-2">
                                            <Button
                                                size="icon"
                                                variant="ghost"
                                                onClick={() =>
                                                    setState((prev) => ({
                                                        ...prev,
                                                        readings: prev.readings.filter((_, j) => j !== i),
                                                    }))
                                                }
                                                disabled={state.readings.length <= 1}
                                                aria-label={`Remover leitura ${i + 1}`}
                                            >
                                                <Trash2 className="h-4 w-4 text-destructive" />
                                            </Button>
                                        </td>
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        )
    }

    const renderStep5 = () => {
        const centerInd = parseFloat(state.eccentricityTests[0]?.indication) || 0
        const positionMap: Record<string, number> = {
            'Centro': 0, 'Frente': 1, 'Trás': 2, 'Esquerda': 3, 'Direita': 4,
        }
        const gridPositions: Array<{ label: string; row: number; col: number; idx: number }> = [
            { label: 'Frente', row: 0, col: 1, idx: 1 },
            { label: 'Esquerda', row: 1, col: 0, idx: 3 },
            { label: 'Centro', row: 1, col: 1, idx: 0 },
            { label: 'Direita', row: 1, col: 2, idx: 4 },
            { label: 'Trás', row: 2, col: 1, idx: 2 },
        ]

        return (
            <div className="space-y-4">
                <div className="flex items-center gap-2">
                    <Info className="h-4 w-4 text-blue-500" />
                    <p className="text-sm text-muted-foreground">
                        Posicione a carga em 5 pontos distintos da plataforma (ISO 17025 / OIML R76).
                    </p>
                </div>

                {suggestedPoints && (
                    <p className="text-xs text-muted-foreground">
                        Carga sugerida: <strong>{suggestedPoints.eccentricity_load} {state.capacityUnit}</strong>{' '}
                        (≈1/3 da capacidade)
                    </p>
                )}

                {/* Visual Plate Diagram (3×3 grid) */}
                <div className="flex flex-col md:flex-row gap-6">
                    <div className="flex-shrink-0">
                        <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wider">Diagrama do Prato</p>
                        <div className="grid grid-cols-3 gap-1 w-48 h-48 bg-muted/30 border-2 border-dashed border-muted-foreground/20 rounded-lg p-1">
                            {[0, 1, 2].map((row) =>
                                [0, 1, 2].map((col) => {
                                    const pos = gridPositions.find((p) => p.row === row && p.col === col)
                                    if (!pos) {
                                        return <div key={`${row}-${col}`} className="rounded" />
                                    }
                                    const test = state.eccentricityTests[pos.idx]
                                    const hasValue = !!(test?.indication)
                                    const ind = parseFloat(test?.indication) || 0
                                    const err = hasValue && pos.idx !== 0 ? Math.abs(ind - centerInd) : 0
                                    const eVal = parseFloat(state.eValue) || 1
                                    const isOk = hasValue && (pos.idx === 0 || err <= eVal)
                                    return (
                                        <button
                                            key={`${row}-${col}`}
                                            type="button"
                                            onClick={() => {
                                                const input = document.getElementById(`ecc-ind-${pos.idx}`)
                                                input?.focus()
                                            }}
                                            className={`
                                                rounded flex flex-col items-center justify-center text-[10px] font-medium
                                                transition-all cursor-pointer border
                                                ${hasValue
                                                    ? isOk
                                                        ? 'bg-green-100 border-green-400 text-green-800 dark:bg-green-900/40 dark:text-green-300 dark:border-green-600'
                                                        : 'bg-red-100 border-red-400 text-red-800 dark:bg-red-900/40 dark:text-red-300 dark:border-red-600'
                                                    : 'bg-background border-border hover:bg-muted/50'
                                                }
                                            `}
                                        >
                                            <span>{pos.label}</span>
                                            {hasValue && (
                                                <span className="font-mono text-[9px]">
                                                    {ind.toFixed(2)}
                                                </span>
                                            )}
                                        </button>
                                    )
                                })
                            )}
                        </div>
                    </div>

                    {/* Data Table */}
                    <div className="flex-1 overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b text-left">
                                    <th className="p-2">Posição</th>
                                    <th className="p-2">Carga ({state.capacityUnit})</th>
                                    <th className="p-2">Indicação ({state.capacityUnit})</th>
                                    <th className="p-2">Erro vs Centro</th>
                                </tr>
                            </thead>
                            <tbody>
                                {state.eccentricityTests.map((t, i) => {
                                    const ind = parseFloat(t.indication) || 0
                                    const errVsCenter = t.indication && i > 0 ? (ind - centerInd).toFixed(4) : i === 0 ? 'REF' : '—'
                                    return (
                                        <tr key={i} className="border-b hover:bg-muted/50">
                                            <td className="p-2 font-medium">{t.position}</td>
                                            <td className="p-2">
                                                <Input
                                                    type="number"
                                                    step="0.0001"
                                                    value={t.loadApplied}
                                                    onChange={(e) => updateEccentricity(i, 'loadApplied', e.target.value)}
                                                    className="w-28"
                                                    placeholder="0.0000"
                                                    aria-label={`Carga ${t.position}`}
                                                />
                                            </td>
                                            <td className="p-2">
                                                <Input
                                                    id={`ecc-ind-${i}`}
                                                    type="number"
                                                    step="0.0001"
                                                    value={t.indication}
                                                    onChange={(e) => updateEccentricity(i, 'indication', e.target.value)}
                                                    className="w-28"
                                                    placeholder="0.0000"
                                                    aria-label={`Indicação ${t.position}`}
                                                />
                                            </td>
                                            <td className="p-2 font-mono text-right">
                                                <span className={
                                                    typeof errVsCenter === 'string' && errVsCenter !== '—' && errVsCenter !== 'REF'
                                                        ? Math.abs(parseFloat(errVsCenter)) > 0 ? 'text-yellow-600' : 'text-green-600'
                                                        : 'text-muted-foreground'
                                                }>
                                                    {errVsCenter}
                                                </span>
                                            </td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        )
    }

    const renderStep6 = () => {
        const validMeasurements = state.repeatabilityMeasurements
            .map((v) => parseFloat(v))
            .filter((v) => !isNaN(v))
        const stats = validMeasurements.length >= 2 ? calculateRepeatability(validMeasurements) : null

        return (
            <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label htmlFor="repLoad">Carga Aplicada ({state.capacityUnit})</Label>
                        <Input
                            id="repLoad"
                            type="number"
                            step="0.0001"
                            value={state.repeatabilityLoad}
                            onChange={(e) => update('repeatabilityLoad', e.target.value)}
                            placeholder={suggestedPoints ? String(suggestedPoints.repeatability_load) : '0'}
                        />
                        <p className="text-xs text-muted-foreground">
                            Recomendado: ≈50% da capacidade máxima
                        </p>
                    </div>
                </div>

                <div className="space-y-3">
                    <Label>Medições (mínimo 6, ideal 10)</Label>
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                        {state.repeatabilityMeasurements.map((m, i) => (
                            <div key={i} className="relative">
                                <Input
                                    type="number"
                                    step="0.0001"
                                    value={m}
                                    onChange={(e) => updateRepMeasurement(i, e.target.value)}
                                    placeholder={`M${i + 1}`}
                                    aria-label={`Medição ${i + 1}`}
                                />
                                <span className="absolute top-0.5 right-2 text-xs text-muted-foreground">
                                    {i + 1}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>

                {stats && (
                    <Card className="bg-muted/30">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-base">Resultados Calculados</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                                <div>
                                    <span className="text-muted-foreground">n medições:</span>
                                    <p className="font-mono font-medium">{validMeasurements.length}</p>
                                </div>
                                <div>
                                    <span className="text-muted-foreground">Média:</span>
                                    <p className="font-mono font-medium">{stats.mean.toFixed(4)}</p>
                                </div>
                                <div>
                                    <span className="text-muted-foreground">Desvio Padrão (s):</span>
                                    <p className="font-mono font-medium">{stats.stdDev.toFixed(6)}</p>
                                </div>
                                <div>
                                    <span className="text-muted-foreground">Incerteza Tipo A (u_A):</span>
                                    <p className="font-mono font-medium">{stats.uncertaintyTypeA.toFixed(6)}</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                )}

                {/* Validation Result */}
                {validationResult && (
                    <Card
                        className={
                            validationResult.complete
                                ? 'border-green-200 bg-green-50 dark:bg-green-950/20'
                                : 'border-yellow-200 bg-yellow-50 dark:bg-yellow-950/20'
                        }
                    >
                        <CardContent className="pt-4">
                            <div className="flex items-start gap-3">
                                {validationResult.complete ? (
                                    <CheckCircle className="h-5 w-5 text-green-600 shrink-0" />
                                ) : (
                                    <AlertTriangle className="h-5 w-5 text-yellow-600 shrink-0" />
                                )}
                                <div>
                                    <p className="font-medium">
                                        Validação ISO 17025: {validationResult.score}/{validationResult.total_fields}{' '}
                                        campos preenchidos
                                    </p>
                                    {!validationResult.complete &&
                                        validationResult.missing_fields?.length > 0 && (
                                            <ul className="mt-2 text-sm text-muted-foreground list-disc list-inside">
                                                {validationResult.missing_fields.map((f: string) => (
                                                    <li key={f}>{f}</li>
                                                ))}
                                            </ul>
                                        )}
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                )}
            </div>
        )
    }

    const stepRenderers = [renderStep1, renderStep2, renderStep3, renderStep4, renderStep5, renderStep6]

    // ─── Main Layout ──────────────────────────────────────
    return (
        <div className="space-y-6">
            <PageHeader
                title="Wizard de Calibração"
                subtitle={
                    equipment
                        ? `${equipment.brand || ''} ${equipment.model || ''} — S/N: ${equipment.serial_number || ''}`
                        : 'Certificado de calibração guiado ISO 17025'
                }
            >
                <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setIsAdvancedMode(!isAdvancedMode)}
                    className="gap-1"
                >
                    {isAdvancedMode ? (
                        <ToggleRight className="h-4 w-4" />
                    ) : (
                        <ToggleLeft className="h-4 w-4" />
                    )}
                    {isAdvancedMode ? 'Modo Wizard' : 'Modo Avançado'}
                </Button>
            </PageHeader>

            {/* Memory Badge */}
            {isPrefillApplied && (
                <div className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800">
                    <ClipboardCheck className="h-4 w-4 text-blue-600 shrink-0" />
                    <span className="text-sm text-blue-700 dark:text-blue-300">
                        📋 <strong>Memória ativa</strong> — Dados pré-preenchidos da calibração anterior
                    </span>
                </div>
            )}

            {/* Step Indicator */}
            {!isAdvancedMode && (
                <nav
                    className="flex items-center gap-1 md:gap-2 overflow-x-auto pb-2"
                    aria-label="Progresso do wizard"
                >
                    {STEP_LABELS.map((s, i) => {
                        const Icon = s.icon
                        const isActive = i === step
                        const isDone = i < step
                        return (
                            <button
                                key={s.key}
                                onClick={() => setStep(i)}
                                className={`
                  flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium
                  transition-all whitespace-nowrap
                  ${isActive ? 'bg-primary text-primary-foreground shadow-sm' : ''}
                  ${isDone ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : ''}
                  ${!isActive && !isDone ? 'text-muted-foreground hover:bg-muted' : ''}
                `}
                            >
                                {isDone ? <Check className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
                                <span className="hidden md:inline">{s.label}</span>
                                <span className="md:hidden">{i + 1}</span>
                            </button>
                        )
                    })}
                </nav>
            )}

            {/* Content */}
            {isAdvancedMode ? (
                // Advanced: all steps in cards
                <div className="space-y-6">
                    {STEP_LABELS.map((s, i) => (
                        <Card key={s.key}>
                            <CardHeader>
                                <CardTitle className="text-base flex items-center gap-2">
                                    {(() => {
                                        const Icon = s.icon
                                        return <Icon className="h-4 w-4" />
                                    })()}
                                    Etapa {i + 1}: {s.label}
                                </CardTitle>
                            </CardHeader>
                            <CardContent>{stepRenderers[i]()}</CardContent>
                        </Card>
                    ))}

                    <div className="flex justify-end gap-3">
                        <Button variant="outline" onClick={() => navigate(-1)}>
                            Cancelar
                        </Button>
                        <Button variant="secondary" onClick={handleSaveDraft}>
                            <Save className="h-4 w-4 mr-1" /> Salvar Rascunho
                        </Button>
                        <Button onClick={handleFinish} disabled={generateCertMutation.isPending}>
                            <FileCheck className="h-4 w-4 mr-1" />
                            {generateCertMutation.isPending ? 'Gerando...' : 'Gerar Certificado'}
                        </Button>
                        <Button variant="outline" onClick={handleGenerateAndPrint} disabled={generateCertMutation.isPending}>
                            <Printer className="h-4 w-4 mr-1" /> Gerar e Imprimir
                        </Button>
                    </div>
                </div>
            ) : (
                // Wizard mode: one step at a time
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            {(() => {
                                const Icon = STEP_LABELS[step].icon
                                return <Icon className="h-5 w-5" />
                            })()}
                            Etapa {step + 1}: {STEP_LABELS[step].label}
                        </CardTitle>
                        <CardDescription>
                            {step === 0 && 'Identifique o equipamento e confirme os dados metrológicos.'}
                            {step === 1 && 'Registre as condições ambientais no momento da calibração.'}
                            {step === 2 && 'Identifique os padrões e pesos utilizados.'}
                            {step === 3 && 'Insira as leituras de indicação carga crescente e decrescente.'}
                            {step === 4 && 'Registre o ensaio de excentricidade (5 posições).'}
                            {step === 5 && 'Registre as medições de repetibilidade (mínimo 6 repetições).'}
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        {stepRenderers[step]()}

                        {/* Navigation */}
                        <div className="flex justify-between items-center mt-8 pt-6 border-t">
                            <Button variant="outline" onClick={goPrev} disabled={!canPrev}>
                                <ArrowLeft className="h-4 w-4 mr-1" /> Anterior
                            </Button>

                            <span className="text-sm text-muted-foreground">
                                {step + 1} de {STEP_LABELS.length}
                            </span>

                            {canNext ? (
                                <Button onClick={goNext}>
                                    Próximo <ArrowRight className="h-4 w-4 ml-1" />
                                </Button>
                            ) : (
                                <div className="flex gap-2">
                                    <Button variant="secondary" size="sm" onClick={handleSaveDraft}>
                                        <Save className="h-4 w-4 mr-1" /> Rascunho
                                    </Button>
                                    <Button onClick={handleFinish} disabled={generateCertMutation.isPending}>
                                        <FileCheck className="h-4 w-4 mr-1" />
                                        {generateCertMutation.isPending ? 'Gerando...' : 'Gerar Certificado'}
                                    </Button>
                                    <Button variant="outline" size="sm" onClick={handleGenerateAndPrint} disabled={generateCertMutation.isPending}>
                                        <Printer className="h-4 w-4 mr-1" /> Imprimir
                                    </Button>
                                </div>
                            )}
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    )
}
