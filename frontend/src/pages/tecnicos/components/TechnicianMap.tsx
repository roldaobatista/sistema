import { useState, useMemo, useEffect } from 'react'
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import L from 'leaflet'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import api from '@/lib/api'
import { Loader2, Map as MapIcon, RotateCw, Wand2 } from 'lucide-react'

// Fix Leaflet default icon issue
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

const DefaultIcon = L.icon({
    iconUrl: icon,
    shadowUrl: iconShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41]
});

L.Marker.prototype.options.icon = DefaultIcon;

import type { Technician, Customer, ScheduleItem } from '@/types/operational'
import { useAuthStore } from '@/stores/auth-store'

interface TechnicianMapProps {
    items: ScheduleItem[]
    technicianId?: string
}

function MapBounds({ items }: { items: ScheduleItem[] }) {
    const map = useMap()

    useEffect(() => {
        const points = items
            .filter(i => i.customer?.latitude && i.customer?.longitude)
            .map(i => [i.customer!.latitude!, i.customer!.longitude!] as [number, number])

        if (points.length > 0) {
            const bounds = L.latLngBounds(points)
            map.fitBounds(bounds, { padding: [50, 50] })
        }
    }, [items, map])

    return null
}

export function TechnicianMap({ items, technicianId }: TechnicianMapProps) {

    // Filter items regarding the selected technician (if any)
    const displayItems = useMemo(() => {
        let filtered = items;
        if (technicianId) {
            filtered = items.filter(i => i.technician.id.toString() === technicianId)
        }
        // Only items with coordinates
        return filtered.filter(i => i.customer?.latitude && i.customer?.longitude)
    }, [items, technicianId])

    // Effect to reset optimized route when filter changes
    useEffect(() => {
        setOptimizedRoute([])
    }, [technicianId, items])

    const handleOptimize = async () => {
        if (!technicianId) {
            toast.error('Selecione um técnico para otimizar a rota.')
            return
        }

        const workOrderIds = displayItems
            .filter(i => i.work_order?.id && i.source === 'schedule') // Only existing OS for now
            .map(i => i.work_order!.id)

        if (workOrderIds.length < 2) {
            toast.error('Necessário pelo menos 2 ordens de serviço para otimizar.')
            return
        }

        try {
            setOptimizing(true)
            const response = await api.post('/operational/route-optimization', {
                work_order_ids: workOrderIds,
                // Optional: send start_lat/lng if we knew the tech's current location
            })

            const optimizedOrder = response.data // array of WorkOrders in order

            // Reorder displayItems based on response
            // We need to map back to ScheduleItems. 
            // The response is a list of WorkOrders. We need to find the corresponding ScheduleItem.
            const newOrder: ScheduleItem[] = []

            optimizedOrder.forEach((wo: any) => {
                const item = displayItems.find(i => i.work_order?.id === wo.id)
                if (item) newOrder.push(item)
            })

            // Add any items that were not in the optimization (e.g. CRM/ServiceCalls without WO) at the end or keep them?
            // For visualization, we show the optimized path line.
            setOptimizedRoute(newOrder)
            toast.success('Rota otimizada com sucesso!')

        } catch (error: any) {
            console.error(error)
            toast.error('Erro ao otimizar rota.')
        } finally {
            setOptimizing(false)
        }
    }

    const routeToDisplay = optimizedRoute.length > 0 ? optimizedRoute : displayItems

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center">
                <h3 className="text-lg font-medium">Mapa de Rotas</h3>
                <div className="space-x-2">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setOptimizedRoute([])}
                        disabled={optimizedRoute.length === 0}
                    >
                        <RotateCw className="mr-2 h-4 w-4" />
                        Resetar
                    </Button>
                    <Button
                        onClick={handleOptimize}
                        disabled={optimizing || !technicianId || displayItems.length < 2}
                    >
                        {optimizing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Wand2 className="mr-2 h-4 w-4" />}
                        Otimizar Rota
                    </Button>
                </div>
            </div>

            <div className="h-[600px] w-full border rounded-md overflow-hidden relative z-0">
                <MapContainer
                    center={[-23.5505, -46.6333]} // Default SP
                    zoom={10}
                    style={{ height: '100%', width: '100%' }}
                >
                    <TileLayer
                        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                    />

                    <MapBounds items={displayItems} />

                    {routeToDisplay.map((item, index) => (
                        <Marker
                            key={item.id}
                            position={[item.customer!.latitude!, item.customer!.longitude!]}
                        >
                            <Popup>
                                <div className="p-1">
                                    <strong className="block text-sm mb-1">{index + 1}. {item.title}</strong>
                                    <span className="text-xs text-muted-foreground block">{item.customer?.name}</span>
                                    <span className="text-xs block mt-1">{item.address}</span>
                                    <div className="mt-2 text-xs">
                                        <span className={`px-1.5 py-0.5 rounded text-white ${newItemStatusColor(item.status)
                                            }`}>
                                            {item.status}
                                        </span>
                                    </div>
                                </div>
                            </Popup>
                        </Marker>
                    ))}

                    {/* Draw Polyline if optimized or just generic path */}
                    {routeToDisplay.length > 1 && (
                        <Polyline
                            positions={routeToDisplay.map(i => [i.customer!.latitude!, i.customer!.longitude!])}
                            color={optimizedRoute.length > 0 ? "#10b981" : "#3b82f6"} // Green if optimized, Blue otherwise
                            weight={4}
                            opacity={0.7}
                            dashArray={optimizedRoute.length > 0 ? undefined : "10, 10"} // Dashed if not optimized
                        />
                    )}
                </MapContainer>
            </div>

            {optimizedRoute.length > 0 && (
                <div className="text-sm text-muted-foreground">
                    <p>Rota otimizada exibida em verde. A ordem sugerida é:</p>
                    <ol className="list-decimal list-inside mt-1">
                        {optimizedRoute.map(item => (
                            <li key={item.id}>{item.customer?.name} ({item.title})</li>
                        ))}
                    </ol>
                </div>
            )}
        </div>
    )
}

function newItemStatusColor(status: string) {
    switch (status) {
        case 'scheduled': return 'bg-blue-500'
        case 'confirmed': return 'bg-indigo-500'
        case 'completed': return 'bg-green-500'
        case 'cancelled': return 'bg-red-500'
        default: return 'bg-gray-500'
    }
}
