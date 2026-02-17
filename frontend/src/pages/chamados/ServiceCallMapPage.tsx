import { useState, useMemo, useRef, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import {
    ArrowLeft, MapPin, Phone, Clock, User, Navigation,
    Layers, Filter, X, ChevronRight, Zap, RefreshCcw,
} from 'lucide-react'
import api from '@/lib/api'
import { SERVICE_CALL_STATUS } from '@/lib/constants'
import { Badge } from '@/components/ui/badge'
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

/* ─── Config ─── */

const statusConfig: Record<string, { label: string; color: string; markerColor: string; variant: any }> = {
    [SERVICE_CALL_STATUS.OPEN]: { label: 'Aberto', color: '#3b82f6', markerColor: '#2563eb', variant: 'info' },
    [SERVICE_CALL_STATUS.SCHEDULED]: { label: 'Agendado', color: '#f59e0b', markerColor: '#d97706', variant: 'warning' },
    [SERVICE_CALL_STATUS.IN_TRANSIT]: { label: 'Em Trânsito', color: '#06b6d4', markerColor: '#0891b2', variant: 'info' },
    [SERVICE_CALL_STATUS.IN_PROGRESS]: { label: 'Em Atendimento', color: '#f97316', markerColor: '#ea580c', variant: 'warning' },
    [SERVICE_CALL_STATUS.COMPLETED]: { label: 'Concluído', color: '#22c55e', markerColor: '#16a34a', variant: 'success' },
    [SERVICE_CALL_STATUS.CANCELLED]: { label: 'Cancelado', color: '#6b7280', markerColor: '#4b5563', variant: 'default' },
}

const priorityConfig: Record<string, { label: string; color: string }> = {
    low: { label: 'Baixa', color: '#94a3b8' },
    normal: { label: 'Normal', color: '#3b82f6' },
    high: { label: 'Alta', color: '#f59e0b' },
    urgent: { label: 'Urgente', color: '#ef4444' },
}

/* ─── Custom Marker SVG ─── */

function createMarkerIcon(status: string, priority: string): L.DivIcon {
    const sc = statusConfig[status] || statusConfig[SERVICE_CALL_STATUS.OPEN]
    const isUrgent = priority === 'urgent'
    const isHigh = priority === 'high'
    const pulseRing = isUrgent || isHigh
        ? `<div style="position:absolute;top:-4px;left:-4px;width:28px;height:28px;border-radius:50%;border:2px solid ${isUrgent ? '#ef4444' : '#f59e0b'};animation:pulse-ring 1.5s infinite;"></div>`
        : ''

    return L.divIcon({
        className: 'custom-marker',
        iconSize: [24, 34],
        iconAnchor: [12, 34],
        popupAnchor: [0, -36],
        html: `
            <div style="position:relative;display:flex;align-items:center;justify-content:center;">
                ${pulseRing}
                <svg width="24" height="34" viewBox="0 0 24 34" fill="none">
                    <path d="M12 0C5.373 0 0 5.373 0 12c0 9 12 22 12 22s12-13 12-22C24 5.373 18.627 0 12 0z" fill="${sc.markerColor}"/>
                    <circle cx="12" cy="12" r="6" fill="white" opacity="0.9"/>
                    <circle cx="12" cy="12" r="3" fill="${sc.markerColor}"/>
                </svg>
            </div>
        `,
    })
}

/* ─── Map Auto-Fit ─── */

function FitBounds({ points }: { points: [number, number][] }) {
    const map = useMap()
    useEffect(() => {
        if (points.length > 0) {
            const bounds = L.latLngBounds(points.map(([lat, lng]) => [lat, lng]))
            map.fitBounds(bounds, { padding: [50, 50], maxZoom: 14 })
        }
    }, [points, map])
    return null
}

/* ─── Sidebar Call Card ─── */

function CallCard({ call, isSelected, onClick }: { call: any; isSelected: boolean; onClick: () => void }) {
    const sc = statusConfig[call.status] || statusConfig[SERVICE_CALL_STATUS.OPEN]
    const pc = priorityConfig[call.priority]
    return (
        <div
            onClick={onClick}
            className={`p-3 rounded-lg border cursor-pointer transition-all ${isSelected
                    ? 'border-brand-400 bg-brand-50/50 shadow-card'
                    : 'border-surface-200 hover:border-surface-300 hover:bg-surface-50'
                }`}
        >
            <div className="flex items-start justify-between gap-2 mb-1.5">
                <span className="text-xs font-mono text-surface-400">{call.call_number}</span>
                <Badge variant={sc.variant} className="text-[10px] px-1.5 py-0">{sc.label}</Badge>
            </div>
            <p className="text-sm font-semibold text-surface-900 truncate mb-1">{call.customer?.name || '—'}</p>
            <div className="flex items-center gap-3 text-[11px] text-surface-500">
                {call.city && (
                    <span className="flex items-center gap-0.5">
                        <MapPin className="w-3 h-3" />{call.city}
                    </span>
                )}
                {pc && (
                    <span className="flex items-center gap-0.5">
                        <span className="w-1.5 h-1.5 rounded-full" style={{ background: pc.color }} />
                        {pc.label}
                    </span>
                )}
            </div>
            {call.technician && (
                <p className="text-[11px] text-surface-500 mt-1 flex items-center gap-0.5">
                    <User className="w-3 h-3" />{call.technician.name}
                </p>
            )}
        </div>
    )
}

/* ─── Main Page ─── */

export function ServiceCallMapPage() {
    const navigate = useNavigate()
    const [statusFilter, setStatusFilter] = useState<string>('')
    const [priorityFilter, setPriorityFilter] = useState<string>('')
    const [selectedCallId, setSelectedCallId] = useState<number | null>(null)
    const [sidebarOpen, setSidebarOpen] = useState(true)
    const mapRef = useRef<L.Map | null>(null)

    const { data: res, isLoading, refetch } = useQuery({
        queryKey: ['service-calls-map', statusFilter],
        queryFn: () => api.get('/service-calls-map', {
            params: statusFilter ? { status: statusFilter } : {},
        }),
        refetchInterval: 30000,
    })

    const allCalls: any[] = res?.data ?? []

    const filteredCalls = useMemo(() => {
        let result = allCalls
        if (priorityFilter) {
            result = result.filter((c) => c.priority === priorityFilter)
        }
        return result
    }, [allCalls, priorityFilter])

    const points = useMemo<[number, number][]>(
        () => filteredCalls.filter((c) => c.latitude && c.longitude).map((c) => [c.latitude, c.longitude]),
        [filteredCalls],
    )

    const stats = useMemo(() => {
        const s = { total: filteredCalls.length, urgent: 0, noTech: 0 }
        filteredCalls.forEach((c) => {
            if (c.priority === 'urgent') s.urgent++
            if (!c.technician) s.noTech++
        })
        return s
    }, [filteredCalls])

    const selectedCall = selectedCallId ? filteredCalls.find((c) => c.id === selectedCallId) : null

    const flyToCall = (call: any) => {
        setSelectedCallId(call.id)
        if (mapRef.current && call.latitude && call.longitude) {
            mapRef.current.flyTo([call.latitude, call.longitude], 15, { duration: 0.8 })
        }
    }

    const defaultCenter: [number, number] = points.length > 0
        ? [points.reduce((a, p) => a + p[0], 0) / points.length, points.reduce((a, p) => a + p[1], 0) / points.length]
        : [-23.55, -46.63] // São Paulo fallback

    return (
        <div className="flex flex-col h-[calc(100vh-6rem)]">
            {/* Top Bar */}
            <div className="flex items-center justify-between px-4 py-3 bg-surface-0 border-b border-default rounded-t-xl shadow-card z-10">
                <div className="flex items-center gap-3">
                    <button onClick={() => navigate('/chamados')} className="rounded-lg p-1.5 hover:bg-surface-100">
                        <ArrowLeft className="h-5 w-5 text-surface-500" />
                    </button>
                    <div>
                        <h1 className="text-base font-semibold text-surface-900 tracking-tight">Mapa de Chamados</h1>
                        <p className="text-xs text-surface-500">{stats.total} chamados no mapa</p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    {/* Quick Stats */}
                    {stats.urgent > 0 && (
                        <div className="hidden md:flex items-center gap-1 px-2 py-1 rounded-lg bg-red-50 text-red-600 text-xs font-medium">
                            <Zap className="w-3 h-3" /> {stats.urgent} urgente{stats.urgent > 1 ? 's' : ''}
                        </div>
                    )}
                    {stats.noTech > 0 && (
                        <div className="hidden md:flex items-center gap-1 px-2 py-1 rounded-lg bg-amber-50 text-amber-600 text-xs font-medium">
                            <User className="w-3 h-3" /> {stats.noTech} sem técnico
                        </div>
                    )}

                    {/* Filters */}
                    <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                        className="rounded-lg border border-default bg-surface-50 px-2.5 py-1.5 text-xs focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-500/15"
                    >
                        <option value="">Todos os status</option>
                        {Object.entries(statusConfig).map(([k, v]) => (
                            <option key={k} value={k}>{v.label}</option>
                        ))}
                    </select>
                    <select
                        value={priorityFilter}
                        onChange={(e) => setPriorityFilter(e.target.value)}
                        className="rounded-lg border border-default bg-surface-50 px-2.5 py-1.5 text-xs focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-500/15"
                    >
                        <option value="">Todas as prioridades</option>
                        {Object.entries(priorityConfig).map(([k, v]) => (
                            <option key={k} value={k}>{v.label}</option>
                        ))}
                    </select>

                    <button onClick={() => refetch()} className="p-1.5 rounded-lg hover:bg-surface-100 text-surface-500" title="Atualizar">
                        <RefreshCcw className="w-4 h-4" />
                    </button>
                    <button onClick={() => setSidebarOpen(!sidebarOpen)} className="p-1.5 rounded-lg hover:bg-surface-100 text-surface-500" title="Painel lateral">
                        <Layers className="w-4 h-4" />
                    </button>
                </div>
            </div>

            {/* Main Content */}
            <div className="flex flex-1 overflow-hidden rounded-b-xl border border-t-0 border-default">
                {/* Map */}
                <div className="flex-1 relative">
                    {isLoading ? (
                        <div className="absolute inset-0 flex items-center justify-center bg-surface-100">
                            <div className="flex flex-col items-center gap-3">
                                <div className="w-10 h-10 border-4 border-brand-200 border-t-brand-600 rounded-full animate-spin" />
                                <p className="text-sm text-surface-500">Carregando mapa...</p>
                            </div>
                        </div>
                    ) : points.length === 0 ? (
                        <div className="absolute inset-0 flex items-center justify-center bg-surface-50">
                            <div className="text-center">
                                <MapPin className="w-16 h-16 mx-auto text-surface-300 mb-4" />
                                <p className="text-sm font-medium text-surface-600">Nenhum chamado com localização</p>
                                <p className="text-xs text-surface-400 mt-1">Chamados precisam de latitude/longitude para aparecer no mapa</p>
                            </div>
                        </div>
                    ) : (
                        <MapContainer
                            center={defaultCenter}
                            zoom={11}
                            className="h-full w-full z-0"
                            ref={mapRef}
                            zoomControl={false}
                        >
                            <TileLayer
                                attribution='&copy; <a href="https://www.openstreetmap.org">OSM</a>'
                                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                            />
                            <FitBounds points={points} />

                            {filteredCalls.filter((c) => c.latitude && c.longitude).map((call) => (
                                <Marker
                                    key={call.id}
                                    position={[call.latitude, call.longitude]}
                                    icon={createMarkerIcon(call.status, call.priority)}
                                    eventHandlers={{
                                        click: () => setSelectedCallId(call.id),
                                    }}
                                >
                                    <Popup maxWidth={280} className="custom-popup">
                                        <div className="p-1">
                                            <div className="flex items-center justify-between mb-2">
                                                <span className="text-xs font-mono text-surface-400">{call.call_number}</span>
                                                <Badge variant={statusConfig[call.status]?.variant || 'default'} className="text-[10px] px-1.5 py-0">
                                                    {statusConfig[call.status]?.label || call.status}
                                                </Badge>
                                            </div>
                                            <p className="text-sm font-semibold text-surface-900 mb-1">{call.customer?.name || '—'}</p>
                                            {call.description && (
                                                <p className="text-xs text-surface-500 mb-2 line-clamp-2">{call.description}</p>
                                            )}
                                            <div className="space-y-1 text-xs text-surface-600">
                                                {call.customer?.phone && (
                                                    <p className="flex items-center gap-1">
                                                        <Phone className="w-3 h-3" /> {call.customer.phone}
                                                    </p>
                                                )}
                                                {call.technician && (
                                                    <p className="flex items-center gap-1">
                                                        <User className="w-3 h-3" /> {call.technician.name}
                                                    </p>
                                                )}
                                                {call.scheduled_date && (
                                                    <p className="flex items-center gap-1">
                                                        <Clock className="w-3 h-3" /> {new Date(call.scheduled_date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                                                    </p>
                                                )}
                                                {call.city && (
                                                    <p className="flex items-center gap-1">
                                                        <MapPin className="w-3 h-3" /> {call.city}/{call.state}
                                                    </p>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-2 mt-3 pt-2 border-t border-subtle">
                                                <button
                                                    onClick={() => navigate(`/chamados/${call.id}`)}
                                                    className="flex-1 text-center py-1 text-[11px] font-medium text-brand-600 hover:bg-brand-50 rounded transition-colors"
                                                >
                                                    Ver Detalhes <ChevronRight className="w-3 h-3 inline" />
                                                </button>
                                                <a
                                                    href={`https://www.google.com/maps/dir/?api=1&destination=${call.latitude},${call.longitude}`}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="flex-1 text-center py-1 text-[11px] font-medium text-emerald-600 hover:bg-emerald-50 rounded transition-colors"
                                                >
                                                    <Navigation className="w-3 h-3 inline mr-0.5" /> Navegar
                                                </a>
                                            </div>
                                        </div>
                                    </Popup>
                                </Marker>
                            ))}
                        </MapContainer>
                    )}

                    {/* Legend overlay */}
                    <div className="absolute bottom-4 left-4 bg-surface-0/90 backdrop-blur-sm rounded-lg p-3 shadow-card z-[500] border border-default">
                        <p className="text-[10px] font-semibold text-surface-500 uppercase tracking-wider mb-2">Legenda</p>
                        <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                            {Object.entries(statusConfig).map(([k, v]) => (
                                <div key={k} className="flex items-center gap-1.5 text-xs text-surface-600">
                                    <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: v.color }} />
                                    {v.label}
                                </div>
                            ))}
                        </div>
                        <div className="border-t border-subtle mt-2 pt-2">
                            <div className="flex items-center gap-3 text-[10px] text-surface-500">
                                <span className="flex items-center gap-1">
                                    <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" /> Urgente
                                </span>
                                <span className="flex items-center gap-1">
                                    <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" /> Alta
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Sidebar */}
                {sidebarOpen && (
                    <div className="w-80 border-l border-default bg-surface-0 flex flex-col overflow-hidden">
                        <div className="flex items-center justify-between px-4 py-3 border-b border-default">
                            <p className="text-sm font-semibold text-surface-900">
                                Chamados ({filteredCalls.length})
                            </p>
                            <button onClick={() => setSidebarOpen(false)} className="p-1 rounded hover:bg-surface-100">
                                <X className="w-4 h-4 text-surface-400" />
                            </button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-3 space-y-2">
                            {filteredCalls.length === 0 ? (
                                <div className="flex flex-col items-center py-8 text-surface-400">
                                    <Filter className="w-8 h-8 mb-2 opacity-30" />
                                    <p className="text-xs">Nenhum resultado</p>
                                </div>
                            ) : (
                                filteredCalls.map((call: any) => (
                                    <CallCard
                                        key={call.id}
                                        call={call}
                                        isSelected={selectedCallId === call.id}
                                        onClick={() => flyToCall(call)}
                                    />
                                ))
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* CSS for pulse animation */}
            <style>{`
                @keyframes pulse-ring {
                    0% { transform: scale(1); opacity: 1; }
                    100% { transform: scale(2); opacity: 0; }
                }
                .custom-marker { background: none !important; border: none !important; }
                .leaflet-popup-content-wrapper {
                    border-radius: 12px !important;
                    box-shadow: 0 8px 30px rgba(0,0,0,.12) !important;
                    padding: 0 !important;
                }
                .leaflet-popup-content { margin: 8px 10px !important; }
                .leaflet-popup-tip { box-shadow: 0 4px 10px rgba(0,0,0,.1) !important; }
            `}</style>
        </div>
    )
}
