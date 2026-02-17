import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
    Car, Fuel, Gauge, CheckCircle2, AlertTriangle, Plus, Clock, Loader2,
    ArrowLeft, Shield, CircleDot, Droplets,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import api from '@/lib/api'
import { toast } from 'sonner'
import { useAuthStore } from '@/stores/auth-store'

type TabId = 'checkin' | 'fuel' | 'incidents'

interface Vehicle {
    id: number
    plate: string
    model?: string
    brand?: string
    year?: number
    odometer_km?: number
    assigned_user_id?: number
}

interface Inspection {
    id: number
    fleet_vehicle_id: number
    inspection_date: string
    odometer_km: number
    checklist_data?: Record<string, unknown>
    status: string
}

interface FuelLog {
    id: number
    date: string
    odometer_km: number
    liters: number
    total_value: number
    gas_station?: string
    fuel_type?: string
}

interface Accident {
    id: number
    occurrence_date: string
    description: string
    status?: string
}

const FUEL_LEVELS = ['Vazio', '1/4', '1/2', '3/4', 'Cheio'] as const
const FUEL_TYPES = ['Gasolina', 'Etanol', 'Diesel', 'GNV'] as const
const INCIDENT_TYPES = ['Acidente', 'Avaria Mecânica', 'Multa', 'Pneu Furado', 'Outro'] as const

export default function TechVehicleCheckinPage() {
    const navigate = useNavigate()
    const { user } = useAuthStore()
    const [tab, setTab] = useState<TabId>('checkin')
    const [vehicle, setVehicle] = useState<Vehicle | null>(null)
    const [loading, setLoading] = useState(true)
    const [inspections, setInspections] = useState<Inspection[]>([])
    const [fuelLogs, setFuelLogs] = useState<FuelLog[]>([])
    const [accidents, setAccidents] = useState<Accident[]>([])

    const [checkinKm, setCheckinKm] = useState('')
    const [checkinFuel, setCheckinFuel] = useState<string>(FUEL_LEVELS[2])
    const [checkinPneus, setCheckinPneus] = useState(true)
    const [checkinLuzes, setCheckinLuzes] = useState(true)
    const [checkinFreios, setCheckinFreios] = useState(true)
    const [checkinLimpeza, setCheckinLimpeza] = useState(true)
    const [checkinDocumentos, setCheckinDocumentos] = useState(true)
    const [checkinObs, setCheckinObs] = useState('')
    const [checkinSubmitting, setCheckinSubmitting] = useState(false)

    const [checkoutKm, setCheckoutKm] = useState('')
    const [checkoutCondition, setCheckoutCondition] = useState(true)
    const [checkoutSubmitting, setCheckoutSubmitting] = useState(false)

    const [showFuelForm, setShowFuelForm] = useState(false)
    const [fuelKm, setFuelKm] = useState('')
    const [fuelLiters, setFuelLiters] = useState('')
    const [fuelTotal, setFuelTotal] = useState('')
    const [fuelStation, setFuelStation] = useState('')
    const [fuelType, setFuelType] = useState<string>(FUEL_TYPES[0])
    const [fuelSubmitting, setFuelSubmitting] = useState(false)

    const [showIncidentForm, setShowIncidentForm] = useState(false)
    const [incidentType, setIncidentType] = useState<string>(INCIDENT_TYPES[0])
    const [incidentDesc, setIncidentDesc] = useState('')
    const [incidentSubmitting, setIncidentSubmitting] = useState(false)

    const sortedInspections = [...inspections].sort(
        (a, b) => new Date(b.inspection_date).getTime() - new Date(a.inspection_date).getTime()
    )
    const mostRecent = sortedInspections[0]
    const activeCheckin =
        mostRecent && (mostRecent.checklist_data as Record<string, string>)?.['check_type'] === 'check_in'
            ? mostRecent
            : null

    useEffect(() => {
        loadVehicle()
    }, [])

    useEffect(() => {
        if (vehicle?.id) {
            loadInspections()
            loadFuelLogs()
            loadAccidents()
        }
    }, [vehicle?.id])

    async function loadVehicle() {
        try {
            setLoading(true)
            const res = await api.get<{ data?: Vehicle[] }>('/fleet/vehicles', { params: { per_page: 100 } })
            const list = res.data?.data ?? (Array.isArray(res.data) ? res.data : [])
            const arr = Array.isArray(list) ? list : (list as { data?: Vehicle[] })?.data ?? []
            const myVehicle = arr.find((v: Vehicle) => v.assigned_user_id === user?.id) ?? arr[0] ?? null
            setVehicle(myVehicle)
        } catch (e: unknown) {
            toast.error((e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Erro ao carregar veículo')
        } finally {
            setLoading(false)
        }
    }

    async function loadInspections() {
        if (!vehicle?.id) return
        try {
            const res = await api.get<{ data?: Inspection[] }>('/fleet/inspections', {
                params: { fleet_vehicle_id: vehicle.id, per_page: 50 },
            })
            const list = (res.data as { data?: Inspection[] })?.data ?? []
            setInspections(list)
        } catch {
            setInspections([])
        }
    }

    async function loadFuelLogs() {
        if (!vehicle?.id) return
        try {
            const res = await api.get<{ data?: FuelLog[] }>('/fleet/fuel-logs', {
                params: { fleet_vehicle_id: vehicle.id, per_page: 20 },
            })
            const list = (res.data as { data?: FuelLog[] })?.data ?? []
            setFuelLogs(list)
        } catch {
            setFuelLogs([])
        }
    }

    async function loadAccidents() {
        if (!vehicle?.id) return
        try {
            const res = await api.get<{ data?: Accident[] }>('/fleet/accidents', {
                params: { fleet_vehicle_id: vehicle.id, per_page: 20 },
            })
            const list = (res.data as { data?: Accident[] })?.data ?? []
            setAccidents(list)
        } catch {
            setAccidents([])
        }
    }

    async function handleCheckin() {
        if (!vehicle?.id || !checkinKm.trim()) {
            toast.error('Informe o km atual')
            return
        }
        setCheckinSubmitting(true)
        try {
            const checklist: Record<string, unknown> = {
                check_type: 'check_in',
                fuel_level: checkinFuel,
                pneus_ok: checkinPneus,
                luzes_ok: checkinLuzes,
                freios_ok: checkinFreios,
                limpeza_ok: checkinLimpeza,
                documentos_ok: checkinDocumentos,
                observations: checkinObs,
            }
            await api.post('/fleet/inspections', {
                fleet_vehicle_id: vehicle.id,
                inspection_date: new Date().toISOString().slice(0, 10),
                odometer_km: parseInt(checkinKm, 10),
                checklist_data: checklist,
                status: 'ok',
                observations: checkinObs,
            })
            toast.success('Check-in realizado')
            setCheckinKm('')
            setCheckinObs('')
            loadInspections()
        } catch (e: unknown) {
            toast.error((e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Erro ao fazer check-in')
        } finally {
            setCheckinSubmitting(false)
        }
    }

    async function handleCheckout() {
        if (!vehicle?.id || !checkoutKm.trim()) {
            toast.error('Informe o km final')
            return
        }
        setCheckoutSubmitting(true)
        try {
            const checklist: Record<string, unknown> = {
                check_type: 'check_out',
                condition_ok: checkoutCondition,
            }
            await api.post('/fleet/inspections', {
                fleet_vehicle_id: vehicle.id,
                inspection_date: new Date().toISOString().slice(0, 10),
                odometer_km: parseInt(checkoutKm, 10),
                checklist_data: checklist,
                status: checkoutCondition ? 'ok' : 'issues_found',
                observations: '',
            })
            toast.success('Check-out realizado')
            setCheckoutKm('')
            loadInspections()
        } catch (e: unknown) {
            toast.error((e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Erro ao fazer check-out')
        } finally {
            setCheckoutSubmitting(false)
        }
    }

    async function handleFuelSubmit() {
        if (!vehicle?.id || !fuelKm.trim() || !fuelLiters.trim() || !fuelTotal.trim()) {
            toast.error('Preencha Km, Litros e Valor total')
            return
        }
        setFuelSubmitting(true)
        try {
            const total = parseFloat(fuelTotal.replace(',', '.'))
            const liters = parseFloat(fuelLiters.replace(',', '.'))
            await api.post('/fleet/fuel-logs', {
                fleet_vehicle_id: vehicle.id,
                date: new Date().toISOString().slice(0, 10),
                odometer_km: parseInt(fuelKm, 10),
                liters,
                price_per_liter: liters > 0 ? total / liters : 0,
                total_value: total,
                fuel_type: fuelType,
                gas_station: fuelStation || undefined,
            })
            toast.success('Abastecimento registrado')
            setShowFuelForm(false)
            setFuelKm('')
            setFuelLiters('')
            setFuelTotal('')
            setFuelStation('')
            loadFuelLogs()
        } catch (e: unknown) {
            toast.error((e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Erro ao registrar abastecimento')
        } finally {
            setFuelSubmitting(false)
        }
    }

    async function handleIncidentSubmit() {
        if (!vehicle?.id || !incidentDesc.trim()) {
            toast.error('Informe a descrição')
            return
        }
        setIncidentSubmitting(true)
        try {
            const fullDesc = `[${incidentType}] ${incidentDesc}`
            await api.post('/fleet/accidents', {
                fleet_vehicle_id: vehicle.id,
                occurrence_date: new Date().toISOString().slice(0, 10),
                description: fullDesc,
                status: 'investigating',
            })
            toast.success('Ocorrência registrada')
            setShowIncidentForm(false)
            setIncidentDesc('')
            loadAccidents()
        } catch (e: unknown) {
            toast.error((e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Erro ao registrar ocorrência')
        } finally {
            setIncidentSubmitting(false)
        }
    }

    const formatDate = (d: string) => {
        try {
            return new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
        } catch {
            return d
        }
    }

    const formatTime = (d: string) => {
        try {
            return new Date(d).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
        } catch {
            return ''
        }
    }

    const formatCurrency = (v: number) =>
        new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)

    if (loading) {
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
                        <h1 className="text-lg font-bold text-foreground">Meu Veículo</h1>
                    </div>
                </div>
                <div className="flex-1 overflow-y-auto flex items-center justify-center">
                    <Loader2 className="w-8 h-8 animate-spin text-brand-500" />
                </div>
            </div>
        )
    }

    if (!vehicle) {
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
                        <h1 className="text-lg font-bold text-foreground">Meu Veículo</h1>
                    </div>
                </div>
                <div className="flex-1 overflow-y-auto px-4 py-6 flex flex-col items-center justify-center gap-4">
                    <Car className="w-12 h-12 text-surface-400" />
                    <p className="text-sm text-surface-600 text-center">
                        Nenhum veículo atribuído a você.
                    </p>
                    <button
                        onClick={() => navigate('/tech')}
                        className="px-4 py-2 rounded-lg bg-brand-600 text-white text-sm font-medium"
                    >
                        Voltar
                    </button>
                </div>
            </div>
        )
    }

    const tabs: { id: TabId; label: string }[] = [
        { id: 'checkin', label: 'Check-in/out' },
        { id: 'fuel', label: 'Abastecimentos' },
        { id: 'incidents', label: 'Ocorrências' },
    ]

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
                    <h1 className="text-lg font-bold text-foreground">Meu Veículo</h1>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto">
                <div className="p-4 space-y-4">
                    <div className="bg-card rounded-xl p-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-brand-100">
                                <Car className="w-5 h-5 text-brand-600" />
                            </div>
                            <div>
                                <p className="font-semibold text-foreground">
                                    {vehicle.plate}
                                </p>
                                <p className="text-sm text-surface-600">
                                    {[vehicle.brand, vehicle.model, vehicle.year].filter(Boolean).join(' · ')}
                                </p>
                                {vehicle.odometer_km != null && (
                                    <p className="text-xs text-surface-500 flex items-center gap-1 mt-0.5">
                                        <Gauge className="w-3.5 h-3.5" />
                                        {vehicle.odometer_km.toLocaleString('pt-BR')} km
                                    </p>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="flex gap-1 p-1 rounded-lg bg-surface-100">
                        {tabs.map((t) => (
                            <button
                                key={t.id}
                                onClick={() => setTab(t.id)}
                                className={cn(
                                    'flex-1 py-2 px-3 rounded-md text-sm font-medium transition-colors',
                                    tab === t.id
                                        ? 'bg-card text-brand-600 shadow-sm'
                                        : 'text-surface-600 hover:text-surface-900'
                                )}
                            >
                                {t.label}
                            </button>
                        ))}
                    </div>

                    {tab === 'checkin' && (
                        <div className="space-y-4">
                            <div className="bg-card rounded-xl p-4">
                                <div className="flex items-center gap-2 mb-4">
                                    {activeCheckin ? (
                                        <>
                                            <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                                            <span className="text-sm text-surface-700">
                                                Check-in ativo desde {formatTime(activeCheckin.inspection_date)}
                                            </span>
                                        </>
                                    ) : (
                                        <>
                                            <CircleDot className="w-5 h-5 text-amber-500" />
                                            <span className="text-sm text-surface-700">
                                                Sem check-in
                                            </span>
                                        </>
                                    )}
                                </div>

                                {!activeCheckin && (
                                    <>
                                        <div className="space-y-3 mb-4">
                                            <label className="block text-sm font-medium text-surface-700">
                                                Km atual
                                            </label>
                                            <input
                                                type="number"
                                                value={checkinKm}
                                                onChange={(e) => setCheckinKm(e.target.value)}
                                                placeholder="Ex: 45000"
                                                className="w-full px-3 py-2.5 rounded-lg bg-surface-100 border-0 text-sm focus:ring-2 focus:ring-brand-500/30 focus:outline-none"
                                            />
                                            <label className="block text-sm font-medium text-surface-700">
                                                Nível combustível
                                            </label>
                                            <select
                                                value={checkinFuel}
                                                onChange={(e) => setCheckinFuel(e.target.value)}
                                                className="w-full px-3 py-2.5 rounded-lg bg-surface-100 border-0 text-sm focus:ring-2 focus:ring-brand-500/30 focus:outline-none"
                                            >
                                                {FUEL_LEVELS.map((f) => (
                                                    <option key={f} value={f}>{f}</option>
                                                ))}
                                            </select>
                                            <div className="flex flex-wrap gap-2 pt-2">
                                                {[
                                                    { key: 'pneus', label: 'Pneus OK', val: checkinPneus, set: setCheckinPneus },
                                                    { key: 'luzes', label: 'Luzes OK', val: checkinLuzes, set: setCheckinLuzes },
                                                    { key: 'freios', label: 'Freios OK', val: checkinFreios, set: setCheckinFreios },
                                                    { key: 'limpeza', label: 'Limpeza OK', val: checkinLimpeza, set: setCheckinLimpeza },
                                                    { key: 'docs', label: 'Documentos OK', val: checkinDocumentos, set: setCheckinDocumentos },
                                                ].map(({ key, label, val, set }) => (
                                                    <button
                                                        key={key}
                                                        type="button"
                                                        onClick={() => set(!val)}
                                                        className={cn(
                                                            'px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5',
                                                            val
                                                                ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700'
                                                                : 'bg-surface-200 text-surface-600'
                                                        )}
                                                    >
                                                        <Shield className="w-3.5 h-3.5" />
                                                        {label}
                                                    </button>
                                                ))}
                                            </div>
                                            <label className="block text-sm font-medium text-surface-700">
                                                Observações
                                            </label>
                                            <textarea
                                                value={checkinObs}
                                                onChange={(e) => setCheckinObs(e.target.value)}
                                                rows={2}
                                                placeholder="Opcional"
                                                className="w-full px-3 py-2.5 rounded-lg bg-surface-100 border-0 text-sm focus:ring-2 focus:ring-brand-500/30 focus:outline-none resize-none"
                                            />
                                        </div>
                                        <button
                                            onClick={handleCheckin}
                                            disabled={checkinSubmitting}
                                            className="w-full py-2.5 rounded-lg bg-brand-600 text-white font-medium text-sm flex items-center justify-center gap-2"
                                        >
                                            {checkinSubmitting ? (
                                                <Loader2 className="w-4 h-4 animate-spin" />
                                            ) : (
                                                <CheckCircle2 className="w-4 h-4" />
                                            )}
                                            Fazer Check-in
                                        </button>
                                    </>
                                )}

                                {activeCheckin && (
                                    <>
                                        <div className="space-y-3 mb-4">
                                            <label className="block text-sm font-medium text-surface-700">
                                                Km final
                                            </label>
                                            <input
                                                type="number"
                                                value={checkoutKm}
                                                onChange={(e) => setCheckoutKm(e.target.value)}
                                                placeholder="Ex: 45120"
                                                className="w-full px-3 py-2.5 rounded-lg bg-surface-100 border-0 text-sm focus:ring-2 focus:ring-brand-500/30 focus:outline-none"
                                            />
                                            <label className="flex items-center gap-2">
                                                <input
                                                    type="checkbox"
                                                    checked={checkoutCondition}
                                                    onChange={(e) => setCheckoutCondition(e.target.checked)}
                                                    className="rounded"
                                                />
                                                <span className="text-sm text-surface-700">
                                                    Condição OK
                                                </span>
                                            </label>
                                        </div>
                                        <button
                                            onClick={handleCheckout}
                                            disabled={checkoutSubmitting}
                                            className="w-full py-2.5 rounded-lg bg-amber-600 text-white font-medium text-sm flex items-center justify-center gap-2"
                                        >
                                            {checkoutSubmitting ? (
                                                <Loader2 className="w-4 h-4 animate-spin" />
                                            ) : (
                                                <Clock className="w-4 h-4" />
                                            )}
                                            Fazer Check-out
                                        </button>
                                    </>
                                )}
                            </div>
                        </div>
                    )}

                    {tab === 'fuel' && (
                        <div className="space-y-4">
                            <button
                                onClick={() => setShowFuelForm(!showFuelForm)}
                                className="w-full py-2.5 rounded-lg border-2 border-dashed border-surface-300 text-surface-600 text-sm font-medium flex items-center justify-center gap-2"
                            >
                                <Plus className="w-4 h-4" />
                                Novo Abastecimento
                            </button>

                            {showFuelForm && (
                                <div className="bg-card rounded-xl p-4 space-y-3">
                                    <input
                                        type="number"
                                        value={fuelKm}
                                        onChange={(e) => setFuelKm(e.target.value)}
                                        placeholder="Km"
                                        className="w-full px-3 py-2.5 rounded-lg bg-surface-100 border-0 text-sm focus:ring-2 focus:ring-brand-500/30 focus:outline-none"
                                    />
                                    <input
                                        type="number"
                                        step="0.01"
                                        value={fuelLiters}
                                        onChange={(e) => setFuelLiters(e.target.value)}
                                        placeholder="Litros"
                                        className="w-full px-3 py-2.5 rounded-lg bg-surface-100 border-0 text-sm focus:ring-2 focus:ring-brand-500/30 focus:outline-none"
                                    />
                                    <input
                                        type="number"
                                        step="0.01"
                                        value={fuelTotal}
                                        onChange={(e) => setFuelTotal(e.target.value)}
                                        placeholder="Valor total (R$)"
                                        className="w-full px-3 py-2.5 rounded-lg bg-surface-100 border-0 text-sm focus:ring-2 focus:ring-brand-500/30 focus:outline-none"
                                    />
                                    <input
                                        type="text"
                                        value={fuelStation}
                                        onChange={(e) => setFuelStation(e.target.value)}
                                        placeholder="Posto"
                                        className="w-full px-3 py-2.5 rounded-lg bg-surface-100 border-0 text-sm focus:ring-2 focus:ring-brand-500/30 focus:outline-none"
                                    />
                                    <select
                                        value={fuelType}
                                        onChange={(e) => setFuelType(e.target.value)}
                                        className="w-full px-3 py-2.5 rounded-lg bg-surface-100 border-0 text-sm focus:ring-2 focus:ring-brand-500/30 focus:outline-none"
                                    >
                                        {FUEL_TYPES.map((f) => (
                                            <option key={f} value={f}>{f}</option>
                                        ))}
                                    </select>
                                    <button
                                        onClick={handleFuelSubmit}
                                        disabled={fuelSubmitting}
                                        className="w-full py-2.5 rounded-lg bg-brand-600 text-white font-medium text-sm flex items-center justify-center gap-2"
                                    >
                                        {fuelSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Droplets className="w-4 h-4" />}
                                        Registrar
                                    </button>
                                </div>
                            )}

                            <div className="space-y-2">
                                {fuelLogs.length === 0 ? (
                                    <p className="text-sm text-surface-500 text-center py-4">Nenhum abastecimento recente</p>
                                ) : (
                                    fuelLogs.map((log) => (
                                        <div
                                            key={log.id}
                                            className="bg-card rounded-xl p-4 flex items-center justify-between"
                                        >
                                            <div className="flex items-center gap-3">
                                                <Fuel className="w-5 h-5 text-brand-500" />
                                                <div>
                                                    <p className="text-sm font-medium text-foreground">
                                                        {formatDate(log.date)} · {log.liters} L
                                                    </p>
                                                    <p className="text-xs text-surface-500">
                                                        {log.gas_station || '—'} · {formatCurrency(log.total_value)}
                                                    </p>
                                                </div>
                                            </div>
                                            <span className="text-xs text-surface-500">{log.odometer_km?.toLocaleString('pt-BR')} km</span>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    )}

                    {tab === 'incidents' && (
                        <div className="space-y-4">
                            <button
                                onClick={() => setShowIncidentForm(!showIncidentForm)}
                                className="w-full py-2.5 rounded-lg border-2 border-dashed border-surface-300 text-surface-600 text-sm font-medium flex items-center justify-center gap-2"
                            >
                                <Plus className="w-4 h-4" />
                                Reportar Ocorrência
                            </button>

                            {showIncidentForm && (
                                <div className="bg-card rounded-xl p-4 space-y-3">
                                    <select
                                        value={incidentType}
                                        onChange={(e) => setIncidentType(e.target.value)}
                                        className="w-full px-3 py-2.5 rounded-lg bg-surface-100 border-0 text-sm focus:ring-2 focus:ring-brand-500/30 focus:outline-none"
                                    >
                                        {INCIDENT_TYPES.map((t) => (
                                            <option key={t} value={t}>{t}</option>
                                        ))}
                                    </select>
                                    <textarea
                                        value={incidentDesc}
                                        onChange={(e) => setIncidentDesc(e.target.value)}
                                        rows={3}
                                        placeholder="Descrição da ocorrência"
                                        className="w-full px-3 py-2.5 rounded-lg bg-surface-100 border-0 text-sm focus:ring-2 focus:ring-brand-500/30 focus:outline-none resize-none"
                                    />
                                    <button
                                        onClick={handleIncidentSubmit}
                                        disabled={incidentSubmitting}
                                        className="w-full py-2.5 rounded-lg bg-brand-600 text-white font-medium text-sm flex items-center justify-center gap-2"
                                    >
                                        {incidentSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <AlertTriangle className="w-4 h-4" />}
                                        Registrar
                                    </button>
                                </div>
                            )}

                            <div className="space-y-2">
                                {accidents.length === 0 ? (
                                    <p className="text-sm text-surface-500 text-center py-4">Nenhuma ocorrência registrada</p>
                                ) : (
                                    accidents.map((a) => {
                                        const typeMatch = a.description.match(/^\[([^\]]+)\]/)
                                        const type = typeMatch ? typeMatch[1] : 'Outro'
                                        const desc = typeMatch ? a.description.replace(/^\[[^\]]+\]\s*/, '') : a.description
                                        return (
                                            <div
                                                key={a.id}
                                                className="bg-card rounded-xl p-4"
                                            >
                                                <div className="flex items-start justify-between gap-2">
                                                    <span className="px-2 py-0.5 rounded text-xs font-medium bg-amber-100 dark:bg-amber-900/30 text-amber-700">
                                                        {type}
                                                    </span>
                                                    <span className="text-xs text-surface-500">{formatDate(a.occurrence_date)}</span>
                                                </div>
                                                <p className="text-sm text-surface-700 mt-2">{desc}</p>
                                            </div>
                                        )
                                    })
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
