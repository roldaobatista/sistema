import { useEffect, useState, useCallback , useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
    ArrowLeft, MapPin, Phone, Clock, User, AlertTriangle,
    ClipboardList, Camera, Receipt, PenTool, PlayCircle,
    CheckCircle2, Loader2, ChevronRight, WifiOff, ShieldCheck,
    Navigation, FileText, Send, Mic, Printer, ImagePlus,
} from 'lucide-react'
import { useOfflineStore } from '@/hooks/useOfflineStore'
import { cn } from '@/lib/utils'
import { offlinePut } from '@/lib/syncEngine'
import api from '@/lib/api'
import { useToast } from '@/components/ui/use-toast'
import SLACountdown from '@/components/common/SLACountdown'
import TechChatDrawer from '@/components/tech/TechChatDrawer'
import type { OfflineWorkOrder } from '@/lib/offlineDb'
import { useAuthStore } from '@/stores/auth-store'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

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
    { key: 'expenses', label: 'Despesas', icon: Receipt, color: 'text-amber-600 bg-amber-100 dark:bg-amber-900/30 dark:text-amber-400' },
    { key: 'signature', label: 'Assinatura', icon: PenTool, color: 'text-emerald-600 bg-emerald-100 dark:bg-emerald-900/30 dark:text-emerald-400' },
    { key: 'chat', label: 'Chat Interno', icon: Send, color: 'text-indigo-600 bg-indigo-100 dark:bg-indigo-900/30 dark:text-indigo-400' },
    { key: 'voice-report', label: 'Relatório Voz', icon: Mic, color: 'text-rose-600 bg-rose-100 dark:bg-rose-900/30 dark:text-rose-400' },
    { key: 'annotate', label: 'Anotar Foto', icon: ImagePlus, color: 'text-cyan-600 bg-cyan-100 dark:bg-cyan-900/30 dark:text-cyan-400' },
    { key: 'print', label: 'Impressão BT', icon: Printer, color: 'text-slate-600 bg-slate-100 dark:bg-slate-900/30 dark:text-slate-400' },
];

export default function TechWorkOrderDetailPage() {

  // MVP: Data fetching
  const { data: items, isLoading, isError, refetch } = useQuery({
    queryKey: ['tech-work-order-detail'],
    queryFn: () => api.get('/tech-work-order-detail').then(r => r.data?.data ?? r.data ?? []),
  })

  // MVP: Loading/Error/Empty states
  if (isLoading) return <div className="flex items-center justify-center p-8"><Loader2 className="h-8 w-8 animate-spin" /></div>
  if (isError) return <div className="flex flex-col items-center justify-center p-8 text-red-500"><AlertCircle className="h-8 w-8 mb-2" /><p>Erro ao carregar dados</p><button onClick={() => refetch()} className="mt-2 text-blue-500 underline">Tentar novamente</button></div>
  if (!items || (Array.isArray(items) && items.length === 0)) return <div className="flex flex-col items-center justify-center p-8 text-gray-400"><Inbox className="h-12 w-12 mb-2" /><p>Nenhum registro encontrado</p></div>
  const { hasPermission } = useAuthStore()

    const { id } = useParams<{ id: string }>()
    const navigate = useNavigate()
    const { toast } = useToast()
    const { getById, put } = useOfflineStore('work-orders')
    const [wo, setWo] = useState<OfflineWorkOrder | null>(null)
    const [loading, setLoading] = useState(true)
    const [transitioning, setTransitioning] = useState(false)
    const [updatingLocation, setUpdatingLocation] = useState(false)
    const [isChatOpen, setIsChatOpen] = useState(false)

  const [searchTerm, setSearchTerm] = useState('')
    useEffect(() => {
        if (!id) return
        getById(Number(id)).then((data) => {
            setWo(data ?? null)
            setLoading(false)
        })
    }, [id]) // eslint-disable-line react-hooks/exhaustive-deps

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
                } catch (error) {
                    console.error(error)
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
                console.error(error)
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

    const handleStatusTransition = useCallback(async () => {
        if (!wo) return
        const status = STATUS_MAP[wo.status]
        if (!status?.next) return

        setTransitioning(true)
        try {
            const updated = { ...wo, status: status.next, updated_at: new Date().toISOString() }
            await put(updated as OfflineWorkOrder)
            setWo(updated as OfflineWorkOrder)

            // Sync to backend (queues if offline)
            await offlinePut(`/tech/sync/batch`, {
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
        <div className="flex flex-col h-full">
            {/* Header */}
            <div className="bg-white dark:bg-surface-900 px-4 pt-3 pb-4 border-b border-surface-200 dark:border-surface-700">
                <button onClick={() => navigate('/tech')} className="flex items-center gap-1 text-sm text-brand-600 dark:text-brand-400 mb-3">
                    <ArrowLeft className="w-4 h-4" /> Voltar
                </button>

                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-lg font-bold text-surface-900 dark:text-surface-50">
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
                <div className="bg-white dark:bg-surface-800/80 rounded-2xl shadow-sm border border-surface-100 dark:border-surface-700/50 overflow-hidden">
                    <div className="p-4 space-y-4">
                        <div className="flex items-center justify-between">
                            <h3 className="text-[10px] font-bold text-surface-400 uppercase tracking-[0.1em]">Informações do Cliente</h3>
                            {wo.customer_phone && (
                                <a
                                    href={`tel:${wo.customer_phone}`}
                                    title="Ligar para o cliente"
                                    className="p-2 rounded-full bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 active:scale-95 transition-all"
                                >
                                    <Phone className="w-4 h-4" />
                                </a>
                            )}
                        </div>

                        <div className="flex items-start gap-4">
                            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-brand-500 to-brand-600 flex items-center justify-center flex-shrink-0 shadow-lg shadow-brand-500/20">
                                <User className="w-6 h-6 text-white" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="font-bold text-base text-surface-900 dark:text-surface-50 truncate">
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
                                    className="flex items-center justify-center gap-2 py-3 rounded-xl bg-surface-50 dark:bg-surface-900 border border-surface-200 dark:border-surface-700 text-[11px] font-bold text-surface-700 dark:text-surface-200 active:scale-95 transition-all shadow-sm"
                                >
                                    <MapPin className="w-3.5 h-3.5 text-red-500" /> Google Maps
                                </a>
                            )}
                            {wo.waze_link && (
                                <a
                                    href={wo.waze_link}
                                    className="flex items-center justify-center gap-2 py-3 rounded-xl bg-surface-50 dark:bg-surface-900 border border-surface-200 dark:border-surface-700 text-[11px] font-bold text-surface-700 dark:text-surface-200 active:scale-95 transition-all shadow-sm"
                                >
                                    <Navigation className="w-3.5 h-3.5 text-[#33ccff]" /> Waze
                                </a>
                            )}
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
                    <div className="flex items-center gap-2 bg-white dark:bg-surface-800/80 rounded-xl p-4">
                        <Clock className="w-5 h-5 text-surface-400" />
                        <div>
                            <p className="text-xs text-surface-400">Agendamento</p>
                            <p className="text-sm font-medium text-surface-900 dark:text-surface-50">
                                {new Date(wo.scheduled_date).toLocaleString('pt-BR', {
                                    day: '2-digit', month: '2-digit', year: 'numeric',
                                    hour: '2-digit', minute: '2-digit',
                                })}
                            </p>
                        </div>
                    </div>
                )}

                {/* Description */}
                {wo.description && (
                    <div className="bg-white dark:bg-surface-800/80 rounded-xl p-4">
                        <h3 className="text-xs font-semibold text-surface-400 uppercase tracking-wide mb-2">Descrição</h3>
                        <p className="text-sm text-surface-700 dark:text-surface-300 leading-relaxed">
                            {wo.description}
                        </p>
                    </div>
                )}

                {/* Action cards */}
                <div className="grid grid-cols-2 gap-3 pb-8">
                    {ACTION_CARDS.map((card) => (
                        <button
                            key={card.key}
                            onClick={() => {
                                card.key === 'chat' ? setIsChatOpen(true) :
                                    navigate(`/tech/os/${wo.id}/${card.key}`)
                            }}
                            className="flex flex-col items-start gap-4 bg-white dark:bg-surface-800/80 rounded-2xl p-5 border border-surface-100 dark:border-surface-700/50 shadow-sm active:scale-[0.96] active:bg-surface-50 dark:active:bg-surface-700 transition-all group"
                        >
                            <div className={cn('w-12 h-12 rounded-xl flex items-center justify-center transition-transform group-active:scale-90', card.color)}>
                                <card.icon className="w-6 h-6" />
                            </div>
                            <div className="flex items-center justify-between w-full">
                                <p className="text-sm font-bold text-surface-900 dark:text-surface-50">{card.label}</p>
                                <ChevronRight className="w-4 h-4 text-surface-300 group-hover:translate-x-1 transition-transform" />
                            </div>
                        </button>
                    ))}
                </div>
            </div>

            {/* Bottom action */}
            {currentStatus.next && (
                <div className="p-4 bg-white dark:bg-surface-900 border-t border-surface-200 dark:border-surface-700 safe-area-bottom">
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
