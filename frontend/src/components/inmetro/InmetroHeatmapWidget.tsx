import { useMemo } from 'react'
import { MapPin, Navigation, AlertTriangle, CheckCircle, Loader2 } from 'lucide-react'
import { useMapData, type MapMarker } from '@/hooks/useInmetro'
import { Link } from 'react-router-dom'

interface CityData {
    city: string
    count: number
    instruments: number
    overdue: number
    lat: number
    lng: number
}

export function InmetroHeatmapWidget() {
    const { data: mapData, isLoading } = useMapData()

    const cityStats = useMemo<CityData[]>(() => {
        if (!mapData?.markers?.length) return []

        const grouped = new Map<string, { count: number; instruments: number; overdue: number; lat: number; lng: number }>()

        for (const m of mapData.markers) {
            const key = m.city || 'Sem cidade'
            const existing = grouped.get(key)
            if (existing) {
                existing.count++
                existing.instruments += m.instrument_count
                existing.overdue += m.overdue
            } else {
                grouped.set(key, {
                    count: 1,
                    instruments: m.instrument_count,
                    overdue: m.overdue,
                    lat: m.lat,
                    lng: m.lng,
                })
            }
        }

        return Array.from(grouped.entries())
            .map(([city, data]) => ({ city, ...data }))
            .sort((a, b) => b.instruments - a.instruments)
            .slice(0, 10)
    }, [mapData])

    const summary = useMemo(() => {
        if (!mapData?.markers?.length) return { total: 0, overdue: 0, customers: 0, avgDistance: 0 }
        const markers = mapData.markers
        const overdue = markers.reduce((s, m) => s + m.overdue, 0)
        const customers = markers.filter(m => m.is_customer).length
        const withDist = markers.filter(m => m.distance_km !== null)
        const avgDistance = withDist.length
            ? Math.round(withDist.reduce((s, m) => s + (m.distance_km ?? 0), 0) / withDist.length)
            : 0
        return { total: markers.length, overdue, customers, avgDistance }
    }, [mapData])

    if (isLoading) {
        return (
            <div className="rounded-xl border border-default bg-surface-0 p-5">
                <div className="flex items-center gap-2 mb-4">
                    <MapPin className="h-4 w-4 text-brand-500" />
                    <h2 className="text-sm font-semibold text-surface-800">Mapa de Cobertura</h2>
                </div>
                <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-5 w-5 animate-spin text-surface-400" />
                </div>
            </div>
        )
    }

    const maxInstruments = cityStats[0]?.instruments ?? 1

    return (
        <div className="rounded-xl border border-default bg-surface-0 p-5">
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-brand-500" />
                    <h2 className="text-sm font-semibold text-surface-800">Mapa de Cobertura</h2>
                </div>
                <Link
                    to="/inmetro/mapa"
                    className="text-xs font-medium text-brand-600 hover:text-brand-700 transition-colors"
                >
                    Ver mapa →
                </Link>
            </div>

            {/* Summary KPIs */}
            <div className="grid grid-cols-4 gap-2 mb-4">
                <div className="rounded-lg bg-blue-50 p-2 text-center">
                    <p className="text-lg font-bold text-blue-700">{summary.total}</p>
                    <p className="text-[10px] text-blue-600">Locais</p>
                </div>
                <div className="rounded-lg bg-red-50 p-2 text-center">
                    <p className="text-lg font-bold text-red-700">{summary.overdue}</p>
                    <p className="text-[10px] text-red-600">Vencidos</p>
                </div>
                <div className="rounded-lg bg-green-50 p-2 text-center">
                    <p className="text-lg font-bold text-green-700">{summary.customers}</p>
                    <p className="text-[10px] text-green-600">Clientes</p>
                </div>
                <div className="rounded-lg bg-amber-50 p-2 text-center">
                    <p className="text-lg font-bold text-amber-700">{summary.avgDistance}</p>
                    <p className="text-[10px] text-amber-600">km médio</p>
                </div>
            </div>

            {/* Without geo warning */}
            {mapData && mapData.total_without_geo > 0 && (
                <div className="flex items-center gap-1.5 rounded-lg bg-amber-50 border border-amber-200 px-2.5 py-1.5 mb-3 text-xs text-amber-700">
                    <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                    {mapData.total_without_geo} locais sem coordenadas
                </div>
            )}

            {/* City Heatmap Bars */}
            {cityStats.length > 0 ? (
                <div className="space-y-1.5">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-surface-400 mb-1">
                        Top Cidades por Instrumentos
                    </p>
                    {cityStats.map(city => (
                        <div key={city.city} className="group">
                            <div className="flex items-center justify-between mb-0.5">
                                <span className="text-xs font-medium text-surface-700 truncate max-w-[140px]">
                                    {city.city}
                                </span>
                                <div className="flex items-center gap-1.5 text-[10px] text-surface-500">
                                    <span>{city.instruments} equip.</span>
                                    {city.overdue > 0 && (
                                        <span className="text-red-500 font-medium">{city.overdue} venc.</span>
                                    )}
                                </div>
                            </div>
                            <div className="h-2 w-full rounded-full bg-surface-100 overflow-hidden">
                                <div
                                    className={`h-full rounded-full transition-all duration-300 ${city.overdue > 0 ? 'bg-gradient-to-r from-red-400 to-red-500' : 'bg-gradient-to-r from-brand-400 to-brand-500'
                                        }`}
                                    style={{ width: `${Math.max((city.instruments / maxInstruments) * 100, 4)}%` }}
                                />
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="text-center py-6 text-sm text-surface-400">
                    <MapPin className="h-8 w-8 mx-auto mb-2 text-surface-300" />
                    <p>Nenhum local geocodificado</p>
                    <p className="text-xs mt-1">Importe dados e execute o geocoding</p>
                </div>
            )}
        </div>
    )
}

export default InmetroHeatmapWidget
