import { useState, useEffect, useRef , useMemo } from 'react'
import { toast } from 'sonner'
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { MapPin, Loader2, Navigation, RefreshCw, AlertTriangle, CheckCircle, Scale, Crosshair } from 'lucide-react'
import { useMapData, useGeocodeLocations, useCalculateDistances, type MapMarker } from '@/hooks/useInmetro'
import { useAuthStore } from '@/stores/auth-store'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'

// Fix Leaflet default icon issue
delete (L.Icon.Default.prototype as any)._getIconUrl
L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
    iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

const createIcon = (color: string) => L.divIcon({
    className: 'custom-marker',
    html: `<div style="
        background: ${color};
        width: 24px; height: 24px;
        border-radius: 50% 50% 50% 0;
        transform: rotate(-45deg);
        border: 2px solid white;
        box-shadow: 0 2px 6px rgba(0,0,0,0.3);
    "></div>`,
    iconSize: [24, 24],
    iconAnchor: [12, 24],
    popupAnchor: [0, -24],
})

const priorityIcons: Record<string, L.DivIcon> = {
    urgent: createIcon('#ef4444'),
    high: createIcon('#f59e0b'),
    normal: createIcon('#3b82f6'),
    low: createIcon('#6b7280'),
}

const customerIcon = createIcon('#10b981')

function getMarkerIcon(marker: MapMarker): L.DivIcon {
    if (marker.is_customer) return customerIcon
    if (marker.overdue > 0) return priorityIcons.urgent
    return priorityIcons[marker.owner_priority] || priorityIcons.normal
}

function FitBounds({ markers }: { markers: MapMarker[] }) {
    const map = useMap()
    const fitted = useRef(false)

    useEffect(() => {
        if (markers.length > 0 && !fitted.current) {
            const bounds = L.latLngBounds(markers.map(m => [m.lat, m.lng]))
            map.fitBounds(bounds, { padding: [40, 40] })
            fitted.current = true
        }
    }, [markers, map])

    return null
}

export function InmetroMapPage() {

  // MVP: Data fetching
  const { data: items, isLoading, isError, refetch } = useQuery({
    queryKey: ['inmetro-map'],
    queryFn: () => api.get('/inmetro-map').then(r => r.data?.data ?? r.data ?? []),
  })

  // MVP: Delete mutation
  const queryClient = useQueryClient()
  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/inmetro-map/${id}`),
    onSuccess: () => { toast.success('Removido com sucesso'); queryClient.invalidateQueries({ queryKey: ['inmetro-map'] }) },
    onError: (err: any) => { toast.error(err?.response?.data?.message || 'Erro ao remover') },
  })
  const handleDelete = (id: number) => { if (window.confirm('Tem certeza que deseja remover?')) deleteMutation.mutate(id) }
    const { hasPermission } = useAuthStore()
    const canImport = hasPermission('inmetro.intelligence.import')

    const { data: mapData, isLoading, refetch } = useMapData()
    const geocodeMutation = useGeocodeLocations()
    const distanceMutation = useCalculateDistances()

    const [filter, setFilter] = useState<'all' | 'overdue' | 'customer' | 'lead'>('all')

    const markers = (mapData?.markers ?? []).filter(m => {
        if (filter === 'overdue') return m.overdue > 0
        if (filter === 'customer') return m.is_customer
        if (filter === 'lead') return !m.is_customer
        return true
    })

    const defaultCenter: [number, number] = [-15.78, -47.93] // Brasília

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-xl font-bold text-surface-900">Mapa de Instrumentos INMETRO</h1>
                    <p className="text-sm text-surface-500">
                        {mapData ? `${mapData.total_geolocated} locais no mapa â€¢ ${mapData.total_without_geo} sem coordenadas` : 'Carregando...'}
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    {canImport && mapData && mapData.total_without_geo > 0 && (
                        <button
                            onClick={() => geocodeMutation.mutate(50)}
                            disabled={geocodeMutation.isPending}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-amber-300 bg-amber-50 px-3 py-1.5 text-sm font-medium text-amber-700 hover:bg-amber-100 transition-colors disabled:opacity-50"
                        >
                            {geocodeMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Crosshair className="h-4 w-4" />}
                            Geocodificar ({mapData.total_without_geo})
                        </button>
                    )}
                    {canImport && (
                        <button
                            onClick={() => distanceMutation.mutate({ base_lat: -15.78, base_lng: -47.93 })}
                            disabled={distanceMutation.isPending}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-default bg-surface-0 px-3 py-1.5 text-sm font-medium text-surface-700 hover:bg-surface-50 transition-colors disabled:opacity-50"
                        >
                            {distanceMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Navigation className="h-4 w-4" />}
                            Calcular Distâncias
                        </button>
                    )}
                    <button
                        onClick={() => refetch()}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-default bg-surface-0 px-3 py-1.5 text-sm font-medium text-surface-700 hover:bg-surface-50 transition-colors"
                    >
                        <RefreshCw className="h-4 w-4" /> Atualizar
                    </button>
                </div>
            </div>

            {/* Filter Tabs */}
            <div className="flex items-center gap-2">
                {[
                    { key: 'all', label: 'Todos', count: mapData?.markers.length ?? 0 },
                    { key: 'overdue', label: 'Vencidos', count: mapData?.markers.filter(m => m.overdue > 0).length ?? 0 },
                    { key: 'customer', label: 'Clientes', count: mapData?.markers.filter(m => m.is_customer).length ?? 0 },
                    { key: 'lead', label: 'Leads', count: mapData?.markers.filter(m => !m.is_customer).length ?? 0 },
                ].map(tab => (
                    <button
                        key={tab.key}
                        onClick={() => setFilter(tab.key as typeof filter)}
                        className={`inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${filter === tab.key
                                ? 'bg-brand-600 text-white'
                                : 'bg-surface-100 text-surface-600 hover:bg-surface-200'
                            }`}
                    >
                        {tab.label} ({tab.count})
                    </button>
                ))}
            </div>

            {/* Map + Sidebar */}
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
                {/* Map */}
                <div className="lg:col-span-3 rounded-xl border border-default bg-surface-0 overflow-hidden" style={{ height: '600px' }}>
                    {isLoading ? (
                        <div className="flex items-center justify-center h-full">
                            <Loader2 className="h-8 w-8 animate-spin text-brand-500" />
                        </div>
                    ) : (
                        <MapContainer
                            center={defaultCenter}
                            zoom={4}
                            style={{ height: '100%', width: '100%' }}
                            scrollWheelZoom={true}
                        >
                            <TileLayer
                                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                            />
                            <FitBounds markers={markers} />
                            {markers.map(marker => (
                                <Marker
                                    key={marker.id}
                                    position={[marker.lat, marker.lng]}
                                    icon={getMarkerIcon(marker)}
                                >
                                    <Popup maxWidth={300}>
                                        <div className="space-y-1.5 text-sm">
                                            <p className="font-bold text-surface-900">{marker.owner_name}</p>
                                            {marker.owner_document && (
                                                <p className="text-xs text-surface-500 font-mono">{marker.owner_document}</p>
                                            )}
                                            <p className="text-xs text-surface-600">
                                                <MapPin className="inline h-3 w-3 mr-0.5" />
                                                {marker.city}/{marker.state}
                                                {marker.farm_name && ` (${marker.farm_name})`}
                                            </p>
                                            <div className="flex items-center gap-2 text-xs">
                                                <span className="flex items-center gap-0.5">
                                                    <Scale className="h-3 w-3" /> {marker.instrument_count} equip.
                                                </span>
                                                {marker.overdue > 0 && (
                                                    <span className="flex items-center gap-0.5 text-red-600">
                                                        <AlertTriangle className="h-3 w-3" /> {marker.overdue} vencidos
                                                    </span>
                                                )}
                                                {marker.expiring_30d > 0 && (
                                                    <span className="flex items-center gap-0.5 text-amber-600">
                                                        {marker.expiring_30d} vence 30d
                                                    </span>
                                                )}
                                            </div>
                                            {marker.is_customer && (
                                                <span className="inline-flex items-center gap-0.5 text-xs text-green-600">
                                                    <CheckCircle className="h-3 w-3" /> Cliente CRM
                                                </span>
                                            )}
                                            {marker.distance_km !== null && (
                                                <p className="text-xs text-surface-500">
                                                    <Navigation className="inline h-3 w-3 mr-0.5" />
                                                    {marker.distance_km} km da base
                                                </p>
                                            )}
                                        </div>
                                    </Popup>
                                </Marker>
                            ))}
                        </MapContainer>
                    )}
                </div>

                {/* Sidebar: Top Cities */}
                <div className="rounded-xl border border-default bg-surface-0 p-4 overflow-y-auto" style={{ maxHeight: '600px' }}>
                    <h3 className="text-sm font-semibold text-surface-900 mb-3">Top Cidades</h3>
                    {mapData?.by_city && Object.keys(mapData.by_city).length > 0 ? (
                        <div className="space-y-2">
                            {Object.entries(mapData.by_city).map(([city, stats]) => (
                                <div key={city} className="rounded-lg border border-subtle p-2.5">
                                    <p className="text-sm font-medium text-surface-800">{city}</p>
                                    <div className="flex items-center gap-2 mt-1 text-xs text-surface-500">
                                        <span>{stats.count} locais</span>
                                        <span>â€¢</span>
                                        <span>{stats.instruments} equip.</span>
                                        {stats.overdue > 0 && (
                                            <>
                                                <span>â€¢</span>
                                                <span className="text-red-600">{stats.overdue} venc.</span>
                                            </>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className="text-xs text-surface-400">Nenhum dado de cidade</p>
                    )}

                    {/* Legend */}
                    <div className="mt-4 pt-3 border-t border-subtle">
                        <p className="text-xs font-medium text-surface-600 mb-2">Legenda</p>
                        <div className="space-y-1.5 text-xs text-surface-600">
                            <div className="flex items-center gap-2">
                                <span className="inline-block w-3 h-3 rounded-full bg-red-500" /> Urgente / Vencido
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="inline-block w-3 h-3 rounded-full bg-amber-500" /> Alta prioridade
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="inline-block w-3 h-3 rounded-full bg-blue-500" /> Normal
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="inline-block w-3 h-3 rounded-full bg-green-500" /> Cliente CRM
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default InmetroMapPage