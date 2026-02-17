import { useEffect, useState, useCallback , useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
    ArrowLeft, MapPin, Phone, Clock, User, AlertTriangle,
    ClipboardList, Camera, Receipt, PenTool, PlayCircle,
    CheckCircle2, Loader2, ChevronRight, WifiOff, ShieldCheck,
    Navigation, FileText, Send, Mic, Printer, ImagePlus,
    FlaskConical, Award, Flag, FileCheck, X, Star, MessageCircle,
    Car, Coffee, MapPinned,
} from 'lucide-react'
import { useOfflineStore } from '@/hooks/useOfflineStore'
import { useDisplacementTracking } from '@/hooks/useDisplacementTracking'
import { useTechTimerStore } from '@/stores/tech-timer-store'
import { cn } from '@/lib/utils'
import { offlinePost } from '@/lib/syncEngine'
import api from '@/lib/api'
import { useToast } from '@/components/ui/use-toast'
import SLACountdown from '@/components/common/SLACountdown'
import TechChatDrawer from '@/components/tech/TechChatDrawer'
import type { OfflineWorkOrder } from '@/lib/offlineDb'

const STATUS_MAP: Record<string, { label: string; color: string; next?: string; nextLabel?: string }> = {
    pending: { label: 'Pendente', color: 'bg-amber-500', next: 'in_progress', nextLabel: 'Iniciar Atendimento' },
    in_progress: { label: 'Em Andamento', color: 'bg-blue-500', next: 'completed', nextLabel: 'Concluir OS' },
    completed: { label: 'Concluída', color: 'bg-emerald-500' },
    cancelled: { label: 'Cancelada', color: 'bg-red-500' },
}

const ACTION_CARDS = [
    { key: 'checklist', label: 'Checklists', icon: ClipboardList, color: 'text-violet-600 bg-violet-100 dark:bg-violet-900/30 dark:text-violet-400' },
    { key: 'photos', label: 'Fotos', icon: Camera, color: 'text-sky-600 bg-sky-100 dark:bg-sky-900/30 dark:text-sky-400' },
    { key: 'seals', label: 'Selos', icon: ShieldCheck, color: 'text-emerald-600 bg-emerald-100 dark:bg-emerald-900/30 dark:text-emerald-400' },
    { key: 'calibration', label: 'Leituras Calibração', icon: FlaskConical, color: 'text-teal-600 bg-teal-100 dark:bg-teal-900/30 dark:text-teal-400' },
    { key: 'certificado', label: 'Certificado', icon: Award, color: 'text-orange-600 bg-orange-100 dark:bg-orange-900/30 dark:text-orange-400' },
    { key: 'expenses', label: 'Despesas', icon: Receipt, color: 'text-amber-600 bg-amber-100 dark:bg-amber-900/30 dark:text-amber-400' },
    { key: 'signature', label: 'Assinatura', icon: PenTool, color: 'text-emerald-600 bg-emerald-100 dark:bg-emerald-900/30 dark:text-emerald-400' },
    { key: 'chat', label: 'Chat Interno', icon: Send, color: 'text-indigo-600 bg-indigo-100 dark:bg-indigo-900/30 dark:text-indigo-400' },
    { key: 'voice-report', label: 'Relatório Voz', icon: Mic, color: 'text-rose-600 bg-rose-100 dark:bg-rose-900/30 dark:text-rose-400' },
    { key: 'annotate', label: 'Anotar Foto', icon: ImagePlus, color: 'text-cyan-600 bg-cyan-100 dark:bg-cyan-900/30 dark:text-cyan-400' },
    { key: 'print', label: 'Impressão BT', icon: Printer, color: 'text-surface-600 bg-surface-100' },
    { key: 'ocorrencia', label: 'Ocorrência', icon: Flag, color: 'text-amber-600 bg-amber-100 dark:bg-amber-900/30 dark:text-amber-400' },
    { key: 'contrato', label: 'Contrato', icon: FileCheck, color: 'text-blue-600 bg-blue-100 dark:bg-blue-900/30 dark:text-blue-400' },
    { key: 'nps', label: 'Avaliação NPS', icon: Star, color: 'text-yellow-600 bg-yellow-100 dark:bg-yellow-900/30 dark:text-yellow-400' },
];

export default function TechWorkOrderDetailPage() {
    const { id } = useParams<{ id: string }>()
    const timer = useTechTimerStore()
    const navigate = useNavigate()
    const { toast } = useToast()
    const { getById, put } = useOfflineStore('work-orders')
    const [wo, setWo] = useState<OfflineWorkOrder | null>(null)
    const [loading, setLoading] = useState(true)
    const [transitioning, setTransitioning] = useState(false)
    const [updatingLocation, setUpdatingLocation] = useState(false)
    const [isChatOpen, setIsChatOpen] = useState(false)
    const [showCompletionWizard, setShowCompletionWizard] = useState(false)
    const [completionSteps, setCompletionSteps] = useState({
        photos: false,
        checklist: false,
        signature: false,
        nps: false,
    })
    const [quickNote, setQuickNote] = useState('')
    const [sendingNote, setSendingNote] = useState(false)
    const [notes, setNotes] = useState<{ content?: string; message?: string; body?: string; created_at?: string }[]>([])
    const [displacementLoading, setDisplacementLoading] = useState(false)
    const [showStopModal, setShowStopModal] = useState(false)
    const [stopNotes, setStopNotes] = useState('')

    const displacementActive = wo?.displacement_status === 'in_progress'
    const openStop = wo?.displacement_stops?.find((s) => !s.ended_at)
    useDisplacementTracking(wo?.id, !!displacementActive && !openStop)


    useEffect(() => {
        if (!id) return
        getById(Number(id)).then((data) => {
            setWo(data ?? null)
            setLoading(false)
        })
    }, [id]) // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
        if (!id) return
        api.get(`/work-orders/${id}/chats`).then(res => {
            setNotes(res.data?.data || res.data || [])
        }).catch(() => {})
    }, [id])

    const handleSendNote = async () => {
        if (!quickNote.trim() || !wo) return
        setSendingNote(true)
        try {
            await api.post(`/work-orders/${wo.id}/chats`, { message: quickNote.trim() })
            setNotes(prev => [...prev, { content: quickNote.trim(), created_at: new Date().toISOString() }])
            setQuickNote('')
            toast({ title: 'Nota adicionada' })
        } catch {
            toast({ title: 'Erro', description: 'Falha ao enviar nota', variant: 'destructive' })
        } finally {
            setSendingNote(false)
        }
    }

    const handleUpdateLocation = async () => {
        if (!wo?.customer_id) return
        setUpdatingLocation(true)

        if (!navigator.geolocation) {
            toast({
                title: "Erro",
                description: "Geolocalização não suportada pelo navegador.",
                variant: "destructive"
            })
            setUpdatingLocation(false)
            return
        }

        navigator.geolocation.getCurrentPosition(
            async (position) => {
                try {
                    await api.post(`/technicians/customers/${wo.customer_id}/geolocation`, {
                        latitude: position.coords.latitude,
                        longitude: position.coords.longitude
                    })

                    toast({
                        title: "Sucesso",
                        description: "Localização do cliente atualizada!",
                        className: "bg-green-600 text-white border-none"
                    })
                } catch {
                    toast({
                        title: "Erro",
                        description: "Falha ao enviar localização. Verifique sua conexão.",
                        variant: "destructive"
                    })
                } finally {
                    setUpdatingLocation(false)
                }
            },
            (error) => {
                let msg = "Não foi possível obter sua localização."
                if (error.code === 1) msg = "Permissão de localização negada."
                if (error.code === 2) msg = "Sinal de GPS indisponível."
                if (error.code === 3) msg = "Tempo limite excedido ao buscar GPS."

                toast({
                    title: "Erro de GPS",
                    description: msg,
                    variant: "destructive"
                })
                setUpdatingLocation(false)
            },
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
        )
    }

    const handleCompleteOS = useCallback(async () => {
        if (!wo) return
        const status = STATUS_MAP[wo.status]
        if (status?.next !== 'completed') return

        setTransitioning(true)
        try {
            const updated = { ...wo, status: 'completed' as const, updated_at: new Date().toISOString() }
            await put(updated as OfflineWorkOrder)
            setWo(updated as OfflineWorkOrder)
            setShowCompletionWizard(false)

            await offlinePost(`/tech/sync/batch`, {
                mutations: [{
                    type: 'status_change',
                    data: {
                        work_order_id: wo.id,
                        status: 'completed',
                        updated_at: updated.updated_at,
                    },
                }],
            })
        } catch {
            // Will retry via sync
        } finally {
            setTransitioning(false)
        }
    }, [wo, put])

    const handleStartDisplacement = async () => {
        if (!wo || !navigator.geolocation) {
            toast({ title: 'Erro', description: 'Geolocalização não suportada.', variant: 'destructive' })
            return
        }
        setDisplacementLoading(true)
        navigator.geolocation.getCurrentPosition(
            async (pos) => {
                try {
                    if (navigator.onLine) {
                        await api.post(`/work-orders/${wo.id}/displacement/start`, {
                            latitude: pos.coords.latitude,
                            longitude: pos.coords.longitude,
                        })
                    } else {
                        await offlinePost(`/tech/sync/batch`, {
                            mutations: [{
                                type: 'displacement_start',
                                data: {
                                    work_order_id: wo.id,
                                    latitude: pos.coords.latitude,
                                    longitude: pos.coords.longitude,
                                },
                            }],
                        })
                    }
                    const updated = {
                        ...wo,
                        displacement_started_at: new Date().toISOString(),
                        displacement_status: 'in_progress' as const,
                        displacement_stops: wo.displacement_stops ?? [],
                        updated_at: new Date().toISOString(),
                    }
                    await put(updated as OfflineWorkOrder)
                    setWo(updated as OfflineWorkOrder)
                    toast({ title: 'Deslocamento iniciado' })
                    getById(wo.id).then((d) => d && setWo(d as OfflineWorkOrder))
                } catch (e: any) {
                    toast({ title: 'Erro', description: e?.response?.data?.message || 'Falha ao iniciar deslocamento', variant: 'destructive' })
                } finally {
                    setDisplacementLoading(false)
                }
            },
            () => {
                toast({ title: 'Erro', description: 'Não foi possível obter sua localização.', variant: 'destructive' })
                setDisplacementLoading(false)
            },
            { enableHighAccuracy: true, timeout: 10000 }
        )
    }

    const handleArriveDisplacement = async () => {
        if (!wo) return
        setDisplacementLoading(true)
        const sendArrive = async (lat?: number, lng?: number) => {
            try {
                if (navigator.onLine) {
                    await api.post(`/work-orders/${wo.id}/displacement/arrive`, lat != null && lng != null ? { latitude: lat, longitude: lng } : {})
                } else {
                    await offlinePost(`/tech/sync/batch`, {
                        mutations: [{
                            type: 'displacement_arrive',
                            data: {
                                work_order_id: wo.id,
                                ...(lat != null && lng != null && { latitude: lat, longitude: lng }),
                            },
                        }],
                    })
                }
                const res = navigator.onLine ? await api.get(`/work-orders/${wo.id}/displacement`) : null
                const data = res?.data
                const updated = {
                    ...wo,
                    displacement_arrived_at: data?.displacement_arrived_at ?? new Date().toISOString(),
                    displacement_duration_minutes: data?.displacement_duration_minutes ?? wo.displacement_duration_minutes,
                    displacement_status: 'arrived' as const,
                    updated_at: new Date().toISOString(),
                }
                await put(updated as OfflineWorkOrder)
                setWo(updated as OfflineWorkOrder)
                toast({ title: 'Chegada registrada' })
                getById(wo.id).then((d) => d && setWo(d as OfflineWorkOrder))
            } catch (e: any) {
                toast({ title: 'Erro', description: e?.response?.data?.message || 'Falha ao registrar chegada', variant: 'destructive' })
            } finally {
                setDisplacementLoading(false)
            }
        }
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (pos) => sendArrive(pos.coords.latitude, pos.coords.longitude),
                () => sendArrive(),
                { enableHighAccuracy: true, timeout: 10000 }
            )
        } else {
            sendArrive()
        }
    }

    const handleAddStop = async (type: string) => {
        if (!wo) return
        setDisplacementLoading(true)
        setShowStopModal(false)
        const getPos = (): Promise<{ lat: number; lng: number } | null> =>
            new Promise((resolve) => {
                if (!navigator.geolocation) {
                    resolve(null)
                    return
                }
                navigator.geolocation.getCurrentPosition(
                    (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
                    () => resolve(null),
                    { enableHighAccuracy: true, timeout: 8000 }
                )
            })
        const pos = await getPos()
        try {
            let createdStop: { id: number; type: string; started_at: string } | null = null
            if (navigator.onLine) {
                const res = await api.post(`/work-orders/${wo.id}/displacement/stops`, {
                    type,
                    notes: stopNotes || undefined,
                    ...(pos && { latitude: pos.lat, longitude: pos.lng }),
                })
                createdStop = res.data?.stop ?? null
            } else {
                await offlinePost(`/tech/sync/batch`, {
                    mutations: [{
                        type: 'displacement_stop',
                        data: {
                            work_order_id: wo.id,
                            type,
                            started_at: new Date().toISOString(),
                            notes: stopNotes || undefined,
                            ...(pos && { latitude: pos.lat, longitude: pos.lng }),
                        },
                    }],
                })
            }
            setStopNotes('')
            toast({ title: 'Parada registrada' })
            const optimisticStop = createdStop
                ? { id: createdStop.id, type: createdStop.type, started_at: createdStop.started_at, ended_at: null as string | null }
                : { id: ('temp-' + Date.now()) as any, type, started_at: new Date().toISOString(), ended_at: null as string | null }
            const updated = {
                ...wo,
                displacement_stops: [...(wo.displacement_stops ?? []), optimisticStop],
                updated_at: new Date().toISOString(),
            }
            await put(updated as OfflineWorkOrder)
            setWo(updated as OfflineWorkOrder)
            getById(wo.id).then((d) => d && setWo(d as OfflineWorkOrder))
        } catch (e: any) {
            toast({ title: 'Erro', description: e?.response?.data?.message || 'Falha ao registrar parada', variant: 'destructive' })
        } finally {
            setDisplacementLoading(false)
        }
    }

    const handleEndStop = async () => {
        if (!wo || !openStop) return
        setDisplacementLoading(true)
        try {
            if (navigator.onLine) {
                await api.patch(`/work-orders/${wo.id}/displacement/stops/${openStop.id}`, {})
            } else {
                await offlinePost(`/tech/sync/batch`, {
                    mutations: [{
                        type: 'displacement_stop',
                        data: {
                            work_order_id: wo.id,
                            ended_at: new Date().toISOString(),
                            ...(typeof openStop.id === 'number' ? { stop_id: openStop.id } : { end_latest: true }),
                        },
                    }],
                })
            }
            toast({ title: 'Parada encerrada' })
            const openIdx = wo.displacement_stops?.findIndex((s) => !s.ended_at && (typeof openStop.id === 'number' ? s.id === openStop.id : true)) ?? -1
            const updatedStops = [...(wo.displacement_stops ?? [])]
            if (openIdx !== undefined && openIdx >= 0) {
                updatedStops[openIdx] = { ...updatedStops[openIdx], ended_at: new Date().toISOString() }
            }
            const updatedWo = { ...wo, displacement_stops: updatedStops, updated_at: new Date().toISOString() }
            await put(updatedWo as OfflineWorkOrder)
            setWo(updatedWo as OfflineWorkOrder)
            getById(wo.id).then((d) => d && setWo(d as OfflineWorkOrder))
        } catch (e: any) {
            toast({ title: 'Erro', description: e?.response?.data?.message || 'Falha ao encerrar parada', variant: 'destructive' })
        } finally {
            setDisplacementLoading(false)
        }
    }

    const handleStatusTransition = useCallback(async () => {
        if (!wo) return
        const status = STATUS_MAP[wo.status]
        if (!status?.next) return

        if (status.next === 'completed') {
            setShowCompletionWizard(true)
            return
        }

        setTransitioning(true)
        try {
            const updated = { ...wo, status: status.next, updated_at: new Date().toISOString() }
            await put(updated as OfflineWorkOrder)
            setWo(updated as OfflineWorkOrder)

            await offlinePost(`/tech/sync/batch`, {
                mutations: [{
                    type: 'status_change',
                    data: {
                        work_order_id: wo.id,
                        status: status.next,
                        updated_at: updated.updated_at,
                    },
                }],
            })
        } catch {
            // Will retry via sync
        } finally {
            setTransitioning(false)
        }
    }, [wo, put])

    if (loading) {
        return (
            <div className="flex items-center justify-center h-full">
                <Loader2 className="w-8 h-8 animate-spin text-brand-500" />
            </div>
        )
    }

    if (!wo) {
        return (
            <div className="flex flex-col items-center justify-center h-full gap-3 p-6">
                <AlertTriangle className="w-12 h-12 text-amber-400" />
                <p className="text-sm text-surface-500">OS não encontrada localmente</p>
                <button onClick={() => navigate('/tech')} className="text-sm text-brand-600 font-medium">
                    Voltar
                </button>
            </div>
        )
    }

    const currentStatus = STATUS_MAP[wo.status] || STATUS_MAP.pending

    return (
        <div className="relative flex flex-col h-full">
            {/* Header */}
            <div className="bg-card px-4 pt-3 pb-4 border-b border-border">
                <button onClick={() => navigate('/tech')} className="flex items-center gap-1 text-sm text-brand-600 mb-3">
                    <ArrowLeft className="w-4 h-4" /> Voltar
                </button>

                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-lg font-bold text-foreground">
                            {wo.os_number || wo.number}
                        </h1>
                        <span className={cn(
                            'inline-flex items-center gap-1 mt-1 px-2.5 py-0.5 rounded-full text-xs font-medium text-white',
                            currentStatus.color,
                        )}>
                            {currentStatus.label}
                        </span>
                        <div className="mt-2">
                            <SLACountdown dueAt={wo.sla_due_at ?? null} status={wo.status} />
                        </div>
                    </div>
                    {!navigator.onLine && (
                        <WifiOff className="w-4 h-4 text-amber-500" />
                    )}
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
                {/* Customer info */}
                <div className="bg-card rounded-2xl shadow-sm border border-surface-100 overflow-hidden">
                    <div className="p-4 space-y-4">
                        <div className="flex items-center justify-between">
                            <h3 className="text-[10px] font-bold text-surface-400 uppercase tracking-[0.1em]">Informações do Cliente</h3>
                            <div className="flex items-center gap-1">
                                {wo.customer_phone && (
                                    <>
                                        <a
                                            href={`tel:${wo.customer_phone}`}
                                            title="Ligar para o cliente"
                                            className="p-2 rounded-full bg-emerald-50 text-emerald-600 dark:text-emerald-400 active:scale-95 transition-all"
                                        >
                                            <Phone className="w-4 h-4" />
                                        </a>
                                        <a
                                            href={`https://wa.me/${wo.customer_phone.replace(/\D/g, '')}?text=${encodeURIComponent(`Olá! Informo que a OS ${wo.os_number || wo.number} está com status: ${currentStatus.label}. Equipe Kalibrium.`)}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="p-2 rounded-full bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 active:scale-95 transition-all"
                                            title="Enviar WhatsApp"
                                        >
                                            <MessageCircle className="w-4 h-4" />
                                        </a>
                                    </>
                                )}
                            </div>
                        </div>

                        <div className="flex items-start gap-4">
                            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-brand-500 to-brand-600 flex items-center justify-center flex-shrink-0 shadow-lg shadow-brand-500/20">
                                <User className="w-6 h-6 text-white" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="font-bold text-base text-foreground truncate">
                                    {wo.customer_name || 'Não informado'}
                                </p>
                                {wo.customer_address && (
                                    <p className="text-xs text-surface-500 mt-0.5 line-clamp-2 leading-relaxed">
                                        {wo.customer_address}
                                        {wo.city && `, ${wo.city}`}
                                    </p>
                                )}
                            </div>
                        </div>

                        {/* Botões de Ação Ergonômicos */}
                        <div className="grid grid-cols-2 gap-2 pt-2">
                            {wo.google_maps_link && (
                                <a
                                    href={wo.google_maps_link}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center justify-center gap-2 py-3 rounded-xl bg-surface-50 border border-border text-[11px] font-bold text-surface-700 active:scale-95 transition-all shadow-sm"
                                >
                                    <MapPin className="w-3.5 h-3.5 text-red-500" /> Google Maps
                                </a>
                            )}
                            {wo.waze_link && (
                                <a
                                    href={wo.waze_link}
                                    className="flex items-center justify-center gap-2 py-3 rounded-xl bg-surface-50 border border-border text-[11px] font-bold text-surface-700 active:scale-95 transition-all shadow-sm"
                                >
                                    <Navigation className="w-3.5 h-3.5 text-[#33ccff]" /> Waze
                                </a>
                            )}
                        </div>

                        {/* Deslocamento */}
                        <div className="space-y-2 pt-2 border-t border-surface-100">
                            {wo.displacement_status === 'not_started' || !wo.displacement_status ? (
                                <button
                                    onClick={handleStartDisplacement}
                                    disabled={displacementLoading}
                                    className="flex items-center justify-center gap-2 py-3 px-4 w-full rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-bold shadow-md active:scale-[0.98] transition-all disabled:opacity-50"
                                >
                                    {displacementLoading ? (
                                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                    ) : (
                                        <Car className="w-3.5 h-3.5" />
                                    )}
                                    Iniciar deslocamento
                                </button>
                            ) : wo.displacement_status === 'in_progress' ? (
                                <>
                                    <div className="flex items-center gap-2 py-2 px-3 rounded-lg bg-blue-50 border border-blue-200 dark:border-blue-800">
                                        <MapPinned className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                                        <span className="text-xs font-medium text-blue-800 dark:text-blue-200">Em deslocamento</span>
                                    </div>
                                    <div className="grid grid-cols-2 gap-2">
                                        {openStop ? (
                                            <button
                                                onClick={handleEndStop}
                                                disabled={displacementLoading}
                                                className="flex items-center justify-center gap-2 py-3 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-[11px] font-bold active:scale-[0.98] disabled:opacity-50"
                                            >
                                                {displacementLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Coffee className="w-3.5 h-3.5" />}
                                                Encerrar parada
                                            </button>
                                        ) : (
                                            <button
                                                onClick={() => setShowStopModal(true)}
                                                disabled={displacementLoading}
                                                className="flex items-center justify-center gap-2 py-3 rounded-xl bg-surface-100 text-surface-700 text-[11px] font-bold active:scale-[0.98] disabled:opacity-50"
                                            >
                                                <Coffee className="w-3.5 h-3.5" /> Registrar parada
                                            </button>
                                        )}
                                        <button
                                            onClick={handleArriveDisplacement}
                                            disabled={displacementLoading}
                                            className="flex items-center justify-center gap-2 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold active:scale-[0.98] disabled:opacity-50"
                                        >
                                            {displacementLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <MapPin className="w-3.5 h-3.5" />}
                                            Cheguei ao cliente
                                        </button>
                                    </div>
                                </>
                            ) : wo.displacement_status === 'arrived' ? (
                                <div className="py-2 px-3 rounded-lg bg-emerald-50 border border-emerald-200 dark:border-emerald-800 space-y-1">
                                    <p className="text-xs font-medium text-emerald-800 dark:text-emerald-200">
                                        Chegou às {wo.displacement_arrived_at ? new Date(wo.displacement_arrived_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '—'}
                                    </p>
                                    {wo.displacement_duration_minutes != null && (
                                        <p className="text-[11px] text-emerald-600 dark:text-emerald-400">
                                            Tempo em deslocamento: {wo.displacement_duration_minutes} min
                                        </p>
                                    )}
                                </div>
                            ) : null}
                        </div>

                        <button
                            onClick={handleUpdateLocation}
                            disabled={updatingLocation}
                            className="flex items-center gap-2 py-3 px-4 w-full rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-[11px] font-bold shadow-md shadow-brand-500/10 active:scale-[0.98] transition-all disabled:opacity-50"
                        >
                            {updatingLocation ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                                <MapPin className="w-3.5 h-3.5" />
                            )}
                            {updatingLocation ? 'Sincronizando GPS...' : 'Confirmar Chegada ao Local (GPS)'}
                        </button>
                    </div>
                </div>

                {/* Schedule */}
                {wo.scheduled_date && (
                    <div className="flex items-center gap-2 bg-card rounded-xl p-4">
                        <Clock className="w-5 h-5 text-surface-400" />
                        <div>
                            <p className="text-xs text-surface-400">Agendamento</p>
                            <p className="text-sm font-medium text-foreground">
                                {new Date(wo.scheduled_date).toLocaleString('pt-BR', {
                                    day: '2-digit', month: '2-digit', year: 'numeric',
                                    hour: '2-digit', minute: '2-digit',
                                })}
                            </p>
                        </div>
                    </div>
                )}

                {/* Timer */}
                {wo.status === 'in_progress' && (
                    <div className="bg-card rounded-xl p-4">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Clock className="w-5 h-5 text-brand-500" />
                                <div>
                                    <p className="text-sm font-medium text-foreground">Cronômetro</p>
                                    <p className="text-xs text-surface-500">Registre o tempo nesta OS</p>
                                </div>
                            </div>
                            {timer.workOrderId === wo.id ? (
                                <button
                                    onClick={() => timer.isRunning ? timer.pause() : timer.resume()}
                                    className={cn(
                                        'px-3 py-1.5 rounded-lg text-xs font-medium',
                                        timer.isRunning
                                            ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30'
                                            : 'bg-brand-100 text-brand-700'
                                    )}
                                >
                                    {timer.isRunning ? 'Pausar' : 'Continuar'}
                                </button>
                            ) : (
                                <button
                                    onClick={() => timer.start(wo.id, wo.os_number || wo.number || String(wo.id))}
                                    className="px-3 py-1.5 rounded-lg bg-brand-600 text-white text-xs font-medium active:bg-brand-700"
                                >
                                    Iniciar Timer
                                </button>
                            )}
                        </div>
                    </div>
                )}

                {/* Description */}
                {wo.description && (
                    <div className="bg-card rounded-xl p-4">
                        <h3 className="text-xs font-semibold text-surface-400 uppercase tracking-wide mb-2">Descrição</h3>
                        <p className="text-sm text-surface-700 leading-relaxed">
                            {wo.description}
                        </p>
                    </div>
                )}

                {/* Quick Note */}
                <div className="bg-card rounded-xl p-4">
                    <div className="flex items-center justify-between mb-2">
                        <h3 className="text-xs font-semibold text-surface-400 uppercase tracking-wide">Nota Rápida</h3>
                    </div>
                    <div className="flex gap-2">
                        <input
                            type="text"
                            value={quickNote}
                            onChange={(e) => setQuickNote(e.target.value)}
                            placeholder="Adicionar observação..."
                            className="flex-1 px-3 py-2 rounded-lg bg-surface-100 border-0 text-sm placeholder:text-surface-400 focus:ring-2 focus:ring-brand-500/30 focus:outline-none"
                            onKeyDown={(e) => e.key === 'Enter' && quickNote.trim() && handleSendNote()}
                        />
                        <button
                            onClick={handleSendNote}
                            disabled={!quickNote.trim() || sendingNote}
                            className={cn(
                                'px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                                quickNote.trim()
                                    ? 'bg-brand-600 text-white active:bg-brand-700'
                                    : 'bg-surface-200 text-surface-400'
                            )}
                        >
                            {sendingNote ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                        </button>
                    </div>
                    {notes.length > 0 && (
                        <div className="mt-3 space-y-2 max-h-32 overflow-y-auto">
                            {notes.slice(-3).map((note, i) => (
                                <div key={i} className="flex gap-2 text-xs">
                                    <span className="text-surface-400 flex-shrink-0">
                                        {new Date(note.created_at || Date.now()).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                    <span className="text-surface-600">{note.content || note.message || note.body}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Action cards */}
                <div className="grid grid-cols-2 gap-3 pb-8">
                    {ACTION_CARDS.map((card) => (
                        <button
                            key={card.key}
                            onClick={() => {
                                if (card.key === 'chat') { setIsChatOpen(true) }
                                else { navigate(`/tech/os/${wo.id}/${card.key}`) }
                            }}
                            className="flex flex-col items-start gap-4 bg-card rounded-2xl p-5 border border-surface-100 shadow-sm active:scale-[0.96] active:bg-surface-50 dark:active:bg-surface-700 transition-all group"
                        >
                            <div className={cn('w-12 h-12 rounded-xl flex items-center justify-center transition-transform group-active:scale-90', card.color)}>
                                <card.icon className="w-6 h-6" />
                            </div>
                            <div className="flex items-center justify-between w-full">
                                <p className="text-sm font-bold text-foreground">{card.label}</p>
                                <ChevronRight className="w-4 h-4 text-surface-300 group-hover:translate-x-1 transition-transform" />
                            </div>
                        </button>
                    ))}
                </div>
            </div>

            {/* Bottom action */}
            {currentStatus.next && (
                <div className="p-4 bg-card border-t border-border safe-area-bottom">
                    <button
                        onClick={handleStatusTransition}
                        disabled={transitioning}
                        className={cn(
                            'w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold text-white transition-colors',
                            currentStatus.next === 'completed'
                                ? 'bg-emerald-600 active:bg-emerald-700'
                                : 'bg-brand-600 active:bg-brand-700',
                            transitioning && 'opacity-70',
                        )}
                    >
                        {transitioning ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                        ) : currentStatus.next === 'in_progress' ? (
                            <PlayCircle className="w-4 h-4" />
                        ) : (
                            <CheckCircle2 className="w-4 h-4" />
                        )}
                        {currentStatus.nextLabel}
                    </button>
                </div>
            )}

            {showCompletionWizard && (
                <div className="absolute inset-0 z-50 flex flex-col bg-surface-50">
                    <div className="bg-card px-4 pt-3 pb-4 border-b border-border">
                        <div className="flex items-center justify-between">
                            <h2 className="text-lg font-bold text-foreground">Finalizar OS</h2>
                            <button onClick={() => setShowCompletionWizard(false)} className="p-1.5 rounded-lg hover:bg-surface-100 dark:hover:bg-surface-800">
                                <X className="w-5 h-5 text-surface-500" />
                            </button>
                        </div>
                        <p className="text-xs text-surface-500 mt-1">Verifique os itens antes de concluir</p>
                    </div>

                    <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
                        {[
                            { key: 'photos', label: 'Fotos do Serviço', desc: 'Registre fotos do antes/depois', icon: Camera, path: `/tech/os/${wo.id}/photos`, required: false },
                            { key: 'checklist', label: 'Checklists', desc: 'Preencha os checklists obrigatórios', icon: ClipboardList, path: `/tech/os/${wo.id}/checklist`, required: true },
                            { key: 'signature', label: 'Assinatura do Cliente', desc: 'Colete a assinatura', icon: PenTool, path: `/tech/os/${wo.id}/signature`, required: true },
                            { key: 'nps', label: 'Avaliação NPS', desc: 'Colete a avaliação do cliente', icon: Star, path: `/tech/os/${wo.id}/nps`, required: false },
                        ].map((step) => {
                            const StepIcon = step.icon
                            return (
                                <button
                                    key={step.key}
                                    onClick={() => navigate(step.path)}
                                    className="w-full flex items-center gap-3 bg-card rounded-xl p-4 active:scale-[0.98] transition-transform"
                                >
                                    <div className={cn(
                                        'w-10 h-10 rounded-xl flex items-center justify-center',
                                        completionSteps[step.key as keyof typeof completionSteps]
                                            ? 'bg-emerald-100 dark:bg-emerald-900/30'
                                            : 'bg-surface-100'
                                    )}>
                                        {completionSteps[step.key as keyof typeof completionSteps] ? (
                                            <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                                        ) : (
                                            <StepIcon className="w-5 h-5 text-surface-600" />
                                        )}
                                    </div>
                                    <div className="flex-1 text-left">
                                        <div className="flex items-center gap-2">
                                            <p className="text-sm font-medium text-foreground">{step.label}</p>
                                            {step.required && (
                                                <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 dark:bg-amber-900/30 font-medium">Recomendado</span>
                                            )}
                                        </div>
                                        <p className="text-xs text-surface-500">{step.desc}</p>
                                    </div>
                                    <ChevronRight className="w-4 h-4 text-surface-300" />
                                </button>
                            )
                        })}
                    </div>

                    <div className="p-4 bg-card border-t border-border safe-area-bottom">
                        <button
                            onClick={handleCompleteOS}
                            disabled={transitioning}
                            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-emerald-600 text-white text-sm font-semibold active:bg-emerald-700 transition-colors disabled:opacity-70"
                        >
                            {transitioning ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                            Concluir OS Agora
                        </button>
                        <p className="text-[10px] text-surface-400 text-center mt-2">
                            Você pode concluir mesmo sem completar todos os itens
                        </p>
                    </div>
                </div>
            )}

            {showStopModal && (
                <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-4">
                    <div className="w-full max-w-sm bg-card rounded-t-2xl sm:rounded-2xl p-4 shadow-xl">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-base font-bold text-foreground">Registrar parada</h3>
                            <button onClick={() => { setShowStopModal(false); setStopNotes('') }} className="p-2 rounded-lg hover:bg-surface-100 dark:hover:bg-surface-800">
                                <X className="w-5 h-5 text-surface-500" />
                            </button>
                        </div>
                        <div className="space-y-2">
                            {[
                                { type: 'lunch', label: 'Almoço', icon: Coffee },
                                { type: 'hotel', label: 'Hotel', icon: Car },
                                { type: 'br_stop', label: 'Parada BR', icon: MapPin },
                                { type: 'other', label: 'Outro', icon: Flag },
                            ].map(({ type, label, icon: Icon }) => (
                                <button
                                    key={type}
                                    onClick={() => handleAddStop(type)}
                                    className="w-full flex items-center gap-3 py-3 px-4 rounded-xl bg-surface-50 hover:bg-surface-100 dark:hover:bg-surface-700 text-foreground text-sm font-medium active:scale-[0.98]"
                                >
                                    <Icon className="w-5 h-5 text-surface-500" />
                                    {label}
                                </button>
                            ))}
                        </div>
                        <input
                            type="text"
                            value={stopNotes}
                            onChange={(e) => setStopNotes(e.target.value)}
                            placeholder="Observação (opcional)"
                            className="mt-3 w-full px-3 py-2 rounded-lg bg-surface-100 border-0 text-sm placeholder:text-surface-400 focus:ring-2 focus:ring-brand-500/30"
                        />
                    </div>
                </div>
            )}

            {wo && (
                <TechChatDrawer
                    workOrderId={wo.id}
                    isOpen={isChatOpen}
                    onClose={() => setIsChatOpen(false)}
                />
            )}
        </div>
    )
}
