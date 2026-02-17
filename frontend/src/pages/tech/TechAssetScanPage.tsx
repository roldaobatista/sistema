import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
    QrCode, Search, Tag, History, Calendar, Shield, CheckCircle2, XCircle,
    Loader2, ArrowLeft, Wrench, Scale,
} from 'lucide-react'
import { cn, getApiErrorMessage } from '@/lib/utils'
import api from '@/lib/api'
import { toast } from 'sonner'

interface Equipment {
    id: number
    name?: string
    code?: string
    type?: string | null
    model?: string | null
    brand?: string | null
    serial_number?: string | null
    customer?: { name: string } | null
    customer_name?: string | null
    status: string
    next_calibration_at?: string | null
}

interface AssetTag {
    id: number
    tag_code: string
    tag_type: string
    last_scanned_at?: string | null
}

interface Calibration {
    id: number
    calibration_date: string
    result: string
    certificate_number?: string | null
}

interface WorkOrder {
    id: number
    os_number?: string | null
    number?: string | null
    created_at: string
    status: string
    description?: string | null
}

const STATUS_COLORS: Record<string, string> = {
    active: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30',
    ativo: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30',
    inactive: 'bg-surface-200 text-surface-600',
    fora_de_uso: 'bg-surface-200 text-surface-600',
    calibration_due: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30',
    overdue: 'bg-red-100 text-red-700 dark:bg-red-900/30',
}

const TAG_TYPE_LABELS: Record<string, string> = {
    qrcode: 'QR',
    qr: 'QR',
    rfid: 'RFID',
    barcode: 'Código de Barras',
}

export default function TechAssetScanPage() {
    const navigate = useNavigate()
    const [searchParams] = useSearchParams()
    const codeFromUrl = searchParams.get('code') ?? ''
    const [codeInput, setCodeInput] = useState(codeFromUrl)
    const [loading, setLoading] = useState(false)
    const [equipment, setEquipment] = useState<Equipment | null>(null)
    const [tags, setTags] = useState<AssetTag[]>([])
    const [calibrations, setCalibrations] = useState<Calibration[]>([])
    const [workOrders, setWorkOrders] = useState<WorkOrder[]>([])
    const [selectedTagId, setSelectedTagId] = useState<number | null>(null)
    const [registeringScan, setRegisteringScan] = useState(false)

    useEffect(() => {
        if (codeFromUrl.trim()) {
            setCodeInput(codeFromUrl)
            setLoading(true)
            lookupEquipment(codeFromUrl.trim()).then(async (eq) => {
                if (eq) {
                    setEquipment(eq)
                    await fetchDetails(eq.id, codeFromUrl.trim())
                }
            }).finally(() => setLoading(false))
        }
    }, [codeFromUrl])

    async function fetchDetails(equipmentId: number, code: string) {
        try {
            const [tagRes, calRes, woRes] = await Promise.all([
                api.get('/asset-tags', { params: { equipment_id: equipmentId, per_page: 20 } }).catch(() => ({ data: {} })),
                api.get(`/equipments/${equipmentId}/calibrations`).catch(() => ({ data: {} })),
                api.get('/work-orders', { params: { equipment_id: equipmentId, per_page: 5 } }).catch(() => ({ data: {} })),
            ])
            const tagList = tagRes.data?.data ?? tagRes.data ?? []
            const tagItems = Array.isArray(tagList) ? tagList : tagList?.data ?? []
            let finalTags = tagItems
            if (tagItems.length === 0) {
                const fallback = await api.get('/asset-tags', { params: { search: code, per_page: 20 } }).catch(() => ({ data: {} }))
                const raw = fallback.data?.data ?? fallback.data ?? []
                const items = Array.isArray(raw) ? raw : raw?.data ?? []
                finalTags = items.filter((t: any) => t.taggable_type?.includes('Equipment') && t.taggable_id === equipmentId)
            }
            setTags(finalTags)
            if (finalTags.length) setSelectedTagId(finalTags[0]?.id ?? null)
            setCalibrations(Array.isArray(calRes.data?.calibrations ?? calRes.data) ? (calRes.data?.calibrations ?? calRes.data).slice(0, 5) : [])
            setWorkOrders(Array.isArray(woRes.data?.data ?? woRes.data) ? (woRes.data?.data ?? woRes.data).slice(0, 5) : [])
        } catch {
            // ignore
        }
    }

    async function lookupEquipment(code: string): Promise<Equipment | null> {
        const trimmed = code.trim()
        if (!trimmed) return null

        try {
            const res = await api.get('/mobile/barcode/lookup', { params: { code: trimmed } })
            const data = res.data?.data ?? res.data
            if (data?.id && (data?.code !== undefined || data?.next_calibration_at !== undefined || data?.tag !== undefined)) {
                return data as Equipment
            }
        } catch {
            // 404 or product - try equipments and asset-tags
        }

        try {
            const { data: eqRes } = await api.get('/equipments', {
                params: { search: trimmed, per_page: 5 },
            })
            const list = eqRes?.data ?? eqRes ?? []
            const match = Array.isArray(list) ? list.find((e: any) =>
                String(e.code || '').toLowerCase() === trimmed.toLowerCase() ||
                String(e.serial_number || '').toLowerCase() === trimmed.toLowerCase() ||
                String(e.tag || '').toLowerCase() === trimmed.toLowerCase()
            ) ?? list[0] : null
            if (match) return match as Equipment
        } catch {
            // ignore
        }

        try {
            const { data: tagRes } = await api.get('/asset-tags', {
                params: { search: trimmed, per_page: 10 },
            })
            const tagList = tagRes?.data ?? tagRes ?? []
            const items = Array.isArray(tagList) ? tagList : tagList?.data ?? []
            const tag = items.find((t: any) =>
                String(t.tag_code || '').toLowerCase() === trimmed.toLowerCase()
            )
            if (tag?.taggable_type?.includes('Equipment') && tag?.taggable_id) {
                const { data: eqData } = await api.get(`/equipments/${tag.taggable_id}`)
                const eq = eqData?.equipment ?? eqData?.data ?? eqData
                if (eq?.id) return eq as Equipment
            }
        } catch {
            // ignore
        }

        return null
    }

    async function handleSearch() {
        const code = codeInput.trim()
        if (!code) {
            toast.error('Digite ou escaneie um código')
            return
        }

        setLoading(true)
        setEquipment(null)
        setTags([])
        setCalibrations([])
        setWorkOrders([])
        setSelectedTagId(null)

        try {
            const eq = await lookupEquipment(code)
            if (!eq) {
                toast.error('Equipamento não encontrado para este código')
                return
            }

            setEquipment(eq)
            await fetchDetails(eq.id, code)
        } catch (err: unknown) {
            toast.error(getApiErrorMessage(err, 'Erro ao buscar equipamento'))
        } finally {
            setLoading(false)
        }
    }

    async function handleRegisterScan() {
        if (!selectedTagId) {
            toast.error('Selecione uma tag para registrar o scan')
            return
        }

        setRegisteringScan(true)
        try {
            await api.post(`/asset-tags/${selectedTagId}/scan`, { action: 'scan' })
            toast.success('Scan registrado com sucesso')
            handleSearch()
        } catch (err: unknown) {
            toast.error(getApiErrorMessage(err, 'Erro ao registrar scan'))
        } finally {
            setRegisteringScan(false)
        }
    }

    function getStatusColor(status: string): string {
        return STATUS_COLORS[status] ?? STATUS_COLORS.inactive
    }

    function getCalibrationUrgency(): { color: string; label: string } {
        if (!equipment?.next_calibration_at) return { color: 'text-surface-500', label: 'N/A' }
        const due = new Date(equipment.next_calibration_at)
        const today = new Date()
        today.setHours(0, 0, 0, 0)
        due.setHours(0, 0, 0, 0)
        const days = Math.ceil((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))

        if (days < 0) return { color: 'text-red-600 dark:text-red-400', label: 'Vencido' }
        if (days <= 30) return { color: 'text-amber-600 dark:text-amber-400', label: `${days} dias` }
        return { color: 'text-emerald-600 dark:text-emerald-400', label: `${days} dias` }
    }

    return (
        <div className="flex flex-col h-full">
            <div className="bg-card px-4 pt-3 pb-4 border-b border-border">
                <button
                    onClick={() => navigate('/tech')}
                    className="flex items-center gap-1 text-sm text-brand-600 mb-2"
                >
                    <ArrowLeft className="w-4 h-4" /> Voltar
                </button>
                <h1 className="text-lg font-bold text-foreground">
                    Scan de Ativos
                </h1>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
                {/* Scan section */}
                <div className="bg-card rounded-xl p-4 space-y-3">
                    <button
                        onClick={() => navigate('/tech/barcode')}
                        className="w-full flex items-center justify-center gap-3 py-4 rounded-xl bg-brand-600 text-white font-medium active:scale-[0.98] transition-transform"
                    >
                        <QrCode className="w-6 h-6" />
                        Escanear QR/Código
                    </button>
                    <div className="flex gap-2">
                        <input
                            type="text"
                            value={codeInput}
                            onChange={(e) => setCodeInput(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                            placeholder="Ou digite tag/código"
                            className="flex-1 px-3 py-2 rounded-lg bg-surface-50 border border-border text-sm text-foreground focus:ring-2 focus:ring-brand-500/30 focus:outline-none"
                        />
                        <button
                            onClick={handleSearch}
                            disabled={loading}
                            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-brand-600 text-white text-sm font-medium disabled:opacity-60"
                        >
                            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                            Buscar
                        </button>
                    </div>
                </div>

                {loading && (
                    <div className="flex justify-center py-8">
                        <Loader2 className="w-8 h-8 animate-spin text-brand-500" />
                    </div>
                )}

                {!loading && equipment && (
                    <>
                        {/* Equipment info card */}
                        <div className="bg-card rounded-xl p-4 space-y-3">
                            <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
                                <Scale className="w-4 h-4" />
                                Equipamento
                            </h2>
                            <div className="space-y-2">
                                <p className="text-base font-medium text-foreground">
                                    {equipment.name || equipment.code || equipment.type || `Equipamento ${equipment.id}`}
                                </p>
                                <div className="grid grid-cols-2 gap-2 text-xs">
                                    <div><span className="text-surface-500">Modelo:</span> {equipment.model || '—'}</div>
                                    <div><span className="text-surface-500">Marca:</span> {equipment.brand || '—'}</div>
                                    <div><span className="text-surface-500">Nº Série:</span> {equipment.serial_number || '—'}</div>
                                    <div><span className="text-surface-500">Cliente:</span> {equipment.customer?.name || equipment.customer_name || '—'}</div>
                                </div>
                                <span className={cn('inline-flex px-2 py-0.5 rounded-full text-xs font-medium', getStatusColor(equipment.status))}>
                                    {['active', 'ativo'].includes(equipment.status) ? 'Ativo' : ['inactive', 'fora_de_uso'].includes(equipment.status) ? 'Inativo' : equipment.status}
                                </span>
                            </div>
                        </div>

                        {/* Tags card */}
                        {tags.length > 0 && (
                            <div className="bg-card rounded-xl p-4 space-y-3">
                                <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
                                    <Tag className="w-4 h-4" />
                                    Tags
                                </h2>
                                <div className="space-y-2">
                                    {tags.map((tag) => (
                                        <div
                                            key={tag.id}
                                            onClick={() => setSelectedTagId(tag.id)}
                                            className={cn(
                                                'flex items-center justify-between p-2 rounded-lg border cursor-pointer transition-colors',
                                                selectedTagId === tag.id
                                                    ? 'border-brand-500 bg-brand-50'
                                                    : 'border-border'
                                            )}
                                        >
                                            <div>
                                                <p className="text-sm font-medium text-foreground">{tag.tag_code}</p>
                                                <p className="text-xs text-surface-500">
                                                    {TAG_TYPE_LABELS[tag.tag_type] || tag.tag_type} • Último scan:{' '}
                                                    {tag.last_scanned_at
                                                        ? new Date(tag.last_scanned_at).toLocaleDateString('pt-BR')
                                                        : '—'}
                                                </p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Calibration history */}
                        <div className="bg-card rounded-xl p-4 space-y-3">
                            <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
                                <History className="w-4 h-4" />
                                Histórico de Calibração (últimas 5)
                            </h2>
                            {calibrations.length === 0 ? (
                                <p className="text-xs text-surface-500">Nenhuma calibração registrada</p>
                            ) : (
                                <div className="space-y-2">
                                    {calibrations.map((cal) => {
                                        const isPass = cal.result === 'aprovado' || cal.result === 'aprovado_com_ressalva'
                                        return (
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
                                                    'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium',
                                                    isPass ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30' : 'bg-red-100 text-red-700 dark:bg-red-900/30'
                                                )}>
                                                    {isPass ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                                                    {isPass ? 'Aprovado' : 'Reprovado'}
                                                </span>
                                            </div>
                                        )
                                    })}
                                </div>
                            )}
                        </div>

                        {/* Maintenance history */}
                        <div className="bg-card rounded-xl p-4 space-y-3">
                            <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
                                <Wrench className="w-4 h-4" />
                                Histórico de Manutenção (últimas 5)
                            </h2>
                            {workOrders.length === 0 ? (
                                <p className="text-xs text-surface-500">Nenhuma OS neste equipamento</p>
                            ) : (
                                <div className="space-y-2">
                                    {workOrders.map((wo) => (
                                        <div key={wo.id} className="flex items-center justify-between py-1.5 border-b border-surface-100 last:border-0">
                                            <div>
                                                <p className="text-sm font-medium text-foreground">
                                                    OS {wo.os_number || wo.number || wo.id}
                                                </p>
                                                <p className="text-xs text-surface-500">
                                                    {new Date(wo.created_at).toLocaleDateString('pt-BR')} • {wo.description || wo.status || '—'}
                                                </p>
                                            </div>
                                            <span className="text-xs text-surface-500">{wo.status}</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Next calibration alert */}
                        {equipment.next_calibration_at && (
                            <div className="bg-card rounded-xl p-4 space-y-2">
                                <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
                                    <Calendar className="w-4 h-4" />
                                    Próxima Calibração
                                </h2>
                                <div className="flex items-center justify-between">
                                    <span className="text-sm text-surface-600">
                                        {new Date(equipment.next_calibration_at).toLocaleDateString('pt-BR')}
                                    </span>
                                    <span className={cn('font-medium', getCalibrationUrgency().color)}>
                                        {getCalibrationUrgency().label}
                                    </span>
                                </div>
                            </div>
                        )}

                        {/* Register scan button */}
                        {tags.length > 0 && (
                            <button
                                onClick={handleRegisterScan}
                                disabled={registeringScan || !selectedTagId}
                                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-brand-600 text-white font-medium active:scale-[0.98] disabled:opacity-60"
                            >
                                {registeringScan ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                    <Shield className="w-4 h-4" />
                                )}
                                Registrar Scan
                            </button>
                        )}
                    </>
                )}

                {!loading && !equipment && (
                    <div className="flex flex-col items-center justify-center py-12 gap-2">
                        <QrCode className="w-12 h-12 text-surface-300" />
                        <p className="text-sm text-surface-500 text-center">
                            {codeInput.trim() ? 'Nenhum equipamento encontrado. Tente outro código.' : 'Digite ou escaneie um código para buscar o equipamento.'}
                        </p>
                    </div>
                )}
            </div>
        </div>
    )
}
