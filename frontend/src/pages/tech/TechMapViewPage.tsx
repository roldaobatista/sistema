import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
    MapPin,
    Navigation,
    Clock,
    Loader2,
    ArrowLeft,
    Locate,
    ExternalLink,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import api from '@/lib/api'
import { toast } from 'sonner'

interface OSWithDistance {
    id: number
    os_number: string | null
    number: string | null
    customer_name: string | null
    customer_address: string | null
    address?: string | null
    city: string | null
    status: string
    scheduled_time: string | null
    scheduled_date: string | null
    latitude: number | null
    longitude: number | null
    distance?: number
}

function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371
    const dLat = ((lat2 - lat1) * Math.PI) / 180
    const dLon = ((lon2 - lon1) * Math.PI) / 180
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos((lat1 * Math.PI) / 180) *
            Math.cos((lat2 * Math.PI) / 180) *
            Math.sin(dLon / 2) *
            Math.sin(dLon / 2)
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function formatDistance(km: number): string {
    if (km < 1) return `${Math.round(km * 1000)}m`
    return `${km.toFixed(1)}km`
}

const STATUS_COLORS: Record<string, string> = {
    pending: 'bg-amber-500',
    in_progress: 'bg-blue-500',
    completed: 'bg-emerald-500',
    cancelled: 'bg-surface-400',
}

const STATUS_LABELS: Record<string, string> = {
    pending: 'Pendente',
    in_progress: 'Em Andamento',
    completed: 'Concluída',
    cancelled: 'Cancelada',
}

type PeriodFilter = 'today' | 'tomorrow' | 'week'

function getDateRange(period: PeriodFilter): { from: string; to: string } {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    if (period === 'today') {
        const to = new Date(today)
        to.setHours(23, 59, 59, 999)
        return {
            from: today.toISOString().slice(0, 10),
            to: to.toISOString().slice(0, 10),
        }
    }

    if (period === 'tomorrow') {
        const tomorrow = new Date(today)
        tomorrow.setDate(tomorrow.getDate() + 1)
        const to = new Date(tomorrow)
        to.setHours(23, 59, 59, 999)
        return {
            from: tomorrow.toISOString().slice(0, 10),
            to: to.toISOString().slice(0, 10),
        }
    }

    const weekEnd = new Date(today)
    weekEnd.setDate(weekEnd.getDate() + 6)
    weekEnd.setHours(23, 59, 59, 999)
    return {
        from: today.toISOString().slice(0, 10),
        to: weekEnd.toISOString().slice(0, 10),
    }
}

function isInDateRange(scheduledDate: string | null | undefined, from: string, to: string): boolean {
    if (!scheduledDate) return true
    const d = scheduledDate.slice(0, 10)
    return d >= from && d <= to
}

export default function TechMapViewPage() {
    const navigate = useNavigate()
    const [position, setPosition] = useState<{ lat: number; lng: number } | null>(null)
    const [positionError, setPositionError] = useState<string | null>(null)
    const [positionLoading, setPositionLoading] = useState(true)
    const [workOrders, setWorkOrders] = useState<OSWithDistance[]>([])
    const [loading, setLoading] = useState(true)
    const [period, setPeriod] = useState<PeriodFilter>('today')

    useEffect(() => {
        if (!navigator.geolocation) {
            setPositionError('Geolocalização não suportada')
            setPositionLoading(false)
            return
        }

        const watchId = navigator.geolocation.watchPosition(
            (pos) => {
                setPosition({ lat: pos.coords.latitude, lng: pos.coords.longitude })
                setPositionError(null)
                setPositionLoading(false)
            },
            (err) => {
                setPositionError(err.message || 'Erro ao obter localização')
                setPositionLoading(false)
            },
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
        )

        return () => navigator.geolocation.clearWatch(watchId)
    }, [])

    useEffect(() => {
        async function fetchWorkOrders() {
            setLoading(true)
            try {
                const { data } = await api.get('/tech/sync?since=1970-01-01T00:00:00Z')
                const raw = (data.work_orders ?? []) as OSWithDistance[]
                setWorkOrders(raw)
            } catch {
                toast.error('Erro ao carregar ordens de serviço')
                setWorkOrders([])
            } finally {
                setLoading(false)
            }
        }
        fetchWorkOrders()
    }, [])

    const { from, to } = useMemo(() => getDateRange(period), [period])

    const filteredAndSorted = useMemo(() => {
        const filtered = workOrders.filter((wo) => isInDateRange(wo.scheduled_date, from, to))
        const withCoords = filtered.filter((wo) => wo.latitude != null && wo.longitude != null)

        if (!position) {
            return withCoords.map((wo) => ({ ...wo, distance: 0 }))
        }

        const withDistance = withCoords.map((wo) => ({
            ...wo,
            distance: calculateDistance(position.lat, position.lng, wo.latitude!, wo.longitude!),
        }))

        return withDistance.sort((a, b) => (a.distance ?? 0) - (b.distance ?? 0))
    }, [workOrders, period, from, to, position])

    const summary = useMemo(() => {
        const totalKm =
            position && filteredAndSorted.length >= 2
                ? filteredAndSorted.reduce((acc, wo, i) => {
                      if (i === 0) return 0
                      const prev = filteredAndSorted[i - 1]
                      return (
                          acc +
                          calculateDistance(
                              prev.latitude!,
                              prev.longitude!,
                              wo.latitude!,
                              wo.longitude!
                          )
                      )
                  }, 0)
                : 0
        const avgSpeedKmh = 30
        const estimatedMin = totalKm > 0 ? Math.round((totalKm / avgSpeedKmh) * 60) : 0
        return {
            stops: filteredAndSorted.length,
            totalKm: totalKm.toFixed(1),
            estimatedMin,
        }
    }, [filteredAndSorted, position])

    function handleNavigate(wo: OSWithDistance) {
        if (wo.latitude != null && wo.longitude != null) {
            window.open(
                `https://www.google.com/maps/dir/?api=1&destination=${wo.latitude},${wo.longitude}`,
                '_blank'
            )
            return
        }
        const addr = [wo.customer_address ?? wo.address, wo.city].filter(Boolean).join(', ')
        if (addr) {
            window.open(
                `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(addr)}`,
                '_blank'
            )
        } else {
            toast.error('Endereço não disponível')
        }
    }

    function handleOpenFullRoute() {
        if (filteredAndSorted.length === 0) {
            toast.error('Nenhuma ordem de serviço disponível')
            return
        }

        const waypoints: string[] = []
        let destination = ''

        filteredAndSorted.forEach((wo, index) => {
            if (wo.latitude != null && wo.longitude != null) {
                const point = `${wo.latitude},${wo.longitude}`
                if (index === filteredAndSorted.length - 1) {
                    destination = point
                } else {
                    waypoints.push(point)
                }
            } else {
                const addr = [wo.customer_address ?? wo.address, wo.city].filter(Boolean).join(', ')
                if (addr) {
                    const encoded = encodeURIComponent(addr)
                    if (index === filteredAndSorted.length - 1) {
                        destination = encoded
                    } else {
                        waypoints.push(encoded)
                    }
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

    return (
        <div className="flex flex-col h-full">
            {/* Header */}
            <div className="flex items-center gap-3 px-4 py-3 bg-white dark:bg-surface-900 border-b border-surface-200 dark:border-surface-700">
                <button
                    onClick={() => navigate('/tech')}
                    className="p-1.5 rounded-lg hover:bg-surface-100 dark:hover:bg-surface-800"
                    aria-label="Voltar"
                >
                    <ArrowLeft className="w-5 h-5 text-surface-600 dark:text-surface-400" />
                </button>
                <h1 className="flex-1 text-lg font-bold text-surface-900 dark:text-surface-50">
                    Mapa de OS
                </h1>
            </div>

            {/* Period toggle */}
            <div className="flex gap-2 px-4 py-2 bg-surface-50 dark:bg-surface-900/50 border-b border-surface-200 dark:border-surface-700">
                {(['today', 'tomorrow', 'week'] as const).map((p) => (
                    <button
                        key={p}
                        onClick={() => setPeriod(p)}
                        className={cn(
                            'flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                            period === p
                                ? 'bg-brand-600 text-white'
                                : 'bg-surface-200 dark:bg-surface-700 text-surface-600 dark:text-surface-400'
                        )}
                    >
                        {p === 'today' ? 'Hoje' : p === 'tomorrow' ? 'Amanhã' : 'Semana'}
                    </button>
                ))}
            </div>

            {/* Summary */}
            {!loading && filteredAndSorted.length > 0 && (
                <div className="px-4 py-2 bg-white dark:bg-surface-900 border-b border-surface-200 dark:border-surface-700">
                    <div className="flex items-center justify-between text-sm">
                        <span className="text-surface-500 dark:text-surface-400">
                            {summary.stops} paradas
                        </span>
                        <span className="text-surface-500 dark:text-surface-400">
                            ~{summary.totalKm} km total
                        </span>
                        <span className="text-surface-500 dark:text-surface-400">
                            ~{summary.estimatedMin} min
                        </span>
                    </div>
                </div>
            )}

            {/* GPS status */}
            <div className="px-4 py-2 flex items-center gap-2 text-xs">
                {positionLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin text-surface-400" />
                ) : position ? (
                    <Locate className="w-4 h-4 text-emerald-500" />
                ) : (
                    <MapPin className="w-4 h-4 text-amber-500" />
                )}
                <span className="text-surface-500 dark:text-surface-400">
                    {positionLoading
                        ? 'Obtendo localização...'
                        : position
                          ? 'Localização ativa'
                          : positionError || 'Localização indisponível'}
                </span>
            </div>

            {/* OS list */}
            <div className="flex-1 overflow-y-auto px-4 pb-4">
                {loading ? (
                    <div className="flex justify-center py-12">
                        <Loader2 className="w-8 h-8 animate-spin text-brand-500" />
                    </div>
                ) : filteredAndSorted.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 gap-3">
                        <MapPin className="w-12 h-12 text-surface-300" />
                        <p className="text-sm text-surface-500 text-center">
                            Nenhuma OS com endereço no período selecionado
                        </p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {filteredAndSorted.map((wo) => {
                            const statusColor = STATUS_COLORS[wo.status] || 'bg-surface-400'
                            const statusLabel = STATUS_LABELS[wo.status] || wo.status
                            const addr = wo.customer_address ?? wo.address ?? ''
                            const fullAddr = [addr, wo.city].filter(Boolean).join(', ')

                            return (
                                <div
                                    key={wo.id}
                                    className="bg-white dark:bg-surface-800/80 rounded-xl p-4 border border-surface-200 dark:border-surface-700 shadow-sm"
                                >
                                    <div className="flex items-start gap-3">
                                        <div
                                            className={cn(
                                                'w-2.5 h-2.5 rounded-full flex-shrink-0 mt-1.5',
                                                statusColor
                                            )}
                                        />
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                                                <span className="font-semibold text-sm text-surface-900 dark:text-surface-50">
                                                    {wo.os_number || wo.number || 'N/A'}
                                                </span>
                                                <span className="text-xs text-surface-500 dark:text-surface-400">
                                                    {statusLabel}
                                                </span>
                                            </div>
                                            <p className="text-sm text-surface-700 dark:text-surface-300 truncate">
                                                {wo.customer_name || 'Cliente não informado'}
                                            </p>
                                            {fullAddr && (
                                                <p className="text-xs text-surface-500 dark:text-surface-400 line-clamp-2 mt-0.5">
                                                    {fullAddr}
                                                </p>
                                            )}
                                            <div className="flex items-center gap-2 mt-2 flex-wrap">
                                                {wo.distance != null && wo.distance > 0 && (
                                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-surface-100 dark:bg-surface-700 text-xs font-medium text-surface-600 dark:text-surface-400">
                                                        <MapPin className="w-3 h-3" />
                                                        {formatDistance(wo.distance)}
                                                    </span>
                                                )}
                                                {wo.scheduled_time && (
                                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-surface-100 dark:bg-surface-700 text-xs font-medium text-surface-600 dark:text-surface-400">
                                                        <Clock className="w-3 h-3" />
                                                        {wo.scheduled_time.slice(0, 5)}
                                                    </span>
                                                )}
                                            </div>
                                            <button
                                                onClick={() => handleNavigate(wo)}
                                                className="flex items-center gap-1.5 mt-2 px-3 py-1.5 rounded-lg bg-brand-50 dark:bg-brand-900/20 text-brand-600 dark:text-brand-400 text-xs font-medium active:scale-95 transition-transform"
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

                {/* Full route button */}
                {!loading && filteredAndSorted.length > 0 && (
                    <button
                        onClick={handleOpenFullRoute}
                        className="w-full mt-4 flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-brand-600 text-white font-medium active:scale-[0.98] transition-transform shadow-sm"
                    >
                        <ExternalLink className="w-4 h-4" />
                        Abrir Rota Completa no Google Maps
                    </button>
                )}
            </div>
        </div>
    )
}
