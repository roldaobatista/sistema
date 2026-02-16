import { useState, useEffect, useCallback, useRef } from 'react'
import { useOfflineStore } from '@/hooks/useOfflineStore'

export interface TechAlert {
    id: string
    type: 'sla_warning' | 'checklist_pending' | 'proximity' | 'calibration_expiring'
    title: string
    message: string
    severity: 'info' | 'warning' | 'critical'
    workOrderId?: number
    createdAt: string
    dismissed: boolean
}

const PROXIMITY_RADIUS_M = 500
const STORAGE_KEY = 'tech-dismissed-alerts'

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371
    const dLat = ((lat2 - lat1) * Math.PI) / 180
    const dLon = ((lon2 - lon1) * Math.PI) / 180
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2)
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
    return R * c
}

function loadDismissed(): Set<string> {
    try {
        const saved = localStorage.getItem(STORAGE_KEY)
        return new Set(saved ? JSON.parse(saved) : [])
    } catch {
        return new Set()
    }
}

function saveDismissed(set: Set<string>): void {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify([...set]))
    } catch {
        // ignore
    }
}

export function useTechAlerts() {
    const { items: workOrders } = useOfflineStore('work-orders')
    const { items: checklistResponses } = useOfflineStore('checklist-responses')
    const { items: customerCapsules } = useOfflineStore('customer-capsules')

    const [alerts, setAlerts] = useState<TechAlert[]>([])
    const [dismissed, setDismissed] = useState<Set<string>>(loadDismissed)
    const [position, setPosition] = useState<{ lat: number; lng: number } | null>(null)
    const watchIdRef = useRef<number | null>(null)

    const dismiss = useCallback((alertId: string) => {
        setDismissed(prev => {
            const next = new Set(prev)
            next.add(alertId)
            saveDismissed(next)
            return next
        })
    }, [])

    const dismissAll = useCallback(() => {
        setDismissed(prev => {
            const next = new Set(prev)
            alerts.forEach(a => next.add(a.id))
            saveDismissed(next)
            return next
        })
    }, [alerts])

    useEffect(() => {
        if (!navigator.geolocation) return
        watchIdRef.current = navigator.geolocation.watchPosition(
            pos => setPosition({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
            () => setPosition(null),
            { enableHighAccuracy: true, maximumAge: 60000, timeout: 10000 }
        )
        return () => {
            if (watchIdRef.current != null) {
                navigator.geolocation.clearWatch(watchIdRef.current)
                watchIdRef.current = null
            }
        }
    }, [])

    useEffect(() => {
        const newAlerts: TechAlert[] = []
        const now = new Date()

        const woIdsWithChecklist = new Set(
            checklistResponses.map((r: { work_order_id: number }) => r.work_order_id)
        )

        const customerCoords = new Map<number, { lat: number; lng: number }>()
        for (const cap of customerCapsules) {
            const data = (cap as { id: number; data?: { latitude?: number; longitude?: number } }).data
            if (data?.latitude != null && data?.longitude != null) {
                customerCoords.set((cap as { id: number }).id, { lat: data.latitude, lng: data.longitude })
            }
        }

        for (const wo of workOrders) {
            const woAny = wo as Record<string, unknown>
            const woLat = woAny.latitude as number | undefined
            const woLng = woAny.longitude as number | undefined
            const custCoords = wo.customer_id ? customerCoords.get(wo.customer_id) : undefined
            const lat = woLat ?? custCoords?.lat
            const lng = woLng ?? custCoords?.lng

            if (wo.sla_due_at && !['completed', 'cancelled'].includes(wo.status)) {
                const due = new Date(wo.sla_due_at)
                const diffHours = (due.getTime() - now.getTime()) / (1000 * 60 * 60)
                const osLabel = wo.os_number ?? wo.number ?? String(wo.id)

                if (diffHours < 0) {
                    newAlerts.push({
                        id: `sla-breach-${wo.id}`,
                        type: 'sla_warning',
                        title: 'SLA Estourado!',
                        message: `OS ${osLabel} ultrapassou o prazo de SLA`,
                        severity: 'critical',
                        workOrderId: wo.id,
                        createdAt: now.toISOString(),
                        dismissed: false,
                    })
                } else if (diffHours < 2) {
                    newAlerts.push({
                        id: `sla-warn-${wo.id}`,
                        type: 'sla_warning',
                        title: 'SLA próximo!',
                        message: `OS ${osLabel} vence em ${Math.ceil(diffHours * 60)} minutos`,
                        severity: 'warning',
                        workOrderId: wo.id,
                        createdAt: now.toISOString(),
                        dismissed: false,
                    })
                }
            }

            if (wo.status === 'completed' && !woIdsWithChecklist.has(wo.id)) {
                const osLabel = wo.os_number ?? wo.number ?? String(wo.id)
                newAlerts.push({
                    id: `checklist-pending-${wo.id}`,
                    type: 'checklist_pending',
                    title: 'Checklist pendente',
                    message: `OS ${osLabel} foi concluída sem checklist enviado`,
                    severity: 'warning',
                    workOrderId: wo.id,
                    createdAt: now.toISOString(),
                    dismissed: false,
                })
            }

            if (position && lat != null && lng != null && !['completed', 'cancelled'].includes(wo.status)) {
                const distKm = haversineKm(position.lat, position.lng, lat, lng)
                if (distKm * 1000 <= PROXIMITY_RADIUS_M) {
                    const osLabel = wo.os_number ?? wo.number ?? String(wo.id)
                    newAlerts.push({
                        id: `proximity-${wo.id}`,
                        type: 'proximity',
                        title: 'Próximo do cliente',
                        message: `OS ${osLabel} está a ${Math.round(distKm * 1000)} m`,
                        severity: 'info',
                        workOrderId: wo.id,
                        createdAt: now.toISOString(),
                        dismissed: false,
                    })
                }
            }
        }

        setAlerts(newAlerts)
    }, [workOrders, checklistResponses, customerCapsules, position])

    const activeAlerts = alerts.filter(a => !dismissed.has(a.id))
    const criticalCount = activeAlerts.filter(a => a.severity === 'critical').length
    const warningCount = activeAlerts.filter(a => a.severity === 'warning').length

    return {
        alerts: activeAlerts,
        allAlerts: alerts,
        criticalCount,
        warningCount,
        totalCount: activeAlerts.length,
        dismiss,
        dismissAll,
    }
}
