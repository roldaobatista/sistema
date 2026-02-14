import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'
import { toast } from 'sonner'
import { AxiosError } from 'axios'

function handleError(error: unknown) {
    const err = error as AxiosError<{ message?: string; errors?: Record<string, string[]> }>
    if (err.response?.status === 403) {
        toast.error('Sem permissão para esta ação')
    } else if (err.response?.status === 422) {
        const msgs = err.response.data?.errors
        if (msgs) Object.values(msgs).flat().forEach(m => toast.error(m))
        else toast.error(err.response.data?.message || 'Dados inválidos')
    } else {
        toast.error(err.response?.data?.message || 'Ocorreu um erro')
    }
}

const ADV = '/inmetro/advanced'

// ══════════════════════════════════════════════
// PROSPECTION & LEAD MANAGEMENT
// ══════════════════════════════════════════════

export interface QueueItem {
    id: number
    owner_id: number
    owner_name: string
    scheduled_date: string
    priority_order: number
    reason: string
    status: 'pending' | 'contacted' | 'skipped'
    notes: string | null
}

export function useContactQueue(date?: string) {
    return useQuery({
        queryKey: ['inmetro', 'advanced', 'contact-queue', date],
        queryFn: () => api.get(`${ADV}/contact-queue`, { params: { date } }).then(r => r.data),
    })
}

export function useGenerateDailyQueue() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: () => api.post(`${ADV}/generate-queue`),
        onSuccess: (res) => {
            toast.success(`Fila gerada: ${res.data?.total_generated ?? 0} leads`)
            qc.invalidateQueries({ queryKey: ['inmetro', 'advanced', 'contact-queue'] })
        },
        onError: handleError,
    })
}

export function useMarkQueueItem() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: ({ queueId, status, notes }: { queueId: number; status: string; notes?: string }) =>
            api.patch(`${ADV}/queue/${queueId}`, { status, notes }),
        onSuccess: () => {
            toast.success('Item atualizado')
            qc.invalidateQueries({ queryKey: ['inmetro', 'advanced', 'contact-queue'] })
        },
        onError: handleError,
    })
}

export function useFollowUps() {
    return useQuery({
        queryKey: ['inmetro', 'advanced', 'follow-ups'],
        queryFn: () => api.get(`${ADV}/follow-ups`).then(r => r.data),
    })
}

export interface LeadScore {
    score: number
    factors: Record<string, number>
    breakdown: { factor: string; value: number; label: string }[]
}

export function useLeadScore(ownerId: number | null) {
    return useQuery<LeadScore>({
        queryKey: ['inmetro', 'advanced', 'lead-score', ownerId],
        queryFn: () => api.get(`${ADV}/lead-score/${ownerId}`).then(r => r.data?.data),
        enabled: !!ownerId,
    })
}

export function useRecalculateScores() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: () => api.post(`${ADV}/recalculate-scores`),
        onSuccess: (res) => {
            toast.success(res.data?.message || 'Scores recalculados')
            qc.invalidateQueries({ queryKey: ['inmetro'] })
        },
        onError: handleError,
    })
}

export function useChurnDetection() {
    return useQuery({
        queryKey: ['inmetro', 'advanced', 'churn'],
        queryFn: () => api.get(`${ADV}/churn`).then(r => r.data),
    })
}

export function useNewRegistrations(days?: number) {
    return useQuery({
        queryKey: ['inmetro', 'advanced', 'new-registrations', days],
        queryFn: () => api.get(`${ADV}/new-registrations`, { params: { days } }).then(r => r.data),
    })
}

export function useNextCalibrations(days?: number) {
    return useQuery({
        queryKey: ['inmetro', 'advanced', 'next-calibrations', days],
        queryFn: () => api.get(`${ADV}/next-calibrations`, { params: { days } }).then(r => r.data),
    })
}

export function useClassifySegments() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: () => api.post(`${ADV}/classify-segments`),
        onSuccess: () => {
            toast.success('Segmentos classificados')
            qc.invalidateQueries({ queryKey: ['inmetro'] })
        },
        onError: handleError,
    })
}

export function useSegmentDistribution() {
    return useQuery({
        queryKey: ['inmetro', 'advanced', 'segment-distribution'],
        queryFn: () => api.get(`${ADV}/segment-distribution`).then(r => r.data),
    })
}

export function useRejectAlerts() {
    return useQuery({
        queryKey: ['inmetro', 'advanced', 'reject-alerts'],
        queryFn: () => api.get(`${ADV}/reject-alerts`).then(r => r.data),
    })
}

export function useConversionRanking(params?: Record<string, string>) {
    return useQuery({
        queryKey: ['inmetro', 'advanced', 'conversion-ranking', params],
        queryFn: () => api.get(`${ADV}/conversion-ranking`, { params }).then(r => r.data),
    })
}

export interface LeadInteraction {
    id: number
    owner_id: number
    user_id: number | null
    user_name: string | null
    channel: string
    result: string
    notes: string | null
    scheduled_follow_up: string | null
    created_at: string
}

export function useInteractionHistory(ownerId: number | null) {
    return useQuery({
        queryKey: ['inmetro', 'advanced', 'interactions', ownerId],
        queryFn: () => api.get(`${ADV}/interactions/${ownerId}`).then(r => r.data),
        enabled: !!ownerId,
    })
}

export function useLogInteraction() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: (data: { owner_id: number; channel: string; result: string; notes?: string; scheduled_follow_up?: string }) =>
            api.post(`${ADV}/interactions`, data),
        onSuccess: (_, vars) => {
            toast.success('Interação registrada')
            qc.invalidateQueries({ queryKey: ['inmetro', 'advanced', 'interactions', vars.owner_id] })
            qc.invalidateQueries({ queryKey: ['inmetro', 'advanced', 'contact-queue'] })
        },
        onError: handleError,
    })
}

// ══════════════════════════════════════════════
// TERRITORIAL INTELLIGENCE
// ══════════════════════════════════════════════

export function useLayeredMapData(params?: Record<string, string>) {
    return useQuery({
        queryKey: ['inmetro', 'advanced', 'map-layers', params],
        queryFn: () => api.get(`${ADV}/map-layers`, { params }).then(r => r.data),
    })
}

export function useOptimizeRoute() {
    return useMutation({
        mutationFn: (data: { base_lat: number; base_lng: number; owner_ids: number[] }) =>
            api.post(`${ADV}/optimize-route`, data).then(r => r.data),
        onError: handleError,
    })
}

export function useCompetitorZones() {
    return useQuery({
        queryKey: ['inmetro', 'advanced', 'competitor-zones'],
        queryFn: () => api.get(`${ADV}/competitor-zones`).then(r => r.data),
    })
}

export function useCoverageVsPotential() {
    return useQuery({
        queryKey: ['inmetro', 'advanced', 'coverage-potential'],
        queryFn: () => api.get(`${ADV}/coverage-potential`).then(r => r.data),
    })
}

export function useDensityViability() {
    return useMutation({
        mutationFn: (data: { base_lat: number; base_lng: number }) =>
            api.post(`${ADV}/density-viability`, data).then(r => r.data),
        onError: handleError,
    })
}

export function useNearbyLeads(lat?: number, lng?: number, radiusKm = 100) {
    return useQuery({
        queryKey: ['inmetro', 'advanced', 'nearby-leads', lat, lng, radiusKm],
        queryFn: () => api.get(`${ADV}/nearby-leads`, { params: { lat, lng, radius_km: radiusKm } }).then(r => r.data),
        enabled: !!lat && !!lng,
    })
}

// ══════════════════════════════════════════════
// COMPETITOR TRACKING
// ══════════════════════════════════════════════

export function useMarketShareTimeline(months?: number) {
    return useQuery({
        queryKey: ['inmetro', 'advanced', 'market-share-timeline', months],
        queryFn: () => api.get(`${ADV}/market-share-timeline`, { params: { months } }).then(r => r.data),
    })
}

export function useSnapshotMarketShare() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: () => api.post(`${ADV}/snapshot-market-share`),
        onSuccess: () => {
            toast.success('Snapshot de market share capturado')
            qc.invalidateQueries({ queryKey: ['inmetro', 'advanced', 'market-share-timeline'] })
        },
        onError: handleError,
    })
}

export function useCompetitorMovements() {
    return useQuery({
        queryKey: ['inmetro', 'advanced', 'competitor-movements'],
        queryFn: () => api.get(`${ADV}/competitor-movements`).then(r => r.data),
    })
}

export function usePricingEstimate() {
    return useQuery({
        queryKey: ['inmetro', 'advanced', 'pricing-estimate'],
        queryFn: () => api.get(`${ADV}/pricing-estimate`).then(r => r.data),
    })
}

export function useCompetitorProfile(competitorId: number | null) {
    return useQuery({
        queryKey: ['inmetro', 'advanced', 'competitor-profile', competitorId],
        queryFn: () => api.get(`${ADV}/competitor-profile/${competitorId}`).then(r => r.data),
        enabled: !!competitorId,
    })
}

export function useRecordWinLoss() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: (data: { outcome: 'win' | 'loss'; reason: string; estimated_value?: number; competitor_id?: number; owner_id?: number; notes?: string }) =>
            api.post(`${ADV}/win-loss`, data),
        onSuccess: () => {
            toast.success('Win/Loss registrado')
            qc.invalidateQueries({ queryKey: ['inmetro', 'advanced', 'win-loss'] })
        },
        onError: handleError,
    })
}

export function useWinLossAnalysis() {
    return useQuery({
        queryKey: ['inmetro', 'advanced', 'win-loss'],
        queryFn: () => api.get(`${ADV}/win-loss`).then(r => r.data),
    })
}

// ══════════════════════════════════════════════
// OPERATIONAL BRIDGE
// ══════════════════════════════════════════════

export function useSuggestLinkedEquipments(customerId: number | null) {
    return useQuery({
        queryKey: ['inmetro', 'advanced', 'suggest-equipments', customerId],
        queryFn: () => api.get(`${ADV}/suggest-equipments/${customerId}`).then(r => r.data),
        enabled: !!customerId,
    })
}

export function useLinkInstrument() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: (data: { instrument_id: number; equipment_id: number }) =>
            api.post(`${ADV}/link-instrument`, data),
        onSuccess: () => {
            toast.success('Instrumento vinculado ao equipamento')
            qc.invalidateQueries({ queryKey: ['inmetro'] })
        },
        onError: handleError,
    })
}

export function usePrefillCertificate(instrumentId: number | null) {
    return useQuery({
        queryKey: ['inmetro', 'advanced', 'prefill-certificate', instrumentId],
        queryFn: () => api.get(`${ADV}/prefill-certificate/${instrumentId}`).then(r => r.data),
        enabled: !!instrumentId,
    })
}

export function useInstrumentTimeline(instrumentId: number | null) {
    return useQuery({
        queryKey: ['inmetro', 'advanced', 'instrument-timeline', instrumentId],
        queryFn: () => api.get(`${ADV}/instrument-timeline/${instrumentId}`).then(r => r.data),
        enabled: !!instrumentId,
    })
}

export function useCompareCalibrations(instrumentId: number | null) {
    return useQuery({
        queryKey: ['inmetro', 'advanced', 'compare-calibrations', instrumentId],
        queryFn: () => api.get(`${ADV}/compare-calibrations/${instrumentId}`).then(r => r.data),
        enabled: !!instrumentId,
    })
}

// ══════════════════════════════════════════════
// REPORTING & ANALYTICS
// ══════════════════════════════════════════════

export function useExecutiveDashboard() {
    return useQuery({
        queryKey: ['inmetro', 'advanced', 'executive-dashboard'],
        queryFn: () => api.get(`${ADV}/executive-dashboard`).then(r => r.data),
    })
}

export function useRevenueForecast(months?: number) {
    return useQuery({
        queryKey: ['inmetro', 'advanced', 'revenue-forecast', months],
        queryFn: () => api.get(`${ADV}/revenue-forecast`, { params: { months } }).then(r => r.data),
    })
}

export function useConversionFunnel() {
    return useQuery({
        queryKey: ['inmetro', 'advanced', 'conversion-funnel'],
        queryFn: () => api.get(`${ADV}/conversion-funnel`).then(r => r.data),
    })
}

export function useExportData(params?: Record<string, string>) {
    return useQuery({
        queryKey: ['inmetro', 'advanced', 'export-data', params],
        queryFn: () => api.get(`${ADV}/export-data`, { params }).then(r => r.data),
        enabled: false, // manual trigger only
    })
}

export function useYearOverYear() {
    return useQuery({
        queryKey: ['inmetro', 'advanced', 'year-over-year'],
        queryFn: () => api.get(`${ADV}/year-over-year`).then(r => r.data),
    })
}

// ══════════════════════════════════════════════
// COMPLIANCE & REGULATORY
// ══════════════════════════════════════════════

export function useComplianceChecklists(instrumentType?: string) {
    return useQuery({
        queryKey: ['inmetro', 'advanced', 'compliance-checklists', instrumentType],
        queryFn: () => api.get(`${ADV}/compliance-checklists`, { params: { instrument_type: instrumentType } }).then(r => r.data),
    })
}

export function useCreateChecklist() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: (data: { instrument_type: string; title: string; items: string[]; regulation_reference?: string }) =>
            api.post(`${ADV}/compliance-checklists`, data),
        onSuccess: () => {
            toast.success('Checklist criado')
            qc.invalidateQueries({ queryKey: ['inmetro', 'advanced', 'compliance-checklists'] })
        },
        onError: handleError,
    })
}

export function useUpdateChecklist() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: ({ id, data }: { id: number; data: Record<string, unknown> }) =>
            api.put(`${ADV}/compliance-checklists/${id}`, data),
        onSuccess: () => {
            toast.success('Checklist atualizado')
            qc.invalidateQueries({ queryKey: ['inmetro', 'advanced', 'compliance-checklists'] })
        },
        onError: handleError,
    })
}

export function useRegulatoryTraceability(instrumentId: number | null) {
    return useQuery({
        queryKey: ['inmetro', 'advanced', 'regulatory-traceability', instrumentId],
        queryFn: () => api.get(`${ADV}/regulatory-traceability/${instrumentId}`).then(r => r.data),
        enabled: !!instrumentId,
    })
}

export function useSimulateRegulatoryImpact() {
    return useMutation({
        mutationFn: (data: { current_period_months: number; new_period_months: number; affected_types?: string[] }) =>
            api.post(`${ADV}/simulate-impact`, data).then(r => r.data),
        onError: handleError,
    })
}

export function useCorporateGroups() {
    return useQuery({
        queryKey: ['inmetro', 'advanced', 'corporate-groups'],
        queryFn: () => api.get(`${ADV}/corporate-groups`).then(r => r.data),
    })
}

export function useComplianceInstrumentTypes() {
    return useQuery({
        queryKey: ['inmetro', 'advanced', 'compliance-instrument-types'],
        queryFn: () => api.get(`${ADV}/compliance-instrument-types`).then(r => r.data),
    })
}

export function useDetectAnomalies() {
    return useQuery({
        queryKey: ['inmetro', 'advanced', 'anomalies'],
        queryFn: () => api.get(`${ADV}/anomalies`).then(r => r.data),
    })
}

export function useRenewalProbability() {
    return useQuery({
        queryKey: ['inmetro', 'advanced', 'renewal-probability'],
        queryFn: () => api.get(`${ADV}/renewal-probability`).then(r => r.data),
    })
}

// ══════════════════════════════════════════════
// WEBHOOKS & API
// ══════════════════════════════════════════════

export interface InmetroWebhookConfig {
    id: number
    event_type: string
    url: string
    secret: string | null
    is_active: boolean
    failure_count: number
    last_triggered_at: string | null
    created_at: string
}

export function usePublicInstrumentData(city?: string) {
    return useQuery({
        queryKey: ['inmetro', 'advanced', 'public-data', city],
        queryFn: () => api.get(`${ADV}/public-data`, { params: { city } }).then(r => r.data),
    })
}

export function useWebhooks() {
    return useQuery<InmetroWebhookConfig[]>({
        queryKey: ['inmetro', 'advanced', 'webhooks'],
        queryFn: () => api.get(`${ADV}/webhooks`).then(r => r.data),
    })
}

export function useWebhookEvents() {
    return useQuery<Record<string, string>>({
        queryKey: ['inmetro', 'advanced', 'webhook-events'],
        queryFn: () => api.get(`${ADV}/webhook-events`).then(r => r.data),
    })
}

export function useCreateWebhook() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: (data: { event_type: string; url: string; secret?: string }) =>
            api.post(`${ADV}/webhooks`, data),
        onSuccess: () => {
            toast.success('Webhook criado')
            qc.invalidateQueries({ queryKey: ['inmetro', 'advanced', 'webhooks'] })
        },
        onError: handleError,
    })
}

export function useUpdateWebhook() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: ({ id, data }: { id: number; data: Record<string, unknown> }) =>
            api.put(`${ADV}/webhooks/${id}`, data),
        onSuccess: () => {
            toast.success('Webhook atualizado')
            qc.invalidateQueries({ queryKey: ['inmetro', 'advanced', 'webhooks'] })
        },
        onError: handleError,
    })
}

export function useDeleteWebhook() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: (id: number) => api.delete(`${ADV}/webhooks/${id}`),
        onSuccess: () => {
            toast.success('Webhook removido')
            qc.invalidateQueries({ queryKey: ['inmetro', 'advanced', 'webhooks'] })
        },
        onError: handleError,
    })
}
