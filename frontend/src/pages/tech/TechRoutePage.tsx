import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
    ArrowLeft, Navigation, MapPin, Clock, Route, ExternalLink,
    Loader2, Map, Grip, CheckCircle2, Play,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import api from '@/lib/api'
import { toast } from 'sonner'

interface RouteWorkOrder {
    id: number
    os_number?: string | null
    number?: string | null
    customer_name?: string | null
    address?: string | null
    city?: string | null
    scheduled_time?: string | null
    scheduled_date?: string | null
    status: string
    latitude?: number | null
    longitude?: number | null
}

interface RouteOptimizationResult {
    total_distance?: number
    total_duration?: number
}

const STATUS_COLORS: Record<string, string> = {
    pending: 'bg-amber-500',
    in_progress: 'bg-blue-500',
    completed: 'bg-emerald-500',
}

const STATUS_LABELS: Record<string, string> = {
    pending: 'Pendente',
    in_progress: 'Em Andamento',
    completed: 'Concluída',
}

export default function TechRoutePage() {
    const navigate = useNavigate()
    const [workOrders, setWorkOrders] = useState<RouteWorkOrder[]>([])
    const [optimizedOrder, setOptimizedOrder] = useState<RouteWorkOrder[]>([])
    const [loading, setLoading] = useState(true)
    const [optimizing, setOptimizing] = useState(false)
    const [selectedDate, setSelectedDate] = useState<string>(() => {
        const today = new Date()
        return today.toISOString().slice(0, 10)
    })

    const displayOrders = optimizedOrder.length > 0 ? optimizedOrder : workOrders

    useEffect(() => {
        fetchWorkOrders()
    }, [selectedDate])

    async function fetchWorkOrders() {
        setLoading(true)
        try {
            const { data } = await api.get('/work-orders', {
                params: {
                    my: '1',
                    scheduled_from: selectedDate,
                    scheduled_to: selectedDate,
                    per_page: 50,
                },
            })
            const orders = data.data ?? data ?? []
            setWorkOrders(orders)
            setOptimizedOrder([])
        } catch {
            toast.error('Erro ao carregar ordens de serviço')
        } finally {
            setLoading(false)
        }
    }

    async function handleOptimize() {
        if (workOrders.length < 2) {
            toast.error('Necessário pelo menos 2 ordens de serviço para otimizar')
            return
        }

        setOptimizing(true)
        try {
            const { data } = await api.post('/operational/route-optimization', {
                work_order_ids: workOrders.map(wo => wo.id),
            })
            setOptimizedOrder(data ?? [])
            toast.success('Rota otimizada com sucesso!')
        } catch (err: unknown) {
            const msg = err && typeof err === 'object' && 'response' in err
                ? (err as { response?: { data?: { message?: string } } }).response?.data?.message
                : undefined
            toast.error(msg || 'Erro ao otimizar rota')
        } finally {
            setOptimizing(false)
        }
    }

    function handleNavigate(wo: RouteWorkOrder) {
        if (!wo.address && !wo.latitude) {
            toast.error('Endereço não disponível')
            return
        }

        let url = 'https://www.google.com/maps/dir/?api=1'
        if (wo.latitude && wo.longitude) {
            url += `&destination=${wo.latitude},${wo.longitude}`
        } else if (wo.address) {
            const address = `${wo.address}${wo.city ? `, ${wo.city}` : ''}`
            url += `&destination=${encodeURIComponent(address)}`
        }
        window.open(url, '_blank')
    }

    function handleOpenAllInMaps() {
        if (displayOrders.length === 0) {
            toast.error('Nenhuma ordem de serviço disponível')
            return
        }

        const waypoints: string[] = []
        let destination = ''

        displayOrders.forEach((wo, index) => {
            if (wo.latitude && wo.longitude) {
                const point = `${wo.latitude},${wo.longitude}`
                if (index === displayOrders.length - 1) {
                    destination = point
                } else {
                    waypoints.push(point)
                }
            } else if (wo.address) {
                const address = `${wo.address}${wo.city ? `, ${wo.city}` : ''}`
                const encoded = encodeURIComponent(address)
                if (index === displayOrders.length - 1) {
                    destination = encoded
                } else {
                    waypoints.push(encoded)
                }
            }
        })

        if (!destination) {
            toast.error('Endereços não disponíveis')
            return
        }

        let url = `https://www.google.com/maps/dir/?api=1&destination=${destination}`
        if (waypoints.length > 0) {
            url += `&waypoints=${waypoints.join('|')}`
        }
        window.open(url, '_blank')
    }

    const summary = useMemo(() => {
        return {
            totalStops: displayOrders.length,
            estimatedDistance: null as number | null,
            estimatedTime: null as number | null,
        }
    }, [displayOrders])

    const formattedDate = useMemo(() => {
        const date = new Date(selectedDate + 'T12:00:00')
        return date.toLocaleDateString('pt-BR', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
        })
    }, [selectedDate])

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
                    Roteirização Inteligente
                </h1>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
                {/* Date selector */}
                <div className="bg-card rounded-xl p-4">
                    <label className="block text-xs font-semibold text-surface-400 uppercase mb-2">
                        Data
                    </label>
                    <input
                        type="date"
                        value={selectedDate}
                        onChange={(e) => setSelectedDate(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg bg-surface-50 border border-border text-sm text-foreground focus:ring-2 focus:ring-brand-500/30 focus:outline-none"
                    />
                    <p className="text-xs text-surface-500 mt-1">{formattedDate}</p>
                </div>

                {/* Summary card */}
                <div className="bg-card rounded-xl p-4 space-y-3">
                    <div className="flex items-center justify-between">
                        <h2 className="text-sm font-semibold text-foreground">
                            Resumo da Rota
                        </h2>
                        <button
                            onClick={handleOptimize}
                            disabled={workOrders.length < 2 || optimizing}
                            className={cn(
                                'flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
                                workOrders.length < 2 || optimizing
                                    ? 'bg-surface-100 text-surface-400 cursor-not-allowed'
                                    : 'bg-brand-600 text-white active:scale-95'
                            )}
                        >
                            {optimizing ? (
                                <>
                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                    Otimizando...
                                </>
                            ) : (
                                <>
                                    <Route className="w-3.5 h-3.5" />
                                    Otimizar Rota
                                </>
                            )}
                        </button>
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                        <div>
                            <p className="text-xs text-surface-400 uppercase mb-1">Total de Paradas</p>
                            <p className="text-lg font-bold text-foreground">
                                {summary.totalStops}
                            </p>
                        </div>
                        <div>
                            <p className="text-xs text-surface-400 uppercase mb-1">Distância Estimada</p>
                            <p className="text-lg font-bold text-foreground">
                                {summary.estimatedDistance ? `${summary.estimatedDistance.toFixed(1)} km` : '—'}
                            </p>
                        </div>
                        <div>
                            <p className="text-xs text-surface-400 uppercase mb-1">Tempo Estimado</p>
                            <p className="text-lg font-bold text-foreground">
                                {summary.estimatedTime ? `${Math.round(summary.estimatedTime / 60)} min` : '—'}
                            </p>
                        </div>
                    </div>
                </div>

                {/* Route stops */}
                {loading ? (
                    <div className="flex justify-center py-8">
                        <Loader2 className="w-8 h-8 animate-spin text-brand-500" />
                    </div>
                ) : displayOrders.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 gap-2">
                        <Map className="w-12 h-12 text-surface-300" />
                        <p className="text-sm text-surface-500">Nenhuma ordem de serviço agendada</p>
                    </div>
                ) : (
                    <div className="space-y-0">
                        {displayOrders.map((wo, index) => {
                            const statusColor = STATUS_COLORS[wo.status] || 'bg-surface-400'
                            const statusLabel = STATUS_LABELS[wo.status] || wo.status
                            const isLast = index === displayOrders.length - 1

                            return (
                                <div key={wo.id} className="relative">
                                    <div className="bg-card rounded-xl p-4 flex items-start gap-3">
                                        {/* Stop number and connector */}
                                        <div className="relative flex-shrink-0">
                                            <div className="w-10 h-10 rounded-full bg-brand-600 text-white flex items-center justify-center text-sm font-bold z-10 relative">
                                                {index + 1}
                                            </div>
                                            {!isLast && (
                                                <div className="absolute left-5 top-10 bottom-0 w-0.5 bg-surface-200" />
                                            )}
                                        </div>

                                        {/* Content */}
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-start justify-between gap-2 mb-2">
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <span className="text-sm font-semibold text-foreground">
                                                            {wo.os_number || wo.number || 'N/A'}
                                                        </span>
                                                        <span
                                                            className={cn(
                                                                'inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium',
                                                                statusColor,
                                                                'text-white'
                                                            )}
                                                        >
                                                            {statusLabel}
                                                        </span>
                                                    </div>
                                                    <p className="text-xs text-surface-600 truncate">
                                                        {wo.customer_name || 'Sem cliente'}
                                                    </p>
                                                </div>
                                                <Grip className="w-4 h-4 text-surface-300 flex-shrink-0" />
                                            </div>

                                            {(wo.address || wo.city) && (
                                                <div className="flex items-center gap-1 text-xs text-surface-500 mb-2">
                                                    <MapPin className="w-3 h-3" />
                                                    <span className="truncate">
                                                        {wo.address || ''}
                                                        {wo.address && wo.city ? ', ' : ''}
                                                        {wo.city || ''}
                                                    </span>
                                                </div>
                                            )}

                                            {wo.scheduled_time && (
                                                <div className="flex items-center gap-1 text-xs text-surface-500 mb-2">
                                                    <Clock className="w-3 h-3" />
                                                    <span>{wo.scheduled_time.slice(0, 5)}</span>
                                                </div>
                                            )}

                                            <button
                                                onClick={() => handleNavigate(wo)}
                                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand-50 text-brand-600 text-xs font-medium active:scale-95 transition-transform"
                                            >
                                                <Navigation className="w-3.5 h-3.5" />
                                                Navegar
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                )}

                {/* Bottom action */}
                {displayOrders.length > 0 && (
                    <button
                        onClick={handleOpenAllInMaps}
                        className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-brand-600 text-white font-medium active:scale-95 transition-transform shadow-sm"
                    >
                        <Map className="w-4 h-4" />
                        Abrir no Google Maps
                        <ExternalLink className="w-4 h-4" />
                    </button>
                )}
            </div>
        </div>
    )
}
